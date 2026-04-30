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
    "client_name", "phone", "status", "measure_date", "install_date",
    "notes", "address", "area", "budget", "source",
    "contract_sum", "prepayment", "extra_payment", "extra_agreement_sum",
    "responsible_phone", "map_link", "tags",
    "photo_before_url", "photo_after_url", "document_url",
    "material_cost", "measure_cost", "install_cost", "cancel_reason",
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
            else:
                is_master  = False
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
                    SELECT id, session_id, client_name, phone, status,
                           measure_date, install_date, notes, address, area, budget, source, created_at,
                           contract_sum, prepayment, extra_payment, extra_agreement_sum,
                           responsible_phone, map_link, tags,
                           photo_before_url, photo_after_url, document_url,
                           material_cost, measure_cost, install_cost, cancel_reason
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
                        (session_id, client_name, phone, status, measure_date, install_date,
                         notes, address, area, budget, source,
                         contract_sum, prepayment, responsible_phone, map_link, tags, company_id)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        RETURNING id""",
                    (
                        body.get("session_id", f"manual_{datetime.now().timestamp()}"),
                        body.get("client_name", ""),
                        body.get("phone", ""),
                        body.get("status", "new"),
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

                # Авто-канбан — первая колонка
                cur.execute(f"SELECT id FROM {SCHEMA}.kanban_columns ORDER BY position LIMIT 1")
                first_col = cur.fetchone()
                if first_col:
                    col_id = first_col[0]
                    cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s", (col_id,))
                    pos = cur.fetchone()[0]
                    name = body.get("client_name", "") or "Новый клиент"
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.kanban_cards (column_id, client_id, title, phone, priority, position)
                            VALUES (%s,%s,%s,%s,'medium',%s)""",
                        (col_id, new_id, name, body.get("phone", ""), pos)
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
                    FROM {S}.live_chats WHERE status != 'deleted' GROUP BY 1
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
                    FROM {S}.live_chats WHERE status = 'done' GROUP BY 1
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
                    FROM {S}.live_chats WHERE contract_sum IS NOT NULL AND status != 'deleted' GROUP BY 1
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
                    FROM {S}.live_chats WHERE status != 'deleted' GROUP BY 1
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
                    FROM {S}.live_chats WHERE status != 'deleted' GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(profit.s, 0)
                FROM months LEFT JOIN profit ON months.m = profit.m ORDER BY months.m
            """)
            monthly_profit = [{"month": r[0], "profit": float(r[1])} for r in cur.fetchall()]

            # Средние значения
            cur.execute(f"SELECT AVG(area) FROM {S}.live_chats WHERE area IS NOT NULL AND status != 'deleted'")
            avg_area = float(cur.fetchone()[0] or 0)
            cur.execute(f"SELECT AVG(contract_sum) FROM {S}.live_chats WHERE contract_sum IS NOT NULL AND status != 'deleted'")
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
            if method == "GET":
                cur.execute(f"SELECT id, title, color, position FROM {SCHEMA}.kanban_columns ORDER BY position")
                cols = [{"id": r[0], "title": r[1], "color": r[2], "position": r[3]} for r in cur.fetchall()]
                return ok(cols)
            if method == "POST":
                cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_columns")
                pos = cur.fetchone()[0]
                cur.execute(f"INSERT INTO {SCHEMA}.kanban_columns (title,color,position) VALUES (%s,%s,%s) RETURNING id",
                            (body.get("title","Новая"), body.get("color","#7c3aed"), pos))
                return ok({"id": cur.fetchone()[0]}), conn.commit() or None
            if method == "PUT":
                cid = qs.get("id")
                if not cid: return err("id required")
                sets, vals = [], []
                for f in ["title","color","position"]:
                    if f in body: sets.append(f"{f}=%s"); vals.append(body[f])
                vals.append(int(cid))
                cur.execute(f"UPDATE {SCHEMA}.kanban_columns SET {','.join(sets)} WHERE id=%s", vals)
                conn.commit()
                return ok({"updated": True})

        # ── KANBAN CARDS ──────────────────────────────────────────────────────
        if resource == "kanban-cards":
            if method == "GET":
                col_id = qs.get("column_id")
                if col_id:
                    cur.execute(f"""SELECT kc.id, kc.column_id, kc.client_id, kc.title, kc.description,
                        kc.phone, kc.amount, kc.priority, kc.position, kc.due_date, kc.created_at,
                        lc.client_name, lc.status as client_status, lc.tags
                        FROM {SCHEMA}.kanban_cards kc
                        LEFT JOIN {SCHEMA}.live_chats lc ON kc.client_id=lc.id
                        WHERE kc.column_id=%s ORDER BY kc.position""", (int(col_id),))
                else:
                    cur.execute(f"""SELECT kc.id, kc.column_id, kc.client_id, kc.title, kc.description,
                        kc.phone, kc.amount, kc.priority, kc.position, kc.due_date, kc.created_at,
                        lc.client_name, lc.status as client_status, lc.tags
                        FROM {SCHEMA}.kanban_cards kc
                        LEFT JOIN {SCHEMA}.live_chats lc ON kc.client_id=lc.id
                        ORDER BY kc.column_id, kc.position""")
                cols_desc = [d[0] for d in cur.description]
                rows = [dict(zip(cols_desc, r)) for r in cur.fetchall()]
                return ok(rows)
            if method == "POST":
                cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s", (body.get("column_id"),))
                pos = cur.fetchone()[0]
                cur.execute(f"""INSERT INTO {SCHEMA}.kanban_cards
                    (column_id,client_id,title,description,phone,amount,priority,position,due_date)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (body.get("column_id"), body.get("client_id"), body.get("title",""),
                     body.get("description",""), body.get("phone",""), body.get("amount"),
                     body.get("priority","medium"), pos, body.get("due_date")))
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
                vals.append(int(cid))
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET {','.join(sets)} WHERE id=%s", vals)
                conn.commit()
                return ok({"updated": True})
            if method == "DELETE":
                cid = qs.get("id")
                if not cid: return err("id required")
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET id=id WHERE id=%s", (int(cid),))
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
                        ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone
                        FROM {SCHEMA}.calendar_events ce
                        LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                        {cond} ORDER BY ce.start_time DESC LIMIT 200""", cond_args)
                else:
                    if month and year:
                        cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                            ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone
                            FROM {SCHEMA}.calendar_events ce
                            LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                            WHERE ce.company_id=%s
                              AND EXTRACT(MONTH FROM ce.start_time)=%s
                              AND EXTRACT(YEAR FROM ce.start_time)=%s
                            ORDER BY ce.start_time""", (company_id, int(month), int(year)))
                    else:
                        cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                            ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone
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

        return err("unknown resource", 404)

    except Exception as e:
        conn.rollback()
        print(f"[crm-manager] error: {e}")
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()