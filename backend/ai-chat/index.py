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
    build_rules_prompt, eval_calc_rule, save_correction, CANVAS_PRICES, SCHEMA,
    get_llm_threshold, get_complex_exceptions,
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


_COMPLEX_WORDS = [
    'лента', 'двухуровн', 'керамогран', 'вентил', 'блок питани', 'парящ',
    'теневой', 'тенев', 'краб', 'плитк', 'диффузор', 'дифузор',
    'без монт', 'вклейк',
]
_COMPLEX_PAT = re.compile(r'(' + '|'.join(re.escape(w) for w in _COMPLEX_WORDS) + r')')
# Паттерн для захвата полного слова содержащего стоп-подстроку
_FULL_WORD_PAT = re.compile(r'[а-яёa-z0-9]+(?:[- ][а-яёa-z0-9]+)*', re.IGNORECASE)
# Нумерованный список позиций — всегда в LLM (слишком сложная структура для regex)
_NUMBERED_LIST_PAT = re.compile(r'\b[1-9]\s*[\.\)]\s+\S', re.IGNORECASE)

# Паттерны «известных» частей запроса — то что бот уже умеет считать/игнорировать
_KNOWN_PARTS_PAT = re.compile(
    r'\d+(?:[.,]\d+)?\s*(?:м²|м2|кв\.?\s*м?|квадрат|кв\b)'  # площадь
    r'|(?:однушка|двушка|трёшка|студия|комната|зал|спальня|кухня|коридор|прихожая|санузел|ванная|туалет)'  # типы помещений
    r'|(?:матов|глянц|сатин|текстур|белый|белая|белое|цветн|ткань|тканев|бауф|bauf|evolution|эволюц|premium|премиум|дескор)'  # типы полотна
    r'|(?:профиль\s*(?:обычный|стандарт|алюминий)?|алюминиев|стеновой)'  # профиль
    r'|\d+\s*(?:шт|люстр|светильник|gx|закладн)'  # кол-во изделий
    r'|(?:люстр\w*|светильник\w*|закладн\w*)'  # изделия без кол-ва
    r'|(?:ниша|карниз|шторн|гардин|штор\w*)'  # ниши
    r'|(?:пк[- ]?\d+|sigma|брус|бп-?\d+)'  # типы ниш
    r'|(?:\d+\s*(?:м\.п\.|мп|пм|погон\w*))'  # метраж профиля/ниши
    r'|(?:вставка|рассказовка|рассказовк\w*)'  # служебные слова
    r'|(?:есть|нет|да|нет|без|с\b|и\b|в\b|на\b|по\b|из\b|для\b|от\b)',  # стоп-слова
    re.IGNORECASE
)

# Паттерны «нюансов» — фраз которые явно описывают сложность работ
_NUANCE_PAT = re.compile(
    r'(?:'
    r'(?:есть|имеется?|будет?)\s+нюанс\w*'
    r'|сложн\w+\s+монтаж\w*'
    r'|монтаж\s+сложн\w+'
    r'|обход\s+\w+'
    r'|угол\w*\s+(?:кухн|сте|ком)'
    r'|(?:кухн|мебел)\w*\s+углом'
    r'|зазор\s+\d+'
    r'|гипсов\w+\s+панел'
    r'|угл[ыиа]\s+по\s+\d+'
    r'|аккуратн\w+\s+монтаж'
    r'|стены?\s+светл\w+'
    r'|кровать\s+(?:можно|нельзя|нужно)'
    r')',
    re.IGNORECASE
)


def _extract_nuance_phrases(text: str) -> list[str]:
    """Извлекает фразы-нюансы из текста которые не попадают в стандартный расчёт."""
    # 1. Явные паттерны нюансов
    found = [m.group(0).strip() for m in _NUANCE_PAT.finditer(text)]

    # 2. Часть текста после «Есть нюансы» / «Нюансы:» — берём как единый кандидат
    nuance_block = re.search(r'есть\s+нюанс\w*[:\s]+(.{10,120}?)(?:\.|$)', text, re.IGNORECASE)
    if nuance_block:
        block = nuance_block.group(1).strip()
        if block and block not in found:
            found.append(block)

    return found


def get_skip_reason(text: str) -> dict:
    """Возвращает причину почему бот отказался считать сам. Возвращает ПОЛНЫЕ слова."""
    t = text.lower()
    # Собираем все полные слова из текста которые содержат стоп-паттерн
    all_words = _FULL_WORD_PAT.findall(t)
    matched_full = []
    seen = set()
    for word in all_words:
        if word in seen:
            continue
        if _COMPLEX_PAT.search(word):
            matched_full.append(word)
            seen.add(word)

    # Добавляем фразы-нюансы как дополнительные кандидаты для обучения
    nuance_phrases = _extract_nuance_phrases(text)
    all_candidates = matched_full + [p for p in nuance_phrases if p.lower() not in seen]

    if matched_full:
        return {'reason': 'complex_keyword', 'unknown_word': matched_full[0], 'unknown_words': all_candidates}
    area_m = (
        re.search(_NUM_WORD_PAT + r'\s*(?:м²|м2|кв\.?\s*м?|квадрат|кв\b)', t) or
        re.search(r'(?:санузел|комнат|зал|спальн|кухн|прихожа|гостин|студи|детск|коридор|ванн|туалет)[^0-9а-яё]{0,20}?' + _NUM_WORD_PAT + r'\s*м\b', t) or
        re.search(r'[-–]\s*' + _NUM_WORD_PAT + r'\s*м\b', t)
    )
    if not area_m:
        return {'reason': 'no_area', 'unknown_word': None, 'unknown_words': all_candidates}
    if all_candidates:
        return {'reason': 'complex_keyword', 'unknown_word': all_candidates[0], 'unknown_words': all_candidates}
    return {'reason': 'unknown', 'unknown_word': None, 'unknown_words': []}


def _get_known_synonyms() -> set[str]:
    """Возвращает все синонимы и имена позиций из прайса (lowercase)."""
    try:
        rules = get_price_rules()
        result = set()
        for r in rules:
            result.add(r['name'].lower())
            if r.get('synonyms'):
                for s in r['synonyms'].split(','):
                    s = s.strip().lower()
                    if s:
                        result.add(s)
        return result
    except Exception:
        return set()


def _text_covered_by_synonyms(text: str, known: set[str]) -> bool:
    """Проверяет — все сложные слова в тексте уже покрыты синонимами из прайса."""
    matches = _COMPLEX_PAT.findall(text.lower())
    if not matches:
        return True
    for match in matches:
        covered = any(match in syn or syn in match for syn in known)
        if not covered:
            return False
    return True


def try_simple_estimate(text: str) -> tuple[str, dict] | None:
    """Детерминированный расчёт сметы. Возвращает (текст_ответа, recognized_dict) или None."""
    t = text.lower()

    # Нумерованный список позиций — всегда в LLM, regex не справится
    if _NUMBERED_LIST_PAT.search(t):
        print(f"[calc] skip: numbered list detected → LLM '{t[:60]}'")
        return None

    # Порог LLM: 0-99=сложные запросы → LLM, 100=всё в авторасчёт
    threshold = get_llm_threshold()

    if _COMPLEX_PAT.search(t):
        if threshold >= 100:
            print(f"[calc] threshold=100, forcing auto for '{t[:60]}'")
        else:
            # Проверяем — все ли сложные слова в тексте уже исключены (обучены)
            exceptions = get_complex_exceptions()
            all_words = _FULL_WORD_PAT.findall(t)
            still_complex = []
            seen = set()
            for w in all_words:
                if w in seen:
                    continue
                seen.add(w)
                if not _COMPLEX_PAT.search(w):
                    continue
                # Слово сложное — проверяем покрыто ли исключением
                covered = any(exc in w or w in exc for exc in exceptions)
                if not covered:
                    still_complex.append(w)
            if still_complex:
                print(f"[calc] skip: still complex {still_complex} threshold={threshold} → LLM '{t[:60]}'")
                return None
            print(f"[calc] all complex covered by exceptions, proceeding '{t[:60]}'")


    # Ищем площадь — цифрой или словом (м², м2, кв.м, квадрат)
    m = re.search(_NUM_WORD_PAT + r'\s*(?:м²|м2|кв\.?\s*м?|квадрат|кв\b)', t)
    if not m:
        # Fallback: число + "м" рядом с названием помещения (санузел 26м, комната 20м)
        m = re.search(
            r'(?:санузел|комнат|зал|спальн|кухн|прихожа|гостин|студи|детск|коридор|ванн|туалет)'
            r'[^0-9а-яё]{0,20}?' + _NUM_WORD_PAT + r'\s*м\b',
            t
        )
        if not m:
            # Fallback 2: просто "- 26м" или "S - 26м" (формат обозначения площади)
            m = re.search(r'[-–]\s*' + _NUM_WORD_PAT + r'\s*м\b', t)
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

    # Загружаем ВСЕ позиции из БД — цены + правила + синонимы
    _rules = get_price_rules()
    _by_name = {r['name']: r for r in _rules}

    def p(name: str, fallback: int) -> int:
        """Цена позиции из БД, с fallback если не найдена."""
        return int(_by_name[name]['price']) if name in _by_name else fallback

    def _synonyms_pattern(name: str, base_pattern: str) -> str:
        """Строит regex с учётом синонимов из БД для данной позиции."""
        item = _by_name.get(name)
        if not item or not item.get('synonyms'):
            return base_pattern
        extras = [s.strip() for s in item['synonyms'].split(',') if s.strip()]
        if not extras:
            return base_pattern
        return base_pattern + '|' + '|'.join(re.escape(s) for s in extras)

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

    # Светильники GX-53 — базовые слова + синонимы из БД
    _svet_base = r'светильник|gx.?53|вклейк'
    _svet_syn = _synonyms_pattern('Светильник GX-53 + лампа', _svet_base)
    all_svet_nums = re.findall(_NUM_WORD_PAT + r'\s*(?:точечн\w*\s*)?(?:' + _svet_syn + r')', t)
    all_svet_nums += re.findall(r'добавить\s+(?:ещё\s+)?' + _NUM_WORD_PAT + r'\s*(?:точечн|светильник)?', t)
    # Формат: "8шт закладная под светильник" или "8 закладных под светильник"
    all_svet_nums += re.findall(_NUM_WORD_PAT + r'\s*шт\.?\s*закладн\w*\s+под\s+(?:точечн\w*\s*)?светильник', t)
    all_svet_nums += re.findall(_NUM_WORD_PAT + r'\s*закладн\w*\s+под\s+(?:точечн\w*\s*)?светильник', t)
    n_svetilnik = sum(int(_w2n(x)) for x in all_svet_nums)

    # Люстра — цифрой или словом
    lyustra_m = re.search(_NUM_WORD_PAT + r'?\s*люстр', t)
    # Формат: "4шт закладная под люстру" или "4 закладных под люстру/подвесной"
    lyustra_zakl_m = re.search(_NUM_WORD_PAT + r'\s*шт\.?\s*закладн\w*\s+под\s+люстр', t)
    if not lyustra_zakl_m:
        lyustra_zakl_m = re.search(_NUM_WORD_PAT + r'\s*закладн\w*\s+под\s+люстр', t)
    if lyustra_zakl_m and lyustra_zakl_m.group(1):
        n_lyustra = int(_w2n(lyustra_zakl_m.group(1)))
    elif lyustra_m and lyustra_m.group(1):
        n_lyustra = int(_w2n(lyustra_m.group(1)))
    else:
        n_lyustra = 1 if lyustra_m else 0

    # Ниша для штор — базовые слова + синонимы из БД
    _nisha_base = r'ниш[аеуы]?\s*(?:для\s*штор)?|карниз|шторн|штор[аыуе]|гардин'
    _nisha_pat = _synonyms_pattern('Ниша без перегиба', _nisha_base)
    has_nisha = bool(re.search(_nisha_pat, t))

    # Длина ниши: явная (цифра или слово) рядом с любым ключевым словом ниши/карниза
    _nisha_kw = r'(?:ниш[аеуы]?|карниз|штор[аыуе]?|шторн|гардин\w*)'
    nisha_len_m = (
        re.search(_NUM_WORD_PAT + r'\s*(?:м|пм|погон)\s+' + _nisha_kw, t) or
        re.search(_nisha_kw + r'\s+(?:для\s+штор\s+)?(?:пк[- ]?\d+\s+)?' + _NUM_WORD_PAT + r'\s*(?:м|пм|погон)', t) or
        re.search(_nisha_kw + r'\s+' + _NUM_WORD_PAT + r'\s*(?:м|пм|погон)', t) or
        re.search(_NUM_WORD_PAT + r'\s*(?:м|пм|погон)\s*(?:для\s*)?' + _nisha_kw, t)
    )
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

    # ─── ДИНАМИЧЕСКИЕ ПОЗИЦИИ ИЗ ПРАЙСА (синонимы + calc_rule) ─────────────────
    # Все позиции у которых есть синонимы — проверяем совпадение в тексте
    _BUILTIN_NAMES = {
        'Раскрой ПВХ', 'Огарпунивание ПВХ', 'Стеновой алюминий',
        'Закладная под люстру', 'Закладная под светильник',
        'Светильник GX-53 + лампа', 'Лампа GX53',
        'Монтаж полотна ПВХ', 'Монтаж полотна ТКАНЬ',
        'Монтаж профиля стандарт', 'Монтаж парящего профиля',
        'Монтаж закладной', 'Монтаж светильника GX53',
        'Монтаж разводки ГОСТ 0.75',
        'Ниша без перегиба', 'ПК-12', 'ПК-14', 'ПК-15', 'Парящий ПК-6',
        'Sigma LED', 'Sigma', 'Брус БП-40',
    }
    dynamic_extras = []  # [(name, qty, unit_price, total)]
    for rule in _rules:
        if rule['name'] in _BUILTIN_NAMES:
            continue
        syns = [s.strip() for s in rule['synonyms'].split(',') if s.strip()] if rule['synonyms'] else []
        kws = [rule['name']] + syns
        pat = '|'.join(re.escape(k) for k in kws)
        if not re.search(pat, t, re.IGNORECASE):
            continue
        unit_price = int(rule['price']) if rule['price'] else 0
        calc = rule['calc_rule'] or ''
        # Ищем явное количество рядом с синонимом
        qty_m = re.search(_NUM_WORD_PAT + r'\s*(?:' + pat + r')', t, re.IGNORECASE)
        if not qty_m:
            qty_m = re.search(r'(?:' + pat + r')\s*' + _NUM_WORD_PAT, t, re.IGNORECASE)
        if qty_m:
            try:
                qty = _w2n(qty_m.group(1))
            except Exception:
                qty = 1
        elif calc:
            qty = eval_calc_rule(calc, area, perim) or 1
        else:
            qty = 1
        total = round(qty * unit_price)
        dynamic_extras.append((rule['name'], qty, unit_price, total, rule['unit'] or 'шт'))
        print(f"[calc] dynamic: {rule['name']} qty={qty} price={unit_price} total={total}")

    print(f"[calc] area={area} perim={perim} n_lyustra={n_lyustra} n_svetilnik={n_svetilnik} has_nisha={has_nisha} nisha_len={nisha_len if has_nisha else '-'} nisha_price={nisha_price} dynamic={len(dynamic_extras)}")

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

    dynamic_total = sum(x[3] for x in dynamic_extras)
    standard = (canvas_total + raskroy + ogarp + profile_total + nisha_total +
                zakl_total + svet_total + lampa_total +
                mount_canvas + mount_profile + mount_nisha + mount_zakl + mount_svet + mount_razv +
                dynamic_total)
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

    # Дополнительные позиции из прайса (обученные)
    if dynamic_extras:
        sec += 1
        lines.append(f"\n{sec}. Дополнительно:")
        for name, qty, unit_price, total, unit in dynamic_extras:
            lines.append(f"  {name} {qty} {unit} × {unit_price} ₽ = {fmt(total)} ₽")

    lines.append(f"\nEconom:   {fmt(econom)} ₽")
    lines.append(f"Standard: {fmt(standard)} ₽")
    lines.append(f"Premium:  {fmt(premium_price)} ₽")
    lines.append(f"\nНа какой день вас записать на бесплатный замер?")

    recognized = {
        'area': area,
        'canvas': canvas_name,
        'canvas_type': canvas_key,
        'perim': perim,
        'n_lyustra': n_lyustra,
        'n_svetilnik': n_svetilnik,
        'has_nisha': has_nisha,
        'nisha_label': nisha_label if has_nisha else None,
        'nisha_len': nisha_len if has_nisha else None,
        'profile_len': profile_len,
        'standard_total': standard,
    }

    return '\n'.join(lines), recognized


def _parse_llm_items(answer: str) -> list[dict]:
    """Парсит текстовый ответ LLM и извлекает позиции сметы.
    Ищет строки вида: 'Название позиции N ед. × P ₽ = T ₽'
    """
    items = []
    # Паттерн: название × цифра ед × цена = итого
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

    # Стоп-слова: позиции которые ВСЕГДА есть в стандартной смете — не предлагаем
    BUILTIN_STOP_WORDS = {
        'раскрой', 'огарпун', 'полотно', 'монтаж', 'профил', 'закладн',
        'светильник', 'лампа', 'люстра', 'ниша', 'карниз', 'штора',
        'стандарт', 'econom', 'standard', 'premium', 'итого', 'всего',
        'услуги', 'установк', 'разводк', 'гост',
    }

    def _is_builtin(name: str) -> bool:
        nl = name.lower()
        return any(stop in nl for stop in BUILTIN_STOP_WORDS)

    # Все известные имена и синонимы из прайса
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

    # Фильтруем — оставляем только то чего нет в прайсе
    # Считаем "известным" если пересечение слов >= 50% слов из item name
    new_items = []
    for item in items:
        if _is_builtin(item['name']):
            print(f"[suggestions] skip builtin: {item['name']}")
            continue
        item_words = _words(item['name'])
        if not item_words:
            continue
        is_known = False
        for k in known:
            k_words = _words(k)
            if not k_words:
                continue
            overlap = len(item_words & k_words)
            # Известно если хотя бы 50% слов совпадают с любой стороны
            if overlap / max(len(item_words), len(k_words)) >= 0.5:
                is_known = True
                break
        if not is_known:
            new_items.append(item)
            print(f"[suggestions] new item: {item['name']} {item['price']}₽")

    if not new_items:
        return

    # Обновляем последнюю запись bot_corrections для этой сессии
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
        print(f"[suggestions] saved {len(new_items)} suggestions for session {session_id}")
    except Exception as e:
        print(f"[suggestions] db error: {e}")


def _save_suggestions_from_json(items: list, user_text: str, session_id: str, rules: list) -> None:
    """Сохраняет предложения из структурированного JSON ответа LLM."""
    if not items:
        return

    # Стоп-слова — базовые позиции которые всегда есть
    BUILTIN_STOP_WORDS = {
        'раскрой', 'огарпун', 'монтаж', 'профил', 'закладн',
        'светильник', 'лампа', 'люстра', 'ниша', 'карниз', 'штора',
        'стандарт', 'econom', 'standard', 'premium', 'итого', 'всего',
        'услуги', 'установк', 'разводк', 'гост', 'полотно',
    }

    def _is_builtin(name: str) -> bool:
        nl = name.lower()
        return any(stop in nl for stop in BUILTIN_STOP_WORDS)

    # Все известные имена и синонимы из прайса
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
            print(f"[suggestions] json new item: {name} {item.get('price', 0)}₽")

    if not new_items:
        print(f"[suggestions] json: all items known, nothing to suggest")
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
        print(f"[suggestions] json: saved {len(new_items)} items")
    except Exception as e:
        print(f"[suggestions] json db error: {e}")


def get_cached_answer(text: str, session_id: str = '') -> tuple[str, dict] | str | None:
    """Проверяет кэш и простой расчёт. Возвращает (ответ, recognized) или строку или None."""
    text_lower = text.lower().strip()

    # Сначала пробуем простой расчёт по площади
    result = try_simple_estimate(text_lower)
    print(f"[calc] text='{text_lower[:80]}' estimate={'YES' if result else 'NO'}")
    if result:
        answer, recognized = result
        save_correction(text, recognized, session_id)
        return answer, recognized

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

Итоговая стоимость — 3 варианта (считай математически точно из позиций выше):
Econom:   X ₽  (Standard × 0.77)
Standard: X ₽  (сумма всех позиций)
Premium:  X ₽  (Standard × 1.27)

Финальная фраза ВСЕГДА:
"На какой день вас записать на бесплатный замер?"

КОМПАНИЯ: MosPotolki, Мытищи, с 2009г. Тел: +7(977)606-89-01. Ежедневно 8:00–22:00. Сайт: mospotolki.net

ФОРМАТ ОТВЕТА СИСТЕМЕ (обязательно):
После текста сметы добавь блок JSON на отдельной строке:
%%ITEMS%%{"items":[{"name":"Название позиции","qty":1,"price":350,"unit":"шт"},...],"area":20.84}%%END%%

Правила JSON:
- Включай ВСЕ позиции из сметы (полотно, профиль, закладные, освещение, ниши, монтаж и др.)
- qty — количество (число), price — цена за единицу из прайса, unit — единица измерения
- Клиент НЕ видит этот блок, он только для системы
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

    session_id = event.get('headers', {}).get('x-session-id', '') or event.get('headers', {}).get('X-Session-Id', '')

    cached = get_cached_answer(last_user_text, session_id)
    if cached:
        answer = cached[0] if isinstance(cached, tuple) else cached
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'answer': answer})}

    # Сохраняем в обучение — запрос ушёл в LLM (не удалось посчитать автоматически)
    skip_info = get_skip_reason(last_user_text.lower().strip())
    save_correction(last_user_text, skip_info, session_id)

    # Загружаем базу знаний и цены из БД
    knowledge = get_knowledge(last_user_text)
    system_content = get_system_prompt(fallback=SYSTEM_PROMPT)
    prices_block = get_prices_block()
    _rules_for_suggestions = get_price_rules()
    if prices_block:
        system_content += f"\n\n=== АКТУАЛЬНЫЙ ПРАЙС-ЛИСТ ==={prices_block}"
    if knowledge:
        system_content += f"\n\n=== БАЗА ЗНАНИЙ ===\n{knowledge}"
    rules_hint = build_rules_prompt(_rules_for_suggestions)
    if rules_hint:
        system_content += rules_hint

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

    # ─── АВТО-ОБУЧЕНИЕ: извлекаем JSON-блок из ответа LLM ────────────────────
    llm_items_json = None
    items_match = re.search(r'%%ITEMS%%(.+?)%%END%%', answer, re.DOTALL)
    if items_match:
        # Вырезаем блок из ответа — клиент его не увидит
        answer = answer.replace(items_match.group(0), '').strip()
        try:
            llm_items_json = json.loads(items_match.group(1).strip())
            print(f"[suggestions] parsed JSON items: {len(llm_items_json.get('items', []))} items")
        except Exception as e:
            print(f"[suggestions] JSON parse error: {e}")

    try:
        if llm_items_json and llm_items_json.get('items'):
            # Используем структурированные данные из JSON
            _save_suggestions_from_json(llm_items_json['items'], last_user_text, session_id, _rules_for_suggestions)
        else:
            # Fallback: парсим текст как раньше
            _extract_and_save_suggestions(answer, last_user_text, session_id, _rules_for_suggestions)
    except Exception as e:
        print(f"[suggestions] error: {e}")

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