import os
import json
import requests

def handler(event: dict, context) -> dict:
    """
    Принимает текущий промпт и голосовую команду (что изменить),
    спрашивает GPT как именно добавить/изменить промпт, возвращает обновлённый текст.
    """
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    body = json.loads(event.get("body") or "{}")
    current_prompt = body.get("prompt", "")
    voice_command = body.get("command", "")
    prompt_type = body.get("promptType", "math")  # math | semantic | combine

    if not voice_command:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "command required"})}

    type_descriptions = {
        "math": "математической оценки сложности (получает числовой балл и объясняет его)",
        "semantic": "семантической оценки объекта (оценивает риски, комбинации позиций, нестандартные ситуации)",
        "combine": "объединения результатов (выдаёт итоговую оценку и рекомендуемую скидку в JSON)",
    }
    type_desc = type_descriptions.get(prompt_type, "AI-анализа")

    system = (
        "Ты — редактор AI-промптов для системы анализа сложности монтажных работ. "
        "Тебе дают текущий промпт и голосовую команду что нужно изменить или добавить. "
        "Ты возвращаешь ТОЛЬКО обновлённый промпт — без объяснений, без markdown, без кавычек. "
        "Сохраняй стиль и структуру оригинального промпта. "
        "Если команда просит добавить — добавь органично. "
        "Если изменить — измени только нужное место. "
        "Если удалить — убери указанное."
    )

    user_message = (
        f"Это промпт для этапа {type_desc}.\n\n"
        f"ТЕКУЩИЙ ПРОМПТ:\n{current_prompt}\n\n"
        f"ГОЛОСОВАЯ КОМАНДА: {voice_command}\n\n"
        f"Верни обновлённый промпт:"
    )

    api_key = os.environ["POLZA_API_KEY"]
    res = requests.post(
        "https://api.polza.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "openai/gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": 1500,
            "temperature": 0.3,
        },
        timeout=25,
    )

    if res.status_code != 200:
        return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": f"Polza error: {res.text[:200]}"})}

    data = res.json()
    updated_prompt = data["choices"][0]["message"]["content"].strip()

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({"prompt": updated_prompt}),
    }