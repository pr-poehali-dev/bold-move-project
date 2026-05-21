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
            lines.append(f"\n{cat}:")
            cur_cat = cat
        lines.append(f"  - {name} | {price} руб/{unit}")
    return "\n".join(lines)


def extract_items(content: str) -> list:
    """Извлекает список items из ответа LLM даже если JSON обрезан."""
    content = re.sub(r'```(?:json)?\s*', '', content).strip()

    # Ищем начало JSON
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

    # Ищем конец через счётчик скобок
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
        # JSON обрезан — пробуем несколько вариантов закрытия
        truncated = content[start:]
        for suffix in [']}', '"}]}', '"]}}', ']}}']: 
            try:
                parsed = json.loads(truncated + suffix)
                items = parsed.get('items', [])
                if isinstance(items, list) and items:
                    return items
            except Exception:
                pass
        # Вытаскиваем все полные объекты через regex
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
        # Вытаскиваем полные объекты
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

    system_prompt = f"""Ты — помощник монтажника натяжных потолков. Клиент надиктовал список материалов.
Подбери точные позиции из прайса и верни JSON.

=== ПРАЙС-ЛИСТ ==={prices_text}

=== ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА (нарушать нельзя) ===

ПРАВИЛО 1 — ТЕНЕВОЙ ПРОФИЛЬ:
- Если клиент говорит "теневой" без уточнения конкретной модели → используй "Теневой классик (EuroKRAB 3D)"
- Если клиент говорит "теневой Флекси" / "теневой световой" / "теневой с подсветкой" → используй "Flexy KLASSIKA 140" или ближайший Flexy из прайса
- НИКОГДА не выбирай теневой профиль произвольно — только EuroKRAB по умолчанию

ПРАВИЛО 2 — ПАРЯЩИЙ ПРОФИЛЬ:
- Если клиент говорит "парящий" без уточнения конкретной модели → используй "Flexy FLY 02 без рассеивателя"
- Если клиент говорит "парящий с рассеивателем" → используй "Flexy FLY 02 с рассеивателем"
- Если клиент говорит "парящий ПК" / "парящий без подсветки" → используй "Парящий ПК-6 без рассеивателя"
- НИКОГДА не выбирай парящий профиль произвольно — только Flexy FLY 02 по умолчанию

ПРАВИЛО 3 — СВЕТИЛЬНИКИ:
- "Светильник GX-53", "точечный", "споты" → добавляй ВСЕ 3 позиции сразу: "Светильник GX-53" + "Лампа GX-53" + "Под светильник ∅90" в одинаковом количестве
- "Люстра" → добавь "Под люстру планка" (1 шт на 1 люстру)

ПРАВИЛО 4 — КОЛИЧЕСТВО:
- Профили (теневой, парящий, ниши) — количество в пог.м, равно длине стен где указано
- Если направление не указано → используй полный периметр из данных помещения
- Полотно — количество в м², равно площади помещения
- Светильники — количество из запроса клиента

ПРАВИЛО 5 — ТОЧНОСТЬ:
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
    print(f"[plan-voice] LLM response: {content[:300]}")

    items = extract_items(content)
    print(f"[plan-voice] extracted {len(items)} items")

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'items': items}),
    }