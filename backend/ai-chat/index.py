"""AI-помощник MOSPOTOLKI — отвечает на вопросы о натяжных потолках и считает стоимость. v6."""

import json
import os
import re
import requests
import psycopg2

from services import generate_image, web_search, search_price, call_llm, SEARCH_VISUAL, IMAGE_GEN
from db import (
    get_knowledge, get_system_prompt, get_plan_prompt, get_faq_cache,
    get_prices_block, get_canvas_prices, get_price_rules,
    build_rules_prompt, eval_calc_rule, save_correction, save_correction_answer, CANVAS_PRICES, SCHEMA,
    get_llm_threshold, get_complex_exceptions, get_stop_words,
)
from calc import (
    _WORDS_TO_NUM, _NUM_WORD_PAT, _w2n,
    _COMPLEX_WORDS, _COMPLEX_PAT, _FULL_WORD_PAT, _NUMBERED_LIST_PAT,
    _NUANCE_PAT, _SIMPLE_ALLOWED_PAT, _KNOWN_PARTS_PAT,
    _extract_nuance_phrases, _get_whitelist_unknown, _text_covered_by_synonyms,
    get_skip_reason, _get_known_synonyms,
    try_simple_estimate,
)
from render import (
    _build_price_map, _find_in_price_map,
    _render_estimate_from_items,
    _apply_edit_patch,
    _calc_bundle_qty, _select_bundle_item_by_calc, _apply_bundles,
)

FAQ_CACHE = {
    r"(гарантия|сколько служит|срок службы)": "Гарантия — 10 лет. Срок службы полотна — 25–30 лет.\n\nЗаписаться на замер: +7 (977) 606-89-01",
    r"(сколько времени|как долго|срок монтаж|когда будет готов|сколько дней)": "Монтаж комнаты — 1–3 часа. Готово в день замера или через 1–3 рабочих дня.\n\n+7 (977) 606-89-01",
    r"(телефон|номер|контакт|связаться|позвонить|whatsapp|вотсап|telegram|телеграм)": "📞 +7 (977) 606-89-01\n💬 wa.me/79776068901\n✈️ @JoniKras\nЕжедневно 8:00–22:00",
    r"(адрес|офис|шоурум|где находит|мытищ)": "Работаем по Москве и МО. Офис — Мытищи.\nАдрес пришлём при записи: +7 (977) 606-89-01",
    r"(скидк|акци|промокод|дешевле)": "Актуальные акции — у менеджера: +7 (977) 606-89-01\n\nНазовите площадь — рассчитаю стоимость прямо сейчас.",
    r"(привет|здравствуй|добрый день|добрый вечер|добрый утр|здаров|хай|hi\b|hello)": "Привет! Я AI-сметчик MosPotolki.\n\nНазовите площадь комнаты и тип потолка — сделаю расчёт за секунду.",
    r"(спасибо|благодарю|спасиб|отлично|супер|\bкласс\b|👍)": "Рад помочь! Технолог приедет на замер бесплатно.\n\nЗаписаться: +7 (977) 606-89-01",
    r"(замер|выезд|приедет|технолог)": "Замер бесплатный — технолог приедет, сделает расчёт и 3D-проект.\n\n+7 (977) 606-89-01 · ежедневно 8:00–22:00",
    r"(что умеешь|как ты работаешь|что можешь|помоги|с чего начать)": "Называйте площадь комнаты и тип потолка — составлю смету с ценами по каждой позиции.\n\nПример: «Комната 20 м², матовый белый»",
    r"^(цены|прайс|расценки|прайс-лист)$": "Цены от:\n• Матовый белый — от 399 ₽/м²\n• Цветной — от 900 ₽/м²\n• Тканевый — от 2200 ₽/м²\n\nДля точного расчёта назовите площадь комнаты.",
}


def _parse_llm_items(answer: str) -> list:
    """Парсит текстовый ответ LLM и извлекает позиции сметы."""
    items = []
    line_pat = re.compile(
        r'^[\s\-•]*(.+?)\s+'
        r'(\d+(?:[.,]\d+)?)\s*(?:шт\.?|м\.?п?\.?|м²|пог\.?м?|уп\.?|кат\.?)?\s*'
        r'[×xх]\s*(\d[\d\s]*)\s*₽\s*=\s*(\d[\d\s]*)\s*₽',
        re.MULTILINE | re.IGNORECASE
    )
    for m in line_pat.finditer(answer):
        name = m.group(1).strip().rstrip(':').strip()
        if len(name) < 3 or len(name) > 80:
            continue
        try:
            qty = float(m.group(2).replace(',', '.'))
            price = int(re.sub(r'\s', '', m.group(3)))
            total = int(re.sub(r'\s', '', m.group(4)))
        except Exception:
            continue
        items.append({'name': name, 'qty': qty, 'price': price, 'total': total})
    return items


def _extract_and_save_suggestions(answer: str, user_text: str, session_id: str, rules: list) -> None:
    """Извлекает из ответа LLM позиции которых нет в прайсе и сохраняет как suggested_items."""
    items = _parse_llm_items(answer)
    if not items:
        return
    BUILTIN_STOP_WORDS = {
        'раскрой', 'огарпун', 'полотно', 'монтаж', 'профил', 'закладн',
        'светильник', 'лампа', 'люстра', 'ниша', 'карниз', 'штора',
        'стандарт', 'econom', 'standard', 'premium', 'итого', 'всего',
        'услуги', 'установк', 'разводк', 'гост',
    }
    def _is_builtin(name: str) -> bool:
        nl = name.lower()
        return any(stop in nl for stop in BUILTIN_STOP_WORDS)
    known = set()
    for r in rules:
        known.add(r['name'].lower())
        if r.get('synonyms'):
            for s in r['synonyms'].split(','):
                s = s.strip().lower()
                if s:
                    known.add(s)
    def _words(s: str) -> set:
        return set(re.findall(r'[а-яёa-z0-9]+', s.lower()))
    new_items = []
    for item in items:
        if _is_builtin(item['name']):
            continue
        item_words = _words(item['name'])
        if not item_words:
            continue
        is_known = any(
            len(item_words & _words(k)) / max(len(item_words), len(_words(k))) >= 0.5
            for k in known if _words(k)
        )
        if not is_known:
            new_items.append(item)
            print(f"[suggestions] new item: {item['name']} {item['price']}₽")
    if not new_items:
        return
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"""UPDATE {SCHEMA}.bot_corrections
                SET suggested_items = %s
                WHERE id = (
                    SELECT id FROM {SCHEMA}.bot_corrections
                    WHERE session_id = %s AND user_text = %s
                    ORDER BY created_at DESC LIMIT 1
                )""",
            (json.dumps(new_items, ensure_ascii=False), session_id, user_text)
        )
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print(f"[suggestions] db error: {e}")


def _save_suggestions_from_json(items: list, user_text: str, session_id: str, rules: list) -> None:
    """Сохраняет предложения из структурированного JSON ответа LLM."""
    if not items:
        return
    BUILTIN_STOP_WORDS = {
        'раскрой', 'огарпун', 'монтаж', 'профил', 'закладн',
        'светильник', 'лампа', 'люстра', 'ниша', 'карниз', 'штора',
        'стандарт', 'econom', 'standard', 'premium', 'итого', 'всего',
        'услуги', 'установк', 'разводк', 'гост', 'полотно',
    }
    def _is_builtin(name: str) -> bool:
        nl = name.lower()
        return any(stop in nl for stop in BUILTIN_STOP_WORDS)
    known = set()
    for r in rules:
        known.add(r['name'].lower())
        if r.get('synonyms'):
            for s in r['synonyms'].split(','):
                s = s.strip().lower()
                if s:
                    known.add(s)
    def _words(s: str) -> set:
        return set(re.findall(r'[а-яёa-z0-9]+', s.lower()))
    new_items = []
    for item in items:
        name = item.get('name', '').strip()
        if not name or _is_builtin(name):
            continue
        item_words = _words(name)
        if not item_words:
            continue
        is_known = any(
            len(item_words & _words(k)) / max(len(item_words), len(_words(k))) >= 0.5
            for k in known if _words(k)
        )
        if not is_known:
            new_items.append({
                'name': name,
                'qty': item.get('qty', 1),
                'price': item.get('price', 0),
                'total': round(item.get('qty', 1) * item.get('price', 0)),
            })
    if not new_items:
        return
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"""UPDATE {SCHEMA}.bot_corrections
                SET suggested_items = %s
                WHERE id = (
                    SELECT id FROM {SCHEMA}.bot_corrections
                    WHERE session_id = %s AND user_text = %s
                    ORDER BY created_at DESC LIMIT 1
                )""",
            (json.dumps(new_items, ensure_ascii=False), session_id, user_text)
        )
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print(f"[suggestions] json db error: {e}")


def _patch_answer_with_prices(answer: str, llm_items: list, rules: list | None = None) -> str:
    """Патчит ответ LLM — заменяет цены на актуальные из БД."""
    price_map = _build_price_map(rules) if rules else {}
    llm_map = {}
    for it in llm_items:
        n = it.get('name', '').strip()
        if n:
            llm_map[n.lower()] = it

    def fmt(n: int) -> str:
        return f"{n:,}".replace(',', ' ')

    MUL = r'[×xх]'
    result_lines = []
    for line in answer.split('\n'):
        full_m = re.match(
            r'^(\s*)(.*?)\s+(\d+(?:[.,]\d+)?)\s*(\S+)?\s*[×xх]\s*([\d\s]+)\s*₽\s*=\s*([\d\s]+)\s*₽\s*$',
            line
        )
        if full_m:
            indent = full_m.group(1)
            name = full_m.group(2).strip().lstrip('-–—•').strip()
            qty_str = full_m.group(3)
            unit_str = (full_m.group(4) or '').strip()
            db_entry = _find_in_price_map(name, price_map)
            if db_entry:
                try:
                    qty = float(qty_str.replace(',', '.'))
                    price = int(db_entry['price'])
                    unit_out = db_entry['unit'] or unit_str
                    total = round(qty * price)
                    qty_display = int(qty) if qty == int(qty) else qty
                    result_lines.append(f"{indent}{name}  {qty_display} {unit_out} × {fmt(price)} ₽ = {fmt(total)} ₽")
                    continue
                except Exception:
                    pass
            result_lines.append(line)
            continue
        m = re.match(r'^(\s*)(.*?)\s*' + MUL + r'\s*([\d][\d\s,.]*)\s*(м²|м2|мп|пм|шт\.?|шт|м\.п\.?|м\b)?\s*$', line)
        if m:
            indent, name, qty_str, unit = m.group(1), m.group(2).strip().lstrip('-–—•').strip(), m.group(3).strip(), (m.group(4) or '').strip()
            db_entry = _find_in_price_map(name, price_map)
            if db_entry:
                try:
                    qty = float(qty_str.replace(',', '.').replace(' ', ''))
                    price = int(db_entry['price'])
                    unit_out = db_entry['unit'] or unit
                    total = round(qty * price)
                    qty_display = int(qty) if qty == int(qty) else qty
                    result_lines.append(f"{indent}{name}  {qty_display} {unit_out} × {fmt(price)} ₽ = {fmt(total)} ₽")
                    continue
                except Exception:
                    pass
            llm_data = None
            for k, v in llm_map.items():
                if name.lower() == k or name.lower() in k or k in name.lower():
                    llm_data = v; break
            if llm_data:
                try:
                    qty = float(qty_str.replace(',', '.').replace(' ', ''))
                    price = int(llm_data.get('price', 0))
                    unit_from_json = llm_data.get('unit', unit) or unit
                    total = round(qty * price)
                    qty_display = int(qty) if qty == int(qty) else qty
                    result_lines.append(f"{indent}{name}  {qty_display} {unit_from_json} × {fmt(price)} ₽ = {fmt(total)} ₽")
                    continue
                except Exception:
                    pass
        result_lines.append(line)
    return '\n'.join(result_lines)


def _apply_surcharges(answer: str, rules: list) -> str:
    """Применяет надбавки с unit='%'."""
    pct_items = {r['name'].lower(): r['price'] for r in rules if r.get('unit') == '%'}
    if not pct_items:
        return answer

    def fmt(n: int) -> str:
        return f"{n:,}".replace(',', ' ')

    line_pat = re.compile(
        r'^(?P<indent>[ \t]*)(?P<name>[^\d×xх]+?)\s+'
        r'(?P<qty>[\d.,]+)\s*(?P<unit>[а-яёa-z%²\.]*)\s*'
        r'[×xх]\s*(?P<price>[\d\s]+)\s*₽\s*=\s*(?P<total>[\d\s]+)\s*₽',
        re.IGNORECASE
    )
    lines = answer.split('\n')
    mounting_total = 0
    for line in lines:
        m = line_pat.match(line)
        if not m:
            continue
        name_low = m.group('name').strip().lower()
        if any(pct in name_low or name_low in pct for pct in pct_items):
            continue
        if 'монтаж' in name_low:
            try:
                mounting_total += int(re.sub(r'\s', '', m.group('total')))
            except Exception:
                pass
    if mounting_total == 0:
        return answer
    result_lines = []
    for line in lines:
        stripped = line.strip()
        matched_pct = None
        matched_name = None
        for pct_name, pct_val in pct_items.items():
            if stripped.lower().startswith(pct_name):
                matched_pct = pct_val; matched_name = pct_name; break
        if matched_pct is not None:
            surcharge = round(mounting_total * matched_pct / 100)
            indent = line[:len(line) - len(line.lstrip())]
            original_name = next((r['name'] for r in rules if r['name'].lower() == matched_name), matched_name)
            result_lines.append(f"{indent}{original_name}  1 шт. × {fmt(surcharge)} ₽ = {fmt(surcharge)} ₽")
        else:
            result_lines.append(line)
    return '\n'.join(result_lines)


def _recalc_totals(answer: str) -> str:
    """Пересчитывает итоговую стоимость из актуальных строк сметы."""
    def fmt(n: int) -> str:
        return f"{n:,}".replace(',', ' ')

    item_pat = re.compile(r'=\s*([\d][\d\s]*(?:[.,]\d+)?)\s*₽\s*\**\s*$', re.IGNORECASE)
    total_pat = re.compile(r'^(Econom|Standard|Premium)\s*:\s*[\d\s]+(?:[.,]\d+)?\s*₽', re.IGNORECASE)
    lines = answer.split('\n')
    standard = 0
    for line in lines:
        if total_pat.match(line.strip()):
            continue
        m = item_pat.search(line)
        if m:
            try:
                val_str = re.sub(r'\s', '', m.group(1))
                standard += round(float(val_str.replace(',', '.')))
            except Exception:
                pass
    if standard == 0:
        return answer
    econom = round(standard * 0.77)
    premium = round(standard * 1.27)
    result_lines = []
    for line in lines:
        stripped = line.strip()
        if re.match(r'^Econom\s*:', stripped, re.IGNORECASE):
            result_lines.append(f"Econom:   {fmt(econom)} ₽")
        elif re.match(r'^Standard\s*:', stripped, re.IGNORECASE):
            result_lines.append(f"Standard: {fmt(standard)} ₽")
        elif re.match(r'^Premium\s*:', stripped, re.IGNORECASE):
            result_lines.append(f"Premium:  {fmt(premium)} ₽")
        else:
            result_lines.append(line)
    return '\n'.join(result_lines)


def fetch_brand(company_id):
    """Тянет бренд активной компании из БД."""
    if not company_id:
        return None
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur  = conn.cursor()
        cur.execute(f"""
            SELECT role, has_own_agent, company_name, bot_name,
                   support_phone, telegram, max_url, working_hours,
                   pdf_footer_address, website, company_addr
            FROM {SCHEMA}.users
            WHERE id=%s AND removed_at IS NULL
        """, (int(company_id),))
        r = cur.fetchone()
        cur.close(); conn.close()
        if not r:
            return None
        role, has_agent, company_name, bot_name, phone, telegram, max_url, hours, pdf_addr, website, company_addr = r
        addr = pdf_addr
        if not addr and company_addr:
            ca = company_addr.strip().lower()
            if any(x in ca for x in ('москв', ' мо', 'московск')):
                addr = 'Москва и МО'
            else:
                addr = company_addr.strip().title()
        if not has_agent or role != 'company':
            return None
        tg_url = ''
        if telegram:
            t = telegram.strip()
            tg_url = t if t.startswith('http') else 'https://t.me/' + t.lstrip('@')
        return {
            'company_name': (company_name or '').strip(),
            'bot_name':     (bot_name or '').strip(),
            'phone':        (phone or '').strip(),
            'telegram_url': tg_url,
            'max_url':      (max_url or '').strip(),
            'hours':        (hours or '').strip(),
            'address':      (addr or '').strip(),
            'website':      (website or '').strip(),
        }
    except Exception as e:
        print(f"[brand] fetch error: {e}")
        return None


_BRAND_DEFAULTS = {
    'phone':        '+7 (977) 606-89-01',
    'phone_digits': '79776068901',
    'telegram_at':  '@JoniKras',
    'telegram_url': 'https://t.me/JoniKras',
    'company':      'MosPotolki',
    'address':      'Мытищи',
    'hours':        'Ежедневно 8:00–22:00',
    'website':      'mospotolki.net',
}


def apply_brand_to_text(text: str, brand) -> str:
    """Подменяет дефолтные контакты MosPotolki на контакты бренда."""
    if not brand or not text:
        return text
    out = text
    if brand.get('phone'):
        out = out.replace(_BRAND_DEFAULTS['phone'], brand['phone'])
        new_digits = re.sub(r'\D', '', brand['phone'])
        if new_digits:
            out = out.replace(_BRAND_DEFAULTS['phone_digits'], new_digits)
    if brand.get('telegram_url'):
        m = re.search(r't\.me/([^/?#\s]+)', brand['telegram_url'])
        new_at = '@' + m.group(1) if m else ''
        if new_at:
            out = out.replace(_BRAND_DEFAULTS['telegram_at'], new_at)
    if brand.get('company'):
        out = out.replace(_BRAND_DEFAULTS['company'], brand['company'])
    if brand.get('address'):
        out = out.replace('Офис — Мытищи', f"Офис — {brand['address']}")
    if brand.get('hours'):
        out = out.replace(_BRAND_DEFAULTS['hours'], brand['hours'])
        out = out.replace('ежедневно 8:00–22:00', brand['hours'])
    if brand.get('website'):
        out = out.replace(_BRAND_DEFAULTS['website'], brand['website'])
    return out


def get_cached_answer(text: str, session_id: str = '', brand=None):
    """Проверяет кэш и простой расчёт."""
    text_lower = text.lower().strip()
    result = try_simple_estimate(text_lower)
    print(f"[calc] text='{text_lower[:80]}' estimate={'YES' if result else 'NO'}")
    if result:
        answer, recognized = result
        save_correction(text, recognized, session_id)
        return answer, recognized
    is_discount_request = bool(re.search(r'скидк.{0,20}\d+\s*%|убер|сниз|уменьш|пересчита', text_lower))
    dynamic_cache = get_faq_cache(fallback=FAQ_CACHE)
    for pattern, answer in dynamic_cache.items():
        if re.search(pattern, text_lower):
            if is_discount_request:
                continue
            return apply_brand_to_text(answer, brand)
    return None


SYSTEM_PROMPT = """Ты сметчик-технолог компании MosPotolki (натяжные потолки, Мытищи, с 2009г). Отвечай по-русски.
Все правила и инструкции загружаются из базы данных.
Если позиции нет в прайс-листе — её не существует, не выдумывай.

"""


def _extract_items_from_content(content: str) -> list:
    """Извлекает массив items из ответа LLM."""
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
        for suffix in [']}', '"]}}', '"}]}', '"]]}', '}}', ']}}'']:
            try:
                parsed = json.loads(truncated + suffix)
                items = parsed.get('items', [])
                if isinstance(items, list) and items:
                    return items
            except Exception:
                pass
        complete_objects = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}', truncated)
        result = []
        for obj_str in complete_objects:
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
        complete_objects = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}', candidate)
        result = []
        for obj_str in complete_objects:
            try:
                obj = json.loads(obj_str)
                if isinstance(obj, dict) and 'name' in obj:
                    result.append(obj)
            except Exception:
                pass
        return result
    return []


def handler(event, context):
    """Обрабатывает запросы к AI-чату MOSPOTOLKI."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': cors, 'body': json.dumps({'error': 'Method not allowed'})}

    body = json.loads(event.get('body', '{}'))
    messages = body.get('messages', [])
    fast = body.get('fast', False)
    prev_items = body.get('prev_items', None)
    company_id = body.get('company_id')

    if not messages:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'No messages provided'})}

    last_user_text = ''
    for msg in reversed(messages):
        if msg.get('role') == 'user':
            last_user_text = msg.get('text', '')
            break

    session_id = event.get('headers', {}).get('x-session-id', '') or event.get('headers', {}).get('X-Session-Id', '')
    brand = fetch_brand(company_id)

    if fast and not prev_items:
        try:
            cached = get_cached_answer(last_user_text, session_id, brand=brand)
            if cached:
                answer = cached[0] if isinstance(cached, tuple) else cached
                return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'answer': answer})}
        except Exception as e:
            print(f"[fast] error in get_cached_answer: {e}")
            import traceback; traceback.print_exc()

    first_user_text = next((m.get('text', '') for m in messages if m.get('role') == 'user'), '')
    is_plan_mode = '=== ДАННЫЕ ПОМЕЩЕНИЯ' in first_user_text

    if is_plan_mode:
        openrouter_key = os.environ.get('OPENROUTER_API_KEY_2', '') or os.environ.get('OPENROUTER_API_KEY', '')
        prices_block = get_prices_block()
        rules_list   = get_price_rules()
        rules_hint   = build_rules_prompt(rules_list)
        plan_section = get_plan_prompt(fallback=(
            'Верни ТОЛЬКО валидный JSON: {"items":[{"name":"...","qty":1,"unit":"м","price":0}]}'
        ))
        plan_system = (
            get_system_prompt(fallback=SYSTEM_PROMPT)
            + f"\n\n=== АКТУАЛЬНЫЙ ПРАЙС-ЛИСТ ==={prices_block}"
            + (rules_hint or "")
            + f"\n\n{plan_section}"
        )
        plan_msgs = [
            {'role': 'system', 'content': plan_system},
            {'role': 'user',   'content': first_user_text},
            {'role': 'user',   'content': last_user_text},
        ]
        try:
            import requests as _req
            headers = {
                'Authorization': f'Bearer {openrouter_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://mospotolki.ru',
            }
            resp = _req.post(
                'https://openrouter.ai/api/v1/chat/completions',
                json={'model': 'openai/gpt-4o-mini', 'messages': plan_msgs, 'max_tokens': 3000, 'temperature': 0},
                headers=headers,
                timeout=55,
            )
            if resp.status_code == 200:
                content = resp.json()['choices'][0]['message']['content']
                items = _extract_items_from_content(content)
                if items:
                    print(f"[plan_mode] returned {len(items)} items")
                    return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'items': items})}
                else:
                    print(f"[plan_mode] no items parsed from: {content[:200]}")
        except Exception as e:
            print(f"[plan_mode] error: {e}")
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'items': []})}

    skip_info = get_skip_reason(last_user_text.lower().strip())
    save_correction(last_user_text, skip_info, session_id, company_id=int(company_id) if company_id else None)

    knowledge = get_knowledge(last_user_text)
    system_content = get_system_prompt(fallback=SYSTEM_PROMPT)
    prices_block = get_prices_block()
    _rules_for_suggestions = get_price_rules()
    if prices_block:
        system_content += f"\n\n=== АКТУАЛЬНЫЙ ПРАЙС-ЛИСТ ==={prices_block}"
    if knowledge:
        system_content += f"\n\n=== БАЗА ЗНАНИЙ ===\n{knowledge}"

    if brand:
        system_content = apply_brand_to_text(system_content, brand)
        bot_intro = (f"Тебя зовут {brand['bot_name']}. " if brand.get('bot_name') else "")
        system_content += (
            f"\n\n=== БРЕНД ===\n"
            f"{bot_intro}"
            f"Ты работаешь от имени компании «{brand.get('company') or brand.get('company_name', '')}». "
            f"Если клиент спрашивает контакты — давай ТОЛЬКО эти:\n"
            f"Телефон: {brand.get('phone', '')}\n"
            f"Telegram: {brand.get('telegram_url', '')}\n"
            f"MAX: {brand.get('max_url', '')}\n"
            f"Адрес: {brand.get('address', '')}\n"
            f"Часы работы: {brand.get('hours', '')}\n"
            f"Сайт: {brand.get('website', '')}\n"
            f"НИКОГДА не упоминай другие компании, контакты или сайты."
        )
    rules_hint = build_rules_prompt(_rules_for_suggestions)
    if rules_hint:
        system_content += rules_hint
    print(f"[system] prompt_len={len(system_content)} rules_count={len(_rules_for_suggestions)}")

    if prev_items:
        price_map = _build_price_map(_rules_for_suggestions)
        prev_lines = '\n'.join([
            f"{i+1}. {it['name']}  qty={it['qty']} unit={it.get('unit','шт')} price={it['price']}"
            for i, it in enumerate(prev_items)
        ])
        price_list_short = '\n'.join([
            f"- {r['name']} ({r['price']} ₽/{r['unit']})"
            for r in (_rules_for_suggestions or [])
        ])
        patch_prompt = f"""Клиент хочет изменить смету. Его запрос: "{last_user_text}"

Текущий состав сметы:
{prev_lines}

ДОСТУПНЫЙ ПРАЙС-ЛИСТ (добавлять можно ТОЛЬКО из этого списка):
{price_list_short}

Верни ТОЛЬКО JSON-патч (без пояснений, без текста, только JSON):
{{
  "comment": "Краткое подтверждение что сделано (1 строка для клиента)",
  "discount_percent": 0,
  "remove": ["Точное название позиции для удаления"],
  "add": [{{"name": "Точное название из прайса", "qty": 1, "unit": "шт", "price": 0}}],
  "update": [{{"name": "Точное название из сметы", "qty": 2}}]
}}

Правила:
- "discount_percent" — если клиент просит скидку (например "скидку 10%") — укажи число (10), остальные массивы оставь пустыми
- "remove" — при удалении товара убирай и сам товар И его монтаж из сметы (оба названия в массиве remove)
- "add" — ТОЛЬКО позиции из ПРАЙС-ЛИСТА выше которых нет в текущей смете. Используй точное название из прайса
- "update" — позиции которые УЖЕ ЕСТЬ в смете, но нужно изменить qty
- Если позиции нет в прайс-листе но клиент её чётко назвал — добавь с name как написал клиент, qty указанное клиентом, price=0
- Никогда не ставь одну позицию одновременно в "add" и "update"
- Если клиент просит добавить N штук к существующей позиции — "update" с итоговым qty (текущее + добавляемое)
- qty в "add" — точное количество из запроса клиента (если клиент написал "8м" то qty=8)
- ЗАМЕНА позиции: если клиент просит заменить одну позицию на другую — новая позиция Y должна иметь то же qty что и удаляемая X
- ВАЖНО: монтаж синхронизируется автоматически — тебе не нужно добавлять монтажные позиции вручную при изменении количества товара
- Если запрос слишком расплывчатый — верни пустые массивы и в comment попроси уточнить
- Если ничего менять не нужно — верни пустые массивы"""

        patch_msgs = [{'role': 'user', 'content': patch_prompt}]
        patch_answer = call_llm(patch_msgs)
        print(f"[edit] llm patch raw: {patch_answer[:300]}")

        try:
            json_match = re.search(r'\{.+\}', patch_answer, re.DOTALL)
            if not json_match:
                raise ValueError("no json in patch response")
            patch = json.loads(json_match.group(0))
            comment = patch.get('comment', 'Готово ✅')

            for add_item in patch.get('add', []):
                if add_item.get('unknown') or int(add_item.get('price', 0)) == 0:
                    unknown_name = add_item['name']
                    try:
                        qty_m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:пог\.?м|пм|м\.п\.?|м(?!²|2))', last_user_text, re.IGNORECASE)
                        qty_pcs = re.search(r'(\d+)\s*(?:шт|штук)', last_user_text, re.IGNORECASE)
                        client_qty_meters = float(qty_m.group(1).replace(',', '.')) if qty_m else None
                        client_qty_pcs = int(qty_pcs.group(1)) if qty_pcs else None
                        price_result = search_price(f"{unknown_name} длина размер цена")
                        search_text = price_result.get('text', '')
                        client_need = f"{client_qty_meters} пог.м" if client_qty_meters else (f"{client_qty_pcs} шт" if client_qty_pcs else "не указал")
                        classify_prompt = f"""Контекст: смета на натяжные потолки.
Позиция: "{unknown_name}"
Клиент указал: {client_need}
Справочная информация о товаре: {search_text[:500]}

Верни ТОЛЬКО JSON:
{{"category": "...", "unit": "...", "price": 0, "mounting_name": "...", "mounting_unit": "шт", "total_length_m": null}}

Правила:
- category: "Профиль стандартный" / "Парящий профиль" / "Теневой профиль" / "Ниши для штор" / "Закладные" / "Освещение" / "Вентиляция" / "Монтаж" / "Прочее"
- unit: "пог.м" для профилей/ниш, "шт" для штучных, "м²" для полотна
- price: приблизительная цена за единицу (0 если не знаешь)
- mounting_name: название монтажной позиции из прайса если нужен монтаж (null если монтаж уже включён или не нужен)
- total_length_m: реальная длина в метрах если клиент указал её явно (null если не указал)"""
                        classify_msgs = [{'role': 'user', 'content': classify_prompt}]
                        cl_raw = call_llm(classify_msgs)
                        cl_match = re.search(r'\{.+\}', cl_raw, re.DOTALL)
                        if cl_match:
                            cl = json.loads(cl_match.group(0))
                            add_item['category'] = cl.get('category', '')
                            add_item['unit'] = cl.get('unit', 'шт')
                            if cl.get('price') and int(cl['price']) > 0 and int(add_item.get('price', 0)) == 0:
                                add_item['price'] = int(cl['price'])
                            # Выбираем qty: приоритет клиентскому указанию
                            total_length = cl.get('total_length_m')
                            if total_length:
                                add_item['_total_length_m'] = float(total_length)
                            raw_mounting = cl.get('mounting_name')
                            mounting_name = raw_mounting if raw_mounting and raw_mounting.lower() != 'null' else None
                            if mounting_name:
                                add_item['_mounting_name'] = mounting_name
                                raw_mu = cl.get('mounting_unit', 'шт')
                                add_item['_mounting_unit'] = raw_mu if raw_mu and raw_mu.lower() != 'null' else 'шт'
                    except Exception as ce:
                        print(f"[edit] classify error: {ce}")
                    add_item.pop('unknown', None)

            new_items = _apply_edit_patch(prev_items, patch, price_map)

            _rules_for_sync = get_price_rules()
            _id_to_rule = {r['id']: r for r in _rules_for_sync}
            _name_to_rule = {r['name'].lower(): r for r in _rules_for_sync}
            changed_names = set()
            for p_item in patch.get('add', []) + patch.get('update', []):
                changed_names.add(p_item['name'].lower())
            for item in new_items:
                item_name_low = item['name'].lower()
                if item_name_low not in changed_names:
                    continue
                rule = _name_to_rule.get(item_name_low) or next(
                    (r for r in _rules_for_sync if r['name'].lower() == item_name_low), None
                )
                if not rule or not rule.get('mounting_id'):
                    continue
                mounting_rule = _id_to_rule.get(rule['mounting_id'])
                if not mounting_rule:
                    continue
                mount_name = mounting_rule['name']
                mount_qty = item['qty']
                existing_mount = next((it for it in new_items if it['name'].lower() == mount_name.lower()), None)
                if existing_mount:
                    if existing_mount['qty'] != mount_qty:
                        existing_mount['qty'] = mount_qty
                else:
                    new_items.append({
                        'name': mount_name,
                        'qty': mount_qty,
                        'price': mounting_rule['price'],
                        'unit': mounting_rule.get('unit') or 'шт',
                        'category': mounting_rule.get('category') or 'Услуги монтажа',
                    })

            for add_item in patch.get('add', []):
                mounting_name = add_item.get('_mounting_name')
                if not mounting_name:
                    continue
                mounting_unit = add_item.get('_mounting_unit', 'шт')
                if mounting_unit in ('пог.м', 'м') and add_item.get('_total_length_m'):
                    qty = add_item['_total_length_m']
                else:
                    qty = add_item['qty']
                db_mounting = price_map.get(mounting_name.lower()) or _find_in_price_map(mounting_name, price_map)
                mounting_price = db_mounting['price'] if db_mounting else 0
                actual_mounting_name = db_mounting['name'] if db_mounting else mounting_name
                existing = next((it for it in new_items if it['name'].lower() == actual_mounting_name.lower()), None)
                if existing:
                    existing['qty'] = round(existing['qty'] + qty, 2)
                else:
                    new_items.append({
                        'name': actual_mounting_name,
                        'qty': qty,
                        'price': mounting_price,
                        'unit': mounting_unit,
                        'category': 'Услуги монтажа',
                    })

            if _rules_for_suggestions:
                new_items = _apply_bundles(new_items, _rules_for_suggestions)

            answer = f"{comment}\n\n" + _render_estimate_from_items(new_items)
            llm_items_json = {'items': new_items, 'area': 0}
            print(f"[edit] patch applied, new items={len(new_items)}")

        except Exception as e:
            print(f"[edit] patch error: {e}, falling back to full LLM")
            prev_items = None

    if not prev_items:
        system_content += """

ОБЯЗАТЕЛЬНО: В конце каждого ответа со сметой добавь одну строку:
%%ITEMS%%{"items":[{"name":"...","qty":1,"price":0},...],"area":0}%%END%%
Включи ВСЕ позиции сметы. Клиент этот блок не видит."""

        search = web_search(last_user_text)
        if search['text']:
            system_content += f"\n\n=== АКТУАЛЬНАЯ ИНФОРМАЦИЯ ИЗ ИНТЕРНЕТА ===\n{search['text']}"

        openai_messages = [{'role': 'system', 'content': system_content}]
        for msg in messages[-6:]:
            openai_messages.append({
                'role': msg.get('role', 'user'),
                'content': msg.get('text', ''),
            })

        answer = call_llm(openai_messages)
        llm_items_json = None

    if not prev_items:
        llm_items_json = None
        items_match = re.search(r'%%ITEMS%%(.+?)%%END%%', answer, re.DOTALL)
        if items_match:
            answer = answer.replace(items_match.group(0), '').strip()
            try:
                llm_items_json = json.loads(items_match.group(1).strip())
                print(f"[items] from %%ITEMS%%: {len(llm_items_json.get('items', []))} items")
            except Exception as e:
                print(f"[items] JSON parse error: {e}")

        if not llm_items_json and ('₽' in answer or 'руб' in answer.lower()):
            try:
                struct_prompt = f"""Из текста сметы извлеки все позиции в JSON.
Отвечай ТОЛЬКО валидным JSON, без пояснений:
{{"items":[{{"name":"Название","qty":1,"price":399,"unit":"м²"}}]}}

Текст сметы:
{answer[:2000]}"""
                struct_msgs = [{'role': 'user', 'content': struct_prompt}]
                struct_answer = call_llm(struct_msgs)
                json_match = re.search(r'\{.+\}', struct_answer, re.DOTALL)
                if json_match:
                    llm_items_json = json.loads(json_match.group(0))
                    print(f"[items] from 2nd call: {len(llm_items_json.get('items', []))} items")
            except Exception as e:
                print(f"[items] 2nd call error: {e}")

        llm_items_list = llm_items_json.get('items', []) if llm_items_json else []

        if _rules_for_suggestions:
            before_bundle = len(llm_items_list)
            llm_items_list = _apply_bundles(llm_items_list, _rules_for_suggestions)
            bundles_added = len(llm_items_list) - before_bundle
        else:
            bundles_added = 0

        if llm_items_list:
            price_map_render = _build_price_map(_rules_for_suggestions) if _rules_for_suggestions else {}
            for it in llm_items_list:
                db_entry = _find_in_price_map(it.get('name', ''), price_map_render)
                if db_entry:
                    it['price'] = db_entry['price']
                    it['unit'] = db_entry.get('unit') or it.get('unit', 'шт')
            answer = _render_estimate_from_items(llm_items_list)
            print(f"[initial] rendered from items: {len(llm_items_list)} items, bundles_added={bundles_added}")
        else:
            answer = _patch_answer_with_prices(answer, llm_items_list, _rules_for_suggestions)
            answer = _apply_surcharges(answer, _rules_for_suggestions)
            answer = _recalc_totals(answer)

    try:
        if llm_items_json and llm_items_json.get('items'):
            _save_suggestions_from_json(llm_items_json['items'], last_user_text, session_id, _rules_for_suggestions)
        else:
            _extract_and_save_suggestions(answer, last_user_text, session_id, _rules_for_suggestions)
    except Exception as e:
        print(f"[suggestions] error: {e}")

    _junk = [
        r'[Кк] сожалению,? я не могу предоставить фотографи[ию][^.]*\.',
        r'[Кк] сожалению,? я не могу показать[^.]*\.',
        r'[Яя] не могу (показать|предоставить|отобразить|прикрепить)[^.]*изображени[ея][^.]*\.',
        r'[Яя] не имею возможности (показать|отображать)[^.]*\.',
        r'[Кк]ак (языковая|текстовая) модель[^.]*фото[^.]*\.',
        r'[Кк] сожалению,? у меня нет возможности[^.]*фото[^.]*\.',
        r'[Оо]днако вы можете найти примеры[^.]*на[^.]*\.',
        r'[Пп]росто введите в поиск[^.]*\.',
        r'[Нн]а таких платформах,? как[^.]*\.',
        r'[Ии]звините,?\s*но\s*(однако\s*)?',
        r'^[Оо]днако,?\s*',
        r'\s*[Оо]днако,?\s*(?=[А-ЯЁ])',
        r'[Кк] сожалению,?\s*(однако\s*)?',
        r'[Яя] должен (отметить|сказать|уточнить),?\s*(что\s*)?',
    ]
    for _p in _junk:
        answer = re.sub(_p, '', answer, flags=re.MULTILINE)
    answer = answer.strip()
    if answer:
        answer = answer[0].upper() + answer[1:]

    def split_lamp_line(text: str) -> str:
        lines_out = []
        for ln in text.split('\n'):
            m_lamp = re.match(
                r'^(\s*)(Светильники?\s+GX[-\s]?53)\s*\+\s*лампа?\s*(\d+)\s*шт\.?\s*[×xх]\s*([\d\s]+)\s*[₽Рруб](.*)$',
                ln, re.IGNORECASE
            )
            if m_lamp:
                indent, svet_name, qty, price, rest = m_lamp.groups()
                qty_i = int(qty); price_i = int(re.sub(r'\s', '', price))
                lampa_price = 100
                svet_total_i = qty_i * price_i
                lamp_total_i = qty_i * lampa_price
                lines_out.append(f"{indent}{svet_name} {qty_i} шт. × {price_i} ₽ = {svet_total_i:,} ₽".replace(',', ' '))
                lines_out.append(f"{indent}Лампа GX-53 {qty_i} шт. × {lampa_price} ₽ = {lamp_total_i:,} ₽".replace(',', ' '))
            else:
                lines_out.append(ln)
        return '\n'.join(lines_out)

    answer = split_lamp_line(answer)

    _search_images = search['images'] if 'search' in dir() and isinstance(search, dict) else []
    if _search_images and SEARCH_VISUAL.search(last_user_text):
        img_block = '\n' + '\n'.join(f"![фото]({url})" for url in _search_images)
        answer = answer + img_block

    try:
        save_correction_answer(last_user_text, session_id, answer)
    except Exception as e:
        print(f"[corrections] save_answer error: {e}")

    if brand:
        answer = apply_brand_to_text(answer, brand)

    response_body = {'answer': answer}
    if llm_items_json and llm_items_json.get('items'):
        response_body['items'] = llm_items_json['items']

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps(response_body),
    }
