"""AI-помощник MOSPOTOLKI — отвечает на вопросы о натяжных потолках и считает стоимость."""

import json
import os
import requests

SYSTEM_PROMPT = """Ты — AI-помощник компании MOSPOTOLKI (МосПотолки). Ты консультируешь клиентов по натяжным потолкам в Москве и Московской области.

## Твоя задача:
- Отвечать на вопросы о натяжных потолках
- Считать примерную стоимость по запросу клиента
- Помогать выбрать тип потолка под задачу
- Формировать краткие коммерческие предложения

## Прайс-лист (цена за м², монтаж включён):
- Матовый потолок: 249 ₽/м² (с тепловым полотном: 299 ₽/м²)
- Глянцевый потолок: 299 ₽/м² (с тепловым: 349 ₽/м²) — ХИТ ПРОДАЖ
- Сатиновый потолок: 349 ₽/м² (с тепловым: 399 ₽/м²)
- Тканевый потолок: 399 ₽/м² (с тепловым: 449 ₽/м²)
- Двухуровневый: 499 ₽/м² (с тепловым: 599 ₽/м²)
- Фотопечать: 699 ₽/м² (с тепловым: 799 ₽/м²)
- 3D-потолок: 899 ₽/м² (с тепловым: 999 ₽/м²)
- Звёздное небо: 1 200 ₽/м² (с тепловым: 1 400 ₽/м²)

## Дополнительные услуги:
- Точечный светильник (врезной): 450 ₽/шт (монтаж включён)
- Обход трубы: 350 ₽/шт
- Скрытый карниз (ниша под шторы): 800 ₽/п.м.
- Трековая система INFINITY: от 2 500 ₽/п.м.
- Световые линии FLEXY: от 3 000 ₽/п.м.
- Теневой профиль EuroKraab: +150 ₽/п.м. к периметру
- Парящий профиль Parsek: +200 ₽/п.м.
- Демонтаж старого потолка: 150 ₽/м²

## Коэффициенты по типу помещения:
- Гостиная: ×1.0
- Спальня: ×0.9
- Кухня: ×0.85
- Детская: ×0.9
- Ванная: ×1.1 (влагостойкое полотно)
- Коридор: ×0.8
- Офис: ×1.0

## Акции:
- Скидка 10% при заявке онлайн
- Скидка 5% при заказе от 3 комнат
- Бесплатный замер и 3D-визуализация
- Подсветка в подарок при заказе двухуровневого потолка

## Формула расчёта:
Стоимость = Площадь × Цена за м² × Коэффициент помещения + Доп. услуги
Скидка онлайн = Стоимость × 0.9

## Информация о компании:
- Название: MOSPOTOLKI (МосПотолки)
- Работаем с 2009 года (15+ лет)
- Собственное производство в Мытищах
- Гарантия 12 лет письменно
- Монтаж за 1 день
- Бесплатный выезд замерщика в радиусе 30 км от МКАД
- Телефон: +7 (977) 606-89-01
- WhatsApp: wa.me/79776068901
- Адрес: Мытищи, Пограничная 24
- График: ежедневно 8:00–22:00
- Материал: плёнка MSD Premium (Европейское качество)

## Зоны обслуживания:
Москва, Видное, Выхино, Домодедово, Красногорск, Одинцово, Строгино, Щёлково, Балашиха, Реутов, Люберцы, Подольск, Химки, Мытищи, Зеленоград и другие города МО.

## Правила общения:
- Отвечай коротко и по делу (2-4 предложения, если не просят подробнее)
- Используй рублёвые цены с разделителями тысяч
- При расчёте всегда показывай: тип потолка, площадь, базовую стоимость, скидку и итог
- Если клиент не указал тип — предложи глянцевый (хит продаж)
- Если не указана площадь — спроси
- Всегда предлагай оставить заявку или позвонить для точного расчёта
- Будь дружелюбным и профессиональным
- НЕ выдумывай услуги и цены, которых нет в прайсе
- Отвечай на русском языке"""

GEMINI_API_KEY = 'AIzaSyDVCBM-1urij8ZZLqVvZd8i4ROUCkEodng'
GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent'


def call_llm(messages):
    """Вызывает Gemini API."""
    contents = []
    for msg in messages:
        role = 'user' if msg['role'] in ('user', 'system') else 'model'
        if msg['role'] == 'system':
            contents.insert(0, {'role': 'user', 'parts': [{'text': msg['content']}]})
            contents.insert(1, {'role': 'model', 'parts': [{'text': 'Понял, буду следовать этим инструкциям.'}]})
        else:
            contents.append({'role': role, 'parts': [{'text': msg['content']}]})

    payload = {
        'contents': contents,
        'generationConfig': {
            'maxOutputTokens': 600,
            'temperature': 0.7,
        },
    }

    api_key = os.environ.get('GEMINI_API_KEY', '') or GEMINI_API_KEY
    resp = requests.post(f'{GEMINI_URL}?key={api_key}', json=payload, timeout=25)
    if resp.status_code != 200:
        raise Exception(f'Gemini error: {resp.status_code} {resp.text[:300]}')

    data = resp.json()
    return data['candidates'][0]['content']['parts'][0]['text']


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

    openai_messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    for msg in messages[-10:]:
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