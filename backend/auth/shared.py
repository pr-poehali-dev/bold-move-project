import json, os, hashlib, psycopg2, bcrypt

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
    """Хеширует пароль современным способом (bcrypt) — используется для НОВЫХ паролей."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def _legacy_sha256(password: str) -> str:
    """Старый способ хеширования (SHA-256 без соли) — оставлен только для сверки
    с уже существующими в БД хешами старых паролей (обратная совместимость)."""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, stored_hash: str) -> bool:
    """Проверяет пароль против хеша из БД. Понимает оба формата:
    - новый bcrypt-хеш (начинается с $2)
    - старый SHA-256 хеш (обратная совместимость со старыми аккаунтами)."""
    if not stored_hash:
        return False
    if stored_hash.startswith("$2"):
        try:
            return bcrypt.checkpw(password.encode(), stored_hash.encode())
        except ValueError:
            return False
    return stored_hash == _legacy_sha256(password)

def needs_rehash(stored_hash: str) -> bool:
    """True, если хеш ещё старого формата (SHA-256) и его пора обновить до bcrypt."""
    return bool(stored_hash) and not stored_hash.startswith("$2")

def hash_code(code: str) -> str:
    """Детерминированный хеш для короткоживущих кодов подтверждения (не паролей
    пользователя) — тут нужна возможность точного сравнения по значению, поэтому
    bcrypt не подходит (у него каждый раз новая соль)."""
    return _legacy_sha256(code)

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