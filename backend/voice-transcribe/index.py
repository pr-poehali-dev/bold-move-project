import os
import json
import base64
import tempfile
import urllib.request

def handler(event: dict, context) -> dict:
    """Транскрибация голосового аудио через Deepgram Nova-2. Принимает base64 аудио, возвращает текст."""
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        audio_b64 = body.get("audio")
        mime_type = body.get("mimeType", "audio/webm")

        if not audio_b64:
            return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "audio required"})}

        audio_bytes = base64.b64decode(audio_b64)
        print(f"[voice-transcribe] received audio: {len(audio_bytes)} bytes, mime: {mime_type}")

        api_key = os.environ.get("DEEPGRAM_API_KEY", "")
        if not api_key:
            raise Exception("DEEPGRAM_API_KEY not set")

        # Deepgram Nova-2 REST API
        url = "https://api.deepgram.com/v1/listen?model=nova-2&language=ru&punctuate=false"
        req = urllib.request.Request(
            url,
            data=audio_bytes,
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": mime_type,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())

        text = result["results"]["channels"][0]["alternatives"][0]["transcript"]
        print(f"[voice-transcribe] result: '{text[:100]}'")

        return {
            "statusCode": 200,
            "headers": {**cors, "Content-Type": "application/json"},
            "body": json.dumps({"text": text.strip()}),
        }

    except Exception as e:
        print(f"[voice-transcribe] ERROR: {e}")
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"error": str(e)}),
        }
