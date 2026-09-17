"""file.* и payment.* — вложения и платежи.

Файл сначала фиксируется метаданными (имя, размер, sha256, ссылка), затем
скачивается и перекладывается в наше хранилище. Скачивание может не удаться
(ссылка протухла, сеть) — в этом случае запись остаётся с fetch_status='failed'
и её можно перезабрать повторно по file_id, ничего не потеряв.
"""

import hashlib
import json
import os
import urllib.request
import uuid

import boto3

from shared import BatchMode, SCHEMA, clip, parse_dt, to_bool, to_num
from . import store

MAX_FILE_BYTES = int(os.environ.get("LEAKAD_MAX_FILE_BYTES", str(25 * 1024 * 1024)))


def _resolve_client(conn, account_id, lead_ext):
    if not lead_ext:
        return None
    ent = store.get_entity(conn, account_id, "lead", lead_ext)
    if ent and ent.get("internal_id"):
        return ent["internal_id"]
    with conn.cursor() as c:
        c.execute(f"SELECT id FROM {SCHEMA}.live_chats WHERE leakad_lead_id=%s LIMIT 1", (str(lead_ext),))
        row = c.fetchone()
    return row[0] if row else None


def apply_file(conn, account_id, envelope, item, default_lead=None, client_id=None):
    ext_id = str(item.get("id") or envelope.get("entity_id") or "")
    if not ext_id:
        raise ValueError("нет file.id")

    lead_ext = str(item.get("lead_id") or default_lead or "") or None
    if client_id is None:
        client_id = _resolve_client(conn, account_id, lead_ext)
    deleted = to_bool(item.get("deleted"), False)

    with conn.cursor() as c:
        c.execute(
            f"""INSERT INTO {SCHEMA}.leakad_files
                    (account_id, external_id, lead_ext_id, comment_ext_id, client_id,
                     name, mime_type, size_bytes, sha256, download_url,
                     occurred_at, is_removed, raw_snapshot)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (account_id, external_id) DO UPDATE SET
                    lead_ext_id = COALESCE(EXCLUDED.lead_ext_id, {SCHEMA}.leakad_files.lead_ext_id),
                    comment_ext_id = COALESCE(EXCLUDED.comment_ext_id, {SCHEMA}.leakad_files.comment_ext_id),
                    client_id = COALESCE(EXCLUDED.client_id, {SCHEMA}.leakad_files.client_id),
                    name=EXCLUDED.name, mime_type=EXCLUDED.mime_type,
                    size_bytes=EXCLUDED.size_bytes, sha256=EXCLUDED.sha256,
                    download_url=EXCLUDED.download_url, is_removed=EXCLUDED.is_removed,
                    raw_snapshot=EXCLUDED.raw_snapshot
                RETURNING id, stored_url, fetch_status""",
            (account_id or "-", ext_id, lead_ext, item.get("comment_id"), client_id,
             clip(item.get("name"), 300), clip(item.get("mime_type"), 200),
             int(to_num(item.get("size")) or 0) or None, item.get("sha256"),
             item.get("download_url"), parse_dt(item.get("created_at")), deleted,
             json.dumps(item.get("raw_snapshot") or item, ensure_ascii=False)),
        )
        row = c.fetchone()
    BatchMode.commit(conn)

    if not deleted and not row[1]:
        fetch_file(conn, row[0])

    store.upsert_entity(
        conn, account_id, "file", ext_id,
        internal_id=row[0], internal_table="leakad_files", parent_lead=lead_ext,
        entity_updated_at=parse_dt(envelope.get("entity_updated_at")),
        sequence_no=envelope.get("sequence"), is_removed=deleted,
        data=item, raw_snapshot=item.get("raw_snapshot") or item,
    )
    return row[0], ("deleted" if deleted else "ok")


def fetch_file(conn, file_row_id):
    """Скачивает файл по download_url, проверяет sha256 и кладёт в наше хранилище.
    Всегда возвращает результат, никогда не бросает — сбой копирования не должен
    приводить к отказу приёма события (ТЗ: 0 потерь, повтор возможен по file_id)."""
    with conn.cursor() as c:
        c.execute(
            f"""SELECT download_url, name, mime_type, sha256, client_id, size_bytes
                FROM {SCHEMA}.leakad_files WHERE id=%s""", (file_row_id,))
        row = c.fetchone()
    if not row or not row[0]:
        return {"ok": False, "reason": "no download_url"}

    url, name, mime, expected_sha, client_id, size_hint = row
    if size_hint and size_hint > MAX_FILE_BYTES:
        _mark(conn, file_row_id, "too_large", f"size {size_hint} > {MAX_FILE_BYTES}")
        return {"ok": False, "reason": "too large"}

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "mospotolki-crm-sync/1"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            content = resp.read(MAX_FILE_BYTES + 1)
        if len(content) > MAX_FILE_BYTES:
            _mark(conn, file_row_id, "too_large", "stream exceeds limit")
            return {"ok": False, "reason": "too large"}

        actual_sha = hashlib.sha256(content).hexdigest()
        if expected_sha and actual_sha.lower() != str(expected_sha).lower():
            _mark(conn, file_row_id, "sha_mismatch",
                  f"expected {expected_sha[:16]}..., got {actual_sha[:16]}...")
            return {"ok": False, "reason": "sha256 mismatch"}

        ext = os.path.splitext(name or "")[1] or ""
        key = f"leakad/{uuid.uuid4().hex}{ext}"
        s3 = boto3.client("s3", endpoint_url="https://bucket.poehali.dev",
                          aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                          aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])
        bucket = os.environ.get("AWS_BUCKET_NAME", "files")
        s3.put_object(Bucket=bucket, Key=key, Body=content,
                      ContentType=mime or "application/octet-stream")
        stored_url = f"https://cdn.poehali.dev/{bucket}/{key}"

        with conn.cursor() as c:
            c.execute(
                f"""UPDATE {SCHEMA}.leakad_files
                    SET stored_url=%s, sha256=COALESCE(sha256,%s), size_bytes=%s,
                        fetch_status='stored', fetch_error=NULL
                    WHERE id=%s""",
                (stored_url, actual_sha, len(content), file_row_id))
            if client_id:
                c.execute(
                    f"""INSERT INTO {SCHEMA}.client_files (client_id, url, name, type, category)
                        VALUES (%s,%s,%s,%s,'leakad') RETURNING id""",
                    (client_id, stored_url, name or "файл", mime or "application/octet-stream"))
                cf = c.fetchone()
                c.execute(f"UPDATE {SCHEMA}.leakad_files SET client_file_id=%s WHERE id=%s",
                          (cf[0], file_row_id))
        BatchMode.commit(conn)
        return {"ok": True, "url": stored_url, "sha256": actual_sha}
    except Exception as exc:
        conn.rollback()
        _mark(conn, file_row_id, "failed", f"{type(exc).__name__}: {str(exc)[:300]}")
        return {"ok": False, "reason": str(exc)[:200]}


def _mark(conn, file_row_id, status, error):
    try:
        with conn.cursor() as c:
            c.execute(f"UPDATE {SCHEMA}.leakad_files SET fetch_status=%s, fetch_error=%s WHERE id=%s",
                      (status, clip(error, 1000), file_row_id))
        BatchMode.commit(conn)
    except Exception:
        conn.rollback()


def delete_file(conn, account_id, envelope, item):
    ext_id = str(item.get("id") or envelope.get("entity_id") or "")
    if not ext_id:
        raise ValueError("нет file.id")
    with conn.cursor() as c:
        c.execute(
            f"""UPDATE {SCHEMA}.leakad_files SET is_removed=TRUE
                WHERE account_id=%s AND external_id=%s RETURNING id, client_file_id""",
            (account_id or "-", ext_id))
        row = c.fetchone()
        if row and row[1]:
            # Файл, удалённый в LeakAD, помечаем в карточке, но не стираем:
            # прав на удаление у функции нет, а сам файл может понадобиться
            # для акта сверки.
            c.execute(f"UPDATE {SCHEMA}.client_files SET category='leakad_deleted' WHERE id=%s",
                      (row[1],))
    BatchMode.commit(conn)
    store.upsert_entity(conn, account_id, "file", ext_id, is_removed=True,
                        sequence_no=envelope.get("sequence"), data=item)
    return (row[0] if row else None), "deleted"


# ── Платежи ──────────────────────────────────────────────────────────────────

def apply_payment(conn, account_id, envelope, item, deleted=False):
    ext_id = str(item.get("id") or envelope.get("entity_id") or "")
    if not ext_id:
        raise ValueError("нет payment.id")
    lead_ext = str(item.get("lead_id") or "") or None
    client_id = _resolve_client(conn, account_id, lead_ext)
    amount = to_num(item.get("amount"))

    with conn.cursor() as c:
        c.execute(
            f"""INSERT INTO {SCHEMA}.leakad_payments
                    (account_id, external_id, lead_ext_id, client_id, kind, amount,
                     currency, paid_at, is_removed, raw_snapshot)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (account_id, external_id) DO UPDATE SET
                    lead_ext_id = COALESCE(EXCLUDED.lead_ext_id, {SCHEMA}.leakad_payments.lead_ext_id),
                    client_id = COALESCE(EXCLUDED.client_id, {SCHEMA}.leakad_payments.client_id),
                    kind=EXCLUDED.kind, amount=EXCLUDED.amount, currency=EXCLUDED.currency,
                    paid_at=EXCLUDED.paid_at, is_removed=EXCLUDED.is_removed,
                    raw_snapshot=EXCLUDED.raw_snapshot
                RETURNING id""",
            (account_id or "-", ext_id, lead_ext, client_id,
             item.get("kind") or item.get("type"), amount,
             item.get("currency") or "RUB", parse_dt(item.get("paid_at")),
             bool(deleted or to_bool(item.get("deleted"), False)),
             json.dumps(item.get("raw_snapshot") or item, ensure_ascii=False)))
        row = c.fetchone()
    BatchMode.commit(conn)

    store.upsert_entity(conn, account_id, "payment", ext_id, internal_id=row[0],
                        internal_table="leakad_payments", parent_lead=lead_ext,
                        sequence_no=envelope.get("sequence"),
                        is_removed=bool(deleted), data=item)
    return row[0], ("deleted" if deleted else "ok")