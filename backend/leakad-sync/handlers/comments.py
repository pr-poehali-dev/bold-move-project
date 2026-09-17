"""comment.* — комментарии и история коммуникаций.

Хронология сохраняется: каждый комментарий — отдельная запись со своим
постоянным comment_id, автором, каналом, направлением и точной датой.
Склеивать их в одно текстовое поле карточки запрещено ТЗ, поэтому они
живут в leakad_comments и дополнительно зеркалируются в ленту live_messages,
чтобы менеджер видел переписку прямо в карточке CRM.
"""

import json

from shared import BatchMode, SCHEMA, clip, parse_dt, pick, to_bool
from . import store


def _resolve_client(conn, account_id, lead_ext):
    if not lead_ext:
        return None, None
    ent = store.get_entity(conn, account_id, "lead", lead_ext)
    if ent and ent.get("internal_id"):
        return ent["internal_id"], ent
    with conn.cursor() as c:
        c.execute(f"SELECT id FROM {SCHEMA}.live_chats WHERE leakad_lead_id=%s LIMIT 1", (str(lead_ext),))
        row = c.fetchone()
    return (row[0] if row else None), ent


def apply_comment(conn, account_id, envelope, item, default_lead=None, client_id=None):
    ext_id = str(item.get("id") or envelope.get("entity_id") or "")
    if not ext_id:
        raise ValueError("нет comment.id")

    lead_ext = str(item.get("lead_id") or default_lead or "") or None
    if client_id is None:
        client_id, _ = _resolve_client(conn, account_id, lead_ext)

    occurred = parse_dt(item.get("created_at")) or parse_dt(envelope.get("occurred_at"))
    deleted = to_bool(item.get("deleted"), False)

    with conn.cursor() as c:
        c.execute(
            f"""INSERT INTO {SCHEMA}.leakad_comments
                    (account_id, external_id, lead_ext_id, contact_ext_id, client_id,
                     direction, channel, author_type, author_ext_id, author_name, text,
                     attachments, occurred_at, updated_at, is_removed, removed_at, raw_snapshot)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (account_id, external_id) DO UPDATE SET
                    lead_ext_id   = COALESCE(EXCLUDED.lead_ext_id, {SCHEMA}.leakad_comments.lead_ext_id),
                    contact_ext_id= COALESCE(EXCLUDED.contact_ext_id, {SCHEMA}.leakad_comments.contact_ext_id),
                    client_id     = COALESCE(EXCLUDED.client_id, {SCHEMA}.leakad_comments.client_id),
                    direction=EXCLUDED.direction, channel=EXCLUDED.channel,
                    author_type=EXCLUDED.author_type, author_ext_id=EXCLUDED.author_ext_id,
                    author_name=EXCLUDED.author_name, text=EXCLUDED.text,
                    attachments=EXCLUDED.attachments,
                    occurred_at = COALESCE(EXCLUDED.occurred_at, {SCHEMA}.leakad_comments.occurred_at),
                    updated_at=EXCLUDED.updated_at, is_removed=EXCLUDED.is_removed,
                    removed_at=EXCLUDED.removed_at, raw_snapshot=EXCLUDED.raw_snapshot
                RETURNING id, live_message_id""",
            (account_id or "-", ext_id, lead_ext, item.get("contact_id"), client_id,
             item.get("direction"), item.get("channel"), item.get("author_type"),
             item.get("author_id"), clip(item.get("author_name"), 300), item.get("text"),
             json.dumps(item.get("attachments") or [], ensure_ascii=False),
             occurred, parse_dt(item.get("updated_at")), deleted,
             parse_dt(item.get("deleted_at")),
             json.dumps(item.get("raw_snapshot") or item, ensure_ascii=False)),
        )
        row = c.fetchone()
    BatchMode.commit(conn)

    _mirror_to_chat(conn, row[0], row[1], client_id, item, deleted)

    store.upsert_entity(
        conn, account_id, "comment", ext_id,
        internal_id=row[0], internal_table="leakad_comments",
        parent_lead=lead_ext,
        entity_updated_at=parse_dt(item.get("updated_at")) or occurred,
        sequence_no=envelope.get("sequence"),
        is_removed=deleted, removed_at=parse_dt(item.get("deleted_at")),
        data=item, raw_snapshot=item.get("raw_snapshot") or item,
    )
    return row[0], ("deleted" if deleted else "ok")


def _mirror_to_chat(conn, comment_row_id, existing_msg_id, client_id, item, deleted):
    """Зеркалирование в ленту переписки карточки. Сбой зеркала не должен
    ронять приём события — исходник уже сохранён в leakad_comments."""
    if not client_id or deleted:
        return
    text = (item.get("text") or "").strip()
    if not text:
        return
    role = "client" if (item.get("author_type") == "customer"
                        or item.get("direction") == "incoming") else "operator"
    try:
        with conn.cursor() as c:
            c.execute(f"SELECT session_id FROM {SCHEMA}.live_chats WHERE id=%s", (client_id,))
            row = c.fetchone()
            if not row:
                return
            session_id = row[0]
            if existing_msg_id:
                c.execute(f"UPDATE {SCHEMA}.live_messages SET text=%s WHERE id=%s",
                          (text, existing_msg_id))
            else:
                c.execute(
                    f"""INSERT INTO {SCHEMA}.live_messages (session_id, role, text, created_at)
                        VALUES (%s,%s,%s, COALESCE(%s, NOW())) RETURNING id""",
                    (session_id, role, text, parse_dt(item.get("created_at"))),
                )
                msg = c.fetchone()
                c.execute(f"UPDATE {SCHEMA}.leakad_comments SET live_message_id=%s WHERE id=%s",
                          (msg[0], comment_row_id))
        BatchMode.commit(conn)
    except Exception as exc:
        print(f"[leakad-sync] mirror comment failed: {type(exc).__name__}: {exc}")
        conn.rollback()


def delete_comment(conn, account_id, envelope, item):
    """Мягкое удаление: текст остаётся в журнале, из ленты карточки убирается."""
    ext_id = str(item.get("id") or envelope.get("entity_id") or "")
    if not ext_id:
        raise ValueError("нет comment.id")
    with conn.cursor() as c:
        c.execute(
            f"""UPDATE {SCHEMA}.leakad_comments
                SET is_removed=TRUE, removed_at=COALESCE(%s, NOW())
                WHERE account_id=%s AND external_id=%s
                RETURNING id, live_message_id""",
            (parse_dt(item.get("deleted_at")), account_id or "-", ext_id),
        )
        row = c.fetchone()
        if row and row[1]:
            # Не стираем строку (прав на удаление нет, да и история переписки
            # ценна) — помечаем текст как удалённый прямо в ленте карточки.
            c.execute(f"UPDATE {SCHEMA}.live_messages SET text=%s WHERE id=%s",
                      ("[сообщение удалено в LeakAD]", row[1]))
    BatchMode.commit(conn)
    store.upsert_entity(
        conn, account_id, "comment", ext_id,
        entity_updated_at=parse_dt(envelope.get("entity_updated_at")),
        sequence_no=envelope.get("sequence"), is_removed=True,
        removed_at=parse_dt(item.get("deleted_at")), data=item,
    )
    return (row[0] if row else None), "deleted"