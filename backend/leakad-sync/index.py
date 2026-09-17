"""Вебхук синхронизации LeakAD -> внутренняя CRM (точная копия без потерь).

Что делает:
  POST /            — приём события потока (lead/contact/comment/task/file/payment/
                      справочники). Проверка HMAC-подписи, идемпотентность по
                      event_id, защита от применения устаревших событий,
                      журнал всех событий и DLQ.
  POST /?r=pull     — АКТИВНАЯ ВЫТЯЖКА ИСТОРИИ. Вебхук приносит только новые
                      события, поэтому сохранить URL в LeakAD недостаточно —
                      старая база так не переедет. Здесь мы сами обходим их
                      API экспорта и забираем всю историю. Возобновляемо: если
                      не успели за отведённое время, позиция сохраняется и
                      следующий вызов продолжает с места обрыва.
  GET  /?r=pull-status — прогресс вытяжки по каждой сущности.
  POST /?r=import-archive — запасной путь: загрузка ZIP/JSONL-выгрузки LeakAD
                      по ссылке, если read-only API у них нет.
  POST /?r=import   — первичный пакетный импорт (Контур A): принимает пачку
                      объектов одной сущности из выгрузки LeakAD.
  GET  /?r=status   — состояние синхронизации: счётчики, последний sequence,
                      разрывы нумерации, необработанные события.
  GET  /?r=checksums— контрольные количества и sha256 по правилам ТЗ (акт сверки).
  GET  /?r=events   — журнал событий (в т.ч. DLQ) с фильтрами.
  POST /?r=replay   — ручной повтор события из журнала/DLQ.
  POST /?r=refetch-files — повторное скачивание файлов, которые не удалось забрать.
  GET  /?r=schema   — JSON Schema конверта события (для разработчика LeakAD).

Старый вебхук ?r=leakad-webhook в crm-manager продолжает работать без изменений —
эта функция полностью независима и ничего в нём не трогает.
"""

import json
import os
import time
import traceback
import urllib.request
from datetime import datetime, timezone

from shared import (BatchMode, CORS, MAX_BODY_BYTES, OWNER_EMAIL, SCHEMA, SUPPORTED_EVENT_VERSIONS,
                    body_sha256, collection_hash, fail, get_conn, lower_headers, ok,
                    parse_dt, resp, verify_signature)
from handlers import comments as h_comments
from handlers import files as h_files
from handlers import leads as h_leads
from handlers import pull as h_pull
from handlers import store
from handlers import tasks as h_tasks

# Максимальный размер ZIP/JSONL-выгрузки, которую можно загрузить одним вызовом.
MAX_ARCHIVE_BYTES = int(os.environ.get("LEAKAD_MAX_ARCHIVE", str(40 * 1024 * 1024)))

# Маршрутизация типов событий. Добавить новый тип = добавить строку сюда.
# Неизвестный тип НЕ считается ошибкой доставки: он журналируется как 'ignored',
# чтобы LeakAD не уходил в бесконечные ретраи из-за события, которого мы ещё не знаем.
EVENT_ROUTES = {
    "lead.created", "lead.updated", "lead.status_changed", "lead.responsible_changed",
    "lead.deleted", "lead.restored",
    "contact.created", "contact.updated", "contact.merged", "contact.deleted", "contact.restored",
    "comment.created", "comment.updated", "comment.deleted",
    "task.created", "task.updated", "task.completed", "task.deleted",
    "file.created", "file.updated", "file.deleted",
    "payment.created", "payment.updated", "payment.deleted",
    "pipeline.updated", "status.updated", "user.updated", "source.updated",
    "custom_field.updated", "tag.updated", "task_type.updated", "cancel_reason.updated",
}

DICT_EVENTS = {
    "pipeline.updated": "pipeline", "status.updated": "status", "user.updated": "user",
    "source.updated": "source", "custom_field.updated": "custom_field",
    "tag.updated": "tag", "task_type.updated": "task_type",
    "cancel_reason.updated": "cancel_reason",
}


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _raw_body(event):
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        import base64
        try:
            raw = base64.b64decode(raw).decode("utf-8", errors="replace")
        except Exception:
            pass
    return raw


def _admin_authorized(conn, event):
    """Служебные методы (status/checksums/replay) доступны либо по тому же
    секрету вебхука, либо авторизованному сотруднику CRM."""
    qs = event.get("queryStringParameters") or {}
    secret = os.environ.get("LEAKAD_SYNC_SECRET") or os.environ.get("LEAKAD_WEBHOOK_KEY")
    hdrs = lower_headers(event)
    if secret and (qs.get("key") == secret or hdrs.get("x-webhook-secret") == secret):
        return True
    token = (hdrs.get("x-authorization") or hdrs.get("authorization") or "").replace("Bearer ", "").strip()
    if not token:
        return False
    with conn.cursor() as c:
        c.execute(f"""SELECT 1 FROM {SCHEMA}.user_sessions
                      WHERE token=%s AND expires_at > NOW()""", (token,))
        return c.fetchone() is not None


def handler(event: dict, context) -> dict:
    """Приём и обработка потока событий LeakAD."""
    method = event.get("httpMethod", "GET")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    resource = qs.get("r", "")

    if resource == "schema" and method == "GET":
        return ok(_event_schema())

    conn = None
    try:
        conn = get_conn()

        if resource in ("status", "checksums", "events", "gaps", "pull-status") and method == "GET":
            if not _admin_authorized(conn, event):
                return fail(401, "unauthorized")
            if resource == "status":
                return ok(_status(conn, qs))
            if resource == "checksums":
                return ok(_checksums(conn, qs))
            if resource == "gaps":
                return ok({"gaps": store.sequence_gaps(conn, qs.get("account_id"))})
            if resource == "pull-status":
                return ok({"ok": True, "configured": h_pull.configured(),
                           "api_url": h_pull.api_base() or None,
                           "jobs": h_pull.jobs_status(conn, qs.get("account_id"))})
            return ok(_events(conn, qs))

        if resource in ("replay", "refetch-files", "purge-sandbox") and method == "POST":
            if not _admin_authorized(conn, event):
                return fail(401, "unauthorized")
            body = json.loads(_raw_body(event) or "{}")
            if resource == "replay":
                return ok(_replay(conn, body))
            if resource == "purge-sandbox":
                return ok(_purge_sandbox(conn, body))
            return ok(_refetch_files(conn, body))

        if method != "POST":
            return fail(405, "method not allowed")

        if resource in ("import", "pull", "import-archive"):
            if not _admin_authorized(conn, event):
                return fail(401, "unauthorized")
            body = json.loads(_raw_body(event) or "{}")
            if resource == "pull":
                return _pull(conn, body, context)
            if resource == "import-archive":
                return _import_archive(conn, body, context)
            return _bulk_import(conn, body)

        return _receive(conn, event)

    except Exception as exc:
        print(f"[leakad-sync] fatal: {type(exc).__name__}: {exc}\n{traceback.format_exc()}")
        # 503 — временная ошибка: по ТЗ LeakAD должен повторить доставку.
        return fail(503, f"internal error: {type(exc).__name__}")
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


# ── Приём события ────────────────────────────────────────────────────────────

def _receive(conn, event):
    hdrs = lower_headers(event)
    raw = _raw_body(event)

    if len(raw.encode("utf-8")) > MAX_BODY_BYTES:
        return fail(413, "payload too large")

    ctype = (hdrs.get("content-type") or "").split(";")[0].strip().lower()
    if ctype and ctype != "application/json":
        return fail(415, f"unsupported content-type: {ctype}")

    secret = os.environ.get("LEAKAD_SYNC_SECRET") or os.environ.get("LEAKAD_WEBHOOK_KEY")
    valid, reason = verify_signature(secret, hdrs.get("x-webhook-timestamp"),
                                     raw, hdrs.get("x-webhook-signature"))
    if not valid:
        # Неверная подпись — 401, автоповтор по ТЗ не нужен, нужна реакция администратора.
        print(f"[leakad-sync] signature rejected: {reason}")
        return fail(401, f"signature rejected: {reason}")

    try:
        payload = json.loads(raw)
    except Exception as exc:
        return fail(400, f"invalid json: {exc}")
    if not isinstance(payload, dict):
        return fail(400, "body must be a json object")

    event_id = payload.get("event_id")
    if not event_id:
        return fail(422, "missing event_id")

    # X-Webhook-Id должен совпадать с event_id в теле — иначе подмена/ошибка отправителя.
    hdr_id = hdrs.get("x-webhook-id")
    if hdr_id and hdr_id != event_id:
        return fail(422, "X-Webhook-Id does not match event_id", event_id)

    event_type = payload.get("event_type")
    if not event_type:
        return fail(422, "missing event_type", event_id)

    version = payload.get("event_version", 1)
    try:
        version = int(version)
    except (TypeError, ValueError):
        return fail(422, "bad event_version", event_id)
    if version not in SUPPORTED_EVENT_VERSIONS:
        return fail(422, f"unsupported event_version {version}", event_id,
                    {"supported": list(SUPPORTED_EVENT_VERSIONS)})

    account_id = payload.get("account_id")
    raw_sha = body_sha256(raw)

    # ── Идемпотентность ──────────────────────────────────────────────────────
    prior = store.find_event(conn, account_id, event_id)
    if prior:
        store.bump_attempt(conn, prior["id"])
        return ok({"ok": True, "event_id": event_id, "duplicate": True,
                   "internal_entity_id": prior.get("internal_entity_id"),
                   "body_changed": prior.get("body_sha256") != raw_sha,
                   "received_at": _now_iso()})

    envelope = {
        "event_id": event_id,
        "event_type": event_type,
        "event_version": version,
        "transaction_id": payload.get("transaction_id"),
        "account_id": account_id,
        "entity_type": payload.get("entity_type"),
        "entity_id": payload.get("entity_id"),
        "entity_updated_at": parse_dt(payload.get("entity_updated_at")),
        "sequence": payload.get("sequence"),
        "occurred_at": parse_dt(payload.get("occurred_at")),
        "sent_at": parse_dt(payload.get("sent_at")),
        "raw_snapshot": payload.get("raw_snapshot"),
    }

    log_id = store.log_event(conn, envelope, raw_sha, payload)

    company_id = store.owner_company_id(conn, OWNER_EMAIL)
    if _is_sandbox(account_id):
        # Sandbox-режим: событие полностью обрабатывается и проверяется, но
        # карточка не попадает в рабочую компанию — её видно только по
        # account_id и можно снести через ?r=purge-sandbox.
        company_id = None
    cfg = store.integration_config(conn, company_id)
    if str(cfg.get("leakad_sync_enabled", "true")).lower() == "false":
        store.finish_event(conn, log_id, "skipped", 200, error="sync disabled")
        return ok({"ok": True, "event_id": event_id, "skipped": True,
                   "reason": "disabled", "received_at": _now_iso()})

    try:
        internal_id, action = _dispatch(conn, envelope, payload, company_id)
    except ValueError as exc:
        # Валидный JSON, но нарушена схема — 422, в ретраи не гоняем.
        store.finish_event(conn, log_id, "dead_letter", 422, error=str(exc)[:1000])
        return fail(422, str(exc), event_id)
    except Exception as exc:
        print(f"[leakad-sync] handler failed {event_type}: {type(exc).__name__}: {exc}\n"
              f"{traceback.format_exc()}")
        # Временная ошибка — 503, LeakAD повторит по своей retry-политике.
        store.finish_event(conn, log_id, "failed", 503,
                           error=f"{type(exc).__name__}: {str(exc)[:900]}")
        return fail(503, "temporary processing error", event_id)

    store.finish_event(conn, log_id, "delivered", 200, internal_entity_id=internal_id)
    return ok({"ok": True, "event_id": event_id, "action": action,
               "internal_entity_id": internal_id, "received_at": _now_iso()})


def _dispatch(conn, envelope, payload, company_id):
    """Разводит событие по обработчику. Возвращает (internal_id, action)."""
    event_type = envelope["event_type"]
    account_id = envelope.get("account_id")
    data = payload.get("data") or {}

    if event_type not in EVENT_ROUTES:
        # Неизвестный тип не роняем: сохраняем сырьё и подтверждаем приём.
        if envelope.get("entity_type") and envelope.get("entity_id"):
            store.upsert_entity(conn, account_id, envelope["entity_type"], envelope["entity_id"],
                                sequence_no=envelope.get("sequence"), data=data,
                                raw_snapshot=payload.get("raw_snapshot") or payload)
        return None, "ignored_unknown_type"

    if event_type in DICT_EVENTS:
        dict_type = DICT_EVENTS[event_type]
        items = data.get("items") if isinstance(data.get("items"), list) else [data]
        count = sum(1 for it in items if store.upsert_dictionary(conn, account_id, dict_type, it))
        return None, f"dictionary:{dict_type}:{count}"

    if event_type.startswith("lead."):
        if event_type == "lead.deleted":
            return h_leads.soft_delete_lead(conn, account_id, envelope, data)
        if event_type == "lead.restored":
            return h_leads.soft_delete_lead(conn, account_id, envelope, data, restore=True)
        return h_leads.apply_lead(conn, account_id, company_id, envelope, data)

    if event_type.startswith("contact."):
        if event_type == "contact.merged":
            return h_leads.merge_contacts(conn, account_id, envelope, data)
        contact = data.get("contact") or data
        if event_type == "contact.deleted":
            contact = dict(contact)
            contact["deleted"] = True
        elif event_type == "contact.restored":
            contact = dict(contact)
            contact["deleted"] = False
        return h_leads.apply_contact(conn, account_id, envelope, contact)

    if event_type.startswith("comment."):
        item = data.get("comment") or data
        if event_type == "comment.deleted":
            return h_comments.delete_comment(conn, account_id, envelope, item)
        return h_comments.apply_comment(conn, account_id, envelope, item)

    if event_type.startswith("task."):
        item = dict(data.get("task") or data)
        if event_type == "task.deleted":
            item["deleted"] = True
        elif event_type == "task.completed":
            item["completed"] = True
        return h_tasks.apply_task(conn, account_id, envelope, item)

    if event_type.startswith("file."):
        item = data.get("file") or data
        if event_type == "file.deleted":
            return h_files.delete_file(conn, account_id, envelope, item)
        return h_files.apply_file(conn, account_id, envelope, item)

    if event_type.startswith("payment."):
        item = data.get("payment") or data
        return h_files.apply_payment(conn, account_id, envelope, item,
                                     deleted=(event_type == "payment.deleted"))

    return None, "ignored"


# ── Первичный импорт (Контур A) ──────────────────────────────────────────────

def _import_items(conn, account_id, company_id, entity, items, snapshot_at=None,
                  deadline=None):
    """Ядро импорта пачки объектов одной сущности.

    Общее для трёх путей загрузки истории: ручной ?r=import, активная вытяжка
    ?r=pull и разбор ZIP/JSONL-выгрузки. Один код — одни правила: те же внешние
    ID, та же идемпотентность, тот же raw_snapshot.
    Возвращает (сколько импортировано, список ошибок).
    """
    entity = (entity or "").strip().lower()
    envelope = {"event_id": f"import_{entity}", "event_type": f"{entity}.import",
                "account_id": account_id, "sequence": None,
                "entity_updated_at": None, "occurred_at": parse_dt(snapshot_at)}

    # Пакетный режим: промежуточные коммиты группируются, иначе тысячи записей
    # не успевают залиться за время работы функции.
    BatchMode.start(every=100)
    store.reset_status_cache()
    handled, errors = 0, []
    for idx, item in enumerate(items):
        if deadline and time.time() > deadline:
            # Время вышло: возвращаем сколько успели, вызывающий сохранит позицию
            # и продолжит следующим вызовом. Лучше частичный успех, чем 504 и
            # потеря всего прогресса пачки.
            errors.append({"index": idx, "stopped": "time budget",
                           "remaining": len(items) - idx})
            break
        if not isinstance(item, dict):
            errors.append({"index": idx, "error": "item is not an object"})
            continue
        try:
            if entity in ("leads", "lead"):
                data = item if ("lead" in item or "contact" in item) else {"lead": item}
                h_leads.apply_lead(conn, account_id, company_id, envelope, data)
            elif entity in ("contacts", "contact"):
                h_leads.apply_contact(conn, account_id, envelope, item)
            elif entity in ("comments", "comment"):
                h_comments.apply_comment(conn, account_id, envelope, item)
            elif entity in ("tasks", "task"):
                h_tasks.apply_task(conn, account_id, envelope, item)
            elif entity in ("files", "file"):
                h_files.apply_file(conn, account_id, envelope, item)
            elif entity in ("payments", "payment"):
                h_files.apply_payment(conn, account_id, envelope, item)
            else:
                dict_type = entity.rstrip("s").replace("-", "_")
                store.upsert_dictionary(conn, account_id, dict_type, item)
            handled += 1
        except Exception as exc:
            # Откат отменит и уже накопленные в пачке записи, поэтому сначала
            # фиксируем всё успешное — одна битая запись не должна обнулять
            # прогресс всей пачки.
            try:
                BatchMode.flush(conn)
            except Exception:
                pass
            conn.rollback()
            errors.append({"index": idx, "id": item.get("id"),
                           "error": f"{type(exc).__name__}: {str(exc)[:300]}"})
            if len(errors) >= 100:
                break

    BatchMode.flush(conn)
    BatchMode.stop()
    return handled, errors


def _bulk_import(conn, body):
    """Пакетная загрузка выгрузки LeakAD. Формат:
        {"entity": "leads"|"contacts"|"comments"|"tasks"|"files"|"payments"|
                    "pipelines"|"statuses"|"users"|"sources"|"custom-fields",
         "account_id": "...", "snapshot_at": "...", "items": [...]}
    Идемпотентна: повторный прогон той же пачки не создаёт дублей."""
    entity = (body.get("entity") or "").strip().lower()
    items = body.get("items")
    if not isinstance(items, list):
        return fail(422, "items must be an array")

    account_id = body.get("account_id")
    company_id = store.owner_company_id(conn, OWNER_EMAIL)
    snapshot_at = body.get("snapshot_at")

    handled, errors = _import_items(conn, account_id, company_id, entity, items, snapshot_at)

    if snapshot_at:
        with conn.cursor() as c:
            c.execute(
                f"""INSERT INTO {SCHEMA}.leakad_snapshots (account_id, snapshot_at, report)
                    VALUES (%s,%s,%s)""",
                (account_id or "-", parse_dt(snapshot_at),
                 json.dumps({"entity": entity, "handled": handled,
                             "errors": len(errors)}, ensure_ascii=False)))
        conn.commit()

    return ok({"ok": not errors, "entity": entity, "received": len(items),
               "imported": handled, "errors": errors})


def _time_budget(context, reserve=6.0):
    """До какого момента можно работать, чтобы успеть вернуть ответ.
    Облачная функция жёстко ограничена по времени — обход истории должен
    остановиться сам и сохранить позицию, а не быть убитым таймаутом."""
    try:
        left = float(context.get_remaining_time_in_millis()) / 1000.0
    except Exception:
        left = float(os.environ.get("LEAKAD_PULL_BUDGET", "25"))
    return time.time() + max(3.0, left - reserve)


def _pull(conn, body, context):
    """Активная вытяжка истории из LeakAD (Контур A).

    Главное отличие от вебхука: вебхук приносит только НОВЫЕ события, поэтому
    простого сохранения URL в LeakAD НЕ достаточно — старая база так не
    переедет. Здесь мы сами идём в API экспорта LeakAD и забираем всю историю.

    Возобновляемо: если не успели за отведённое время, позиция сохраняется и
    следующий вызов продолжает с места обрыва. Повторный вызов дублей не плодит.
    """
    problem = h_pull.base_problem()
    if problem:
        return fail(424, f"активная вытяжка недоступна: {problem}", extra={
            "need_secrets": ["LEAKAD_API_URL", "LEAKAD_API_TOKEN"],
            "what_to_do": "Укажите адрес API экспорта LeakAD (вида https://.../api/export/v1) "
                          "и read-only токен в секретах проекта, затем повторите ?r=pull. "
                          "Если API у LeakAD нет — используйте ?r=import-archive с их "
                          "ZIP/JSONL-выгрузкой (её можно передать ссылкой или в теле запроса).",
        })

    account_id = body.get("account_id")
    company_id = store.owner_company_id(conn, OWNER_EMAIL)
    deadline = _time_budget(context)

    def import_batch(entity, items, snapshot_at):
        return _import_items(conn, account_id, company_id, entity, items, snapshot_at)

    result = h_pull.pull_all(
        conn, account_id, company_id, import_batch,
        entities=body.get("entities"),
        max_pages_per_entity=int(body.get("max_pages") or 50),
        deadline=deadline,
        reset=bool(body.get("reset")),
        updated_from=body.get("updated_from"),
    )
    return ok(result)


def _import_archive(conn, body, context):
    """Запасной путь по ТЗ: загрузка полного ZIP/JSONL-экспорта LeakAD,
    если read-only API у них нет. Принимает ссылку на архив:
        {"url": "https://...export.zip", "account_id": "..."}
    Внутри ожидаются файлы вида leads.jsonl, contacts.jsonl и т.д.
    Порядок разбора — тот же безопасный (справочники → контакты → заявки → ...).
    """
    url = body.get("url")
    inline = body.get("archive_base64")
    if not url and not inline:
        return fail(422, "нужен url архива (zip/jsonl) либо archive_base64 с его содержимым")

    account_id = body.get("account_id")
    company_id = store.owner_company_id(conn, OWNER_EMAIL)
    deadline = _time_budget(context)

    if inline:
        # Архив пришёл прямо в теле — удобно, когда выгрузка лежит локально
        # и её негде опубликовать по ссылке.
        try:
            import base64 as _b64
            blob = _b64.b64decode(inline)
        except Exception as exc:
            return fail(422, f"archive_base64 не декодируется: {type(exc).__name__}")
    else:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "mospotolki-crm-import/1"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                blob = resp.read(MAX_ARCHIVE_BYTES + 1)
        except Exception as exc:
            return fail(424, f"не удалось скачать архив: {type(exc).__name__}: {str(exc)[:200]}")

    if len(blob) > MAX_ARCHIVE_BYTES:
        return fail(413, f"архив больше {MAX_ARCHIVE_BYTES // (1024*1024)} МБ — "
                         f"разбейте выгрузку на части")

    results, totals = [], {"fetched": 0, "imported": 0, "failed": 0}
    snapshot_at = body.get("snapshot_at")
    incomplete = []

    def run(entity, lines):
        """Импортирует одну сущность, продолжая с сохранённой позиции.
        Позиция (номер строки) хранится в leakad_pull_jobs — большой архив
        не обязан уложиться в одно выполнение функции."""
        job = h_pull._job(conn, account_id, entity, source="archive")
        if body.get("reset"):
            # Принудительный повтор: начинаем файл сначала. Дублей это не даёт —
            # записи ложатся по тем же внешним ID (upsert), просто перезаписываются.
            h_pull._save_job(conn, job["id"], page_no=0, fetched=0, imported=0,
                             failed=0, status="pending", finished_at=None)
            job = dict(job, page_no=0, fetched=0, imported=0, failed=0, status="pending")
        start = job.get("page_no") or 0
        if job.get("status") == "done":
            results.append({"entity": entity, "status": "done", "skipped": True,
                            "imported": job.get("imported", 0)})
            return

        items, bad_lines = [], 0
        for line in lines[start:]:
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except Exception:
                bad_lines += 1

        imported, errs = _import_items(conn, account_id, company_id, entity, items,
                                       snapshot_at, deadline=deadline)
        stopped = any("stopped" in e for e in errs)
        done_upto = start + imported + bad_lines + len([e for e in errs if "stopped" not in e])

        totals["fetched"] += len(items)
        totals["imported"] += imported
        totals["failed"] += bad_lines + len([e for e in errs if "stopped" not in e])

        h_pull._save_job(conn, job["id"],
                         page_no=done_upto,
                         fetched=(job.get("fetched") or 0) + len(items),
                         imported=(job.get("imported") or 0) + imported,
                         failed=(job.get("failed") or 0) + bad_lines,
                         snapshot_at=parse_dt(snapshot_at),
                         status="partial" if stopped else "done",
                         finished_at=None if stopped else datetime.now(timezone.utc))
        if stopped:
            incomplete.append(entity)
        results.append({"entity": entity, "items": len(items), "imported": imported,
                        "status": "partial" if stopped else "done",
                        "errors": [e for e in errs if "stopped" not in e][:5]})

    if blob[:2] == b"PK":
        import io
        import zipfile
        with zipfile.ZipFile(io.BytesIO(blob)) as zf:
            names = {n.lower().rsplit("/", 1)[-1]: n for n in zf.namelist()}
            manifest = names.get("export-manifest.json")
            if manifest and not snapshot_at:
                try:
                    snapshot_at = json.loads(zf.read(manifest).decode("utf-8")).get("snapshot_at")
                except Exception:
                    pass
            for entity in h_pull.PULL_ORDER:
                if time.time() > deadline:
                    incomplete.append(entity)
                    results.append({"entity": entity, "status": "pending",
                                    "skipped": "time budget"})
                    continue
                fname = names.get(f"{entity}.jsonl") or names.get(f"{entity.replace('-', '_')}.jsonl")
                if not fname:
                    continue
                run(entity, zf.read(fname).decode("utf-8", errors="replace").splitlines())
    else:
        entity = (body.get("entity") or "leads").strip().lower()
        run(entity, blob.decode("utf-8", errors="replace").splitlines())

    if snapshot_at and not incomplete:
        with conn.cursor() as c:
            c.execute(
                f"""INSERT INTO {SCHEMA}.leakad_snapshots (account_id, snapshot_at, report)
                    VALUES (%s,%s,%s)""",
                (account_id or "-", parse_dt(snapshot_at),
                 json.dumps({"source": "archive", "totals": totals}, ensure_ascii=False)))
        conn.commit()

    return ok({"ok": totals["failed"] == 0, "source": "archive",
               "complete": not incomplete,
               "snapshot_at": snapshot_at, "entities": results, "totals": totals,
               "hint": ("Перенос истории завершён." if not incomplete else
                        f"Не успели за отведённое время: {', '.join(sorted(set(incomplete)))}. "
                        f"Повторите тот же запрос — продолжится с места обрыва, дублей не будет.")})


# ── Наблюдаемость и сверка ───────────────────────────────────────────────────

def _status(conn, qs):
    account_id = qs.get("account_id")
    with conn.cursor() as c:
        c.execute(
            f"""SELECT outcome, COUNT(*) FROM {SCHEMA}.leakad_events
                WHERE COALESCE(account_id,'-')=COALESCE(%s,'-') GROUP BY outcome""",
            (account_id,))
        by_outcome = {r[0]: r[1] for r in c.fetchall()}
        c.execute(
            f"""SELECT MAX(sequence_no), MAX(received_at), COUNT(*)
                FROM {SCHEMA}.leakad_events
                WHERE COALESCE(account_id,'-')=COALESCE(%s,'-')""", (account_id,))
        seq_row = c.fetchone()
        c.execute(
            f"""SELECT entity_type, COUNT(*) FILTER (WHERE NOT is_removed),
                       COUNT(*) FILTER (WHERE is_removed)
                FROM {SCHEMA}.leakad_entities
                WHERE account_id=COALESCE(%s,'-') GROUP BY entity_type""", (account_id,))
        entities = {r[0]: {"active": r[1], "removed": r[2]} for r in c.fetchall()}
        c.execute(
            f"""SELECT fetch_status, COUNT(*) FROM {SCHEMA}.leakad_files
                WHERE account_id=COALESCE(%s,'-') GROUP BY fetch_status""", (account_id,))
        files = {r[0]: r[1] for r in c.fetchall()}

    return {"ok": True, "account_id": account_id, "events_by_outcome": by_outcome,
            "events_total": seq_row[2], "last_sequence": seq_row[0],
            "last_received_at": seq_row[1], "entities": entities, "files": files,
            "sequence_gaps": store.sequence_gaps(conn, account_id, limit=50),
            "unprocessed": by_outcome.get("pending", 0) + by_outcome.get("failed", 0),
            "dead_letter": by_outcome.get("dead_letter", 0)}


def _checksums(conn, qs):
    """Контрольные количества и хеши по правилам ТЗ:
    канонический JSON с сортировкой ключей -> sha256 записи ->
    сортировка хешей -> sha256 склейки. Сравнивается с /checksums LeakAD."""
    account_id = qs.get("account_id") or "-"
    counts, hashes = {}, {}

    with conn.cursor() as c:
        for etype, key in (("lead", "leads"), ("contact", "contacts"),
                           ("comment", "comments"), ("task", "tasks"),
                           ("file", "files"), ("payment", "payments")):
            c.execute(
                f"""SELECT record_sha256, is_removed FROM {SCHEMA}.leakad_entities
                    WHERE account_id=%s AND entity_type=%s""", (account_id, etype))
            rows = c.fetchall()
            counts[key] = sum(1 for r in rows if not r[1])
            counts[f"deleted_{key}"] = sum(1 for r in rows if r[1])
            hashes[key] = collection_hash([r[0] for r in rows if not r[1]])

        c.execute(
            f"""SELECT COALESCE(SUM(lc.contract_sum),0), COALESCE(SUM(lc.prepayment_fact),0)
                       + COALESCE(SUM(lc.extra_payment_fact),0)
                FROM {SCHEMA}.live_chats lc
                JOIN {SCHEMA}.leakad_entities e
                  ON e.entity_type='lead' AND e.internal_id=lc.id AND e.account_id=%s
                WHERE NOT e.is_removed""", (account_id,))
        sums_row = c.fetchone()

        c.execute(
            f"""SELECT COALESCE(SUM(amount),0) FROM {SCHEMA}.leakad_payments
                WHERE account_id=%s AND NOT is_removed""", (account_id,))
        pay_row = c.fetchone()

        c.execute(f"""SELECT COUNT(*) FILTER (WHERE fetch_status='stored'),
                             COUNT(*) FILTER (WHERE fetch_status <> 'stored')
                      FROM {SCHEMA}.leakad_files WHERE account_id=%s AND NOT is_removed""",
                  (account_id,))
        f_row = c.fetchone()

    return {"ok": True, "account_id": account_id, "snapshot_at": _now_iso(),
            "counts": counts,
            "sums": {"contract_sum": f"{float(sums_row[0]):.2f}",
                     "payments": f"{float(pay_row[0] or 0):.2f}",
                     "payments_in_cards": f"{float(sums_row[1]):.2f}"},
            "hashes": hashes,
            "files_stored": f_row[0], "files_not_stored": f_row[1],
            "hash_rule": "sha256(canonical_json(record)) -> sorted -> sha256(join('\\n'))"}


def _events(conn, qs):
    limit = min(int(qs.get("limit") or 100), 500)
    where, params = ["1=1"], []
    if qs.get("account_id"):
        where.append("COALESCE(account_id,'-')=%s")
        params.append(qs["account_id"])
    if qs.get("outcome"):
        where.append("outcome = ANY(%s)")
        params.append(qs["outcome"].split(","))
    if qs.get("entity_id"):
        where.append("entity_id=%s")
        params.append(qs["entity_id"])
    if qs.get("sequence_from"):
        where.append("sequence_no >= %s")
        params.append(int(qs["sequence_from"]))
    if qs.get("sequence_to"):
        where.append("sequence_no <= %s")
        params.append(int(qs["sequence_to"]))
    params.append(limit)

    with conn.cursor() as c:
        c.execute(
            f"""SELECT id, event_id, event_type, entity_type, entity_id, sequence_no,
                       outcome, http_status, attempts, error, received_at, processed_at,
                       internal_entity_id
                FROM {SCHEMA}.leakad_events
                WHERE {' AND '.join(where)}
                ORDER BY received_at DESC LIMIT %s""", params)
        cols = [d[0] for d in c.description]
        rows = [dict(zip(cols, r)) for r in c.fetchall()]
    return {"ok": True, "items": rows, "count": len(rows)}


def _replay(conn, body):
    """Повтор события из журнала/DLQ — без участия LeakAD, по сохранённому payload."""
    ids = body.get("ids") or ([body["id"]] if body.get("id") else [])
    if not ids and body.get("outcome"):
        with conn.cursor() as c:
            c.execute(
                f"""SELECT id FROM {SCHEMA}.leakad_events
                    WHERE outcome = ANY(%s) ORDER BY sequence_no NULLS LAST, id LIMIT %s""",
                (str(body["outcome"]).split(","), int(body.get("limit") or 100)))
            ids = [r[0] for r in c.fetchall()]
    if not ids:
        return {"ok": True, "replayed": 0, "results": []}

    company_id = store.owner_company_id(conn, OWNER_EMAIL)
    results = []
    for row_id in ids:
        with conn.cursor() as c:
            c.execute(f"SELECT payload FROM {SCHEMA}.leakad_events WHERE id=%s", (row_id,))
            row = c.fetchone()
        if not row:
            results.append({"id": row_id, "ok": False, "error": "not found"})
            continue
        payload = row[0] or {}
        envelope = {
            "event_id": payload.get("event_id"), "event_type": payload.get("event_type"),
            "account_id": payload.get("account_id"), "entity_type": payload.get("entity_type"),
            "entity_id": payload.get("entity_id"), "sequence": payload.get("sequence"),
            "entity_updated_at": parse_dt(payload.get("entity_updated_at")),
            "occurred_at": parse_dt(payload.get("occurred_at")),
            "raw_snapshot": payload.get("raw_snapshot"),
        }
        try:
            internal_id, action = _dispatch(conn, envelope, payload, company_id)
            with conn.cursor() as c:
                c.execute(
                    f"""UPDATE {SCHEMA}.leakad_events
                        SET outcome='delivered', http_status=200, internal_entity_id=%s,
                            error=NULL, processed_at=NOW(), replayed_at=NOW(),
                            attempts=attempts+1
                        WHERE id=%s""", (internal_id, row_id))
            conn.commit()
            results.append({"id": row_id, "ok": True, "action": action,
                            "internal_entity_id": internal_id})
        except Exception as exc:
            conn.rollback()
            msg = f"{type(exc).__name__}: {str(exc)[:300]}"
            with conn.cursor() as c:
                c.execute(
                    f"""UPDATE {SCHEMA}.leakad_events
                        SET outcome='failed', error=%s, replayed_at=NOW(), attempts=attempts+1
                        WHERE id=%s""", (msg, row_id))
            conn.commit()
            results.append({"id": row_id, "ok": False, "error": msg})

    return {"ok": all(r["ok"] for r in results), "replayed": len(results), "results": results}


SANDBOX_PREFIXES = ("sandbox", "test_", "acct_e2e", "demo_")


def _is_sandbox(account_id) -> bool:
    """Песочница определяется по account_id. Тестовый прогон ведётся на
    отдельном account_id, поэтому его можно вычистить, не трогая боевые данные."""
    aid = str(account_id or "").lower()
    return any(aid.startswith(p) for p in SANDBOX_PREFIXES)


def _purge_sandbox(conn, body):
    """Удаляет ВСЕ следы тестового прогона по account_id из песочницы.
    Боевой account_id функция отвергает — снести рабочие данные ей нельзя."""
    account_id = body.get("account_id")
    if not _is_sandbox(account_id):
        return {"ok": False, "error": "account_id is not a sandbox account",
                "allowed_prefixes": list(SANDBOX_PREFIXES)}

    # Тестовые карточки не стираем физически (прав на удаление у функции нет,
    # да и удалять из рабочей таблицы опасно) — переводим в статус 'deleted',
    # как это делает штатное мягкое удаление. Из активной воронки они уходят.
    cleaned = {}
    with conn.cursor() as c:
        c.execute(
            f"""UPDATE {SCHEMA}.live_chats
                SET status='deleted', removed_at=NOW(), updated_at=NOW()
                WHERE leakad_lead_id IS NOT NULL AND id IN (
                    SELECT internal_id FROM {SCHEMA}.leakad_entities
                    WHERE account_id=%s AND entity_type='lead' AND internal_id IS NOT NULL)""",
            (account_id,))
        cleaned["live_chats_marked_deleted"] = c.rowcount

        # Служебные таблицы интеграции помечаем как снятые и обнуляем привязку,
        # чтобы тестовые записи не влияли на счётчики и сверку.
        for table in ("leakad_comments", "leakad_tasks", "leakad_files", "leakad_payments"):
            c.execute(f"UPDATE {SCHEMA}.{table} SET is_removed=TRUE, client_id=NULL "
                      f"WHERE account_id=%s", (account_id,))
            cleaned[table] = c.rowcount
        c.execute(f"""UPDATE {SCHEMA}.leakad_entities
                      SET is_removed=TRUE, internal_id=NULL, removed_at=NOW()
                      WHERE account_id=%s""", (account_id,))
        cleaned["leakad_entities"] = c.rowcount
        c.execute(f"""UPDATE {SCHEMA}.leakad_events SET outcome='purged'
                      WHERE account_id=%s AND outcome <> 'purged'""", (account_id,))
        cleaned["leakad_events"] = c.rowcount
        c.execute(f"""UPDATE {SCHEMA}.leakad_pull_jobs
                      SET status='pending', page_no=0, fetched=0, imported=0, failed=0,
                          cursor=NULL, finished_at=NULL
                      WHERE account_id=%s""", (account_id,))
        cleaned["leakad_pull_jobs_reset"] = c.rowcount
    conn.commit()
    return {"ok": True, "account_id": account_id, "cleaned": cleaned,
            "note": "Тестовые карточки переведены в 'deleted' и отвязаны от реестра. "
                    "Физическое удаление строк делается вручную через управление БД."}


def _refetch_files(conn, body):
    """Повторная попытка забрать файлы, которые не удалось скачать с первого раза."""
    limit = int(body.get("limit") or 25)
    with conn.cursor() as c:
        c.execute(
            f"""SELECT id FROM {SCHEMA}.leakad_files
                WHERE NOT is_removed AND stored_url IS NULL
                  AND fetch_status <> 'stored'
                ORDER BY id LIMIT %s""", (limit,))
        ids = [r[0] for r in c.fetchall()]
    results = [{"id": fid, **h_files.fetch_file(conn, fid)} for fid in ids]
    return {"ok": True, "attempted": len(results),
            "stored": sum(1 for r in results if r.get("ok")), "results": results}


def _event_schema():
    """JSON Schema конверта события — то, что по ТЗ надо отдать разработчику LeakAD."""
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "LeakAD webhook event v1",
        "type": "object",
        "required": ["event_id", "event_type", "event_version", "occurred_at", "data"],
        "additionalProperties": True,
        "properties": {
            "event_id": {"type": "string", "minLength": 1},
            "event_type": {"type": "string", "enum": sorted(EVENT_ROUTES)},
            "event_version": {"type": "integer", "enum": list(SUPPORTED_EVENT_VERSIONS)},
            "transaction_id": {"type": ["string", "null"]},
            "account_id": {"type": ["string", "null"]},
            "occurred_at": {"type": "string", "format": "date-time"},
            "sent_at": {"type": ["string", "null"], "format": "date-time"},
            "sequence": {"type": ["integer", "null"]},
            "entity_type": {"type": ["string", "null"]},
            "entity_id": {"type": ["string", "null"]},
            "entity_updated_at": {"type": ["string", "null"], "format": "date-time"},
            "data": {"type": "object"},
            "previous": {"type": ["object", "null"]},
            "changed_fields": {"type": ["array", "null"], "items": {"type": "string"}},
            "raw_snapshot": {"type": ["object", "null"]},
        },
        "x-signature": {
            "headers": ["X-Webhook-Id", "X-Webhook-Timestamp", "X-Webhook-Signature"],
            "signed_payload": "X-Webhook-Timestamp + '.' + RAW_HTTP_BODY",
            "algorithm": "HMAC-SHA256(WEBHOOK_SECRET, signed_payload)",
            "format": "X-Webhook-Signature: v1=<hex>",
            "max_age_seconds": int(os.environ.get("LEAKAD_MAX_AGE", "600")),
        },
        "x-responses": {
            "200": "обработано (или дубль: duplicate=true)",
            "400": "невалидный JSON — повтор не поможет",
            "401": "подпись не прошла — остановить и уведомить администратора",
            "413": "тело слишком большое",
            "415": "неверный Content-Type",
            "422": "нарушена схема — событие в журнал ошибок",
            "503": "временная ошибка — повторить по retry-политике",
        },
        "x-history-transfer": {
            "важно": "Вебхук доставляет ТОЛЬКО новые события. Сохранить этот URL "
                     "в настройках LeakAD недостаточно — старая база так не "
                     "переедет. Историю нужно перенести отдельно одним из трёх "
                     "способов ниже.",
            "способ_1_pull": {
                "описание": "Мы сами забираем историю из вашего API экспорта. "
                            "Ничего запускать на вашей стороне не нужно.",
                "нужно_от_LeakAD": ["базовый URL API экспорта", "read-only токен"],
                "вызов": "POST ?r=pull&key=<secret>",
                "возобновляемо": True,
            },
            "способ_2_archive": {
                "описание": "Вы отдаёте полный ZIP/JSONL-экспорт по ссылке.",
                "вызов": "POST ?r=import-archive&key=<secret> {\"url\": \"https://...\"}",
                "ожидаемые_файлы": [f"{e}.jsonl" for e in h_pull.PULL_ORDER],
            },
            "способ_3_replay": {
                "описание": "Вы запускаете у себя повторную отправку всех "
                            "исторических записей на этот вебхук как обычные "
                            "события lead.created/updated и т.д.",
                "требование": "идемпотентность обеспечена на нашей стороне — "
                              "дубли не создадутся даже при полном переигрывании",
            },
        },
    }