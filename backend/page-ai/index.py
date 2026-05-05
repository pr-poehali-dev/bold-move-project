"""AI-редактор страниц: принимает текущие блоки + запрос пользователя, возвращает обновлённые блоки."""

import json
import os
import requests

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

SYSTEM_PROMPT = """Ты — дизайнер страниц на свободном холсте (free canvas). Тебе дают текущие блоки страницы и запрос.
Ты должен вернуть ТОЛЬКО JSON-массив блоков. Никакого текста — только чистый JSON.

=== СИСТЕМА КООРДИНАТ ===
Холст по умолчанию: ширина 1000px, высота 1200px.
Каждый блок имеет координаты:
- x: отступ от левого края (px)
- y: отступ от верхнего края (px)
- w: ширина блока (px)
- h: высота блока (px)
- zIndex: слой (1 = фон, выше = поверх)

Ты можешь размещать блоки ГДЕ УГОДНО: рядом, в колонки, поверх друг друга, в сетку.

=== ТИПЫ БЛОКОВ ===

1. Заголовок:
{"type":"heading","id":"<id>","x":40,"y":20,"w":500,"h":50,"text":"текст","size":"xl|lg|md","align":"left|center|right","zIndex":1}

2. Текст:
{"type":"text","id":"<id>","x":40,"y":80,"w":400,"h":100,"text":"текст","align":"left|center|right","zIndex":1}

3. Галерея / изображение (НЕ добавляй фото — оставь photos:[]):
{"type":"gallery","id":"<id>","x":40,"y":80,"w":300,"h":200,"photos":[],"cols":1,"ratio":"square|4/3|16/9","zIndex":1}

4. Кнопки:
{"type":"buttons","id":"<id>","x":40,"y":200,"w":300,"h":50,"items":[{"label":"Кнопка","action":"url","value":"","style":"primary|outline"}],"zIndex":1}

5. Карточка (иконка + заголовок + описание):
{"type":"card","id":"<id>","x":40,"y":80,"w":200,"h":150,"icon":"⭐","title":"Заголовок","text":"Описание","align":"center","zIndex":1}

6. Видео:
{"type":"video","id":"<id>","x":40,"y":80,"w":400,"h":225,"url":"","zIndex":1}

7. Разделитель:
{"type":"divider","id":"<id>","x":0,"y":80,"w":1000,"h":2,"style":"line|dots","zIndex":1}

=== СТИЛИ блока (опционально, поле style_) ===
{"style_":{"bgType":"color|gradient|none","bgColor":"#hex","bgGradFrom":"#hex","bgGradTo":"#hex","bgGradAngle":135,"borderWidth":2,"borderColor":"#hex","borderRadius":16,"shadowBlur":20,"shadowColor":"rgba(0,0,0,0.5)"}}

=== ПРИМЕРЫ ЛЕЙАУТОВ ===

Три колонки (ширина холста 1000px, отступы по 20px):
- Блок 1: x:20,  y:100, w:300, h:200
- Блок 2: x:350, y:100, w:300, h:200
- Блок 3: x:680, y:100, w:300, h:200

Картинка слева + текст справа:
- Галерея: x:20,  y:80, w:350, h:250
- Текст:   x:400, y:80, w:580, h:250

Картинка справа + текст слева:
- Текст:   x:20,  y:80, w:580, h:250
- Галерея: x:630, y:80, w:350, h:250

Карточки 2×2:
- x:20,  y:100, w:470, h:180  (верх-лево)
- x:510, y:100, w:470, h:180  (верх-право)
- x:20,  y:300, w:470, h:180  (низ-лево)
- x:510, y:300, w:470, h:180  (низ-право)

=== ПРАВИЛА (СТРОГО СОБЛЮДАЙ) ===

‼️ ВАЖНЕЙШЕЕ ПРАВИЛО: Результирующий массив ВСЕГДА должен содержать ВСЕ существующие блоки.
   Если пользователь просит "добавить блок" — ты возвращаешь существующие блоки + новые.
   НИКОГДА не удаляй блоки из ответа, если пользователь явно не попросил удалить конкретный блок.

- Сохраняй id и все поля существующих блоков без изменений, если они не касаются запроса
- Для НОВЫХ блоков генерируй случайный id (6-8 символов, только буквы и цифры)
- Фото в галереях НЕ трогай (оставь photos как есть)
- Соблюдай отступы: минимум 20px от краёв холста
- Блоки не должны выходить за пределы холста (x+w ≤ ширина холста)
- При "добавь блок" — вычисли максимальный y+h существующих блоков и размести новый ниже + 20px
- zIndex: у перекрывающихся блоков ставь разные значения (фон=1, поверх=2,3...)
- Возвращай ТОЛЬКО валидный JSON-массив, без markdown, без пояснений, без комментариев

Пример правильного ответа при запросе "добавь картинку справа от текста":
Если на холсте был блок {"id":"abc","type":"heading",...}, ответ должен быть:
[{"id":"abc","type":"heading",...}, {"id":"xyz123","type":"gallery",...(новый блок)}]
— оба блока в массиве!"""


def handler(event: dict, context) -> dict:
    """AI-редактор страниц: получает блоки + запрос, возвращает обновлённые блоки."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    blocks = body.get('blocks', [])
    prompt = body.get('prompt', '').strip()
    canvas_w = body.get('canvasWidth', 1000)
    canvas_h = body.get('canvasHeight', 1200)

    if not prompt:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'prompt обязателен'})}

    api_key = os.environ.get('OPENROUTER_API_KEY_2', '') or os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': 'AI не настроен'})}

    use_openrouter = bool(os.environ.get('OPENROUTER_API_KEY_2', ''))
    api_url = 'https://openrouter.ai/api/v1/chat/completions' if use_openrouter else 'https://api.openai.com/v1/chat/completions'
    model = 'openai/gpt-4o-mini' if use_openrouter else 'gpt-4o-mini'

    user_message = (
        f"Размер холста: {canvas_w}×{canvas_h}px\n"
        f"Текущие блоки страницы:\n{json.dumps(blocks, ensure_ascii=False, indent=2)}\n\n"
        f"Запрос пользователя: {prompt}"
    )

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

    ai_blocks = json.loads(content)

    # ── Защита от потери блоков ──────────────────────────────────────────────
    # AI может случайно не включить существующие блоки в ответ.
    # Восстанавливаем все исходные блоки которые AI не упомянул (по id).
    # Блоки которые AI вернул — используем версию AI (он мог их изменить/переместить).
    ai_ids = {b.get('id') for b in ai_blocks if b.get('id')}
    original_ids = {b.get('id') for b in blocks if b.get('id')}

    # Блоки из оригинала которые AI не включил — восстанавливаем как есть
    missed_blocks = [b for b in blocks if b.get('id') and b.get('id') not in ai_ids]

    if missed_blocks:
        print(f"[page-ai] ⚠️ AI пропустил {len(missed_blocks)} блоков, восстанавливаем: {[b.get('id') for b in missed_blocks]}")
        final_blocks = ai_blocks + missed_blocks
    else:
        final_blocks = ai_blocks

    print(f"[page-ai] итог: {len(blocks)} исходных → {len(ai_blocks)} от AI → {len(final_blocks)} финал")

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({'blocks': final_blocks}, ensure_ascii=False),
    }