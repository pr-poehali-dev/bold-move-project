import os
import json
import base64
import requests

def handler(event: dict, context) -> dict:
    """Транскрибирует аудио через AssemblyAI v3 (синхронно). Принимает base64-аудио, возвращает текст."""
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
    aai_headers = {"authorization": api_key, "content-type": "application/json"}

    # Синхронная транскрипция через v3 — результат сразу без polling
    res = requests.post(
        "https://api.assemblyai.com/v3/transcripts",
        headers=aai_headers,
        json={
            "audio": f"data:audio/mp4;base64,{audio_b64}",
            "speech_model": "universal",
            "language_detection": True,
        },
    )
    data = res.json()

    # Если v3 не сработал — fallback на v2 с polling
    if "text" not in data and "id" not in data:
        return {"statusCode": 502, "headers": headers, "body": json.dumps({"error": str(data)})}

    if "text" in data:
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"text": data["text"] or ""})}

    # v2 polling fallback
    import time
    transcript_id = data["id"]
    for _ in range(55):
        time.sleep(1)
        poll = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
            headers={"authorization": api_key},
        ).json()
        if poll.get("status") == "completed":
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"text": poll.get("text") or ""})}
        if poll.get("status") == "error":
            return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": poll.get("error")})}

    return {"statusCode": 504, "headers": headers, "body": json.dumps({"error": "timeout", "text": ""})}
