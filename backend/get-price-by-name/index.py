"""Возвращает цену для произвольной позиции: сначала ищет в прайсе БД, затем спрашивает LLM."""

import os
import json
import re
import psycopg2
import requests

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def norm(s: str) -> str:
    return s.lower().replace('ё', 'е').strip()


def find_in_db(name: str) -> dict | None:
    """Ищет позицию в ai_prices по вхождению в name или synonyms."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        n = norm(name)
        cur.execute(f"""
            SELECT name, price, unit FROM {SCHEMA}.ai_prices
            WHERE active = true
              AND (lower(name) LIKE %s OR lower(synonyms) LIKE %s)
            ORDER BY sort_order, id LIMIT 1
        """, (f'%{n}%', f'%{n}%'))
        row = cur.fetchone()
        if not row:
            # Ищем по словам (длиннее 2 символов)
            words = [w for w in n.split() if len(w) > 2]
            if words:
                conditions = " OR ".join(["lower(name) LIKE %s OR lower(synonyms) LIKE %s"] * len(words))
                params = []
                for w in words:
                    params += [f'%{w}%', f'%{w}%']
                cur.execute(f"""
                    SELECT name, price, unit FROM {SCHEMA}.ai_prices
                    WHERE active = true AND ({conditions})
                    ORDER BY sort_order, id LIMIT 1
                """, params)
                row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return {'name': row[0], 'price': row[1], 'unit': row[2] or ''}
    except Exception as e:
        print(f"[db] error: {e}")
    return None


def ask_llm(name: str, prices_context: str) -> int | None:
    """Спрашивает LLM примерную цену для позиции натяжного потолка."""
    openrouter_key = os.environ.get('OPENROUTER_API_KEY_2', '') or os.environ.get('OPENROUTER_API_KEY', '')
    if not openrouter_key:
        return None
    system = (
        "Ты эксперт по ценам на натяжные потолки в Москве. "
        "Отвечай ТОЛЬКО числом — примерная рыночная цена в рублях за единицу (шт, м², пог.м). "
        "Никаких пояснений, только цифра. Если не знаешь — ответь 0.\n\n"
        f"Актуальный прайс для ориентира:\n{prices_context}"
    )
    messages = [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': f'Сколько стоит: {name}'},
    ]
    try:
        resp = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={'Authorization': f'Bearer {openrouter_key}', 'Content-Type': 'application/json'},
            json={'model': 'openai/gpt-4o-mini', 'messages': messages, 'max_tokens': 20, 'temperature': 0},
            timeout=15,
        )
        if resp.status_code == 200:
            content = resp.json()['choices'][0]['message']['content'].strip()
            m = re.search(r'\d+', content)
            if m:
                return int(m.group())
    except Exception as e:
        print(f"[llm] error: {e}")
    return None


def get_prices_context() -> str:
    """Короткий список цен из БД для передачи в LLM как контекст."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT name, price, unit FROM {SCHEMA}.ai_prices WHERE active = true ORDER BY sort_order, id")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return '\n'.join(f"{r[0]} — {r[1]} ₽/{r[2]}" for r in rows)
    except Exception as e:
        print(f"[ctx] error: {e}")
        return ''


def handler(event: dict, context) -> dict:
    """Принимает {name: str}, возвращает {price: int, unit: str, source: 'db'|'llm'|'none'}."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    name = str(body.get('name', '')).strip()
    if not name:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'name required'})}

    # 1. Ищем в БД
    db_result = find_in_db(name)
    if db_result and db_result['price'] > 0:
        print(f"[db] found '{db_result['name']}' price={db_result['price']} for query='{name}'")
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'price': db_result['price'], 'unit': db_result['unit'], 'source': 'db'}),
        }

    # 2. Спрашиваем LLM
    prices_context = get_prices_context()
    llm_price = ask_llm(name, prices_context)
    if llm_price and llm_price > 0:
        print(f"[llm] price={llm_price} for query='{name}'")
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'price': llm_price, 'unit': 'шт', 'source': 'llm'}),
        }

    # 3. Не удалось определить
    print(f"[none] could not determine price for '{name}'")
    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'price': 0, 'unit': '', 'source': 'none'}),
    }
