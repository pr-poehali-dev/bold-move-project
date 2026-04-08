"""Возвращает Roboto Regular + Black TTF в base64 для PDF-генератора."""

import json
import base64
import os
import requests
import boto3


BUCKET = 'files'
FONT_FILES = {
    'regular': {
        'key': 'fonts/Roboto-Regular.ttf',
        'sources': [
            'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf',
        ],
    },
    'bold': {
        'key': 'fonts/Roboto-Bold.ttf',
        'sources': [
            'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf',
            'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYJb2mT.ttf',
            'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf',
        ],
    },
}


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def get_font_data(s3, cfg):
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=cfg['key'])
        return obj['Body'].read()
    except Exception:
        pass

    for url in cfg['sources']:
        try:
            resp = requests.get(url, timeout=10, allow_redirects=True)
            if resp.status_code == 200 and len(resp.content) > 30000:
                s3.put_object(Bucket=BUCKET, Key=cfg['key'], Body=resp.content, ContentType='font/ttf')
                return resp.content
        except Exception:
            continue
    return None


def handler(event, context):
    """Возвращает шрифты Roboto в base64."""
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

    s3 = get_s3()
    regular = get_font_data(s3, FONT_FILES['regular'])
    bold = get_font_data(s3, FONT_FILES['bold'])

    if not regular:
        return {'statusCode': 500, 'headers': cors, 'body': json.dumps({'error': 'Font download failed'})}

    result = {
        'font': base64.b64encode(regular).decode('ascii'),
    }
    if bold:
        result['bold'] = base64.b64encode(bold).decode('ascii')

    return {
        'statusCode': 200,
        'headers': {**cors, 'Cache-Control': 'public, max-age=86400'},
        'body': json.dumps(result),
    }