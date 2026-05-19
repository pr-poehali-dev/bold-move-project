"""
Прокси для загрузки изображений — обходит CORS ограничения браузера.
Возвращает изображение как base64 data URL.
"""
import urllib.request
import base64
import json


def handler(event: dict, context) -> dict:
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    params = event.get("queryStringParameters") or {}
    url = params.get("url", "")

    if not url:
        return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "url required"})}

    # Разрешаем только наш CDN
    if "cdn.poehali.dev" not in url and "poehali.dev" not in url:
        return {"statusCode": 403, "headers": cors, "body": json.dumps({"error": "forbidden host"})}

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
            content_type = resp.headers.get("Content-Type", "image/png").split(";")[0].strip()
            b64 = base64.b64encode(data).decode("utf-8")
            data_url = f"data:{content_type};base64,{b64}"
            return {
                "statusCode": 200,
                "headers": {**cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600"},
                "body": json.dumps({"dataUrl": data_url}),
            }
    except Exception as e:
        return {"statusCode": 500, "headers": cors, "body": json.dumps({"error": str(e)})}
