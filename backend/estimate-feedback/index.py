import os
import json
import urllib.request

def handler(event: dict, context) -> dict:
    """Принимает правки клиента по смете и отправляет их в Telegram."""

    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    body = json.loads(event.get("body") or "{}")
    estimate_text = body.get("estimate_text", "")
    comments: dict = body.get("comments", {})

    if not comments:
        return {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "No comments provided"}),
        }

    # Формируем сообщение для Telegram
    lines = ["✏️ *Клиент хочет изменить смету*\n"]

    # Парсим смету чтобы найти названия позиций по ключу bi-ii
    estimate_lines = [l.strip() for l in estimate_text.split("\n") if l.strip()]
    items_flat = []
    for line in estimate_lines:
        if line.startswith("-") or (line and not line[0].isdigit()):
            items_flat.append(line.lstrip("- "))

    for key, comment in comments.items():
        if not comment.strip():
            continue
        # key формат: "bi-ii", попробуем найти имя позиции
        lines.append(f"📌 Позиция `{key}`: {comment.strip()}")

    lines.append(f"\n📋 *Текст сметы:*\n```\n{estimate_text[:800]}\n```")

    message = "\n".join(lines)

    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_OWNER_CHAT_ID", "")

    if bot_token and chat_id:
        tg_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = json.dumps({
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown",
        }).encode("utf-8")
        req = urllib.request.Request(
            tg_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"ok": True}),
    }
