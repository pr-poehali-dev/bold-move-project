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
        print(f"[voice-transcribe] received audio: {len(audio_bytes)} bytes, mime: {mime_type}")

        ext_map = {
            "audio/webm": ".webm",
            "audio/ogg": ".ogg",
            "audio/mp4": ".mp4",
            "audio/mpeg": ".mp3",
            "audio/wav": ".wav",
        }
        ext = ext_map.get(mime_type.split(";")[0].strip(), ".webm")

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        # Пробуем оба ключа по очереди
        api_keys = [k for k in [
            os.environ.get("GROQ_API_KEY"),
            os.environ.get("GROQ_API_KEY2"),
        ] if k]

        last_error = None
        text = None
        for api_key in api_keys:
            try:
                client = Groq(api_key=api_key)
                with open(tmp_path, "rb") as f:
                    result = client.audio.transcriptions.create(
                        file=(f"audio{ext}", f, mime_type),
                        model="whisper-large-v3-turbo",
                        language="ru",
                        response_format="text",
                    )
                text = result if isinstance(result, str) else getattr(result, "text", str(result))
                print(f"[voice-transcribe] result: '{text.strip()[:100]}'")
                break
            except Exception as e:
                last_error = e
                print(f"[voice-transcribe] key failed: {e}")

        try:
            os.unlink(tmp_path)
        except Exception:
            pass

        if text is not None:
            return {
                "statusCode": 200,
                "headers": {**cors, "Content-Type": "application/json"},
                "body": json.dumps({"text": text.strip()}),
            }

        raise last_error or Exception("No API keys available")

    except Exception as e:
        print(f"[voice-transcribe] ERROR: {e}")
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"error": str(e)}),
        }