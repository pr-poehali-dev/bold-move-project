"""Генерация изображения по промпту через OpenAI DALL-E 3, сохранение в S3."""

import json
import os
import base64
import requests
import boto3
import uuid

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
}


def handler(event: dict, context) -> dict:
    """Генерирует изображение по текстовому промпту, сохраняет в S3, возвращает URL."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    prompt = (body.get('prompt') or '').strip()
    size   = body.get('size', '1024x1024')   # 1024x1024 | 1792x1024 | 1024x1792
    quality = body.get('quality', 'standard') # standard | hd

    if not prompt:
        return {'statusCode': 400, 'headers': CORS,
                'body': json.dumps({'error': 'prompt обязателен'})}

    api_key = os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        return {'statusCode': 500, 'headers': CORS,
                'body': json.dumps({'error': 'OPENAI_API_KEY не настроен'})}

    # ── Генерируем через DALL-E 3 ────────────────────────────────────────────
    dalle_res = requests.post(
        'https://api.openai.com/v1/images/generations',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': 'dall-e-3',
            'prompt': prompt,
            'n': 1,
            'size': size,
            'quality': quality,
            'response_format': 'b64_json',
        },
        timeout=60,
    )

    print(f"[generate-image] dalle status={dalle_res.status_code}")

    if not dalle_res.ok:
        err = dalle_res.json().get('error', {}).get('message', dalle_res.text[:200])
        return {'statusCode': 500, 'headers': CORS,
                'body': json.dumps({'error': f'DALL-E: {err}'})}

    data = dalle_res.json()
    b64  = data['data'][0]['b64_json']
    revised_prompt = data['data'][0].get('revised_prompt', prompt)
    img_bytes = base64.b64decode(b64)

    # ── Сохраняем в S3 ───────────────────────────────────────────────────────
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )

    file_key = f'ai-images/{uuid.uuid4().hex}.png'
    s3.put_object(
        Bucket='files',
        Key=file_key,
        Body=img_bytes,
        ContentType='image/png',
    )

    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{file_key}"

    print(f"[generate-image] saved to {cdn_url}")

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({
            'url': cdn_url,
            'revised_prompt': revised_prompt,
        }, ensure_ascii=False),
    }
