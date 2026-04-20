"""Редактирование сметы через AI — принимает смету + правки, возвращает обновлённый llm_answer."""

import json
import os
import psycopg2
import requests

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}


def resp(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False)}


def check_auth(headers: dict) -> bool:
    import hashlib
    token = headers.get('x-auth-token') or headers.get('X-Auth-Token', '')
    pwd_hash = os.environ.get('ADMIN_PASSWORD_HASH', '')
    if not token or not pwd_hash:
        return False
    return hashlib.sha256(token.encode()).hexdigest() == pwd_hash


def call_llm(messages: list) -> str:
    key = os.environ.get('OPENROUTER_API_KEY_2', '') or os.environ.get('OPENAI_API_KEY', '')
    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mospotolki.ru',
    }
    payload = {
        'model': 'openai/gpt-4o-mini',
        'messages': messages,
        'max_tokens': 3000,
        'temperature': 0,
    }
    r = requests.post('https://openrouter.ai/api/v1/chat/completions', json=payload, headers=headers, timeout=55)
    r.raise_for_status()
    return r.json()['choices'][0]['message']['content']


def get_prices_block() -> str:
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT category, name, price, unit FROM {SCHEMA}.ai_prices WHERE active = true ORDER BY sort_order, id")
        rows = cur.fetchall()
        cur.close(); conn.close()
        if not rows:
            return ''
        lines = []
        cur_cat = None
        for row in rows:
            cat, name, price, unit = row
            if cat != cur_cat:
                lines.append(f'\n[{cat}]')
                cur_cat = cat
            lines.append(f'  {name} — {price} ₽/{unit}')
        return '\n'.join(lines)
    except Exception as e:
        print(f'[prices] error: {e}')
        return ''


def handler(event: dict, context) -> dict:
    """Принимает смету + правки по позициям, отправляет в LLM, сохраняет обновлённый llm_answer."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    hdrs = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    if not check_auth(hdrs):
        return resp(401, {'error': 'Unauthorized'})

    body = json.loads(event.get('body') or '{}')
    correction_id = body.get('correction_id')
    original_answer = body.get('original_answer', '')
    user_text = body.get('user_text', '')
    comments = body.get('comments', {})  # {позиция: комментарий}

    if not correction_id or not original_answer:
        return resp(400, {'error': 'correction_id и original_answer обязательны'})

    # Формируем список правок
    changes_lines = []
    for position, comment in comments.items():
        if comment and comment.strip():
            changes_lines.append(f'• {position}: {comment.strip()}')

    if not changes_lines:
        return resp(400, {'error': 'Нет правок для применения'})

    changes_text = '\n'.join(changes_lines)
    prices_block = get_prices_block()

    system_prompt = f"""Ты сметчик-технолог компании MosPotolki (натяжные потолки).
Тебе дана готовая смета и список правок по позициям.
Твоя задача — применить правки и вернуть обновлённую смету в том же формате.

ВАЖНО:
- Сохраняй точно такой же формат сметы (названия, структура, итоги)
- Применяй только указанные правки, остальное не трогай
- Все цены берёшь СТРОГО из прайс-листа ниже
- Пересчитывай итоги после изменений

=== АКТУАЛЬНЫЙ ПРАЙС-ЛИСТ ==={prices_block}"""

    user_prompt = f"""Исходный запрос клиента: {user_text}

Текущая смета:
{original_answer}

Правки:
{changes_text}

Верни обновлённую смету."""

    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
    ]

    new_answer = call_llm(messages)

    # Сохраняем в БД
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.bot_corrections SET llm_answer = %s WHERE id = %s",
        (new_answer, correction_id)
    )
    conn.commit()
    cur.close()
    conn.close()

    return resp(200, {'ok': True, 'new_answer': new_answer})
