import os
import json
import base64
import tempfile
from openai import OpenAI

def handler(event: dict, context) -> dict:
    """Транскрибирует аудио через Whisper API. Принимает base64-аудио, возвращает текст."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    raw_body = event.get("body") or "{}"
    print(f"[whisper] body length: {len(raw_body)}, isBase64: {event.get('isBase64Encoded')}")
    body = json.loads(raw_body)
    audio_b64 = body.get("audio")
    mime_type = body.get("mimeType", "audio/webm")
    print(f"[whisper] mimeType={mime_type}, audio present={bool(audio_b64)}, audio len={len(audio_b64) if audio_b64 else 0}")

    if not audio_b64:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "audio required"})}

    audio_bytes = base64.b64decode(audio_b64)
    print(f"[whisper] decoded bytes: {len(audio_bytes)}")

    ext_map = {
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/mp4": ".mp4",
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
        "audio/x-m4a": ".m4a",
    }
    ext = ext_map.get(mime_type.split(";")[0].strip(), ".webm")
    print(f"[whisper] ext={ext}")

    try:
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="ru",
            )

        os.unlink(tmp_path)
        print(f"[whisper] success: {transcript.text[:50]}")

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({"text": transcript.text}),
        }
    except Exception as e:
        print(f"[whisper] ERROR: {type(e).__name__}: {e}")
        return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": str(e)})}