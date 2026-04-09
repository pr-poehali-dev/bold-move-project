"""Live chat v2: пересылает сообщения клиента в Telegram и доставляет ответы оператора обратно."""

import json
import os
import uuid
import psycopg2
import requests

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")
# Токен берём из секрета, если он заполнен — иначе хардкод
TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TG_CHAT_ID = os.environ.get("TELEGRAM_OWNER_CHAT_ID", "")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def tg_send(text: str, reply_to: int = None) -> int:
    """Отправляет сообщение в Telegram, возвращает message_id."""
    token = TG_TOKEN
    chat_id = TG_CHAT_ID
    if not token or not chat_id:
        return 0
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_to:
        payload["reply_to_message_id"] = reply_to
    try:
        r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload, timeout=10)
        data = r.json()
        print(f"TG response: {data}")
        if data.get("ok"):
            return data["result"]["message_id"]
        else:
            print(f"TG error: {data}")
    except Exception as e:
        print(f"TG exception: {e}")
    return 0


def handler(event, context):
    """Обрабатывает сообщения live-чата и Telegram webhook."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    body = json.loads(event.get("body") or "{}")
    params = event.get("queryStringParameters") or {}
    # action передаётся как query-параметр: ?action=send / ?action=poll / ?action=webhook
    action = params.get("action", "send")

    # ── Webhook от Telegram (ответ оператора) ────────────────────────────────
    if action == "webhook":
        tg_msg = body.get("message", {})
        if not tg_msg:
            return {"statusCode": 200, "headers": CORS, "body": "{}"}

        reply_to = tg_msg.get("reply_to_message", {})
        text = tg_msg.get("text", "").strip()

        if not reply_to or not text or text.startswith("/"):
            return {"statusCode": 200, "headers": CORS, "body": "{}"}

        # Находим сессию по message_id исходного сообщения
        orig_id = reply_to.get("message_id")
        conn = db()
        cur = conn.cursor()
        cur.execute(
            f"SELECT session_id FROM {SCHEMA}.live_chats WHERE telegram_message_id = %s",
            (orig_id,)
        )
        row = cur.fetchone()
        if row:
            session_id = row[0]
            cur.execute(
                f"INSERT INTO {SCHEMA}.live_messages (session_id, role, text) VALUES (%s, 'operator', %s)",
                (session_id, text)
            )
            cur.execute(
                f"UPDATE {SCHEMA}.live_chats SET last_message_at = NOW() WHERE session_id = %s",
                (session_id,)
            )
            conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": CORS, "body": "{}"}

    # ── Клиент отправляет сообщение ───────────────────────────────────────────
    if method == "POST" and action == "send":
        session_id = body.get("session_id") or str(uuid.uuid4())
        text = (body.get("text") or "").strip()
        client_name = body.get("name", "Клиент с сайта")

        if not text:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "empty"})}

        conn = db()
        cur = conn.cursor()

        # Проверяем / создаём сессию
        cur.execute(f"SELECT telegram_message_id FROM {SCHEMA}.live_chats WHERE session_id = %s", (session_id,))
        row = cur.fetchone()

        is_new = (row is None) or (row[0] == 0)

        if row is None:
            # Совсем новая сессия
            cur.execute(
                f"INSERT INTO {SCHEMA}.live_chats (session_id, client_name, telegram_message_id) VALUES (%s, %s, 0)",
                (session_id, client_name)
            )
            conn.commit()

        # Сохраняем сообщение клиента
        cur.execute(
            f"INSERT INTO {SCHEMA}.live_messages (session_id, role, text) VALUES (%s, 'client', %s)",
            (session_id, text)
        )
        cur.execute(
            f"UPDATE {SCHEMA}.live_chats SET last_message_at = NOW() WHERE session_id = %s",
            (session_id,)
        )
        conn.commit()

        # Шлём в Telegram
        if is_new:
            tg_text = (
                f"💬 <b>Новый чат с сайта</b>\n"
                f"👤 <b>{client_name}</b>\n\n"
                f"{text}\n\n"
                f"<i>↩️ Нажми Reply на это сообщение чтобы ответить клиенту</i>"
            )
        else:
            tg_text = f"👤 <b>{client_name}</b>:\n{text}"

        msg_id = tg_send(tg_text)
        print(f"Sent to TG, msg_id={msg_id}, is_new={is_new}, session={session_id}")

        # Сохраняем msg_id для привязки reply
        if msg_id:
            cur.execute(
                f"UPDATE {SCHEMA}.live_chats SET telegram_message_id = %s WHERE session_id = %s",
                (msg_id, session_id)
            )
            conn.commit()

        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"session_id": session_id, "ok": True})}

    # ── Клиент опрашивает новые сообщения от оператора (polling) ─────────────
    if method == "GET" and action == "poll":
        session_id = params.get("session_id", "")
        since_id = int(params.get("since_id", 0))

        if not session_id:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "no session"})}

        conn = db()
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, role, text, created_at FROM {SCHEMA}.live_messages "
            f"WHERE session_id = %s AND id > %s AND role = 'operator' ORDER BY id",
            (session_id, since_id)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        messages = [{"id": r[0], "role": r[1], "text": r[2], "created_at": r[3].isoformat()} for r in rows]
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"messages": messages})}

    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}