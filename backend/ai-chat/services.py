"""External service helpers: image generation, web search, LLM calls. v2."""

import os
import re
import requests

HF_TOKEN = os.environ.get('HF_TOKEN', '')
TAVILY_KEY = os.environ.get('TAVILY_API_KEY', '')
AWS_KEY = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET = os.environ.get('AWS_SECRET_ACCESS_KEY', '')

# Запросы, при которых поиск не нужен (смета, базовые вопросы)
SEARCH_SKIP = re.compile(
    r'(привет|здравствуй|спасибо|замер|гарантия|адрес|телефон|контакт|'
    r'\d+\s*м[²2]|квадрат|площадь|смета|рассчитай|посчитай|сколько стоит|'
    r'люстр|светильник|профил|полотно|закладн|монтаж|потолок|ниш|карниз|штор)',
    re.IGNORECASE
)

# Запросы где нужны картинки из Tavily (реальные фото товара/дизайна)
SEARCH_VISUAL = re.compile(
    r'(тренд|модн|популярн|вдохновени|идеи|примеры|стил|интерьер|фото|какие бывают|'
    r'как выглядит|покажи|что такое|как смотрится|хочу посмотреть на|вид профил)',
    re.IGNORECASE
)

# Запросы на генерацию изображения через FLUX
IMAGE_GEN = re.compile(
    r'(нарисуй|сгенерируй|визуализ|покажи как (будет|выглядит)|создай изображен|'
    r'сделай дизайн|придумай дизайн|как (будет )?выглядеть|покажи дизайн|'
    r'хочу (увидеть|посмотреть)|пример дизайна|покажи.*профил|покажи.*потолок|'
    r'как выглядит|как он выглядит|что из себя представляет)',
    re.IGNORECASE
)

OR_MODELS = [
    'openai/gpt-4o-mini',
]

HF_ENDPOINTS = [
    {'url': 'https://router.huggingface.co/sambanova/v1/chat/completions', 'model': 'Meta-Llama-3.3-70B-Instruct'},
]


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


def search_price(item_name: str) -> dict:
    """Ищет цену товара — сначала на rum-opt.ru, потом по всему интернету.
    Возвращает {'text': str, 'price_hint': str} без упоминания источника.
    """
    empty = {'text': '', 'price_hint': ''}
    if not TAVILY_KEY:
        return empty

    SPAM_DOMAINS = ('passport', 'document', 'госуслуг', 'avito.ru',
                    'instagram', 'facebook', 'vk.com', 'youtube', 'tiktok')

    def _do_search(query: str, domains: list | None = None) -> list:
        payload = {
            'api_key': TAVILY_KEY,
            'query': query,
            'search_depth': 'basic',
            'max_results': 5,
            'include_answer': True,
        }
        if domains:
            payload['include_domains'] = domains
        try:
            resp = requests.post('https://api.tavily.com/search', json=payload, timeout=15)
            if resp.status_code != 200:
                return []
            data = resp.json()
            parts = []
            if data.get('answer'):
                parts.append(data['answer'])
            for r in data.get('results', [])[:3]:
                url = r.get('url', '')
                if any(s in url.lower() for s in SPAM_DOMAINS):
                    continue
                parts.append(r.get('content', '')[:400])
            return parts
        except Exception as e:
            print(f"[price_search] error: {e}")
            return []

    # Сначала ищем на rum-opt.ru
    parts = _do_search(f"{item_name} цена", ['rum-opt.ru'])
    if not parts:
        # Fallback — любые сайты
        parts = _do_search(f"{item_name} цена купить рублей")

    text = '\n'.join(parts)
    return {'text': text, 'price_hint': text}


def web_search(query: str) -> dict:
    """Поиск через Tavily. Возвращает {'text': str, 'images': [str]}."""
    empty = {'text': '', 'images': []}
    if not TAVILY_KEY:
        return empty
    if SEARCH_SKIP.search(query):
        return empty

    # Обогащаем запрос чтобы Tavily искал именно про натяжные потолки
    search_query = f"натяжной потолок {query} фото"

    # Домены которых стоит избегать (не про потолки)
    SPAM_DOMAINS = ('passport', 'document', 'госуслуг', 'visa', 'мвд',
                    'avito.ru', 'ozon.ru', 'wildberries', 'instagram',
                    'facebook', 'vk.com', 'youtube', 'tiktok')

    try:
        resp = requests.post(
            'https://api.tavily.com/search',
            json={
                'api_key': TAVILY_KEY,
                'query': search_query,
                'search_depth': 'basic',
                'max_results': 5,
                'include_answer': True,
                'include_images': True,
                'include_image_descriptions': True,
            },
            timeout=15,
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
            parts.append(f"• {title}\n  {content}")

        # Картинки — извлекаем URL, фильтруем только явный спам по URL
        images = []
        for img in data.get('images', []):
            if isinstance(img, dict):
                img_url = img.get('url') or ''
            else:
                img_url = str(img)
            if not img_url or not img_url.startswith('http'):
                continue
            url_lower = img_url.lower()
            if any(s in url_lower for s in SPAM_DOMAINS):
                continue
            images.append(img_url)
            if len(images) >= 3:
                break

        return {'text': '\n\n'.join(parts), 'images': images}
    except Exception as e:
        print(f"[search] error: {e}")
        return empty


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
            payload = {'model': model, 'messages': messages, 'max_tokens': 3000, 'temperature': 0}
            try:
                resp = requests.post('https://openrouter.ai/api/v1/chat/completions', json=payload, headers=headers, timeout=55)
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
            'temperature': 0,
        }
        try:
            resp = requests.post(ep['url'], json=payload, headers=headers, timeout=55)
            if resp.status_code == 200:
                data = resp.json()
                return data['choices'][0]['message']['content']
            last_error = f"{ep['url']}: {resp.status_code} {resp.text[:200]}"
        except Exception as e:
            last_error = f"{ep['url']}: {str(e)}"

    raise Exception(f'All endpoints failed. Last: {last_error}')