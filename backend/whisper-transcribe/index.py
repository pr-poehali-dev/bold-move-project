import os
import json
import base64
import tempfile
from groq import Groq

def handler(event: dict, context) -> dict:
    """Транскрибирует аудио через Groq Whisper API. Принимает base64-аудио, возвращает текст."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    body = json.loads(event.get("body") or "{}")
    audio_b64 = body.get("audio")
    mime_type = body.get("mimeType", "audio/webm")

    if not audio_b64:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "audio required"})}

    audio_bytes = base64.b64decode(audio_b64)

    ext_map = {
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/mp4": ".mp4",
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
        "audio/x-m4a": ".m4a",
    }
    ext = ext_map.get(mime_type.split(";")[0].strip(), ".mp4")

    # Пробуем GROQ_API_KEY, если нет — GROQ_API_KEY2
    api_key = os.environ.get("GROQ_API_KEY2") or os.environ.get("GROQ_API_KEY")
    client = Groq(api_key=api_key)

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    with open(tmp_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=audio_file,
            language="ru",
        )

    os.unlink(tmp_path)

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({"text": transcript.text}),
    }