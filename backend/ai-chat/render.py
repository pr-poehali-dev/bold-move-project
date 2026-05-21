"""Рендер сметы из items, edit-patch, bundle-правила, price-map helpers."""
import copy
import json
import math
import re

from db import get_price_rules, SCHEMA


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


def _find_in_price_map(name: str, price_map: dict) -> dict | None:
    nl = name.lower().strip()
    if nl in price_map:
        return price_map[nl]
    best = None
    best_len = 0
    for k, v in price_map.items():
        if not k:
            continue
        if nl.startswith(k) and len(k) > best_len:
            best = v; best_len = len(k)
    if best:
        return best
    for k, v in price_map.items():
        if k and k.startswith(nl) and len(nl) > best_len:
            best = v; best_len = len(nl)
    if best:
        return best
    nl_words = set(w for w in re.findall(r'[а-яёa-z0-9]+', nl) if len(w) > 2)
    if len(nl_words) >= 2:
        best_overlap = 0
        for k, v in price_map.items():
            k_words = set(w for w in re.findall(r'[а-яёa-z0-9]+', k) if len(w) > 2)
            overlap = len(nl_words & k_words)
            if overlap >= 2 and overlap > best_overlap:
                coverage = overlap / max(len(nl_words), len(k_words))
                if coverage >= 0.7:
                    best_overlap = overlap; best = v
    return best


def _render_estimate_from_items(items: list, area: float = 0) -> str:
    def fmt(n) -> str:
        return f"{int(round(n)):,}".replace(',', ' ')

    BLOCK_ORDER = ['Полотно', 'Профиль', 'Закладные', 'Освещение', 'Ниши', 'Работы на высоте', 'Услуги монтажа', 'Прочее']

    def _guess_block(name: str) -> str:
        n = name.lower()
        if any(w in n for w in ['монтаж', 'установка', 'разводка']):
            return 'Услуги монтажа'
        if any(w in n for w in ['полотно', 'раскрой', 'огарпунивание', 'ткань', 'msd', 'halead', 'глянец', 'матов', 'сатин']):
            return 'Полотно'
        if any(w in n for w in ['профиль', 'алюминий', 'алюминиевый', 'стеновой', 'потолочный', 'теневой', 'flexy', 'парящий', 'fly', 'брус']):
            return 'Профиль'
        if any(w in n for w in ['закладная', 'под люстру', 'под светильник', 'под вентилятор', 'под пожар']):
            return 'Закладные'
        if any(w in n for w in ['светильник', 'лента', 'блок питания', 'диммер', 'gx-53']):
            return 'Освещение'
        if any(w in n for w in ['ниша', 'карниз', 'пк-14', 'штора']):
            return 'Ниши'
        if any(w in n for w in ['высота', 'лестниц']):
            return 'Работы на высоте'
        return 'Прочее'

    blocks = {}
    for it in items:
        guessed = _guess_block(it['name'])
        llm_category = it.get('category', '')
        if guessed == 'Услуги монтажа' and llm_category != 'Услуги монтажа':
            block = 'Услуги монтажа'
        else:
            block = llm_category or guessed
        blocks.setdefault(block, []).append(it)

    _FLOATING_KEYWORDS = ['парящий', 'flexy', 'fly', 'пк-6']
    _SHADOW_KEYWORDS   = ['теневой', 'eurokraab', 'тень']
    _STANDARD_KEYWORDS = ['стеновой алюминиевый', 'потолочный алюминиевый', 'стеновой пвх']

    floating_total_len = sum(
        float(it.get('qty', 0)) for it in items
        if any(w in it['name'].lower() for w in _FLOATING_KEYWORDS) and 'монтаж' not in it['name'].lower()
    )
    shadow_total_len = sum(
        float(it.get('qty', 0)) for it in items
        if any(w in it['name'].lower() for w in _SHADOW_KEYWORDS) and 'монтаж' not in it['name'].lower()
    )
    deduct_len = floating_total_len + shadow_total_len
    if deduct_len > 0:
        for it in items:
            if any(it['name'].lower() == kw for kw in _STANDARD_KEYWORDS):
                new_qty = max(0, float(it['qty']) - deduct_len)
                if new_qty != float(it['qty']):
                    print(f"[profile] deduct {deduct_len}м from '{it['name']}': {it['qty']} → {new_qty}")
                    it['qty'] = new_qty

    def _pluralize_unit(unit: str, qty) -> str:
        q = abs(float(qty))
        if unit == 'катушка':
            if q == 1: return 'катушка'
            elif 2 <= q <= 4: return 'катушки'
            else: return 'катушек'
        return unit

    lines = []
    block_num = 1
    standard = 0
    for block_name in BLOCK_ORDER:
        if block_name not in blocks:
            continue
        lines.append(f"{block_num}. {block_name}:")
        for it in blocks[block_name]:
            qty = it['qty']
            price = int(it['price'])
            unit = _pluralize_unit(it.get('unit', 'шт'), qty)
            discount = float(it.get('_discount') or 0)
            total = round(qty * price * (1 - discount / 100))
            standard += total
            qty_display = int(qty) if float(qty) == int(qty) else qty
            lines.append(f"{it['name']}  {qty_display} {unit} × {fmt(price)} ₽ = {fmt(total)} ₽")
        lines.append('')
        block_num += 1

    econom = round(standard * 0.77)
    premium = round(standard * 1.27)
    lines.append(f"Econom:   {fmt(econom)} ₽")
    lines.append(f"Standard: {fmt(standard)} ₽")
    lines.append(f"Premium:  {fmt(premium)} ₽")
    lines.append('')
    lines.append("На какой день вас записать на бесплатный замер?")
    print(f"[render] standard={standard} econom={econom} premium={premium} items={len(items)}")
    return '\n'.join(lines)


def _apply_edit_patch(prev_items: list, patch: dict, price_map: dict) -> list:
    result = copy.deepcopy(prev_items)
    discount = float(patch.get('discount_percent') or 0)
    if discount > 0:
        for it in result:
            it['_discount'] = discount
    for name_to_remove in patch.get('remove', []):
        name_low = name_to_remove.lower().strip()
        result = [it for it in result if it['name'].lower().strip() != name_low]
        print(f"[patch] removed: {name_to_remove}")
    for upd in patch.get('update', []):
        name_low = upd['name'].lower().strip()
        for it in result:
            if it['name'].lower().strip() == name_low:
                it['qty'] = upd['qty']
                print(f"[patch] updated qty: {upd['name']} → {upd['qty']}")
                break
    existing_names = {it['name'].lower().strip() for it in result}
    for new_it in patch.get('add', []):
        name_low = new_it['name'].lower().strip()
        if name_low in existing_names:
            for it in result:
                if it['name'].lower().strip() == name_low:
                    it['qty'] = round(it['qty'] + new_it.get('qty', 1), 2)
                    break
            continue
        fuzzy = _find_in_price_map(new_it['name'], {it['name'].lower(): it for it in result})
        if fuzzy:
            for it in result:
                if it['name'].lower().strip() == fuzzy['name'].lower().strip():
                    it['qty'] = round(it['qty'] + new_it.get('qty', 1), 2)
                    break
            continue
        db_entry = price_map.get(name_low) or _find_in_price_map(new_it['name'], price_map)
        price = db_entry['price'] if db_entry else new_it.get('price', 0)
        unit = db_entry['unit'] if db_entry else new_it.get('unit', 'шт')
        actual_name = db_entry['name'] if db_entry else new_it['name']
        result.append({
            'name': actual_name, 'qty': new_it['qty'], 'price': price,
            'unit': unit, 'category': new_it.get('category', ''),
        })
        existing_names.add(actual_name.lower().strip())
        print(f"[patch] added: {actual_name} qty={new_it['qty']} price={price}")
    return result


def _calc_bundle_qty(trigger_qty: float, bundle_rule: dict) -> float:
    calc = (bundle_rule.get('calc_rule') or '').lower()
    m = re.search(r'кратно\s+(\d+)\s*м', calc)
    if m:
        step = int(m.group(1))
        rolls = math.ceil(trigger_qty / step)
        return max(1, rolls)
    pairs = re.findall(r'до\s+(\d+)\s*м[^→]*→\s*(\d+)\s*вт', calc)
    if pairs:
        for limit_str, _ in sorted(pairs, key=lambda p: int(p[0])):
            if trigger_qty <= int(limit_str):
                return 1
        return 1
    if re.search(r'количество\s*=\s*1|фиксированно\s+1|\b1\s+шт', calc):
        return 1
    return trigger_qty


def _select_bundle_item_by_calc(bundle_ids: list, id_to_rule: dict, trigger_qty: float) -> list:
    power_group = []
    regular = []
    for bid in bundle_ids:
        rule = id_to_rule.get(bid)
        if not rule:
            continue
        calc = (rule.get('calc_rule') or '').lower()
        if re.search(r'до\s+\d+\s*м[^→]*→\s*\d+\s*вт', calc):
            power_group.append(rule)
        else:
            regular.append(rule)
    result = list(regular)
    if power_group:
        def get_min_limit(r):
            pairs = re.findall(r'до\s+(\d+)\s*м', (r.get('calc_rule') or '').lower())
            return int(pairs[0]) if pairs else 9999
        power_group_sorted = sorted(power_group, key=get_min_limit)
        chosen = None
        for r in power_group_sorted:
            pairs = re.findall(r'до\s+(\d+)\s*м', (r.get('calc_rule') or '').lower())
            limit = int(pairs[0]) if pairs else 9999
            if trigger_qty <= limit:
                chosen = r; break
        if not chosen:
            chosen = power_group_sorted[-1]
        result.append(chosen)
    return result


def _apply_bundles(items: list, rules: list) -> list:
    if not rules or not items:
        return items
    id_to_rule = {r['id']: r for r in rules}
    name_to_rule = {}
    for r in rules:
        name_to_rule[r['name'].lower().strip()] = r
        for syn in (r.get('synonyms') or '').split(','):
            s = syn.strip().lower()
            if s:
                name_to_rule[s] = r
    existing_names = {it.get('name', '').lower().strip() for it in items}
    items_to_add = []
    for item in items:
        item_name_low = item.get('name', '').lower().strip()
        rule = name_to_rule.get(item_name_low)
        if not rule:
            for rule_name, r in name_to_rule.items():
                if rule_name in item_name_low or item_name_low in rule_name:
                    rule = r; break
        if not rule:
            continue
        bundle_raw = rule.get('bundle') or '[]'
        try:
            bundle_ids = json.loads(bundle_raw)
        except Exception:
            continue
        if not bundle_ids:
            continue
        trigger_qty = float(item.get('qty', 1))
        tape_qty = trigger_qty
        selected_rules = _select_bundle_item_by_calc(bundle_ids, id_to_rule, trigger_qty)
        for bundle_rule in selected_rules:
            bundle_name_low = bundle_rule['name'].lower().strip()
            if bundle_name_low in existing_names:
                continue
            calc = (bundle_rule.get('calc_rule') or '').lower()
            is_tape = bool(re.search(r'кратно\s+\d+\s*м', calc))
            is_power = bool(re.search(r'до\s+\d+\s*м[^→]*→\s*\d+\s*вт', calc))
            if is_tape:
                qty = _calc_bundle_qty(trigger_qty, bundle_rule)
                step_m = re.search(r'кратно\s+(\d+)\s*м', calc)
                if step_m:
                    tape_qty = qty * int(step_m.group(1))
            elif is_power:
                qty = _calc_bundle_qty(tape_qty, bundle_rule)
            else:
                qty = _calc_bundle_qty(trigger_qty, bundle_rule)
            items_to_add.append({
                'name': bundle_rule['name'], 'qty': qty,
                'price': bundle_rule.get('price', 0),
                'unit': bundle_rule.get('unit', 'шт'),
                'category': bundle_rule.get('category', ''),
            })
            existing_names.add(bundle_name_low)
            print(f"[bundle] auto-added: {bundle_rule['name']} qty={qty}")
    return items + items_to_add
