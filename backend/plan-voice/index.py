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

def get_rules_prompt() -> str:
    """Загружает правила по позициям из БД (when_condition, calc_rule, bundle) — те же что в чат-боте."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"""
            SELECT id, category, name, price, unit, calc_rule, bundle, synonyms, when_condition, when_not_condition
            FROM {SCHEMA}.ai_prices
            WHERE active = true
            ORDER BY sort_order, id
        """)
        rows = cur.fetchall()
        id_to_name = {r[0]: r[2] for r in rows}
        cur.close()
        conn.close()

        rule_lines = []
        for row in rows:
            rid, category, name, price, unit, calc_rule, bundle, synonyms, when_cond, when_not = row
            has_rule = (calc_rule or when_cond or when_not or (bundle and bundle not in ('[]', '', None)))
            if not has_rule:
                continue
            parts = []
            if when_cond:
                parts.append(f"ДОБАВЛЯТЬ ЕСЛИ: {when_cond}")
            if when_not:
                parts.append(f"НЕ ДОБАВЛЯТЬ ЕСЛИ: {when_not}")
            if calc_rule:
                _map = {'perimeter*0.25': 'qty = периметр ÷ 4', 'perimeter*0.5': 'qty = периметр ÷ 2',
                        'perimeter': 'qty = периметр', 'area': 'qty = площадь'}
                parts.append(f"КОЛ-ВО: {_map.get(calc_rule.strip(), calc_rule)}")
            try:
                bundle_ids = json.loads(bundle) if bundle else []
                if bundle_ids:
                    names = [id_to_name.get(i, f'#{i}') for i in bundle_ids]
                    parts.append(f"ДОБАВИТЬ ВМЕСТЕ: {', '.join(names)}")
            except Exception:
                pass
            if parts:
                rule_lines.append(f"▶ {name} [{category}]:\n  " + '\n  '.join(parts))

        if not rule_lines:
            return ''
        return '\n\n=== ПРАВИЛА ПО ПОЗИЦИЯМ (обязательно соблюдать) ===\n' + '\n'.join(rule_lines)
    except Exception as e:
        print(f"[plan-voice] get_rules_prompt error: {e}")
        return ''


def apply_bundles_and_rules(items: list) -> list:
    """
    Постобработка результата LLM — детерминированно добавляет связанные позиции (bundle).
    Гарантирует: лента+блок при парящем, раскрой+огарп при ПВХ, стеновой профиль всегда.
    Читает bundle-правила из БД.
    """
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"""
            SELECT id, name, price, unit, category, bundle, calc_rule
            FROM {SCHEMA}.ai_prices WHERE active = true
        """)
        all_rules = {r[0]: {'id': r[0], 'name': r[1], 'price': r[2], 'unit': r[3],
                             'category': r[4], 'bundle': r[5], 'calc_rule': r[6] or ''}
                     for r in cur.fetchall()}
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[plan-voice] apply_bundles DB error: {e}")
        return items

    name_to_rule = {r['name'].lower(): r for r in all_rules.values()}
    existing = {it['name'].lower() for it in items}
    to_add = []

    # Считаем суммарную длину всех парящих профилей — для правильного расчёта катушек ленты
    floating_kw = ['flexy', 'fly', 'парящий пк', 'пк-6']
    total_floating_len = sum(
        float(it.get('qty', 0) or 0)
        for it in items
        if any(w in it['name'].lower() for w in floating_kw)
    )

    for item in list(items):
        rule = name_to_rule.get(item['name'].lower())
        if not rule:
            continue
        try:
            bundle_ids = json.loads(rule['bundle'] or '[]')
        except Exception:
            bundle_ids = []
        if not bundle_ids:
            continue

        try:
            trigger_qty = float(item.get('qty', 1) or 1)
        except (TypeError, ValueError):
            trigger_qty = 1.0

        # Разбиваем bundle на блоки питания (выбор по мощности) и обычные
        power_items = []
        regular_items = []
        for bid in bundle_ids:
            br = all_rules.get(bid)
            if not br:
                continue
            calc = br['calc_rule'].lower()
            if 'до' in calc and 'вт' in calc:
                power_items.append(br)
            else:
                regular_items.append(br)

        # Добавляем обычные bundle-позиции
        tape_qty = trigger_qty
        for br in regular_items:
            if br['name'].lower() in existing:
                continue
            calc = br['calc_rule'].lower()
            import math as _m
            if 'кратно' in calc:
                # "кратно 5м" — катушки ленты: берём суммарную длину всех парящих
                import re as _re
                m = _re.search(r'кратно\s+(\d+)', calc)
                step = int(m.group(1)) if m else 5
                base_len = total_floating_len if total_floating_len > 0 else trigger_qty
                qty = max(1, _m.ceil(base_len / step))
                tape_qty = qty * step
                print(f"[bundle] tape: total_floating={total_floating_len}м step={step}м → {qty} катушек")
            else:
                qty = trigger_qty
            to_add.append({'name': br['name'], 'qty': qty,
                           'price': br['price'], 'unit': br['unit'], 'category': br['category']})
            existing.add(br['name'].lower())
            print(f"[bundle] added: {br['name']} qty={qty}")

        # Выбираем один блок питания по мощности ленты
        if power_items:
            import re as _re
            power_items_sorted = sorted(power_items, key=lambda r: (
                int(_re.search(r'до\s+(\d+)', r['calc_rule'].lower()).group(1))
                if _re.search(r'до\s+(\d+)', r['calc_rule'].lower()) else 9999
            ))
            chosen_power = next(
                (r for r in power_items_sorted
                 if _re.search(r'до\s+(\d+)', r['calc_rule'].lower())
                 and tape_qty <= int(_re.search(r'до\s+(\d+)', r['calc_rule'].lower()).group(1))),
                power_items_sorted[-1]
            )
            if chosen_power['name'].lower() not in existing:
                to_add.append({'name': chosen_power['name'], 'qty': 1,
                               'price': chosen_power['price'], 'unit': chosen_power['unit'],
                               'category': chosen_power['category']})
                existing.add(chosen_power['name'].lower())
                print(f"[bundle] power: {chosen_power['name']}")

    # Гарантируем стеновой алюминиевый — если есть любой профиль, стеновой должен быть
    has_any_profile = any(
        any(w in it['name'].lower() for w in ['профиль', 'flexy', 'fly', 'eurokraab', 'парящий', 'теневой', 'классик'])
        for it in items + to_add
    )
    stenovoy_name = 'Стеновой алюминиевый'
    if has_any_profile and stenovoy_name.lower() not in existing:
        stenovoy_rule = name_to_rule.get(stenovoy_name.lower())
        if stenovoy_rule:
            # Считаем суммарную длину спецпрофилей (парящий, теневой)
            special_kw = ['flexy', 'fly', 'eurokraab', 'парящий', 'теневой', 'классик', 'пк-6']
            total_special = sum(
                float(it.get('qty', 0)) for it in items
                if any(w in it['name'].lower() for w in special_kw)
                and 'монтаж' not in it['name'].lower()
            )
            # Периметр берём из room_context если передан, иначе из суммы всех wall-профилей
            # Находим периметр через максимальный qty среди всех профилей как ориентир
            all_profile_qtys = [
                float(it.get('qty', 0)) for it in items
                if any(w in it['name'].lower() for w in ['профиль', 'flexy', 'fly', 'eurokraab', 'парящий', 'теневой', 'классик'])
                and 'монтаж' not in it['name'].lower()
            ]
            # Берём периметр как сумму спецпрофилей + стеновой (обычно периметр = сумма всех)
            # Если есть только спецпрофили — стеновой = периметр - спецпрофили
            # qty не может быть нулём — берём хотя бы 1
            stenovoy_qty = max(1.0, round(total_special, 2)) if total_special > 0 else 1.0
            # Пересчитываем: если есть хоть один нормальный профиль qty — вычитаем спецпрофили
            # Ищем периметр в items: смотрим монтаж профиля стандарт — его qty = длина стенового
            montazh_std = next(
                (it for it in items if 'монтаж профиля стандарт' in it['name'].lower()), None
            )
            if montazh_std:
                stenovoy_qty = float(montazh_std.get('qty', stenovoy_qty))
            print(f"[bundle] ADDING Стеновой алюминиевый qty={stenovoy_qty}, special={total_special}")
            to_add.append({'name': stenovoy_rule['name'], 'qty': stenovoy_qty,
                           'price': stenovoy_rule['price'], 'unit': stenovoy_rule['unit'],
                           'category': stenovoy_rule['category']})
            existing.add(stenovoy_name.lower())

    return items + to_add


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

    # Правила по позициям — те же что в чат-боте (when_condition, bundle, calc_rule)
    rules_prompt = get_rules_prompt()

    # Промпт построителя из БД — управляется из админки (вкладка "Построитель")
    plan_prompt = get_plan_prompt()

    system_prompt = (
        "Ты — помощник монтажника натяжных потолков. "
        "В прайсе после каждой позиции в скобках указаны синонимы — слова, которыми монтажник может называть эту позицию.\n\n"
        f"=== ПРАЙС-ЛИСТ ==={prices_text}"
        f"{rules_prompt}\n\n"
        f"{plan_prompt}"
    )

    user_message = f"{room_context}\n\n=== ЗАПРОС КЛИЕНТА ===\n{transcript}"

    payload = json.dumps({
        'model': 'google/gemini-2.5-flash',
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ],
        'max_tokens': 16000,
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

    # Детерминированная постобработка — гарантируем bundle-позиции (лента, блок, монтаж)
    items = apply_bundles_and_rules(items)
    print(f"[plan-voice] after bundles: {len(items)} items")

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'items': items, 'semantic_map': semantic_map}),
    }