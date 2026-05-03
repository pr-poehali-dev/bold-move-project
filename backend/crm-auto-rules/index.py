import json, os
import psycopg2

SCHEMA = os.environ.get("DB_SCHEMA", "t_p45929761_bold_move_project")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}

DEFAULT_RULES = [
    {"key": "measure_cost",  "label": "Замер",      "row_type": "cost",   "sort_order": 1, "is_default": True},
    {"key": "install_cost",  "label": "Монтаж",     "row_type": "cost",   "sort_order": 2, "is_default": True},
    {"key": "prepayment",    "label": "Предоплата", "row_type": "income", "sort_order": 1, "is_default": True},
    {"key": "extra_payment", "label": "Доплата",    "row_type": "income", "sort_order": 2, "is_default": True},
]

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg}, ensure_ascii=False)}

def get_company_id(event):
    """Получить company_id из токена"""
    token = (event.get("headers") or {}).get("X-Authorization", "")
    if token.startswith("Bearer "):
        token = token[7:]
    if not token:
        return None
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
        return None
    uid, uemail, urole, ucompany_id = row
    if uemail == "19.jeka.94@gmail.com":
        return 0  # мастер — company_id=0 (общие правила)
    if urole == "manager" and ucompany_id:
        return ucompany_id
    return uid

def ensure_defaults(cur, company_id):
    """Добавить дефолтные правила если их нет у компании"""
    for r in DEFAULT_RULES:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.auto_rules_v2 (company_id, key, label, row_type, sort_order, is_default)
            VALUES ({company_id}, '{r["key"]}', '{r["label"]}', '{r["row_type"]}', {r["sort_order"]}, true)
            ON CONFLICT (company_id, key) DO NOTHING
        """)

def handler(event: dict, context) -> dict:
    """Управление правилами авто-расчёта расходов и доходов по компании"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    company_id = get_company_id(event)
    if company_id is None:
        return err("Unauthorized", 401)

    method = event.get("httpMethod", "GET")

    # GET — загрузить правила
    if method == "GET":
        conn = get_conn()
        cur = conn.cursor()
        ensure_defaults(cur, company_id)
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

    # POST — сохранить правила
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        rules = body.get("rules", [])
        auto_mode = body.get("auto_mode", False)

        conn = get_conn()
        cur = conn.cursor()

        # Сохраняем auto_mode
        cur.execute(f"""
            INSERT INTO {SCHEMA}.auto_rules_settings (company_id, auto_mode)
            VALUES ({company_id}, {'true' if auto_mode else 'false'})
            ON CONFLICT (company_id) DO UPDATE SET auto_mode = EXCLUDED.auto_mode, updated_at = NOW()
        """)

        # Удаляем кастомные (не дефолтные) правила и перезаписываем
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
