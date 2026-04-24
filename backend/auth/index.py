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

    return err("Неизвестное действие", 404)
