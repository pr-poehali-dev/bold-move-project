"""Возвращает актуальный прайс-лист из БД для использования на фронтенде."""

import os
import json
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def handler(event: dict, context) -> dict:
    """Отдаёт весь активный прайс: id, name, price, unit, category, synonyms."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(f"""
        SELECT id, name, price, unit, category, synonyms
        FROM {SCHEMA}.ai_prices
        WHERE active = true
        ORDER BY sort_order, id
    """)
    rows = cur.fetchall()

    pricing = {'econom_mult': 0.85, 'premium_mult': 1.27, 'econom_label': 'Econom', 'standard_label': 'Standard', 'premium_label': 'Premium'}
    try:
        cur.execute(f"SELECT econom_mult, premium_mult, econom_label, standard_label, premium_label FROM {SCHEMA}.pricing_settings LIMIT 1")
        pr = cur.fetchone()
        if pr:
            pricing = {'econom_mult': float(pr[0]), 'premium_mult': float(pr[1]), 'econom_label': pr[2], 'standard_label': pr[3], 'premium_label': pr[4]}
    except Exception:
        pass

    cur.close()
    conn.close()

    prices = []
    for row in rows:
        prices.append({
            'id': row[0],
            'name': row[1],
            'price': row[2],
            'unit': row[3] or '',
            'category': row[4] or '',
            'synonyms': row[5] or '',
        })

    return {
        'statusCode': 200,
        'headers': {**cors, 'Cache-Control': 'max-age=300'},
        'body': json.dumps({'prices': prices, 'pricing': pricing}),
    }