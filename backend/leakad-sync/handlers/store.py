"""Реестр внешних ID и журнал событий.

Ключевая идея: любая сущность LeakAD живёт в таблице leakad_entities под своим
ПОСТОЯННЫМ внешним ID. Телефон/имя/текст идентификаторами не считаются.
Благодаря этому повторная доставка события не создаёт дубль, а устаревшее
событие не перезатирает более свежую версию карточки.
"""

import json
from datetime import datetime, timezone

from shared import BatchMode, SCHEMA, record_hash, parse_dt


# ── Журнал событий (идемпотентность, DLQ, восстановление по sequence) ────────

def find_event(conn, account_id, event_id):
    """Уже принятое событие с таким event_id (или None)."""
    with conn.cursor() as c:
        c.execute(
            f"""SELECT id, outcome, internal_entity_id, body_sha256, attempts
                FROM {SCHEMA}.leakad_events
                WHERE COALESCE(account_id,'-')=COALESCE(%s,'-') AND event_id=%s""",
            (account_id, event_id),
        )
        row = c.fetchone()
    if not row:
        return None
    return {"id": row[0], "outcome": row[1], "internal_entity_id": row[2],
            "body_sha256": row[3], "attempts": row[4]}


def bump_attempt(conn, row_id):
    with conn.cursor() as c:
        c.execute(f"UPDATE {SCHEMA}.leakad_events SET attempts = attempts + 1 WHERE id=%s", (row_id,))
    BatchMode.commit(conn)


def log_event(conn, envelope, raw_sha, payload):
    """Пишет событие в журнал ДО обработки: даже если обработка упадёт,
    событие останется видимым и его можно будет проиграть заново."""
    with conn.cursor() as c:
        c.execute(
            f"""INSERT INTO {SCHEMA}.leakad_events
                    (event_id, account_id, event_type, event_version, transaction_id,
                     entity_type, entity_id, entity_updated_at, sequence_no,
                     occurred_at, sent_at, body_sha256, payload, outcome)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending')
                RETURNING id""",
            (envelope["event_id"], envelope.get("account_id"), envelope.get("event_type"),
             envelope.get("event_version"), envelope.get("transaction_id"),
             envelope.get("entity_type"), envelope.get("entity_id"),
             envelope.get("entity_updated_at"), envelope.get("sequence"),
             envelope.get("occurred_at"), envelope.get("sent_at"), raw_sha,
             json.dumps(payload, ensure_ascii=False)),
        )
        row_id = c.fetchone()[0]
    BatchMode.commit(conn)
    return row_id


def finish_event(conn, row_id, outcome, http_status=None, internal_entity_id=None, error=None):
    if not row_id:
        return
    try:
        with conn.cursor() as c:
            c.execute(
                f"""UPDATE {SCHEMA}.leakad_events
                    SET outcome=%s, http_status=%s, internal_entity_id=%s,
                        error=%s, processed_at=NOW()
                    WHERE id=%s""",
                (outcome, http_status, internal_entity_id, error, row_id),
            )
        BatchMode.commit(conn)
    except Exception as exc:                                  # журнал не должен ронять приём
        print(f"[leakad-sync] finish_event failed: {type(exc).__name__}: {exc}")
        conn.rollback()


def sequence_gaps(conn, account_id, limit=200):
    """Разрывы в нумерации sequence — по ним запрашивают недостающие события."""
    with conn.cursor() as c:
        c.execute(
            f"""SELECT sequence_no FROM {SCHEMA}.leakad_events
                WHERE COALESCE(account_id,'-')=COALESCE(%s,'-') AND sequence_no IS NOT NULL
                ORDER BY sequence_no""",
            (account_id,),
        )
        nums = [r[0] for r in c.fetchall()]
    gaps = []
    for prev, cur in zip(nums, nums[1:]):
        if cur > prev + 1:
            gaps.append({"after": prev, "before": cur, "missing_from": prev + 1, "missing_to": cur - 1})
            if len(gaps) >= limit:
                break
    return gaps


# ── Реестр сущностей ─────────────────────────────────────────────────────────

def get_entity(conn, account_id, entity_type, external_id):
    if not external_id:
        return None
    with conn.cursor() as c:
        c.execute(
            f"""SELECT id, internal_id, internal_table, entity_updated_at, last_sequence,
                       is_removed, merged_into, data
                FROM {SCHEMA}.leakad_entities
                WHERE account_id=%s AND entity_type=%s AND external_id=%s""",
            (account_id or "-", entity_type, str(external_id)),
        )
        row = c.fetchone()
    if not row:
        return None
    return {"id": row[0], "internal_id": row[1], "internal_table": row[2],
            "entity_updated_at": row[3], "last_sequence": row[4],
            "is_removed": row[5], "merged_into": row[6], "data": row[7] or {}}


def is_stale(existing, entity_updated_at, sequence_no):
    """True, если пришедшее событие СТАРЕЕ уже сохранённой версии.
    Такое событие применять нельзя — иначе откатим карточку назад."""
    if not existing:
        return False
    prev_dt = existing.get("entity_updated_at")
    new_dt = parse_dt(entity_updated_at)
    if prev_dt and new_dt and new_dt < prev_dt:
        return True
    prev_seq, new_seq = existing.get("last_sequence"), sequence_no
    if prev_seq is not None and new_seq is not None and new_seq < prev_seq:
        # Более старый sequence при совпадающих датах — тоже устаревшее событие.
        if not (prev_dt and new_dt and new_dt > prev_dt):
            return True
    return False


def upsert_entity(conn, account_id, entity_type, external_id, *,
                  internal_id=None, internal_table=None, parent_lead=None,
                  parent_contact=None, entity_updated_at=None, sequence_no=None,
                  is_removed=None, removed_at=None, merged_into=None,
                  data=None, raw_snapshot=None, restored=False):
    """Создаёт или обновляет запись реестра. Возвращает внутренний id сущности."""
    data = data or {}
    payload_hash = record_hash({"type": entity_type, "id": str(external_id), "data": data})
    restored_at = datetime.now(timezone.utc) if restored else None
    tbl = f"{SCHEMA}.leakad_entities"
    with conn.cursor() as c:
        c.execute(
            f"""INSERT INTO {tbl}
                    (account_id, entity_type, external_id, internal_id, internal_table,
                     parent_lead_ext, parent_contact_ext, entity_updated_at, last_sequence,
                     is_removed, removed_at, merged_into, data, raw_snapshot, record_sha256,
                     restored_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,
                        COALESCE(%s,FALSE),%s,%s,%s,%s,%s,%s,NOW())
                ON CONFLICT (account_id, entity_type, external_id) DO UPDATE SET
                    internal_id       = COALESCE(EXCLUDED.internal_id, {tbl}.internal_id),
                    internal_table    = COALESCE(EXCLUDED.internal_table, {tbl}.internal_table),
                    parent_lead_ext   = COALESCE(EXCLUDED.parent_lead_ext, {tbl}.parent_lead_ext),
                    parent_contact_ext= COALESCE(EXCLUDED.parent_contact_ext, {tbl}.parent_contact_ext),
                    entity_updated_at = COALESCE(EXCLUDED.entity_updated_at, {tbl}.entity_updated_at),
                    last_sequence     = CASE
                        WHEN EXCLUDED.last_sequence IS NULL THEN {tbl}.last_sequence
                        WHEN {tbl}.last_sequence IS NULL THEN EXCLUDED.last_sequence
                        ELSE GREATEST(EXCLUDED.last_sequence, {tbl}.last_sequence) END,
                    is_removed        = COALESCE(%s, {tbl}.is_removed),
                    removed_at        = COALESCE(EXCLUDED.removed_at, {tbl}.removed_at),
                    merged_into       = COALESCE(EXCLUDED.merged_into, {tbl}.merged_into),
                    data              = EXCLUDED.data,
                    raw_snapshot      = CASE WHEN EXCLUDED.raw_snapshot = '{{}}'::jsonb
                                             THEN {tbl}.raw_snapshot
                                             ELSE EXCLUDED.raw_snapshot END,
                    record_sha256     = EXCLUDED.record_sha256,
                    restored_at       = COALESCE(EXCLUDED.restored_at, {tbl}.restored_at),
                    updated_at        = NOW()
                RETURNING internal_id""",
            (account_id or "-", entity_type, str(external_id), internal_id, internal_table,
             parent_lead, parent_contact, entity_updated_at, sequence_no,
             is_removed, removed_at, merged_into,
             json.dumps(data, ensure_ascii=False),
             json.dumps(raw_snapshot or {}, ensure_ascii=False),
             payload_hash, restored_at,
             is_removed),
        )
        result = c.fetchone()
    BatchMode.commit(conn)
    return result[0] if result else None


def upsert_dictionary(conn, account_id, dict_type, item):
    """Справочник (воронки, статусы, сотрудники, источники, custom-fields...).
    Хранится целиком, чтобы можно было восстановить название и варианты значений."""
    ext_id = str(item.get("id") or item.get("external_id") or "")
    if not ext_id:
        return False
    with conn.cursor() as c:
        c.execute(
            f"""INSERT INTO {SCHEMA}.leakad_dictionaries
                    (account_id, dict_type, external_id, name, active, sort_order, is_removed, data, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                ON CONFLICT (account_id, dict_type, external_id) DO UPDATE SET
                    name=EXCLUDED.name, active=EXCLUDED.active, sort_order=EXCLUDED.sort_order,
                    is_removed=EXCLUDED.is_removed, data=EXCLUDED.data, updated_at=NOW()""",
            (account_id or "-", dict_type, ext_id,
             item.get("name"), bool(item.get("active", True)),
             int(item.get("sort_order") or 0), bool(item.get("deleted", False)),
             json.dumps(item, ensure_ascii=False)),
        )
    BatchMode.commit(conn)
    return True


# Таблица соответствия статусов меняется редко, а читается на каждую заявку.
# Держим её в памяти в пределах одного выполнения функции — при импорте
# истории это убирает тысячи одинаковых запросов к БД.
_STATUS_MAP_CACHE = {}


def reset_status_cache():
    _STATUS_MAP_CACHE.clear()


def map_status(conn, *args):
    """Статус LeakAD -> статус внутренней воронки по редактируемой таблице
    leakad_status_map. Проверяются по очереди status_id, status_name и т.д.
    Неизвестный статус НЕ роняет импорт — заявка останется в 'new',
    а сырое значение сохранится в raw_snapshot."""
    keys = [str(a).strip().lower() for a in args if a not in (None, "")]
    if not keys:
        return None, None

    if not _STATUS_MAP_CACHE:
        with conn.cursor() as c:
            c.execute(
                f"""SELECT lower(external_key), internal_status, internal_substatus
                    FROM {SCHEMA}.leakad_status_map""")
            for key, st, sub in c.fetchall():
                _STATUS_MAP_CACHE[key] = (st, sub)

    for key in keys:
        if key in _STATUS_MAP_CACHE:
            return _STATUS_MAP_CACHE[key]
    return None, None


def owner_company_id(conn, owner_email):
    with conn.cursor() as c:
        c.execute(f"SELECT id FROM {SCHEMA}.users WHERE email=%s", (owner_email,))
        row = c.fetchone()
    return row[0] if row else None


def integration_config(conn, company_id):
    if not company_id:
        return {}
    with conn.cursor() as c:
        c.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (company_id,))
        row = c.fetchone()
    return dict(row[0]) if row and row[0] else {}