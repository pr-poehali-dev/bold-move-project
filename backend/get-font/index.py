"""Возвращает Roboto Regular TTF в base64 для PDF-генератора."""

import json
import base64
import requests


def handler(event, context):
    """Скачивает шрифт Roboto и возвращает base64."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    urls = [
        'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf',
        'https://cdn.jsdelivr.net/gh/AryaBhatt/Fonts@master/Roboto/Roboto-Regular.ttf',
        'https://github.com/googlefonts/roboto-classic/raw/main/src/hinted/Roboto-Regular.ttf',
    ]

    resp = None
    for url in urls:
        try:
            resp = requests.get(url, timeout=10, allow_redirects=True)
            if resp.status_code == 200 and len(resp.content) > 50000:
                break
            resp = None
        except Exception:
            resp = None

    if not resp:
        return {'statusCode': 500, 'headers': cors, 'body': json.dumps({'error': 'Font download failed'})}

    b64 = base64.b64encode(resp.content).decode('ascii')

    return {
        'statusCode': 200,
        'headers': {**cors, 'Cache-Control': 'public, max-age=86400'},
        'body': json.dumps({'font': b64, 'size': len(resp.content)}),
    }