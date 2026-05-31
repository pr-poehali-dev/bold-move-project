import json, os, hashlib, psycopg2

SCHEMA = os.environ.get("DB_SCHEMA", "t_p45929761_bold_move_project")

BUSINESS_ROLES   = ("installer", "company")
DISCOUNT_ROLES   = ("designer", "foreman")
DEFAULT_DISCOUNT = 10
TRIAL_ESTIMATES  = 10
TRIAL_DAYS       = 10
MASTER_EMAIL     = "19.jeka.94@gmail.com"

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def ok(data, extra_headers=None):
    h = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    if extra_headers:
        h.update(extra_headers)
    return {"statusCode": 200, "headers": h, "body": json.dumps(data, ensure_ascii=False)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}, "body": json.dumps({"error": msg})}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def check_is_master(token: str, cur, schema: str) -> bool:
    cur.execute(f"""
        SELECT u.email FROM {schema}.user_sessions s
        JOIN {schema}.users u ON u.id = s.user_id
        WHERE s.token=%s AND s.expires_at > NOW()
    """, (token,))
    row = cur.fetchone()
    if row and row[0] == MASTER_EMAIL:
        return True
    cur.execute(f"""
        SELECT m.email FROM {schema}.wl_managers m
        JOIN {schema}.wl_manager_sessions s ON s.manager_id = m.id
        WHERE s.token=%s AND s.expires_at > NOW() AND m.approved = TRUE
          AND (m.email = '{MASTER_EMAIL}' OR m.wl_role = 'master_manager')
    """, (token,))
    return bool(cur.fetchone())
