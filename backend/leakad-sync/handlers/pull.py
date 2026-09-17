"""Активная вытяжка истории из LeakAD (Контур A, pull-режим).

Зачем: вебхук приносит только НОВЫЕ события. Если просто сохранить URL в
LeakAD, старая база не переедет — приедет лишь то, что изменится после
подключения. Здесь мы не ждём, пока LeakAD сам перешлёт историю, а сами
обходим их API экспорта постранично и заливаем всё через те же обработчики,
что и вебхук (значит, те же правила идемпотентности и внешних ID).

Облачная функция ограничена по времени, поэтому обход возобновляемый:
позиция (курсор/страница) сохраняется в leakad_pull_jobs, и следующий вызов
продолжает с места обрыва. Повторный прогон дублей не создаёт.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from shared import SCHEMA, clip, parse_dt
from . import store

# Порядок важен: сначала справочники и контакты, потом заявки, потом привязанное
# к заявкам. Иначе комментарий может приехать раньше своей заявки.
PULL_ORDER = [
    "users", "pipelines", "statuses", "sources", "custom-fields",
    "contacts", "leads", "comments", "tasks", "files", "payments",
]

# Как называется метод экспорта у LeakAD для каждой сущности.
ENDPOINTS = {
    "users": "users", "pipelines": "pipelines", "statuses": "statuses",
    "sources": "sources", "custom-fields": "custom-fields",
    "contacts": "contacts", "leads": "leads", "comments": "comments",
    "tasks": "tasks", "files": "files", "payments": "payments",
}

DEFAULT_PAGE_SIZE = int(os.environ.get("LEAKAD_PULL_PAGE_SIZE", "200"))
HTTP_TIMEOUT = int(os.environ.get("LEAKAD_PULL_TIMEOUT", "25"))


def api_base():
    return (os.environ.get("LEAKAD_API_URL") or "").strip().rstrip("/")


def api_token():
    return (os.environ.get("LEAKAD_API_TOKEN") or "").strip()


def base_problem():
    """Почему вытяжка недоступна. Возвращает текст проблемы или None.
    Проверяем явно: в поле адреса легко по ошибке вставить пароль/токен,
    и тогда обход упал бы с невнятным 'unknown url type' на каждой сущности."""
    base = api_base()
    if not base:
        return "не задан адрес API экспорта LeakAD (LEAKAD_API_URL)"
    if not base.lower().startswith(("http://", "https://")):
        return (f"LEAKAD_API_URL должен начинаться с https:// — сейчас там "
                f"значение, не похожее на адрес ({base[:12]}...). "
                f"Похоже, вставлен не тот секрет.")
    if not api_token():
        return "не задан read-only токен доступа (LEAKAD_API_TOKEN)"
    return None


def configured():
    return base_problem() is None


def _request(path, params):
    """GET к API LeakAD. Токен передаётся заголовком, не в URL."""
    url = f"{api_base()}/{path.lstrip('/')}"
    if params:
        url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, "")})
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {api_token()}",
        "Accept": "application/json",
        "User-Agent": "mospotolki-crm-pull/1",
    })
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    return json.loads(raw) if raw.strip() else {}


def _extract(payload):
    """Достаёт список объектов и курсор из ответа LeakAD.
    Понимает и формат из ТЗ (items/next_cursor), и типовые варианты
    (data/results/rows, next/cursor/page), чтобы не падать из-за мелких
    расхождений в реализации на их стороне."""
    if isinstance(payload, list):
        return payload, None, False, None

    items = None
    for key in ("items", "data", "results", "rows", "records"):
        val = payload.get(key)
        if isinstance(val, list):
            items = val
            break
    if items is None:
        items = []

    cursor = None
    for key in ("next_cursor", "cursor", "next", "next_page", "page_token"):
        val = payload.get(key)
        if val not in (None, "", False):
            cursor = str(val)
            break

    has_more = payload.get("has_more")
    if has_more is None:
        has_more = bool(cursor)

    return items, cursor, bool(has_more), payload.get("snapshot_at")


def _job(conn, account_id, entity, source="api"):
    with conn.cursor() as c:
        c.execute(
            f"""INSERT INTO {SCHEMA}.leakad_pull_jobs (account_id, entity, source)
                VALUES (%s,%s,%s)
                ON CONFLICT (account_id, entity, source) DO UPDATE SET updated_at=NOW()
                RETURNING id, cursor, page_no, fetched, imported, failed, status, snapshot_at""",
            (account_id or "-", entity, source))
        row = c.fetchone()
    conn.commit()
    return {"id": row[0], "cursor": row[1], "page_no": row[2], "fetched": row[3],
            "imported": row[4], "failed": row[5], "status": row[6], "snapshot_at": row[7]}


def _save_job(conn, job_id, **kw):
    if not kw:
        return
    sets, vals = [], []
    for key, val in kw.items():
        sets.append(f"{key}=%s")
        vals.append(val)
    sets.append("updated_at=NOW()")
    vals.append(job_id)
    with conn.cursor() as c:
        c.execute(f"UPDATE {SCHEMA}.leakad_pull_jobs SET {', '.join(sets)} WHERE id=%s", vals)
    conn.commit()


def pull_entity(conn, account_id, entity, company_id, import_batch,
                max_pages=50, deadline=None, page_size=DEFAULT_PAGE_SIZE,
                updated_from=None, include_deleted=True, reset=False):
    """Обходит одну сущность постранично и импортирует её.

    import_batch — функция(entity, items, snapshot_at) -> (imported, errors),
    та же, что используется при ручном ?r=import. Это гарантирует одинаковые
    правила идемпотентности для pull-режима и для загрузки файлом.
    """
    job = _job(conn, account_id, entity)
    if reset:
        _save_job(conn, job["id"], cursor=None, page_no=0, fetched=0, imported=0,
                  failed=0, status="pending", last_error=None, finished_at=None,
                  errors=json.dumps([], ensure_ascii=False))
        job.update({"cursor": None, "page_no": 0, "fetched": 0, "imported": 0, "failed": 0})

    if job["status"] == "done" and not reset:
        return {"entity": entity, "status": "done", "skipped": True,
                "fetched": job["fetched"], "imported": job["imported"]}

    _save_job(conn, job["id"], status="running", last_error=None)

    cursor = job["cursor"]
    page_no = job["page_no"] or 0
    total_fetched = job["fetched"] or 0
    total_imported = job["imported"] or 0
    total_failed = job["failed"] or 0
    snapshot_at = job["snapshot_at"]
    errors = []
    pages_done = 0
    finished = False

    try:
        while pages_done < max_pages:
            if deadline and time.time() > deadline:
                break

            params = {"limit": page_size, "cursor": cursor,
                      "include_deleted": "true" if include_deleted else "false"}
            if updated_from:
                params["updated_from"] = updated_from
            if not cursor and page_no:
                params["page"] = page_no + 1        # запасной вариант для API без курсоров

            payload = _request(ENDPOINTS.get(entity, entity), params)
            items, next_cursor, has_more, snap = _extract(payload)
            if snap and not snapshot_at:
                snapshot_at = parse_dt(snap)

            pages_done += 1
            page_no += 1
            total_fetched += len(items)

            if items:
                imported, errs = import_batch(entity, items, snapshot_at)
                total_imported += imported
                total_failed += len(errs)
                errors.extend(errs[:20])

            _save_job(conn, job["id"], cursor=next_cursor, page_no=page_no,
                      fetched=total_fetched, imported=total_imported, failed=total_failed,
                      snapshot_at=snapshot_at,
                      errors=json.dumps(errors[:50], ensure_ascii=False))

            # Конец: нет следующей страницы, либо страница пришла пустой/неполной
            if not has_more or not items or (not next_cursor and len(items) < page_size):
                finished = True
                break
            cursor = next_cursor

        status = "done" if finished else "partial"
        _save_job(conn, job["id"], status=status,
                  finished_at=datetime.now(timezone.utc) if finished else None)
        return {"entity": entity, "status": status, "pages": pages_done,
                "fetched": total_fetched, "imported": total_imported,
                "failed": total_failed, "cursor": cursor, "errors": errors[:10]}

    except urllib.error.HTTPError as exc:
        body = ""
        try:
            body = exc.read().decode("utf-8", errors="replace")[:300]
        except Exception:
            pass
        msg = f"HTTP {exc.code} {exc.reason} {body}"
        _save_job(conn, job["id"], status="failed", last_error=clip(msg, 1000))
        return {"entity": entity, "status": "failed", "error": msg,
                "fetched": total_fetched, "imported": total_imported}
    except Exception as exc:
        msg = f"{type(exc).__name__}: {str(exc)[:300]}"
        _save_job(conn, job["id"], status="failed", last_error=clip(msg, 1000))
        return {"entity": entity, "status": "failed", "error": msg,
                "fetched": total_fetched, "imported": total_imported}


def pull_all(conn, account_id, company_id, import_batch, entities=None,
             max_pages_per_entity=50, deadline=None, reset=False, updated_from=None):
    """Полный перенос истории. Сущности идут в безопасном порядке; если время
    функции вышло — возвращает 'partial', и следующий вызов продолжит с места
    обрыва. Ошибка на одной сущности не останавливает остальные."""
    todo = [e for e in (entities or PULL_ORDER) if e in ENDPOINTS]
    results, stopped = [], False

    for entity in todo:
        if deadline and time.time() > deadline:
            stopped = True
            break
        res = pull_entity(conn, account_id, entity, company_id, import_batch,
                          max_pages=max_pages_per_entity, deadline=deadline,
                          reset=reset, updated_from=updated_from)
        results.append(res)

    all_done = (not stopped) and all(r.get("status") in ("done",) for r in results)
    return {
        "ok": all(r.get("status") != "failed" for r in results),
        "complete": all_done,
        "stopped_by_time": stopped or any(r.get("status") == "partial" for r in results),
        "entities": results,
        "totals": {
            "fetched": sum(r.get("fetched", 0) for r in results),
            "imported": sum(r.get("imported", 0) for r in results),
            "failed": sum(r.get("failed", 0) for r in results),
        },
        "hint": ("Перенос завершён." if all_done else
                 "Вызовите ?r=pull ещё раз — продолжится с места обрыва."),
    }


def jobs_status(conn, account_id=None):
    where, params = ("WHERE account_id=%s", [account_id]) if account_id else ("", [])
    with conn.cursor() as c:
        c.execute(
            f"""SELECT account_id, entity, source, status, page_no, fetched, imported,
                       failed, cursor, last_error, snapshot_at, started_at, updated_at, finished_at
                FROM {SCHEMA}.leakad_pull_jobs {where}
                ORDER BY entity""", params)
        cols = [d[0] for d in c.description]
        rows = [dict(zip(cols, r)) for r in c.fetchall()]
    return rows