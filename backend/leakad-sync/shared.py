"""Общие утилиты интеграции LeakAD -> внутренняя CRM.

Здесь только «инструменты»: подключение к БД, проверка подписи, нормализация
значений, канонический JSON и хеши. Никакой бизнес-логики — она в handlers/*,
чтобы любой обработчик события можно было добавить/убрать по отдельности.
"""

import hashlib
import hmac
import json
import os
import re
from datetime import datetime, timedelta, timezone

import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p45929761_bold_move_project")

# Владелец, в чью компанию попадают заявки LeakAD. Вынесен в переменную окружения,
# чтобы переключить получателя без правки кода.
OWNER_EMAIL = os.environ.get("LEAKAD_OWNER_EMAIL", "mospotolkipro@gmail.com")

# Максимальный возраст запроса (защита от replay-атаки), секунды. По ТЗ — 10 минут.
MAX_SIGNATURE_AGE = int(os.environ.get("LEAKAD_MAX_AGE", "600"))

# Максимальный размер тела запроса, байт (защита от переполнения).
MAX_BODY_BYTES = int(os.environ.get("LEAKAD_MAX_BODY", str(6 * 1024 * 1024)))

# Текущая поддерживаемая версия схемы события.
SUPPORTED_EVENT_VERSIONS = (1,)

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization, "
                                    "X-Webhook-Id, X-Webhook-Timestamp, X-Webhook-Signature",
    "Access-Control-Max-Age": "86400",
}

MOSCOW_TZ = timezone(timedelta(hours=3))


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def resp(status: int, payload: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **CORS},
        "body": json.dumps(payload, ensure_ascii=False, default=str),
        "isBase64Encoded": False,
    }


def ok(payload: dict) -> dict:
    return resp(200, payload)


def fail(status: int, message: str, event_id=None, extra=None) -> dict:
    """Ответ об ошибке. По ТЗ всегда содержит event_id, если его удалось прочитать."""
    payload = {"ok": False, "error": message}
    if event_id:
        payload["event_id"] = event_id
    if extra:
        payload.update(extra)
    return resp(status, payload)


def lower_headers(event: dict) -> dict:
    return {str(k).lower(): v for k, v in (event.get("headers") or {}).items()}


# ── Подпись ──────────────────────────────────────────────────────────────────

def verify_signature(secret: str, timestamp: str, raw_body: str, signature: str):
    """Проверяет HMAC-SHA256 по правилу ТЗ:
        signed_payload = timestamp + "." + RAW_HTTP_BODY
    Сравнение в постоянном времени. Возвращает (True, None) либо (False, причина).
    """
    if not secret:
        return False, "secret not configured"
    if not signature:
        return False, "missing X-Webhook-Signature"
    if not timestamp:
        return False, "missing X-Webhook-Timestamp"

    try:
        ts = int(str(timestamp).strip())
    except (TypeError, ValueError):
        return False, "bad X-Webhook-Timestamp"

    now = int(datetime.now(timezone.utc).timestamp())
    if abs(now - ts) > MAX_SIGNATURE_AGE:
        return False, "stale request"

    signed_payload = f"{ts}.{raw_body}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()

    # Принимаем и "v1=<hex>", и голый hex — чтобы не спорить с отправителем о формате.
    candidates = []
    for part in str(signature).split(","):
        part = part.strip()
        candidates.append(part[3:] if part.startswith("v1=") else part)

    for cand in candidates:
        if hmac.compare_digest(cand.lower(), expected):
            return True, None
    return False, "signature mismatch"


def body_sha256(raw_body: str) -> str:
    return hashlib.sha256((raw_body or "").encode("utf-8")).hexdigest()


# ── Канонизация и хеши для акта сверки ───────────────────────────────────────

def canonical_json(obj) -> str:
    """Канонический JSON: ключи отсортированы, без лишних пробелов, UTF-8 как есть.
    Именно по этому правилу считаются record-хеши и общий hash сущности."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def record_hash(obj) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


def collection_hash(record_hashes) -> str:
    """Общий hash коллекции = sha256 от отсортированных record-хешей, склеенных \n."""
    joined = "\n".join(sorted(h for h in record_hashes if h))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


# ── Нормализация значений ────────────────────────────────────────────────────

def normalize_phone(raw) -> str:
    """Приводит номер к +7XXXXXXXXXX. Возвращает '' если номер не распознан."""
    if not raw:
        return ""
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    if len(digits) == 11 and digits[0] in ("7", "8"):
        return "+7" + digits[1:]
    if len(digits) == 10:
        return "+7" + digits
    if digits:
        return "+" + digits
    return ""


def parse_dt(value):
    """ISO 8601 -> datetime с таймзоной. None, если разобрать нельзя.
    Понимает 'Z', смещения, миллисекунды и unix-timestamp числом."""
    if value in (None, "", False):
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d.%m.%Y %H:%M", "%d.%m.%Y"):
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def to_num(value):
    """Число из чего угодно разумного ('12 500,50' -> 12500.5). None если не число."""
    if value in (None, "", False):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace("\u00a0", "").replace(" ", "").replace(",", ".")
    text = re.sub(r"[^\d.\-]", "", text)
    if not text or text in ("-", ".", "-."):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "да", "y")


def pick(source: dict, *keys, default=None):
    """Первое непустое значение из набора возможных названий поля."""
    if not isinstance(source, dict):
        return default
    for key in keys:
        val = source.get(key)
        if val not in (None, "", []):
            return val
    return default


def clip(text, limit=4000):
    if text is None:
        return None
    text = str(text)
    return text if len(text) <= limit else text[:limit]
