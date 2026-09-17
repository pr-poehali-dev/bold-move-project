"""lead.* и contact.* — заявки и контакты.

Одна заявка LeakAD = одна карточка live_chats. Связь держится по постоянному
lead_id (колонка live_chats.leakad_lead_id + реестр leakad_entities), поэтому
повторная доставка события обновляет ту же карточку, а не плодит дубли.

Полный исходный объект всегда сохраняется в leakad_entities.raw_snapshot —
даже те поля, которые внутренняя CRM пока не умеет показывать, не теряются.
"""

import json

from shared import BatchMode, SCHEMA, clip, normalize_phone, parse_dt, pick, to_bool, to_num
from . import store


# Поля карточки, которые мы умеем заполнять из события LeakAD.
# Список — единственное место, где задаётся соответствие: добавить поле =
# добавить строку сюда, ничего больше менять не нужно.
def build_card_fields(conn, data: dict) -> dict:
    lead = data.get("lead") or {}
    contact = data.get("contact") or {}
    order = data.get("order") or {}
    finance = data.get("finance") or {}

    phones = contact.get("phones") or []
    primary_phone = ""
    for ph in phones:
        if isinstance(ph, dict) and ph.get("primary"):
            primary_phone = normalize_phone(pick(ph, "normalized", "value"))
            break
    if not primary_phone and phones:
        first = phones[0]
        primary_phone = normalize_phone(pick(first, "normalized", "value") if isinstance(first, dict) else first)
    if not primary_phone:
        primary_phone = normalize_phone(pick(data, "phone", "телефон") or pick(contact, "phone"))

    status, substatus = store.map_status(
        conn, lead.get("status_id"), lead.get("status_name"), lead.get("status"),
        lead.get("sub_status_id"),
    )

    # Комментарии карточки: клиентский и менеджерский разнесены по своим полям,
    # чтобы не склеивать разные по смыслу тексты в одну кашу.
    fields = {
        "client_name": clip(pick(contact, "name") or pick(lead, "name") or "Заявка LeakAD", 300),
        "phone": primary_phone,
        "address": clip(pick(order, "address") or pick(order, "city"), 500),
        "area": to_num(pick(order, "area_m2", "area")),
        "notes": clip(pick(order, "customer_comment")),
        "comment_client": clip(pick(order, "customer_comment")),
        "comment_order": clip(pick(order, "manager_comment")),
        "cancel_reason": clip(pick(order, "cancel_reason"), 1000),
        "budget": to_num(finance.get("budget")),
        "contract_sum": to_num(finance.get("contract_sum")),
        "discount_pct": to_num(finance.get("discount_percent")),
        "discount_amount": to_num(finance.get("discount_amount")),
        "prepayment": to_num(finance.get("prepayment_planned")),
        "prepayment_fact": to_num(finance.get("prepayment_paid")),
        "extra_payment": to_num(finance.get("extra_payment_planned")),
        "extra_payment_fact": to_num(finance.get("extra_payment_paid")),
        "material_cost": to_num(finance.get("material_cost")),
        "measure_cost": to_num(finance.get("measure_cost")),
        "install_cost": to_num(finance.get("install_cost")),
        "management_cost": to_num(finance.get("management_cost")),
        "measure_date": parse_dt(pick(order, "measure_at")),
        "install_date": parse_dt(pick(order, "install_at")),
        "desired_measure_date": parse_dt(pick(order, "desired_measure_at")),
        "desired_install_date": parse_dt(pick(order, "desired_install_at")),
        "created_at": parse_dt(lead.get("created_at")),
        "updated_at": parse_dt(lead.get("updated_at")),
        "closed_at": parse_dt(lead.get("closed_at")),
        "leakad_lead_id": str(lead.get("id")) if lead.get("id") else None,
    }
    if status:
        fields["status"] = status
    if substatus:
        fields["sub_status"] = substatus

    tags = lead.get("tags")
    if isinstance(tags, list) and tags:
        fields["tags"] = [str(t) for t in tags]

    # Источник: берём человекочитаемое имя из LeakAD, иначе фиксируем «Квиз»
    # (исторически все заявки с leakad.ru шли именно туда).
    fields["source"] = clip(pick(lead, "source_name", "source_id") or "Квиз", 200)
    return {k: v for k, v in fields.items() if v is not None}


def _card_by_lead(conn, account_id, lead_ext_id):
    """Ищем карточку одним запросом: по реестру внешних ID и, как страховка,
    по колонке live_chats.leakad_lead_id (если запись реестра была потеряна).
    Один поход в БД вместо двух — на импорте истории это заметная разница."""
    with conn.cursor() as c:
        c.execute(
            f"""SELECT e.internal_id, e.entity_updated_at, e.last_sequence,
                       e.is_removed, e.merged_into, e.data, lc.id
                FROM (SELECT 1) AS dummy
                LEFT JOIN {SCHEMA}.leakad_entities e
                       ON e.account_id=%s AND e.entity_type='lead' AND e.external_id=%s
                LEFT JOIN {SCHEMA}.live_chats lc
                       ON lc.leakad_lead_id=%s
                LIMIT 1""",
            (account_id or "-", str(lead_ext_id), str(lead_ext_id)),
        )
        row = c.fetchone()
    if not row:
        return None, None
    internal_id, upd, seq, removed, merged, data, card_id = row
    ent = None
    if internal_id is not None or upd is not None or seq is not None:
        ent = {"internal_id": internal_id, "entity_updated_at": upd,
               "last_sequence": seq, "is_removed": removed,
               "merged_into": merged, "data": data or {}}
    return (internal_id or card_id), ent


def apply_lead(conn, account_id, company_id, envelope, data):
    """Создаёт или обновляет карточку по ПОЛНОМУ снимку заявки.

    data — целиком объект из ТЗ (lead/contact/order/finance/attribution/...).
    Возвращает (internal_id, action), где action = created | updated | skipped_stale.
    """
    lead = data.get("lead") or {}
    lead_ext_id = str(lead.get("id") or envelope.get("entity_id") or "")
    if not lead_ext_id:
        raise ValueError("нет lead.id — заявку невозможно идентифицировать")

    existing_id, ent = _card_by_lead(conn, account_id, lead_ext_id)

    if store.is_stale(ent, lead.get("updated_at") or envelope.get("entity_updated_at"),
                      envelope.get("sequence")):
        return existing_id, "skipped_stale"

    fields = build_card_fields(conn, data)
    session_id = f"leakad_{lead_ext_id}"

    if existing_id:
        sets, vals = [], []
        for key, val in fields.items():
            if key in ("created_at", "updated_at"):
                # created_at не переписываем (дата создания в LeakAD неизменна),
                # updated_at выставляем отдельной строкой ниже — иначе Postgres
                # ругается на два присвоения одной колонке в UPDATE.
                continue
            sets.append(f"{key}=%s")
            vals.append(val)
        # updated_at берём из LeakAD (источник правды по времени изменения),
        # а если его не прислали — ставим текущее время.
        sets.append("updated_at=COALESCE(%s, NOW())")
        vals.append(fields.get("updated_at"))
        vals.append(existing_id)
        with conn.cursor() as c:
            c.execute(f"UPDATE {SCHEMA}.live_chats SET {', '.join(sets)} WHERE id=%s", vals)
        BatchMode.commit(conn)
        internal_id, action = existing_id, "updated"
    else:
        cols = ["session_id", "company_id", "created_via"] + list(fields.keys())
        vals = [session_id, company_id, "leakad_sync"] + list(fields.values())
        placeholders = ",".join(["%s"] * len(cols))
        with conn.cursor() as c:
            c.execute(
                f"""INSERT INTO {SCHEMA}.live_chats ({','.join(cols)})
                    VALUES ({placeholders})
                    ON CONFLICT (session_id) DO UPDATE SET updated_at=NOW()
                    RETURNING id""",
                vals,
            )
            row = c.fetchone()
        BatchMode.commit(conn)
        internal_id, action = (row[0] if row else None), "created"

    contact = data.get("contact") or {}
    contact_ext = str(contact.get("id")) if contact.get("id") else None

    store.upsert_entity(
        conn, account_id, "lead", lead_ext_id,
        internal_id=internal_id, internal_table="live_chats",
        parent_contact=contact_ext,
        entity_updated_at=parse_dt(lead.get("updated_at") or envelope.get("entity_updated_at")),
        sequence_no=envelope.get("sequence"),
        is_removed=to_bool(lead.get("deleted"), False),
        removed_at=parse_dt(lead.get("deleted_at")),
        data=data,
        raw_snapshot=data.get("raw_snapshot") or envelope.get("raw_snapshot") or data,
    )
    if contact_ext:
        apply_contact(conn, account_id, envelope, contact, lead_ext_id=lead_ext_id)

    # Вложенные коллекции полного снимка — чтобы одно событие lead.updated
    # восстанавливало карточку целиком, даже если отдельные события потерялись.
    from .comments import apply_comment
    from .tasks import apply_task
    from .files import apply_file

    for item in (data.get("comments") or []):
        try:
            apply_comment(conn, account_id, envelope, item, default_lead=lead_ext_id,
                          client_id=internal_id)
        except Exception as exc:
            print(f"[leakad-sync] nested comment failed: {type(exc).__name__}: {exc}")
    for item in (data.get("tasks") or []):
        try:
            apply_task(conn, account_id, envelope, item, default_lead=lead_ext_id,
                       client_id=internal_id)
        except Exception as exc:
            print(f"[leakad-sync] nested task failed: {type(exc).__name__}: {exc}")
    for item in (data.get("files") or []):
        try:
            apply_file(conn, account_id, envelope, item, default_lead=lead_ext_id,
                       client_id=internal_id)
        except Exception as exc:
            print(f"[leakad-sync] nested file failed: {type(exc).__name__}: {exc}")

    return internal_id, action


def soft_delete_lead(conn, account_id, envelope, data, restore=False):
    """Мягкое удаление / восстановление заявки. Физически ничего не стирается:
    карточка переводится в статус 'deleted' с сохранением прежнего статуса."""
    lead = data.get("lead") or data
    lead_ext_id = str(lead.get("id") or envelope.get("entity_id") or "")
    if not lead_ext_id:
        raise ValueError("нет lead.id")

    internal_id, ent = _card_by_lead(conn, account_id, lead_ext_id)
    if internal_id:
        with conn.cursor() as c:
            if restore:
                c.execute(
                    f"""UPDATE {SCHEMA}.live_chats
                        SET status = COALESCE(NULLIF(status_before_removal,''), 'new'),
                            removed_at = NULL, status_before_removal = NULL, updated_at = NOW()
                        WHERE id=%s""", (internal_id,))
            else:
                c.execute(
                    f"""UPDATE {SCHEMA}.live_chats
                        SET status_before_removal = COALESCE(status_before_removal, status),
                            status = 'deleted', removed_at = NOW(), updated_at = NOW()
                        WHERE id=%s""", (internal_id,))
        BatchMode.commit(conn)

    store.upsert_entity(
        conn, account_id, "lead", lead_ext_id,
        internal_id=internal_id, internal_table="live_chats",
        entity_updated_at=parse_dt(envelope.get("entity_updated_at")),
        sequence_no=envelope.get("sequence"),
        is_removed=not restore,
        removed_at=None if restore else parse_dt(lead.get("deleted_at")),
        data=data, raw_snapshot=data.get("raw_snapshot") or data,
        restored=restore,
    )
    return internal_id, ("restored" if restore else "deleted")


def apply_contact(conn, account_id, envelope, contact, lead_ext_id=None):
    """Контакт — самостоятельная сущность: у одного контакта может быть много
    заявок, у одного контакта — несколько телефонов и мессенджеров. Хранится
    целиком в реестре, в карточку попадает только основной телефон и имя."""
    contact_ext = str(contact.get("id") or envelope.get("entity_id") or "")
    if not contact_ext:
        raise ValueError("нет contact.id")

    ent = store.get_entity(conn, account_id, "contact", contact_ext)
    if store.is_stale(ent, contact.get("updated_at") or envelope.get("entity_updated_at"),
                      envelope.get("sequence")):
        return None, "skipped_stale"

    store.upsert_entity(
        conn, account_id, "contact", contact_ext,
        internal_table="leakad_entities",
        parent_lead=lead_ext_id,
        entity_updated_at=parse_dt(contact.get("updated_at") or envelope.get("entity_updated_at")),
        sequence_no=envelope.get("sequence"),
        is_removed=to_bool(contact.get("deleted"), False),
        removed_at=parse_dt(contact.get("deleted_at")),
        data=contact, raw_snapshot=contact.get("raw_snapshot") or contact,
    )

    # Обновляем имя/телефон во всех связанных карточках, чтобы правка контакта
    # в LeakAD немедленно отражалась в CRM.
    phones = contact.get("phones") or []
    primary = ""
    for ph in phones:
        if isinstance(ph, dict) and ph.get("primary"):
            primary = normalize_phone(pick(ph, "normalized", "value"))
            break
    if not primary and phones:
        first = phones[0]
        primary = normalize_phone(pick(first, "normalized", "value") if isinstance(first, dict) else first)

    name = clip(contact.get("name"), 300)
    if primary or name:
        with conn.cursor() as c:
            c.execute(
                f"""UPDATE {SCHEMA}.live_chats lc
                    SET phone = COALESCE(NULLIF(%s,''), lc.phone),
                        client_name = COALESCE(%s, lc.client_name),
                        updated_at = NOW()
                    FROM {SCHEMA}.leakad_entities e
                    WHERE e.account_id=%s AND e.entity_type='lead'
                      AND e.parent_contact_ext=%s AND e.internal_id = lc.id""",
                (primary, name, account_id or "-", contact_ext),
            )
        BatchMode.commit(conn)
    return None, "ok"


def merge_contacts(conn, account_id, envelope, data):
    """contact.merged — все заявки/комментарии/файлы источников переезжают
    на целевой контакт, источники помечаются merged_into."""
    target = str(data.get("target_contact_id") or "")
    sources = [str(s) for s in (data.get("source_contact_ids") or []) if s]
    if not target or not sources:
        raise ValueError("contact.merged без target_contact_id/source_contact_ids")

    with conn.cursor() as c:
        c.execute(
            f"""UPDATE {SCHEMA}.leakad_entities
                SET parent_contact_ext=%s, updated_at=NOW()
                WHERE account_id=%s AND parent_contact_ext = ANY(%s)""",
            (target, account_id or "-", sources),
        )
        c.execute(
            f"""UPDATE {SCHEMA}.leakad_comments
                SET contact_ext_id=%s WHERE account_id=%s AND contact_ext_id = ANY(%s)""",
            (target, account_id or "-", sources),
        )
        for src in sources:
            c.execute(
                f"""UPDATE {SCHEMA}.leakad_entities
                    SET merged_into=%s, is_removed=TRUE, updated_at=NOW()
                    WHERE account_id=%s AND entity_type='contact' AND external_id=%s""",
                (target, account_id or "-", src),
            )
    BatchMode.commit(conn)
    return None, "merged"