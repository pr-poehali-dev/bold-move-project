"""Детерминированный расчёт сметы и helpers для определения сложности запроса."""
import json
import math
import os
import re
import psycopg2

from db import (
    get_canvas_prices, get_price_rules, eval_calc_rule,
    save_correction, CANVAS_PRICES, SCHEMA,
    get_llm_threshold, get_complex_exceptions, get_stop_words,
)

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
_NUM_WORD_PAT = r'(\d+(?:[.,]\d+)?|' + '|'.join(sorted(_WORDS_TO_NUM, key=len, reverse=True)) + r')'

def _w2n(s: str) -> float:
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
_FULL_WORD_PAT = re.compile(r'[а-яёa-z0-9]+(?:[- ][а-яёa-z0-9]+)*', re.IGNORECASE)
_NUMBERED_LIST_PAT = re.compile(r'\b[1-9]\s*[\.\)]\s+\S', re.IGNORECASE)

_KNOWN_PARTS_PAT = re.compile(
    r'\d+(?:[.,]\d+)?\s*(?:м²|м2|кв\.?\s*м?|квадрат|кв\b)'
    r'|(?:однушка|двушка|трёшка|студия|комната|зал|спальня|кухня|коридор|прихожая|санузел|ванная|туалет)'
    r'|(?:матов|глянц|сатин|текстур|белый|белая|белое|цветн|ткань|тканев|бауф|bauf|evolution|эволюц|premium|премиум|дескор)'
    r'|(?:профиль\s*(?:обычный|стандарт|алюминий)?|алюминиев|стеновой)'
    r'|\d+\s*(?:шт|люстр|светильник|gx|закладн)'
    r'|(?:люстр\w*|светильник\w*|закладн\w*)'
    r'|(?:ниша|карниз|шторн|гардин|штор\w*)'
    r'|(?:пк[- ]?\d+|sigma|брус|бп-?\d+)'
    r'|(?:\d+\s*(?:м\.п\.|мп|пм|погон\w*))'
    r'|(?:вставка|рассказовка|рассказовк\w*)'
    r'|(?:есть|нет|да|нет|без|с\b|и\b|в\b|на\b|по\b|из\b|для\b|от\b)',
    re.IGNORECASE
)

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

_SIMPLE_ALLOWED_PAT = re.compile(
    r'^[\s\d,./•·\-–—«»()]+$|'
    r'(м²|м2|кв\.?м?|квадрат|кв\b|'
    r'матов|глянц|сатин|белый|белая|цветн|ткань|тканев|bauf|бауф|evolution|premium|премиум|'
    r'люстр|светильник|gx.?53|точечн|'
    r'ниш|карниз|штор|гардин|пк.?\d+|sigma|брус|'
    r'потолок|комнат|зал|спальн|кухн|прихожа|гостин|студи|однушк|двушк|трёшк|'
    r'профил|вставка|рассказовк|классик|матовый|'
    r'сколько|стоит|стоимост|цен|почём|посчитай|рассчитай|рассчитать|посчитать|'
    r'какой|какая|какое|какие|нужно|хочу|хотим|можно|нельзя|есть|нет|будет|'
    r'привет|здравствуй|добрый|день|вечер|утро|спасибо|пожалуйста|'
    r'и|в|на|по|с|для|от|до|из|под|над|за|или|не|без)',
    re.IGNORECASE
)


def _extract_nuance_phrases(text: str) -> list:
    found = [m.group(0).strip() for m in _NUANCE_PAT.finditer(text)]
    nuance_block = re.search(r'есть\s+нюанс\w*[:\s]+(.{10,120}?)(?:\.|$)', text, re.IGNORECASE)
    if nuance_block:
        block = nuance_block.group(1).strip()
        if block and block not in found:
            found.append(block)
    return found


def _get_whitelist_unknown(text: str) -> list:
    words = re.findall(r'[а-яёa-z]+', text.lower())
    seen = set()
    result = []
    for w in words:
        if len(w) <= 2 or w in seen:
            continue
        seen.add(w)
        if not _SIMPLE_ALLOWED_PAT.search(w):
            result.append(w)
    return result


def _text_covered_by_synonyms(text: str, known: set) -> bool:
    matches = _COMPLEX_PAT.findall(text.lower())
    if not matches:
        return True
    for match in matches:
        covered = any(match in syn or syn in match for syn in known)
        if not covered:
            return False
    return True


def get_skip_reason(text: str) -> dict:
    stop_words = get_stop_words()
    t = text.lower()
    all_words = _FULL_WORD_PAT.findall(t)
    matched_full = []
    seen = set()
    for word in all_words:
        if word in seen:
            continue
        if _COMPLEX_PAT.search(word):
            matched_full.append(word)
            seen.add(word)
    whitelist_unknown = _get_whitelist_unknown(text)
    for w in whitelist_unknown:
        if w not in seen:
            seen.add(w)
            matched_full.append(w)
    nuance_phrases = _extract_nuance_phrases(text)
    unknown_abbr = re.findall(
        r'\b([А-ЯЁA-Z][а-яёa-zA-Z]{0,10}(?:\s+[а-яёa-zA-Z]{1,10}){0,2}\s+\d+(?:\s*м[²2]?)?)\b',
        text
    )
    _skip_abbr = {'м2', 'м²', 'шт', 'метр', 'пог', 'мп', 'гост', 'на', 'по', 'до', 'от'}
    abbr_candidates = []
    for phrase in unknown_abbr:
        phrase = phrase.strip()
        pl = phrase.lower()
        if any(s in pl for s in _skip_abbr):
            continue
        if pl in seen:
            continue
        seen.add(pl)
        abbr_candidates.append(phrase)
    all_candidates = matched_full + [p for p in nuance_phrases if p.lower() not in seen] + abbr_candidates
    all_candidates = [w for w in all_candidates if w.lower().strip() not in stop_words]
    matched_full = [w for w in matched_full if w.lower().strip() not in stop_words]
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


def _get_known_synonyms() -> set:
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


def try_simple_estimate(text: str):
    try:
        return _try_simple_estimate_inner(text)
    except Exception as e:
        print(f"[calc] EXCEPTION in try_simple_estimate: {e}")
        import traceback; traceback.print_exc()
        return None


def _try_simple_estimate_inner(text: str):
    t = text.lower()
    unknown_words = _get_whitelist_unknown(t)
    if unknown_words:
        print(f"[calc] skip: unknown words {unknown_words[:5]} → LLM '{t[:60]}'")
        return None
    if _NUMBERED_LIST_PAT.search(t):
        print(f"[calc] skip: numbered list → LLM '{t[:60]}'")
        return None

    m = re.search(_NUM_WORD_PAT + r'\s*(?:м²|м2|кв\.?\s*м?|квадрат|кв\b)', t)
    if not m:
        m = re.search(
            r'(?:санузел|комнат|зал|спальн|кухн|прихожа|гостин|студи|детск|коридор|ванн|туалет)'
            r'[^0-9а-яё]{0,20}?' + _NUM_WORD_PAT + r'\s*м\b', t
        )
        if not m:
            m = re.search(r'[-–]\s*' + _NUM_WORD_PAT + r'\s*м\b', t)
        if not m:
            print(f"[calc] skip: no area in '{t[:60]}'")
            return None
    area = _w2n(m.group(1))
    if area < 1 or area > 500:
        return None

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

    _rules = get_price_rules()
    _by_name = {r['name']: r for r in _rules}

    def p(name: str, fallback: int) -> int:
        return int(_by_name[name]['price']) if name in _by_name else fallback

    def _synonyms_pattern(name: str, base_pattern: str) -> str:
        item = _by_name.get(name)
        if not item or not item.get('synonyms'):
            return base_pattern
        extras = [s.strip() for s in item['synonyms'].split(',') if s.strip()]
        if not extras:
            return base_pattern
        return base_pattern + '|' + '|'.join(re.escape(s) for s in extras)

    price_raskroy        = p('Раскрой ПВХ', 0)
    price_ogarp          = p('Огарпунивание ПВХ', 0)
    price_profile        = p('Стеновой алюминиевый', 0)
    price_zakl_lyustra   = p('Под люстру планка', 0)
    price_zakl_svet      = p('Под светильник ∅90', 0)
    price_svetilnik_full = p('Светильник GX-53 + лампа', 0)
    _lampa_price         = 100
    price_svetilnik      = price_svetilnik_full - _lampa_price if price_svetilnik_full > _lampa_price else price_svetilnik_full
    price_mount_pvh      = p('Монтаж полотна ПВХ', 0)
    price_mount_tkань    = p('Монтаж полотна ТКАНЬ', 0)
    price_mount_profile  = p('Монтаж профиля стандарт', 0)
    price_mount_zakl     = p('Монтаж закладной', 0)
    price_mount_svet     = p('Монтаж светильников GX-53', 0)
    price_mount_razv     = p('Монтаж разводки ГОСТ 0.75', 0)
    price_mount_nisha    = p('Монтаж ниши', 0)

    _svet_base = r'светильник|gx.?53|вклейк'
    _svet_syn = _synonyms_pattern('Светильник GX-53 + лампа', _svet_base)
    all_svet_nums = re.findall(_NUM_WORD_PAT + r'\s*(?:точечн\w*\s*)?(?:' + _svet_syn + r')', t)
    all_svet_nums += re.findall(r'добавить\s+(?:ещё\s+)?' + _NUM_WORD_PAT + r'\s*(?:точечн|светильник)?', t)
    all_svet_nums += re.findall(_NUM_WORD_PAT + r'\s*шт\.?\s*закладн\w*\s+под\s+(?:точечн\w*\s*)?светильник', t)
    all_svet_nums += re.findall(_NUM_WORD_PAT + r'\s*закладн\w*\s+под\s+(?:точечн\w*\s*)?светильник', t)
    n_svetilnik = sum(int(_w2n(x)) for x in all_svet_nums)

    lyustra_m = re.search(_NUM_WORD_PAT + r'?\s*люстр', t)
    lyustra_zakl_m = re.search(_NUM_WORD_PAT + r'\s*шт\.?\s*закладн\w*\s+под\s+люстр', t)
    if not lyustra_zakl_m:
        lyustra_zakl_m = re.search(_NUM_WORD_PAT + r'\s*закладн\w*\s+под\s+люстр', t)
    if lyustra_zakl_m and lyustra_zakl_m.group(1):
        n_lyustra = int(_w2n(lyustra_zakl_m.group(1)))
    elif lyustra_m and lyustra_m.group(1):
        n_lyustra = int(_w2n(lyustra_m.group(1)))
    else:
        n_lyustra = 1 if lyustra_m else 0

    _nisha_base = r'ниш[аеуы]?\s*(?:для\s*штор)?|карниз|шторн|штор[аыуе]|гардин'
    _nisha_pat = _synonyms_pattern('Ниша без перегиба', _nisha_base)
    has_nisha = bool(re.search(_nisha_pat, t))

    _nisha_kw = r'(?:ниш[аеуы]?|карниз|штор[аыуе]?|шторн|гардин\w*)'
    _m_unit = r'(?:пм|погон\.?\s*м|п\.?\s*м|(?<!кв[\s.])м(?!²|2|\s*кв))'
    nisha_len_m = (
        re.search(_nisha_kw + r'\s+(?:для\s+штор\s+)?(?:пк[- ]?\d+\s+)?' + _NUM_WORD_PAT + r'\s*' + _m_unit, t) or
        re.search(_nisha_kw + r'\s+' + _NUM_WORD_PAT + r'\s*' + _m_unit, t) or
        re.search(_NUM_WORD_PAT + r'\s*' + _m_unit + r'\s+' + _nisha_kw, t) or
        re.search(_NUM_WORD_PAT + r'\s*' + _m_unit + r'\s*(?:для\s*)?' + _nisha_kw, t)
    )
    if nisha_len_m:
        nisha_len = _w2n(nisha_len_m.group(1))
    else:
        _nisha_rule_item = next((r for r in _rules if r['category'] == 'Ниши для штор' and r['calc_rule']), None)
        _nisha_default = eval_calc_rule(
            _nisha_rule_item['calc_rule'] if _nisha_rule_item else 'perimeter*0.25', area, perim
        )
        _raw = _nisha_default if _nisha_default is not None else perim * 0.25
        nisha_len = float(math.ceil(_raw))

    nisha_price = 0
    nisha_label = ''
    if has_nisha:
        pk_m = re.search(r'пк[- ]?(\d+)', t)
        pk = int(pk_m.group(1)) if pk_m else 0
        if pk == 12:
            nisha_price = p('Ниша ПК-12 (3 ряда)', 0); nisha_label = 'Ниша ПК-12 (3 ряда)'
        elif pk == 14:
            nisha_price = p('Ниша ПК-14 (2 ряда)', 0); nisha_label = 'Ниша ПК-14 (2 ряда)'
        elif pk == 15:
            nisha_price = p('Ниша ПК-15 (2 ряда)', 0); nisha_label = 'Ниша ПК-15 (2 ряда)'
        elif pk == 6:
            nisha_price = p('Парящий ПК-6 без рассеивателя', 0); nisha_label = 'Парящий ПК-6 без рассеивателя'
        elif re.search(r'sigma\s*led', t):
            nisha_price = p('Sigma LED', 0); nisha_label = 'Sigma LED'
        elif re.search(r'sigma', t):
            nisha_price = p('Sigma', 0); nisha_label = 'Sigma'
        elif re.search(r'брус|бп.?40', t):
            nisha_price = p('БП-40', 0); nisha_label = 'БП-40'
        else:
            nisha_price = p('Ниша без перегиба', 0); nisha_label = 'Ниша без перегиба'

    _BUILTIN_NAMES = {
        'Раскрой ПВХ', 'Огарпунивание ПВХ',
        'Стеновой алюминиевый', 'Стеновой ПВХ',
        'Под люстру планка', 'Под люстру крюк', 'Под люстру крестовина',
        'Под светильник ∅90', 'Под светильник ∅100-300', 'Под светильник ∅300-600',
        'Светильник GX-53 + лампа',
        'Монтаж полотна ПВХ', 'Монтаж полотна ТКАНЬ',
        'Монтаж профиля стандарт', 'Монтаж парящего профиля',
        'Монтаж закладной', 'Монтаж светильников GX-53',
        'Монтаж разводки ГОСТ 0.75',
        'Ниша без перегиба', 'Ниша с перегибом',
        'Ниша ПК-12 (3 ряда)', 'Ниша ПК-14 (2 ряда)', 'Ниша ПК-15 (2 ряда)',
        'Парящий ПК-6 без рассеивателя', 'Sigma LED', 'Sigma', 'БП-40',
    }
    dynamic_extras = []
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

    print(f"[calc] area={area} perim={perim} n_lyustra={n_lyustra} n_svetilnik={n_svetilnik}")

    canvas_total = round(area * canvas_price)
    raskroy      = round(area * price_raskroy) if is_pvh else 0
    ogarp        = round(area * price_ogarp) if is_pvh else 0
    profile_len   = round(math.ceil(perim / 2) * 2, 1)
    profile_total = round(profile_len * price_profile)
    nisha_total   = round(nisha_len * nisha_price) if has_nisha else 0
    zakl_lyustra = n_lyustra * price_zakl_lyustra
    zakl_svet    = n_svetilnik * price_zakl_svet
    zakl_total   = zakl_lyustra + zakl_svet
    svet_total   = n_svetilnik * price_svetilnik_full
    price_mount_canvas = price_mount_pvh if is_pvh else price_mount_tkань
    mount_canvas  = round(area * price_mount_canvas)
    mount_profile = round(profile_len * price_mount_profile)
    mount_zakl    = (n_lyustra + n_svetilnik) * price_mount_zakl if (n_lyustra + n_svetilnik) > 0 else 0
    mount_svet    = n_svetilnik * price_mount_svet
    mount_razv    = n_svetilnik * price_mount_razv if n_svetilnik > 0 else 0
    mount_nisha   = round(nisha_len * price_mount_nisha) if has_nisha and price_mount_nisha else 0
    dynamic_total = sum(x[3] for x in dynamic_extras)
    standard = (canvas_total + raskroy + ogarp + profile_total + nisha_total +
                zakl_total + svet_total +
                mount_canvas + mount_profile + mount_zakl + mount_svet + mount_razv +
                mount_nisha + dynamic_total)

    _econom_mult = 0.85; _premium_mult = 1.27
    _econom_label = "Econom"; _standard_label = "Standard"; _premium_label = "Premium"
    try:
        _conn2 = psycopg2.connect(os.environ['DATABASE_URL'])
        _cur2  = _conn2.cursor()
        _cur2.execute(f"SELECT econom_mult, premium_mult, econom_label, standard_label, premium_label FROM {SCHEMA}.pricing_settings LIMIT 1")
        _row2 = _cur2.fetchone()
        if _row2:
            _econom_mult, _premium_mult, _econom_label, _standard_label, _premium_label = float(_row2[0]), float(_row2[1]), _row2[2], _row2[3], _row2[4]
        _conn2.close()
    except Exception:
        pass
    econom        = round(standard * _econom_mult)
    premium_price = round(standard * _premium_mult)

    def fmt(n): return f"{n:,}".replace(',', ' ')

    sec = 1
    lines = []
    lines.append(f"{sec}. Полотно:")
    lines.append(f"  {canvas_name}  {area} м² × {canvas_price} ₽ = {fmt(canvas_total)} ₽")
    if is_pvh:
        if price_raskroy: lines.append(f"  Раскрой ПВХ  {area} м² × {price_raskroy} ₽ = {fmt(raskroy)} ₽")
        if price_ogarp:   lines.append(f"  Огарпунивание ПВХ  {area} м² × {price_ogarp} ₽ = {fmt(ogarp)} ₽")
    if price_profile:
        sec += 1
        lines.append(f"\n{sec}. Профиль:")
        lines.append(f"  Стеновой алюминиевый  {profile_len} мп × {price_profile} ₽ = {fmt(profile_total)} ₽")
    if has_nisha:
        sec += 1
        lines.append(f"\n{sec}. Ниши для штор:")
        lines.append(f"  {nisha_label}  {nisha_len} мп × {nisha_price} ₽ = {fmt(nisha_total)} ₽")
    if zakl_total > 0:
        sec += 1
        lines.append(f"\n{sec}. Закладные:")
        if n_lyustra > 0 and price_zakl_lyustra:
            lines.append(f"  Под люстру планка  {n_lyustra} шт. × {price_zakl_lyustra} ₽ = {fmt(zakl_lyustra)} ₽")
        if n_svetilnik > 0 and price_zakl_svet:
            lines.append(f"  Под светильник ∅90  {n_svetilnik} шт. × {price_zakl_svet} ₽ = {fmt(zakl_svet)} ₽")
    if svet_total > 0 and price_svetilnik_full:
        sec += 1
        lines.append(f"\n{sec}. Освещение:")
        svet_only_total = n_svetilnik * price_svetilnik
        lamp_only_total = n_svetilnik * _lampa_price
        lines.append(f"  Светильник GX-53  {n_svetilnik} шт. × {price_svetilnik} ₽ = {fmt(svet_only_total)} ₽")
        lines.append(f"  Лампа GX-53  {n_svetilnik} шт. × {_lampa_price} ₽ = {fmt(lamp_only_total)} ₽")
    sec += 1
    lines.append(f"\n{sec}. Услуги монтажа:")
    if price_mount_canvas:
        lines.append(f"  Монтаж полотна {'ПВХ' if is_pvh else 'ТКАНЬ'}  {area} м² × {price_mount_canvas} ₽ = {fmt(mount_canvas)} ₽")
    if price_mount_profile:
        lines.append(f"  Монтаж профиля стандарт  {profile_len} мп × {price_mount_profile} ₽ = {fmt(mount_profile)} ₽")
    if mount_zakl > 0 and price_mount_zakl:
        lines.append(f"  Монтаж закладной  {n_lyustra + n_svetilnik} шт. × {price_mount_zakl} ₽ = {fmt(mount_zakl)} ₽")
    if mount_svet > 0 and price_mount_svet:
        lines.append(f"  Монтаж светильников GX-53  {n_svetilnik} шт. × {price_mount_svet} ₽ = {fmt(mount_svet)} ₽")
    if mount_razv > 0 and price_mount_razv:
        lines.append(f"  Монтаж разводки ГОСТ 0.75  {n_svetilnik} шт. × {price_mount_razv} ₽ = {fmt(mount_razv)} ₽")
    if mount_nisha > 0 and price_mount_nisha:
        lines.append(f"  Монтаж ниши  {nisha_len} мп × {price_mount_nisha} ₽ = {fmt(mount_nisha)} ₽")
    if dynamic_extras:
        sec += 1
        lines.append(f"\n{sec}. Дополнительно:")
        for name, qty, unit_price, total, unit in dynamic_extras:
            lines.append(f"  {name}  {qty} {unit} × {unit_price} ₽ = {fmt(total)} ₽")
    lines.append(f"\nИтоговая стоимость:")
    lines.append(f"{_econom_label}:   {fmt(econom)} ₽")
    lines.append(f"{_standard_label}: {fmt(standard)} ₽")
    lines.append(f"{_premium_label}:  {fmt(premium_price)} ₽")
    lines.append(f"\nНа какой день вас записать на бесплатный замер?")

    recognized = {
        'area': area, 'canvas': canvas_name, 'canvas_type': canvas_key,
        'perim': perim, 'n_lyustra': n_lyustra, 'n_svetilnik': n_svetilnik,
        'has_nisha': has_nisha, 'nisha_label': nisha_label if has_nisha else None,
        'nisha_len': nisha_len if has_nisha else None,
        'profile_len': profile_len, 'standard_total': standard,
    }
    return '\n'.join(lines), recognized
