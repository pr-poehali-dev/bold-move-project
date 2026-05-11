"""
News API — CRUD для новостей экосистемы AI-potolki.
GET  /             — список опубликованных (публично)
GET  /?all=1       — все включая черновики (только мастер)
GET  /?id=N        — одна новость
POST /             — создать (мастер)
POST /?action=ai_draft — AI-черновик из событий системы (мастер)
PUT  /?id=N        — обновить (мастер)
DELETE /?id=N      — удалить (мастер)
"""

import os
import json
import re
import requests
import psycopg2
from datetime import datetime, timezone

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")
DSN    = os.environ.get("DATABASE_URL")

CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
    "Content-Type": "application/json",
}

def get_conn():
    return psycopg2.connect(DSN)

def is_master(event: dict) -> bool:
    headers = event.get("headers") or {}
    token   = headers.get("X-Auth-Token") or headers.get("x-auth-token") or ""
    if not token:
        return False
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute(f"SELECT is_master FROM {SCHEMA}.users WHERE auth_token=%s LIMIT 1", (token,))
        row = cur.fetchone()
        conn.close()
        return bool(row and row[0])
    except Exception:
        return False

def handler(event: dict, context) -> dict:
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    params = event.get("queryStringParameters") or {}
    body   = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur  = conn.cursor()

    try:
        # ── GET ──────────────────────────────────────────────────────────────
        if method == "GET":
            news_id = params.get("id")
            show_all = params.get("all") == "1" and is_master(event)

            if news_id:
                cur.execute(
                    f"SELECT id, title, content, cover_url, published, created_at, updated_at "
                    f"FROM {SCHEMA}.news WHERE id=%s",
                    (int(news_id),)
                )
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}
                item = _row_to_dict(row)
                return {"statusCode": 200, "headers": CORS, "body": json.dumps(item)}

            if show_all:
                cur.execute(f"SELECT id, title, content, cover_url, published, created_at, updated_at FROM {SCHEMA}.news ORDER BY created_at DESC")
            else:
                cur.execute(f"SELECT id, title, content, cover_url, published, created_at, updated_at FROM {SCHEMA}.news WHERE published=true ORDER BY created_at DESC")

            rows  = cur.fetchall()
            items = [_row_to_dict(r) for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"items": items})}

        # ── POST /?action=ai_draft — AI-черновик из событий ────────────────────
        if method == "POST" and params.get("action") == "ai_draft":
            if not is_master(event):
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}

            draft = _build_ai_draft(cur)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(draft)}

        # ── POST — создать ───────────────────────────────────────────────────
        if method == "POST":
            if not is_master(event):
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}

            title     = body.get("title", "")
            content   = body.get("content", "")
            cover_url = body.get("cover_url")
            published = bool(body.get("published", False))

            cur.execute(
                f"INSERT INTO {SCHEMA}.news (title, content, cover_url, published) VALUES (%s,%s,%s,%s) RETURNING id",
                (title, content, cover_url, published)
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"id": new_id, "ok": True})}

        # ── PUT — обновить ───────────────────────────────────────────────────
        if method == "PUT":
            if not is_master(event):
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}

            news_id = params.get("id")
            if not news_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "id required"})}

            fields, vals = [], []
            for key in ("title", "content", "cover_url", "published"):
                if key in body:
                    fields.append(f"{key}=%s")
                    vals.append(body[key])
            if not fields:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "nothing to update"})}

            fields.append("updated_at=now()")
            vals.append(int(news_id))
            cur.execute(f"UPDATE {SCHEMA}.news SET {', '.join(fields)} WHERE id=%s", vals)
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # ── DELETE ───────────────────────────────────────────────────────────
        if method == "DELETE":
            if not is_master(event):
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}

            news_id = params.get("id")
            if not news_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "id required"})}

            cur.execute(f"DELETE FROM {SCHEMA}.news WHERE id=%s", (int(news_id),))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "method not allowed"})}

    finally:
        conn.close()


def _row_to_dict(row) -> dict:
    return {
        "id":         row[0],
        "title":      row[1],
        "content":    row[2],
        "cover_url":  row[3],
        "published":  row[4],
        "created_at": row[5].isoformat() if row[5] else None,
        "updated_at": row[6].isoformat() if row[6] else None,
    }


def _build_ai_draft(cur) -> dict:
    """Собирает события из БД за последние 24 часа и генерирует черновик новости через OpenAI."""

    # ── Собираем статистику за 24 часа ──────────────────────────────────────
    cur.execute(f"""
        SELECT
          (SELECT COUNT(*) FROM {SCHEMA}.live_chats WHERE created_at > now() - interval '24 hours') AS new_chats,
          (SELECT COUNT(*) FROM {SCHEMA}.saved_estimates WHERE created_at > now() - interval '24 hours') AS new_estimates,
          (SELECT COUNT(*) FROM {SCHEMA}.live_chats WHERE status='new') AS open_chats,
          (SELECT COUNT(*) FROM {SCHEMA}.live_chats) AS total_chats,
          (SELECT COUNT(*) FROM {SCHEMA}.saved_estimates) AS total_estimates,
          (SELECT COUNT(*) FROM {SCHEMA}.ai_prices WHERE updated_at > now() - interval '24 hours') AS updated_prices
    """)
    row = cur.fetchone()
    stats = {
        "new_chats": row[0], "new_estimates": row[1], "open_chats": row[2],
        "total_chats": row[3], "total_estimates": row[4], "updated_prices": row[5],
    }
    print(f"[ai_draft] stats={stats}")

    # ── Последние изменения прайса за 24 часа ──────────────────────────────
    cur.execute(f"""
        SELECT name, price, category FROM {SCHEMA}.ai_prices
        WHERE updated_at > now() - interval '24 hours'
        ORDER BY updated_at DESC LIMIT 8
    """)
    price_changes = [{"name": r[0], "price": r[1], "category": r[2]} for r in cur.fetchall()]

    # ── Последние сметы (топ по сумме) за 24 часа ──────────────────────────
    cur.execute(f"""
        SELECT total_standard, created_at FROM {SCHEMA}.saved_estimates
        WHERE created_at > now() - interval '24 hours' AND total_standard IS NOT NULL
        ORDER BY total_standard DESC LIMIT 5
    """)
    top_estimates = [{"total": float(r[0]), "date": r[1].strftime("%d.%m %H:%M")} for r in cur.fetchall()]

    # ── Формируем контекст для AI ──────────────────────────────────────────
    price_lines = "\n".join([f"- {p['name']} ({p['category']}): {p['price']} ₽" for p in price_changes]) or "Изменений не было"
    estimate_lines = "\n".join([f"- {e['date']}: {int(e['total']):,} ₽".replace(",", " ") for e in top_estimates]) or "Нет данных"

    context = f"""Статистика системы AI-potolki за последние 24 часа:
- Новых заявок: {stats['new_chats']}
- Новых смет: {stats['new_estimates']}
- Открытых заявок сейчас: {stats['open_chats']}
- Всего заявок в системе: {stats['total_chats']}
- Всего смет в системе: {stats['total_estimates']}
- Обновлено позиций в прайсе: {stats['updated_prices']}

Обновлённые позиции прайса:
{price_lines}

Топ смет по сумме:
{estimate_lines}"""

    print(f"[ai_draft] context built, calling OpenAI...")

    # ── Вызываем OpenAI ─────────────────────────────────────────────────────
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print("[ai_draft] ERROR: no OPENAI_API_KEY")
        return {"title": "Обновление системы", "content": f"<p>{context}</p>", "error": "no_api_key"}

    prompt = f"""Ты — редактор новостей сервиса AI-potolki (экосистема для натяжных потолков).
На основе данных ниже напиши короткую новость для клиентов компании (2-3 абзаца).
Тон: позитивный, деловой, живой. Не используй сухие цифры напрямую — превращай их в смысл.
Пиши на русском. Без заголовков внутри текста — только абзацы через <p>.

Данные:
{context}

Верни JSON: {{"title": "...", "content": "<p>...</p><p>...</p>"}}
Только JSON, без пояснений."""

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "temperature": 0.7},
            timeout=25,
        )
        print(f"[ai_draft] OpenAI status={resp.status_code}")
        data = resp.json()
        text = data["choices"][0]["message"]["content"].strip()
        print(f"[ai_draft] OpenAI response: {text[:200]}")
        # Извлекаем JSON из ответа
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            result = json.loads(m.group(0))
            return {"title": result.get("title", "Обновление"), "content": result.get("content", ""), "stats": stats}
    except Exception as e:
        print(f"[ai_draft] error: {e}")

    # Fallback — без AI
    title = f"Обновление {datetime.now().strftime('%d.%m.%Y')}"
    content = f"<p>За последние 24 часа в системе AI-potolki: {stats['new_chats']} новых заявок, {stats['new_estimates']} смет. Продолжаем развивать экосистему!</p>"
    return {"title": title, "content": content, "stats": stats, "error": "ai_failed"}