"""Обучение AI: сохраняет исправления менеджера в ai_prices.client_changes. v4"""

import json
import os
import datetime
import psycopg2

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
    password = os.environ.get('ADMIN_PASSWORD', '')
    if not token or not password:
        return False
    return hashlib.sha256(token.encode()).hexdigest() == hashlib.sha256(password.encode()).hexdigest()


def find_price_id(cur, name: str) -> int | None:
    """Ищет позицию в ai_prices по точному имени или вхождению."""
    nl = name.lower().strip()
    cur.execute(
        f"SELECT id, name FROM {SCHEMA}.ai_prices WHERE active = true ORDER BY sort_order, id"
    )
    rows = cur.fetchall()
    # 1. Точное совпадение
    for pid, pname in rows:
        if pname.lower().strip() == nl:
            return pid
    # 2. Вхождение в обе стороны
    for pid, pname in rows:
        pnl = pname.lower().strip()
        if nl in pnl or pnl in nl:
            return pid
    return None


def append_client_change(cur, price_id: int, new_change: str):
    """Добавляет правку к существующему client_changes (не перезаписывает)."""
    cur.execute(
        f"SELECT client_changes FROM {SCHEMA}.ai_prices WHERE id = %s", (price_id,)
    )
    row = cur.fetchone()
    existing = (row[0] or '').strip() if row else ''
    today = datetime.date.today().strftime('%d.%m.%Y')
    entry = f"[{today}] {new_change.strip()}"
    updated = (existing + '\n' + entry).strip() if existing else entry
    cur.execute(
        f"UPDATE {SCHEMA}.ai_prices SET client_changes = %s, updated_at = now() WHERE id = %s",
        (updated, price_id)
    )


def handler(event: dict, context) -> dict:
    """Сохраняет исправления менеджера в колонку client_changes таблицы ai_prices.
    Общий комментарий сохраняется в отдельную запись bot_corrections.corrected_json."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    hdrs = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    if not check_auth(hdrs):
        return resp(401, {'error': 'Unauthorized'})

    body = json.loads(event.get('body') or '{}')
    correction_id = body.get('correction_id')
    user_text = body.get('user_text', '')
    comments = dict(body.get('comments', {}))

    print(f"[ai-edit] correction_id={correction_id} comments_keys={list(comments.keys())}")

    if not correction_id:
        return resp(400, {'error': 'correction_id обязателен'})

    general_change = (comments.pop('__general__', '') or '').strip()

    # Правки по позициям — должна быть хотя бы одна
    position_comments = {k: v.strip() for k, v in comments.items() if v and v.strip()}
    print(f"[ai-edit] general='{general_change}' position_comments={position_comments}")
    if not position_comments and not general_change:
        return resp(400, {'error': 'Нет правок для сохранения'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    saved = []
    not_found = []

    # Сохраняем правки по позициям → в ai_prices.client_changes
    for pos_name, change_text in position_comments.items():
        price_id = find_price_id(cur, pos_name)
        print(f"[ai-edit] pos='{pos_name}' → price_id={price_id} change='{change_text}'")
        if price_id:
            append_client_change(cur, price_id, change_text)
            saved.append(pos_name)
        else:
            not_found.append(pos_name)

    # Общий комментарий + контекст → в bot_corrections.corrected_json
    corrected = {
        'saved_positions': saved,
        'not_found_positions': not_found,
        'general_comment': general_change,
        'user_text': user_text,
        'saved_at': datetime.datetime.now().isoformat(),
    }
    cur.execute(
        f"UPDATE {SCHEMA}.bot_corrections SET corrected_json = %s, status = 'approved' WHERE id = %s",
        (json.dumps(corrected, ensure_ascii=False), correction_id)
    )

    conn.commit()
    cur.close()
    conn.close()

    return resp(200, {
        'ok': True,
        'saved': saved,
        'not_found': not_found,
        'general_saved': bool(general_change),
    })