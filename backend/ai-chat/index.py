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
        print(f"[calc] EXCEPTION: {e}")
        import traceback; traceback.print_exc()
        return None


def _try_simple_estimate_inner(text: str):
    import math as _math
    t = text.lower()
    unknown_words = _get_whitelist_unknown(t)
    if unknown_words:
        print(f"[calc] skip: unknown words {unknown_words[:5]} → LLM")
        return None
    if _NUMBERED_LIST_PAT.search(t):
        return None
    m = re.search(_NUM_WORD_PAT + r'\s*(?:м²|м2|кв\.?\s*м?|квадрат|кв\b)', t)
    if not m:
        m = re.search(r'(?:санузел|комнат|зал|спальн|кухн|прихожа|гостин|студи|детск|коридор|ванн|туалет)[^0-9а-яё]{0,20}?' + _NUM_WORD_PAT + r'\s*м\b', t)
        if not m:
            m = re.search(r'[-–]\s*' + _NUM_WORD_PAT + r'\s*м\b', t)
        if not m:
            return None
    area = _w2n(m.group(1))
    if area < 1 or area > 500:
        return None
    canvas_key = 'classic'
    if re.search(r'(ткань|тканев|дескор)', t): canvas_key = 'ткань'
    elif re.search(r'цветн', t): canvas_key = 'цветной'
    elif re.search(r'(bauf|бауф|немецк)', t): canvas_key = 'bauf'
    elif re.search(r'(evolution|эволюц)', t): canvas_key = 'evolution'
    elif re.search(r'(premium|премиум)', t): canvas_key = 'premium'
    _prices = get_canvas_prices()
    canvas_name, canvas_price = _prices.get(canvas_key, CANVAS_PRICES.get(canvas_key, ('MSD Classic матовый', 399)))
    perim = round(area * 1.3, 1)
    is_pvh = canvas_key != 'ткань'
    _rules = get_price_rules()
    _by_name = {r['name']: r for r in _rules}
    def p(name, fallback=0): return int(_by_name[name]['price']) if name in _by_name else fallback
    def _syn_pat(name, base):
        item = _by_name.get(name)
        if not item or not item.get('synonyms'): return base
        extras = [s.strip() for s in item['synonyms'].split(',') if s.strip()]
        return base + ('|' + '|'.join(re.escape(s) for s in extras) if extras else '')
    price_raskroy = p('Раскрой ПВХ')
    price_ogarp = p('Огарпунивание ПВХ')
    price_profile = p('Стеновой алюминиевый')
    price_zakl_lyustra = p('Под люстру планка')
    price_zakl_svet = p('Под светильник ∅90')
    price_svetilnik_full = p('Светильник GX-53 + лампа')
    _lampa_price = 100
    price_svetilnik = price_svetilnik_full - _lampa_price if price_svetilnik_full > _lampa_price else price_svetilnik_full
    price_mount_pvh = p('Монтаж полотна ПВХ')
    price_mount_tkань = p('Монтаж полотна ТКАНЬ')
    price_mount_profile = p('Монтаж профиля стандарт')
    price_mount_zakl = p('Монтаж закладной')
    price_mount_svet = p('Монтаж светильников GX-53')
    price_mount_razv = p('Монтаж разводки ГОСТ 0.75')
    price_mount_nisha = p('Монтаж ниши')
    _svet_syn = _syn_pat('Светильник GX-53 + лампа', r'светильник|gx.?53|вклейк')
    all_svet_nums = re.findall(_NUM_WORD_PAT + r'\s*(?:точечн\w*\s*)?(?:' + _svet_syn + r')', t)
    all_svet_nums += re.findall(r'добавить\s+(?:ещё\s+)?' + _NUM_WORD_PAT + r'\s*(?:точечн|светильник)?', t)
    all_svet_nums += re.findall(_NUM_WORD_PAT + r'\s*шт\.?\s*закладн\w*\s+под\s+(?:точечн\w*\s*)?светильник', t)
    all_svet_nums += re.findall(_NUM_WORD_PAT + r'\s*закладн\w*\s+под\s+(?:точечн\w*\s*)?светильник', t)
    n_svetilnik = sum(int(_w2n(x)) for x in all_svet_nums)
    lyustra_m = re.search(_NUM_WORD_PAT + r'?\s*люстр', t)
    lyustra_zakl_m = re.search(_NUM_WORD_PAT + r'\s*шт\.?\s*закладн\w*\s+под\s+люстр', t) or \
                     re.search(_NUM_WORD_PAT + r'\s*закладн\w*\s+под\s+люстр', t)
    if lyustra_zakl_m and lyustra_zakl_m.group(1): n_lyustra = int(_w2n(lyustra_zakl_m.group(1)))
    elif lyustra_m and lyustra_m.group(1): n_lyustra = int(_w2n(lyustra_m.group(1)))
    else: n_lyustra = 1 if lyustra_m else 0
    _nisha_pat = _syn_pat('Ниша без перегиба', r'ниш[аеуы]?\s*(?:для\s*штор)?|карниз|шторн|штор[аыуе]|гардин')
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
        _nisha_default = eval_calc_rule(_nisha_rule_item['calc_rule'] if _nisha_rule_item else 'perimeter*0.25', area, perim)
        nisha_len = float(_math.ceil(_nisha_default if _nisha_default is not None else perim * 0.25))
    nisha_price = 0; nisha_label = ''
    if has_nisha:
        pk_m = re.search(r'пк[- ]?(\d+)', t)
        pk = int(pk_m.group(1)) if pk_m else 0
        if pk == 12: nisha_price = p('Ниша ПК-12 (3 ряда)'); nisha_label = 'Ниша ПК-12 (3 ряда)'
        elif pk == 14: nisha_price = p('Ниша ПК-14 (2 ряда)'); nisha_label = 'Ниша ПК-14 (2 ряда)'
        elif pk == 15: nisha_price = p('Ниша ПК-15 (2 ряда)'); nisha_label = 'Ниша ПК-15 (2 ряда)'
        elif pk == 6: nisha_price = p('Парящий ПК-6 без рассеивателя'); nisha_label = 'Парящий ПК-6 без рассеивателя'
        elif re.search(r'sigma\s*led', t): nisha_price = p('Sigma LED'); nisha_label = 'Sigma LED'
        elif re.search(r'sigma', t): nisha_price = p('Sigma'); nisha_label = 'Sigma'
        elif re.search(r'брус|бп.?40', t): nisha_price = p('БП-40'); nisha_label = 'БП-40'
        else: nisha_price = p('Ниша без перегиба'); nisha_label = 'Ниша без перегиба'
    _BUILTIN_NAMES = {
        'Раскрой ПВХ', 'Огарпунивание ПВХ', 'Стеновой алюминиевый', 'Стеновой ПВХ',
        'Под люстру планка', 'Под люстру крюк', 'Под люстру крестовина',
        'Под светильник ∅90', 'Под светильник ∅100-300', 'Под светильник ∅300-600',
        'Светильник GX-53 + лампа', 'Монтаж полотна ПВХ', 'Монтаж полотна ТКАНЬ',
        'Монтаж профиля стандарт', 'Монтаж парящего профиля', 'Монтаж закладной',
        'Монтаж светильников GX-53', 'Монтаж разводки ГОСТ 0.75',
        'Ниша без перегиба', 'Ниша с перегибом', 'Ниша ПК-12 (3 ряда)',
        'Ниша ПК-14 (2 ряда)', 'Ниша ПК-15 (2 ряда)', 'Парящий ПК-6 без рассеивателя',
        'Sigma LED', 'Sigma', 'БП-40',
    }
    dynamic_extras = []
    for rule in _rules:
        if rule['name'] in _BUILTIN_NAMES: continue
        syns = [s.strip() for s in rule['synonyms'].split(',') if s.strip()] if rule['synonyms'] else []
        kws = [rule['name']] + syns
        pat = '|'.join(re.escape(k) for k in kws)
        if not re.search(pat, t, re.IGNORECASE): continue
        unit_price = int(rule['price']) if rule['price'] else 0
        calc = rule['calc_rule'] or ''
        qty_m = re.search(_NUM_WORD_PAT + r'\s*(?:' + pat + r')', t, re.IGNORECASE) or \
                re.search(r'(?:' + pat + r')\s*' + _NUM_WORD_PAT, t, re.IGNORECASE)
        if qty_m:
            try: qty = _w2n(qty_m.group(1))
            except: qty = 1
        elif calc: qty = eval_calc_rule(calc, area, perim) or 1
        else: qty = 1
        total = round(qty * unit_price)
        dynamic_extras.append((rule['name'], qty, unit_price, total, rule['unit'] or 'шт'))
    print(f"[calc] area={area} perim={perim} n_lyustra={n_lyustra} n_svetilnik={n_svetilnik}")
    canvas_total = round(area * canvas_price)
    raskroy = round(area * price_raskroy) if is_pvh else 0
    ogarp = round(area * price_ogarp) if is_pvh else 0
    profile_len = round(_math.ceil(perim / 2) * 2, 1)
    profile_total = round(profile_len * price_profile)
    nisha_total = round(nisha_len * nisha_price) if has_nisha else 0
    zakl_lyustra = n_lyustra * price_zakl_lyustra
    zakl_svet = n_svetilnik * price_zakl_svet
    zakl_total = zakl_lyustra + zakl_svet
    svet_total = n_svetilnik * price_svetilnik_full
    price_mount_canvas = price_mount_pvh if is_pvh else price_mount_tkань
    mount_canvas = round(area * price_mount_canvas)
    mount_profile = round(profile_len * price_mount_profile)
    mount_zakl = (n_lyustra + n_svetilnik) * price_mount_zakl if (n_lyustra + n_svetilnik) > 0 else 0
    mount_svet = n_svetilnik * price_mount_svet
    mount_razv = n_svetilnik * price_mount_razv if n_svetilnik > 0 else 0
    mount_nisha = round(nisha_len * price_mount_nisha) if has_nisha and price_mount_nisha else 0
    dynamic_total = sum(x[3] for x in dynamic_extras)
    standard = (canvas_total + raskroy + ogarp + profile_total + nisha_total +
                zakl_total + svet_total + mount_canvas + mount_profile +
                mount_zakl + mount_svet + mount_razv + mount_nisha + dynamic_total)
    _econom_mult = 0.85; _premium_mult = 1.27
    _econom_label = "Econom"; _standard_label = "Standard"; _premium_label = "Premium"
    try:
        _c2 = psycopg2.connect(os.environ['DATABASE_URL']); _cu2 = _c2.cursor()
        _cu2.execute(f"SELECT econom_mult, premium_mult, econom_label, standard_label, premium_label FROM {SCHEMA}.pricing_settings LIMIT 1")
        _r2 = _cu2.fetchone()
        if _r2: _econom_mult, _premium_mult, _econom_label, _standard_label, _premium_label = float(_r2[0]), float(_r2[1]), _r2[2], _r2[3], _r2[4]
        _c2.close()
    except: pass
    econom = round(standard * _econom_mult); premium_p = round(standard * _premium_mult)
    def fmt(n): return f"{n:,}".replace(',', ' ')
    sec = 1; lines = []
    lines.append(f"{sec}. Полотно:")
    lines.append(f"  {canvas_name}  {area} м² × {canvas_price} ₽ = {fmt(canvas_total)} ₽")
    if is_pvh:
        if price_raskroy: lines.append(f"  Раскрой ПВХ  {area} м² × {price_raskroy} ₽ = {fmt(raskroy)} ₽")
        if price_ogarp: lines.append(f"  Огарпунивание ПВХ  {area} м² × {price_ogarp} ₽ = {fmt(ogarp)} ₽")
    if price_profile:
        sec += 1; lines.append(f"\n{sec}. Профиль:")
        lines.append(f"  Стеновой алюминиевый  {profile_len} мп × {price_profile} ₽ = {fmt(profile_total)} ₽")
    if has_nisha:
        sec += 1; lines.append(f"\n{sec}. Ниши для штор:")
        lines.append(f"  {nisha_label}  {nisha_len} мп × {nisha_price} ₽ = {fmt(nisha_total)} ₽")
    if zakl_total > 0:
        sec += 1; lines.append(f"\n{sec}. Закладные:")
        if n_lyustra > 0 and price_zakl_lyustra: lines.append(f"  Под люстру планка  {n_lyustra} шт. × {price_zakl_lyustra} ₽ = {fmt(zakl_lyustra)} ₽")
        if n_svetilnik > 0 and price_zakl_svet: lines.append(f"  Под светильник ∅90  {n_svetilnik} шт. × {price_zakl_svet} ₽ = {fmt(zakl_svet)} ₽")
    if svet_total > 0 and price_svetilnik_full:
        sec += 1; lines.append(f"\n{sec}. Освещение:")
        lines.append(f"  Светильник GX-53  {n_svetilnik} шт. × {price_svetilnik} ₽ = {fmt(n_svetilnik * price_svetilnik)} ₽")
        lines.append(f"  Лампа GX-53  {n_svetilnik} шт. × {_lampa_price} ₽ = {fmt(n_svetilnik * _lampa_price)} ₽")
    sec += 1; lines.append(f"\n{sec}. Услуги монтажа:")
    if price_mount_canvas: lines.append(f"  Монтаж полотна {'ПВХ' if is_pvh else 'ТКАНЬ'}  {area} м² × {price_mount_canvas} ₽ = {fmt(mount_canvas)} ₽")
    if price_mount_profile: lines.append(f"  Монтаж профиля стандарт  {profile_len} мп × {price_mount_profile} ₽ = {fmt(mount_profile)} ₽")
    if mount_zakl > 0 and price_mount_zakl: lines.append(f"  Монтаж закладной  {n_lyustra + n_svetilnik} шт. × {price_mount_zakl} ₽ = {fmt(mount_zakl)} ₽")
    if mount_svet > 0 and price_mount_svet: lines.append(f"  Монтаж светильников GX-53  {n_svetilnik} шт. × {price_mount_svet} ₽ = {fmt(mount_svet)} ₽")
    if mount_razv > 0 and price_mount_razv: lines.append(f"  Монтаж разводки ГОСТ 0.75  {n_svetilnik} шт. × {price_mount_razv} ₽ = {fmt(mount_razv)} ₽")
    if mount_nisha > 0 and price_mount_nisha: lines.append(f"  Монтаж ниши  {nisha_len} мп × {price_mount_nisha} ₽ = {fmt(mount_nisha)} ₽")
    if dynamic_extras:
        sec += 1; lines.append(f"\n{sec}. Дополнительно:")
        for name, qty, unit_price, total, unit in dynamic_extras:
            lines.append(f"  {name}  {qty} {unit} × {unit_price} ₽ = {fmt(total)} ₽")
    lines.append(f"\nИтоговая стоимость:")
    lines.append(f"{_econom_label}:   {fmt(econom)} ₽")
    lines.append(f"{_standard_label}: {fmt(standard)} ₽")
    lines.append(f"{_premium_label}:  {fmt(premium_p)} ₽")
    lines.append(f"\nНа какой день вас записать на бесплатный замер?")
    recognized = {
        'area': area, 'canvas': canvas_name, 'canvas_type': canvas_key, 'perim': perim,
        'n_lyustra': n_lyustra, 'n_svetilnik': n_svetilnik, 'has_nisha': has_nisha,
        'nisha_label': nisha_label if has_nisha else None, 'nisha_len': nisha_len if has_nisha else None,
        'profile_len': profile_len, 'standard_total': standard,
    }
    return '\n'.join(lines), recognized


def _build_price_map(rules: list) -> dict:
    price_map = {}
    for r in rules:
        name_low = r['name'].lower().strip()
        entry = {'price': r['price'], 'unit': r['unit'], 'name': r['name']}
        price_map[name_low] = entry
        if r.get('synonyms'):
            for syn in r['synonyms'].split(','):
                syn = syn.strip().lower()
                if syn:
                    price_map[syn] = entry
    return price_map


def _find_in_price_map(name: str, price_map: dict):
    nl = name.lower().strip()
    if nl in price_map: return price_map[nl]
    best = None; best_len = 0
    for k, v in price_map.items():
        if not k: continue
        if nl.startswith(k) and len(k) > best_len: best = v; best_len = len(k)
    if best: return best
    for k, v in price_map.items():
        if k and k.startswith(nl) and len(nl) > best_len: best = v; best_len = len(nl)
    if best: return best
    nl_words = set(w for w in re.findall(r'[а-яёa-z0-9]+', nl) if len(w) > 2)
    if len(nl_words) >= 2:
        best_overlap = 0
        for k, v in price_map.items():
            k_words = set(w for w in re.findall(r'[а-яёa-z0-9]+', k) if len(w) > 2)
            overlap = len(nl_words & k_words)
            if overlap >= 2 and overlap > best_overlap:
                if overlap / max(len(nl_words), len(k_words)) >= 0.7:
                    best_overlap = overlap; best = v
    return best


def _render_estimate_from_items(items: list, area: float = 0) -> str:
    def fmt(n) -> str: return f"{int(round(n)):,}".replace(',', ' ')
    BLOCK_ORDER = ['Полотно', 'Профиль', 'Закладные', 'Освещение', 'Ниши', 'Работы на высоте', 'Услуги монтажа', 'Прочее']
    def _guess_block(name: str) -> str:
        n = name.lower()
        if any(w in n for w in ['монтаж', 'установка', 'разводка']): return 'Услуги монтажа'
        if any(w in n for w in ['полотно', 'раскрой', 'огарпунивание', 'ткань', 'msd', 'глянец', 'матов', 'сатин']): return 'Полотно'
        if any(w in n for w in ['профиль', 'алюминий', 'алюминиевый', 'стеновой', 'потолочный', 'теневой', 'flexy', 'парящий', 'fly', 'брус']): return 'Профиль'
        if any(w in n for w in ['закладная', 'под люстру', 'под светильник', 'под вентилятор']): return 'Закладные'
        if any(w in n for w in ['светильник', 'лента', 'блок питания', 'диммер', 'gx-53']): return 'Освещение'
        if any(w in n for w in ['ниша', 'карниз', 'пк-14', 'штора']): return 'Ниши'
        if any(w in n for w in ['высота', 'лестниц']): return 'Работы на высоте'
        return 'Прочее'
    blocks = {}
    for it in items:
        guessed = _guess_block(it['name'])
        llm_cat = it.get('category', '')
        block = 'Услуги монтажа' if guessed == 'Услуги монтажа' and llm_cat != 'Услуги монтажа' else (llm_cat or guessed)
        blocks.setdefault(block, []).append(it)
    _FLOAT_KW = ['парящий', 'flexy', 'fly', 'пк-6']
    _SHADOW_KW = ['теневой', 'eurokraab', 'тень']
    _STD_KW = ['стеновой алюминиевый', 'потолочный алюминиевый', 'стеновой пвх']
    float_len = sum(float(it.get('qty', 0)) for it in items if any(w in it['name'].lower() for w in _FLOAT_KW) and 'монтаж' not in it['name'].lower())
    shadow_len = sum(float(it.get('qty', 0)) for it in items if any(w in it['name'].lower() for w in _SHADOW_KW) and 'монтаж' not in it['name'].lower())
    deduct = float_len + shadow_len
    if deduct > 0:
        for it in items:
            if any(it['name'].lower() == kw for kw in _STD_KW):
                new_qty = max(0, float(it['qty']) - deduct)
                if new_qty != float(it['qty']): it['qty'] = new_qty
    lines = []; block_num = 1; standard = 0
    for block_name in BLOCK_ORDER:
        if block_name not in blocks: continue
        lines.append(f"{block_num}. {block_name}:")
        for it in blocks[block_name]:
            qty = it['qty']; price = int(it['price'])
            unit = it.get('unit', 'шт'); discount = float(it.get('_discount') or 0)
            total = round(qty * price * (1 - discount / 100)); standard += total
            qty_display = int(qty) if float(qty) == int(qty) else qty
            lines.append(f"{it['name']}  {qty_display} {unit} × {fmt(price)} ₽ = {fmt(total)} ₽")
        lines.append(''); block_num += 1
    econom = round(standard * 0.77); premium = round(standard * 1.27)
    lines.append(f"Econom:   {fmt(econom)} ₽")
    lines.append(f"Standard: {fmt(standard)} ₽")
    lines.append(f"Premium:  {fmt(premium)} ₽")
    lines.append(''); lines.append("На какой день вас записать на бесплатный замер?")
    return '\n'.join(lines)


def _apply_edit_patch(prev_items: list, patch: dict, price_map: dict) -> list:
    import copy
    result = copy.deepcopy(prev_items)
    discount = float(patch.get('discount_percent') or 0)
    if discount > 0:
        for it in result: it['_discount'] = discount
    for name_to_remove in patch.get('remove', []):
        nl = name_to_remove.lower().strip()
        result = [it for it in result if it['name'].lower().strip() != nl]
    for upd in patch.get('update', []):
        nl = upd['name'].lower().strip()
        for it in result:
            if it['name'].lower().strip() == nl: it['qty'] = upd['qty']; break
    existing_names = {it['name'].lower().strip() for it in result}
    for new_it in patch.get('add', []):
        nl = new_it['name'].lower().strip()
        if nl in existing_names:
            for it in result:
                if it['name'].lower().strip() == nl: it['qty'] = round(it['qty'] + new_it.get('qty', 1), 2); break
            continue
        fuzzy = _find_in_price_map(new_it['name'], {it['name'].lower(): it for it in result})
        if fuzzy:
            for it in result:
                if it['name'].lower().strip() == fuzzy['name'].lower().strip():
                    it['qty'] = round(it['qty'] + new_it.get('qty', 1), 2); break
            continue
        db_entry = price_map.get(nl) or _find_in_price_map(new_it['name'], price_map)
        result.append({
            'name': db_entry['name'] if db_entry else new_it['name'],
            'qty': new_it['qty'],
            'price': db_entry['price'] if db_entry else new_it.get('price', 0),
            'unit': db_entry['unit'] if db_entry else new_it.get('unit', 'шт'),
            'category': new_it.get('category', ''),
        })
        existing_names.add((db_entry['name'] if db_entry else new_it['name']).lower().strip())
    return result


def _calc_bundle_qty(trigger_qty: float, bundle_rule: dict) -> float:
    import math as _m
    calc = (bundle_rule.get('calc_rule') or '').lower()
    m = re.search(r'кратно\s+(\d+)\s*м', calc)
    if m: return max(1, _m.ceil(trigger_qty / int(m.group(1))))
    pairs = re.findall(r'до\s+(\d+)\s*м[^→]*→\s*(\d+)\s*вт', calc)
    if pairs:
        for limit_str, _ in sorted(pairs, key=lambda p: int(p[0])):
            if trigger_qty <= int(limit_str): return 1
        return 1
    if re.search(r'количество\s*=\s*1|фиксированно\s+1|\b1\s+шт', calc): return 1
    return trigger_qty


def _select_bundle_item_by_calc(bundle_ids: list, id_to_rule: dict, trigger_qty: float) -> list:
    power_group = []; regular = []
    for bid in bundle_ids:
        rule = id_to_rule.get(bid)
        if not rule: continue
        calc = (rule.get('calc_rule') or '').lower()
        if re.search(r'до\s+\d+\s*м[^→]*→\s*\d+\s*вт', calc): power_group.append(rule)
        else: regular.append(rule)
    result = list(regular)
    if power_group:
        def get_min(r):
            pairs = re.findall(r'до\s+(\d+)\s*м', (r.get('calc_rule') or '').lower())
            return int(pairs[0]) if pairs else 9999
        power_group_sorted = sorted(power_group, key=get_min)
        chosen = next((r for r in power_group_sorted if trigger_qty <= get_min(r)), power_group_sorted[-1])
        result.append(chosen)
    return result


def _apply_bundles(items: list, rules: list) -> list:
    if not rules or not items: return items
    id_to_rule = {r['id']: r for r in rules}
    name_to_rule = {}
    for r in rules:
        name_to_rule[r['name'].lower().strip()] = r
        for syn in (r.get('synonyms') or '').split(','):
            s = syn.strip().lower()
            if s: name_to_rule[s] = r
    existing_names = {it.get('name', '').lower().strip() for it in items}
    items_to_add = []
    for item in items:
        item_name_low = item.get('name', '').lower().strip()
        rule = name_to_rule.get(item_name_low)
        if not rule:
            for rule_name, r in name_to_rule.items():
                if rule_name in item_name_low or item_name_low in rule_name: rule = r; break
        if not rule: continue
        try: bundle_ids = json.loads(rule.get('bundle') or '[]')
        except: continue
        if not bundle_ids: continue
        trigger_qty = float(item.get('qty', 1)); tape_qty = trigger_qty
        for bundle_rule in _select_bundle_item_by_calc(bundle_ids, id_to_rule, trigger_qty):
            bundle_name_low = bundle_rule['name'].lower().strip()
            if bundle_name_low in existing_names: continue
            calc = (bundle_rule.get('calc_rule') or '').lower()
            is_tape = bool(re.search(r'кратно\s+\d+\s*м', calc))
            is_power = bool(re.search(r'до\s+\d+\s*м[^→]*→\s*\d+\s*вт', calc))
            if is_tape:
                qty = _calc_bundle_qty(trigger_qty, bundle_rule)
                step_m = re.search(r'кратно\s+(\d+)\s*м', calc)
                if step_m: tape_qty = qty * int(step_m.group(1))
            elif is_power: qty = _calc_bundle_qty(tape_qty, bundle_rule)
            else: qty = _calc_bundle_qty(trigger_qty, bundle_rule)
            items_to_add.append({
                'name': bundle_rule['name'], 'qty': qty,
                'price': bundle_rule.get('price', 0), 'unit': bundle_rule.get('unit', 'шт'),
                'category': bundle_rule.get('category', ''),
            })
            existing_names.add(bundle_name_low)
    return items + items_to_add


FAQ_CACHE = {
    r"(крым|донецк|луганск|лнр|днр|украина|аннекс|оккупац|территори)": "Политику не обсуждаю — я AI-сметчик натяжных потолков.\n\nНазовите площадь комнаты — сделаю расчёт.",
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
        for suffix in [']}', '"]}}', '"}]}', '"]]}', '}}', ']}}']:
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
            content = call_llm(plan_msgs)
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