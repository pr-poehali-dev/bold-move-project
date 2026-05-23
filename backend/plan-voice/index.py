"""
plan-voice — подбор товаров по голосовому запросу в построителе планов.
Принимает: room_context (данные помещения) + transcript (речь клиента).
Возвращает: {items: [{name, qty, unit, price}], semantic_map: {...}}
Промпт (##PLAN## секция) и синонимы загружаются из БД — управляется из админки.
"""

import json
import os
import re
import urllib.request
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
}

GET_PRICES_URL = 'https://functions.poehali.dev/4a60d7e9-3b52-4eaa-b9f9-38653c3ef837'
OPENROUTER_KEY = os.environ.get('OPENROUTER_API_KEY_2', '')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

PLAN_PROMPT_FALLBACK = """=== РЕЖИМ ПОСТРОИТЕЛЯ ===
Получишь данные помещения (площадь, периметр, стены с длинами) и голосовой запрос монтажника.
Верни ТОЛЬКО валидный JSON без пояснений и без markdown:
{"items":[{"name":"...","qty":1,"unit":"м","price":0}]}
Используй ТОЧНЫЕ названия из прайса. qty — метры для профилей, м² для полотна, шт для штучных.
Количество бери из данных помещения."""


def get_plan_prompt() -> str:
    """Загружает секцию ##PLAN## из ai_system_prompt в БД без кэша — всегда актуальный промпт."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT content FROM {SCHEMA}.ai_system_prompt ORDER BY id LIMIT 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row and row[0]:
            idx = row[0].find('##PLAN##')
            if idx >= 0:
                return row[0][idx + len('##PLAN##'):].strip()
    except Exception as e:
        print(f"[plan-voice] get_plan_prompt error: {e}")
    return PLAN_PROMPT_FALLBACK

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
    """Строит текстовый прайс для промпта — с синонимами для каждой позиции."""
    lines = []
    cur_cat = None
    for p in prices:
        cat = p.get('category', '')
        name = p.get('name', '')
        price = p.get('price', 0)
        unit = p.get('unit', '')
        syns = p.get('synonyms', '')
        if cat != cur_cat:
            lines.append(f"\n[{cat}]")
            cur_cat = cat
        syn_hint = f" (синонимы: {syns})" if syns else ""
        lines.append(f"  {name}{syn_hint} | {price} руб/{unit}")
    return "\n".join(lines)


def build_semantic_map(prices: list) -> dict:
    """
    Строит словарь: синоним_ключ → [точное_название_позиции, ...]
    Используется в сравнении результатов — вместо хардкода.
    """
    semantic: dict = {}
    for p in prices:
        name = p.get('name', '')
        syns_raw = p.get('synonyms', '') or ''
        if not syns_raw:
            continue
        syns = [s.strip().lower() for s in syns_raw.split(',') if s.strip()]
        for syn in syns:
            # Ключ — первые слова синонима (для частичного совпадения)
            key = syn[:6]  # первые 6 символов как ключ поиска
            semantic.setdefault(key, []).append(name.lower())
            # Также добавляем полный синоним
            semantic.setdefault(syn, []).append(name.lower())
    return semantic


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

    print(f"[plan-voice] transcript: {transcript}")
    print(f"[plan-voice] room_context: {room_context[:400]}")

    prices = get_prices()
    prices_text = build_prices_text(prices) if prices else "(прайс недоступен)"
    semantic_map = build_semantic_map(prices)

    # Промпт полностью из БД — управляется из админки (вкладка "Построитель")
    plan_prompt = get_plan_prompt()

    system_prompt = (
        "Ты — помощник монтажника натяжных потолков. "
        "В прайсе после каждой позиции в скобках указаны синонимы — слова, которыми монтажник может называть эту позицию.\n\n"
        f"=== ПРАЙС-ЛИСТ ==={prices_text}\n\n"
        f"{plan_prompt}"
    )

    user_message = f"{room_context}\n\n=== ЗАПРОС КЛИЕНТА ===\n{transcript}"

    payload = json.dumps({
        'model': 'openai/gpt-4o-mini',
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ],
        'max_tokens': 8000,
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
    usage = resp_data.get('usage', {})
    print(f"[plan-voice] tokens: prompt={usage.get('prompt_tokens')} completion={usage.get('completion_tokens')} total={usage.get('total_tokens')}")
    print(f"[plan-voice] LLM response: {content[:500]}")

    items = extract_items(content)
    print(f"[plan-voice] extracted {len(items)} items")

    # Возвращаем semantic_map чтобы фронт мог использовать актуальные синонимы из БД
    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'items': items, 'semantic_map': semantic_map}),
    }