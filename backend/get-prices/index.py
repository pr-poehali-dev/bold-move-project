"""Возвращает актуальный прайс-лист из БД для использования на фронтенде.
Если передан ?wl_id=X — мерджит WL-переопределения поверх глобального прайса.
"""

import os
import json
import hashlib
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '').strip() or 'Sdauxbasstre228'

cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _extract_token(headers: dict) -> str:
    raw = (headers.get('x-authorization') or headers.get('X-Authorization') or '')
    return raw.removeprefix('Bearer ').strip()


def get_wl_id_from_token(headers: dict):
    """Возвращает wl_manager_id если токен принадлежит WL-менеджеру, иначе None."""
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


def handler(event: dict, context) -> dict:
    """Отдаёт весь активный прайс: id, name, price, unit, category, synonyms.
    Поддерживает WL-переопределения: через ?wl_id=X или Authorization Bearer токен WL-менеджера.
    """
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    params = event.get('queryStringParameters') or {}
    hdrs = event.get('headers') or {}

    # Определяем wl_id: сначала из токена, потом из query-параметра
    wl_id = get_wl_id_from_token(hdrs)
    if wl_id is None:
        raw_wl = params.get('wl_id')
        if raw_wl and raw_wl.isdigit():
            wl_id = int(raw_wl)

    conn = get_conn()
    cur = conn.cursor()

    # Глобальный прайс
    cur.execute(f"""
        SELECT id, name, price, unit, category, synonyms, image_url, category_image_url
        FROM {SCHEMA}.ai_prices
        WHERE active = true
        ORDER BY sort_order, id
    """)
    rows = cur.fetchall()

    # Настройки категорий (is_wall_item, show_in_drum)
    cat_settings = {}
    try:
        cur.execute(f"SELECT category, is_wall_item, show_in_drum FROM {SCHEMA}.price_category_settings")
        for r in cur.fetchall():
            cat_settings[r[0]] = {'is_wall_item': r[1] if r[1] is not None else True, 'show_in_drum': r[2] if r[2] is not None else True}
    except Exception:
        pass

    # Настройки pricing (мастер или WL-переопределение)
    pricing = {'econom_mult': 0.85, 'premium_mult': 1.27, 'econom_label': 'Econom', 'standard_label': 'Standard', 'premium_label': 'Premium'}
    try:
        cur.execute(f"SELECT econom_mult, premium_mult, econom_label, standard_label, premium_label FROM {SCHEMA}.pricing_settings LIMIT 1")
        pr = cur.fetchone()
        if pr:
            pricing = {'econom_mult': float(pr[0]), 'premium_mult': float(pr[1]), 'econom_label': pr[2], 'standard_label': pr[3], 'premium_label': pr[4]}
    except Exception:
        pass

    # WL-переопределения pricing и category_settings
    if wl_id:
        try:
            cur.execute(f"SELECT econom_mult, premium_mult, econom_label, standard_label, premium_label FROM {SCHEMA}.wl_pricing_settings WHERE wl_manager_id=%s", (wl_id,))
            wl_pr = cur.fetchone()
            if wl_pr:
                pricing = {'econom_mult': float(wl_pr[0]), 'premium_mult': float(wl_pr[1]), 'econom_label': wl_pr[2], 'standard_label': wl_pr[3], 'premium_label': wl_pr[4]}
        except Exception:
            pass
        try:
            cur.execute(f"SELECT category, is_wall_item, show_in_drum FROM {SCHEMA}.wl_category_settings WHERE wl_manager_id=%s", (wl_id,))
            for r in cur.fetchall():
                cat_settings[r[0]] = {'is_wall_item': r[1] if r[1] is not None else True, 'show_in_drum': r[2] if r[2] is not None else True}
        except Exception:
            pass

    # WL-переопределения позиций
    wl_overrides = {}
    if wl_id:
        try:
            cur.execute(
                f"SELECT price_id, price, purchase_price, active, description, synonyms, image_url, category_image_url FROM {SCHEMA}.wl_price_overrides WHERE wl_manager_id=%s",
                (wl_id,)
            )
            for ov in cur.fetchall():
                wl_overrides[ov[0]] = {
                    'price': ov[1], 'purchase_price': ov[2], 'active': ov[3],
                    'description': ov[4], 'synonyms': ov[5],
                    'image_url': ov[6], 'category_image_url': ov[7],
                }
        except Exception:
            pass

    cur.close()
    conn.close()

    prices = []
    for row in rows:
        pid = row[0]
        ov = wl_overrides.get(pid, {})

        # Если WL скрыл позицию — пропускаем
        if wl_id and ov.get('active') is False:
            continue

        prices.append({
            'id': pid,
            'name': row[1],
            'price': ov['price'] if ov.get('price') is not None else row[2],
            'unit': row[3] or '',
            'category': row[4] or '',
            'synonyms': ov['synonyms'] if ov.get('synonyms') is not None else (row[5] or ''),
            'image_url': ov['image_url'] if ov.get('image_url') is not None else row[6],
            'category_image_url': ov['category_image_url'] if ov.get('category_image_url') is not None else row[7],
            'is_wall_item': cat_settings.get(row[4] or '', {}).get('is_wall_item', True) if isinstance(cat_settings.get(row[4] or ''), dict) else True,
            'show_in_drum': cat_settings.get(row[4] or '', {}).get('show_in_drum', True) if isinstance(cat_settings.get(row[4] or ''), dict) else True,
        })

    return {
        'statusCode': 200,
        'headers': {**cors, 'Cache-Control': 'max-age=60'},
        'body': json.dumps({'prices': prices, 'pricing': pricing}),
    }