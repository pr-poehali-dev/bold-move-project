"""AI-помощник MOSPOTOLKI — отвечает на вопросы о натяжных потолках и считает стоимость. v3."""

import json
import os
import re
import requests
import psycopg2

from services import generate_image, web_search, call_llm, SEARCH_VISUAL, IMAGE_GEN
from db import (
    get_knowledge, get_system_prompt, get_faq_cache,
    get_prices_block, get_canvas_prices, get_price_rules,
    build_rules_prompt, eval_calc_rule, CANVAS_PRICES,
)

# Встроенный кэш частых вопросов (fallback если БД недоступна)
FAQ_CACHE = {
    r"(гарантия|сколько служит|срок службы)": "Гарантия — 10 лет. Срок службы полотна — 25–30 лет.\n\nЗаписаться на замер: +7 (977) 606-89-01",
    r"(сколько времени|как долго|срок монтаж|когда будет готов|сколько дней)": "Монтаж комнаты — 1–3 часа. Готово в день замера или через 1–3 рабочих дня.\n\n+7 (977) 606-89-01",
    r"(телефон|номер|контакт|связаться|позвонить|whatsapp|вотсап|telegram|телеграм)": "📞 +7 (977) 606-89-01\n💬 wa.me/79776068901\n✈️ @JoniKras\nЕжедневно 8:00–22:00",
    r"(адрес|офис|шоурум|где находит|мытищ)": "Работаем по Москве и МО. Офис — Мытищи.\nАдрес пришлём при записи: +7 (977) 606-89-01",
    r"(скидк|акци|промокод|дешевле)": "Актуальные акции — у менеджера: +7 (977) 606-89-01\n\nНазовите площадь — рассчитаю стоимость прямо сейчас.",
    r"(привет|здравствуй|добрый день|добрый вечер|добрый утр|здаров|хай|hi\b|hello)": "Привет! Я AI-сметчик MosPotolki.\n\nНазовите площадь комнаты и тип потолка — сделаю расчёт за секунду.",
    r"(спасибо|благодарю|спасиб|отлично|супер|класс|👍)": "Рад помочь! Технолог приедет на замер бесплатно.\n\nЗаписаться: +7 (977) 606-89-01",
    r"(замер|выезд|приедет|технолог)": "Замер бесплатный — технолог приедет, сделает расчёт и 3D-проект.\n\n+7 (977) 606-89-01 · ежедневно 8:00–22:00",
    r"(что умеешь|как ты работаешь|что можешь|помоги|с чего начать)": "Называйте площадь комнаты и тип потолка — составлю смету с ценами по каждой позиции.\n\nПример: «Комната 20 м², матовый белый»",
    r"^(цены|прайс|расценки|прайс-лист)$": "Цены от:\n• Матовый белый — от 399 ₽/м²\n• Цветной — от 900 ₽/м²\n• Тканевый — от 2200 ₽/м²\n\nДля точного расчёта назовите площадь комнаты.",
}


def try_simple_estimate(text: str) -> str | None:
    """Детерминированный расчёт сметы: площадь + светильники + люстра + ниши + парящий профиль."""
    t = text.lower()

    # Не перехватываем сложные случаи: лента, двухуровневые, керамогранит
    has_complex = re.search(r'(лента|двухуровн|керамогран|теневой|вентил|блок питани)', t)
    if has_complex:
        print(f"[calc] skip: complex keyword in '{t[:60]}'")
        return None

    # Ищем площадь — обязательный параметр (кв, кв.м, м², квадратов, просто число + "кв")
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:м²|м2|кв\.?\s*м?|квадрат|кв\b)', t)
    if not m:
        print(f"[calc] skip: no area in '{t[:60]}'")
        return None
    area = float(m.group(1).replace(',', '.'))
    if area < 1 or area > 500:
        return None

    # Тип полотна
    canvas_key = 'classic'
    if re.search(r'(ткань|тканев|дескор)', t):
        canvas_key = 'ткань'
    elif re.search(r'цветн', t):
        canvas_key = 'цветной'
    elif re.search(r'(bauf|бауф|немецк)', t):
        canvas_key = 'bauf'
    elif re.search(r'(evolution|эволюц)', t):
        canvas_key = 'evolution'
    elif re.search(r'(premium|премиум)', t):
        canvas_key = 'premium'

    _prices = get_canvas_prices()
    canvas_name, canvas_price = _prices.get(canvas_key, CANVAS_PRICES.get(canvas_key, ('MSD Classic матовый', 399)))
    perim = round(area * 1.3, 1)
    is_pvh = canvas_key != 'ткань'

    # Загружаем правила из БД
    _rules = get_price_rules()
    _id_to_rule = {r['name']: r for r in _rules}

    # Светильники GX-53
    svetilnik_m = re.search(r'(\d+)\s*светильник', t)
    n_svetilnik = int(svetilnik_m.group(1)) if svetilnik_m else 0

    # Комплект к светильнику из БД
    _svet_rule = _id_to_rule.get('Светильник GX-53 + лампа', {})
    _svet_bundle_ids = []
    try:
        _svet_bundle_ids = json.loads(_svet_rule.get('bundle', '[]'))
    except Exception:
        pass
    # Добавляем позиции из комплекта к светильнику
    _bundle_extra = {}  # name -> (qty, price)
    if n_svetilnik > 0 and _svet_bundle_ids:
        for _bid in _svet_bundle_ids:
            _br = next((r for r in _rules if r['id'] == _bid), None)
            if _br:
                _bqty_rule = eval_calc_rule(_br['calc_rule'], area, perim)
                _bqty = int(_bqty_rule) if _bqty_rule is not None else n_svetilnik
                _bundle_extra[_br['name']] = (_bqty * n_svetilnik, _br['price'])

    # Люстра
    lyustra_m = re.search(r'(\d+)?\s*люстр', t)
    n_lyustra = int(lyustra_m.group(1)) if (lyustra_m and lyustra_m.group(1)) else (1 if lyustra_m else 0)

    # Ниша для штор — ищем метраж или берём дефолт из правила БД
    has_nisha = bool(re.search(r'ниш[аеуы]?\s*(?:для\s*штор)?', t))

    # Длина ниши: ищем "X м ниша" или "ниша X м" или дефолт из calc_rule
    nisha_len_m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:м|пм|погон)\s+(?:ниш|шторн)', t) or \
                  re.search(r'ниш[аеуы]?\s+(?:для\s+штор\s+)?(?:пк[- ]?\d+\s+)?(\d+(?:[.,]\d+)?)\s*(?:м|пм|погон)', t)
    if nisha_len_m:
        nisha_len = float(nisha_len_m.group(1).replace(',', '.'))
    else:
        # Берём правило из БД для первой категории "Ниши для штор"
        _nisha_rule_item = next((r for r in _rules if r['category'] == 'Ниши для штор' and r['calc_rule']), None)
        _nisha_default = eval_calc_rule(
            _nisha_rule_item['calc_rule'] if _nisha_rule_item else 'perimeter*0.25',
            area, perim
        )
        nisha_len = round(_nisha_default if _nisha_default is not None else perim * 0.25, 1)

    # Тип ниши
    nisha_price = 0
    nisha_label = ''
    if has_nisha:
        pk_m = re.search(r'пк[- ]?(\d+)', t)
        pk = int(pk_m.group(1)) if pk_m else 0
        if pk in (12, 14, 15):
            nisha_price = 3600
            nisha_label = f'ПК-{pk}'
        elif pk == 6:
            nisha_price = 1300
            nisha_label = 'Парящий ПК-6'
        elif re.search(r'sigma\s*led', t):
            nisha_price = 1650; nisha_label = 'Sigma LED'
        elif re.search(r'sigma', t):
            nisha_price = 1400; nisha_label = 'Sigma'
        elif re.search(r'брус|бп.?40', t):
            nisha_price = 850; nisha_label = 'Брус БП-40'
        else:
            nisha_price = 1700; nisha_label = 'Стандартная'

    # ─── РАСЧЁТ ───────────────────────────────────────────────────────────────
    # 1. Полотно
    canvas_total  = round(area * canvas_price)
    raskroy       = round(area * 100) if is_pvh else 0
    ogarp         = round(area * 100) if is_pvh else 0

    # 2. Профиль (вычитаем длину ниши из стандартного, если она парящая/ПК)
    is_nisha_special = has_nisha and nisha_price >= 1300  # ПК-12/14/15/парящий
    profile_len = max(0, round(perim - (nisha_len if is_nisha_special else 0), 1))
    profile_total = round(profile_len * 200)
    nisha_total   = round(nisha_len * nisha_price) if has_nisha else 0

    # 3. Закладные
    zakl_lyustra   = n_lyustra * 700
    zakl_svet      = n_svetilnik * 350
    zakl_total     = zakl_lyustra + zakl_svet

    # 4. Освещение (светильники GX-53 + лампы отдельно)
    svet_total  = n_svetilnik * 400
    lampa_total = n_svetilnik * 100

    # 5. Монтаж
    mount_canvas   = round(area * (350 if is_pvh else 500))
    mount_profile  = round(profile_len * 200)
    mount_nisha    = round(nisha_len * 350) if has_nisha else 0
    mount_zakl     = (n_lyustra + n_svetilnik) * 350 if (n_lyustra + n_svetilnik) > 0 else 0
    mount_svet     = n_svetilnik * 500
    mount_razv     = (n_lyustra + n_svetilnik) * 700 if (n_lyustra + n_svetilnik) > 0 else 0

    standard = (canvas_total + raskroy + ogarp + profile_total + nisha_total +
                zakl_total + svet_total + lampa_total +
                mount_canvas + mount_profile + mount_nisha + mount_zakl + mount_svet + mount_razv)
    econom        = round(standard * 0.77)
    premium_price = round(standard * 1.27)

    def fmt(n): return f"{n:,}".replace(',', ' ')

    # ─── ВЫВОД ────────────────────────────────────────────────────────────────
    sec = 1
    lines = []

    # Полотно
    lines.append(f"{sec}. Полотно:")
    lines.append(f"  {canvas_name} {area} м² × {canvas_price} ₽ = {fmt(canvas_total)} ₽")
    if is_pvh:
        lines.append(f"  Раскрой ПВХ {area} м² × 100 ₽ = {fmt(raskroy)} ₽")
        lines.append(f"  Огарпунивание {area} м² × 100 ₽ = {fmt(ogarp)} ₽")

    # Профиль
    sec += 1
    lines.append(f"\n{sec}. Профиль:")
    lines.append(f"  Стеновой алюминиевый {profile_len} мп × 200 ₽ = {fmt(profile_total)} ₽")

    # Ниша
    if has_nisha:
        sec += 1
        lines.append(f"\n{sec}. Ниши для штор:")
        lines.append(f"  Ниша {nisha_label} {nisha_len} мп × {nisha_price} ₽ = {fmt(nisha_total)} ₽")

    # Закладные
    if zakl_total > 0:
        sec += 1
        lines.append(f"\n{sec}. Закладные:")
        if n_lyustra > 0:
            lines.append(f"  Под люстру {n_lyustra} шт. × 700 ₽ = {fmt(zakl_lyustra)} ₽")
        if n_svetilnik > 0:
            lines.append(f"  Под светильники {n_svetilnik} шт. × 350 ₽ = {fmt(zakl_svet)} ₽")

    # Освещение
    if svet_total > 0:
        sec += 1
        lines.append(f"\n{sec}. Освещение:")
        lines.append(f"  Светильники GX-53 {n_svetilnik} шт. × 400 ₽ = {fmt(svet_total)} ₽")
        lines.append(f"  Лампа GX-53 {n_svetilnik} шт. × 100 ₽ = {fmt(lampa_total)} ₽")

    # Монтаж
    sec += 1
    lines.append(f"\n{sec}. Услуги монтажа:")
    lines.append(f"  Монтаж полотна {'ПВХ' if is_pvh else 'ткань'} {area} м² × {350 if is_pvh else 500} ₽ = {fmt(mount_canvas)} ₽")
    lines.append(f"  Монтаж профиля {profile_len} мп × 200 ₽ = {fmt(mount_profile)} ₽")
    if has_nisha:
        lines.append(f"  Монтаж ниши {nisha_len} мп × 350 ₽ = {fmt(mount_nisha)} ₽")
    if mount_zakl > 0:
        lines.append(f"  Монтаж закладных {n_lyustra + n_svetilnik} шт. × 350 ₽ = {fmt(mount_zakl)} ₽")
    if mount_svet > 0:
        lines.append(f"  Монтаж светильников {n_svetilnik} шт. × 500 ₽ = {fmt(mount_svet)} ₽")
    if mount_razv > 0:
        lines.append(f"  Монтаж разводки ГОСТ {n_lyustra + n_svetilnik} шт. × 700 ₽ = {fmt(mount_razv)} ₽")

    lines.append(f"\nEconom:   {fmt(econom)} ₽")
    lines.append(f"Standard: {fmt(standard)} ₽")
    lines.append(f"Premium:  {fmt(premium_price)} ₽")
    lines.append(f"\nНа какой день вас записать на бесплатный замер?")

    return '\n'.join(lines)


def get_cached_answer(text: str) -> str | None:
    """Проверяет кэш и простой расчёт. Возвращает ответ или None."""
    text_lower = text.lower().strip()

    # Сначала пробуем простой расчёт по площади
    estimate = try_simple_estimate(text_lower)
    print(f"[calc] text='{text_lower[:80]}' estimate={'YES' if estimate else 'NO'}")
    if estimate:
        return estimate

    # Потом — кэш FAQ (из БД или fallback)
    dynamic_cache = get_faq_cache(fallback=FAQ_CACHE)
    for pattern, answer in dynamic_cache.items():
        if re.search(pattern, text_lower):
            return answer
    return None


SYSTEM_PROMPT = """Ты сметчик-технолог компании MosPotolki (натяжные потолки, Мытищи, с 2009г). Отвечай по-русски. Тел:+7(977)606-89-01.

ЦЕНЫ (₽):

ПОЛОТНА (за м²):
MSD Classic матовый — 399
MSD Premium матовый — 460
MSD Evolution матовый — 490
BAUF Германия матовый — 499
Цветной матовый MSD — 900
Тканевый ДЕСКОР Германия — 2200
Раскрой ПВХ — 100/м²
Огарпунивание ПВХ — 100/м²

ПРОФИЛЬ СТАНДАРТНЫЙ (за пм):
Стеновой ПВХ — 150
Стеновой алюминий — 200
Потолочный алюминий — 200

ТЕНЕВОЙ ПРОФИЛЬ (за пм):
EuroKRAAB стеновой — 550
EuroKRAAB потолочный — 550
Теневой с подсветкой — 750

ПАРЯЩИЙ ПРОФИЛЬ (за пм):
Парящий ПК-6 без рассеивателя — 1300
Парящий FLEXY с рассеивателем — 1450
Flexy FLY 02 — 1450 (по умолчанию если парящий не указан)

НИШИ ДЛЯ ШТОР (за пм):
Брус БП-40 — 850
Sigma — 1400
Sigma LED — 1650
Ниша без перегиба — 1700
Ниша с перегибом — 1900
Ниша ПК-12 (3 ряда) — 3600
Ниша ПК-15 (2 ряда) — 3600
SLOTT MADERNO 40 — 5200
SLOTT MADERNO 60 — 5500
SLOTT MADERNO 80 — 5800

ДВУХУРОВНЕВЫЕ (за пм):
ПП-75 — 500
Apply с подсветкой — 1400

ЗАКЛАДНЫЕ (за шт):
Под светильник ∅90 — 350
Под светильник ∅100-300 — 450
Под светильник ∅300-600 — 600
Под накладной — 500
Под квадратный — 950
Под нестандартный — 1500
Под вытяжку ∅100-150 — 500
Под люстру крюк — 500
Под люстру планка — 700
Под люстру крестовина — 1400

ОСВЕЩЕНИЕ:
Светильник GX-53 + лампа — 400/шт
Лента QF Premium 5м — 4000/катушка
Лента QF MIX 5м — 7000/катушка
Блок питания 100 Вт — 3500
Блок питания 200 Вт — 5000
Блок питания 400 Вт — 7000

УСЛУГИ МОНТАЖА:
Монтаж полотна ПВХ — 350/м²
Монтаж полотна ТКАНЬ — 500/м²
Монтаж профиля стандарт — 200/пм
Монтаж теневого профиля — 350/пм
Монтаж парящего профиля — 350/пм
Монтаж закладной — 350/шт
Монтаж разводки ГОСТ 0.75 — 700/шт (1 точка = 1.5 пм)
Монтаж ленты — 350/пм
Монтаж блока питания — 500/шт
Монтаж по керамограниту — 500/пм

ПРАВИЛА РАСЧЁТА:
- Периметр = 1.3 × площадь (если не указан клиентом). Профиль ≥ периметра
- ПВХ полотно: ВСЕГДА добавь Раскрой + Огарпунивание + Монтаж полотна ПВХ
- Ткань: добавь Монтаж полотна ТКАНЬ
- Каждой позиции — монтаж. Все монтажи в одном блоке "Услуги монтажа"
- Лента кратна 5м: нужно 6м → выписывай 10м (бухты по 5м)
- Теневой/Парящий: их метраж ВЫЧЕСТЬ из стандартного алюминиевого профиля
- Парящий без уточнения = Flexy FLY 02
- Световые линии = вид профиля (теневой или парящий)
- Парящий для подсветки: добавь ленту и блоки питания в блок Освещение
- При наличии освещения добавлять Монтаж разводки ГОСТ 0.75 (1 точка = 1.5 пм)
- Закладная под шкаф = Брус БП-40
- Теневой ПРОФИЛЬ (EuroKRAAB) ≠ теневой ВЕНТИЛЯТОР (Монолит) — различай!
- Не пропускай позиции! Есть позиция — есть монтаж.

ОГРАНИЧЕНИЯ:
- Не добавляй позиции которые не указаны клиентом
- Не задавай уточняющих вопросов до расчёта
- Не показывай клиенту формулу расчёта периметра
- Не пиши более 44 символов в одной строке
- Не показывай логику: (название) — (кол-во) × (цена) = (сумма)
- Не искажай стоимость и не пропускай позиции
- НИКОГДА не указывай ссылки, URL и гиперссылки в ответе — ни при каких условиях
- НИКОГДА не рекомендуй сторонние сайты, студии, каталоги или компании — только mospotolki.net
- НИКОГДА не пиши фразу про "предварительный расчёт" и "точную стоимость назовёт технолог" — это запрещено
- Не предлагай искать фото, примеры или каталоги на других ресурсах

ФОРМАТ ОТВЕТА:
Блоками с пропуском между ними. Нумеруй заголовки:
1. Полотно:
2. Профиль:
3. Освещение:
4. Ниши для штор:
5. Услуги монтажа:

Итоговая стоимость — 3 варианта:
Econom: X ₽  (−23% от Standard, без указания процента)
Standard: X ₽
Premium: X ₽  (+27% от Standard, без указания процента)

Финальная фраза после сметы ВСЕГДА:
"На какой день вас записать на бесплатный замер?"

КОМПАНИЯ: MosPotolki, Мытищи, с 2009г. Тел: +7(977)606-89-01. Ежедневно 8:00–22:00. Сайт: mospotolki.net
"""


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

    if not messages:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'No messages provided'})}

    # Кэш: отвечаем мгновенно без вызова LLM
    last_user_text = ''
    for msg in reversed(messages):
        if msg.get('role') == 'user':
            last_user_text = msg.get('text', '')
            break

    cached = get_cached_answer(last_user_text)
    if cached:
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'answer': cached})}

    # Загружаем базу знаний, цены и правила из БД
    knowledge = get_knowledge(last_user_text)
    system_content = get_system_prompt(fallback=SYSTEM_PROMPT)
    prices_block = get_prices_block()
    if prices_block:
        system_content += f"\n\n=== АКТУАЛЬНЫЙ ПРАЙС-ЛИСТ (ПРИОРИТЕТ НАД ВСТРОЕННЫМ) ==={prices_block}"
    rules = get_price_rules()
    rules_block = build_rules_prompt(rules)
    if rules_block:
        system_content += rules_block
    if knowledge:
        system_content += f"\n\n=== БАЗА ЗНАНИЙ О ТОВАРАХ И ЦЕНАХ ===\n{knowledge}"

    # Веб-поиск для актуальной информации
    search = web_search(last_user_text)
    if search['text']:
        system_content += f"\n\n=== АКТУАЛЬНАЯ ИНФОРМАЦИЯ ИЗ ИНТЕРНЕТА ===\n{search['text']}\nИспользуй эти данные для ответа, указывай источники если уместно."

    # Передаём только последние 6 сообщений — экономим токены
    openai_messages = [{'role': 'system', 'content': system_content}]
    for msg in messages[-6:]:
        openai_messages.append({
            'role': msg.get('role', 'user'),
            'content': msg.get('text', ''),
        })

    answer = call_llm(openai_messages)

    # Убираем мусорные фразы от LLM
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

    # Разбиваем "Светильники GX-53 + лампа N шт × P = T" на две строки
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

    # Картинки из Tavily — только для запросов про тренды/вдохновение
    print(f"[img] query='{last_user_text[:60]}' tavily_images={len(search['images'])} visual={bool(SEARCH_VISUAL.search(last_user_text))} imagegen={bool(IMAGE_GEN.search(last_user_text))}")
    if search['images'] and SEARCH_VISUAL.search(last_user_text):
        img_block = '\n' + '\n'.join(f"![фото]({url})" for url in search['images'])
        answer = answer + img_block

    # Генерация дизайна через FLUX — временно отключена
    # if IMAGE_GEN.search(last_user_text):
    #     gen_url = generate_image(last_user_text)
    #     print(f"[flux] gen_url={gen_url}")
    #     if gen_url:
    #         answer = answer + f"\n\n![сгенерированный дизайн]({gen_url})"

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'answer': answer}),
    }