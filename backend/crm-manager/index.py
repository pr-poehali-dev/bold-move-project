import json
import os
import re
import base64
import uuid
import psycopg2
import boto3
import urllib.request as _ureq
from datetime import datetime

SCHEMA = "t_p45929761_bold_move_project"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token, X-Authorization, Authorization",
}

# Статусы лидов (до договора)
LEAD_STATUSES = ["new", "call", "measure", "measured"]
# Статусы заказов (после договора)
ORDER_STATUSES = ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid", "done", "cancelled"]

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg}, ensure_ascii=False)}

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
    for r in rows:
        ch, direction, text, dur, created = r
        who = "Клиент" if direction == "in" else "Мы"
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

    sys_prompt = "Отвечай только валидным JSON без markdown и пояснений."
    user_prompt = (
        "Ты аналитик отдела продаж. На вход — вся история общения с клиентом "
        "(звонки и переписки из разных каналов) по порядку времени.\n"
        "Верни ТОЛЬКО валидный JSON без markdown:\n"
        '{\n'
        '  "state_summary": "2-4 предложения: где сейчас клиент, чего хочет, возражения/риски, уровень интереса",\n'
        '  "next_action": "конкретная рекомендация к следующему касанию: что сказать/написать, когда и по какому каналу",\n'
        '  "interest": "high|medium|low",\n'
        '  "interest_label": "Высокий|Средний|Низкий",\n'
        '  "stage": "короткое название стадии сделки",\n'
        '  "outcome": "success|failure|pending",\n'
        '  "outcome_label": "Успех|Отказ|В работе",\n'
        '  "risks": ["риск1", "риск2"],\n'
        '  "key_points": ["важный факт о клиенте 1", "..."]\n'
        '}\n'
        "Правила: опирайся только на факты из истории, не выдумывай. "
        "Рекомендация должна быть практичной и конкретной.\n\n"
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
        with _ureq.urlopen(req, timeout=45) as r:
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
    conn.commit()

    return {
        "state_summary": state_summary, "next_action": next_action,
        "interest": interest, "interest_label": interest_label,
        "stage": stage, "outcome": outcome, "outcome_label": outcome_label,
        "risks": parsed.get("risks") or [], "key_points": parsed.get("key_points") or [],
    }, None


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

ALL_CLIENT_FIELDS = [
    "client_name", "phone", "status", "sub_status", "client_status", "measure_date", "install_date",
    "notes", "address", "area", "budget", "source",
    "contract_sum", "prepayment", "extra_payment", "extra_agreement_sum",
    "discount_pct", "discount_amount",
    "prepayment_confirmed", "prepayment_confirmed_at", "prepayment_fact",
    "extra_payment_confirmed", "extra_payment_confirmed_at", "extra_payment_fact",
    "responsible_phone", "map_link", "tags",
    "photo_before_url", "photo_after_url", "document_url",
    "material_cost", "measure_cost", "install_cost", "management_cost", "cancel_reason",
    "project_id",
]

def handler(event: dict, context) -> dict:
    """CRM-менеджер: клиенты, канбан, календарь, аналитика, файлы."""
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

    # ── Определяем company_id по токену ──────────────────────────────────────
    # Мастер (пароль Sdauxbasstre228) → company_id = None (видит всё)
    # Клиент (авторизован через сайт) → company_id = его user_id
    headers = event.get("headers") or {}
    raw_token = (headers.get("X-Authorization") or headers.get("Authorization") or "").replace("Bearer ", "").strip()

    company_id = None   # None = мастер, видит всё
    is_master  = True
    master_uid = 0      # реальный uid текущего пользователя (для вставок)
    # Список статусов воронки, разрешённых текущему сотруднику (None = ограничений нет, видно всё)
    allowed_statuses = None
    # True только если токен реально проверен и найдена активная сессия в БД.
    # Отсутствие токена НЕ должно трактоваться как доступ мастера (см. resource=="clients" ниже).
    authenticated = False

    if raw_token:
        cur.execute(f"""
            SELECT u.id, u.email, u.role, u.company_id, u.permissions
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (raw_token,))
        sess = cur.fetchone()
        if sess:
            authenticated = True
            uid, uemail, urole, ucompany_id, upermissions = sess
            if uemail == "19.jeka.94@gmail.com":
                is_master  = True
                company_id = None   # мастер видит всё
                master_uid = uid    # реальный uid мастера для вставок
            else:
                is_master  = False
                master_uid = uid
                # Менеджер привязан к компании → видит данные владельца
                # Все остальные роли видят только свои данные (company_id = их uid)
                if urole == "manager" and ucompany_id:
                    company_id = ucompany_id
                    # Ограничение по этапам воронки — только для сотрудников (роль manager).
                    # Пустой список / отсутствие ключа = ограничений нет (видно всё, обратная совместимость)
                    if upermissions:
                        st = upermissions.get("allowed_statuses")
                        if isinstance(st, list) and len(st) > 0:
                            allowed_statuses = st
                else:
                    company_id = uid

    try:
        # ── UPLOAD FILE ───────────────────────────────────────────────────────
        if resource == "upload":
            file_data = body.get("data", "")
            filename = body.get("filename", "file")
            content_type = body.get("content_type", "application/octet-stream")
            if not file_data:
                return err("no data")
            raw = base64.b64decode(file_data)
            ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
            key = f"crm/{uuid.uuid4()}.{ext}"
            s3 = get_s3()
            s3.put_object(Bucket="files", Key=key, Body=raw, ContentType=content_type)
            cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            return ok({"url": cdn_url, "key": key})

        # ── BUG REPORTS ──────────────────────────────────────────────────────
        if resource == "bug_reports":
            # Статусы, менять которые может только мастер
            MASTER_ONLY_STATUSES = ["in_progress", "done", "rejected"]
            VALID_STATUSES = ["new"] + MASTER_ONLY_STATUSES
            VALID_SEVERITY = ["critical", "important", "normal", "idea"]
            VALID_TYPES = ["bug", "improvement", "idea"]

            if method == "GET":
                cur.execute(
                    f"""SELECT id, title, description, severity, report_type, status,
                               attachments, author_id, author_name, created_at, updated_at
                        FROM {SCHEMA}.bug_reports
                        ORDER BY created_at DESC"""
                )
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok({"reports": rows, "is_master": is_master})

            if method == "POST":
                title = (body.get("title") or "").strip()[:255]
                description = (body.get("description") or "").strip()
                severity = body.get("severity", "normal")
                report_type = body.get("report_type", "bug")
                attachments = body.get("attachments", [])
                if severity not in VALID_SEVERITY:
                    severity = "normal"
                if report_type not in VALID_TYPES:
                    report_type = "bug"
                if not description and not title:
                    return err("description required")
                author_name = (body.get("author_name") or "").strip()[:255]
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.bug_reports
                        (title, description, severity, report_type, status, attachments, author_id, author_name)
                        VALUES (%s,%s,%s,%s,'new',%s,%s,%s) RETURNING id""",
                    (title, description, severity, report_type,
                     json.dumps(attachments, ensure_ascii=False), master_uid or None, author_name)
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                report_id = body.get("id")
                new_status = body.get("status", "")
                if not report_id or new_status not in VALID_STATUSES:
                    return err("id and valid status required")
                # Статусы В работе / Выполнен / Не выполнен — только мастер
                if new_status in MASTER_ONLY_STATUSES and not is_master:
                    return err("only master can set this status", 403)
                cur.execute(
                    f"UPDATE {SCHEMA}.bug_reports SET status=%s, updated_at=NOW() WHERE id=%s",
                    (new_status, report_id)
                )
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                report_id = body.get("id") or qs.get("id")
                if not report_id:
                    return err("id required")
                if not is_master:
                    return err("only master can delete", 403)
                cur.execute(f"DELETE FROM {SCHEMA}.bug_reports WHERE id=%s", (report_id,))
                conn.commit()
                return ok({"ok": True})

        # ── CLIENT FILES ─────────────────────────────────────────────────────
        # Файлы привязаны к client_id (карточка CRM) и/или project_id (проект плана).
        # Если у проекта плана есть crm_chat_id — фото сразу сохраняются с обоими
        # идентификаторами и видны и в плане, и в карточке CRM.
        if resource == "client_files":
            client_id = qs.get("client_id") or body.get("client_id")
            project_id = qs.get("project_id") or body.get("project_id")
            # Проверка обязательна только для GET/POST — DELETE/PUT удаляют/меняют
            # запись по id файла напрямую, без client_id/project_id.
            if method in ("GET", "POST") and not client_id and not project_id:
                return err("client_id or project_id required")

            if method == "GET":
                if project_id:
                    cur.execute(
                        f"""SELECT id, url, name, type, category, client_id, project_id, created_at
                            FROM {SCHEMA}.client_files WHERE project_id=%s ORDER BY created_at ASC""",
                        (int(project_id),)
                    )
                else:
                    cur.execute(
                        f"""SELECT id, url, name, type, category, client_id, project_id, created_at
                            FROM {SCHEMA}.client_files WHERE client_id=%s ORDER BY created_at ASC""",
                        (int(client_id),)
                    )
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                url = body.get("url", "")
                name = body.get("name", "файл")
                ftype = body.get("type", "image")
                category = (body.get("category") or "Фото до").strip()[:50]
                if not url:
                    return err("url required")

                final_client_id = int(client_id) if client_id else 0
                final_project_id = int(project_id) if project_id else None

                # Если фото добавляется из плана (project_id) и client_id не передан явно —
                # подтягиваем crm_chat_id проекта, чтобы фото сразу попало и в CRM.
                if final_project_id and not client_id:
                    cur.execute(
                        f"SELECT crm_chat_id FROM {SCHEMA}.plan_projects WHERE id=%s",
                        (final_project_id,)
                    )
                    prow = cur.fetchone()
                    if prow and prow[0]:
                        final_client_id = prow[0]

                cur.execute(
                    f"""INSERT INTO {SCHEMA}.client_files (client_id, project_id, url, name, type, category)
                        VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (final_client_id, final_project_id, url, name, ftype, category)
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id, "url": url, "name": name, "type": ftype, "category": category,
                           "client_id": final_client_id, "project_id": final_project_id})

            if method == "PUT":
                file_id = body.get("id")
                name = body.get("name", "")
                if not file_id or not name:
                    return err("id and name required")
                cur.execute(
                    f"UPDATE {SCHEMA}.client_files SET name=%s WHERE id=%s",
                    (name, int(file_id))
                )
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                file_id = body.get("id")
                if not file_id:
                    return err("id required")
                cur.execute(
                    f"DELETE FROM {SCHEMA}.client_files WHERE id=%s",
                    (int(file_id),)
                )
                conn.commit()
                return ok({"ok": True})

        # ── CLIENTS ──────────────────────────────────────────────────────────
        if resource == "clients":
            # Список/карточки клиентов (имена, телефоны) — доступ только по проверенному токену.
            # Без этого запрос без авторизации трактовался бы как "мастер" и отдавал бы всех клиентов всех компаний.
            if not authenticated:
                return err("Требуется авторизация", 401)
            if method == "GET":
                status_filter = qs.get("status", "")
                search = qs.get("search", "")
                mode = qs.get("mode", "")  # "leads" | "orders" | "" = all

                sql = f"""
                    SELECT lc.id, lc.session_id, lc.client_name, lc.phone, lc.status, lc.sub_status, lc.client_status,
                           lc.measure_date, lc.install_date, lc.notes, lc.address, lc.area, lc.budget, lc.source, lc.created_via, lc.created_at,
                           lc.contract_sum, lc.prepayment, lc.extra_payment, lc.extra_agreement_sum,
                           lc.discount_pct, lc.discount_amount,
                           lc.prepayment_confirmed, lc.prepayment_confirmed_at, lc.prepayment_fact,
                           lc.extra_payment_confirmed, lc.extra_payment_confirmed_at, lc.extra_payment_fact,
                           lc.responsible_phone, lc.map_link, lc.tags,
                           lc.photo_before_url, lc.photo_after_url, lc.document_url,
                           lc.material_cost, lc.measure_cost, lc.install_cost, lc.cancel_reason,
                           lc.updated_at, lc.project_id,
                           COALESCE(u.is_demo, FALSE) AS is_demo
                    FROM {SCHEMA}.live_chats lc
                    LEFT JOIN {SCHEMA}.users u ON lc.company_id = u.id
                    WHERE (lc.status != 'deleted' OR lc.status = %s)
                """
                # Мастер видит всех — но скрываем демо-аккаунты чтобы не засорять список.
                # Исключение: если запрос идёт от самого демо-пользователя (company_id задан) —
                # он должен видеть своих клиентов, поэтому фильтр не применяем.
                params = [status_filter]
                if company_id is None:
                    sql += " AND COALESCE(u.is_demo, FALSE) = FALSE"
                if company_id is not None:
                    sql += " AND lc.company_id = %s"
                    params.append(company_id)
                if mode == "leads":
                    sql += f" AND status = ANY(%s)"
                    params.append(LEAD_STATUSES)
                elif mode == "orders":
                    sql += f" AND status = ANY(%s)"
                    params.append(ORDER_STATUSES)
                if status_filter:
                    sql += " AND status = %s"
                    params.append(status_filter)
                # Ограничение сотрудника по разрешённым этапам воронки
                if allowed_statuses is not None:
                    sql += " AND status = ANY(%s)"
                    params.append(allowed_statuses)
                if search:
                    sql += " AND (client_name ILIKE %s OR phone ILIKE %s OR address ILIKE %s)"
                    params.extend([f"%{search}%"] * 3)
                sql += " ORDER BY created_at DESC"
                cur.execute(sql, params)
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                tags = body.get("tags", [])
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='19.jeka.94@gmail.com'")
                master_id_row = cur.fetchone()
                master_id = master_id_row[0] if master_id_row else None
                final_company_id = company_id if company_id is not None else master_id

                cur.execute(
                    f"""INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, status, client_status, measure_date, install_date,
                         notes, address, area, budget, source, created_via,
                         contract_sum, prepayment, responsible_phone, map_link, tags, company_id)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        RETURNING id""",
                    (
                        body.get("session_id", f"manual_{datetime.now().timestamp()}"),
                        body.get("client_name", ""),
                        body.get("phone", ""),
                        body.get("status", "new"),
                        body.get("client_status"),
                        body.get("measure_date"),
                        body.get("install_date"),
                        body.get("notes", ""),
                        body.get("address", ""),
                        body.get("area"),
                        body.get("budget"),
                        body.get("source"),
                        "manual",
                        body.get("contract_sum"),
                        body.get("prepayment"),
                        body.get("responsible_phone", ""),
                        body.get("map_link", ""),
                        tags,
                        final_company_id,
                    )
                )
                new_id = cur.fetchone()[0]

                # Авто-канбан — первая колонка (только своей компании)
                cur.execute(f"SELECT id FROM {SCHEMA}.kanban_columns WHERE company_id=%s ORDER BY position LIMIT 1", (final_company_id,))
                first_col = cur.fetchone()
                if first_col:
                    col_id = first_col[0]
                    cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s AND company_id=%s", (col_id, final_company_id))
                    pos = cur.fetchone()[0]
                    name = body.get("client_name", "") or "Новый клиент"
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.kanban_cards (column_id, client_id, title, phone, priority, position, company_id)
                            VALUES (%s,%s,%s,%s,'medium',%s,%s)""",
                        (col_id, new_id, name, body.get("phone", ""), pos, final_company_id)
                    )

                # Авто-календарь для замера
                measure_date = body.get("measure_date")
                if measure_date:
                    name = body.get("client_name", "") or "Клиент"
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.calendar_events (client_id, title, description, event_type, start_time, color, company_id)
                            VALUES (%s,%s,%s,'measure',%s,'#f59e0b',%s)""",
                        (new_id, f"Замер: {name}", body.get("phone",""), measure_date, company_id)
                    )

                # Авто-календарь для монтажа
                install_date = body.get("install_date")
                if install_date:
                    name = body.get("client_name", "") or "Клиент"
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.calendar_events (client_id, title, description, event_type, start_time, color, company_id)
                            VALUES (%s,%s,%s,'install',%s,'#f97316',%s)""",
                        (new_id, f"Монтаж: {name}", body.get("address",""), install_date, company_id)
                    )

                conn.commit()
                return ok({"id": new_id})

            if method == "PUT" and qs.get("action") == "restore":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                if company_id is not None:
                    cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    owner_row = cur.fetchone()
                    if not owner_row or owner_row[0] != company_id:
                        return err("Клиент не найден", 404)
                cur.execute(
                    f"""UPDATE {SCHEMA}.live_chats
                        SET status = COALESCE(status_before_removal, 'new'), status_before_removal = NULL, removed_at = NULL
                        WHERE id=%s AND status='deleted'
                        RETURNING status""",
                    (int(cid),)
                )
                row = cur.fetchone()
                if not row:
                    return err("Заявка не найдена или уже восстановлена", 404)
                conn.commit()
                return ok({"restored": True, "status": row[0]})

            if method == "PUT":
                cid = qs.get("id")
                if not cid:
                    return err("id required")

                # Защита от IDOR: не-мастер может менять только клиентов своей компании.
                # Мастер (company_id is None) видит и правит всё, остальным — строгая проверка владения.
                if company_id is not None:
                    cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    owner_row = cur.fetchone()
                    if not owner_row or owner_row[0] != company_id:
                        return err("Клиент не найден", 404)

                # Ограничение сотрудника по разрешённым этапам воронки:
                # нельзя трогать заказ, который сейчас на недоступном этапе,
                # и нельзя переводить заказ на недоступный сотруднику этап
                if allowed_statuses is not None:
                    cur.execute(f"SELECT status FROM {SCHEMA}.live_chats WHERE id=%s AND company_id=%s", (int(cid), company_id))
                    cur_row = cur.fetchone()
                    if not cur_row or cur_row[0] not in allowed_statuses:
                        return err("Нет доступа к этому этапу воронки", 403)
                    new_status = body.get("status")
                    if new_status and new_status not in allowed_statuses:
                        return err("Нет доступа для перевода на этот этап", 403)

                sets, vals = [], []
                for f in ALL_CLIENT_FIELDS:
                    if f in body:
                        if f == "tags":
                            sets.append(f"tags = %s")
                            vals.append(body[f])
                        else:
                            sets.append(f"{f} = %s")
                            vals.append(body[f] if body[f] != "" else None)
                if not sets:
                    return err("nothing to update")
                sets.append("updated_at = NOW()")
                vals.append(int(cid))
                cur.execute(f"UPDATE {SCHEMA}.live_chats SET {', '.join(sets)} WHERE id = %s", vals)

                # Синхронизируем дату замера в календаре
                if "measure_date" in body:
                    cur.execute(f"SELECT client_name FROM {SCHEMA}.live_chats WHERE id = %s", (int(cid),))
                    nr = cur.fetchone()
                    name = (nr[0] if nr else "") or "Клиент"
                    cur.execute(f"SELECT id FROM {SCHEMA}.calendar_events WHERE client_id=%s AND event_type='measure' LIMIT 1", (int(cid),))
                    ex = cur.fetchone()
                    if body["measure_date"]:
                        if ex:
                            # Обновляем существующее, включая company_id если он был null
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time=%s, title=%s, company_id=COALESCE(company_id,%s) WHERE id=%s",
                                        (body["measure_date"], f"Замер: {name}", company_id, ex[0]))
                        else:
                            cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events (client_id,title,event_type,start_time,color,company_id)
                                VALUES (%s,%s,'measure',%s,'#f59e0b',%s)""", (int(cid), f"Замер: {name}", body["measure_date"], company_id))
                    else:
                        # Дата удалена — обнуляем start_time (скрываем из диапазона)
                        if ex:
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time='2000-01-01'::timestamptz WHERE id=%s", (ex[0],))

                # Синхронизируем дату монтажа в календаре
                if "install_date" in body:
                    cur.execute(f"SELECT client_name FROM {SCHEMA}.live_chats WHERE id = %s", (int(cid),))
                    nr = cur.fetchone()
                    name = (nr[0] if nr else "") or "Клиент"
                    cur.execute(f"SELECT id FROM {SCHEMA}.calendar_events WHERE client_id=%s AND event_type='install' LIMIT 1", (int(cid),))
                    ex = cur.fetchone()
                    if body["install_date"]:
                        if ex:
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time=%s, title=%s, company_id=COALESCE(company_id,%s) WHERE id=%s",
                                        (body["install_date"], f"Монтаж: {name}", company_id, ex[0]))
                        else:
                            cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events (client_id,title,event_type,start_time,color,company_id)
                                VALUES (%s,%s,'install',%s,'#f97316',%s)""", (int(cid), f"Монтаж: {name}", body["install_date"], company_id))
                    else:
                        if ex:
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time='2000-01-01'::timestamptz WHERE id=%s", (ex[0],))

                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                # Защита от IDOR: не-мастер может удалять только клиентов своей компании.
                if company_id is not None:
                    cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    owner_row = cur.fetchone()
                    if not owner_row or owner_row[0] != company_id:
                        return err("Клиент не найден", 404)
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET client_id=NULL WHERE client_id=%s", (int(cid),))
                cur.execute(f"UPDATE {SCHEMA}.calendar_events SET client_id=NULL WHERE client_id=%s", (int(cid),))
                cur.execute(
                    f"""UPDATE {SCHEMA}.live_chats
                        SET status_before_removal = status, removed_at = NOW(), status='deleted'
                        WHERE id=%s""",
                    (int(cid),)
                )
                conn.commit()
                return ok({"deleted": True})

        # ── CLIENT STATUSES ───────────────────────────────────────────────────
        if resource == "client_statuses":
            # Мастер раньше был жёстко привязан к company_id=2 (ошибка). Теперь у мастера
            # своя приватная конфигурация статусов на основе его собственного uid.
            cid_filter = company_id if company_id is not None else master_uid

            if method == "GET":
                cur.execute(f"""
                    SELECT id, name, color, sort_order FROM {SCHEMA}.client_statuses
                    WHERE company_id = %s ORDER BY sort_order, id
                """, (cid_filter,))
                rows = [{"id": r[0], "name": r[1], "color": r[2], "sort_order": r[3]} for r in cur.fetchall()]
                # Если нет статусов — вернуть дефолтные
                if not rows:
                    defaults = [
                        ("Новый", "#6366f1"), ("Активный", "#10b981"),
                        ("VIP", "#f59e0b"), ("Холодный", "#64748b"), ("Отказник", "#ef4444"),
                    ]
                    for i, (name, color) in enumerate(defaults):
                        cur.execute(f"""
                            INSERT INTO {SCHEMA}.client_statuses (company_id, name, color, sort_order)
                            VALUES (%s, %s, %s, %s) RETURNING id
                        """, (cid_filter, name, color, i))
                        new_id = cur.fetchone()[0]
                        rows.append({"id": new_id, "name": name, "color": color, "sort_order": i})
                    conn.commit()
                return ok(rows)

            if method == "POST":
                name = (body.get("name") or "").strip()
                color = body.get("color", "#7c3aed")
                if not name:
                    return err("name required")
                cur.execute(f"SELECT COALESCE(MAX(sort_order)+1,0) FROM {SCHEMA}.client_statuses WHERE company_id=%s", (cid_filter,))
                sort_order = cur.fetchone()[0]
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.client_statuses (company_id, name, color, sort_order)
                    VALUES (%s,%s,%s,%s) RETURNING id
                """, (cid_filter, name, color, sort_order))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id, "name": name, "color": color, "sort_order": sort_order})

            if method == "PUT":
                sid = qs.get("id") or body.get("id")
                if not sid:
                    return err("id required")
                sets, vals = [], []
                if "name" in body:
                    sets.append("name=%s"); vals.append(body["name"])
                if "color" in body:
                    sets.append("color=%s"); vals.append(body["color"])
                if "sort_order" in body:
                    sets.append("sort_order=%s"); vals.append(body["sort_order"])
                if not sets:
                    return err("nothing to update")
                vals.extend([int(sid), cid_filter])
                cur.execute(f"UPDATE {SCHEMA}.client_statuses SET {', '.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                sid = qs.get("id") or body.get("id")
                if not sid:
                    return err("id required")
                # Снимаем статус у клиентов которые его используют
                cur.execute(f"SELECT name FROM {SCHEMA}.client_statuses WHERE id=%s AND company_id=%s", (int(sid), cid_filter))
                row = cur.fetchone()
                if row:
                    cur.execute(f"UPDATE {SCHEMA}.live_chats SET client_status=NULL WHERE client_status=%s AND company_id=%s", (row[0], cid_filter))
                cur.execute(f"DELETE FROM {SCHEMA}.client_statuses WHERE id=%s AND company_id=%s", (int(sid), cid_filter))
                conn.commit()
                return ok({"ok": True})

        # ── ORDER SOURCES (Источники заявок) ──────────────────────────────────
        if resource == "order_sources":
            cid_filter = company_id if company_id is not None else master_uid

            if method == "GET":
                cur.execute(f"""
                    SELECT id, name, color, sort_order FROM {SCHEMA}.order_sources
                    WHERE company_id = %s ORDER BY sort_order, id
                """, (cid_filter,))
                rows = [{"id": r[0], "name": r[1], "color": r[2], "sort_order": r[3]} for r in cur.fetchall()]
                if not rows:
                    defaults = [
                        ("Авито", "#10b981"), ("Директ", "#3b82f6"), ("Квиз", "#f59e0b"),
                    ]
                    for i, (name, color) in enumerate(defaults):
                        cur.execute(f"""
                            INSERT INTO {SCHEMA}.order_sources (company_id, name, color, sort_order)
                            VALUES (%s, %s, %s, %s) RETURNING id
                        """, (cid_filter, name, color, i))
                        new_id = cur.fetchone()[0]
                        rows.append({"id": new_id, "name": name, "color": color, "sort_order": i})
                    conn.commit()
                return ok(rows)

            if method == "POST":
                name = (body.get("name") or "").strip()
                color = body.get("color", "#7c3aed")
                if not name:
                    return err("name required")
                cur.execute(f"SELECT COALESCE(MAX(sort_order)+1,0) FROM {SCHEMA}.order_sources WHERE company_id=%s", (cid_filter,))
                sort_order = cur.fetchone()[0]
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.order_sources (company_id, name, color, sort_order)
                        VALUES (%s,%s,%s,%s) RETURNING id
                    """, (cid_filter, name, color, sort_order))
                    new_id = cur.fetchone()[0]
                    conn.commit()
                except psycopg2.IntegrityError:
                    conn.rollback()
                    return err("Источник с таким названием уже есть", 409)
                return ok({"id": new_id, "name": name, "color": color, "sort_order": sort_order})

            if method == "PUT":
                sid = qs.get("id") or body.get("id")
                if not sid:
                    return err("id required")
                sets, vals = [], []
                if "name" in body:
                    sets.append("name=%s"); vals.append(body["name"])
                if "color" in body:
                    sets.append("color=%s"); vals.append(body["color"])
                if "sort_order" in body:
                    sets.append("sort_order=%s"); vals.append(body["sort_order"])
                if not sets:
                    return err("nothing to update")
                vals.extend([int(sid), cid_filter])
                cur.execute(f"UPDATE {SCHEMA}.order_sources SET {', '.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                sid = qs.get("id") or body.get("id")
                if not sid:
                    return err("id required")
                cur.execute(f"DELETE FROM {SCHEMA}.order_sources WHERE id=%s AND company_id=%s", (int(sid), cid_filter))
                conn.commit()
                return ok({"ok": True})

        # ── STATS ─────────────────────────────────────────────────────────────
        if resource == "stats":
            S = SCHEMA
            W = "WHERE status != 'deleted'"
            if company_id is not None:
                W += f" AND company_id = {int(company_id)}"

            # Воронка — количество по каждому статусу
            cur.execute(f"SELECT status, COUNT(*) FROM {S}.live_chats {W} GROUP BY status")
            status_dist = {r[0]: r[1] for r in cur.fetchall()}

            # Общие счётчики
            total_leads   = sum(status_dist.get(s, 0) for s in LEAD_STATUSES)
            total_orders  = sum(status_dist.get(s, 0) for s in ORDER_STATUSES if s != 'cancelled')
            total_done    = status_dist.get('done', 0)
            total_cancel  = status_dist.get('cancelled', 0)
            total_all     = sum(status_dist.values())
            went_measure  = sum(status_dist.get(s, 0) for s in ["measure","measured","contract","prepaid","install_scheduled","install_done","extra_paid","done"])
            went_contract = sum(status_dist.get(s, 0) for s in ["contract","prepaid","install_scheduled","install_done","extra_paid","done"])

            # Предстоящие события — только актуальные статусы
            cid_filter = f" AND company_id = {int(company_id)}" if company_id is not None else ""
            cur.execute(f"SELECT COUNT(*) FROM {S}.live_chats WHERE measure_date >= NOW() AND status = 'measure'{cid_filter}")
            upcoming_measures = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {S}.live_chats WHERE install_date >= NOW() AND status = 'install_scheduled'{cid_filter}")
            upcoming_installs = cur.fetchone()[0]

            # Финансы
            cur.execute(f"SELECT COALESCE(SUM(contract_sum),0), COALESCE(SUM(prepayment),0), COALESCE(SUM(extra_payment),0), COALESCE(SUM(extra_agreement_sum),0) FROM {S}.live_chats WHERE status != 'deleted'{cid_filter}")
            r = cur.fetchone()
            total_contract, total_prepayment, total_extra, total_extra_agreement = float(r[0]), float(r[1]), float(r[2]), float(r[3])
            total_received = total_prepayment + total_extra

            # Себестоимость
            cur.execute(f"SELECT COALESCE(SUM(material_cost),0), COALESCE(SUM(measure_cost),0), COALESCE(SUM(install_cost),0) FROM {S}.live_chats WHERE status != 'deleted'{cid_filter}")
            r2 = cur.fetchone()
            total_material, total_measure_cost, total_install_cost = float(r2[0]), float(r2[1]), float(r2[2])
            total_costs = total_material + total_measure_cost + total_install_cost
            total_profit = total_contract - total_costs

            # Причины отказов
            cur.execute(f"SELECT cancel_reason, COUNT(*) FROM {S}.live_chats WHERE status='cancelled' AND cancel_reason IS NOT NULL AND cancel_reason != '' GROUP BY cancel_reason ORDER BY COUNT(*) DESC LIMIT 10")
            cancel_reasons = [{"reason": r[0], "count": r[1]} for r in cur.fetchall()]

            # Динамика по месяцам — все 12 месяцев скользящего окна с нулями для пустых
            cmp_sql = f" AND company_id = {int(company_id)}" if company_id is not None else ""
            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                leads AS (
                    SELECT DATE_TRUNC('month', created_at) AS m, COUNT(*) AS cnt
                    FROM {S}.live_chats WHERE status != 'deleted'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(leads.cnt, 0)
                FROM months LEFT JOIN leads ON months.m = leads.m ORDER BY months.m
            """)
            monthly_leads = [{"month": r[0], "count": r[1]} for r in cur.fetchall()]

            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                done AS (
                    SELECT DATE_TRUNC('month', created_at) AS m, COUNT(*) AS cnt
                    FROM {S}.live_chats WHERE status = 'done'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(done.cnt, 0)
                FROM months LEFT JOIN done ON months.m = done.m ORDER BY months.m
            """)
            monthly_done = [{"month": r[0], "count": r[1]} for r in cur.fetchall()]

            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                rev AS (
                    SELECT DATE_TRUNC('month', created_at) AS m, COALESCE(SUM(contract_sum), 0) AS s
                    FROM {S}.live_chats WHERE contract_sum IS NOT NULL AND status != 'deleted'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(rev.s, 0)
                FROM months LEFT JOIN rev ON months.m = rev.m ORDER BY months.m
            """)
            monthly_revenue = [{"month": r[0], "revenue": float(r[1])} for r in cur.fetchall()]

            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                costs AS (
                    SELECT DATE_TRUNC('month', created_at) AS m,
                        COALESCE(SUM(material_cost),0) + COALESCE(SUM(measure_cost),0) + COALESCE(SUM(install_cost),0) AS s
                    FROM {S}.live_chats WHERE status != 'deleted'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(costs.s, 0)
                FROM months LEFT JOIN costs ON months.m = costs.m ORDER BY months.m
            """)
            monthly_costs = [{"month": r[0], "costs": float(r[1])} for r in cur.fetchall()]

            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                profit AS (
                    SELECT DATE_TRUNC('month', created_at) AS m,
                        COALESCE(SUM(contract_sum),0) - COALESCE(SUM(material_cost),0) - COALESCE(SUM(measure_cost),0) - COALESCE(SUM(install_cost),0) AS s
                    FROM {S}.live_chats WHERE status != 'deleted'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(profit.s, 0)
                FROM months LEFT JOIN profit ON months.m = profit.m ORDER BY months.m
            """)
            monthly_profit = [{"month": r[0], "profit": float(r[1])} for r in cur.fetchall()]

            # Средние значения
            cur.execute(f"SELECT AVG(area) FROM {S}.live_chats WHERE area IS NOT NULL AND status != 'deleted'{cmp_sql}")
            avg_area = float(cur.fetchone()[0] or 0)
            cur.execute(f"SELECT AVG(contract_sum) FROM {S}.live_chats WHERE contract_sum IS NOT NULL AND status != 'deleted'{cmp_sql}")
            avg_contract = float(cur.fetchone()[0] or 0)

            # Конверсия воронки
            funnel = [
                {"label": "Заявки",          "count": total_all,      "status": "all"},
                {"label": "Замер назначен",   "count": went_measure,   "status": "measure"},
                {"label": "До договора",      "count": went_contract,  "status": "contract"},
                {"label": "Завершённые",      "count": total_done,     "status": "done"},
            ]

            return ok({
                # Счётчики
                "total_all": total_all,
                "total_leads": total_leads,
                "total_orders": total_orders,
                "total_done": total_done,
                "total_cancel": total_cancel,
                "went_measure": went_measure,
                "went_contract": went_contract,
                "upcoming_measures": upcoming_measures,
                "upcoming_installs": upcoming_installs,
                # Финансы
                "total_contract": total_contract,
                "total_received": total_received,
                "total_prepayment": total_prepayment,
                "total_extra": total_extra,
                "total_extra_agreement": total_extra_agreement,
                # Себестоимость
                "total_material": total_material,
                "total_measure_cost": total_measure_cost,
                "total_install_cost": total_install_cost,
                "total_costs": total_costs,
                "total_profit": total_profit,
                # Средние
                "avg_area": round(avg_area, 1),
                "avg_contract": round(avg_contract, 0),
                # Отказы
                "cancel_reasons": cancel_reasons,
                # Воронка
                "funnel": funnel,
                "status_dist": [{"status": k, "count": v} for k, v in status_dist.items()],
                # Динамика
                "monthly_leads": monthly_leads,
                "monthly_done": monthly_done,
                "monthly_revenue": monthly_revenue,
                "monthly_costs": monthly_costs,
                "monthly_profit": monthly_profit,
            })

        # ── KANBAN COLUMNS ────────────────────────────────────────────────────
        if resource == "kanban-columns":
            # Определяем effective_company_id: мастер смотрит company_id=2 (свои)
            kcmp = company_id if company_id is not None else 2
            if method == "GET":
                cur.execute(f"SELECT id, title, color, position FROM {SCHEMA}.kanban_columns WHERE company_id=%s ORDER BY position", (kcmp,))
                cols = [{"id": r[0], "title": r[1], "color": r[2], "position": r[3]} for r in cur.fetchall()]
                return ok(cols)
            if method == "POST":
                cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_columns WHERE company_id=%s", (kcmp,))
                pos = cur.fetchone()[0]
                cur.execute(f"INSERT INTO {SCHEMA}.kanban_columns (title,color,position,company_id) VALUES (%s,%s,%s,%s) RETURNING id",
                            (body.get("title","Новая"), body.get("color","#7c3aed"), pos, kcmp))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})
            if method == "PUT":
                cid = qs.get("id")
                if not cid: return err("id required")
                sets, vals = [], []
                for f in ["title","color","position"]:
                    if f in body: sets.append(f"{f}=%s"); vals.append(body[f])
                vals.extend([int(cid), kcmp])
                cur.execute(f"UPDATE {SCHEMA}.kanban_columns SET {','.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"updated": True})

        # ── KANBAN CARDS ──────────────────────────────────────────────────────
        if resource == "kanban-cards":
            kcmp = company_id if company_id is not None else 2
            if method == "GET":
                col_id = qs.get("column_id")
                if col_id:
                    cur.execute(f"""SELECT kc.id, kc.column_id, kc.client_id, kc.title, kc.description,
                        kc.phone, kc.amount, kc.priority, kc.position, kc.due_date, kc.created_at,
                        lc.client_name, lc.status as client_status, lc.tags
                        FROM {SCHEMA}.kanban_cards kc
                        LEFT JOIN {SCHEMA}.live_chats lc ON kc.client_id=lc.id
                        WHERE kc.column_id=%s AND kc.company_id=%s ORDER BY kc.position""", (int(col_id), kcmp))
                else:
                    cur.execute(f"""SELECT kc.id, kc.column_id, kc.client_id, kc.title, kc.description,
                        kc.phone, kc.amount, kc.priority, kc.position, kc.due_date, kc.created_at,
                        lc.client_name, lc.status as client_status, lc.tags
                        FROM {SCHEMA}.kanban_cards kc
                        LEFT JOIN {SCHEMA}.live_chats lc ON kc.client_id=lc.id
                        WHERE kc.company_id=%s ORDER BY kc.column_id, kc.position""", (kcmp,))
                cols_desc = [d[0] for d in cur.description]
                rows = [dict(zip(cols_desc, r)) for r in cur.fetchall()]
                return ok(rows)
            if method == "POST":
                cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s AND company_id=%s", (body.get("column_id"), kcmp))
                pos = cur.fetchone()[0]
                cur.execute(f"""INSERT INTO {SCHEMA}.kanban_cards
                    (column_id,client_id,title,description,phone,amount,priority,position,due_date,company_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (body.get("column_id"), body.get("client_id"), body.get("title",""),
                     body.get("description",""), body.get("phone",""), body.get("amount"),
                     body.get("priority","medium"), pos, body.get("due_date"), kcmp))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})
            if method == "PUT":
                cid = qs.get("id")
                if not cid: return err("id required")
                fields = ["column_id","title","description","phone","amount","priority","position","due_date","client_id"]
                sets, vals = [], []
                for f in fields:
                    if f in body: sets.append(f"{f}=%s"); vals.append(body[f])
                if not sets: return err("nothing to update")
                vals.extend([int(cid), kcmp])
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET {','.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"updated": True})
            if method == "DELETE":
                cid = qs.get("id")
                if not cid: return err("id required")
                cur.execute(f"DELETE FROM {SCHEMA}.kanban_cards WHERE id=%s AND company_id=%s", (int(cid), kcmp))
                conn.commit()
                return ok({"deleted": True})

        # ── CALENDAR EVENTS ───────────────────────────────────────────────────
        if resource == "calendar-events":
            if method == "GET":
                month = qs.get("month"); year = qs.get("year")
                if is_master:
                    cond_args = []
                    if month and year:
                        cond = "WHERE EXTRACT(MONTH FROM ce.start_time)=%s AND EXTRACT(YEAR FROM ce.start_time)=%s"
                        cond_args = [int(month), int(year)]
                    else:
                        cond = ""
                    cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                        ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone, lc.address
                        FROM {SCHEMA}.calendar_events ce
                        LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                        {cond} {'AND' if cond else 'WHERE'} (lc.status IS NULL OR lc.status != 'deleted')
                        ORDER BY ce.start_time DESC LIMIT 200""", cond_args)
                else:
                    if month and year:
                        cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                            ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone, lc.address
                            FROM {SCHEMA}.calendar_events ce
                            LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                            WHERE ce.company_id=%s
                              AND EXTRACT(MONTH FROM ce.start_time)=%s
                              AND EXTRACT(YEAR FROM ce.start_time)=%s
                              AND (lc.status IS NULL OR lc.status != 'deleted')
                            ORDER BY ce.start_time""", (company_id, int(month), int(year)))
                    else:
                        cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                            ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone, lc.address
                            FROM {SCHEMA}.calendar_events ce
                            LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                            WHERE ce.company_id=%s
                              AND (lc.status IS NULL OR lc.status != 'deleted')
                            ORDER BY ce.start_time DESC LIMIT 100""", (company_id,))
                cols_desc = [d[0] for d in cur.description]
                return ok([dict(zip(cols_desc, r)) for r in cur.fetchall()])
            if method == "POST":
                cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events
                    (client_id,title,description,event_type,start_time,end_time,color,company_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (body.get("client_id"), body.get("title",""), body.get("description",""),
                     body.get("event_type","measure"), body.get("start_time"),
                     body.get("end_time"), body.get("color","#f59e0b"), company_id))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})
            if method == "PUT":
                cid = qs.get("id")
                if not cid: return err("id required")
                fields = ["title","description","event_type","start_time","end_time","color","client_id"]
                sets, vals = [], []
                for f in fields:
                    if f in body: sets.append(f"{f}=%s"); vals.append(body[f])
                if not sets: return err("nothing to update")
                vals.append(int(cid))
                # Мастер редактирует любое; компания — только своё
                if is_master:
                    cur.execute(f"UPDATE {SCHEMA}.calendar_events SET {','.join(sets)} WHERE id=%s", vals)
                else:
                    vals.append(company_id)
                    cur.execute(f"UPDATE {SCHEMA}.calendar_events SET {','.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"updated": True})
            if method == "DELETE":
                cid = qs.get("id")
                if not cid: return err("id required")
                if is_master:
                    cur.execute(f"DELETE FROM {SCHEMA}.calendar_events WHERE id=%s", (int(cid),))
                else:
                    cur.execute(f"DELETE FROM {SCHEMA}.calendar_events WHERE id=%s AND company_id=%s", (int(cid), company_id))
                conn.commit()
                return ok({"deleted": True})

        # ── ORDER SUBSTATUSES ─────────────────────────────────────────────────
        if resource == "substatuses":
            if method == "GET":
                parent = qs.get("parent_status")
                if company_id is not None:
                    if parent:
                        cur.execute(f"""SELECT id, parent_status, label, color, position
                            FROM {SCHEMA}.order_substatuses
                            WHERE company_id=%s AND parent_status=%s
                            ORDER BY position, id""", (company_id, parent))
                    else:
                        cur.execute(f"""SELECT id, parent_status, label, color, position
                            FROM {SCHEMA}.order_substatuses
                            WHERE company_id=%s
                            ORDER BY parent_status, position, id""", (company_id,))
                else:
                    cur.execute(f"""SELECT id, parent_status, label, color, position
                        FROM {SCHEMA}.order_substatuses
                        ORDER BY company_id, parent_status, position, id""")
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "POST":
                parent = body.get("parent_status", "")
                label  = body.get("label", "").strip()
                color  = body.get("color", "#a78bfa")
                if not parent or not label:
                    return err("parent_status and label required")
                cur.execute(f"""SELECT COALESCE(MAX(position), -1) + 1
                    FROM {SCHEMA}.order_substatuses WHERE company_id=%s AND parent_status=%s""",
                    (company_id, parent))
                pos = cur.fetchone()[0]
                cur.execute(f"""INSERT INTO {SCHEMA}.order_substatuses
                    (company_id, parent_status, label, color, position)
                    VALUES (%s,%s,%s,%s,%s) RETURNING id""",
                    (company_id, parent, label, color, pos))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id, "position": pos})

            if method == "PUT":
                sid = qs.get("id")
                if not sid: return err("id required")
                fields = ["label", "color", "position"]
                sets, vals = [], []
                for f in fields:
                    if f in body:
                        sets.append(f"{f}=%s")
                        vals.append(body[f])
                if not sets: return err("nothing to update")
                vals.append(int(sid))
                vals.append(company_id)
                cur.execute(f"""UPDATE {SCHEMA}.order_substatuses
                    SET {','.join(sets)} WHERE id=%s AND company_id=%s""", vals)
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                sid = qs.get("id")
                if not sid: return err("id required")
                cur.execute(f"""DELETE FROM {SCHEMA}.order_substatuses
                    WHERE id=%s AND company_id=%s""", (int(sid), company_id))
                conn.commit()
                return ok({"deleted": True})

        # ── status-labels ── персонализация названий/цветов реальных этапов заявки
        # (contract, prepaid, install_scheduled и т.п.), общая для всех сотрудников компании
        if resource == "status-labels":
            if method == "GET":
                if company_id is not None:
                    cur.execute(f"""SELECT status, label, color
                        FROM {SCHEMA}.order_status_labels
                        WHERE company_id=%s""", (company_id,))
                else:
                    cur.execute(f"""SELECT status, label, color
                        FROM {SCHEMA}.order_status_labels""")
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "PUT":
                status = body.get("status", "").strip()
                if not status:
                    return err("status required")
                label = body.get("label")
                color = body.get("color")
                cur.execute(f"""INSERT INTO {SCHEMA}.order_status_labels
                    (company_id, status, label, color)
                    VALUES (%s,%s,%s,%s)
                    ON CONFLICT (company_id, status)
                    DO UPDATE SET
                        label=COALESCE(EXCLUDED.label, {SCHEMA}.order_status_labels.label),
                        color=COALESCE(EXCLUDED.color, {SCHEMA}.order_status_labels.color)""",
                    (company_id, status, label, color))
                conn.commit()
                return ok({"updated": True})

        # ── discount-history ──────────────────────────────────────────────────
        if resource == "discount-history":
            cid = qs.get("client_id")
            if not cid:
                return err("client_id required")
            cid = int(cid)

            if method == "GET":
                cur.execute(f"""
                    SELECT id, discount_pct, discount_amount, contract_sum_before, contract_sum_after, is_active, created_at
                    FROM {SCHEMA}.discount_history
                    WHERE client_id = %s AND is_active = true
                    ORDER BY created_at ASC
                """, (cid,))
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "POST":
                pct    = body.get("discount_pct", 0)
                amount = body.get("discount_amount", 0)
                before = body.get("contract_sum_before", 0)
                after  = body.get("contract_sum_after", 0)
                if not pct or not amount:
                    return err("discount_pct and discount_amount required")
                comp = company_id if company_id is not None else 0
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.discount_history
                        (client_id, company_id, discount_pct, discount_amount, contract_sum_before, contract_sum_after)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (cid, comp, pct, amount, before, after))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                # Пометить запись неактивной (мягкое удаление)
                rid = qs.get("id")
                if not rid:
                    return err("id required")
                cur.execute(f"""
                    UPDATE {SCHEMA}.discount_history
                    SET is_active = false
                    WHERE id = %s AND client_id = %s
                """, (int(rid), cid))
                conn.commit()
                return ok({"deactivated": True})

        # ── CUSTOM FIN VALUES (суммы кастомных статей затрат/доходов по заказу) ─
        if resource == "custom-fin-values":
            cid = qs.get("client_id")
            if not cid:
                return err("client_id required")
            cid = int(cid)

            if method == "GET":
                cur.execute(f"""
                    SELECT row_key, value
                    FROM {SCHEMA}.client_custom_fin_values
                    WHERE client_id = %s
                """, (cid,))
                return ok({r[0]: float(r[1]) if r[1] is not None else None for r in cur.fetchall()})

            if method == "POST":
                row_key = body.get("row_key", "")
                value = body.get("value")
                if not row_key:
                    return err("row_key required")
                if value is None or value == "":
                    cur.execute(f"""
                        DELETE FROM {SCHEMA}.client_custom_fin_values
                        WHERE client_id = %s AND row_key = %s
                    """, (cid, row_key))
                else:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.client_custom_fin_values (client_id, row_key, value)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (client_id, row_key) DO UPDATE SET
                            value = EXCLUDED.value,
                            updated_at = NOW()
                    """, (cid, row_key, value))
                conn.commit()
                return ok({"saved": True})

        # ── PLAN ROOMS BY CHAT (для сметы) ────────────────────────────────────
        if resource == "plan-rooms-by-chat":
            cmp = company_id if company_id is not None else master_uid
            chat_id = qs.get("chat_id")
            if not chat_id: return err("chat_id required")
            if method == "GET":
                cur.execute(f"""
                    SELECT r.id, r.name, r.data, r.thumbnail, r.include_in_estimate, r.include_drawing,
                           v.id AS active_variant_id, v.name AS active_variant_name,
                           v.data AS active_variant_data, v.thumbnail AS active_variant_thumbnail
                    FROM {SCHEMA}.live_chats c
                    JOIN {SCHEMA}.plan_projects p ON p.id = c.project_id
                    JOIN {SCHEMA}.room_plans r ON r.project_id = p.id
                    LEFT JOIN {SCHEMA}.plan_variants v ON v.room_id = r.id AND v.is_active = true
                    WHERE c.id=%s AND c.company_id=%s
                      AND r.name NOT LIKE '[удалена]%%'
                    ORDER BY r.created_at ASC
                """, (int(chat_id), cmp))
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

        # ── PLAN PROJECTS ─────────────────────────────────────────────────────
        if resource == "plan-projects":
            cmp = company_id if company_id is not None else master_uid

            if method == "GET":
                pid = qs.get("id")
                if pid:
                    cur.execute(f"""
                        SELECT id, company_id, name, client_name, address, phone, status, created_at, updated_at, crm_chat_id
                        FROM {SCHEMA}.plan_projects WHERE id=%s AND company_id=%s
                    """, (int(pid), cmp))
                    row = cur.fetchone()
                    if not row: return err("not found", 404)
                    cols = [d[0] for d in cur.description]
                    return ok(dict(zip(cols, row)))
                deleted_prefix = '\u0443\u0434\u0430\u043b\u0435\u043d\u0430'  # "удалена"
                cur.execute(f"""
                    SELECT p.id, p.company_id, p.name, p.client_name, p.address, p.phone, p.status, p.created_at, p.updated_at,
                           CASE WHEN lc.id IS NOT NULL AND lc.status != 'deleted' THEN p.crm_chat_id ELSE NULL END AS crm_chat_id,
                           (SELECT COUNT(*) FROM {SCHEMA}.room_plans r WHERE r.project_id = p.id AND r.name NOT LIKE %s) AS rooms_count
                    FROM {SCHEMA}.plan_projects p
                    LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = p.crm_chat_id
                    WHERE p.company_id=%s ORDER BY p.updated_at DESC
                """, ('[' + deleted_prefix + ']%', cmp))
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "POST":
                name = (body.get("name") or "").strip()
                if not name: return err("name required")
                client_name = body.get("client_name")
                address = body.get("address")
                phone = body.get("phone")
                crm_client_id = body.get("crm_client_id")  # ID существующей заявки CRM
                # Для вставок используем реальный uid (мастер имеет cmp=0, но uid реальный)
                insert_cmp = master_uid if cmp == 0 else cmp
                # 1. Создаём проект
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.plan_projects (company_id, name, client_name, address, phone, status)
                    VALUES (%s,%s,%s,%s,%s,%s) RETURNING id
                """, (insert_cmp, name, client_name, address, phone, body.get("status","draft")))
                new_id = cur.fetchone()[0]
                # 2. Привязываем к существующей заявке CRM или создаём новую
                if crm_client_id:
                    # Привязываемся к существующей заявке — обновляем project_id
                    cur.execute(f"UPDATE {SCHEMA}.live_chats SET project_id=%s WHERE id=%s AND company_id=%s RETURNING id",
                                (new_id, crm_client_id, insert_cmp))
                    row = cur.fetchone()
                    chat_id = row[0] if row else None
                    if not chat_id:
                        # Заявка не найдена — создаём новую
                        crm_client_id = None
                if not crm_client_id:
                    session_id = f"plan-{new_id}"
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.live_chats
                            (session_id, client_name, phone, address, status, created_via, company_id, project_id)
                        VALUES (%s,%s,%s,%s,'new','plan',%s,%s) RETURNING id
                    """, (session_id, client_name or name, phone, address, insert_cmp, new_id))
                    chat_id = cur.fetchone()[0]
                # 3. Связываем проект с заявкой
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET crm_chat_id=%s WHERE id=%s", (chat_id, new_id))
                # 4. Ищем колонку "С построителя" и добавляем канбан-карточку (только для новых заявок)
                if not crm_client_id:
                    cur.execute(f"SELECT id FROM {SCHEMA}.kanban_columns WHERE title='С построителя' AND company_id=%s LIMIT 1", (insert_cmp,))
                    col_row = cur.fetchone()
                    if col_row:
                        cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s AND company_id=%s", (col_row[0], insert_cmp))
                        pos = cur.fetchone()[0]
                        cur.execute(f"""INSERT INTO {SCHEMA}.kanban_cards
                            (column_id, client_id, title, phone, priority, position, company_id)
                            VALUES (%s,%s,%s,%s,'medium',%s,%s)""",
                            (col_row[0], chat_id, name, phone or "", pos, insert_cmp))
                conn.commit()
                return ok({"id": new_id, "crm_chat_id": chat_id})

            if method == "PUT":
                pid = qs.get("id")
                if not pid: return err("id required")
                allowed = ["name","client_name","address","phone","status"]
                sets, vals = [], []
                for f in allowed:
                    if f in body: sets.append(f"{f}=%s"); vals.append(body[f])
                if not sets: return err("nothing to update")
                sets.append("updated_at=NOW()")
                vals += [int(pid), cmp]
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET {','.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                pid = qs.get("id")
                if not pid: return err("id required")
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET status='deleted' WHERE id=%s AND company_id=%s", (int(pid), cmp))
                conn.commit()
                return ok({"deleted": True})

        # ── PLAN ROOMS ────────────────────────────────────────────────────────
        if resource == "plan-rooms":
            cmp = company_id if company_id is not None else master_uid
            project_id = qs.get("project_id") or body.get("project_id")

            if method == "GET":
                rid = qs.get("id")
                if rid:
                    cur.execute(f"""
                        SELECT r.id, r.project_id, r.name, r.data, r.thumbnail, r.created_at, r.updated_at,
                               r.include_in_estimate, r.include_drawing
                        FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                        WHERE r.id=%s AND p.company_id=%s
                    """, (int(rid), cmp))
                    row = cur.fetchone()
                    if not row: return err("not found", 404)
                    cols = [d[0] for d in cur.description]
                    return ok(dict(zip(cols, row)))
                if not project_id: return err("project_id required")
                with_active = qs.get("with_active_variant") == "true"
                if with_active:
                    cur.execute(f"""
                        SELECT DISTINCT ON (r.id)
                               r.id, r.project_id, r.name, r.data, r.thumbnail, r.created_at, r.updated_at,
                               r.include_in_estimate, r.include_drawing,
                               v.id AS active_variant_id, v.name AS active_variant_name,
                               v.thumbnail AS active_variant_thumbnail
                        FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                        LEFT JOIN {SCHEMA}.plan_variants v ON v.room_id = r.id AND v.is_active = true
                        WHERE r.project_id=%s AND p.company_id=%s
                          AND r.name NOT LIKE '[удалена]%%'
                        ORDER BY r.id, r.created_at ASC
                    """, (int(project_id), cmp))
                else:
                    cur.execute(f"""
                        SELECT r.id, r.project_id, r.name, r.data, r.thumbnail, r.created_at, r.updated_at,
                               r.include_in_estimate, r.include_drawing
                        FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                        WHERE r.project_id=%s AND p.company_id=%s
                          AND r.name NOT LIKE '[удалена]%%'
                        ORDER BY r.created_at ASC
                    """, (int(project_id), cmp))
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "POST":
                if not project_id: return err("project_id required")
                name = (body.get("name") or "Новая комната").strip()
                insert_cmp = master_uid if cmp == 0 else cmp
                # Проверяем что проект принадлежит компании (мастер видит все через company_id=0 или свой uid)
                cur.execute(f"SELECT id FROM {SCHEMA}.plan_projects WHERE id=%s AND (company_id=%s OR company_id=%s)", (int(project_id), cmp, insert_cmp))
                if not cur.fetchone(): return err("project not found", 404)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.room_plans (user_id, project_id, name, data)
                    VALUES (%s,%s,%s,'{{}}') RETURNING id
                """, (insert_cmp, int(project_id), name))
                new_id = cur.fetchone()[0]
                # Обновляем updated_at проекта
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET updated_at=NOW() WHERE id=%s", (int(project_id),))
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                rid = qs.get("id")
                if not rid: return err("id required")
                allowed = ["name","data","thumbnail","include_in_estimate","include_drawing"]
                sets, vals = [], []
                for f in allowed:
                    if f in body:
                        sets.append(f"{f}=%s")
                        vals.append(json.dumps(body[f]) if f == "data" else body[f])
                if not sets: return err("nothing to update")
                sets.append("updated_at=NOW()")
                vals.append(int(rid))
                cur.execute(f"""
                    UPDATE {SCHEMA}.room_plans SET {','.join(sets)} WHERE id=%s
                    AND project_id IN (SELECT id FROM {SCHEMA}.plan_projects WHERE company_id=%s)
                """, vals + [cmp])
                # Обновляем updated_at проекта
                if project_id:
                    cur.execute(f"UPDATE {SCHEMA}.plan_projects SET updated_at=NOW() WHERE id=%s", (int(project_id),))
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                rid = qs.get("id")
                if not rid: return err("id required")
                cur.execute(f"""
                    UPDATE {SCHEMA}.room_plans SET name=CONCAT('[удалена] ', name) WHERE id=%s
                    AND project_id IN (SELECT id FROM {SCHEMA}.plan_projects WHERE company_id=%s)
                """, (int(rid), cmp))
                conn.commit()
                return ok({"deleted": True})

        # ── PLAN VARIANTS ────────────────────────────────────────────────────────
        if resource == "plan-variants":
            cmp = company_id if company_id is not None else master_uid

            if method == "GET":
                room_id = qs.get("room_id")
                if not room_id: return err("room_id required")
                # Проверяем что комната принадлежит компании
                cur.execute(f"""
                    SELECT r.id FROM {SCHEMA}.room_plans r
                    JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                    WHERE r.id=%s AND p.company_id=%s
                """, (int(room_id), cmp))
                if not cur.fetchone(): return err("room not found", 404)
                cur.execute(f"""
                    SELECT id, room_id, name, data, thumbnail, is_active, created_at, updated_at
                    FROM {SCHEMA}.plan_variants WHERE room_id=%s AND name NOT LIKE '[удалён]%%'
                    ORDER BY created_at ASC
                """, (int(room_id),))
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                room_id = body.get("room_id")
                if not room_id: return err("room_id required")
                name = (body.get("name") or "Вариант 1").strip()
                data = body.get("data", {})
                thumbnail = body.get("thumbnail")
                # Проверяем доступ
                cur.execute(f"""
                    SELECT r.id FROM {SCHEMA}.room_plans r
                    JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                    WHERE r.id=%s AND p.company_id=%s
                """, (int(room_id), cmp))
                if not cur.fetchone(): return err("room not found", 404)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.plan_variants (room_id, name, data, thumbnail, is_active)
                    VALUES (%s,%s,%s,%s,false) RETURNING id
                """, (int(room_id), name, json.dumps(data), thumbnail))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                vid = qs.get("id")
                if not vid: return err("id required")
                allowed = ["name","data","thumbnail","is_active"]
                sets, vals = [], []
                for f in allowed:
                    if f in body:
                        sets.append(f"{f}=%s")
                        vals.append(json.dumps(body[f]) if f == "data" else body[f])
                if not sets: return err("nothing to update")
                sets.append("updated_at=NOW()")
                vals.append(int(vid))
                if body.get("is_active"):
                    cur.execute(f"""
                        UPDATE {SCHEMA}.plan_variants SET is_active=false
                        WHERE room_id=(SELECT room_id FROM {SCHEMA}.plan_variants WHERE id=%s)
                        AND id != %s
                    """, (int(vid), int(vid)))
                cur.execute(f"""
                    UPDATE {SCHEMA}.plan_variants SET {','.join(sets)} WHERE id=%s
                    AND room_id IN (
                        SELECT r.id FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id=r.project_id
                        WHERE p.company_id=%s
                    )
                """, vals + [cmp])
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                vid = qs.get("id")
                if not vid: return err("id required")
                cur.execute(f"""
                    UPDATE {SCHEMA}.plan_variants SET name=CONCAT('[удалён] ', name) WHERE id=%s
                    AND room_id IN (
                        SELECT r.id FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id=r.project_id
                        WHERE p.company_id=%s
                    )
                """, (int(vid), cmp))
                conn.commit()
                return ok({"deleted": True})

        # ── PLAN-ROOMS-BY-CHAT — комнаты проекта по chat_id (для сметы в CRM) ────
        if resource == "plan-rooms-by-chat":
            chat_id_val = qs.get("chat_id") or body.get("chat_id")
            if not chat_id_val: return err("chat_id required", 400)
            cmp = company_id if company_id is not None else master_uid
            if method == "GET":
                cur.execute(f"""
                    SELECT r.id, r.project_id, r.name, r.data, r.thumbnail,
                           r.created_at, r.updated_at, r.include_in_estimate, r.include_drawing,
                           v.id    AS active_variant_id,
                           v.name  AS active_variant_name,
                           v.thumbnail AS active_variant_thumbnail,
                           v.data  AS active_variant_data
                    FROM {SCHEMA}.plan_projects p
                    JOIN {SCHEMA}.room_plans r ON r.project_id = p.id
                    LEFT JOIN {SCHEMA}.plan_variants v ON v.room_id = r.id AND v.is_active = true
                    WHERE p.crm_chat_id = %s AND p.company_id = %s
                      AND r.name NOT LIKE '[удалена]%%'
                    ORDER BY r.created_at ASC
                """, (int(chat_id_val), cmp))
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

        # ── PLAN-CRM-SYNC — синхронизация данных проект ↔ заявка CRM ────────────
        if resource == "plan-crm-sync":
            cmp = company_id if company_id is not None else master_uid

            # GET: получить связанную заявку CRM по project_id
            if method == "GET":
                pid = qs.get("project_id")
                if not pid: return err("project_id required")
                cur.execute(f"""
                    SELECT lc.id, lc.client_name, lc.phone, lc.address, lc.status,
                           lc.contract_sum, lc.notes, lc.project_id, p.crm_chat_id,
                           p.name as project_name
                    FROM {SCHEMA}.plan_projects p
                    LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = p.crm_chat_id
                    WHERE p.id=%s AND p.company_id=%s
                """, (int(pid), cmp))
                row = cur.fetchone()
                if not row: return err("not found", 404)
                cols = [d[0] for d in cur.description]
                return ok(dict(zip(cols, row)))

            # PUT: синхронизировать данные из построителя → CRM и обратно
            if method == "PUT":
                pid = qs.get("project_id")
                if not pid: return err("project_id required")
                # Получаем связанную заявку
                cur.execute(f"""
                    SELECT p.crm_chat_id FROM {SCHEMA}.plan_projects p
                    WHERE p.id=%s AND p.company_id=%s
                """, (int(pid), cmp))
                row = cur.fetchone()
                if not row: return err("project not found", 404)
                chat_id = row[0]
                # Обновляем поля которые пришли
                plan_fields = ["name","client_name","address","phone","status"]
                crm_fields  = ["client_name","phone","address","contract_sum","notes"]
                # Синхронизируем plan_projects
                p_sets, p_vals = [], []
                for f in plan_fields:
                    if f in body:
                        p_sets.append(f"{f}=%s"); p_vals.append(body[f])
                if p_sets:
                    p_sets.append("updated_at=NOW()")
                    p_vals += [int(pid), cmp]
                    cur.execute(f"UPDATE {SCHEMA}.plan_projects SET {','.join(p_sets)} WHERE id=%s AND company_id=%s", p_vals)
                # Синхронизируем live_chats если есть связь
                if chat_id:
                    c_sets, c_vals = [], []
                    name_val = body.get("client_name") or body.get("name")
                    if name_val: c_sets.append("client_name=%s"); c_vals.append(name_val)
                    for f in ["phone","address","contract_sum","notes"]:
                        if f in body: c_sets.append(f"{f}=%s"); c_vals.append(body[f])
                    if c_sets:
                        c_sets.append("updated_at=NOW()")
                        c_vals.append(chat_id)
                        cur.execute(f"UPDATE {SCHEMA}.live_chats SET {','.join(c_sets)} WHERE id=%s", c_vals)
                conn.commit()
                return ok({"synced": True, "project_id": int(pid), "crm_chat_id": chat_id})

        # ── PLAN-CRM-LINK — создать CRM-заявку для существующего проекта ─────────
        if resource == "plan-crm-link":
            if method == "POST":
                pid = qs.get("project_id") or body.get("project_id")
                if not pid: return err("project_id required")
                insert_cmp = master_uid if (company_id is None or company_id == 0) else company_id
                # Берём проект — проверяем владельца
                cur.execute(f"SELECT id, name, client_name, phone, address, crm_chat_id FROM {SCHEMA}.plan_projects WHERE id=%s AND company_id=%s", (int(pid), insert_cmp))
                row = cur.fetchone()
                if not row: return err("project not found", 404)
                proj_id, proj_name, client_name, phone, address, existing_chat = row
                if existing_chat:
                    return ok({"crm_chat_id": existing_chat, "already_linked": True})
                # Создаём заявку
                session_id = f"plan-{proj_id}"
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, address, status, created_via, company_id, project_id)
                    VALUES (%s,%s,%s,%s,'new','plan',%s,%s) RETURNING id
                """, (session_id, client_name or proj_name, phone, address, insert_cmp, proj_id))
                chat_id = cur.fetchone()[0]
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET crm_chat_id=%s, company_id=%s WHERE id=%s", (chat_id, insert_cmp, proj_id))
                # Канбан
                cur.execute(f"SELECT id FROM {SCHEMA}.kanban_columns WHERE title='С построителя' AND company_id=%s LIMIT 1", (insert_cmp,))
                col_row = cur.fetchone()
                if col_row:
                    cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s AND company_id=%s", (col_row[0], insert_cmp))
                    pos = cur.fetchone()[0]
                    cur.execute(f"INSERT INTO {SCHEMA}.kanban_cards (column_id, client_id, title, phone, priority, position, company_id) VALUES (%s,%s,%s,%s,'medium',%s,%s)",
                        (col_row[0], chat_id, proj_name, phone or "", pos, insert_cmp))
                # Авто-синк сметы: если для проекта есть сохранённая смета в другой заявке — берём её сумму
                cur.execute(f"""
                    SELECT se.total_standard FROM {SCHEMA}.saved_estimates se
                    JOIN {SCHEMA}.live_chats lc ON lc.id = se.chat_id
                    WHERE lc.project_id = %s AND se.total_standard IS NOT NULL
                    ORDER BY se.created_at DESC LIMIT 1
                """, (proj_id,))
                est_row = cur.fetchone()
                if est_row and est_row[0]:
                    cur.execute(f"UPDATE {SCHEMA}.live_chats SET contract_sum=%s WHERE id=%s", (est_row[0], chat_id))
                conn.commit()
                return ok({"crm_chat_id": chat_id})

        # ── PLAN-CRM-ATTACH — привязать существующий проект к существующей заявке ─
        if resource == "plan-crm-attach":
            if method == "POST":
                pid     = qs.get("project_id") or body.get("project_id")
                chat_id = qs.get("chat_id")    or body.get("chat_id")
                if not pid:     return err("project_id required")
                if not chat_id: return err("chat_id required")
                attach_cmp = master_uid if (company_id is None or company_id == 0) else company_id
                # Проверяем что проект наш
                cur.execute(f"SELECT id FROM {SCHEMA}.plan_projects WHERE id=%s AND company_id=%s", (int(pid), attach_cmp))
                if not cur.fetchone(): return err("project not found", 404)
                # Проверяем что заявка наша
                cur.execute(f"SELECT id FROM {SCHEMA}.live_chats WHERE id=%s AND company_id=%s AND status!='deleted'", (int(chat_id), attach_cmp))
                if not cur.fetchone(): return err("chat not found", 404)
                # Связываем
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET crm_chat_id=%s, updated_at=NOW() WHERE id=%s AND company_id=%s", (int(chat_id), int(pid), attach_cmp))
                cur.execute(f"UPDATE {SCHEMA}.live_chats SET project_id=%s, updated_at=NOW() WHERE id=%s AND company_id=%s", (int(pid), int(chat_id), attach_cmp))
                # Авто-синк сметы: если у проекта уже есть сохранённая смета — обновляем contract_sum заявки
                cur.execute(f"""
                    SELECT se.total_standard FROM {SCHEMA}.saved_estimates se
                    JOIN {SCHEMA}.live_chats lc ON lc.id = se.chat_id
                    WHERE lc.project_id = %s AND se.total_standard IS NOT NULL
                    ORDER BY se.created_at DESC LIMIT 1
                """, (int(pid),))
                est_row = cur.fetchone()
                if est_row and est_row[0]:
                    cur.execute(f"UPDATE {SCHEMA}.live_chats SET contract_sum=%s WHERE id=%s", (est_row[0], int(chat_id)))
                conn.commit()
                return ok({"ok": True, "project_id": int(pid), "crm_chat_id": int(chat_id)})

        # ── CREATE-ESTIMATE-FOR-CHAT — создать смету для существующей заявки ───
        if resource == "create-estimate-for-chat":
            if method == "POST":
                chat_id_val = body.get("chat_id")
                blocks_val  = body.get("blocks", [])
                totals_val  = body.get("totals", [])
                if not chat_id_val: return err("chat_id required")
                if not blocks_val:  return err("blocks required")
                import re as _re
                # Извлекаем суммы из totals
                def _extract(keyword):
                    for t_line in totals_val:
                        if keyword.lower() in t_line.lower():
                            nums = _re.findall(r"[\d\s]+", t_line.replace("\u00a0", " "))
                            cleaned = "".join("".join(nums).split())
                            if cleaned.isdigit(): return float(cleaned)
                    return None
                total_econom   = _extract("econom")
                total_standard = _extract("standard")
                total_premium  = _extract("premium")
                # Проверяем что заявка существует
                cur.execute(f"SELECT id, company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(chat_id_val),))
                chat_row = cur.fetchone()
                if not chat_row: return err("chat not found", 404)
                # Удаляем старую смету для этой заявки если есть
                cur.execute(f"DELETE FROM {SCHEMA}.saved_estimates WHERE chat_id=%s", (int(chat_id_val),))
                # Создаём новую смету
                insert_cmp = master_uid if (company_id is None or company_id == 0) else company_id
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.saved_estimates
                      (user_id, chat_id, title, blocks, totals, total_econom, total_standard, total_premium, final_phrase)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, '')
                    RETURNING id
                """, (
                    insert_cmp,
                    int(chat_id_val),
                    "Смета на натяжные потолки",
                    json.dumps(blocks_val, ensure_ascii=False),
                    json.dumps(totals_val, ensure_ascii=False),
                    total_econom, total_standard, total_premium,
                ))
                new_id = cur.fetchone()[0]
                # Считаем material_cost, installation_cost и management_cost по прайсу
                material_cost_total = 0
                installation_cost_total = 0
                management_cost_total = 0
                try:
                    # Глобальные флаги
                    cmp_id = master_uid if (company_id is None or company_id == 0) else company_id
                    cur.execute(f"SELECT use_installation_price, use_measure_price, use_management_price FROM {SCHEMA}.auto_rules_settings WHERE company_id=%s", (cmp_id,))
                    _s = cur.fetchone()
                    use_install_global    = bool(_s[0]) if _s else False
                    use_measure_global    = bool(_s[1]) if _s else False
                    use_management_global = bool(_s[2]) if _s else False

                    cur.execute(f"""
                        SELECT p.name, p.purchase_price, p.installation_price, p.measure_price, p.management_price, s.is_material
                        FROM {SCHEMA}.ai_prices p
                        JOIN {SCHEMA}.price_category_settings s ON s.category = p.category
                        WHERE p.active=true AND (p.purchase_price > 0 OR p.installation_price > 0 OR p.measure_price > 0 OR p.management_price > 0)
                    """)
                    mat_map = {}
                    inst_map = {}
                    meas_map = {}
                    mgmt_map = {}
                    for row in cur.fetchall():
                        name_key = row[0].strip().lower()
                        if row[5] and row[1]:
                            mat_map[name_key] = float(row[1])
                        if use_install_global and row[2]:
                            inst_map[name_key] = float(row[2])
                        if use_measure_global and row[3]:
                            meas_map[name_key] = float(row[3])
                        if use_management_global and row[4]:
                            mgmt_map[name_key] = float(row[4])
                    for block in blocks_val:
                        for item in block.get("items", []):
                            item_name = item.get("name", "").strip().lower()
                            val_str = str(item.get("value", "")).replace("\u00a0", " ")
                            m = _re.match(r"([\d]+(?:[.,]\d+)?)", val_str.strip())
                            qty = float(m.group(1).replace(",", ".")) if m else 1.0
                            if item_name in mat_map:
                                material_cost_total += mat_map[item_name] * qty
                            if item_name in inst_map:
                                installation_cost_total += inst_map[item_name] * qty
                            if item_name in meas_map:
                                installation_cost_total += meas_map[item_name] * qty
                            if item_name in mgmt_map:
                                management_cost_total += mgmt_map[item_name] * qty
                    material_cost_total = int(round(material_cost_total))
                    installation_cost_total = int(round(installation_cost_total))
                    management_cost_total = int(round(management_cost_total))
                except Exception:
                    pass
                # Обновляем contract_sum, material_cost, install_cost в заявке
                update_parts = []
                update_vals = []
                if total_standard:
                    update_parts.append("contract_sum=%s"); update_vals.append(total_standard)
                if material_cost_total > 0:
                    update_parts.append("material_cost=%s"); update_vals.append(material_cost_total)
                if installation_cost_total > 0:
                    update_parts.append("install_cost=%s"); update_vals.append(installation_cost_total)
                if management_cost_total > 0:
                    update_parts.append("management_cost=%s"); update_vals.append(management_cost_total)
                if update_parts:
                    cur.execute(
                        f"UPDATE {SCHEMA}.live_chats SET {', '.join(update_parts)} WHERE id=%s",
                        update_vals + [int(chat_id_val)]
                    )
                conn.commit()
                return ok({"ok": True, "estimate_id": new_id})

        # ── PLAN-SHARE — публичные ссылки на чертежи ──────────────────────────
        if resource == "plan-share":
            import secrets as _secrets

            # GET по токену — публичный доступ, без авторизации
            if method == "GET":
                token = qs.get("token")
                if not token: return err("token required")
                cur.execute(f"""
                    SELECT ps.id, ps.token, ps.room_ids, ps.title, ps.chat_id,
                           ps.created_at, ps.expires_at
                    FROM {SCHEMA}.plan_shares ps
                    WHERE ps.token=%s AND (ps.expires_at IS NULL OR ps.expires_at > NOW())
                """, (token,))
                row = cur.fetchone()
                if not row: return err("not found", 404)
                cols = [d[0] for d in cur.description]
                share = dict(zip(cols, row))
                room_ids = share["room_ids"] or []
                # Загружаем комнаты
                rooms = []
                if room_ids:
                    # psycopg2 требует tuple для ANY — конвертируем list в tuple
                    ids_tuple = tuple(int(i) for i in room_ids)
                    placeholders = ",".join(["%s"] * len(ids_tuple))
                    cur.execute(f"""
                        SELECT r.id, r.name, r.data, r.thumbnail, r.include_in_estimate,
                               v.id AS active_variant_id, v.name AS active_variant_name,
                               v.data AS active_variant_data, v.thumbnail AS active_variant_thumbnail
                        FROM {SCHEMA}.room_plans r
                        LEFT JOIN {SCHEMA}.plan_variants v ON v.room_id = r.id AND v.is_active = true
                        WHERE r.id IN ({placeholders}) AND r.name NOT LIKE '[удалена]%%'
                        ORDER BY r.created_at ASC
                    """, ids_tuple)
                    rcols = [d[0] for d in cur.description]
                    rooms = [dict(zip(rcols, r)) for r in cur.fetchall()]
                return ok({"share": share, "rooms": rooms})

            # POST — создать новую ссылку (требует авторизации)
            if method == "POST":
                insert_cmp = master_uid if (company_id is None or company_id == 0) else company_id
                room_ids = body.get("room_ids", [])
                chat_id_val = body.get("chat_id")
                title = body.get("title", "Чертежи")
                if not room_ids: return err("room_ids required")
                token = _secrets.token_hex(12)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.plan_shares (token, company_id, chat_id, room_ids, title)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id, token
                """, (token, insert_cmp, chat_id_val, room_ids, title))
                row = cur.fetchone()
                conn.commit()
                return ok({"id": row[0], "token": row[1]})

            # DELETE — удалить ссылку
            if method == "DELETE":
                token = qs.get("token") or body.get("token")
                if not token: return err("token required")
                cur.execute(f"DELETE FROM {SCHEMA}.plan_shares WHERE token=%s", (token,))
                conn.commit()
                return ok({"deleted": True})

        # ── INTEGRATIONS: настройки внешних сервисов компании (config JSONB) ──────
        if resource == "integrations":
            if not authenticated:
                return err("Требуется авторизация", 401)
            # владелец интеграций = компания (для менеджера) либо сам пользователь
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            # GET — прочитать config компании
            if method == "GET":
                cur.execute(
                    f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s",
                    (owner_id,))
                row = cur.fetchone()
                return ok({"config": row[0] if row else {}})

            # POST — сохранить config (upsert)
            if method == "POST":
                cfg = body.get("config", {})
                if not isinstance(cfg, dict):
                    return err("config must be an object")
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (company_id)
                    DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
                """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
                conn.commit()
                return ok({"saved": True})

        # ── FIN-SETTINGS: настройки блока Доходы/Затраты — общие на компанию ───────
        # (видимость строк, кастомные строки). Раньше жили в localStorage браузера —
        # теперь одна настройка на всех сотрудников компании.
        if resource == "fin-settings":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            if method == "GET":
                cur.execute(
                    f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s",
                    (owner_id,))
                row = cur.fetchone()
                cfg = row[0] if row else {}
                return ok({
                    "row_visibility": cfg.get("_fin_row_visibility") or {},
                    "custom_fin_rows": cfg.get("_fin_custom_rows") or [],
                })

            if method == "POST":
                row_vis = body.get("row_visibility")
                custom_rows = body.get("custom_fin_rows")
                cur.execute(
                    f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s",
                    (owner_id,))
                row = cur.fetchone()
                cfg = dict(row[0]) if row and row[0] else {}
                if row_vis is not None:
                    if not isinstance(row_vis, dict):
                        return err("row_visibility must be an object")
                    cfg["_fin_row_visibility"] = row_vis
                if custom_rows is not None:
                    if not isinstance(custom_rows, list):
                        return err("custom_fin_rows must be an array")
                    cfg["_fin_custom_rows"] = custom_rows
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (company_id)
                    DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
                """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
                conn.commit()
                return ok({"saved": True})

        # ── TOUCHES: лента касаний клиента (модуль «Касания») ─────────────────────
        if resource == "touches":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            if method == "GET":
                client_id = qs.get("client_id")
                phone_q = qs.get("phone")
                name_q = qs.get("name")
                cols = ("id, phone, name, state_summary, next_action, "
                        "interest, stage, analysis_updated_at")

                if client_id:
                    # Режим по id touch_clients (обратная совместимость)
                    cur.execute(
                        f"SELECT {cols} FROM {SCHEMA}.touch_clients "
                        f"WHERE id=%s AND company_id=%s",
                        (client_id, owner_id))
                    cli = cur.fetchone()
                    if not cli:
                        return err("not found", 404)
                elif phone_q:
                    # Режим по номеру телефона: найти или создать touch_clients
                    norm = normalize_phone(phone_q)
                    if not norm:
                        return err("phone invalid")
                    cur.execute(
                        f"SELECT {cols} FROM {SCHEMA}.touch_clients "
                        f"WHERE phone=%s AND company_id=%s",
                        (norm, owner_id))
                    cli = cur.fetchone()
                    if not cli:
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone, name) "
                            f"VALUES (%s, %s, %s) RETURNING {cols}",
                            (owner_id, norm, name_q or None))
                        cli = cur.fetchone()
                        conn.commit()
                else:
                    return err("client_id or phone required")

                client_id = cli[0]
                client = {
                    "id": cli[0], "phone": cli[1], "name": cli[2],
                    "state_summary": cli[3], "next_action": cli[4],
                    "interest": cli[5], "stage": cli[6],
                    "analysis_updated_at": cli[7],
                }
                # Лента касаний по времени
                cur.execute(f"""
                    SELECT id, channel, direction, external_id, text, audio_url,
                           duration_sec, attachments, status, created_at
                    FROM {SCHEMA}.touch_events
                    WHERE client_id=%s
                    ORDER BY created_at ASC, id ASC
                """, (client_id,))
                touches = [{
                    "id": r[0], "channel": r[1], "direction": r[2], "external_id": r[3],
                    "text": r[4], "audio_url": r[5], "duration_sec": r[6],
                    "attachments": r[7], "status": r[8], "created_at": r[9],
                } for r in cur.fetchall()]

                # Последний детальный ИИ-анализ клиента (для вкладки «Аналитика»)
                cur.execute(f"""
                    SELECT state_summary, next_action, interest, interest_label,
                           stage, outcome, outcome_label, risks, key_points, created_at
                    FROM {SCHEMA}.touch_client_analyses
                    WHERE client_id=%s ORDER BY created_at DESC, id DESC LIMIT 1
                """, (client_id,))
                a = cur.fetchone()
                analysis = None
                if a:
                    analysis = {
                        "state_summary": a[0], "next_action": a[1],
                        "interest": a[2], "interest_label": a[3],
                        "stage": a[4], "outcome": a[5], "outcome_label": a[6],
                        "risks": a[7], "key_points": a[8], "created_at": a[9],
                    }
                return ok({"client": client, "touches": touches, "analysis": analysis})

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

            analysis, err_msg = run_client_analysis(cur, conn, client_id, client_phone, client_name)
            if err_msg:
                return err(err_msg, 400 if "нет касаний" in err_msg else 500 if "нет ключа" in err_msg else 502)

            return ok({"client_id": client_id, "analysis": analysis})

        # ── ANALYZE-CALL: ИИ-оценка отдельного звонка (перенос ТЗ 8.1) ─────────────
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
                with _ureq.urlopen(req, timeout=45) as r:
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

        # ── CHANNEL-CONFIG: секретный ключ приёма сообщений для воркера на VPS ─────
        # Компания видит/генерирует свой ключ во вкладке «Интеграции». Этот ключ
        # воркер (Telethon/PyMax) подставляет в заголовок при вызове channel-webhook.
        if resource == "channel-config":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = dict(row[0]) if row and row[0] else {}

            if method == "GET":
                return ok({"webhook_key": cfg.get("_channel_webhook_key")})

            if method == "POST" and body.get("regenerate"):
                new_key = uuid.uuid4().hex
                cfg["_channel_webhook_key"] = new_key
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
                """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
                conn.commit()
                return ok({"webhook_key": new_key})

            return err("unknown action")

        # ── CHANNEL-WEBHOOK: приём сообщения от воркера (Telegram/MAX) ─────────────
        # Вызывается НЕ сотрудником, а нашим воркером на VPS — авторизация через
        # секретный webhook_key (не через сессию пользователя).
        if resource == "channel-webhook" and method == "POST":
            company_id_q = qs.get("company_id")
            webhook_key  = (event.get("headers") or {}).get("X-Webhook-Key", "")
            if not company_id_q or not webhook_key:
                return err("company_id и X-Webhook-Key обязательны", 401)
            try:
                owner_id = int(company_id_q)
            except ValueError:
                return err("company_id invalid")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else None
            if not cfg or cfg.get("_channel_webhook_key") != webhook_key:
                return err("неверный ключ", 401)

            channel     = body.get("channel")       # "telegram" | "max"
            direction   = body.get("direction", "in")  # "in" (обычно вебхук = входящее)
            phone       = body.get("phone")         # если воркер знает номер
            external_chat_id = body.get("external_chat_id")  # id чата в канале (fallback без телефона)
            name        = body.get("name")
            text        = body.get("text")
            external_id = body.get("external_id")   # id сообщения в канале — защита от дублей
            attachments = body.get("attachments")

            if channel not in ("telegram", "max", "avito", "whatsapp"):
                return err("unknown channel")
            if not phone and not external_chat_id:
                return err("phone или external_chat_id обязателен")

            # Находим/создаём клиента: приоритет — телефон, иначе внешний id канала
            client_row = None
            if phone:
                norm = normalize_phone(phone)
                if norm:
                    cur.execute(
                        f"SELECT id FROM {SCHEMA}.touch_clients WHERE phone=%s AND company_id=%s",
                        (norm, owner_id))
                    client_row = cur.fetchone()
                    if not client_row:
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone, name) VALUES (%s, %s, %s) RETURNING id",
                            (owner_id, norm, name))
                        client_row = cur.fetchone()
                        conn.commit()
            if not client_row and external_chat_id:
                # crm_contact_id используем как временное хранилище внешнего id канала,
                # пока нет отдельного поля — ищем по нему в рамках компании и канала.
                marker = f"{channel}:{external_chat_id}"
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.touch_clients WHERE company_id=%s AND crm_contact_id IS NULL "
                    f"AND phone=%s",
                    (owner_id, marker))
                client_row = cur.fetchone()
                if not client_row:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone, name) VALUES (%s, %s, %s) RETURNING id",
                        (owner_id, marker, name))
                    client_row = cur.fetchone()
                    conn.commit()

            client_id = client_row[0]

            # Сохраняем касание (UNIQUE(channel, external_id) защищает от повторной вставки того же вебхука)
            try:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.touch_events (client_id, channel, direction, external_id, text, attachments, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'received')
                """, (client_id, channel, direction, external_id,
                      text, json.dumps(attachments, ensure_ascii=False) if attachments else None))
                conn.commit()
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return ok({"duplicate": True, "client_id": client_id})

            # Автоматический пересбор ИИ-анализа при входящем (решение владельца: дороже, но всегда свежо)
            analysis = None
            if direction == "in":
                analysis, analysis_err = run_client_analysis(cur, conn, client_id, phone, name)
                if analysis_err:
                    print(f"[channel-webhook] analysis skipped: {analysis_err}")

            return ok({"client_id": client_id, "saved": True, "analysis": analysis})

        # ── TOUCH-BADGES: срез (интерес/стадия/непрочитано) по всем клиентам компании ──
        # для бейджей в списке контактов. Один запрос вместо похода в каждую карточку.
        if resource == "touch-badges" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"""
                SELECT tc.phone, tc.interest, tc.stage, tc.next_action,
                       (SELECT te.direction FROM {SCHEMA}.touch_events te
                        WHERE te.client_id = tc.id
                        ORDER BY te.created_at DESC, te.id DESC LIMIT 1) AS last_direction
                FROM {SCHEMA}.touch_clients tc
                WHERE tc.company_id = %s AND tc.phone IS NOT NULL
            """, (owner_id,))
            badges = {}
            for phone, interest, stage, next_action, last_direction in cur.fetchall():
                digits = re.sub(r"\D", "", phone or "")[-10:]
                if not digits:
                    continue
                badges[digits] = {
                    "interest": interest,
                    "stage": stage,
                    "next_action": next_action,
                    "unread": last_direction == "in",
                }
            return ok({"badges": badges})

        # ── TOUCH-DASHBOARD: лёгкий дашборд модуля «Касания» ───────────────────────
        if resource == "touch-dashboard" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            days = qs.get("days", "30")
            try:
                days = max(1, min(365, int(days)))
            except (TypeError, ValueError):
                days = 30

            # Всего касаний за период + распределение по каналам
            cur.execute(f"""
                SELECT te.channel, COUNT(*) AS cnt
                FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id
                WHERE tc.company_id = %s AND te.created_at >= NOW() - (%s || ' days')::interval
                GROUP BY te.channel ORDER BY cnt DESC
            """, (owner_id, str(days)))
            by_channel = [{"channel": r[0], "count": r[1]} for r in cur.fetchall()]
            total_touches = sum(x["count"] for x in by_channel)

            # Конверсия по итогам последнего анализа каждого клиента (за всё время)
            cur.execute(f"""
                SELECT tc.outcome, COUNT(*) FROM (
                    SELECT DISTINCT ON (client_id) client_id, outcome
                    FROM {SCHEMA}.touch_client_analyses
                    ORDER BY client_id, created_at DESC, id DESC
                ) tc
                JOIN {SCHEMA}.touch_clients c ON c.id = tc.client_id
                WHERE c.company_id = %s
                GROUP BY tc.outcome
            """, (owner_id,))
            outcome_rows = cur.fetchall()
            outcome_dist = {o or "pending": c for o, c in outcome_rows}
            analyzed_total = sum(outcome_dist.values())
            success_count = outcome_dist.get("success", 0)
            conversion_pct = round(success_count / analyzed_total * 100) if analyzed_total else 0

            # Топ клиентов «требуют внимания»: высокий интерес или последнее касание — входящее (непрочитано)
            cur.execute(f"""
                SELECT tc.id, tc.name, tc.phone, tc.interest, tc.stage, tc.next_action,
                       (SELECT te.direction FROM {SCHEMA}.touch_events te
                        WHERE te.client_id = tc.id ORDER BY te.created_at DESC, te.id DESC LIMIT 1) AS last_direction
                FROM {SCHEMA}.touch_clients tc
                WHERE tc.company_id = %s AND (tc.interest = 'high' OR tc.next_action IS NOT NULL)
                ORDER BY tc.analysis_updated_at DESC NULLS LAST
                LIMIT 8
            """, (owner_id,))
            attention = [{
                "id": r[0], "name": r[1], "phone": r[2], "interest": r[3],
                "stage": r[4], "next_action": r[5], "unread": r[6] == "in",
            } for r in cur.fetchall()]

            # Средняя оценка звонков за период (только реально проанализированные ИИ)
            cur.execute(f"""
                SELECT AVG(t.operator_score)::float, COUNT(*)
                FROM {SCHEMA}.touch_call_transcripts t
                JOIN {SCHEMA}.touch_events te ON te.id = t.touch_id
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id
                WHERE tc.company_id = %s AND t.operator_score IS NOT NULL
                  AND te.created_at >= NOW() - (%s || ' days')::interval
            """, (owner_id, str(days)))
            score_row = cur.fetchone()
            avg_operator_score = round(score_row[0], 1) if score_row and score_row[0] is not None else None
            scored_calls_count = score_row[1] if score_row else 0

            return ok({
                "days": days,
                "total_touches": total_touches,
                "by_channel": by_channel,
                "conversion_pct": conversion_pct,
                "analyzed_total": analyzed_total,
                "attention": attention,
                "avg_operator_score": avg_operator_score,
                "scored_calls_count": scored_calls_count,
            })

        return err("unknown resource", 404)

    except Exception as e:
        conn.rollback()
        print(f"[crm-manager] error: {e}")
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()