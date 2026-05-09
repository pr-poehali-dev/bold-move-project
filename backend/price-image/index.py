"""Загрузка картинок для товаров и категорий прайса. PUT /upload?type=item&id=42 или type=category&category=Полотна"""

import os
import json
import base64
import uuid
import boto3
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

def handler(event: dict, context) -> dict:
    """Загружает картинку товара (type=item&id=42) или категории (type=category&category=Полотна) в S3 и сохраняет URL в БД."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    upload_type = params.get('type', 'item')  # 'item' или 'category'

    # GET — получить текущую картинку
    if method == 'GET':
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        if upload_type == 'item':
            item_id = int(params.get('id', 0))
            cur.execute(f"SELECT image_url FROM {SCHEMA}.ai_prices WHERE id = {item_id}")
            row = cur.fetchone()
            url = row[0] if row else None
        else:
            category = params.get('category', '')
            category_escaped = category.replace("'", "''")
            cur.execute(f"SELECT category_image_url FROM {SCHEMA}.ai_prices WHERE category = '{category_escaped}' LIMIT 1")
            row = cur.fetchone()
            url = row[0] if row else None
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'url': url})}

    # PUT — загрузить картинку
    if method == 'PUT':
        body = json.loads(event.get('body') or '{}')
        image_b64 = body.get('image')  # base64 строка
        content_type = body.get('content_type', 'image/jpeg')
        if not image_b64:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'image required'})}

        # Декодируем base64
        if ',' in image_b64:
            image_b64 = image_b64.split(',', 1)[1]
        image_data = base64.b64decode(image_b64)

        ext = 'jpg' if 'jpeg' in content_type else content_type.split('/')[-1]
        key = f"price-images/{uuid.uuid4().hex}.{ext}"

        s3 = get_s3()
        s3.put_object(Bucket='files', Key=key, Body=image_data, ContentType=content_type)
        url = cdn_url(key)

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()

        if upload_type == 'item':
            item_id = int(params.get('id', 0))
            cur.execute(f"UPDATE {SCHEMA}.ai_prices SET image_url = '{url}' WHERE id = {item_id}")
        else:
            category = params.get('category', '')
            category_escaped = category.replace("'", "''")
            cur.execute(f"UPDATE {SCHEMA}.ai_prices SET category_image_url = '{url}' WHERE category = '{category_escaped}'")

        conn.commit()
        cur.close()
        conn.close()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'url': url})}

    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'method not allowed'})}
