"""AI-помощник MOSPOTOLKI — отвечает на вопросы о натяжных потолках и считает стоимость."""

import json
import os
import re
import requests
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')


def get_knowledge(query: str) -> str:
    """Загружает все активные записи из faq_items и возвращает как контекст."""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            f"SELECT title, content FROM {SCHEMA}.faq_items WHERE used = true ORDER BY id"
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        if not rows:
            return ''
        parts = []
        for title, content in rows:
            parts.append(f"=== {title} ===\n{content}")
        return '\n\n'.join(parts)
    except Exception as e:
        print(f"[KB] error: {e}")
        return ''

# Кэш частых вопросов — не тратим токены на LLM
FAQ_CACHE = {
    r"(гарантия|сколько служит|срок службы)": "Гарантия — 10 лет. Срок службы полотна — 25–30 лет.\n\nЗаписаться на замер: +7 (977) 606-89-01",
    r"(сколько времени|как долго|срок монтаж|когда будет готов|сколько дней)": "Монтаж комнаты — 1–3 часа. Готово в день замера или через 1–3 рабочих дня.\n\n+7 (977) 606-89-01",
    r"(телефон|номер|контакт|связаться|позвонить|whatsapp|вотсап|telegram|телеграм)": "📞 +7 (977) 606-89-01\n💬 wa.me/79776068901\n✈️ @JoniKras\nЕжедневно 8:00–22:00",
    r"(адрес|офис|шоурум|где находит|мытищ)": "Работаем по Москве и МО. Офис — Мытищи.\nАдрес пришлём при записи: +7 (977) 606-89-01",
    r"(скидк|акци|промокод|дешевле)": "Актуальные акции — у менеджера: +7 (977) 606-89-01\n\nНазовите площадь — рассчитаю стоимость прямо сейчас.",
    r"(привет|здравствуй|добрый день|добрый вечер|добрый утр|здаров|хай|hi\b|hello)": "Привет! Я AI-сметчик MosPotolki.\n\nНазовите площадь комнаты и тип потолка — сделаю расчёт за секунду.",
    r"(спасибо|благодарю|спасиб|отлично|супер|класс|👍)": "Рад помочь! Технолог приедет на замер бесплатно.\n\nЗаписаться: +7 (977) 606-89-01",
    r"(замер|выезд|приедет|технолог)": "Замер бесплатный — технолог приедет, сделает расчёт и 3D-проект.\n\n+7 (977) 606-89-01 · ежедневно 8:00–22:00",
    r"(что умеешь|как ты работаешь|что можешь|помоги|с чего начать)": "Называйте площадь комнаты и тип потолка — составлю смету с ценами по каждой позиции.\n\nПример: «Комната 20 м², матовый белый»",
    r"^(цены|прайс|расценки|прайс-лист)$": "Цены от:\n• Матовый белый — от 399 ₽/м²\n• Цветной — от 900 ₽/м²\n• Тканевый — от 2200 ₽/м²\n\nДля точного расчёта назовите площадь комнаты.",
}

# Простой расчёт базовой сметы без LLM (только площадь + тип полотна)
CANVAS_PRICES = {
    'classic': ('MSD Classic матовый', 399),
    'premium': ('MSD Premium матовый', 460),
    'evolution': ('MSD Evolution матовый', 490),
    'bauf': ('BAUF Германия матовый', 499),
    'цветной': ('Цветной MSD', 900),
    'ткань': ('Тканевый ДЕСКОР', 2200),
}

def try_simple_estimate(text: str) -> str | None:
    """Перехватываем ТОЛЬКО совсем простые запросы без доп. позиций."""
    t = text.lower()
    # Не перехватываем если есть дополнительные позиции
    has_extras = re.search(
        r'(светильник|лента|закладн|ниш|шторн|парящ|теневой|двухуровн|керамогран|вентил|люстр|блок питани)',
        t
    )
    if has_extras:
        return None
    # Ищем площадь
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:м²|м2|кв\.?\s*м|квадрат)', t)
    if not m:
        return None
    area = float(m.group(1).replace(',', '.'))
    if area < 1 or area > 500:
        return None
    # Только если запрос очень простой (площадь + тип полотна максимум)
    word_count = len(t.split())
    if word_count > 12:
        return None

    canvas_key = 'classic'
    if re.search(r'(ткань|тканев|дескор)', t):
        canvas_key = 'ткань'
    elif re.search(r'цветн', t):
        canvas_key = 'цветной'
    elif re.search(r'(bauf|бауф|немецк)', t):
        canvas_key = 'bauf'
    elif re.search(r'(evolution|эволюц)', t):
        canvas_key = 'evolution'
    elif re.search(r'(premium|премиум)', t):
        canvas_key = 'premium'

    canvas_name, canvas_price = CANVAS_PRICES[canvas_key]
    perim = round(area * 1.3, 1)
    is_pvh = canvas_key != 'ткань'

    canvas_total = round(area * canvas_price)
    raskroy = round(area * 100) if is_pvh else 0
    ogarp = round(area * 100) if is_pvh else 0
    profile = round(perim * 200)
    mount_canvas = round(area * (350 if is_pvh else 500))
    mount_profile = round(perim * 200)

    standard = canvas_total + raskroy + ogarp + profile + mount_canvas + mount_profile
    econom = round(standard * 0.77)
    premium_price = round(standard * 1.27)

    lines = ["1. Полотно:"]
    lines.append(f"  {canvas_name} {area}м² = {canvas_total}₽")
    if is_pvh:
        lines.append(f"  Раскрой ПВХ {area}м² = {raskroy}₽")
        lines.append(f"  Огарпунивание {area}м² = {ogarp}₽")
    lines.append(f"\n2. Профиль:")
    lines.append(f"  Стеновой алюм {perim}пм = {profile}₽")
    lines.append(f"\n3. Услуги монтажа:")
    lines.append(f"  {'Монтаж ПВХ' if is_pvh else 'Монтаж ткани'} {area}м² = {mount_canvas}₽")
    lines.append(f"  Монтаж профиля {perim}пм = {mount_profile}₽")
    lines.append(f"\nEconom:  {econom:,}₽".replace(',', ' '))
    lines.append(f"Standard: {standard:,}₽".replace(',', ' '))
    lines.append(f"Premium:  {premium_price:,}₽".replace(',', ' '))
    lines.append(f"\nЭто предварительный расчёт.\nТочную стоимость назовёт технолог\nна бесплатном замере.\nНа какой день вас записать?")

    return '\n'.join(lines)


def get_cached_answer(text: str) -> str | None:
    """Проверяет кэш и простой расчёт. Возвращает ответ или None."""
    text_lower = text.lower().strip()

    # Сначала пробуем простой расчёт по площади
    estimate = try_simple_estimate(text_lower)
    if estimate:
        return estimate

    # Потом — кэш FAQ
    for pattern, answer in FAQ_CACHE.items():
        if re.search(pattern, text_lower):
            return answer
    return None

SYSTEM_PROMPT = """Ты сметчик-технолог компании MosPotolki (натяжные потолки, Мытищи, с 2009г). Отвечай по-русски. Тел:+7(977)606-89-01.

ЦЕНЫ (₽):

ПОЛОТНА (за м²):
MSD Classic матовый — 399
MSD Premium матовый — 460
MSD Evolution матовый — 490
BAUF Германия матовый — 499
Цветной матовый MSD — 900
Тканевый ДЕСКОР Германия — 2200
Раскрой ПВХ — 100/м²
Огарпунивание ПВХ — 100/м²

ПРОФИЛЬ СТАНДАРТНЫЙ (за пм):
Стеновой ПВХ — 150
Стеновой алюминий — 200
Потолочный алюминий — 200

ТЕНЕВОЙ ПРОФИЛЬ (за пм):
EuroKRAAB стеновой — 550
EuroKRAAB потолочный — 550
Теневой с подсветкой — 750

ПАРЯЩИЙ ПРОФИЛЬ (за пм):
Парящий ПК-6 без рассеивателя — 1300
Парящий FLEXY с рассеивателем — 1450
Flexy FLY 02 — 1450 (по умолчанию если парящий не указан)

НИШИ ДЛЯ ШТОР (за пм):
Брус БП-40 — 850
Sigma — 1400
Sigma LED — 1650
Ниша без перегиба — 1700
Ниша с перегибом — 1900
Ниша ПК-12 (3 ряда) — 3600
Ниша ПК-15 (2 ряда) — 3600
SLOTT MADERNO 40 — 5200
SLOTT MADERNO 60 — 5500
SLOTT MADERNO 80 — 5800

ДВУХУРОВНЕВЫЕ (за пм):
ПП-75 — 500
Apply с подсветкой — 1400

ЗАКЛАДНЫЕ (за шт):
Под светильник ∅90 — 350
Под светильник ∅100-300 — 450
Под светильник ∅300-600 — 600
Под накладной — 500
Под квадратный — 950
Под нестандартный — 1500
Под вытяжку ∅100-150 — 500
Под люстру крюк — 500
Под люстру планка — 700
Под люстру крестовина — 1400

ОСВЕЩЕНИЕ:
Светильник GX-53 + лампа — 400/шт
Лента QF Premium 5м — 4000/катушка
Лента QF MIX 5м — 7000/катушка
Блок питания 100 Вт — 3500
Блок питания 200 Вт — 5000
Блок питания 400 Вт — 7000

УСЛУГИ МОНТАЖА:
Монтаж полотна ПВХ — 350/м²
Монтаж полотна ТКАНЬ — 500/м²
Монтаж профиля стандарт — 200/пм
Монтаж теневого профиля — 350/пм
Монтаж парящего профиля — 350/пм
Монтаж закладной — 350/шт
Монтаж разводки ГОСТ 0.75 — 700/шт (1 точка = 1.5 пм)
Монтаж ленты — 350/пм
Монтаж блока питания — 500/шт
Монтаж по керамограниту — 500/пм

ПРАВИЛА РАСЧЁТА:
- Периметр = 1.3 × площадь (если не указан клиентом). Профиль ≥ периметра
- ПВХ полотно: ВСЕГДА добавь Раскрой + Огарпунивание + Монтаж полотна ПВХ
- Ткань: добавь Монтаж полотна ТКАНЬ
- Каждой позиции — монтаж. Все монтажи в одном блоке "Услуги монтажа"
- Лента кратна 5м: нужно 6м → выписывай 10м (бухты по 5м)
- Теневой/Парящий: их метраж ВЫЧЕСТЬ из стандартного алюминиевого профиля
- Парящий без уточнения = Flexy FLY 02
- Световые линии = вид профиля (теневой или парящий)
- Парящий для подсветки: добавь ленту и блоки питания в блок Освещение
- При наличии освещения добавлять Монтаж разводки ГОСТ 0.75 (1 точка = 1.5 пм)
- Закладная под шкаф = Брус БП-40
- Теневой ПРОФИЛЬ (EuroKRAAB) ≠ теневой ВЕНТИЛЯТОР (Монолит) — различай!
- Не пропускай позиции! Есть позиция — есть монтаж.

ОГРАНИЧЕНИЯ:
- Не добавляй позиции которые не указаны клиентом
- Не задавай уточняющих вопросов до расчёта
- Не показывай клиенту формулу расчёта периметра
- Не пиши более 44 символов в одной строке
- Не показывай логику: (название) — (кол-во) × (цена) = (сумма)
- Не искажай стоимость и не пропускай позиции

ФОРМАТ ОТВЕТА:
Блоками с пропуском между ними. Нумеруй заголовки:
1. Полотно:
2. Профиль:
3. Освещение:
4. Ниши для штор:
5. Услуги монтажа:

Итоговая стоимость — 3 варианта:
Econom: X ₽  (−23% от Standard, без указания процента)
Standard: X ₽
Premium: X ₽  (+27% от Standard, без указания процента)

Финальная фраза ВСЕГДА:
"Это предварительный расчёт. Точную стоимость назовёт наш технолог на бесплатном замере. На какой день вас записать?"

КОМПАНИЯ: MosPotolki, Мытищи, с 2009г. Тел: +7(977)606-89-01. Ежедневно 8:00–22:00.
"""

HF_TOKEN = os.environ.get('HF_TOKEN', '')
TAVILY_KEY = os.environ.get('TAVILY_API_KEY', '')
AWS_KEY = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET = os.environ.get('AWS_SECRET_ACCESS_KEY', '')

# Запросы, при которых поиск не нужен (смета, базовые вопросы)
SEARCH_SKIP = re.compile(
    r'(привет|здравствуй|спасибо|замер|гарантия|адрес|телефон|контакт|'
    r'\d+\s*м[²2]|площадь|смета|рассчитай|посчитай|сколько стоит\s+\d)',
    re.IGNORECASE
)

# Запросы про вдохновение/тренды — только для них показываем картинки из Tavily
SEARCH_VISUAL = re.compile(
    r'(тренд|модн|популярн|вдохновени|идеи|примеры|стил|интерьер|фото|какие бывают)',
    re.IGNORECASE
)

# Запросы на генерацию изображения через FLUX
IMAGE_GEN = re.compile(
    r'(нарисуй|сгенерируй|визуализ|покажи как (будет|выглядит)|создай изображен|'
    r'сделай дизайн|придумай дизайн|как (будет )?выглядеть|покажи дизайн|'
    r'хочу (увидеть|посмотреть)|пример дизайна|покажи.*профил|покажи.*потолок)',
    re.IGNORECASE
)


def generate_image(prompt_ru: str) -> str | None:
    """Генерирует изображение через FLUX и загружает в S3. Возвращает CDN URL или None."""
    import base64, uuid, boto3
    try:
        # Переводим описание в английский промпт для FLUX
        en_prompt = (
            f"stretch ceiling interior design, {prompt_ru}, "
            "photorealistic, modern room, high quality, 4k, interior photography"
        )
        # Генерируем через HuggingFace FLUX
        resp = requests.post(
            'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
            headers={'Authorization': f'Bearer {HF_TOKEN}'},
            json={'inputs': en_prompt},
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"[flux] error {resp.status_code}: {resp.text[:200]}")
            return None

        # Загружаем в S3
        img_bytes = resp.content
        key = f"ai-designs/{uuid.uuid4()}.jpg"
        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=AWS_KEY,
            aws_secret_access_key=AWS_SECRET,
        )
        s3.put_object(Bucket='files', Key=key, Body=img_bytes, ContentType='image/jpeg')
        cdn_url = f"https://cdn.poehali.dev/projects/{AWS_KEY}/bucket/{key}"
        return cdn_url
    except Exception as e:
        print(f"[flux] exception: {e}")
        return None


def web_search(query: str) -> dict:
    """Поиск через Tavily. Возвращает {'text': str, 'images': [str]}."""
    empty = {'text': '', 'images': []}
    if not TAVILY_KEY:
        return empty
    if SEARCH_SKIP.search(query):
        return empty
    try:
        resp = requests.post(
            'https://api.tavily.com/search',
            json={
                'api_key': TAVILY_KEY,
                'query': query,
                'search_depth': 'basic',
                'max_results': 4,
                'include_answer': True,
                'include_images': True,
                'include_image_descriptions': True,
            },
            timeout=8,
        )
        if resp.status_code != 200:
            return empty
        data = resp.json()

        # Текстовая часть для LLM
        parts = []
        if data.get('answer'):
            parts.append(f"Краткий ответ: {data['answer']}")
        for r in data.get('results', [])[:3]:
            title = r.get('title', '')
            content = r.get('content', '')[:300]
            url = r.get('url', '')
            parts.append(f"• {title}\n  {content}\n  Источник: {url}")

        # Картинки — извлекаем URL отдельно
        images = []
        for img in data.get('images', [])[:3]:
            if isinstance(img, dict):
                url = img.get('url', '')
            else:
                url = str(img)
            if url and url.startswith('http'):
                images.append(url)

        return {'text': '\n\n'.join(parts), 'images': images}
    except Exception as e:
        print(f"[search] error: {e}")
        return empty

OR_MODELS = [
    'openai/gpt-4o-mini',
    'mistralai/mistral-7b-instruct:free',
]

HF_ENDPOINTS = [
    {'url': 'https://router.huggingface.co/sambanova/v1/chat/completions', 'model': 'Meta-Llama-3.3-70B-Instruct'},
]


def call_llm(messages):
    """Вызывает LLM — сначала OpenRouter бесплатные модели, потом HuggingFace."""
    last_error = None
    openrouter_key = os.environ.get('OPENROUTER_API_KEY_2', '') or os.environ.get('OPENROUTER_API_KEY', '')

    if openrouter_key:
        headers = {
            'Authorization': f'Bearer {openrouter_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://mospotolki.ru',
        }
        for model in OR_MODELS:
            payload = {'model': model, 'messages': messages, 'max_tokens': 1800, 'temperature': 0.1}
            try:
                resp = requests.post('https://openrouter.ai/api/v1/chat/completions', json=payload, headers=headers, timeout=25)
                if resp.status_code == 200:
                    content = resp.json()['choices'][0]['message']['content']
                    if content:
                        return content
                last_error = f"OpenRouter {model}: {resp.status_code} {resp.text[:200]}"
            except Exception as e:
                last_error = f"OpenRouter {model}: {str(e)}"

    headers = {
        'Authorization': f'Bearer {HF_TOKEN}',
        'Content-Type': 'application/json',
    }

    for ep in HF_ENDPOINTS:
        payload = {
            'model': ep['model'],
            'messages': messages,
            'max_tokens': 1800,
            'temperature': 0.1,
        }
        try:
            resp = requests.post(ep['url'], json=payload, headers=headers, timeout=25)
            if resp.status_code == 200:
                data = resp.json()
                return data['choices'][0]['message']['content']
            last_error = f"{ep['url']}: {resp.status_code} {resp.text[:200]}"
        except Exception as e:
            last_error = f"{ep['url']}: {str(e)}"

    raise Exception(f'All endpoints failed. Last: {last_error}')


def handler(event, context):
    """Обрабатывает запросы к AI-чату MOSPOTOLKI."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': cors, 'body': json.dumps({'error': 'Method not allowed'})}

    body = json.loads(event.get('body', '{}'))
    messages = body.get('messages', [])

    if not messages:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'No messages provided'})}

    # Кэш: отвечаем мгновенно без вызова LLM
    last_user_text = ''
    for msg in reversed(messages):
        if msg.get('role') == 'user':
            last_user_text = msg.get('text', '')
            break

    cached = get_cached_answer(last_user_text)
    if cached:
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'answer': cached})}

    # Загружаем базу знаний из БД
    knowledge = get_knowledge(last_user_text)
    system_content = SYSTEM_PROMPT
    if knowledge:
        system_content += f"\n\n=== БАЗА ЗНАНИЙ О ТОВАРАХ И ЦЕНАХ ===\n{knowledge}"

    # Веб-поиск для актуальной информации
    search = web_search(last_user_text)
    if search['text']:
        system_content += f"\n\n=== АКТУАЛЬНАЯ ИНФОРМАЦИЯ ИЗ ИНТЕРНЕТА ===\n{search['text']}\nИспользуй эти данные для ответа, указывай источники если уместно."

    # Передаём только последние 6 сообщений — экономим токены
    openai_messages = [{'role': 'system', 'content': system_content}]
    for msg in messages[-6:]:
        openai_messages.append({
            'role': msg.get('role', 'user'),
            'content': msg.get('text', ''),
        })

    answer = call_llm(openai_messages)

    # Убираем фразы про "не могу показать фото"
    _no_photo = [
        r'[Кк] сожалению,? я не могу предоставить фотографи[ию][^.]*\.',
        r'[Кк] сожалению,? я не могу показать[^.]*\.',
        r'[Яя] не могу (показать|предоставить|отобразить|прикрепить)[^.]*изображени[ея][^.]*\.',
        r'[Яя] не имею возможности (показать|отображать)[^.]*\.',
        r'[Кк]ак (языковая|текстовая) модель[^.]*фото[^.]*\.',
        r'[Кк] сожалению,? у меня нет возможности[^.]*фото[^.]*\.',
        r'[Оо]днако вы можете найти примеры[^.]*на[^.]*\.',
        r'[Пп]росто введите в поиск[^.]*\.',
        r'[Нн]а таких платформах,? как[^.]*\.',
    ]
    for _p in _no_photo:
        answer = re.sub(_p, '', answer)
    answer = answer.strip()

    # Картинки из Tavily — только для запросов про тренды/вдохновение
    print(f"[img] query='{last_user_text[:60]}' tavily_images={len(search['images'])} visual={bool(SEARCH_VISUAL.search(last_user_text))} imagegen={bool(IMAGE_GEN.search(last_user_text))}")
    if search['images'] and SEARCH_VISUAL.search(last_user_text):
        img_block = '\n' + '\n'.join(f"![фото]({url})" for url in search['images'])
        answer = answer + img_block

    # Генерация дизайна через FLUX по запросу клиента
    if IMAGE_GEN.search(last_user_text):
        gen_url = generate_image(last_user_text)
        print(f"[flux] gen_url={gen_url}")
        if gen_url:
            answer = answer + f"\n\n![сгенерированный дизайн]({gen_url})"

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'answer': answer}),
    }