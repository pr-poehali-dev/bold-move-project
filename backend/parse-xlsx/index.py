"""Управление AI: системный промпт, база знаний, быстрые вопросы + импорт XLSX. v4"""

import json
import os
import hashlib
import requests
import openpyxl
import psycopg2
from io import BytesIO

XLSX_URL = 'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/c04d82f2-0303-48f7-b069-9c96c191ffb8.xlsx'
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '').strip() or 'Sdauxbasstre228'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token, X-User-Id, X-Auth-Token, X-Session-Id',
    'Access-Control-Max-Age': '86400',
}

def resp(status, body):
    return {'statusCode': status, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps(body, ensure_ascii=False)}

def check_auth(headers: dict, qs: dict = None) -> bool:
    token = (headers.get('x-admin-token', '') or headers.get('X-Admin-Token', '')).strip()
    if not token and qs:
        token = (qs.get('_token') or '').strip()
    if not token or not ADMIN_PASSWORD:
        return False
    return token == ADMIN_PASSWORD

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def load_xlsx():
    r = requests.get(XLSX_URL, timeout=15)
    wb = openpyxl.load_workbook(BytesIO(r.content), data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], []
    hdrs = [str(h).strip().lower() if h else '' for h in rows[0]]
    items = []
    for row in rows[1:]:
        if not any(row):
            continue
        item = {}
        for i, h in enumerate(hdrs):
            val = row[i] if i < len(row) else None
            item[h] = str(val).strip() if val is not None else ''
        items.append(item)
    return items, hdrs


def handler(event: dict, context) -> dict:
    """Управление AI-конфигурацией: промпт, база знаний, быстрые вопросы, импорт XLSX.
    Маршрутизация через query-параметр: ?r=prompt|faq|questions|login
    """
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    hdrs = event.get('headers') or {}
    qs = event.get('queryStringParameters') or {}
    r = qs.get('r', '')
    # Метод может прийти через _method в URL (все запросы идут как GET для обхода CORS)
    method = qs.get('_method', event.get('httpMethod', 'GET'))
    # Body может прийти как обычный body или как _body в URL
    body_str = event.get('body') or qs.get('_body', '') or '{}'

    # --- LOGIN (GET или POST)
    if r == 'login':
        if method == 'GET':
            password = qs.get('pwd', '')
        else:
            body = json.loads(body_str)
            password = body.get('password', '')
        stored = ADMIN_PASSWORD.strip()
        print(f"[login] method={method} pwd_len={len(password)} stored_len={len(stored)}")
        if stored and password.strip() == stored:
            return resp(200, {'token': password.strip()})
        return resp(401, {'error': 'Неверный пароль'})

    # --- GET ?r=prompt
    if r == 'prompt' and method == 'GET':
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"SELECT id, content, updated_at FROM {SCHEMA}.ai_system_prompt ORDER BY id LIMIT 1")
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return resp(404, {'error': 'Not found'})
        return resp(200, {'id': row[0], 'content': row[1], 'updated_at': str(row[2])})

    # --- PUT ?r=prompt
    if r == 'prompt' and method == 'PUT':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        body = json.loads(body_str)
        content = body.get('content', '').strip()
        if not content:
            return resp(400, {'error': 'content required'})
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.ai_system_prompt SET content = %s, updated_at = now() WHERE id = (SELECT id FROM {SCHEMA}.ai_system_prompt ORDER BY id LIMIT 1)", (content,))
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # --- GET ?r=faq
    if r == 'faq' and method == 'GET':
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"SELECT id, title, content, used, created_at FROM {SCHEMA}.faq_items ORDER BY id")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return resp(200, {'items': [{'id': row[0], 'title': row[1], 'content': row[2], 'used': row[3], 'created_at': str(row[4])} for row in rows]})

    # --- POST ?r=faq
    if r == 'faq' and method == 'POST':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        body = json.loads(body_str)
        title = body.get('title', '').strip()
        content = body.get('content', '').strip()
        if not title or not content:
            return resp(400, {'error': 'title and content required'})
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"INSERT INTO {SCHEMA}.faq_items (title, content, used) VALUES (%s, %s, true) RETURNING id", (title, content))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'id': new_id, 'ok': True})

    # --- PUT ?r=faq&id=X
    if r == 'faq' and method == 'PUT':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        faq_id = int(qs.get('id', '0'))
        body = json.loads(body_str)
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.faq_items SET title=%s, content=%s, used=%s WHERE id=%s",
                    (body.get('title',''), body.get('content',''), body.get('used', True), faq_id))
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # --- DELETE ?r=faq&id=X
    if r == 'faq' and method == 'DELETE':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        faq_id = int(qs.get('id', '0'))
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"DELETE FROM {SCHEMA}.faq_items WHERE id = %s", (faq_id,))
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # --- GET ?r=questions
    if r == 'questions' and method == 'GET':
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"SELECT id, pattern, answer, active FROM {SCHEMA}.ai_quick_questions ORDER BY id")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return resp(200, {'items': [{'id': row[0], 'pattern': row[1], 'answer': row[2], 'active': row[3]} for row in rows]})

    # --- POST ?r=questions
    if r == 'questions' and method == 'POST':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        body = json.loads(body_str)
        pattern = body.get('pattern', '').strip()
        answer = body.get('answer', '').strip()
        if not pattern or not answer:
            return resp(400, {'error': 'pattern and answer required'})
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"INSERT INTO {SCHEMA}.ai_quick_questions (pattern, answer, active) VALUES (%s, %s, true) RETURNING id", (pattern, answer))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'id': new_id, 'ok': True})

    # --- PUT ?r=questions&id=X
    if r == 'questions' and method == 'PUT':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        q_id = int(qs.get('id', '0'))
        body = json.loads(body_str)
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.ai_quick_questions SET pattern=%s, answer=%s, active=%s WHERE id=%s",
                    (body.get('pattern',''), body.get('answer',''), body.get('active', True), q_id))
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # --- DELETE ?r=questions&id=X
    if r == 'questions' and method == 'DELETE':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        q_id = int(qs.get('id', '0'))
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"DELETE FROM {SCHEMA}.ai_quick_questions WHERE id = %s", (q_id,))
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # --- GET ?r=prices
    print(f"[request] r={r} method={method} qs_keys={list(qs.keys())}")
    if r == 'prices' and method == 'GET':
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"SELECT id, category, name, price, unit, description, sort_order, active, calc_rule, bundle, synonyms FROM {SCHEMA}.ai_prices ORDER BY sort_order, id")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return resp(200, {'items': [{'id': row[0], 'category': row[1], 'name': row[2], 'price': row[3], 'unit': row[4], 'description': row[5], 'sort_order': row[6], 'active': row[7], 'calc_rule': row[8] or '', 'bundle': row[9] or '[]', 'synonyms': row[10] or ''} for row in rows]})

    # --- POST ?r=prices  (добавление позиции)
    if r == 'prices' and method == 'POST':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        body = json.loads(body_str)
        category = body.get('category', '').strip()
        name = body.get('name', '').strip()
        if not category or not name:
            return resp(400, {'error': 'category and name required'})
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            f"SELECT COALESCE(MAX(sort_order), 0) + 10 FROM {SCHEMA}.ai_prices WHERE category = %s", (category,)
        )
        sort_order = cur.fetchone()[0]
        cur.execute(
            f"INSERT INTO {SCHEMA}.ai_prices (category, name, price, unit, description, sort_order, active) VALUES (%s,%s,%s,%s,%s,%s,true) RETURNING id",
            (category, name, int(body.get('price', 0)), body.get('unit', 'шт'), body.get('description', ''), sort_order)
        )
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'id': new_id, 'ok': True})

    # --- PUT ?r=prices&id=X  (обновление цены)
    if r == 'prices' and method == 'PUT':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        price_id = int(qs.get('id', '0'))
        body = json.loads(body_str)
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.ai_prices SET name=%s, price=%s, unit=%s, description=%s, active=%s, calc_rule=%s, bundle=%s, synonyms=%s, updated_at=now() WHERE id=%s",
            (body.get('name',''), int(body.get('price', 0)), body.get('unit',''), body.get('description',''), body.get('active', True), body.get('calc_rule',''), body.get('bundle','[]'), body.get('synonyms',''), price_id)
        )
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # --- PUT ?r=prices&rename_category  (переименование категории)
    if r == 'prices' and method == 'PUT' and 'rename_category' in qs:
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        body = json.loads(body_str)
        old_name = body.get('old_name', '').strip()
        new_name = body.get('new_name', '').strip()
        if not old_name or not new_name:
            return resp(400, {'error': 'old_name and new_name required'})
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.ai_prices SET category=%s WHERE category=%s", (new_name, old_name))
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # --- DELETE ?r=prices&id=X
    if r == 'prices' and method == 'DELETE':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        price_id = int(qs.get('id', '0'))
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"DELETE FROM {SCHEMA}.ai_prices WHERE id = %s", (price_id,))
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # --- GET ?r=corrections
    if r == 'corrections' and method == 'GET':
        conn = get_conn(); cur = conn.cursor()
        cur.execute(f"SELECT id, session_id, user_text, recognized_json, corrected_json, status, created_at FROM {SCHEMA}.bot_corrections ORDER BY created_at DESC LIMIT 200")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return resp(200, {'items': [{'id': row[0], 'session_id': row[1] or '', 'user_text': row[2], 'recognized_json': row[3], 'corrected_json': row[4], 'status': row[5], 'created_at': str(row[6])} for row in rows]})

    # --- PUT ?r=corrections&id=X
    if r == 'corrections' and method == 'PUT':
        if not check_auth(hdrs, qs):
            return resp(401, {'error': 'Unauthorized'})
        body = json.loads(body_str)
        corr_id = int(qs.get('id', body.get('id', 0)))
        status = body.get('status', 'pending')
        corrected = body.get('corrected_json')
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.bot_corrections SET status=%s, corrected_json=%s, reviewed_at=now() WHERE id=%s",
            (status, json.dumps(corrected, ensure_ascii=False) if corrected else None, corr_id)
        )
        conn.commit(); cur.close(); conn.close()
        return resp(200, {'ok': True})

    # --- XLSX import (legacy, ?action=read|import)
    action = qs.get('action', '')
    if action in ('read', 'import'):
        items, headers_list = load_xlsx()
        if not items:
            return resp(200, {'total': 0, 'items': []})
        if action == 'read':
            page = int(qs.get('page', '0'))
            per_page = int(qs.get('per_page', '50'))
            start = page * per_page
            return resp(200, {'total': len(items), 'page': page, 'headers': headers_list, 'items': items[start:start+per_page]})
        if action == 'import':
            if not check_auth(hdrs):
                return resp(401, {'error': 'Unauthorized'})
            conn = get_conn(); cur = conn.cursor()
            cur.execute(f"TRUNCATE TABLE {SCHEMA}.faq_items RESTART IDENTITY")
            imported = 0
            for item in items:
                title   = item.get('title', item.get('заголовок', item.get('название', '')))
                s_title = item.get('search title', item.get('search_title', item.get('поиск', title)))
                content = item.get('content', item.get('содержимое', item.get('описание', '')))
                used    = str(item.get('used', item.get('активен', 'True'))).strip().lower() not in ('false', '0', 'нет', 'no', '')
                if not title and not content:
                    continue
                cur.execute(f"INSERT INTO {SCHEMA}.faq_items (title, search_title, content, used) VALUES (%s, %s, %s, %s)",
                            (title, s_title or title, content, used))
                imported += 1
            conn.commit(); cur.close(); conn.close()
            return resp(200, {'ok': True, 'imported': imported})

    return resp(400, {'error': 'unknown resource. Use ?r=prompt|faq|questions|login'})