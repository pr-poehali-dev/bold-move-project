import os, json, psycopg2
from datetime import datetime

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, X-User-Id",
}

def resp(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False, default=str)}

def get_user(cur, token: str):
    """Получить пользователя по токену."""
    cur.execute(f"SELECT u.id, u.email, u.name FROM {SCHEMA}.users u JOIN {SCHEMA}.user_sessions s ON s.user_id = u.id WHERE s.token = %s AND s.expires_at > NOW() LIMIT 1", (token,))
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "name": row[2]}

def handler(event: dict, context) -> dict:
    """CRUD для планов помещений пользователя."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    headers  = event.get("headers") or {}
    params   = event.get("queryStringParameters") or {}
    method   = event.get("httpMethod", "GET")
    raw_body = event.get("body") or "{}"
    body     = json.loads(raw_body) if raw_body else {}

    # Авторизация
    raw_token = headers.get("X-Authorization") or headers.get("x-authorization") or ""
    token = raw_token.replace("Bearer ", "").strip()
    if not token:
        return resp(401, {"error": "Требуется авторизация"})

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur  = conn.cursor()

    try:
        user = get_user(cur, token)
        if not user:
            return resp(401, {"error": "Токен недействителен"})

        user_id = user["id"]
        action  = params.get("action", "")

        # ── GET /list — список планов пользователя ────────────────────────────
        if method == "GET" and action == "list":
            cur.execute(f"""
                SELECT id, name, thumbnail, created_at, updated_at,
                       length(data::text) as data_size
                FROM {SCHEMA}.room_plans
                WHERE user_id = %s
                ORDER BY updated_at DESC
                LIMIT 50
            """, (user_id,))
            rows = cur.fetchall()
            plans = [{
                "id":         r[0],
                "name":       r[1],
                "thumbnail":  r[2],
                "created_at": r[3].isoformat() if r[3] else None,
                "updated_at": r[4].isoformat() if r[4] else None,
                "size_kb":    round((r[5] or 0) / 1024, 1),
            } for r in rows]
            return resp(200, {"plans": plans})

        # ── GET /get — загрузить конкретный план ──────────────────────────────
        if method == "GET" and action == "get":
            plan_id = params.get("id")
            if not plan_id:
                return resp(400, {"error": "Нужен id плана"})
            cur.execute(f"""
                SELECT id, name, data, thumbnail, created_at, updated_at
                FROM {SCHEMA}.room_plans
                WHERE id = %s AND user_id = %s
            """, (int(plan_id), user_id))
            row = cur.fetchone()
            if not row:
                return resp(404, {"error": "План не найден"})
            return resp(200, {"plan": {
                "id":         row[0],
                "name":       row[1],
                "data":       row[2],
                "thumbnail":  row[3],
                "created_at": row[4].isoformat() if row[4] else None,
                "updated_at": row[5].isoformat() if row[5] else None,
            }})

        # ── POST /save — создать или обновить план ────────────────────────────
        if method == "POST" and action == "save":
            plan_id   = body.get("id")
            name      = (body.get("name") or "Новый план")[:100]
            data      = body.get("data") or {}
            thumbnail = body.get("thumbnail")  # SVG data URL или None

            if plan_id:
                # Обновление существующего
                cur.execute(f"""
                    UPDATE {SCHEMA}.room_plans
                    SET name=%s, data=%s, thumbnail=%s, updated_at=NOW()
                    WHERE id=%s AND user_id=%s
                    RETURNING id, updated_at
                """, (name, json.dumps(data), thumbnail, int(plan_id), user_id))
                row = cur.fetchone()
                if not row:
                    return resp(404, {"error": "План не найден или нет доступа"})
                conn.commit()
                return resp(200, {"id": row[0], "updated_at": row[1].isoformat(), "saved": True})
            else:
                # Проверяем лимит (макс 20 планов)
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.room_plans WHERE user_id=%s", (user_id,))
                count = cur.fetchone()[0]
                if count >= 20:
                    return resp(400, {"error": "Достигнут лимит планов (20). Удалите старые."})

                cur.execute(f"""
                    INSERT INTO {SCHEMA}.room_plans (user_id, name, data, thumbnail)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, created_at
                """, (user_id, name, json.dumps(data), thumbnail))
                row = cur.fetchone()
                conn.commit()
                return resp(200, {"id": row[0], "created_at": row[1].isoformat(), "saved": True})

        # ── DELETE /delete — удалить план ─────────────────────────────────────
        if method == "POST" and action == "delete":
            plan_id = body.get("id")
            if not plan_id:
                return resp(400, {"error": "Нужен id плана"})
            cur.execute(f"""
                UPDATE {SCHEMA}.room_plans SET data='{{}}', name='[удалён]'
                WHERE id=%s AND user_id=%s
                RETURNING id
            """, (int(plan_id), user_id))
            # Фактически просто помечаем — реальное удаление через admin
            # Используем трюк: обновляем запись, чтобы не нарушать целостность
            conn.commit()
            # Теперь удаляем по-настоящему (безопасно, своя запись)
            cur.execute(f"DELETE FROM {SCHEMA}.room_plans WHERE id=%s AND user_id=%s", (int(plan_id), user_id))
            conn.commit()
            return resp(200, {"deleted": True})

        # ── POST /rename — переименовать ──────────────────────────────────────
        if method == "POST" and action == "rename":
            plan_id = body.get("id")
            name    = (body.get("name") or "")[:100].strip()
            if not plan_id or not name:
                return resp(400, {"error": "Нужен id и name"})
            cur.execute(f"""
                UPDATE {SCHEMA}.room_plans SET name=%s, updated_at=NOW()
                WHERE id=%s AND user_id=%s RETURNING id
            """, (name, int(plan_id), user_id))
            if not cur.fetchone():
                return resp(404, {"error": "План не найден"})
            conn.commit()
            return resp(200, {"renamed": True})

        return resp(400, {"error": f"Неизвестный action: {action}"})

    except Exception as e:
        conn.rollback()
        return resp(500, {"error": str(e)})
    finally:
        cur.close()
        conn.close()
