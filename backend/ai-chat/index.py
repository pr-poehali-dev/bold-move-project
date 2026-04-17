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
    r"(спасибо|благодарю|спасиб|отлично|супер|\bкласс\b|👍)": "Рад помочь! Технолог приедет на замер бесплатно.\n\nЗаписаться: +7 (977) 606-89-01",
    r"(замер|выезд|приедет|технолог)": "Замер бесплатный — технолог приедет, сделает расчёт и 3D-проект.\n\n+7 (977) 606-89-01 · ежедневно 8:00–22:00",
    r"(что умеешь|как ты работаешь|что можешь|помоги|с чего начать)": "Называйте площадь комнаты и тип потолка — составлю смету с ценами по каждой позиции.\n\nПример: «Комната 20 м², матовый белый»",
    r"^(цены|прайс|расценки|прайс-лист)$": "Цены от:\n• Матовый белый — от 399 ₽/м²\n• Цветной — от 900 ₽/м²\n• Тканевый — от 2200 ₽/м²\n\nДля точного расчёта назовите площадь комнаты.",
}


_WORDS_TO_NUM = {
    'ноль': 0, 'один': 1, 'одна': 1, 'одно': 1, 'два': 2, 'две': 2,
    'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7,
    'восемь': 8, 'девять': 9, 'десять': 10, 'одиннадцать': 11,
    'двенадцать': 12, 'тринадцать': 13, 'четырнадцать': 14,
    'пятнадцать': 15, 'шестнадцать': 16, 'семнадцать': 17,
    'восемнадцать': 18, 'девятнадцать': 19, 'двадцать': 20,
    'двадцать один': 21, 'двадцать два': 22, 'двадцать три': 23,
    'двадцать четыре': 24, 'двадцать пять': 25, 'двадцать шесть': 26,
    'двадцать семь': 27, 'двадцать восемь': 28, 'двадцать девять': 29,
    'тридцать': 30, 'тридцать один': 31, 'тридцать два': 32,
    'тридцать три': 33, 'тридцать четыре': 34, 'тридцать пять': 35,
    'тридцать шесть': 36, 'тридцать семь': 37, 'тридцать восемь': 38,
    'тридцать девять': 39, 'сорок': 40, 'сорок один': 41, 'сорок два': 42,
    'сорок три': 43, 'сорок четыре': 44, 'сорок пять': 45, 'сорок шесть': 46,
    'сорок семь': 47, 'сорок восемь': 48, 'сорок девять': 49,
    'пятьдесят': 50, 'пятьдесят один': 51, 'пятьдесят два': 52,
    'пятьдесят три': 53, 'пятьдесят четыре': 54, 'пятьдесят пять': 55,
    'пятьдесят шесть': 56, 'пятьдесят семь': 57, 'пятьдесят восемь': 58,
    'пятьдесят девять': 59, 'шестьдесят': 60, 'шестьдесят один': 61,
    'шестьдесят два': 62, 'шестьдесят три': 63, 'шестьдесят четыре': 64,
    'шестьдесят пять': 65, 'шестьдесят шесть': 66, 'шестьдесят семь': 67,
    'шестьдесят восемь': 68, 'шестьдесят девять': 69, 'семьдесят': 70,
    'семьдесят один': 71, 'семьдесят два': 72, 'семьдесят три': 73,
    'семьдесят четыре': 74, 'семьдесят пять': 75, 'семьдесят шесть': 76,
    'семьдесят семь': 77, 'семьдесят восемь': 78, 'семьдесят девять': 79,
    'восемьдесят': 80, 'восемьдесят один': 81, 'восемьдесят два': 82,
    'восемьдесят три': 83, 'восемьдесят четыре': 84, 'восемьдесят пять': 85,
    'восемьдесят шесть': 86, 'восемьдесят семь': 87, 'восемьдесят восемь': 88,
    'восемьдесят девять': 89, 'девяносто': 90, 'девяносто один': 91,
    'девяносто два': 92, 'девяносто три': 93, 'девяносто четыре': 94,
    'девяносто пять': 95, 'девяносто шесть': 96, 'девяносто семь': 97,
    'девяносто восемь': 98, 'девяносто девять': 99, 'сто': 100,
}
# Сортируем по убыванию длины — составные ("тридцать пять") раньше простых ("тридцать")
_NUM_WORD_PAT = r'(\d+(?:[.,]\d+)?|' + '|'.join(sorted(_WORDS_TO_NUM, key=len, reverse=True)) + r')'

def _w2n(s: str) -> float:
    """Конвертирует строку (цифру или слово) в число."""
    s = s.lower().strip()
    if s in _WORDS_TO_NUM:
        return float(_WORDS_TO_NUM[s])
    return float(s.replace(',', '.'))


def try_simple_estimate(text: str) -> str | None:
    """Детерминированный расчёт сметы: площадь + светильники + люстра + ниши + парящий профиль."""
    t = text.lower()

    # Не перехватываем сложные случаи — отдаём в LLM
    has_complex = re.search(
        r'(лента|двухуровн|керамогран|вентил|блок питани|парящ'
        r'|теневой|тенев|краб|плитк|диффузор|дифузор'
        r'|без монт|без\s+монт|вклейк|высота)',
        t
    )
    if has_complex:
        print(f"[calc] skip: complex keyword in '{t[:60]}'")
        return None

    # Ищем площадь — цифрой или словом
    m = re.search(_NUM_WORD_PAT + r'\s*(?:м²|м2|кв\.?\s*м?|квадрат|кв\b)', t)
    if not m:
        print(f"[calc] skip: no area in '{t[:60]}'")
        return None
    area = _w2n(m.group(1))
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

    # Загружаем ВСЕ позиции из БД — цены + правила
    _rules = get_price_rules()
    _by_name = {r['name']: r for r in _rules}

    def p(name: str, fallback: int) -> int:
        """Цена позиции из БД, с fallback если не найдена."""
        return int(_by_name[name]['price']) if name in _by_name else fallback

    # ─── ЦЕНЫ ИЗ БД (с fallback на старые значения) ────────────────────────
    price_raskroy        = p('Раскрой ПВХ', 100)
    price_ogarp          = p('Огарпунивание ПВХ', 100)
    price_profile        = p('Стеновой алюминий', 200)
    price_zakl_lyustra   = p('Закладная под люстру', 700)
    price_zakl_svet      = p('Закладная под светильник', 350)
    price_svetilnik      = p('Светильник GX-53 + лампа', 400)
    price_lampa          = p('Лампа GX53', 100)
    price_mount_pvh      = p('Монтаж полотна ПВХ', 350)
    price_mount_tkань    = p('Монтаж полотна ТКАНЬ', 500)
    price_mount_profile  = p('Монтаж профиля стандарт', 200)
    price_mount_nisha    = p('Монтаж парящего профиля', 350)
    price_mount_zakl     = p('Монтаж закладной', 350)
    price_mount_svet     = p('Монтаж светильника GX53', 500)
    price_mount_razv     = p('Монтаж разводки ГОСТ 0.75', 700)

    # Светильники GX-53 — суммируем ВСЕ числа (цифры и слова)
    all_svet_nums = re.findall(_NUM_WORD_PAT + r'\s*(?:точечн\w*\s*)?(?:светильник|gx.?53|вклейк)', t)
    all_svet_nums += re.findall(r'добавить\s+(?:ещё\s+)?' + _NUM_WORD_PAT + r'\s*(?:точечн|светильник)?', t)
    n_svetilnik = sum(int(_w2n(x)) for x in all_svet_nums)

    # Люстра — цифрой или словом
    lyustra_m = re.search(_NUM_WORD_PAT + r'?\s*люстр', t)
    if lyustra_m and lyustra_m.group(1):
        n_lyustra = int(_w2n(lyustra_m.group(1)))
    else:
        n_lyustra = 1 if lyustra_m else 0

    print(f"[calc] area={area} perim={perim} canvas={canvas_key} n_lyustra={n_lyustra} n_svetilnik={n_svetilnik} svet_raw={all_svet_nums}")

    # Ниша для штор — «ниша», «карниз», «штора», «карниз возле шторы»
    has_nisha = bool(re.search(r'ниш[аеуы]?\s*(?:для\s*штор)?|карниз|шторн|штор[аыуе]', t))

    # Длина ниши: явная (цифра или слово) или дефолт из calc_rule БД
    nisha_len_m = re.search(_NUM_WORD_PAT + r'\s*(?:м|пм|погон)\s+(?:ниш|шторн)', t) or \
                  re.search(r'ниш[аеуы]?\s+(?:для\s+штор\s+)?(?:пк[- ]?\d+\s+)?' + _NUM_WORD_PAT + r'\s*(?:м|пм|погон)', t)
    if nisha_len_m:
        nisha_len = _w2n(nisha_len_m.group(1))
    else:
        _nisha_rule_item = next((r for r in _rules if r['category'] == 'Ниши для штор' and r['calc_rule']), None)
        _nisha_default = eval_calc_rule(
            _nisha_rule_item['calc_rule'] if _nisha_rule_item else 'perimeter*0.25',
            area, perim
        )
        nisha_len = round(_nisha_default if _nisha_default is not None else perim * 0.25, 1)

    # Тип и цена ниши — ищем сначала в БД по имени, fallback на хардкод
    nisha_price = 0
    nisha_label = ''
    if has_nisha:
        pk_m = re.search(r'пк[- ]?(\d+)', t)
        pk = int(pk_m.group(1)) if pk_m else 0
        if pk in (12, 14, 15):
            nisha_price = p(f'ПК-{pk}', 3600); nisha_label = f'ПК-{pk}'
        elif pk == 6:
            nisha_price = p('Парящий ПК-6', 1300); nisha_label = 'Парящий ПК-6'
        elif re.search(r'sigma\s*led', t):
            nisha_price = p('Sigma LED', 1650); nisha_label = 'Sigma LED'
        elif re.search(r'sigma', t):
            nisha_price = p('Sigma', 1400); nisha_label = 'Sigma'
        elif re.search(r'брус|бп.?40', t):
            nisha_price = p('Брус БП-40', 850); nisha_label = 'Брус БП-40'
        else:
            nisha_price = p('Ниша без перегиба', 1700); nisha_label = 'Ниша без перегиба'

    # ─── РАСЧЁТ ───────────────────────────────────────────────────────────────
    # 1. Полотно
    canvas_total = round(area * canvas_price)
    raskroy      = round(area * price_raskroy) if is_pvh else 0
    ogarp        = round(area * price_ogarp) if is_pvh else 0

    # 2. Профиль (вычитаем длину ниши если она заменяет стандартный профиль)
    is_nisha_special = has_nisha and nisha_price >= 1300
    profile_len   = max(0, round(perim - (nisha_len if is_nisha_special else 0), 1))
    profile_total = round(profile_len * price_profile)
    nisha_total   = round(nisha_len * nisha_price) if has_nisha else 0

    # 3. Закладные
    zakl_lyustra = n_lyustra * price_zakl_lyustra
    zakl_svet    = n_svetilnik * price_zakl_svet
    zakl_total   = zakl_lyustra + zakl_svet

    # 4. Освещение
    svet_total  = n_svetilnik * price_svetilnik
    lampa_total = n_svetilnik * price_lampa

    # 5. Монтаж
    price_mount_canvas = price_mount_pvh if is_pvh else price_mount_tkань
    mount_canvas  = round(area * price_mount_canvas)
    mount_profile = round(profile_len * price_mount_profile)
    mount_nisha   = round(nisha_len * price_mount_nisha) if has_nisha else 0
    mount_zakl    = (n_lyustra + n_svetilnik) * price_mount_zakl if (n_lyustra + n_svetilnik) > 0 else 0
    mount_svet    = n_svetilnik * price_mount_svet
    mount_razv    = n_svetilnik * price_mount_razv if n_svetilnik > 0 else 0

    standard = (canvas_total + raskroy + ogarp + profile_total + nisha_total +
                zakl_total + svet_total + lampa_total +
                mount_canvas + mount_profile + mount_nisha + mount_zakl + mount_svet + mount_razv)

    def fmt(n): return f"{n:,}".replace(',', ' ')

    # ─── ВЫВОД ────────────────────────────────────────────────────────────────
    sec = 1
    lines = []

    # Полотно
    lines.append(f"{sec}. Полотно:")
    lines.append(f"  {canvas_name} {area} м² × {canvas_price} ₽ = {fmt(canvas_total)} ₽")
    if is_pvh:
        lines.append(f"  Раскрой ПВХ {area} м² × {price_raskroy} ₽ = {fmt(raskroy)} ₽")
        lines.append(f"  Огарпунивание {area} м² × {price_ogarp} ₽ = {fmt(ogarp)} ₽")

    # Профиль
    sec += 1
    lines.append(f"\n{sec}. Профиль:")
    lines.append(f"  Стеновой алюминиевый {profile_len} мп × {price_profile} ₽ = {fmt(profile_total)} ₽")

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
            lines.append(f"  Под люстру {n_lyustra} шт. × {price_zakl_lyustra} ₽ = {fmt(zakl_lyustra)} ₽")
        if n_svetilnik > 0:
            lines.append(f"  Под светильники {n_svetilnik} шт. × {price_zakl_svet} ₽ = {fmt(zakl_svet)} ₽")

    # Освещение
    if svet_total > 0:
        sec += 1
        lines.append(f"\n{sec}. Освещение:")
        lines.append(f"  Светильники GX-53 {n_svetilnik} шт. × {price_svetilnik} ₽ = {fmt(svet_total)} ₽")
        lines.append(f"  Лампа GX-53 {n_svetilnik} шт. × {price_lampa} ₽ = {fmt(lampa_total)} ₽")

    # Монтаж
    sec += 1
    lines.append(f"\n{sec}. Услуги монтажа:")
    lines.append(f"  Монтаж полотна {'ПВХ' if is_pvh else 'ткань'} {area} м² × {price_mount_canvas} ₽ = {fmt(mount_canvas)} ₽")
    lines.append(f"  Монтаж профиля {profile_len} мп × {price_mount_profile} ₽ = {fmt(mount_profile)} ₽")
    if has_nisha:
        lines.append(f"  Монтаж ниши {nisha_len} мп × {price_mount_nisha} ₽ = {fmt(mount_nisha)} ₽")
    if mount_zakl > 0:
        lines.append(f"  Монтаж закладных {n_lyustra + n_svetilnik} шт. × {price_mount_zakl} ₽ = {fmt(mount_zakl)} ₽")
    if mount_svet > 0:
        lines.append(f"  Монтаж светильников {n_svetilnik} шт. × {price_mount_svet} ₽ = {fmt(mount_svet)} ₽")
    if mount_razv > 0:
        lines.append(f"  Монтаж разводки ГОСТ {n_svetilnik} шт. × {price_mount_razv} ₽ = {fmt(mount_razv)} ₽")

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

ВАЖНО: Все названия позиций и цены берёшь СТРОГО из блока "АКТУАЛЬНЫЙ ПРАЙС-ЛИСТ" ниже.
Не используй никакие другие цены кроме тех что в прайс-листе.
Если позиции нет в прайс-листе — её не существует, не выдумывай.

ПРАВИЛА РАСЧЁТА ПРОФИЛЯ:
- Периметр = 1.3 × площадь если не указан клиентом
- Стандартный профиль = периметр МИНУС длина теневого/парящего
- Теневой классик / klassika / классика = позиция "Теневой классик (Flexy KLASSIKA 140)" из прайса
- НЕ добавляй одновременно стандартный и теневой на одну и ту же длину

ПРАВИЛА ПО ЗАКЛАДНЫМ:
- Добавляй ТОЛЬКО тот тип закладной который указал клиент или логически следует
- Люстра без уточнения = "Под люстру планка" (только этот тип, 1 шт на 1 люстру)
- Точечный светильник / GX-53 / вклейка / "добавить светильник" = "Под светильник ∅90" (только этот тип)
- "4 точечных + добавить 4" = 8 шт "Под светильник ∅90"
- НИКОГДА не добавляй все виды закладных сразу — только нужный тип
- Если есть закладные "Под светильник ∅90" → в Услугах монтажа: "Монтаж светильников GX-53" × кол-во

ПРАВИЛА ПО НИШАМ (блок "Ниши"):
- "Карниз" / "ниша для шторы" / "штора" / "карниз возле шторы" = добавляй "Ниша без перегиба" в метрах
- Если длина ниши не указана — используй 1/4 периметра потолка (одна сторона комнаты)
- Монтаж ниши = в блоке "Услуги монтажа" как "Монтаж профиля" × длина ниши
- НИКОГДА не путай нишу для карниза с теневым профилем — это разные вещи

ПРАВИЛА ПО ОСТАЛЬНОМУ:
- ПВХ полотно: Раскрой и Огарпунивание идут ВНУТРИ блока "Полотно" (не отдельный блок)
- Ткань: + Монтаж полотна ТКАНЬ (без раскроя и огарпунивания)
- Лента кратна 5м: нужно 6м → 2 катушки (10м)
- Монтаж разводки ГОСТ 0.75 = добавлять ТОЛЬКО если есть точечные светильники (1 точка = 1.5 пог.м)
- НЕ добавляй Монтаж разводки ГОСТ если светильников нет в смете
- Каждой позиции — свой монтаж ТОЛЬКО в последнем блоке "Услуги монтажа"
- Парящий без уточнения = Flexy FLY 02
- Световые линии = вид профиля (теневой или парящий)
- "Высота имеется частями" = "Работы на высоте (до 4м)", 1 шт — идёт отдельным блоком
- "Без монта" = НЕ добавлять монтаж к этой позиции

ОГРАНИЧЕНИЯ:
- СТРОГО: добавляй только позиции которые явно указал клиент
- Не задавай уточняющих вопросов до расчёта — считай по данным
- Не пиши более 44 символов в одной строке
- Не показывай клиенту формулу расчёта периметра
- НИКОГДА не указывай ссылки, URL и гиперссылки
- НИКОГДА не рекомендуй сторонние сайты, студии или компании — только mospotolki.net
- НИКОГДА не пиши "предварительный расчёт" или "точную стоимость назовёт технолог"
- Не предлагай искать фото или каталоги на других ресурсах

ФОРМАТ ОТВЕТА — СТРОГО отдельными блоками, каждый с заголовком и пустой строкой между:

1. Полотно:
[полотно + раскрой + огарпунивание — всё здесь]

2. Профиль:
[стандартный профиль и/или теневой и/или парящий — всё здесь]

3. Закладные:   ← только если есть
[закладные]

4. Освещение:   ← только если есть
[светильники, лента, блоки питания]

5. Ниши:        ← только если есть
[ниши для штор]

N. Работы на высоте:  ← только если есть
[высота]

Последний блок ВСЕГДА:
N. Услуги монтажа:
[монтаж КАЖДОЙ позиции из всех блоков выше]

ВАЖНО: каждый блок — отдельный заголовок. Никогда не смешивай позиции из разных категорий в одном блоке!

Итоговая стоимость — 3 варианта:
Econom: X ₽
Standard: X ₽
Premium: X ₽

Финальная фраза ВСЕГДА:
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

    # Загружаем базу знаний и цены из БД
    knowledge = get_knowledge(last_user_text)
    system_content = get_system_prompt(fallback=SYSTEM_PROMPT)
    prices_block = get_prices_block()
    if prices_block:
        system_content += f"\n\n=== АКТУАЛЬНЫЙ ПРАЙС-ЛИСТ ==={prices_block}"
    if knowledge:
        system_content += f"\n\n=== БАЗА ЗНАНИЙ ===\n{knowledge}"

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