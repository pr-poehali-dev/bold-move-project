"""Парсит XLSX файл с базой знаний и импортирует в таблицу faq_items."""

import json
import os
import requests
import openpyxl
import psycopg2
from io import BytesIO

XLSX_URL = 'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/c04d82f2-0303-48f7-b069-9c96c191ffb8.xlsx'
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def load_xlsx():
    """Скачивает и парсит XLSX, возвращает список словарей."""
    resp = requests.get(XLSX_URL, timeout=15)
    wb = openpyxl.load_workbook(BytesIO(resp.content), data_only=True)
    ws = wb[wb.sheetnames[0]]

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    # Первая строка — заголовки
    headers = [str(h).strip().lower() if h else '' for h in rows[0]]
    items = []
    for row in rows[1:]:
        if not any(row):
            continue
        item = {}
        for i, h in enumerate(headers):
            val = row[i] if i < len(row) else None
            item[h] = str(val).strip() if val is not None else ''
        items.append(item)
    return items, headers


def handler(event, context):
    """Парсит XLSX и по запросу импортирует в БД."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', 'read')

    result = load_xlsx()
    if not result:
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'total': 0, 'items': []})}

    items, headers = result

    # Просто прочитать
    if action == 'read':
        page = int(qs.get('page', '0'))
        per_page = int(qs.get('per_page', '50'))
        start = page * per_page
        chunk = items[start:start + per_page]
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'total': len(items), 'page': page, 'headers': headers, 'items': chunk}, ensure_ascii=False),
        }

    # Импорт в БД
    if action == 'import':
        conn = db()
        cur = conn.cursor()

        # Очищаем старые данные
        cur.execute(f"TRUNCATE TABLE {SCHEMA}.faq_items RESTART IDENTITY")

        imported = 0
        for item in items:
            # Определяем колонки по возможным названиям заголовков
            title        = item.get('title', item.get('заголовок', item.get('название', '')))
            search_title = item.get('search title', item.get('search_title', item.get('поиск', title)))
            content      = item.get('content', item.get('содержимое', item.get('описание', '')))
            used_raw     = item.get('used', item.get('активен', 'True'))
            used         = str(used_raw).strip().lower() not in ('false', '0', 'нет', 'no', '')

            if not title and not content:
                continue

            cur.execute(
                f"""INSERT INTO {SCHEMA}.faq_items (title, search_title, content, used)
                    VALUES (%s, %s, %s, %s)""",
                (title, search_title or title, content, used)
            )
            imported += 1

        conn.commit()
        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'ok': True, 'imported': imported}, ensure_ascii=False),
        }

    return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'unknown action'})}
