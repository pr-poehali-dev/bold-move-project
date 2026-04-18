"""Database helpers: knowledge base, system prompt, FAQ cache, prices, rules."""

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
            return row[0]
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
                lines.append(f"\n{category.upper()} (за {unit}):")
            lines.append(f"{name} — {price}")
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
    """Загружает все активные позиции с calc_rule и bundle из БД."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"""
            SELECT id, category, name, price, unit, calc_rule, bundle, synonyms
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
                'synonyms': row[7] or ''
            })
        return result
    except Exception as e:
        print(f"[price_rules] error: {e}")
        return []


def eval_calc_rule(rule: str, area: float, perim: float) -> float | None:
    """Вычисляет количество по правилу. Возвращает None если правило пустое."""
    if not rule:
        return None
    rule = rule.strip()
    # const:N
    m = re.match(r'const:(\d+(?:\.\d+)?)', rule)
    if m:
        return float(m.group(1))
    try:
        val = eval(rule.replace('area', str(area)).replace('perimeter', str(perim)),
                   {"__builtins__": {}})
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
    """Строит блок для SYSTEM_PROMPT с правилами расчёта, синонимами и комплектами."""
    lines = ['\n=== ПРАВИЛА РАСЧЁТА ПО УМОЛЧАНИЮ (если клиент не указал количество) ===']
    id_to_name = {r['id']: r['name'] for r in rules}

    synonym_lines = []
    for r in rules:
        parts = []
        if r['calc_rule']:
            rule_human = r['calc_rule'].replace('area', 'площадь').replace('perimeter', 'периметр')
            parts.append(f"кол-во = {rule_human}")
        try:
            bundle_ids = json.loads(r['bundle'])
            if bundle_ids:
                names = [id_to_name.get(i, f'#{i}') for i in bundle_ids]
                parts.append(f"авто-добавить: {', '.join(names)}")
        except Exception:
            pass
        if parts:
            lines.append(f"• {r['name']}: {'; '.join(parts)}")

        # Синонимы — подсказываем LLM как распознавать позицию
        if r.get('synonyms'):
            syns = [s.strip() for s in r['synonyms'].split(',') if s.strip()]
            if syns:
                synonym_lines.append(f"• «{r['name']}» распознаётся также как: {', '.join(syns)}")

    result = '\n'.join(lines) if len(lines) > 1 else ''
    if synonym_lines:
        result += '\n\n=== СИНОНИМЫ ПОЗИЦИЙ (используй для распознавания в запросе клиента) ===\n'
        result += '\n'.join(synonym_lines)
    return result