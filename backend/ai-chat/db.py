"""Database helpers: knowledge base, system prompt, FAQ cache, prices, rules. v2."""

import os
import re
import json
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

# Fallback canvas prices used when DB is unavailable
CANVAS_PRICES = {
    'classic': ('MSD Classic матовый', 399),
    'premium': ('MSD Premium матовый', 460),
    'evolution': ('MSD Evolution матовый', 490),
    'bauf': ('BAUF Германия матовый', 499),
    'цветной': ('Цветной MSD', 900),
    'ткань': ('Тканевый ДЕСКОР', 2200),
}


def get_knowledge(query: str) -> str:
    """Загружает все активные записи из faq_items и возвращает как контекст."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"SELECT title, content FROM {SCHEMA}.faq_items WHERE used = true ORDER BY id"
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        if not rows:
            return ''
        parts = []
        for title, content in rows:
            parts.append(f"=== {title} ===\n{content}")
        return '\n\n'.join(parts)
    except Exception as e:
        print(f"[KB] error: {e}")
        return ''


def get_system_prompt(fallback: str = '') -> str:
    """Загружает системный промпт из БД. Если нет — возвращает fallback."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT content FROM {SCHEMA}.ai_system_prompt ORDER BY id LIMIT 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row and row[0]:
            # Убираем служебные маркеры разделов — они нужны только редактору
            content = row[0]
            for marker in ('##GENERAL##', '##SYSTEM##', '##FORMAT##'):
                content = content.replace(marker, '')
            return content.strip()
    except Exception as e:
        print(f"[prompt] error: {e}")
    return fallback


def get_faq_cache(fallback: dict | None = None) -> dict:
    """Загружает быстрые ответы из БД. Если нет — возвращает fallback."""
    if fallback is None:
        fallback = {}
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT pattern, answer FROM {SCHEMA}.ai_quick_questions WHERE active = true ORDER BY id")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        if rows:
            return {r[0]: r[1] for r in rows}
    except Exception as e:
        print(f"[faq_cache] error: {e}")
    return fallback


def get_prices_block() -> str:
    """Загружает цены из БД и формирует блок для SYSTEM_PROMPT. Если нет — возвращает пустую строку."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT category, name, price, unit FROM {SCHEMA}.ai_prices WHERE active = true ORDER BY sort_order, id")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        if not rows:
            return ''
        lines = []
        current_cat = None
        for category, name, price, unit in rows:
            if category != current_cat:
                current_cat = category
                lines.append(f"\n{category.upper()}:")
            lines.append(f"{name} — {price} ₽/{unit}")
        return '\n'.join(lines)
    except Exception as e:
        print(f"[prices] error: {e}")
        return ''


def get_canvas_prices() -> dict:
    """Загружает цены на полотна из БД для детерминированного расчёта."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT name, price FROM {SCHEMA}.ai_prices WHERE category = 'Полотна' AND active = true ORDER BY sort_order")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        if not rows:
            return CANVAS_PRICES
        mapping = {}
        for name, price in rows:
            nl = name.lower()
            if 'classic' in nl:        mapping['classic']  = (name, price)
            elif 'premium' in nl:      mapping['premium']  = (name, price)
            elif 'evolution' in nl:    mapping['evolution'] = (name, price)
            elif 'bauf' in nl or 'германия' in nl: mapping['bauf'] = (name, price)
            elif 'цветной' in nl:      mapping['цветной']  = (name, price)
            elif 'тканев' in nl or 'дескор' in nl: mapping['ткань'] = (name, price)
        return {**CANVAS_PRICES, **mapping} if mapping else CANVAS_PRICES
    except Exception as e:
        print(f"[canvas_prices] error: {e}")
        return CANVAS_PRICES


def get_price_rules() -> list:
    """Загружает все активные позиции с calc_rule, when_condition и bundle из БД."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"""
            SELECT id, category, name, price, unit, calc_rule, bundle, synonyms, when_condition, when_not_condition, client_changes
            FROM {SCHEMA}.ai_prices
            WHERE active = true
            ORDER BY sort_order, id
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        result = []
        for row in rows:
            result.append({
                'id': row[0], 'category': row[1], 'name': row[2],
                'price': row[3], 'unit': row[4],
                'calc_rule': row[5] or '', 'bundle': row[6] or '[]',
                'synonyms': row[7] or '', 'when_condition': row[8] or '',
                'when_not_condition': row[9] or '', 'client_changes': row[10] or ''
            })
        return result
    except Exception as e:
        print(f"[price_rules] error: {e}")
        return []


def eval_calc_rule(rule: str, area: float, perim: float) -> float | None:
    """Вычисляет количество по правилу — понимает свободный текст и формулы.

    Поддерживаемые форматы (клиент пишет в свободной форме):
      - «площадь» / «= площадь» → area
      - «периметр» / «= периметр» → perim
      - «площадь × 1.3» / «площадь * 1.3» → area * 1.3
      - «периметр + 10%» → perim * 1.1
      - «площадь + стандартный профиль» → просто area (LLM разберёт остаток)
      - «1 штука» / «фиксированно 1» / «всегда 1» → 1.0
      - «area * 1.3» / «perimeter» (старый формат) → тоже работает
    """
    if not rule:
        return None
    r = rule.strip().lower()

    # Нормализуем текстовые синонимы → переменные
    r = re.sub(r'площадь\s*комнаты|площадь\s*полотна|площадь', 'area', r)
    r = re.sub(r'периметр\s*комнаты|периметр', 'perimeter', r)
    r = re.sub(r'perimetr|периметр', 'perimeter', r)

    # «фиксированно N» / «всегда N» / «N штук» / «= N»
    m = re.search(r'(?:фиксированно|всегда|const:|=\s*)(\d+(?:[.,]\d+)?)\s*(?:шт|штук)?', r)
    if m:
        return float(m.group(1).replace(',', '.'))

    # «X%» прибавка: «площадь + 30%» → area * 1.3
    m = re.search(r'(area|perimeter)\s*[+]\s*(\d+(?:[.,]\d+)?)\s*%', r)
    if m:
        base = area if m.group(1) == 'area' else perim
        pct = float(m.group(2).replace(',', '.'))
        return round(base * (1 + pct / 100), 2)

    # «площадь × 1.3» / «area * 1.3»
    m = re.search(r'(area|perimeter)\s*[×x*]\s*(\d+(?:[.,]\d+)?)', r)
    if m:
        base = area if m.group(1) == 'area' else perim
        factor = float(m.group(2).replace(',', '.'))
        return round(base * factor, 2)

    # «area / 5» — деление (например катушки ленты)
    m = re.search(r'(area|perimeter)\s*/\s*(\d+(?:[.,]\d+)?)', r)
    if m:
        base = area if m.group(1) == 'area' else perim
        divisor = float(m.group(2).replace(',', '.'))
        if divisor:
            return round(base / divisor, 2)

    # Просто «площадь» или «периметр» без операций (только если нет арифметики)
    _has_op = bool(re.search(r'[+\-*/×x]|\d', r))
    if 'area' in r and 'perimeter' not in r and not _has_op:
        return round(area, 2)
    if 'perimeter' in r and 'area' not in r and not _has_op:
        return round(perim, 2)

    # Попытка eval старого формата (area * 1.3)
    try:
        val = eval(r.replace('area', str(area)).replace('perimeter', str(perim)),
                   {"__builtins__": {}, "round": round})
        return round(float(val), 2)
    except Exception:
        return None


def save_correction(user_text: str, recognized_json: dict | None, session_id: str = '') -> None:
    """Сохраняет нераспознанный/неточный запрос клиента для обучения."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.bot_corrections (session_id, user_text, recognized_json, status) VALUES (%s, %s, %s, 'pending')",
            (session_id, user_text, json.dumps(recognized_json, ensure_ascii=False) if recognized_json else None)
        )
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print(f"[corrections] save error: {e}")


def save_correction_answer(user_text: str, session_id: str, answer: str) -> None:
    """Сохраняет ответ LLM в запись обучения по session_id и user_text."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.bot_corrections SET llm_answer = %s WHERE session_id = %s AND user_text = %s AND id = (SELECT id FROM {SCHEMA}.bot_corrections WHERE session_id = %s AND user_text = %s ORDER BY created_at DESC LIMIT 1)",
            (answer, session_id, user_text, session_id, user_text)
        )
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print(f"[corrections] save_answer error: {e}")


def get_complex_exceptions() -> set:
    """Возвращает стоп-слова которые уже обучены и не должны блокировать авторасчёт."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT word FROM {SCHEMA}.complex_word_exceptions")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return {row[0] for row in rows}
    except Exception:
        return set()


def get_stop_words() -> set:
    """Возвращает стоп-слова (служебные слова) которые не нужно показывать как теги обучения."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT word FROM {SCHEMA}.stop_words")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return {row[0].lower().strip() for row in rows}
    except Exception:
        return set()


def get_llm_threshold() -> int:
    """Возвращает порог LLM: 0=всё в LLM, 100=всё в авторасчёт. Default=0."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT value FROM {SCHEMA}.ai_settings WHERE key = 'llm_threshold'")
        row = cur.fetchone()
        cur.close(); conn.close()
        return int(row[0]) if row else 0
    except Exception:
        return 0


def build_rules_prompt(rules: list) -> str:
    """Строит блок для SYSTEM_PROMPT с правилами расчёта, условиями и комплектами."""
    id_to_name = {r['id']: r['name'] for r in rules}
    rule_lines = []
    synonym_lines = []

    for r in rules:
        has_rule = (r.get('calc_rule') or r.get('when_condition') or r.get('when_not_condition')
                    or r.get('client_changes')
                    or r.get('bundle', '[]') not in ('[]', '', None))
        if not has_rule:
            # Синонимы собираем всегда
            if r.get('synonyms'):
                syns = [s.strip() for s in r['synonyms'].split(',') if s.strip()]
                if syns:
                    synonym_lines.append(f"• «{r['name']}» = {', '.join(syns)}")
            continue

        parts = []

        # Условие добавления
        if r.get('when_condition'):
            parts.append(f"добавляется если: {r['when_condition']}")
        if r.get('when_not_condition'):
            parts.append(f"НЕ добавляется если: {r['when_not_condition']}")

        # Количество / расчёт
        if r.get('calc_rule'):
            parts.append(f"количество: {r['calc_rule']}")

        # Изменения клиента
        if r.get('client_changes'):
            parts.append(f"‼️ ПРИОРИТЕТНОЕ ИЗМЕНЕНИЕ (исполнять СТРОГО, важнее всех других правил): {r['client_changes']}")

        # Комплект — что добавить вместе
        try:
            bundle_ids = json.loads(r['bundle'])
            if bundle_ids:
                names = [id_to_name.get(i, f'#{i}') for i in bundle_ids]
                parts.append(f"вместе добавить: {', '.join(names)}")
        except Exception:
            pass

        if parts:
            rule_lines.append(f"• {r['name']} [{r['category']}]: " + '; '.join(parts))

        # Синонимы
        if r.get('synonyms'):
            syns = [s.strip() for s in r['synonyms'].split(',') if s.strip()]
            if syns:
                synonym_lines.append(f"• «{r['name']}» = {', '.join(syns)}")

    result = ''
    if rule_lines:
        result += '\n=== ПРАВИЛА ПО ПОЗИЦИЯМ ===\n'
        result += '\n'.join(rule_lines)

    if synonym_lines:
        result += '\n\n=== СИНОНИМЫ ПОЗИЦИЙ ===\n'
        result += '\n'.join(synonym_lines)

    return result