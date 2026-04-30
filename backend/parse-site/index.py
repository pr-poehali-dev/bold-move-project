import json
import os
import re
import uuid
import urllib.request
import urllib.parse
import urllib.error
import psycopg2
import boto3

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}

def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg}, ensure_ascii=False)}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def fetch_brand_color(url: str) -> str | None:
    """Загружает HTML страницы напрямую и извлекает доминирующий цвет из CSS."""
    if not url.startswith("http"):
        url = "https://" + url
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"[parse-site] color fetch failed: {e}")
        return None

    # Ищем inline-стили и style-блоки
    css_chunks = []
    # <style> блоки
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", html, re.DOTALL | re.IGNORECASE):
        css_chunks.append(m.group(1))
    # inline style=""
    for m in re.finditer(r'style="([^"]*)"', html, re.IGNORECASE):
        css_chunks.append(m.group(1))
    # Tailwind / Bootstrap классы bg-[#xxx]
    for m in re.finditer(r'bg-\[#([0-9a-fA-F]{3,6})\]', html):
        return f"#{m.group(1)}"

    css_text = "\n".join(css_chunks)

    # Ищем цвета в CSS: background, background-color, color для кнопок/primary
    # Приоритет: btn, button, primary, accent, brand, cta
    priority_pattern = re.compile(
        r'(?:\.btn|\.button|\.cta|primary|accent|brand|header|hero)[^{]*\{[^}]*'
        r'(?:background(?:-color)?|color)\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))',
        re.IGNORECASE | re.DOTALL
    )
    for m in priority_pattern.finditer(css_text):
        color = m.group(1).strip()
        if color.startswith("#") and len(color) in (4, 7):
            # Пропускаем белый, чёрный, серые
            hex_val = color.lstrip("#").lower()
            if hex_val not in ("fff", "ffffff", "000", "000000", "333", "333333", "666", "666666"):
                print(f"[parse-site] found brand color: {color}")
                return color

    # Fallback: все HEX-цвета, берём самый частый не-нейтральный
    all_colors = re.findall(r'#([0-9a-fA-F]{6})', css_text)
    neutral = {"ffffff", "000000", "333333", "666666", "999999", "cccccc", "f5f5f5",
               "eeeeee", "e5e5e5", "dddddd", "f0f0f0", "fafafa", "1a1a1a", "2d2d2d"}
    freq: dict = {}
    for c in all_colors:
        lc = c.lower()
        if lc not in neutral:
            freq[lc] = freq.get(lc, 0) + 1
    if freq:
        best = max(freq, key=lambda k: freq[k])
        print(f"[parse-site] fallback brand color: #{best}")
        return f"#{best}"

    return None


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

def upload_image_to_s3(image_bytes: bytes, ext: str, prefix: str) -> str:
    """Загружает картинку в S3 и возвращает CDN URL."""
    key = f"brand/{prefix}_{uuid.uuid4().hex[:8]}.{ext}"
    content_type = "image/png" if ext == "png" else "image/jpeg" if ext in ("jpg", "jpeg") else "image/svg+xml" if ext == "svg" else "image/x-icon"
    s3 = get_s3()
    s3.put_object(Bucket="files", Key=key, Body=image_bytes, ContentType=content_type)
    cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    print(f"[parse-site] uploaded to CDN: {cdn}")
    return cdn

def fetch_image_bytes(url: str) -> tuple[bytes, str] | None:
    """Загружает изображение по URL, возвращает (bytes, ext) или None."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = resp.read()
            ct = resp.headers.get("Content-Type", "")
            if "svg" in ct:    ext = "svg"
            elif "png" in ct:  ext = "png"
            elif "ico" in ct:  ext = "ico"
            else:              ext = "jpg"
            return data, ext
    except Exception as e:
        print(f"[parse-site] image fetch failed {url}: {e}")
        return None

def find_logo_url(site_url: str) -> tuple[str | None, str | None]:
    """
    Парсит HTML страницы, ищет логотип и фавикон.
    Возвращает (logo_url, favicon_url) — абсолютные URL на изображения.
    """
    if not site_url.startswith("http"):
        site_url = "https://" + site_url
    base = "/".join(site_url.rstrip("/").split("/")[:3])  # https://domain.ru

    try:
        req = urllib.request.Request(site_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"[parse-site] find_logo html fetch failed: {e}")
        return None, None

    def abs_url(src: str) -> str:
        if src.startswith("http"):   return src
        if src.startswith("//"):     return "https:" + src
        if src.startswith("/"):      return base + src
        return base + "/" + src

    logo_url = None
    # Ищем логотип: <img> с alt/class/id содержащим logo
    for m in re.finditer(r'<img[^>]+>', html, re.IGNORECASE):
        tag = m.group()
        if re.search(r'(?:logo|brand|header-img)', tag, re.IGNORECASE):
            src = re.search(r'src=["\']([^"\']+)["\']', tag)
            if src:
                u = src.group(1)
                # Пропускаем data: и svg-data
                if not u.startswith("data:"):
                    logo_url = abs_url(u)
                    break

    # Ищем фавикон
    favicon_url = None
    for m in re.finditer(r'<link[^>]+rel=["\'][^"\']*icon[^"\']*["\'][^>]*>', html, re.IGNORECASE):
        tag = m.group()
        href = re.search(r'href=["\']([^"\']+)["\']', tag)
        if href:
            favicon_url = abs_url(href.group(1))
            break
    if not favicon_url:
        favicon_url = base + "/favicon.ico"

    print(f"[parse-site] logo={logo_url} favicon={favicon_url}")
    return logo_url, favicon_url


def tavily_post(endpoint: str, payload: dict, api_key: str, timeout: int = 20) -> dict:
    """Выполняет POST-запрос к Tavily API, читает тело даже при ошибке."""
    import urllib.error
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[parse-site] Tavily {endpoint} HTTP {e.code}: {body[:200]}")
        raise ValueError(f"Tavily вернул {e.code}: {body[:100]}")
    except Exception as e:
        print(f"[parse-site] Tavily {endpoint} error: {e}")
        raise ValueError(str(e))


def fetch_page_text(url: str) -> str:
    """Получает текст о компании: Extract → Search fallback."""
    if not url.startswith("http"):
        url = "https://" + url

    domain = re.sub(r"https?://", "", url).split("/")[0]
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        raise ValueError("TAVILY_API_KEY не настроен")

    # 1. Пробуем Extract
    try:
        data = tavily_post("https://api.tavily.com/extract", {"urls": [url]}, api_key, timeout=15)
        results = data.get("results", [])
        if results:
            raw = results[0].get("raw_content", "") or results[0].get("content", "")
            if raw and len(raw.strip()) > 200:
                print(f"[parse-site] Extract OK: {len(raw)} chars")
                return re.sub(r"\s{3,}", "\n", raw).strip()[:6000]
    except Exception as ex:
        print(f"[parse-site] Extract failed, trying Search: {ex}")

    # 2. Fallback: Tavily Search (без include_domains — он блокирует результаты)
    query = f'site:{domain} телефон адрес контакты часы работы название компании'
    data = tavily_post("https://api.tavily.com/search", {
        "query": query,
        "search_depth": "basic",
        "max_results": 5,
        "include_raw_content": False,
    }, api_key, timeout=20)

    results = data.get("results", [])
    print(f"[parse-site] Search results: {len(results)}")
    if not results:
        raise ValueError("Не удалось найти информацию о сайте. Попробуй указать домен без https://")

    parts = [r.get("content", "") for r in results if r.get("content")]
    combined = "\n\n".join(parts)
    if not combined.strip():
        raise ValueError("Поиск не вернул текст о компании.")

    return re.sub(r"\s{3,}", "\n", combined).strip()[:6000]

def ask_openai(prompt: str) -> str:
    """Отправляет запрос к OpenRouter (meta-llama/llama-3.1-8b-instruct:free)."""
    import urllib.error
    api_key = os.environ.get("OPENROUTER_API_KEY_2", "")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY_2 не настроен")
    payload = json.dumps({
        "model": "openrouter/owl-alpha",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 800,
    }).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://poehali.dev",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[parse-site] OpenRouter HTTP {e.code}: {body[:200]}")
        raise ValueError(f"AI ошибка: {body[:100]}")
    print(f"[parse-site] OpenRouter OK")
    return data["choices"][0]["message"]["content"].strip()

def extract_brand_info(site_url: str, page_text: str) -> dict:
    """Просит AI вытащить бренд-данные из текста страницы."""
    domain = re.sub(r"https?://", "", site_url).split("/")[0]
    prompt = f"""Ты парсишь сайт компании (натяжные потолки или смежный бизнес).
Сайт: {site_url}

Текст со страницы:
---
{page_text}
---

Извлеки данные в формате JSON. Правила:
- Если данных нет в тексте — ставь null
- company_name: торговое название (без ООО/ИП если есть короткое брендовое имя)
- bot_name: возьми ПЕРВОЕ слово из company_name как имя бота (например "РумЭксперт" → "РумЭксперт"). Не придумывай человеческие имена.
- bot_greeting: "Здравствуйте! Я помощник компании [company_name]. Помогу рассчитать стоимость и ответить на вопросы." — подставь реальное название
- support_phone: телефон в формате +7 (XXX) XXX-XX-XX
- support_email: email компании (ищи на странице контактов, в футере)
- telegram: telegram username или ссылка t.me/... (ищи в контактах, соцсетях)
- website: домен без https:// (например: {domain})
- working_hours: часы работы (например: Ежедневно 9:00-21:00)
- pdf_footer_address: полный адрес (город, улица, дом) — ищи в контактах и футере
- brand_color: ГЛАВНЫЙ цвет бренда в HEX — посмотри на кнопки, заголовки, логотип. Например: "#e63946" для красного, "#1d7afc" для синего. Не ставь null если видишь явный фирменный цвет.

{{
  "company_name": "...",
  "bot_name": "...",
  "bot_greeting": "...",
  "support_phone": "...",
  "support_email": "...",
  "telegram": "...",
  "website": "...",
  "working_hours": "...",
  "pdf_footer_address": "...",
  "brand_color": "..."
}}

Верни ТОЛЬКО JSON без markdown-обёртки и пояснений.
"""
    raw = ask_openai(prompt)
    # Вырезаем JSON из ответа
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"AI не вернул JSON: {raw[:200]}")
    result = json.loads(match.group())

    # Пост-обработка: если bot_name пустой — берём первое слово company_name
    if not result.get("bot_name") and result.get("company_name"):
        result["bot_name"] = result["company_name"].split()[0]

    # Если bot_greeting пустой — генерируем из company_name
    if not result.get("bot_greeting") and result.get("company_name"):
        name = result["company_name"]
        result["bot_greeting"] = f"Здравствуйте! Я помощник компании «{name}». Помогу рассчитать стоимость и ответить на вопросы."

    return result

def extract_with_regex(text: str, field: str) -> str | None:
    """Быстрое извлечение через regex — без AI, мгновенно."""
    if field == "support_email":
        m = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}', text)
        return m.group() if m else None
    if field == "telegram":
        m = re.search(r'(?:t\.me/|@)([a-zA-Z0-9_]{4,})', text)
        if m:
            slug = m.group(1)
            return f"https://t.me/{slug}" if not text[m.start():m.start()+1] == "@" else f"@{slug}"
        return None
    if field == "pdf_footer_address":
        # Ищем паттерн: г. Город, ул. ... или просто город + улица
        m = re.search(
            r'(?:г\.?\s*[А-ЯЁ][а-яё\-]+[\s,]+(?:ул\.?|пр\.?|пр-т|переулок|бул\.?|шоссе)[\s.]*[^,\n]{3,40}(?:,\s*д\.?\s*\d[\w/]*)?)',
            text, re.IGNORECASE
        )
        if m:
            return m.group().strip()
        # Fallback: просто город
        m = re.search(r'г\.\s*[А-ЯЁ][а-яё\-]+', text)
        return m.group().strip() if m else None
    return None


def search_missing_fields(brand: dict, site_url: str) -> dict:
    """Ищет недостающие поля через Tavily Search + regex (без AI — быстро)."""
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        return brand

    domain = re.sub(r"https?://", "", site_url).split("/")[0]
    company = brand.get("company_name") or domain

    missing = {
        "support_email":      f'{domain} email контакты',
        "telegram":           f'{company} telegram t.me',
        "pdf_footer_address": f'{company} {domain} адрес офис',
    }

    to_search = {k: q for k, q in missing.items() if not brand.get(k)}
    if not to_search:
        return brand

    print(f"[parse-site] searching missing: {list(to_search.keys())}")

    # Один общий поиск по всем полям сразу
    combined_query = " ".join(list(to_search.values())[:2])  # берём первые два
    try:
        data = tavily_post("https://api.tavily.com/search", {
            "query": combined_query,
            "search_depth": "basic",
            "max_results": 3,
            "include_raw_content": False,
        }, api_key, timeout=8)
        snippets = " ".join(r.get("content", "") for r in data.get("results", []))
    except Exception as e:
        print(f"[parse-site] search error: {e}")
        return brand

    if not snippets:
        return brand

    for field in to_search:
        try:
            result = extract_with_regex(snippets, field)
            if result:
                brand[field] = result
                print(f"[parse-site] found {field}: {result}")
        except Exception as e:
            print(f"[parse-site] regex {field} error: {e}")

    return brand


def save_brand_to_db(company_id: int, brand: dict):
    """Сохраняет бренд-данные в таблицу users."""
    allowed = [
        "company_name", "bot_name", "bot_greeting", "support_phone",
        "support_email", "telegram", "website", "working_hours",
        "pdf_footer_address", "brand_color", "brand_logo_url", "bot_avatar_url",
    ]
    sets, vals = [], []
    for key in allowed:
        val = brand.get(key)
        if val is not None:
            sets.append(f"{key} = %s")
            vals.append(str(val).strip() if val else None)
    if not sets:
        return
    vals.append(company_id)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(sets)} WHERE id = %s", vals)
    conn.commit()
    cur.close()
    conn.close()

def build_report(brand: dict) -> dict:
    """Строит отчёт: что заполнилось, что нет."""
    labels = {
        "company_name":       "Название компании",
        "bot_name":           "Имя бота",
        "bot_greeting":       "Приветствие бота",
        "brand_logo_url":     "Логотип",
        "bot_avatar_url":     "Фото бота",
        "support_phone":      "Телефон",
        "support_email":      "Email",
        "telegram":           "Telegram",
        "website":            "Сайт",
        "working_hours":      "Часы работы",
        "pdf_footer_address": "Адрес",
        "brand_color":        "Цвет бренда",
    }
    filled, missing = [], []
    for key, label in labels.items():
        val = brand.get(key)
        if val and str(val).strip():
            filled.append({"field": key, "label": label, "value": str(val).strip()})
        else:
            missing.append({"field": key, "label": label})
    return {"filled": filled, "missing": missing}

def handler(event: dict, context) -> dict:
    """Парсит сайт клиента через AI и заполняет демо-компанию данными бренда."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") != "POST":
        return err("Только POST", 405)

    # Проверяем токен мастера
    headers = event.get("headers") or {}
    raw_token = (headers.get("X-Authorization") or "").replace("Bearer ", "").strip()
    if not raw_token:
        return err("Требуется авторизация", 401)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT u.email FROM {SCHEMA}.user_sessions s
        JOIN {SCHEMA}.users u ON u.id = s.user_id
        WHERE s.token=%s AND s.expires_at > NOW()
    """, (raw_token,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row or row[0] != "19.jeka.94@gmail.com":
        return err("Доступ только для мастера", 403)

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    site_url = (body.get("url") or "").strip()
    company_id = int(body.get("company_id") or 14)

    if not site_url:
        return err("url обязателен")

    try:
        page_text = fetch_page_text(site_url)
    except ValueError as e:
        return err(str(e))

    try:
        brand = extract_brand_info(site_url, page_text)
    except Exception as e:
        return err(f"AI ошибка: {e}")

    # Если AI не нашёл цвет — пробуем вытащить из CSS
    if not brand.get("brand_color"):
        css_color = fetch_brand_color(site_url)
        if css_color:
            brand["brand_color"] = css_color
            print(f"[parse-site] brand_color from CSS: {css_color}")

    # Доищем пустые поля через Tavily Search
    try:
        brand = search_missing_fields(brand, site_url)
    except Exception as e:
        print(f"[parse-site] search_missing_fields error: {e}")

    # Парсим логотип и фавикон → загружаем в S3
    logo_src, favicon_src = find_logo_url(site_url)

    if logo_src and not brand.get("brand_logo_url"):
        result = fetch_image_bytes(logo_src)
        if result:
            img_bytes, ext = result
            if len(img_bytes) > 500:  # не пустой файл
                try:
                    brand["brand_logo_url"] = upload_image_to_s3(img_bytes, ext, "logo")
                except Exception as e:
                    print(f"[parse-site] logo upload failed: {e}")

    if not brand.get("bot_avatar_url"):
        # Аватар бота = логотип (если загрузили) или фавикон
        if brand.get("brand_logo_url"):
            brand["bot_avatar_url"] = brand["brand_logo_url"]
        elif favicon_src:
            result = fetch_image_bytes(favicon_src)
            if result:
                img_bytes, ext = result
                if len(img_bytes) > 100:
                    try:
                        brand["bot_avatar_url"] = upload_image_to_s3(img_bytes, ext, "avatar")
                    except Exception as e:
                        print(f"[parse-site] avatar upload failed: {e}")

    try:
        save_brand_to_db(company_id, brand)
    except Exception as e:
        return err(f"Ошибка сохранения: {e}")

    report = build_report(brand)
    return ok({
        "brand": brand,
        "report": report,
        "company_id": company_id,
    })