import os
import json
import base64
import tempfile
from groq import Groq

def handler(event: dict, context) -> dict:
    """Транскрибация голосового аудио через Groq Whisper. Принимает base64 аудио, возвращает текст."""
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

        ext_map = {
            "audio/webm": ".webm",
            "audio/ogg": ".ogg",
            "audio/mp4": ".mp4",
            "audio/mpeg": ".mp3",
            "audio/wav": ".wav",
        }
        ext = ext_map.get(mime_type.split(";")[0].strip(), ".webm")

        client = Groq(api_key=os.environ["GROQ_API_KEY"])

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        with open(tmp_path, "rb") as f:
            result = client.audio.transcriptions.create(
                file=(f"audio{ext}", f, mime_type),
                model="whisper-large-v3-turbo",
                language="ru",
                response_format="text",
            )

        os.unlink(tmp_path)

        text = result if isinstance(result, str) else getattr(result, "text", str(result))
        return {
            "statusCode": 200,
            "headers": {**cors, "Content-Type": "application/json"},
            "body": json.dumps({"text": text.strip()}),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"error": str(e)}),
        }
