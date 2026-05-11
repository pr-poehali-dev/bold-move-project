"""
News API — CRUD для новостей экосистемы AI-potolki.
GET  /          — список опубликованных (публично)
GET  /?all=1    — все включая черновики (только мастер)
GET  /?id=N     — одна новость
POST /          — создать (мастер)
PUT  /?id=N     — обновить (мастер)
DELETE /?id=N   — удалить (мастер)
"""

import os
import json
import psycopg2
from datetime import datetime, timezone

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")
DSN    = os.environ.get("DATABASE_URL")

CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
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
