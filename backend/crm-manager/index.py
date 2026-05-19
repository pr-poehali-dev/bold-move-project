import json
import os
import base64
import uuid
import psycopg2
import boto3
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

ALL_CLIENT_FIELDS = [
    "client_name", "phone", "status", "sub_status", "client_status", "measure_date", "install_date",
    "notes", "address", "area", "budget", "source",
    "contract_sum", "prepayment", "extra_payment", "extra_agreement_sum",
    "discount_pct", "discount_amount",
    "prepayment_confirmed", "prepayment_confirmed_at", "prepayment_fact",
    "extra_payment_confirmed", "extra_payment_confirmed_at", "extra_payment_fact",
    "responsible_phone", "map_link", "tags",
    "photo_before_url", "photo_after_url", "document_url",
    "material_cost", "measure_cost", "install_cost", "cancel_reason",
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

    if raw_token:
        cur.execute(f"""
            SELECT u.id, u.email, u.role, u.company_id
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (raw_token,))
        sess = cur.fetchone()
        if sess:
            uid, uemail, urole, ucompany_id = sess
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

        # ── CLIENT FILES ─────────────────────────────────────────────────────
        if resource == "client_files":
            client_id = qs.get("client_id") or body.get("client_id")
            if not client_id:
                return err("client_id required")

            if method == "GET":
                cur.execute(
                    f"SELECT id, url, name, type, created_at FROM {SCHEMA}.client_files WHERE client_id=%s ORDER BY created_at ASC",
                    (client_id,)
                )
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                url = body.get("url", "")
                name = body.get("name", "файл")
                ftype = body.get("type", "image")
                if not url:
                    return err("url required")
                cur.execute(
                    f"INSERT INTO {SCHEMA}.client_files (client_id, url, name, type) VALUES (%s,%s,%s,%s) RETURNING id",
                    (client_id, url, name, ftype)
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id, "url": url, "name": name, "type": ftype})

            if method == "PUT":
                file_id = body.get("id")
                name = body.get("name", "")
                if not file_id or not name:
                    return err("id and name required")
                cur.execute(
                    f"UPDATE {SCHEMA}.client_files SET name=%s WHERE id=%s AND client_id=%s",
                    (name, file_id, client_id)
                )
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                file_id = body.get("id")
                if not file_id:
                    return err("id required")
                cur.execute(
                    f"DELETE FROM {SCHEMA}.client_files WHERE id=%s AND client_id=%s",
                    (file_id, client_id)
                )
                conn.commit()
                return ok({"ok": True})

        # ── CLIENTS ──────────────────────────────────────────────────────────
        if resource == "clients":
            if method == "GET":
                status_filter = qs.get("status", "")
                search = qs.get("search", "")
                mode = qs.get("mode", "")  # "leads" | "orders" | "" = all

                sql = f"""
                    SELECT id, session_id, client_name, phone, status, sub_status, client_status,
                           measure_date, install_date, notes, address, area, budget, source, created_at,
                           contract_sum, prepayment, extra_payment, extra_agreement_sum,
                           discount_pct, discount_amount,
                           prepayment_confirmed, prepayment_confirmed_at, prepayment_fact,
                           extra_payment_confirmed, extra_payment_confirmed_at, extra_payment_fact,
                           responsible_phone, map_link, tags,
                           photo_before_url, photo_after_url, document_url,
                           material_cost, measure_cost, install_cost, cancel_reason,
                           updated_at, project_id
                    FROM {SCHEMA}.live_chats
                    WHERE status != 'deleted'
                """
                params = []
                if company_id is not None:
                    sql += " AND company_id = %s"
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
                         notes, address, area, budget, source,
                         contract_sum, prepayment, responsible_phone, map_link, tags, company_id)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
                        body.get("source", "manual"),
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

            if method == "PUT":
                cid = qs.get("id")
                if not cid:
                    return err("id required")

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
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time=%s, title=%s WHERE id=%s",
                                        (body["measure_date"], f"Замер: {name}", ex[0]))
                        else:
                            cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events (client_id,title,event_type,start_time,color,company_id)
                                VALUES (%s,%s,'measure',%s,'#f59e0b',%s)""", (int(cid), f"Замер: {name}", body["measure_date"], company_id))

                # Синхронизируем дату монтажа в календаре
                if "install_date" in body:
                    cur.execute(f"SELECT client_name FROM {SCHEMA}.live_chats WHERE id = %s", (int(cid),))
                    nr = cur.fetchone()
                    name = (nr[0] if nr else "") or "Клиент"
                    cur.execute(f"SELECT id FROM {SCHEMA}.calendar_events WHERE client_id=%s AND event_type='install' LIMIT 1", (int(cid),))
                    ex = cur.fetchone()
                    if body["install_date"]:
                        if ex:
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time=%s, title=%s WHERE id=%s",
                                        (body["install_date"], f"Монтаж: {name}", ex[0]))
                        else:
                            cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events (client_id,title,event_type,start_time,color,company_id)
                                VALUES (%s,%s,'install',%s,'#f97316',%s)""", (int(cid), f"Монтаж: {name}", body["install_date"], company_id))

                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET client_id=NULL WHERE client_id=%s", (int(cid),))
                cur.execute(f"UPDATE {SCHEMA}.calendar_events SET client_id=NULL WHERE client_id=%s", (int(cid),))
                cur.execute(f"UPDATE {SCHEMA}.live_chats SET status='deleted' WHERE id=%s", (int(cid),))
                conn.commit()
                return ok({"deleted": True})

        # ── CLIENT STATUSES ───────────────────────────────────────────────────
        if resource == "client_statuses":
            cid_filter = company_id if company_id is not None else 2  # мастер видит компанию 2

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
            went_measure  = sum(status_dist.get(s, 0) for s in ["measure","measured","contract","prepaid","install_scheduled","install_done","extra_paid","done","cancelled"])
            went_contract = sum(status_dist.get(s, 0) for s in ["contract","prepaid","install_scheduled","install_done","extra_paid","done","cancelled"])

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
                        {cond} ORDER BY ce.start_time DESC LIMIT 200""", cond_args)
                else:
                    if month and year:
                        cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                            ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone, lc.address
                            FROM {SCHEMA}.calendar_events ce
                            LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                            WHERE ce.company_id=%s
                              AND EXTRACT(MONTH FROM ce.start_time)=%s
                              AND EXTRACT(YEAR FROM ce.start_time)=%s
                            ORDER BY ce.start_time""", (company_id, int(month), int(year)))
                    else:
                        cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                            ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone, lc.address
                            FROM {SCHEMA}.calendar_events ce
                            LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                            WHERE ce.company_id=%s
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
                           p.crm_chat_id,
                           (SELECT COUNT(*) FROM {SCHEMA}.room_plans r WHERE r.project_id = p.id AND r.name NOT LIKE %s) AS rooms_count
                    FROM {SCHEMA}.plan_projects p WHERE p.company_id=%s ORDER BY p.updated_at DESC
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
                            (session_id, client_name, phone, address, status, source, company_id, project_id)
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
                        (session_id, client_name, phone, address, status, source, company_id, project_id)
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
                # Обновляем contract_sum в заявке
                if total_standard:
                    cur.execute(f"UPDATE {SCHEMA}.live_chats SET contract_sum=%s WHERE id=%s", (total_standard, int(chat_id_val)))
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

        return err("unknown resource", 404)

    except Exception as e:
        conn.rollback()
        print(f"[crm-manager] error: {e}")
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()