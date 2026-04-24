import json
import os
import psycopg2
from datetime import datetime

SCHEMA = "t_p45929761_bold_move_project"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg}, ensure_ascii=False)}

def handler(event: dict, context) -> dict:
    """CRM-менеджер: клиенты, канбан, календарь, аналитика."""
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

    try:
        # ── CLIENTS ──────────────────────────────────────────────────────────
        if resource == "clients":
            if method == "GET":
                status_filter = qs.get("status", "")
                search = qs.get("search", "")
                sql = f"""
                    SELECT id, session_id, client_name, phone, status,
                           measure_date, notes, address, area, budget, source, created_at
                    FROM {SCHEMA}.live_chats
                    WHERE 1=1
                """
                params = []
                if status_filter:
                    sql += " AND status = %s"
                    params.append(status_filter)
                if search:
                    sql += " AND (client_name ILIKE %s OR phone ILIKE %s)"
                    params.append(f"%{search}%")
                    params.append(f"%{search}%")
                sql += " ORDER BY created_at DESC"
                cur.execute(sql, params)
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, status, measure_date, notes, address, area, budget, source)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id""",
                    (
                        body.get("session_id", f"manual_{datetime.now().timestamp()}"),
                        body.get("client_name", ""),
                        body.get("phone", ""),
                        body.get("status", "new"),
                        body.get("measure_date"),
                        body.get("notes", ""),
                        body.get("address", ""),
                        body.get("area"),
                        body.get("budget"),
                        body.get("source", "manual"),
                    )
                )
                new_id = cur.fetchone()[0]

                # Автоматически добавляем в канбан — первая колонка
                cur.execute(f"SELECT id FROM {SCHEMA}.kanban_columns ORDER BY position LIMIT 1")
                first_col = cur.fetchone()
                if first_col:
                    col_id = first_col[0]
                    cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s", (col_id,))
                    pos = cur.fetchone()[0]
                    name = body.get("client_name", "") or "Новый клиент"
                    phone = body.get("phone", "")
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.kanban_cards (column_id, client_id, title, phone, priority, position)
                            VALUES (%s, %s, %s, %s, 'medium', %s)""",
                        (col_id, new_id, name, phone, pos)
                    )

                # Если есть дата замера — добавляем событие в календарь
                measure_date = body.get("measure_date")
                if measure_date:
                    name = body.get("client_name", "") or "Клиент"
                    phone = body.get("phone", "")
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.calendar_events (client_id, title, description, event_type, start_time, color)
                            VALUES (%s, %s, %s, 'measure', %s, '#f59e0b')""",
                        (new_id, f"Замер: {name}", phone, measure_date)
                    )

                conn.commit()
                return ok({"id": new_id})

            if method == "DELETE":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                # Удаляем связанные kanban-карточки и события
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET client_id = NULL WHERE client_id = %s", (int(cid),))
                cur.execute(f"UPDATE {SCHEMA}.calendar_events SET client_id = NULL WHERE client_id = %s", (int(cid),))
                cur.execute(f"UPDATE {SCHEMA}.live_messages SET session_id = session_id WHERE session_id IN (SELECT session_id FROM {SCHEMA}.live_chats WHERE id = %s)", (int(cid),))
                cur.execute(f"UPDATE {SCHEMA}.live_chats SET status = status WHERE id = %s", (int(cid),))
                # Помечаем как удалённого (soft delete через status)
                cur.execute(f"UPDATE {SCHEMA}.live_chats SET status = 'deleted', notes = COALESCE(notes,'') || ' [удалён]' WHERE id = %s", (int(cid),))
                conn.commit()
                return ok({"deleted": True})

            if method == "PUT":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                fields = ["client_name", "phone", "status", "measure_date", "notes", "address", "area", "budget"]
                sets = []
                vals = []
                for f in fields:
                    if f in body:
                        sets.append(f"{f} = %s")
                        vals.append(body[f])
                if not sets:
                    return err("nothing to update")
                vals.append(int(cid))
                cur.execute(f"UPDATE {SCHEMA}.live_chats SET {', '.join(sets)} WHERE id = %s", vals)

                # Если изменилась дата замера — обновляем/создаём событие в календаре
                if "measure_date" in body and body["measure_date"]:
                    cur.execute(f"SELECT id FROM {SCHEMA}.calendar_events WHERE client_id = %s AND event_type = 'measure' LIMIT 1", (int(cid),))
                    existing = cur.fetchone()
                    cur.execute(f"SELECT client_name FROM {SCHEMA}.live_chats WHERE id = %s", (int(cid),))
                    name_row = cur.fetchone()
                    name = (name_row[0] if name_row else "") or "Клиент"
                    if existing:
                        cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time = %s, title = %s WHERE id = %s",
                                    (body["measure_date"], f"Замер: {name}", existing[0]))
                    else:
                        cur.execute(
                            f"""INSERT INTO {SCHEMA}.calendar_events (client_id, title, event_type, start_time, color)
                                VALUES (%s, %s, 'measure', %s, '#f59e0b')""",
                            (int(cid), f"Замер: {name}", body["measure_date"])
                        )

                conn.commit()
                return ok({"updated": True})

        # ── DASHBOARD STATS ───────────────────────────────────────────────────
        if resource == "stats":
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.live_chats")
            total_clients = cur.fetchone()[0]

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.live_chats WHERE status = 'done'")
            done = cur.fetchone()[0]

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.live_chats WHERE measure_date IS NOT NULL AND measure_date >= NOW()")
            upcoming_measures = cur.fetchone()[0]

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.live_chats WHERE status = 'new'")
            new_leads = cur.fetchone()[0]

            cur.execute(f"SELECT SUM(budget) FROM {SCHEMA}.live_chats WHERE budget IS NOT NULL")
            total_budget = cur.fetchone()[0] or 0

            cur.execute(f"""
                SELECT status, COUNT(*) as cnt
                FROM {SCHEMA}.live_chats
                GROUP BY status
            """)
            status_dist = [{"status": r[0], "count": r[1]} for r in cur.fetchall()]

            cur.execute(f"""
                SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as cnt
                FROM {SCHEMA}.live_chats
                WHERE created_at >= NOW() - INTERVAL '6 months'
                GROUP BY month ORDER BY month
            """)
            monthly = [{"month": str(r[0])[:7], "count": r[1]} for r in cur.fetchall()]

            cur.execute(f"""
                SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as cnt
                FROM {SCHEMA}.live_chats
                WHERE status = 'done' AND created_at >= NOW() - INTERVAL '6 months'
                GROUP BY month ORDER BY month
            """)
            monthly_done = [{"month": str(r[0])[:7], "count": r[1]} for r in cur.fetchall()]

            return ok({
                "total_clients": total_clients,
                "done": done,
                "upcoming_measures": upcoming_measures,
                "new_leads": new_leads,
                "total_budget": float(total_budget),
                "status_dist": status_dist,
                "monthly_leads": monthly,
                "monthly_done": monthly_done,
            })

        # ── KANBAN COLUMNS ────────────────────────────────────────────────────
        if resource == "kanban-columns":
            if method == "GET":
                cur.execute(f"SELECT id, title, color, position FROM {SCHEMA}.kanban_columns ORDER BY position")
                cols = [{"id": r[0], "title": r[1], "color": r[2], "position": r[3]} for r in cur.fetchall()]
                return ok(cols)

            if method == "POST":
                cur.execute(
                    f"SELECT COALESCE(MAX(position)+1, 0) FROM {SCHEMA}.kanban_columns"
                )
                pos = cur.fetchone()[0]
                cur.execute(
                    f"INSERT INTO {SCHEMA}.kanban_columns (title, color, position) VALUES (%s, %s, %s) RETURNING id",
                    (body.get("title", "Новая колонка"), body.get("color", "#7c3aed"), pos)
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                fields = ["title", "color", "position"]
                sets, vals = [], []
                for f in fields:
                    if f in body:
                        sets.append(f"{f} = %s")
                        vals.append(body[f])
                if not sets:
                    return err("nothing to update")
                vals.append(int(cid))
                cur.execute(f"UPDATE {SCHEMA}.kanban_columns SET {', '.join(sets)} WHERE id = %s", vals)
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET column_id = (SELECT id FROM {SCHEMA}.kanban_columns WHERE id != %s ORDER BY position LIMIT 1) WHERE column_id = %s", (int(cid), int(cid)))
                cur.execute(f"UPDATE {SCHEMA}.kanban_columns SET position = position - 1 WHERE position > (SELECT position FROM {SCHEMA}.kanban_columns WHERE id = %s)", (int(cid),))
                cur.execute(f"UPDATE {SCHEMA}.kanban_columns SET id = id WHERE id = %s", (int(cid),))
                conn.commit()
                return ok({"deleted": True})

        # ── KANBAN CARDS ──────────────────────────────────────────────────────
        if resource == "kanban-cards":
            if method == "GET":
                col_id = qs.get("column_id")
                if col_id:
                    cur.execute(
                        f"""SELECT kc.id, kc.column_id, kc.client_id, kc.title, kc.description,
                                   kc.phone, kc.amount, kc.priority, kc.position, kc.due_date, kc.created_at,
                                   lc.client_name, lc.status as client_status
                            FROM {SCHEMA}.kanban_cards kc
                            LEFT JOIN {SCHEMA}.live_chats lc ON kc.client_id = lc.id
                            WHERE kc.column_id = %s ORDER BY kc.position""",
                        (int(col_id),)
                    )
                else:
                    cur.execute(
                        f"""SELECT kc.id, kc.column_id, kc.client_id, kc.title, kc.description,
                                   kc.phone, kc.amount, kc.priority, kc.position, kc.due_date, kc.created_at,
                                   lc.client_name, lc.status as client_status
                            FROM {SCHEMA}.kanban_cards kc
                            LEFT JOIN {SCHEMA}.live_chats lc ON kc.client_id = lc.id
                            ORDER BY kc.column_id, kc.position"""
                    )
                cols_desc = [d[0] for d in cur.description]
                rows = [dict(zip(cols_desc, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                cur.execute(
                    f"SELECT COALESCE(MAX(position)+1, 0) FROM {SCHEMA}.kanban_cards WHERE column_id = %s",
                    (body.get("column_id"),)
                )
                pos = cur.fetchone()[0]
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.kanban_cards
                        (column_id, client_id, title, description, phone, amount, priority, position, due_date)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (
                        body.get("column_id"),
                        body.get("client_id"),
                        body.get("title", ""),
                        body.get("description", ""),
                        body.get("phone", ""),
                        body.get("amount"),
                        body.get("priority", "medium"),
                        pos,
                        body.get("due_date"),
                    )
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                fields = ["column_id", "title", "description", "phone", "amount", "priority", "position", "due_date", "client_id"]
                sets, vals = [], []
                for f in fields:
                    if f in body:
                        sets.append(f"{f} = %s")
                        vals.append(body[f])
                if not sets:
                    return err("nothing to update")
                vals.append(int(cid))
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET {', '.join(sets)} WHERE id = %s", vals)
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET column_id = column_id WHERE id = %s", (int(cid),))
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET id = id WHERE id = %s", (int(cid),))
                conn.commit()
                return ok({"deleted": True})

        # ── CALENDAR EVENTS ───────────────────────────────────────────────────
        if resource == "calendar-events":
            if method == "GET":
                month = qs.get("month")
                year = qs.get("year")
                if month and year:
                    cur.execute(
                        f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                                   ce.start_time, ce.end_time, ce.color, ce.created_at,
                                   lc.client_name, lc.phone
                            FROM {SCHEMA}.calendar_events ce
                            LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id = lc.id
                            WHERE EXTRACT(MONTH FROM ce.start_time) = %s
                              AND EXTRACT(YEAR FROM ce.start_time) = %s
                            ORDER BY ce.start_time""",
                        (int(month), int(year))
                    )
                else:
                    cur.execute(
                        f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                                   ce.start_time, ce.end_time, ce.color, ce.created_at,
                                   lc.client_name, lc.phone
                            FROM {SCHEMA}.calendar_events ce
                            LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id = lc.id
                            ORDER BY ce.start_time DESC LIMIT 100"""
                    )
                cols_desc = [d[0] for d in cur.description]
                rows = [dict(zip(cols_desc, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.calendar_events
                        (client_id, title, description, event_type, start_time, end_time, color)
                        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (
                        body.get("client_id"),
                        body.get("title", ""),
                        body.get("description", ""),
                        body.get("event_type", "measure"),
                        body.get("start_time"),
                        body.get("end_time"),
                        body.get("color", "#7c3aed"),
                    )
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                fields = ["title", "description", "event_type", "start_time", "end_time", "color", "client_id"]
                sets, vals = [], []
                for f in fields:
                    if f in body:
                        sets.append(f"{f} = %s")
                        vals.append(body[f])
                if not sets:
                    return err("nothing to update")
                vals.append(int(cid))
                cur.execute(f"UPDATE {SCHEMA}.calendar_events SET {', '.join(sets)} WHERE id = %s", vals)
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                cur.execute(f"UPDATE {SCHEMA}.calendar_events SET id = id WHERE id = %s", (int(cid),))
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