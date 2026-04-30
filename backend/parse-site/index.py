import json
import os
import re
import urllib.request
import urllib.parse
import psycopg2

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
        "model": "meta-llama/llama-3.1-8b-instruct:free",
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
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[parse-site] OpenRouter HTTP {e.code}: {body[:200]}")
        raise ValueError(f"AI ошибка: {body[:100]}")
    print(f"[parse-site] OpenRouter OK")
    return data["choices"][0]["message"]["content"].strip()

def extract_brand_info(site_url: str, page_text: str) -> dict:
    """Просит AI вытащить бренд-данные из текста страницы."""
    prompt = f"""Ты парсишь сайт компании по натяжным потолкам (или смежный бизнес).
Сайт: {site_url}

Текст со страницы:
---
{page_text}
---

Извлеки следующие данные в формате JSON. Если данных нет — ставь null.

{{
  "company_name": "Официальное название компании (ООО, ИП, или торговое название)",
  "bot_name": "Имя для бота/менеджера (женское имя если есть, иначе null)",
  "bot_greeting": "Приветствие бота (1-2 предложения от имени компании)",
  "support_phone": "Телефон в формате +7 (XXX) XXX-XX-XX",
  "support_email": "Email компании",
  "telegram": "Telegram username без @ или полная ссылка",
  "website": "Домен сайта без https:// (например: company.ru)",
  "working_hours": "Часы работы (например: Ежедневно 9:00-21:00)",
  "pdf_footer_address": "Полный адрес компании (город, улица, дом)",
  "brand_color": "Основной цвет бренда в HEX (если заметен, иначе null)"
}}

Верни ТОЛЬКО JSON без markdown-обёртки.
"""
    raw = ask_openai(prompt)
    # Вырезаем JSON из ответа
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"AI не вернул JSON: {raw[:200]}")
    return json.loads(match.group())

def save_brand_to_db(company_id: int, brand: dict):
    """Сохраняет бренд-данные в таблицу users."""
    allowed = [
        "company_name", "bot_name", "bot_greeting", "support_phone",
        "support_email", "telegram", "website", "working_hours",
        "pdf_footer_address", "brand_color",
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