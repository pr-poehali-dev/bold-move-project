"""
plan-voice — подбор товаров по голосовому запросу в построителе планов.
Принимает: room_context (данные помещения) + transcript (речь клиента).
Возвращает: {items: [{name, qty, unit, price}]}
"""

import json
import os
import re
import urllib.request

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
}

GET_PRICES_URL = 'https://functions.poehali.dev/4a60d7e9-3b52-4eaa-b9f9-38653c3ef837'
OPENROUTER_KEY = os.environ.get('OPENROUTER_API_KEY_2', '')

_prices_cache: list = []


def get_prices() -> list:
    global _prices_cache
    if _prices_cache:
        return _prices_cache
    try:
        req = urllib.request.Request(GET_PRICES_URL, method='GET')
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            _prices_cache = data.get('prices', [])
            return _prices_cache
    except Exception as e:
        print(f"[plan-voice] get_prices error: {e}")
        return []


def build_prices_text(prices: list) -> str:
    lines = []
    cur_cat = None
    for p in prices:
        cat = p.get('category', '')
        name = p.get('name', '')
        price = p.get('price', 0)
        unit = p.get('unit', '')
        if cat != cur_cat:
            lines.append(f"\n[{cat}]")
            cur_cat = cat
        lines.append(f"  {name} | {price} руб/{unit}")
    return "\n".join(lines)


def extract_items(content: str) -> list:
    """Извлекает список items из ответа LLM даже если JSON обрезан."""
    content = re.sub(r'```(?:json)?\s*', '', content).strip()

    start = content.find('{')
    if start == -1:
        start = content.find('[')
        if start == -1:
            return []
        try:
            arr = json.loads(content[start:])
            if isinstance(arr, list):
                return arr
        except Exception:
            pass
        return []

    depth = 0
    end = -1
    for i, ch in enumerate(content[start:], start):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    if end == -1:
        truncated = content[start:]
        for suffix in [']}', '"}]}', '"]}}', ']}}']: 
            try:
                parsed = json.loads(truncated + suffix)
                items = parsed.get('items', [])
                if isinstance(items, list) and items:
                    return items
            except Exception:
                pass
        complete = re.findall(r'\{[^{}]+\}', truncated)
        result = []
        for obj_str in complete:
            try:
                obj = json.loads(obj_str)
                if isinstance(obj, dict) and 'name' in obj:
                    result.append(obj)
            except Exception:
                pass
        return result

    candidate = content[start:end]
    try:
        parsed = json.loads(candidate)
        items = parsed.get('items', [])
        if isinstance(items, list):
            return items
    except Exception:
        complete = re.findall(r'\{[^{}]+\}', candidate)
        result = []
        for obj_str in complete:
            try:
                obj = json.loads(obj_str)
                if isinstance(obj, dict) and 'name' in obj:
                    result.append(obj)
            except Exception:
                pass
        return result
    return []


def handler(event: dict, context) -> dict:
    """Подбирает товары натяжных потолков по голосовому запросу и данным помещения."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON'})}

    room_context = body.get('room_context', '')
    transcript = body.get('transcript', '')

    if not transcript:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'transcript required'})}

    if not OPENROUTER_KEY:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': 'No API key', 'items': []})}

    prices = get_prices()
    prices_text = build_prices_text(prices) if prices else "(прайс недоступен)"

    system_prompt = f"""Ты — помощник монтажника натяжных потолков. Клиент надиктовал список материалов для конкретного помещения.
Подбери точные позиции из прайса и верни JSON.

=== ПРАЙС-ЛИСТ ==={prices_text}

=== ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА ===

ПРОФИЛЬ СТАНДАРТНЫЙ:
- По умолчанию ВСЕГДА "Стеновой алюминиевый"
- "Потолочный алюминиевый" — ТОЛЬКО если клиент явно сказал "потолочный профиль" или "крепление к потолку"
- Количество = периметр МИНУС длина теневого и парящего профилей если они есть

ТЕНЕВОЙ ПРОФИЛЬ (только если клиент упомянул "теневой"):
- По умолчанию → "EuroKRAAB стеновой"
- Если клиент сказал "потолочный еврокраб" → "EuroKRAAB потолочный"
- Если клиент сказал "классик" / "флекси классика" → "Теневой классик (Flexy KLASSIKA 140)"
- Количество = длина стен где указано. Если не уточнил → весь периметр

ПАРЯЩИЙ ПРОФИЛЬ (только если клиент упомянул "парящий"):
- По умолчанию → "Flexy FLY 02  с рассеивателем"
- Если клиент сказал "ПК-6" или "без рассеивателя" → "Парящий ПК-6 без рассеивателя"
- Если клиент сказал "FLY 01" → "Flexy FLY 01 без рассеивателем"
- НИКОГДА не добавляй два вида парящего одновременно
- Количество = длина стен где указано. Если не уточнил → весь периметр

СВЕТИЛЬНИКИ (КРИТИЧНО — все три позиции ВСЕГДА вместе):
- Если упомянут "точечный" / "GX-53" / "спот" → добавить ВСЕ 3 позиции с ОДИНАКОВЫМ количеством:
  1. "Светильник GX-53"
  2. "Лампа GX-53"
  3. "Под светильник ∅90"
- Количество у всех трёх = количеству светильников из запроса

ЛЮСТРА:
- Если упомянута "люстра" → добавить "Под люстру планка" (1 шт на 1 люстру)

ПОЛОТНО:
- Количество в м² = площадь помещения из данных

РАСЧЁТ ДЛИН:
- "по одной стене" = одна сторона помещения (периметр ÷ 4)
- "по двум стенам" = периметр ÷ 2
- "по трём стенам" = периметр × 3 ÷ 4
- "по всему периметру" / без уточнения = весь периметр
- Данные помещения (площадь, периметр, длины стен) — приоритет над словами клиента

ВАЖНО:
- Используй ТОЛЬКО точные названия из прайса выше
- Верни ТОЛЬКО валидный JSON без пояснений: {{"items":[{{"name":"...","qty":1,"unit":"м","price":0}}]}}"""

    user_message = f"{room_context}\n\n=== ЗАПРОС КЛИЕНТА ===\n{transcript}"

    payload = json.dumps({
        'model': 'openai/gpt-4o-mini',
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ],
        'max_tokens': 5000,
        'temperature': 0,
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=payload,
        headers={
            'Authorization': f'Bearer {OPENROUTER_KEY}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://poehali.dev',
        },
        method='POST',
    )

    try:
        with urllib.request.urlopen(req, timeout=50) as resp:
            resp_data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"[plan-voice] openrouter error: {e}")
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'items': [], 'error': str(e)})}

    content = resp_data.get('choices', [{}])[0].get('message', {}).get('content', '')
    print(f"[plan-voice] LLM response: {content[:500]}")

    items = extract_items(content)
    print(f"[plan-voice] extracted {len(items)} items")

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'items': items}),
    }
