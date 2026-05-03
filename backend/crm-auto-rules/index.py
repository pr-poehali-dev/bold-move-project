import json, os
import psycopg2

SCHEMA = os.environ.get("DB_SCHEMA", "t_p45929761_bold_move_project")
MASTER_EMAIL = "19.jeka.94@gmail.com"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}

# Структура правил по умолчанию (если в default_auto_rules ничего нет)
FALLBACK_RULES = [
    {"key": "measure_cost",   "label": "Замер",         "row_type": "cost",   "sort_order": 1, "enabled": False, "visible": True},
    {"key": "install_cost",   "label": "Монтаж",        "row_type": "cost",   "sort_order": 2, "enabled": False, "visible": True},
    {"key": "manager_cost",   "label": "Менеджер",      "row_type": "cost",   "sort_order": 3, "enabled": False, "visible": True},
    {"key": "technolog_cost", "label": "Технолог",      "row_type": "cost",   "sort_order": 4, "enabled": False, "visible": True},
    {"key": "ads_cost",       "label": "Реклама (CAC)", "row_type": "cost",   "sort_order": 5, "enabled": False, "visible": True},
    {"key": "other_cost",     "label": "Другое",        "row_type": "cost",   "sort_order": 6, "enabled": False, "visible": True},
    {"key": "prepayment",     "label": "Предоплата",    "row_type": "income", "sort_order": 1, "enabled": True,  "visible": True},
    {"key": "extra_payment",  "label": "Доплата",       "row_type": "income", "sort_order": 2, "enabled": True,  "visible": True},
]

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg}, ensure_ascii=False)}

def get_session(event):
    """Получить данные сессии из токена. Возвращает (company_id, role, is_master)"""
    token = (event.get("headers") or {}).get("X-Authorization", "")
    if token.startswith("Bearer "):
        token = token[7:]
    if not token:
        return None, None, False
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT u.id, u.email, u.role, u.company_id
        FROM {SCHEMA}.user_sessions s
        JOIN {SCHEMA}.users u ON u.id = s.user_id
        WHERE s.token='{token}' AND s.expires_at > NOW()
    """)
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None, None, False
    uid, uemail, urole, ucompany_id = row
    if uemail == MASTER_EMAIL:
        return 0, "master", True
    if urole == "manager" and ucompany_id:
        # Менеджер — берём роль владельца компании
        conn2 = get_conn()
        cur2 = conn2.cursor()
        cur2.execute(f"SELECT role FROM {SCHEMA}.users WHERE id = {ucompany_id}")
        owner = cur2.fetchone()
        cur2.close()
        conn2.close()
        owner_role = owner[0] if owner else "company"
        return ucompany_id, owner_role, False
    return uid, urole, False

def get_defaults_for_role(cur, role):
    """Получить дефолтные правила для роли из БД"""
    cur.execute(f"""
        SELECT key, label, pct, enabled, visible, row_type, sort_order
        FROM {SCHEMA}.default_auto_rules
        WHERE role = '{role}'
        ORDER BY row_type, sort_order
    """)
    rows = cur.fetchall()
    if rows:
        return [{"key": r[0], "label": r[1], "pct": float(r[2]) if r[2] is not None else None,
                 "enabled": r[3], "visible": r[4], "row_type": r[5], "sort_order": r[6]} for r in rows]
    # Фоллбэк если для роли нет записей
    return FALLBACK_RULES

def ensure_defaults(cur, company_id, role):
    """Добавить дефолтные правила если их нет у компании (по роли)"""
    defaults = get_defaults_for_role(cur, role)
    for r in defaults:
        pct_val = str(r["pct"]) if r.get("pct") is not None else "NULL"
        enabled = "true" if r.get("enabled", False) else "false"
        visible = "true" if r.get("visible", True) else "false"
        cur.execute(f"""
            INSERT INTO {SCHEMA}.auto_rules_v2 (company_id, key, label, pct, row_type, sort_order, is_default, enabled, visible)
            VALUES ({company_id}, '{r["key"]}', '{r["label"]}', {pct_val}, '{r["row_type"]}', {r["sort_order"]}, true, {enabled}, {visible})
            ON CONFLICT (company_id, key) DO NOTHING
        """)

def handler(event: dict, context) -> dict:
    """Управление правилами авто-расчёта расходов и доходов по компании + дефолты по ролям для мастера"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    company_id, role, is_master = get_session(event)
    if company_id is None:
        return err("Unauthorized", 401)

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    resource = qs.get("r", "rules")  # rules | defaults

    # ── УПРАВЛЕНИЕ ДЕФОЛТАМИ ПО РОЛЯМ (только мастер) ─────────────────────
    if resource == "defaults":
        if not is_master:
            return err("Forbidden", 403)

        if method == "GET":
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(f"""
                SELECT role, key, label, pct, enabled, visible, row_type, sort_order
                FROM {SCHEMA}.default_auto_rules
                ORDER BY role, row_type, sort_order
            """)
            rows = cur.fetchall()
            cur.close()
            conn.close()
            result = {}
            for r in rows:
                role_key = r[0]
                if role_key not in result:
                    result[role_key] = []
                result[role_key].append({
                    "key": r[1], "label": r[2],
                    "pct": float(r[3]) if r[3] is not None else None,
                    "enabled": r[4], "visible": r[5],
                    "row_type": r[6], "sort_order": r[7],
                })
            return ok(result)

        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            target_role = body.get("role", "")
            rules = body.get("rules", [])
            if not target_role:
                return err("role required")
            conn = get_conn()
            cur = conn.cursor()
            for i, r in enumerate(rules):
                key = r.get("key", "").replace("'", "''")
                label = r.get("label", "").replace("'", "''")
                pct = r.get("pct")
                pct_val = str(pct) if pct is not None else "NULL"
                enabled = "true" if r.get("enabled", False) else "false"
                visible = "true" if r.get("visible", True) else "false"
                row_type = r.get("row_type", "cost")
                sort_order = r.get("sort_order", i)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.default_auto_rules (role, key, label, pct, enabled, visible, row_type, sort_order)
                    VALUES ('{target_role}', '{key}', '{label}', {pct_val}, {enabled}, {visible}, '{row_type}', {sort_order})
                    ON CONFLICT (role, key) DO UPDATE SET
                        label = EXCLUDED.label,
                        pct = EXCLUDED.pct,
                        enabled = EXCLUDED.enabled,
                        visible = EXCLUDED.visible,
                        sort_order = EXCLUDED.sort_order,
                        updated_at = NOW()
                """)
            conn.commit()
            cur.close()
            conn.close()
            return ok({"ok": True})

    # ── ПРАВИЛА КОМПАНИИ ────────────────────────────────────────────────────

    # GET — загрузить правила компании
    if method == "GET":
        conn = get_conn()
        cur = conn.cursor()
        ensure_defaults(cur, company_id, role)
        conn.commit()

        cur.execute(f"""
            SELECT key, label, pct, enabled, visible, row_type, sort_order, is_default
            FROM {SCHEMA}.auto_rules_v2
            WHERE company_id = {company_id}
            ORDER BY row_type, sort_order, id
        """)
        rows = cur.fetchall()

        cur.execute(f"""
            SELECT auto_mode FROM {SCHEMA}.auto_rules_settings
            WHERE company_id = {company_id}
        """)
        settings = cur.fetchone()
        cur.close()
        conn.close()

        rules = [
            {"key": r[0], "label": r[1], "pct": float(r[2]) if r[2] is not None else None,
             "enabled": r[3], "visible": r[4], "row_type": r[5],
             "sort_order": r[6], "is_default": r[7]}
            for r in rows
        ]
        return ok({"rules": rules, "auto_mode": settings[0] if settings else False})

    # POST — сохранить правила компании
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        rules = body.get("rules", [])
        auto_mode = body.get("auto_mode", False)

        conn = get_conn()
        cur = conn.cursor()

        cur.execute(f"""
            INSERT INTO {SCHEMA}.auto_rules_settings (company_id, auto_mode)
            VALUES ({company_id}, {'true' if auto_mode else 'false'})
            ON CONFLICT (company_id) DO UPDATE SET auto_mode = EXCLUDED.auto_mode, updated_at = NOW()
        """)

        cur.execute(f"""
            DELETE FROM {SCHEMA}.auto_rules_v2
            WHERE company_id = {company_id} AND is_default = false
        """)

        for i, r in enumerate(rules):
            key = r.get("key", "").replace("'", "''")
            label = r.get("label", "").replace("'", "''")
            pct = r.get("pct")
            pct_val = str(pct) if pct is not None else "NULL"
            enabled = "true" if r.get("enabled", True) else "false"
            visible = "true" if r.get("visible", True) else "false"
            row_type = r.get("row_type", "cost").replace("'", "''")
            sort_order = r.get("sort_order", i)
            is_default = "true" if r.get("is_default", False) else "false"

            cur.execute(f"""
                INSERT INTO {SCHEMA}.auto_rules_v2 (company_id, key, label, pct, enabled, visible, row_type, sort_order, is_default)
                VALUES ({company_id}, '{key}', '{label}', {pct_val}, {enabled}, {visible}, '{row_type}', {sort_order}, {is_default})
                ON CONFLICT (company_id, key) DO UPDATE SET
                    label = EXCLUDED.label,
                    pct = EXCLUDED.pct,
                    enabled = EXCLUDED.enabled,
                    visible = EXCLUDED.visible,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = NOW()
            """)

        conn.commit()
        cur.close()
        conn.close()
        return ok({"ok": True})

    return err("Method not allowed", 405)
