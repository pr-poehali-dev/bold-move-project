"""Возвращает Roboto Regular + Bold TTF в base64 для PDF-генератора."""

import json
import base64
import requests

FONT_SOURCES = {
    'regular': [
        'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf',
        'https://cdn.jsdelivr.net/gh/AryaBhatt/Fonts@master/Roboto/Roboto-Regular.ttf',
    ],
    'bold': [
        'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuaObWmT.ttf',
        'https://cdn.jsdelivr.net/gh/AryaBhatt/Fonts@master/Roboto/Roboto-Bold.ttf',
    ],
}


def download_font(urls):
    for url in urls:
        try:
            resp = requests.get(url, timeout=10, allow_redirects=True)
            if resp.status_code == 200 and len(resp.content) > 50000:
                return base64.b64encode(resp.content).decode('ascii')
        except Exception:
            continue
    return None


def handler(event, context):
    """Скачивает шрифты Roboto Regular и Bold, возвращает base64."""
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

    regular = download_font(FONT_SOURCES['regular'])
    bold = download_font(FONT_SOURCES['bold'])

    if not regular:
        return {'statusCode': 500, 'headers': cors, 'body': json.dumps({'error': 'Font download failed'})}

    return {
        'statusCode': 200,
        'headers': {**cors, 'Cache-Control': 'public, max-age=86400'},
        'body': json.dumps({'font': regular, 'bold': bold or regular}),
    }
