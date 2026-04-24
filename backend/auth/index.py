import json, os, hashlib, secrets, psycopg2
from datetime import datetime

SCHEMA = os.environ.get("DB_SCHEMA", "t_p45929761_bold_move_project")

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def ok(data, extra_headers=None):
    h = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    if extra_headers:
        h.update(extra_headers)
    return {"statusCode": 200, "headers": h, "body": json.dumps(data, ensure_ascii=False)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}, "body": json.dumps({"error": msg})}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def handler(event: dict, context) -> dict:
    """Авторизация клиентов: register / login / me / logout"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
            "Access-Control-Max-Age": "86400",
        }, "body": ""}

    method   = event.get("httpMethod", "GET")
    params   = event.get("queryStringParameters") or {}
    action   = params.get("action", "")
    body_raw = event.get("body") or "{}"
    body     = json.loads(body_raw) if body_raw else {}

    # Токен из заголовка X-Authorization (проксируется платформой)
    headers = event.get("headers") or {}
    raw_token = headers.get("X-Authorization") or headers.get("Authorization") or ""
    token = raw_token.replace("Bearer ", "").strip()

    conn = get_conn()
    cur  = conn.cursor()

    # ── Регистрация ──────────────────────────────────────────────────────────
    if action == "register" and method == "POST":
        email    = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""
        name     = (body.get("name") or "").strip()

        if not email or not password:
            return err("Email и пароль обязательны")
        if len(password) < 6:
            return err("Пароль минимум 6 символов")

        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email=%s", (email,))
        if cur.fetchone():
            return err("Email уже зарегистрирован")

        cur.execute(
            f"INSERT INTO {SCHEMA}.users (email, password_hash, name) VALUES (%s,%s,%s) RETURNING id",
            (email, hash_password(password), name)
        )
        user_id = cur.fetchone()[0]

        new_token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {SCHEMA}.user_sessions (user_id, token) VALUES (%s,%s)",
            (user_id, new_token)
        )
        conn.commit()
        return ok({"token": new_token, "user": {"id": user_id, "email": email, "name": name}})

    # ── Вход ─────────────────────────────────────────────────────────────────
    if action == "login" and method == "POST":
        email    = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""

        if not email or not password:
            return err("Email и пароль обязательны")

        cur.execute(
            f"SELECT id, name, email FROM {SCHEMA}.users WHERE email=%s AND password_hash=%s",
            (email, hash_password(password))
        )
        row = cur.fetchone()
        if not row:
            return err("Неверный email или пароль")

        user_id, name, email_db = row
        new_token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {SCHEMA}.user_sessions (user_id, token) VALUES (%s,%s)",
            (user_id, new_token)
        )
        conn.commit()
        return ok({"token": new_token, "user": {"id": user_id, "email": email_db, "name": name}})

    # ── Профиль (проверка токена) ─────────────────────────────────────────────
    if action == "me" and method == "GET":
        if not token:
            return err("Требуется авторизация", 401)

        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)

        uid, email, name, phone = row
        return ok({"user": {"id": uid, "email": email, "name": name, "phone": phone}})

    # ── Выход ─────────────────────────────────────────────────────────────────
    if action == "logout" and method == "POST":
        if token:
            cur.execute(f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE token=%s", (token,))
            conn.commit()
        return ok({"ok": True})

    # ── Сохранить смету → заявка в CRM ────────────────────────────────────────
    if action == "save-estimate" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)

        # Проверяем токен
        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        user_id, email, user_name, phone = row

        blocks       = body.get("blocks", [])
        totals       = body.get("totals", [])
        final_phrase = body.get("finalPhrase", "")

        # Извлекаем суммы из totals: "Standard: 61 000 ₽" → 61000.0
        def extract_sum(keyword):
            import re
            for t in totals:
                if keyword.lower() in t.lower():
                    nums = re.findall(r"[\d\s]+", t.replace("\u00a0", " "))
                    cleaned = "".join("".join(nums).split())
                    if cleaned.isdigit():
                        return float(cleaned)
            return None

        total_econom   = extract_sum("econom")
        total_standard = extract_sum("standard")
        total_premium  = extract_sum("premium")

        # Сохраняем снимок сметы
        cur.execute(f"""
            INSERT INTO {SCHEMA}.saved_estimates
              (user_id, title, blocks, totals, final_phrase, total_econom, total_standard, total_premium)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id,
            "Смета на натяжные потолки",
            json.dumps(blocks, ensure_ascii=False),
            json.dumps(totals, ensure_ascii=False),
            final_phrase,
            total_econom, total_standard, total_premium,
        ))
        estimate_id = cur.fetchone()[0]

        # Создаём заявку в CRM (live_chats)
        import secrets as sec
        session_id = f"estimate-{estimate_id}-{sec.token_hex(6)}"
        cur.execute(f"""
            INSERT INTO {SCHEMA}.live_chats
              (session_id, client_name, phone, status, source, contract_sum, notes)
            VALUES (%s, %s, %s, 'new', 'estimate', %s, %s)
            RETURNING id
        """, (
            session_id,
            user_name or email,
            phone or "",
            total_standard,
            f"Смета сохранена клиентом через сайт. Email: {email}. Estimate ID: {estimate_id}",
        ))
        chat_id = cur.fetchone()[0]

        # Привязываем заявку к смете
        cur.execute(f"UPDATE {SCHEMA}.saved_estimates SET chat_id=%s WHERE id=%s", (chat_id, estimate_id))
        conn.commit()

        return ok({
            "ok": True,
            "estimate_id": estimate_id,
            "chat_id": chat_id,
        })

    # ── Список смет пользователя ───────────────────────────────────────────────
    if action == "my-estimates" and method == "GET":
        if not token:
            return err("Требуется авторизация", 401)

        cur.execute(f"""
            SELECT u.id FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        user_id = row[0]

        cur.execute(f"""
            SELECT e.id, e.title, e.total_econom, e.total_standard, e.total_premium,
                   e.status, e.created_at, lc.status as crm_status
            FROM {SCHEMA}.saved_estimates e
            LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = e.chat_id
            WHERE e.user_id = %s
            ORDER BY e.created_at DESC
        """, (user_id,))
        rows = cur.fetchall()
        estimates = [{
            "id": r[0], "title": r[1],
            "total_econom": float(r[2]) if r[2] else None,
            "total_standard": float(r[3]) if r[3] else None,
            "total_premium": float(r[4]) if r[4] else None,
            "status": r[5], "created_at": str(r[6])[:19],
            "crm_status": r[7],
        } for r in rows]
        return ok({"estimates": estimates})

    return err("Неизвестное действие", 404)