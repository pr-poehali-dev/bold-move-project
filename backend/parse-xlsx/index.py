"""Парсит XLSX файл и возвращает содержимое построчно."""

import json
import requests
import openpyxl
from io import BytesIO


def handler(event, context):
    """Скачивает и парсит XLSX файл."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    qs = event.get('queryStringParameters') or {}
    page = int(qs.get('page', '0'))

    url = 'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/c04d82f2-0303-48f7-b069-9c96c191ffb8.xlsx'
    resp = requests.get(url, timeout=15)
    data = BytesIO(resp.content)
    wb = openpyxl.load_workbook(data, data_only=True)
    ws = wb[wb.sheetnames[0]]

    rows = []
    for row in ws.iter_rows(values_only=True):
        rows.append([str(cell) if cell is not None else '' for cell in row])

    per_page = 3
    start = 1 + page * per_page
    end = start + per_page
    chunk = rows[start:end]

    items = []
    for r in chunk:
        items.append({'title': r[0], 'content': r[2], 'used': r[3] if len(r) > 3 else ''})

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({
            'total': len(rows) - 1,
            'page': page,
            'items': items,
        }, ensure_ascii=False),
    }
