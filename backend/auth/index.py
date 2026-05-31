import json  # v3-cleanup
from shared import get_conn, ok, err
from handlers import auth, estimates, team, admin, wl, ai


def handler(event: dict, context) -> dict:
    """Авторизация и управление пользователями — роутер по action"""
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

    headers   = event.get("headers") or {}
    raw_token = headers.get("X-Authorization") or headers.get("Authorization") or ""
    token     = raw_token.replace("Bearer ", "").strip()

    conn = get_conn()
    cur  = conn.cursor()

    args = (action, method, params, body, token, event, conn, cur)

    result = (
        auth.handle(*args)
        or estimates.handle(*args)
        or team.handle(*args)
        or admin.handle(*args)
        or wl.handle(*args)
        or ai.handle(*args)
    )

    if result is not None:
        return result

    return err("Неизвестное действие", 404)