import json
import os
import decimal
import datetime
import psycopg2

'''
Вебхук полной выгрузки данных CRM и админ-панели.

Отдаёт содержимое базы данных проекта в формате JSON, по одной таблице за
запрос (с пагинацией, т.к. некоторые таблицы содержат тысячи строк). Доступ
защищён секретным ключом DATA_EXPORT_KEY — без него функция возвращает 401.

Режимы (параметр entity):
  - entity=all         — список всех таблиц: имя, количество строк, колонки
                         (без учёта закрытых полей), пример ссылки на выгрузку.
  - entity=<имя_таблицы>&limit=500&offset=0 — сами данные таблицы, порциями.

Из соображений безопасности НИКОГДА не отдаются: пароли (password_hash,
temp_password_plain), токены ботов и сессий (tg_bot_token, max_bot_token,
token), любые поля, похожие по названию на password/token/secret/hash —
проверка идёт по названию колонки автоматически, а не по ручному списку
исключений (чтобы новое секретное поле не утекло по забывчивости).
'''

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p45929761_bold_move_project")

# Подстроки в названии колонки, при наличии которых поле считается секретным
# и никогда не отдаётся наружу, независимо от таблицы.
SENSITIVE_SUBSTRINGS = ("password", "token", "secret", "hash", "client_secret", "_key")
# Колонки, которые по названию похожи на секретные, но таковыми не являются —
# явное исключение из общего фильтра (чтобы не срезать нужные данные).
SENSITIVE_ALLOWLIST = {"row_key", "group_key"}

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def json_default(o):
    if isinstance(o, (datetime.datetime, datetime.date)):
        return o.isoformat()
    if isinstance(o, decimal.Decimal):
        return float(o)
    if isinstance(o, (bytes, bytearray)):
        return o.decode("utf-8", errors="replace")
    return str(o)


def is_sensitive(col: str) -> bool:
    if col in SENSITIVE_ALLOWLIST:
        return False
    low = col.lower()
    return any(s in low for s in SENSITIVE_SUBSTRINGS)


def resp(status: int, body: dict):
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(body, ensure_ascii=False, default=json_default),
        'isBase64Encoded': False,
    }


def handler(event: dict, context):
    """Выгрузка всех данных CRM/админки одним защищённым ключом вебхуком.
    entity=all — список таблиц с количеством строк и колонками.
    entity=<таблица>&limit=&offset= — сами данные с пагинацией."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    key = params.get('key', '')
    expected = os.environ.get('DATA_EXPORT_KEY', '')
    if not expected or key != expected:
        return resp(401, {'error': 'Неверный или отсутствующий ключ доступа (?key=...)'})

    entity = (params.get('entity') or 'all').strip()

    conn = get_conn()
    try:
        cur = conn.cursor()

        # Список таблиц схемы
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = %s AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """, (SCHEMA,))
        all_tables = [r[0] for r in cur.fetchall()]

        if entity == 'all':
            tables_info = []
            for t in all_tables:
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = %s AND table_name = %s
                    ORDER BY ordinal_position
                """, (SCHEMA, t))
                cols = [r[0] for r in cur.fetchall()]
                visible_cols = [c for c in cols if not is_sensitive(c)]
                hidden_cols = [c for c in cols if is_sensitive(c)]
                try:
                    cur.execute(f'SELECT COUNT(*) FROM "{SCHEMA}"."{t}"')
                    row_count = cur.fetchone()[0]
                except Exception:
                    conn.rollback()
                    row_count = None
                tables_info.append({
                    'table': t,
                    'row_count': row_count,
                    'columns': visible_cols,
                    'hidden_columns': hidden_cols or None,
                    'fetch_url_example': f'?key=...&entity={t}&limit=500&offset=0',
                })
            return resp(200, {
                'total_tables': len(tables_info),
                'usage': 'Добавьте entity=<имя_таблицы>&limit=500&offset=0 к этому же адресу, чтобы получить данные конкретной таблицы',
                'tables': tables_info,
            })

        if entity not in all_tables:
            return resp(404, {'error': f'Таблица "{entity}" не найдена', 'hint': 'Используйте entity=all, чтобы увидеть список таблиц'})

        try:
            limit = max(1, min(int(params.get('limit', 500)), 2000))
        except (TypeError, ValueError):
            limit = 500
        try:
            offset = max(0, int(params.get('offset', 0)))
        except (TypeError, ValueError):
            offset = 0

        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (SCHEMA, entity))
        all_cols = [r[0] for r in cur.fetchall()]
        visible_cols = [c for c in all_cols if not is_sensitive(c)]

        # Сортировка: по id, если есть, иначе по первому столбцу — чтобы
        # пагинация (limit/offset) давала стабильный, не скачущий порядок.
        order_col = 'id' if 'id' in all_cols else all_cols[0]

        col_list = ', '.join(f'"{c}"' for c in visible_cols)
        cur.execute(f'SELECT {col_list} FROM "{SCHEMA}"."{entity}" ORDER BY "{order_col}" LIMIT %s OFFSET %s',
                    (limit, offset))
        rows = cur.fetchall()
        items = [dict(zip(visible_cols, row)) for row in rows]

        cur.execute(f'SELECT COUNT(*) FROM "{SCHEMA}"."{entity}"')
        total = cur.fetchone()[0]

        return resp(200, {
            'table': entity,
            'total_rows': total,
            'limit': limit,
            'offset': offset,
            'has_more': offset + len(items) < total,
            'next_offset': (offset + limit) if offset + len(items) < total else None,
            'columns': visible_cols,
            'items': items,
        })
    finally:
        conn.close()
