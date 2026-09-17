"""task.* — задачи и напоминания.

Каждая задача хранится в leakad_tasks со своим постоянным task_id и
зеркалируется в календарь CRM (calendar_events), чтобы менеджер видел
напоминание там же, где и остальные события.
"""

import json

from shared import SCHEMA, clip, parse_dt, to_bool
from . import store

# Тип задачи LeakAD -> тип и цвет события календаря. Таблица правится в одном
# месте; неизвестный тип не ломает импорт, просто попадает в 'task'.
TASK_TYPE_MAP = {
    "call":    ("call",    "#3b82f6"),
    "звонок":  ("call",    "#3b82f6"),
    "measure": ("measure", "#22c55e"),
    "замер":   ("measure", "#22c55e"),
    "install": ("install", "#f59e0b"),
    "монтаж":  ("install", "#f59e0b"),
    "meeting": ("task",    "#a855f7"),
}


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


def apply_task(conn, account_id, envelope, item, default_lead=None, client_id=None):
    ext_id = str(item.get("id") or envelope.get("entity_id") or "")
    if not ext_id:
        raise ValueError("нет task.id")

    lead_ext = str(item.get("lead_id") or default_lead or "") or None
    if client_id is None:
        client_id = _resolve_client(conn, account_id, lead_ext)

    completed = to_bool(item.get("completed"), False)
    deleted = to_bool(item.get("deleted"), False)
    due_at = parse_dt(item.get("due_at"))

    with conn.cursor() as c:
        c.execute(
            f"""INSERT INTO {SCHEMA}.leakad_tasks
                    (account_id, external_id, lead_ext_id, client_id, task_type, text,
                     responsible_ext_id, due_at, completed, completed_at,
                     occurred_at, updated_at, is_removed, raw_snapshot)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (account_id, external_id) DO UPDATE SET
                    lead_ext_id = COALESCE(EXCLUDED.lead_ext_id, {SCHEMA}.leakad_tasks.lead_ext_id),
                    client_id   = COALESCE(EXCLUDED.client_id, {SCHEMA}.leakad_tasks.client_id),
                    task_type=EXCLUDED.task_type, text=EXCLUDED.text,
                    responsible_ext_id=EXCLUDED.responsible_ext_id, due_at=EXCLUDED.due_at,
                    completed=EXCLUDED.completed, completed_at=EXCLUDED.completed_at,
                    updated_at=EXCLUDED.updated_at, is_removed=EXCLUDED.is_removed,
                    raw_snapshot=EXCLUDED.raw_snapshot
                RETURNING id, calendar_event_id""",
            (account_id or "-", ext_id, lead_ext, client_id, item.get("type"),
             clip(item.get("text"), 2000), item.get("responsible_user_id"), due_at,
             completed, parse_dt(item.get("completed_at")),
             parse_dt(item.get("created_at")), parse_dt(item.get("updated_at")), deleted,
             json.dumps(item.get("raw_snapshot") or item, ensure_ascii=False)),
        )
        row = c.fetchone()
    conn.commit()

    _sync_calendar(conn, row[0], row[1], client_id, item, due_at, completed, deleted)

    store.upsert_entity(
        conn, account_id, "task", ext_id,
        internal_id=row[0], internal_table="leakad_tasks", parent_lead=lead_ext,
        entity_updated_at=parse_dt(item.get("updated_at")) or due_at,
        sequence_no=envelope.get("sequence"), is_removed=deleted,
        data=item, raw_snapshot=item.get("raw_snapshot") or item,
    )
    return row[0], ("deleted" if deleted else ("completed" if completed else "ok"))


def _sync_calendar(conn, task_row_id, event_id, client_id, item, due_at, completed, deleted):
    """Зеркало задачи в календаре. Завершённая/удалённая задача событие убирает."""
    try:
        with conn.cursor() as c:
            if deleted or completed or not due_at:
                if event_id:
                    c.execute(f"DELETE FROM {SCHEMA}.calendar_events WHERE id=%s", (event_id,))
                    c.execute(f"UPDATE {SCHEMA}.leakad_tasks SET calendar_event_id=NULL WHERE id=%s",
                              (task_row_id,))
                conn.commit()
                return

            ev_type, color = TASK_TYPE_MAP.get(str(item.get("type") or "").lower(), ("task", "#64748b"))
            title = clip(item.get("text") or "Задача из LeakAD", 200)
            company_id = None
            if client_id:
                c.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (client_id,))
                r = c.fetchone()
                company_id = r[0] if r else None

            if event_id:
                c.execute(
                    f"""UPDATE {SCHEMA}.calendar_events
                        SET title=%s, event_type=%s, start_time=%s, color=%s WHERE id=%s""",
                    (title, ev_type, due_at, color, event_id))
            else:
                c.execute(
                    f"""INSERT INTO {SCHEMA}.calendar_events
                            (client_id, title, description, event_type, start_time, color, company_id)
                        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (client_id, title, "Синхронизировано из LeakAD", ev_type, due_at, color, company_id))
                new_ev = c.fetchone()
                c.execute(f"UPDATE {SCHEMA}.leakad_tasks SET calendar_event_id=%s WHERE id=%s",
                          (new_ev[0], task_row_id))
        conn.commit()
    except Exception as exc:
        print(f"[leakad-sync] calendar sync failed: {type(exc).__name__}: {exc}")
        conn.rollback()
