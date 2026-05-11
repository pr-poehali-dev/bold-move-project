"""Загрузка картинок для товаров и категорий прайса.
GET /upload?type=item&id=42 или type=category&category=Полотна
PUT /upload?type=item&id=42 — загрузить картинку (base64 в теле)
WL-клиенты получают/сохраняют свои картинки через wl_price_overrides, мастер — в ai_prices.
"""

import os
import json
import base64
import uuid
import hashlib
import boto3
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '').strip() or 'Sdauxbasstre228'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
}

def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )

def cdn_url(key: str) -> str:
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def _extract_token(headers: dict) -> str:
    raw = (headers.get('x-authorization') or headers.get('X-Authorization')
           or headers.get('x-admin-token') or headers.get('X-Admin-Token') or '')
    return raw.removeprefix('Bearer ').strip()

def get_wl_id(headers: dict):
    """Возвращает wl_manager_id если запрос от WL-клиента, иначе None."""
    token = _extract_token(headers)
    if not token:
        return None
    if ADMIN_PASSWORD and hashlib.sha256(token.encode()).hexdigest() == hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest():
        return None
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            f"SELECT user_id FROM {SCHEMA}.user_sessions WHERE token=%s AND expires_at>NOW() AND session_type='wl_manager'",
            (token,)
        )
        row = cur.fetchone(); cur.close(); conn.close()
        return row[0] if row else None
    except Exception:
        return None

def check_auth(headers: dict) -> bool:
    token = _extract_token(headers)
    if not token:
        return False
    if ADMIN_PASSWORD and hashlib.sha256(token.encode()).hexdigest() == hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest():
        return True
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            f"SELECT id FROM {SCHEMA}.user_sessions WHERE token=%s AND expires_at>NOW()",
            (token,)
        )
        row = cur.fetchone(); cur.close(); conn.close()
        return row is not None
    except Exception:
        return False


def handler(event: dict, context) -> dict:
    """Загружает картинку товара (type=item&id=42) или категории (type=category&category=Полотна).
    WL-клиент: картинки сохраняются в wl_price_overrides (не трогая глобальный прайс).
    Мастер: картинки сохраняются в ai_prices напрямую.
    """
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    hdrs = event.get('headers') or {}
    params = event.get('queryStringParameters') or {}
    upload_type = params.get('type', 'item')

    wl_id = get_wl_id(hdrs)

    # ── GET — получить текущую картинку ──────────────────────────────────────
    if method == 'GET':
        conn = get_conn(); cur = conn.cursor()

        if upload_type == 'item':
            item_id = int(params.get('id', 0))
            url = None
            if wl_id:
                # Сначала смотрим WL-override
                cur.execute(
                    f"SELECT image_url FROM {SCHEMA}.wl_price_overrides WHERE wl_manager_id=%s AND price_id=%s",
                    (wl_id, item_id)
                )
                row = cur.fetchone()
                if row:
                    url = row[0]
            if url is None:
                # Глобальная картинка
                cur.execute(f"SELECT image_url FROM {SCHEMA}.ai_prices WHERE id=%s", (item_id,))
                row = cur.fetchone()
                url = row[0] if row else None

        else:  # category
            category = params.get('category', '')
            category_escaped = category.replace("'", "''")
            url = None
            if wl_id:
                # WL: ищем переопределение по любой позиции категории
                cur.execute(
                    f"""SELECT o.category_image_url
                        FROM {SCHEMA}.wl_price_overrides o
                        JOIN {SCHEMA}.ai_prices p ON p.id = o.price_id
                        WHERE o.wl_manager_id=%s AND p.category='{category_escaped}'
                        AND o.category_image_url IS NOT NULL
                        LIMIT 1""",
                    (wl_id,)
                )
                row = cur.fetchone()
                if row:
                    url = row[0]
            if url is None:
                # Глобальная картинка категории
                cur.execute(
                    f"SELECT category_image_url FROM {SCHEMA}.ai_prices WHERE category='{category_escaped}' AND category_image_url IS NOT NULL LIMIT 1"
                )
                row = cur.fetchone()
                url = row[0] if row else None

        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'url': url})}

    # ── PUT — загрузить картинку ──────────────────────────────────────────────
    if method == 'PUT':
        if not check_auth(hdrs):
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

        body = json.loads(event.get('body') or '{}')
        image_b64 = body.get('image')
        content_type = body.get('content_type', 'image/jpeg')
        if not image_b64:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'image required'})}

        if ',' in image_b64:
            image_b64 = image_b64.split(',', 1)[1]
        image_data = base64.b64decode(image_b64)

        ext = 'jpg' if 'jpeg' in content_type else content_type.split('/')[-1]
        key = f"price-images/{uuid.uuid4().hex}.{ext}"

        s3 = get_s3()
        s3.put_object(Bucket='files', Key=key, Body=image_data, ContentType=content_type)
        url = cdn_url(key)

        conn = get_conn(); cur = conn.cursor()

        if upload_type == 'item':
            item_id = int(params.get('id', 0))
            if wl_id:
                # WL: пишем в override-таблицу
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.wl_price_overrides (wl_manager_id, price_id, image_url, updated_at)
                        VALUES (%s, %s, %s, now())
                        ON CONFLICT (wl_manager_id, price_id) DO UPDATE SET image_url=%s, updated_at=now()""",
                    (wl_id, item_id, url, url)
                )
            else:
                # Мастер: пишем в глобальный прайс
                cur.execute(f"UPDATE {SCHEMA}.ai_prices SET image_url=%s WHERE id=%s", (url, item_id))

        else:  # category
            category = params.get('category', '')
            category_escaped = category.replace("'", "''")
            if wl_id:
                # WL: обновляем category_image_url для всех позиций этой категории в override
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.ai_prices WHERE category='{category_escaped}'"
                )
                price_ids = [row[0] for row in cur.fetchall()]
                for pid in price_ids:
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.wl_price_overrides (wl_manager_id, price_id, category_image_url, updated_at)
                            VALUES (%s, %s, %s, now())
                            ON CONFLICT (wl_manager_id, price_id) DO UPDATE SET category_image_url=%s, updated_at=now()""",
                        (wl_id, pid, url, url)
                    )
            else:
                # Мастер: обновляем глобально
                cur.execute(
                    f"UPDATE {SCHEMA}.ai_prices SET category_image_url=%s WHERE category='{category_escaped}'",
                    (url,)
                )

        conn.commit(); cur.close(); conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'url': url})}

    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'method not allowed'})}
