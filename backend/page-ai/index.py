"""AI-редактор страниц: принимает текущие блоки + запрос пользователя, возвращает обновлённые блоки."""

import json
import os
import requests

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

SYSTEM_PROMPT = """Ты — редактор страниц сайта. Тебе дают текущие блоки страницы в виде JSON и запрос пользователя.
Ты должен вернуть ТОЛЬКО обновлённый JSON-массив блоков. Никакого текста вокруг — только чистый JSON.

Доступные типы блоков (width, paddingTop, paddingBottom, bg, hidden — опциональные поля):

1. Заголовок:
{"type":"heading","id":"<id>","text":"текст","size":"xl|lg|md","align":"left|center|right","width":100}

2. Текст:
{"type":"text","id":"<id>","text":"текст","align":"left|center|right","width":100}

3. Галерея (фото не добавляй — оставь существующие или пустой массив):
{"type":"gallery","id":"<id>","photos":[],"cols":1|2|3|4,"ratio":"square|4/3|16/9","width":100}

4. Кнопки:
{"type":"buttons","id":"<id>","items":[{"label":"текст","action":"phone|whatsapp|telegram|url","value":"...","style":"primary|outline"}],"align":"left|center|right","width":100}

5. Карточка (иконка + заголовок + текст, удобна для рядов по 2-4 штуки):
{"type":"card","id":"<id>","icon":"⭐","title":"Заголовок","text":"Описание","align":"center","width":50}

6. Видео (YouTube или Vimeo):
{"type":"video","id":"<id>","url":"https://youtube.com/watch?v=...","width":100}

7. Разделитель:
{"type":"divider","id":"<id>","style":"line|dots|space","width":100}

8. Отступ:
{"type":"spacer","id":"<id>","height":32,"width":100}

Общие опциональные поля для любого блока:
- width: 25|33|50|67|75|100 — ширина блока в % (блоки с width<100 автоматически встают рядом)
- paddingTop, paddingBottom: число px
- bg: CSS-цвет, например "#1a1a2e"
- hidden: true/false

Правила:
- Сохраняй существующие id если блок остаётся
- Для новых блоков генерируй случайный id (6-8 символов)
- Фотографии в галереях НЕ трогай
- Если просят "в ряд 3 штуки" — используй width:33 для 3 блоков подряд
- Если просят "2 колонки" — используй width:50 для пар блоков
- Если просят улучшить дизайн — переставляй, меняй ширины, добавляй карточки/разделители
- Возвращай ТОЛЬКО валидный JSON-массив, без markdown, без пояснений"""


def handler(event: dict, context) -> dict:
    """AI-редактор страниц: получает блоки + запрос, возвращает обновлённые блоки."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    blocks = body.get('blocks', [])
    prompt = body.get('prompt', '').strip()

    if not prompt:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'prompt обязателен'})}

    api_key = os.environ.get('OPENROUTER_API_KEY_2', '') or os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': 'AI не настроен'})}

    use_openrouter = bool(os.environ.get('OPENROUTER_API_KEY_2', ''))
    api_url = 'https://openrouter.ai/api/v1/chat/completions' if use_openrouter else 'https://api.openai.com/v1/chat/completions'
    model = 'openai/gpt-4o-mini' if use_openrouter else 'gpt-4o-mini'

    user_message = f"Текущие блоки страницы:\n{json.dumps(blocks, ensure_ascii=False, indent=2)}\n\nЗапрос пользователя: {prompt}"

    res = requests.post(
        api_url,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': model,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': user_message},
            ],
            'temperature': 0.7,
            'max_tokens': 4000,
        },
        timeout=30,
    )

    print(f"[page-ai] status={res.status_code} body_preview={res.text[:200]}")

    if not res.ok:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': f'AI вернул {res.status_code}: {res.text[:100]}'})}

    content = res.json()['choices'][0]['message']['content'].strip()

    # Чистим на случай если AI обернул в markdown
    if content.startswith('```'):
        lines = content.split('\n')
        content = '\n'.join(lines[1:-1]) if lines[-1] == '```' else '\n'.join(lines[1:])
    content = content.strip()

    print(f"[page-ai] parsed content preview: {content[:100]}")

    new_blocks = json.loads(content)

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({'blocks': new_blocks}, ensure_ascii=False),
    }