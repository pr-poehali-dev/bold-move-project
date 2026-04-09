"""AI-помощник MOSPOTOLKI — отвечает на вопросы о натяжных потолках и считает стоимость."""

import json
import os
import re
import requests

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
    r"(цен|стоит|стоимость|сколько|прайс|расценк)(?!.{0,30}\d+\s*(м|кв|квадрат))": "Цены от:\n• Матовый белый — от 399 ₽/м²\n• Цветной — от 900 ₽/м²\n• Тканевый — от 2200 ₽/м²\n\nДля точного расчёта назовите площадь комнаты.",
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
    """Если запрос содержит только площадь и тип полотна — считаем без LLM."""
    t = text.lower()
    # Ищем площадь
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:м²|м2|кв\.?\s*м|квадрат)', t)
    if not m:
        return None
    area = float(m.group(1).replace(',', '.'))
    if area < 1 or area > 500:
        return None

    # Определяем тип полотна (дефолт — Classic)
    canvas_key = 'classic'
    if re.search(r'(ткань|тканев|дескор)', t):
        canvas_key = 'ткань'
    elif re.search(r'цветн', t):
        canvas_key = 'цветной'
    elif re.search(r'(bauf|бауф|немецк|german)', t):
        canvas_key = 'bauf'
    elif re.search(r'(evolution|эволюц)', t):
        canvas_key = 'evolution'
    elif re.search(r'(premium|премиум)', t):
        canvas_key = 'premium'

    canvas_name, canvas_price = CANVAS_PRICES[canvas_key]
    perim = round(area * 1.3, 1)

    # Материалы
    canvas_total = round(area * canvas_price)
    is_pvh = canvas_key != 'ткань'
    raskroy = round(area * 100) if is_pvh else 0
    ogarp = round(area * 100) if is_pvh else 0
    profile = round(perim * 200)

    # Монтаж
    mount_canvas = round(area * (350 if is_pvh else 500))
    mount_profile = round(perim * 200)

    standard = canvas_total + raskroy + ogarp + profile + mount_canvas + mount_profile
    econom = round(standard * 0.77)
    premium_price = round(standard * 1.27)

    lines = [f"1. Полотно:"]
    lines.append(f"  {canvas_name} {area}м² × {canvas_price}₽ = {canvas_total}₽")
    if is_pvh:
        lines.append(f"  Раскрой {area}м² × 100₽ = {raskroy}₽")
        lines.append(f"  Огарпунивание {area}м² × 100₽ = {ogarp}₽")
    lines.append(f"\n2. Профиль:")
    lines.append(f"  Стеновой алюм {perim}пм × 200₽ = {profile}₽")
    lines.append(f"\n3. Услуги монтажа:")
    lines.append(f"  {'Монтаж ПВХ' if is_pvh else 'Монтаж ткани'} {area}м² × {350 if is_pvh else 500}₽ = {mount_canvas}₽")
    lines.append(f"  Монтаж профиля {perim}пм × 200₽ = {mount_profile}₽")
    lines.append(f"\nEconom:  {econom:,}₽".replace(',', ' '))
    lines.append(f"Standard: {standard:,}₽".replace(',', ' '))
    lines.append(f"Premium:  {premium_price:,}₽".replace(',', ' '))
    lines.append(f"\nЭто предварительный расчёт (без светильников,\nниш, спецпрофиля). Точную стоимость назовёт\nтехнолог на бесплатном замере.\nНа какой день вас записать?")

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

SYSTEM_PROMPT = """Ты сметчик MosPotolki (натяжные потолки, Мытищи, с 2009г). Отвечай по-русски. Тел:+7(977)606-89-01.

ЦЕНЫ (₽):
ПОЛОТНА/м²: MSD Classic 399,MSD Premium 460,MSD Evolution 490,BAUF 499,Цветной MSD 900,Ткань ДЕСКОР 2200,Раскрой ПВХ 100,Огарпун 100
ПРОФИЛЬ/пм: СтенПВХ 150,СтенАл 200,ПотАл 200,EuroKRAAB 550,Тен+свет 750,ПК-6 1300,FlexyFLY02 1450(дефолт)
НИШТ/пм: БП-40 850,Sigma 1400,SigmaLED 1650,Без перег 1700,С перег 1900,ПК-12 3600,ПК-15 3600,MAD40 5200,MAD60 5500,MAD80 5800
2УР/пм: ПП-75 500,Apply 1400
ЗАКЛАДН/шт: ∅90=350,∅100-300=450,∅300-600=600,накладн 500,квадр 950,нестанд 1500,вытяжка 500,крюк 500,планка 700,крест 1400
СВЕТ: GX53+лампа 400/шт,Лента QF 4000/5м,LentaMIX 7000/5м,БП100 3500,БП200 5000,БП400 7000
МОНТАЖ/пм или шт: ПВХ 350/м²,Ткань 500/м²,Проф 200,Тен/Пар 350,Закл 350,Разводка 700,Лента 350,БП 500,Керамогр 500

ПРАВИЛА:
- Периметр=1.3×площадь если не дан. Профиль≥периметра
- ПВХ: +Раскрой+Огарпун+Монтаж ПВХ обязательно
- Каждой позиции — монтаж. Монтаж — отдельный блок
- Лента кратна 5м (6м→10м). Теневой/парящий вычесть из стандартного
- Парящий без уточнения = FlexyFLY02. Световые линии = профиль
- 1 строка ≤44 символов. Не показывай формулы расчёта

ФОРМАТ:
1.Полотно: 2.Профиль: 3.Освещение: 4.Ниши: 5.Услуги монтажа: — блоками
Итог: Econom X₽ / Standard X₽ / Premium X₽ (−23%/0/+27%, без указания %)
Финал: "Предварительный расчёт. Точную стоимость назовёт технолог на бесплатном замере. На какой день вас записать?"
"""

HF_TOKEN = os.environ.get('HF_TOKEN', '')

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
            payload = {'model': model, 'messages': messages, 'max_tokens': 800, 'temperature': 0.3}
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
            'max_tokens': 800,
            'temperature': 0.3,
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

    # Передаём только последние 6 сообщений — экономим токены
    openai_messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    for msg in messages[-6:]:
        openai_messages.append({
            'role': msg.get('role', 'user'),
            'content': msg.get('text', ''),
        })

    answer = call_llm(openai_messages)

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'answer': answer}),
    }