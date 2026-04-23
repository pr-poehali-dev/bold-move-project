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
    aai_headers = {"authorization": api_key}

    # 1. Загружаем аудио
    upload_res = requests.post(
        "https://api.assemblyai.com/v2/upload",
        headers={**aai_headers, "content-type": "application/octet-stream"},
        data=audio_bytes,
    )
    upload_url = upload_res.json()["upload_url"]

    # 2. Запускаем транскрипцию
    transcript_res = requests.post(
        "https://api.assemblyai.com/v2/transcript",
        headers={**aai_headers, "content-type": "application/json"},
        json={"audio_url": upload_url, "speech_models": ["universal-3-pro"], "language_code": "ru"},
    )
    transcript_data = transcript_res.json()
    if "id" not in transcript_data:
        return {"statusCode": 502, "headers": headers, "body": json.dumps({"error": f"AAI error: {transcript_data}"})}
    transcript_id = transcript_data["id"]

    # 3. Polling до готовности (макс 25 сек)
    for i in range(25):
        time.sleep(1)
        poll = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
            headers=aai_headers,
        ).json()
        status = poll.get("status")
        print(f"poll {i}: status={status}")
        if status == "completed":
            text = poll.get("text") or ""
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"text": text})}
        if status == "error":
            return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": poll.get("error")})}

    return {"statusCode": 504, "headers": headers, "body": json.dumps({"error": "timeout", "text": ""})}