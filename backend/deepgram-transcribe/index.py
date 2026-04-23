import os
import json
import base64
import requests

def handler(event: dict, context) -> dict:
    """Транскрибирует аудио через Deepgram Nova-2. Быстро, работает из РФ."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    body = json.loads(event.get("body") or "{}")
    audio_b64 = body.get("audio")
    mime_type = body.get("mimeType", "audio/mp4")

    if not audio_b64:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "audio required"})}

    audio_bytes = base64.b64decode(audio_b64)
    api_key = os.environ["DEEPGRAM_API_KEY"]

    # Deepgram: синхронный запрос, ответ за 1-2 сек
    res = requests.post(
        "https://api.deepgram.com/v1/listen?model=nova-2&language=ru&punctuate=true",
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": mime_type,
        },
        data=audio_bytes,
        timeout=30,
    )

    data = res.json()

    if res.status_code != 200:
        return {"statusCode": res.status_code, "headers": headers, "body": json.dumps({"error": str(data)})}

    text = data.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")
    return {"statusCode": 200, "headers": headers, "body": json.dumps({"text": text})}
