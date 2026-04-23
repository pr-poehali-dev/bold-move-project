import os
import json
import base64
import time
import requests

def handler(event: dict, context) -> dict:
    """Транскрибирует аудио через AssemblyAI. Принимает base64-аудио, возвращает текст."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    body = json.loads(event.get("body") or "{}")
    audio_b64 = body.get("audio")

    if not audio_b64:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "audio required"})}

    audio_bytes = base64.b64decode(audio_b64)
    api_key = os.environ["ASSEMBLYAI_API_KEY"]
    auth = {"authorization": api_key}

    # 1. Загружаем аудио
    upload = requests.post(
        "https://api.assemblyai.com/v2/upload",
        headers={**auth, "content-type": "application/octet-stream"},
        data=audio_bytes,
    ).json()
    upload_url = upload["upload_url"]

    # 2. Запускаем транскрипцию
    tr = requests.post(
        "https://api.assemblyai.com/v2/transcript",
        headers={**auth, "content-type": "application/json"},
        json={
            "audio_url": upload_url,
            "speech_models": ["universal-3-pro", "universal-2"],
            "punctuate": False,
            "format_text": False,
        },
    ).json()

    if "id" not in tr:
        return {"statusCode": 502, "headers": headers, "body": json.dumps({"error": str(tr)})}

    # 3. Polling каждые 0.5 сек — быстрее реагируем на готовность
    for _ in range(50):
        time.sleep(0.5)
        poll = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{tr['id']}",
            headers=auth,
        ).json()
        status = poll.get("status")
        if status == "completed":
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"text": poll.get("text") or ""})}
        if status == "error":
            return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": poll.get("error")})}

    return {"statusCode": 504, "headers": headers, "body": json.dumps({"error": "timeout", "text": ""})}
