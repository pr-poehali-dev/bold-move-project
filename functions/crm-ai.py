# functions/crm-ai.py
# ============================================================
# ФУНКЦИЯ: crm-ai.py
# Размер: 683 строк
# Путь в проекте: backend/crm-ai/index.py
# Дата: 2026-08-31 11:59
# URL: https://functions.poehali.dev/87c0eb8b-961e-4b3c-9b6b-e8b1cfa3aae7
# ============================================================

import json
import os
import re
import psycopg2
import urllib.request as _ureq
from datetime import datetime

SCHEMA = "t_p45929761_bold_move_project"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token, X-Authorization, Authorization",
}

# Не пересобираем авто-AI-анализ клиента чаще этого интервала (сек) — как и
# в crm-manager (channel-webhook): та же логика троттлинга, вынесенная сюда
# вместе с самим анализом.
ANALYSIS_THROTTLE_SEC = 600


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def normalize_phone(raw):
    """Нормализует номер к виду +7XXXXXXXXXX. Возвращает '' если номер невалиден."""
    if not raw:
        return ""
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    if len(digits) == 11 and digits[0] in ("7", "8"):
        return "+7" + digits[1:]
    if len(digits) == 10:
        return "+7" + digits
    if digits:
        return "+" + digits
    return ""


def run_client_analysis(cur, conn, client_id, client_phone=None, client_name=None):
    """Пересобирает ИИ-анализ клиента по всей истории касаний.
    Возвращает (analysis_dict, error_message). error_message=None при успехе.
    Не бросает исключения — вызывающий код сам решает, что делать при ошибке
    (например, вебхук просто логирует и не валит сохранение сообщения)."""
    cur.execute(f"""
        SELECT channel, direction, text, duration_sec, created_at
        FROM {SCHEMA}.touch_events
        WHERE client_id=%s ORDER BY created_at ASC, id ASC
    """, (client_id,))
    rows = cur.fetchall()
    if not rows:
        return None, "нет касаний для анализа"

    lines = []
    client_replied = False  # был ли хоть один входящий контакт от клиента
    for r in rows:
        ch, direction, text, dur, created = r
        who = "Клиент" if direction == "in" else "Мы"
        if direction == "in":
            client_replied = True
        when = created.strftime("%d.%m %H:%M") if created else ""
        if ch == "call":
            body_txt = f"звонок {dur or 0} сек" + (f": {text}" if text else "")
        else:
            body_txt = text or "(без текста)"
        lines.append(f"[{when}] ({ch}) {who}: {body_txt}")
    history_text = "\n".join(lines[-200:])

    polza_key = os.environ.get("POLZA_API_KEY", "")
    if not polza_key:
        return None, "AI недоступен — нет ключа"

    sys_prompt = (
        "Отвечай только валидным JSON без markdown и пояснений. "
        "Ты обязан опираться СТРОГО на переданный текст истории — ни одного факта, "
        "события, реакции или намерения сверх того, что буквально написано в истории. "
        "Если данных недостаточно для вывода — прямо пиши об этом (например "
        "«клиент ещё не ответил»), а не додумывай."
    )
    # Явно предупреждаем модель, если клиент ещё ни разу не написал/не ответил —
    # иначе модель по умолчанию выдумывает «клиент проявил интерес» и т.п. на
    # основании одного нашего исходящего сообщения.
    reply_note = (
        "ВАЖНО: в истории НЕТ ни одного входящего сообщения/звонка от клиента — "
        "клиент ещё ни разу не ответил. Не пиши, что клиент «проявил интерес», "
        "«откликнулся» или как-либо отреагировал — этого не было. "
        "interest должен быть \"low\", state_summary должен честно отражать, что "
        "мы написали первыми и ответа пока нет, key_points и risks не должны "
        "содержать выдуманных реакций клиента."
        if not client_replied else
        "В истории есть хотя бы одно сообщение от клиента — используй факты из него."
    )
    user_prompt = (
        "Ты аналитик отдела продаж. На вход — вся история общения с клиентом "
        "(звонки и переписки из разных каналов) по порядку времени.\n"
        f"{reply_note}\n"
        "Верни ТОЛЬКО валидный JSON без markdown:\n"
        '{\n'
        '  "state_summary": "КРАТКО, 1-3 предложения (до 300 знаков): что нужно клиенту, на чём остановились, что мешает сделке. Без воды и вступлений.",\n'
        '  "next_action": "конкретная рекомендация к следующему касанию: что сказать/написать, когда и по какому каналу",\n'
        '  "interest": "high|medium|low",\n'
        '  "interest_label": "Высокий|Средний|Низкий",\n'
        '  "stage": "короткое название стадии сделки",\n'
        '  "outcome": "success|failure|pending",\n'
        '  "outcome_label": "Успех|Отказ|В работе",\n'
        '  "risks": ["риск1", "риск2"],\n'
        '  "key_points": ["важный факт о клиенте 1", "..."]\n'
        '}\n'
        "Правила: опирайся ТОЛЬКО на факты, буквально присутствующие в истории. "
        "Запрещено приписывать клиенту интерес, эмоции или действия, которых нет в "
        "тексте истории. Рекомендация должна быть практичной и конкретной.\n\n"
        f"История общения с клиентом{' ' + client_name if client_name else ''} ({client_phone or ''}):\n{history_text}"
    )
    payload = json.dumps({
        "model": "openai/gpt-4o-mini",
        "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_prompt}],
        "max_tokens": 800, "temperature": 0.1,
    }).encode()
    req = _ureq.Request(
        "https://api.polza.ai/api/v1/chat/completions", data=payload,
        headers={"Authorization": f"Bearer {polza_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with _ureq.urlopen(req, timeout=30) as r:
            ai_resp = json.loads(r.read().decode())
        content = ai_resp["choices"][0]["message"]["content"]
        m = re.search(r'\{[\s\S]*\}', content)
        if not m:
            return None, "AI вернул неожиданный формат"
        parsed = json.loads(m.group(0))
    except Exception as e:
        return None, f"AI ошибка: {str(e)[:200]}"

    state_summary  = parsed.get("state_summary")
    next_action    = parsed.get("next_action")
    interest       = parsed.get("interest")
    interest_label = parsed.get("interest_label")
    stage          = parsed.get("stage")
    outcome        = parsed.get("outcome")
    outcome_label  = parsed.get("outcome_label")
    risks          = json.dumps(parsed.get("risks") or [], ensure_ascii=False)
    key_points     = json.dumps(parsed.get("key_points") or [], ensure_ascii=False)

    cur.execute(f"""
        INSERT INTO {SCHEMA}.touch_client_analyses
            (client_id, state_summary, next_action, interest, interest_label,
             stage, outcome, outcome_label, risks, key_points)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (client_id, state_summary, next_action, interest, interest_label,
          stage, outcome, outcome_label, risks, key_points))
    cur.execute(f"""
        UPDATE {SCHEMA}.touch_clients
        SET state_summary=%s, next_action=%s, interest=%s, stage=%s, analysis_updated_at=NOW()
        WHERE id=%s
    """, (state_summary, next_action, interest, stage, client_id))

    # Комментарий в карточке заявки = краткая сводка по общению с клиентом.
    # Обновляем при каждом пересчёте анализа, чтобы менеджер видел суть,
    # не перечитывая всю переписку.
    if state_summary:
        cur.execute(f"""
            UPDATE {SCHEMA}.live_chats SET notes=%s
            WHERE id = (SELECT crm_contact_id FROM {SCHEMA}.touch_clients WHERE id=%s)
        """, (state_summary, client_id))

    conn.commit()

    return {
        "state_summary": state_summary, "next_action": next_action,
        "interest": interest, "interest_label": interest_label,
        "stage": stage, "outcome": outcome, "outcome_label": outcome_label,
        "risks": parsed.get("risks") or [], "key_points": parsed.get("key_points") or [],
    }, None


def handler(event: dict, context) -> dict:
    """CRM ИИ-функции: пересбор сводки по клиенту, оценка звонка, расшифровка
    записи. Вынесены из crm-manager в отдельную функцию — это единственные
    здесь операции, которые ждут внешние ИИ-сервисы (Polza/Deepgram) до
    30-45 секунд, тогда как остальной CRM отвечает за доли секунды. Так
    у "быстрой" crm-manager можно держать короткий таймаут, а этой функции
    выставить больший — без риска для остального CRM."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    resource = qs.get("r", "")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur = conn.cursor()

    # ── Определяем company_id по токену (та же логика, что в crm-manager) ─────
    headers = event.get("headers") or {}
    raw_token = (headers.get("X-Authorization") or headers.get("Authorization") or "").replace("Bearer ", "").strip()

    company_id = None
    master_uid = 0
    authenticated = False

    if raw_token:
        cur.execute(f"""
            SELECT u.id, u.email, u.role, u.company_id
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (raw_token,))
        sess = cur.fetchone()
        if sess:
            authenticated = True
            uid, uemail, urole, ucompany_id = sess
            if uemail == "19.jeka.94@gmail.com":
                company_id = None
                master_uid = uid
            else:
                master_uid = uid
                if urole == "manager" and ucompany_id:
                    company_id = ucompany_id
                else:
                    company_id = uid

    try:
        # ── ANALYZE-CLIENT: ИИ-пересбор сводки по всей истории касаний ────────────
        if resource == "analyze-client" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            client_id = body.get("client_id") if isinstance(body, dict) else None
            phone_q = body.get("phone") if isinstance(body, dict) else None
            if not client_id and not phone_q:
                return err("client_id or phone required")

            if client_id:
                cur.execute(
                    f"SELECT id, phone, name FROM {SCHEMA}.touch_clients WHERE id=%s AND company_id=%s",
                    (client_id, owner_id))
            else:
                norm = normalize_phone(phone_q)
                if not norm:
                    return err("phone invalid")
                cur.execute(
                    f"SELECT id, phone, name FROM {SCHEMA}.touch_clients WHERE phone=%s AND company_id=%s",
                    (norm, owner_id))
            cli = cur.fetchone()
            if not cli:
                return err("client not found", 404)
            client_id, client_phone, client_name = cli[0], cli[1], cli[2]

            # Анализ свежий (моложе ANALYSIS_THROTTLE_SEC) — не тратим деньги на
            # повторный вызов ИИ, отдаём уже посчитанный результат. Действует и на
            # ручную кнопку «Пересобрать анализ» в UI: жать её чаще нет смысла.
            cur.execute(
                f"SELECT analysis_updated_at FROM {SCHEMA}.touch_clients WHERE id=%s",
                (client_id,))
            au_row = cur.fetchone()
            au = au_row[0] if au_row else None
            if au is not None and (datetime.now() - au).total_seconds() < ANALYSIS_THROTTLE_SEC:
                cur.execute(f"""
                    SELECT state_summary, next_action, interest, interest_label,
                           stage, outcome, outcome_label, risks, key_points, created_at
                    FROM {SCHEMA}.touch_client_analyses
                    WHERE client_id=%s ORDER BY created_at DESC, id DESC LIMIT 1
                """, (client_id,))
                a = cur.fetchone()
                if a:
                    cached = {
                        "state_summary": a[0], "next_action": a[1],
                        "interest": a[2], "interest_label": a[3],
                        "stage": a[4], "outcome": a[5], "outcome_label": a[6],
                        "risks": a[7], "key_points": a[8], "created_at": a[9],
                    }
                    return ok({"client_id": client_id, "analysis": cached, "cached": True})

            analysis, err_msg = run_client_analysis(cur, conn, client_id, client_phone, client_name)
            if err_msg:
                return err(err_msg, 400 if "нет касаний" in err_msg else 500 if "нет ключа" in err_msg else 502)

            return ok({"client_id": client_id, "analysis": analysis})

        # ── ANALYZE-CALL: ИИ-оценка отдельного звонка ──────────────────────────────
        if resource == "analyze-call" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            touch_id = body.get("touch_id") if isinstance(body, dict) else None
            if not touch_id:
                return err("touch_id required")

            # Проверяем принадлежность звонка компании и достаём текст
            cur.execute(f"""
                SELECT te.id, te.text, te.duration_sec, te.channel
                FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id
                WHERE te.id=%s AND tc.company_id=%s
            """, (touch_id, owner_id))
            row = cur.fetchone()
            if not row:
                return err("звонок не найден", 404)
            _, event_text, duration_sec, channel = row
            if channel != "call":
                return err("это касание не звонок", 400)

            # Транскрипт: либо детальный (touch_call_transcripts.full_text), либо текст касания
            cur.execute(f"""
                SELECT id, full_text FROM {SCHEMA}.touch_call_transcripts
                WHERE touch_id=%s
            """, (touch_id,))
            tr = cur.fetchone()
            transcript_text = (tr[1] if tr and tr[1] else event_text) or ""
            if not transcript_text.strip():
                return err("нет текста звонка для анализа", 400)

            polza_key = os.environ.get("POLZA_API_KEY", "")
            if not polza_key:
                return err("AI недоступен — нет ключа", 500)

            sys_prompt = "Отвечай только валидным JSON без markdown и пояснений."
            user_prompt = (
                "Ты эксперт по анализу звонков отдела продаж. На вход — транскрипт звонка "
                "между оператором и клиентом. Оцени звонок и верни ТОЛЬКО валидный JSON:\n"
                '{\n'
                '  "call_type": "incoming|outgoing|repeat",\n'
                '  "call_type_label": "Входящий|Исходящий|Повторный",\n'
                '  "qualification": "qualified|unqualified|spam",\n'
                '  "qualification_label": "Целевой|Нецелевой|Спам",\n'
                '  "client_interest": "high|medium|low",\n'
                '  "client_interest_label": "Высокий|Средний|Низкий",\n'
                '  "outcome": "success|failure|pending",\n'
                '  "outcome_label": "Успех|Отказ|В работе",\n'
                '  "fail_reason": "причина отказа, если есть, иначе null",\n'
                '  "success_factor": "что сработало, если успех, иначе null",\n'
                '  "operator_score": число от 1 до 10 — качество работы оператора,\n'
                '  "operator_followed_script": true|false,\n'
                '  "operator_handled_objections": true|false,\n'
                '  "operator_comment": "1-2 предложения обратной связи оператору",\n'
                '  "summary": "краткое содержание звонка (2-3 предложения)",\n'
                '  "key_phrases_client": ["фраза клиента 1", "..."],\n'
                '  "key_phrases_operator": ["фраза оператора 1", "..."]\n'
                '}\n'
                "Правила: опирайся только на факты из транскрипта, не выдумывай.\n\n"
                f"Длительность звонка: {duration_sec or 0} сек.\n"
                f"Транскрипт:\n{transcript_text[:6000]}"
            )
            payload = json.dumps({
                "model": "openai/gpt-4o-mini",
                "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_prompt}],
                "max_tokens": 700, "temperature": 0.1,
            }).encode()
            req = _ureq.Request(
                "https://api.polza.ai/api/v1/chat/completions", data=payload,
                headers={"Authorization": f"Bearer {polza_key}", "Content-Type": "application/json"}, method="POST")
            try:
                with _ureq.urlopen(req, timeout=30) as r:
                    ai_resp = json.loads(r.read().decode())
                content = ai_resp["choices"][0]["message"]["content"]
                m = re.search(r'\{[\s\S]*\}', content)
                if not m:
                    return err("AI вернул неожиданный формат", 502)
                parsed = json.loads(m.group(0))
            except Exception as e:
                return err(f"AI ошибка: {str(e)[:200]}", 502)

            fields = {
                "call_type": parsed.get("call_type"),
                "call_type_label": parsed.get("call_type_label"),
                "qualification": parsed.get("qualification"),
                "qualification_label": parsed.get("qualification_label"),
                "client_interest": parsed.get("client_interest"),
                "client_interest_label": parsed.get("client_interest_label"),
                "outcome": parsed.get("outcome"),
                "outcome_label": parsed.get("outcome_label"),
                "fail_reason": parsed.get("fail_reason"),
                "success_factor": parsed.get("success_factor"),
                "operator_score": parsed.get("operator_score"),
                "operator_followed_script": parsed.get("operator_followed_script"),
                "operator_handled_objections": parsed.get("operator_handled_objections"),
                "operator_comment": parsed.get("operator_comment"),
                "summary": parsed.get("summary"),
                "key_phrases_client": json.dumps(parsed.get("key_phrases_client") or [], ensure_ascii=False),
                "key_phrases_operator": json.dumps(parsed.get("key_phrases_operator") or [], ensure_ascii=False),
            }
            try:
                score = int(fields["operator_score"])
                fields["operator_score"] = max(1, min(10, score))
            except (TypeError, ValueError):
                fields["operator_score"] = None

            if tr:
                set_sql = ", ".join(f"{k}=%s" for k in fields)
                cur.execute(
                    f"UPDATE {SCHEMA}.touch_call_transcripts SET {set_sql}, analyzed_at=NOW() WHERE touch_id=%s",
                    (*fields.values(), touch_id))
            else:
                cols = ", ".join(["touch_id", *fields.keys(), "analyzed_at"])
                placeholders = ", ".join(["%s"] * (len(fields) + 1) + ["NOW()"])
                cur.execute(
                    f"INSERT INTO {SCHEMA}.touch_call_transcripts ({cols}) VALUES ({placeholders})",
                    (touch_id, *fields.values()))
            conn.commit()

            return ok({
                "touch_id": touch_id,
                "analysis": {
                    **{k: v for k, v in fields.items() if k not in ("key_phrases_client", "key_phrases_operator")},
                    "key_phrases_client": parsed.get("key_phrases_client") or [],
                    "key_phrases_operator": parsed.get("key_phrases_operator") or [],
                },
            })

        # ── TRANSCRIBE-CALL: расшифровка записи звонка по требованию ───────────────
        # Скачивание записи + распознавание речи могут занять больше времени, чем
        # короткий таймаут "быстрой" crm-manager — поэтому это тоже здесь.
        # Вызывается фронтом при открытии ленты касаний (см. useAutoTranscribe.ts).
        if resource == "transcribe-call" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            touch_id = body.get("touch_id")
            if not touch_id:
                return err("touch_id required")

            cur.execute(f"""
                SELECT te.id, te.audio_url, te.text, te.channel
                FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id=te.client_id
                WHERE te.id=%s AND tc.company_id=%s
            """, (touch_id, owner_id))
            row = cur.fetchone()
            if not row:
                return err("звонок не найден", 404)
            _, audio_url, existing_text, channel = row
            if channel != "call":
                return err("это касание не звонок", 400)
            if existing_text:
                return ok({"touch_id": touch_id, "text": existing_text, "cached": True})
            if not audio_url:
                return err("нет записи звонка", 400)

            deepgram_key = os.environ.get("DEEPGRAM_API_KEY", "")
            if not deepgram_key:
                return err("Транскрибация недоступна — нет ключа", 500)

            cur.execute(f"UPDATE {SCHEMA}.touch_events SET status='transcribing' WHERE id=%s", (touch_id,))
            conn.commit()

            try:
                areq = _ureq.Request(audio_url, method="GET")
                with _ureq.urlopen(areq, timeout=20) as r:
                    audio_bytes = r.read()
            except Exception as e:
                cur.execute(f"UPDATE {SCHEMA}.touch_events SET status='received' WHERE id=%s", (touch_id,))
                conn.commit()
                return err(f"Не удалось скачать запись: {str(e)[:150]}", 502)

            try:
                dreq = _ureq.Request(
                    "https://api.deepgram.com/v1/listen?model=nova-2&language=ru&punctuate=true",
                    data=audio_bytes,
                    headers={"Authorization": f"Token {deepgram_key}", "Content-Type": "audio/mpeg"},
                    method="POST")
                with _ureq.urlopen(dreq, timeout=25) as r:
                    dg_resp = json.loads(r.read().decode())
                text = dg_resp.get("results", {}).get("channels", [{}])[0] \
                    .get("alternatives", [{}])[0].get("transcript", "")
            except Exception as e:
                cur.execute(f"UPDATE {SCHEMA}.touch_events SET status='received' WHERE id=%s", (touch_id,))
                conn.commit()
                return err(f"Ошибка транскрибации: {str(e)[:150]}", 502)

            cur.execute(f"UPDATE {SCHEMA}.touch_events SET text=%s, status='received' WHERE id=%s", (text, touch_id))
            cur.execute(f"SELECT id FROM {SCHEMA}.touch_call_transcripts WHERE touch_id=%s", (touch_id,))
            trow = cur.fetchone()
            if trow:
                cur.execute(f"UPDATE {SCHEMA}.touch_call_transcripts SET full_text=%s WHERE touch_id=%s",
                            (text, touch_id))
            else:
                cur.execute(f"INSERT INTO {SCHEMA}.touch_call_transcripts (touch_id, full_text) VALUES (%s, %s)",
                            (touch_id, text))
            conn.commit()

            return ok({"touch_id": touch_id, "text": text})

        # ── ANALYZE-LAST-ACTIONS: батч ИИ-сводка "что там с клиентом" для блока
        # "Нет действий N+ дней" ─────────────────────────────────────────────────
        # Один вызов ИИ на весь видимый список (а не по запросу на карточку).
        # Результат кэшируется в live_chats.last_action_summary — пока
        # last_activity_at клиента не изменился с момента последнего анализа
        # (last_action_analyzed_for >= last_activity_at), отдаём сохранённый
        # текст без повторного обращения к ИИ.
        if resource == "analyze-last-actions" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            raw_ids = body.get("client_ids") if isinstance(body, dict) else None
            if not isinstance(raw_ids, list) or not raw_ids:
                return err("client_ids required")
            try:
                client_ids = [int(x) for x in raw_ids][:40]
            except (TypeError, ValueError):
                return err("client_ids must be numbers")

            cur.execute(f"""
                SELECT lc.id, lc.client_name, lc.phone,
                       lc.last_action_summary, lc.last_action_analyzed_for,
                       GREATEST(lc.updated_at, COALESCE(lact.last_touch_at, lc.updated_at)) AS last_activity_at
                FROM {SCHEMA}.live_chats lc
                LEFT JOIN (
                    SELECT tc.crm_contact_id AS contact_id, MAX(te.created_at) AS last_touch_at
                    FROM {SCHEMA}.touch_clients tc
                    JOIN {SCHEMA}.touch_events te ON te.client_id = tc.id
                    WHERE tc.crm_contact_id IS NOT NULL
                    GROUP BY tc.crm_contact_id
                ) lact ON lact.contact_id = lc.id
                WHERE lc.id = ANY(%s) AND lc.company_id = %s
            """, (client_ids, owner_id))
            rows = cur.fetchall()

            summaries = {}
            stale_ids = []
            last_activity_by_id = {}
            name_phone_by_id = {}
            for r in rows:
                cid, name, phone, cached_summary, analyzed_for, last_activity = r
                # live_chats.updated_at хранится "с таймзоной" (timestamptz), а поля
                # кэша (last_action_analyzed_for) — "без таймзоны". GREATEST() в SQL
                # из-за этого отдаёт tz-aware значение, и Python падает при сравнении
                # с naive-датой ("can't subtract offset-naive and offset-aware
                # datetimes"). Приводим к naive сразу после чтения — единообразно
                # с остальными датами в этой функции (created_at и т.п., все naive).
                if last_activity is not None and last_activity.tzinfo is not None:
                    last_activity = last_activity.replace(tzinfo=None)
                last_activity_by_id[cid] = last_activity
                name_phone_by_id[cid] = (name, phone)
                is_fresh = analyzed_for is not None and last_activity is not None and analyzed_for >= last_activity
                if is_fresh and cached_summary:
                    summaries[cid] = cached_summary
                else:
                    stale_ids.append(cid)

            if not stale_ids:
                return ok({"summaries": summaries})

            polza_key = os.environ.get("POLZA_API_KEY", "")
            if not polza_key:
                # ИИ недоступен — отдаём то, что уже закэшировано, без ошибки на весь запрос
                return ok({"summaries": summaries, "warning": "AI недоступен — нет ключа"})

            # Последние 3 касания по каждому "устаревшему" клиенту — минимум
            # контекста, достаточный, чтобы честно описать, что было в последний раз.
            cur.execute(f"""
                SELECT tc.crm_contact_id AS client_id, te.channel, te.direction, te.text, te.duration_sec, te.status, te.created_at
                FROM {SCHEMA}.touch_clients tc
                JOIN LATERAL (
                    SELECT * FROM {SCHEMA}.touch_events te
                    WHERE te.client_id = tc.id
                    ORDER BY te.created_at DESC LIMIT 3
                ) te ON true
                WHERE tc.crm_contact_id = ANY(%s)
                ORDER BY tc.crm_contact_id, te.created_at ASC
            """, (stale_ids,))
            events_by_client = {}
            for row in cur.fetchall():
                cid, ch, direction, text, dur, status, created = row
                events_by_client.setdefault(cid, []).append((ch, direction, text, dur, status, created))

            now = datetime.now()
            blocks = []
            for cid in stale_ids:
                name, phone = name_phone_by_id.get(cid, (None, None))
                last_activity = last_activity_by_id.get(cid)
                days_idle = (now - last_activity).days if last_activity else None
                evs = events_by_client.get(cid, [])
                if evs:
                    lines = []
                    for ch, direction, text, dur, status, created in evs:
                        who = "Клиент" if direction == "in" else "Мы"
                        when = created.strftime("%d.%m %H:%M") if created else ""
                        if ch == "call":
                            body_txt = f"звонок {dur or 0} сек, статус {status}" + (f": {text}" if text else "")
                        else:
                            body_txt = (text or "(без текста)")[:200]
                        lines.append(f"  [{when}] ({ch}) {who}: {body_txt}")
                    ev_text = "\n".join(lines)
                else:
                    ev_text = "  (сообщений и звонков не было — менялись только поля карточки)"
                blocks.append(
                    f"Клиент id={cid} ({name or 'без имени'}, {phone or 'без телефона'}), "
                    f"последняя активность {days_idle if days_idle is not None else '?'} дн. назад:\n{ev_text}"
                )
            batch_text = "\n\n".join(blocks)

            sys_prompt = (
                "Отвечай только валидным JSON без markdown и пояснений. "
                "Опирайся СТРОГО на переданные факты по каждому клиенту — не придумывай "
                "детали и не додумывай реакции клиента, которых нет в тексте."
            )
            user_prompt = (
                "Для каждого клиента ниже составь ОДНУ короткую фразу (до 80 символов) на русском "
                "о том, что происходило последним по этой заявке — это покажется менеджеру как "
                "напоминание в списке 'нет действий'. Примеры хорошего тона:\n"
                '  "Написали клиенту о сроках — ответа нет 3 дня"\n'
                '  "Клиент ответил, ждём решения"\n'
                '  "Пропущенный звонок, не перезвонили"\n'
                '  "Карточка не менялась, касаний не было"\n'
                "Правило: если последнее событие — наше сообщение/звонок без ответа клиента, "
                "явно скажи, что ответа нет (и сколько дней активности не было — эту цифру бери "
                "из 'последняя активность N дн. назад', она уже верно посчитана, не пересчитывай). "
                "Если последнее — от клиента, скажи, что клиент написал/ответил и (кратко) что. "
                "Верни ТОЛЬКО JSON: "
                '{"clients": [{"id": <int>, "summary": "<фраза>"}, ...]}\n\n'
                f"{batch_text}"
            )
            payload = json.dumps({
                "model": "openai/gpt-4o-mini",
                "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_prompt}],
                "max_tokens": 2000, "temperature": 0.1,
            }).encode()
            req = _ureq.Request(
                "https://api.polza.ai/api/v1/chat/completions", data=payload,
                headers={"Authorization": f"Bearer {polza_key}", "Content-Type": "application/json"}, method="POST")
            try:
                with _ureq.urlopen(req, timeout=40) as r:
                    ai_resp = json.loads(r.read().decode())
                content = ai_resp["choices"][0]["message"]["content"]
                m = re.search(r'\{[\s\S]*\}', content)
                if not m:
                    return ok({"summaries": summaries, "warning": "AI вернул неожиданный формат"})
                parsed = json.loads(m.group(0))
            except Exception as e:
                return ok({"summaries": summaries, "warning": f"AI ошибка: {str(e)[:200]}"})

            for item in (parsed.get("clients") or []):
                try:
                    cid = int(item.get("id"))
                except (TypeError, ValueError):
                    continue
                summary = (item.get("summary") or "").strip()
                if not summary or cid not in stale_ids:
                    continue
                summaries[cid] = summary
                cur.execute(f"""
                    UPDATE {SCHEMA}.live_chats
                    SET last_action_summary=%s, last_action_summary_at=NOW(), last_action_analyzed_for=%s
                    WHERE id=%s
                """, (summary, last_activity_by_id.get(cid), cid))
            conn.commit()

            return ok({"summaries": summaries})

        return err("unknown resource", 404)

    except Exception as e:
        conn.rollback()
        print(f"[crm-ai] error: {e}")
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()