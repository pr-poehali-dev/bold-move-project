# redeploy-marker: 1786609864
import json
import os
import re
import hashlib
import base64
import uuid
import time
import psycopg2
import boto3
import urllib.request as _ureq
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# redeploy-marker: tg-proxy switched to https relay domain


# ── Мост до api.telegram.org через собственный VPS ──────────────────────────
# api.telegram.org недоступен напрямую из окружения облачных функций (Telegram
# блокирует диапазоны IP облачных провайдеров) — подтверждено логами:
# "urlopen error timed out" даже с taймаутом 8 сек и валидным токеном. При этом
# с VPS-сервера (обычный IP, не облако) Telegram отвечает нормально. Поэтому
# запросы к Telegram идут не напрямую, а через лёгкий HTTP-мост на своём VPS
# (см. TG_PROXY_URL/TG_PROXY_TOKEN в секретах) — он просто пересылает запрос
# и возвращает ответ Telegram как есть. Если мост не настроен — используем
# прямой запрос как раньше (на случай если блокировка снимется или окружение сменится).
def tg_api_request(method_path, data=None, timeout=3, retries=3):
    """Запрос к Telegram Bot API (например 'bot123:ABC/getMe') через VPS-мост,
    если он настроен, иначе напрямую. Возвращает распарсенный JSON-ответ.

    DNS-резолвинг поддомена моста из окружения облачных функций оказался
    НЕСТАБИЛЬНЫМ (примерно 1 успешная попытка из 5 подряд, подтверждено серией
    ручных проверок) — сам мост при этом всегда доступен и отвечает мгновенно.
    Поэтому делаем несколько быстрых попыток подряд вместо одной с длинным
    таймаутом — суммарно укладываемся в тот же бюджет времени, но резко
    повышаем шанс на успех за счёт повторов."""
    proxy_url = os.environ.get("TG_PROXY_URL")
    proxy_token = os.environ.get("TG_PROXY_TOKEN")
    last_err = None
    for attempt in range(retries):
        try:
            if proxy_url:
                payload = json.dumps({"path": method_path, "data": data.decode() if data else None}).encode()
                req = _ureq.Request(f"{proxy_url.rstrip('/')}/relay", data=payload,
                                     headers={"Content-Type": "application/json", "X-Proxy-Token": proxy_token or ""},
                                     method="POST")
            else:
                # Fallback — прямой запрос (если мост не настроен)
                req = _ureq.Request(f"https://api.telegram.org/{method_path}", data=data,
                                     headers={"Content-Type": "application/json"},
                                     method="POST" if data else "GET")
            with _ureq.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last_err = e
            print(f"[tg_api_request] attempt {attempt+1}/{retries} failed: {type(e).__name__}: {e}")
    raise last_err


# ── Пуш-уведомление воркеру на VPS о новой задаче ────────────────────────────
# Раньше воркер САМ каждые несколько секунд спрашивал CRM "есть что-то новое?"
# (polling) — это давало постоянную фоновую нагрузку на лимит вызовов облачных
# функций, даже когда сообщений нет. Теперь CRM, наоборот, сама коротко
# "стучится" на воркер в момент появления новой задачи (см. WORKER_PUSH_URL в
# секретах — HTTP-приёмник на том же VPS, что и TG_PROXY_URL). Воркер, получив
# пуш, сразу забирает задачу через уже существующий worker-pending
# эндпоинт — редкий фоновый polling (раз в 5 минут)
# остаётся только как подстраховка на случай, если сеть моргнула и пуш не дошёл.
# Если пуш не удался — НЕ бросаем исключение наружу: задача уже лежит в БД
# со статусом pending и будет подобрана подстраховочным опросом чуть позже.
def notify_worker_push(reason: str, timeout=3):
    push_url = os.environ.get("WORKER_PUSH_URL")
    proxy_token = os.environ.get("TG_PROXY_TOKEN")
    if not push_url:
        return
    try:
        payload = json.dumps({"reason": reason}).encode()
        req = _ureq.Request(push_url, data=payload,
                             headers={"Content-Type": "application/json", "X-Proxy-Token": proxy_token or ""},
                             method="POST")
        _ureq.urlopen(req, timeout=timeout)
    except Exception as e:
        print(f"[worker-push] не удалось разбудить воркер ({reason}): {type(e).__name__}: {e}")


# ── Шифрование чувствительных данных интеграций (Avito Client Secret и т.п.) ──
# Ключ CRM_ENCRYPTION_KEY хранится в секретах проекта (не в БД). Любую строку
# приводим к валидному Fernet-ключу через SHA-256 -> base64 (32 байта).
def _fernet():
    from cryptography.fernet import Fernet
    raw = os.environ.get("CRM_ENCRYPTION_KEY", "")
    if not raw:
        return None
    key = base64.urlsafe_b64encode(hashlib.sha256(raw.encode()).digest())
    return Fernet(key)

def encrypt_secret(plain):
    """Шифрует строку. Возвращает 'enc:...' или сам текст, если ключа нет/пусто."""
    if not plain:
        return plain
    f = _fernet()
    if not f:
        return plain  # нет ключа шифрования — сохраняем как есть (fallback)
    return "enc:" + f.encrypt(plain.encode()).decode()

def decrypt_secret(stored):
    """Расшифровывает строку с префиксом 'enc:'. Обычный текст возвращает как есть."""
    if not stored or not isinstance(stored, str):
        return stored
    if not stored.startswith("enc:"):
        return stored  # старое незашифрованное значение — обратная совместимость
    f = _fernet()
    if not f:
        return ""
    try:
        return f.decrypt(stored[4:].encode()).decode()
    except Exception:
        return ""


# ── Avito Messenger API ──────────────────────────────────────────────────────
# Redirect URI для OAuth-входа владельца Avito-аккаунта (авторизует доступ
# к чтению/отправке сообщений — client_credentials этого НЕ даёт).
AVITO_REDIRECT_URI = "https://ai-potolki.ru/auth/avito/callback"


def avito_get_token(client_id, client_secret):
    """OAuth2 client_credentials -> access_token. Даёт доступ только к базовым
    методам (профиль и т.п.), БЕЗ прав на чтение/отправку сообщений Messenger —
    для этого нужен avito_oauth_exchange_code (authorization_code flow)."""
    if not client_id or not client_secret:
        return None, "нет client_id/client_secret"
    data = urllib_urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode()
    req = _ureq.Request("https://api.avito.ru/token", data=data,
                        headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    try:
        with _ureq.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read().decode())
        tok = resp.get("access_token")
        if not tok:
            return None, "Avito не вернул токен"
        return tok, None
    except Exception as e:
        return None, f"Avito auth: {str(e)[:200]}"


def avito_oauth_auth_url(client_id, state):
    """Формирует ссылку для входа владельца Avito-аккаунта (authorization_code flow).
    Только так Avito выдаёт токен с правами messenger:read/messenger:write."""
    from urllib.parse import urlencode
    params = {
        "response_type": "code",
        "client_id": client_id,
        "scope": "messenger:read,messenger:write",
        "state": state,
        "redirect_uri": AVITO_REDIRECT_URI,
    }
    return f"https://avito.ru/oauth?{urlencode(params)}"


def avito_oauth_exchange_code(code, client_id, client_secret):
    """Обменивает authorization code на access_token + refresh_token.
    Возвращает (dict{access_token, refresh_token, expires_in}, error)."""
    data = urllib_urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": AVITO_REDIRECT_URI,
    }).encode()
    req = _ureq.Request("https://api.avito.ru/token", data=data,
                        headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    try:
        with _ureq.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read().decode())
        if not resp.get("access_token"):
            return None, "Avito не вернул токен"
        return resp, None
    except Exception as e:
        return None, f"Avito oauth: {str(e)[:200]}"


def avito_oauth_refresh(refresh_token, client_id, client_secret):
    """Обновляет истёкший access_token по refresh_token."""
    data = urllib_urlencode({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode()
    req = _ureq.Request("https://api.avito.ru/token", data=data,
                        headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    try:
        with _ureq.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read().decode())
        if not resp.get("access_token"):
            return None, "Avito не вернул токен при обновлении"
        return resp, None
    except Exception as e:
        return None, f"Avito refresh: {str(e)[:200]}"


def avito_get_messenger_token(cur, conn, owner_id, cfg):
    """Возвращает рабочий токен для Messenger API (чтение/отправка сообщений).

    ВАЖНО (подтверждено диагностикой 29.07): для приложений типа «персональная
    авторизация» обычный client_credentials-токен (тот же, что используется для
    регистрации вебхука) УЖЕ даёт доступ к чтению и отправке сообщений мессенджера —
    отдельный OAuth-вход (authorization_code, кнопка «Подключить Avito» с редиректом
    на avito.ru) для таких приложений не требуется и не поддерживается (Avito
    отвечает «Что-то пошло не так» на странице /oauth).
    Раньше здесь была логика OAuth (access/refresh токены) — намеренно упрощено.
    Сигнатура и возврат (token, error) сохранены для обратной совместимости
    со всеми точками вызова.
    """
    client_id_a = cfg.get("avito_client_id")
    client_secret_a = decrypt_secret(cfg.get("avito_client_secret"))
    if not client_id_a or not client_secret_a:
        return None, "Avito не подключён — заполните Client ID и Client Secret в Интеграциях"
    return avito_get_token(client_id_a, client_secret_a)


def calc_unread(last_direction, last_at, last_read_at):
    """Есть ли непрочитанное: последнее событие входящее и новее момента прочтения.
    Даты в БД разного типа (одна с часовым поясом, другая без) — прямое сравнение
    вызывает ошибку и роняет весь список диалогов, поэтому приводим их к общему виду."""
    if last_direction != "in":
        return False
    if last_read_at is None:
        return True
    if last_at is None:
        return False
    return last_at.replace(tzinfo=None) > last_read_at.replace(tzinfo=None)


def avito_api_get(token, path):
    req = _ureq.Request(f"https://api.avito.ru{path}",
                        headers={"Authorization": f"Bearer {token}"}, method="GET")
    with _ureq.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def avito_fetch_client_name(token, avito_user_id, chat_id, our_user_id=None):
    """Возвращает имя собеседника (покупателя) из Avito-чата или None.
    avito_user_id — id аккаунта для формирования URL запроса.
    our_user_id — НАШ реальный id продавца (из конфига интеграции): именно его
    исключаем из участников, чтобы не подставить название собственного магазина.
    У Avito имя часто появляется не сразу — поэтому вызывается повторно, пока имя не получено."""
    try:
        chat_info = avito_api_get(token, f"/messenger/v2/accounts/{avito_user_id}/chats/{chat_id}")
        # Кого считаем «собой»: сначала сохранённый our_user_id, иначе — avito_user_id из вебхука
        self_ids = {str(x) for x in (our_user_id, avito_user_id) if x is not None}
        for u in (chat_info.get("users") or []):
            if str(u.get("id")) not in self_ids:
                name = (u.get("name") or "").strip()
                if name:
                    return name
        # Fallback: если так имя не нашли (например self_ids ошибочны) —
        # берём любого участника с непустым именем, кроме сохранённого our_user_id.
        if our_user_id is not None:
            for u in (chat_info.get("users") or []):
                if str(u.get("id")) != str(our_user_id):
                    name = (u.get("name") or "").strip()
                    if name:
                        return name
    except Exception as e:
        print(f"[avito] name fetch skipped: {str(e)[:200]}")
    return None


def avito_send_message(token, avito_user_id, chat_id, text):
    """Отправляет сообщение в Avito-чат. Возвращает (message_id, error)."""
    data = json.dumps({"message": {"text": text}, "type": "text"}).encode()
    req = _ureq.Request(
        f"https://api.avito.ru/messenger/v1/accounts/{avito_user_id}/chats/{chat_id}/messages",
        data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, method="POST")
    try:
        with _ureq.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read().decode())
        return resp.get("id"), None
    except Exception as e:
        return None, f"Avito send: {str(e)[:200]}"


def urllib_urlencode(d):
    from urllib.parse import urlencode
    return urlencode(d)


# ── UIS телефония ─────────────────────────────────────────────────────────────
# UIS шлёт вебхук с полями то вложенно, то плоско, а иногда вместо значения
# подставляет имя поля (если шаблон в личном кабинете настроен неверно) —
# такие «значения» нужно распознавать и считать пустыми.
UIS_FIELD_NAMES = {
    "contact_phone_number", "contact_phone", "phone", "call_session_id", "id",
    "external_id", "record_url", "wav_call_record_link", "record_link",
    "call_records", "file_link", "duration", "call_duration", "talk_duration",
    "is_lost", "employee_full_name", "virtual_phone_number",
}


def _uis_flatten(d, out=None):
    """Разворачивает вложенные словари UIS в один плоский словарь (последний
    встреченный ключ побеждает — вебхуки UIS редко дублируют имена полей)."""
    if out is None:
        out = {}
    if not isinstance(d, dict):
        return out
    for k, v in d.items():
        if isinstance(v, dict):
            _uis_flatten(v, out)
        else:
            out[k] = v
    return out


def _uis_clean(val):
    """UIS иногда вместо значения подставляет служебное имя поля. Такие
    'значения' считаем пустыми."""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s in UIS_FIELD_NAMES:
        return None
    return s


def _uis_pick(flat, keys):
    for k in keys:
        v = _uis_clean(flat.get(k))
        if v:
            return v
    return None


def uis_extract_call(body):
    """Извлекает нормализованные поля звонка из сырого тела вебхука UIS."""
    flat = _uis_flatten(body or {})

    phone = _uis_pick(flat, ["contact_phone_number", "contact_phone", "phone"])
    session_id = _uis_pick(flat, ["call_session_id", "id", "external_id"])

    record_url = flat.get("record_url") or flat.get("wav_call_record_link") \
        or flat.get("record_link") or flat.get("call_records") or flat.get("file_link")
    if isinstance(record_url, list) and record_url:
        record_url = record_url[0]
    record_url = _uis_clean(record_url)
    if record_url and not str(record_url).startswith("http"):
        record_url = f"https://app.uiscom.ru/system/media/talk/{record_url}/"

    duration = 0
    for k in ("duration", "call_duration", "talk_duration", "billsec"):
        v = _uis_clean(flat.get(k))
        if v is not None:
            try:
                duration = int(float(v))
                break
            except (TypeError, ValueError):
                continue

    is_lost = str(flat.get("is_lost") or "").strip().lower() in ("1", "true")
    status = "missed" if is_lost else (_uis_clean(flat.get("status")) or "completed")

    direction = (_uis_clean(flat.get("direction")) or "in").lower()
    direction = "out" if direction in ("out", "outbound", "outgoing") else "in"

    employee_name = _uis_clean(flat.get("employee_full_name") or flat.get("employee_name"))

    return {
        "phone": normalize_phone(phone) if phone else None,
        "session_id": session_id,
        "record_url": record_url,
        "duration": duration,
        "status": status,
        "direction": direction,
        "employee_name": employee_name,
    }


def uis_start_call(api_key, virtual_phone_number, operator_phone, contact_phone):
    """Инициирует звонок через UIS Call API (не Data API!). Возвращает (session_id, error)."""
    # UIS API (в отличие от нашего внутреннего формата +7XXXXXXXXXX) ждёт номера
    # БЕЗ знака "+" — просто 11 цифр (74991234567). Со знаком "+" UIS отвечает
    # "Invalid parameter value" по полю virtual_phone_number/operator.
    def _uis_digits(p):
        return (p or "").lstrip("+")
    payload = json.dumps({
        "jsonrpc": "2.0", "id": "1", "method": "start.simple_call",
        "params": {
            "access_token": api_key,
            "virtual_phone_number": _uis_digits(virtual_phone_number),
            "operator": _uis_digits(operator_phone),
            "contact": _uis_digits(contact_phone),
            "direction": "out",
            "first_call": "operator",
        },
    }).encode()
    req = _ureq.Request(
        "https://callapi.uiscom.ru/v4.0", data=payload,
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with _ureq.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read().decode())
    except Exception as e:
        return None, f"UIS: {str(e)[:200]}"
    if resp.get("error"):
        _err = resp["error"]
        print(f"[uis-diag] full_error={json.dumps(_err, ensure_ascii=False)}")
        return None, _err.get("message", "UIS: неизвестная ошибка")
    # call_session_id у UIS иногда лежит не прямо в result, а на уровень глубже
    # (result.data.call_session_id) — ищем по всей вложенной структуре, иначе
    # черновая запись звонка остаётся с external_id=NULL и вебхук завершения
    # не может её найти по UNIQUE(channel, external_id) → создаёт дубль в ленте.
    result = resp.get("result") or {}
    flat_result = _uis_flatten(result)
    session_id = _uis_pick(flat_result, ["call_session_id", "session_id", "id"])
    if not session_id:
        print(f"[uis-diag] no session_id in start_call response, raw result={json.dumps(result, ensure_ascii=False)[:1000]}")
    return session_id, None


SCHEMA = "t_p45929761_bold_move_project"
# Публичный URL этой же функции — нужен для регистрации внешних вебхуков (Avito и т.п.)
SELF_FUNCTION_URL = "https://functions.poehali.dev/37f12dd8-c3c7-4bc9-9451-27dd60d66a3b"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token, X-Authorization, Authorization",
}

# Статусы лидов (до договора)
LEAD_STATUSES = ["new", "call", "measure", "measured"]
# Статусы заказов (после договора)
ORDER_STATUSES = ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid", "done", "cancelled"]
# Не пересобираем авто-AI-анализ клиента чаще этого интервала (сек) —
# если клиент пишет несколько сообщений подряд, анализ не дублируем.
ANALYSIS_THROTTLE_SEC = 600

# Кэш аналитики (resource=="stats") в памяти "тёплого" контейнера функции.
# Живёт, пока функция переиспользуется между вызовами (не гарантирован между
# холодными стартами) — просто снимает повторный тяжёлый пересчёт при частых
# заходах на вкладку "Аналитика". TTL 3 минуты — данные не обязаны быть
# секундной точности.
_STATS_CACHE: dict = {}
STATS_CACHE_TTL_SEC = 180

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

def _json_default(o):
    # БД хранит created_at как "timestamp without time zone", но фактическое
    # значение — UTC (сессия psycopg2 работает в UTC). Без явной метки пояса
    # фронтенд ошибочно принимал это время за уже московское и не пересчитывал
    # его — из-за этого вся переписка отображалась на 3 часа раньше реальной.
    # Помечаем таким значениям зону "Z" (UTC), чтобы фронтенд сделал верный
    # пересчёт в московское время.
    if isinstance(o, datetime):
        return (o.isoformat() + "Z") if o.tzinfo is None else o.isoformat()
    return str(o)

def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=_json_default)}


# ── Вложения из мессенджеров: приведение к единому формату CRM ──────────────
# Воркер на VPS может присылать медиа по-разному (готовым списком attachments,
# одиночными полями media_url/media_type, полем voice_url и т.п.). Чтобы CRM не
# зависела от версии воркера, принимаем ЛЮБОЙ из этих вариантов и складываем в
# один формат: [{"type": image|voice|video|file, "url": ..., "filename": ...}].
# Расширять список синонимов можно здесь одной строкой, не трогая эндпоинты.
_MEDIA_TYPE_ALIASES = {
    "image": "image", "photo": "image", "picture": "image", "img": "image", "sticker": "image",
    "static_sticker": "image", "webp_sticker": "image",
    "voice": "voice", "audio": "voice", "voice_note": "voice", "ogg": "voice", "music": "voice",
    "video": "video", "video_note": "video", "video_message": "video", "round_video": "video",
    "animation": "video", "gif": "video", "animated_sticker": "video", "video_sticker": "video",
    "document": "file", "file": "file", "doc": "file", "pdf": "file",
    # Типы без файла — своя иконка/подпись вместо «пустого» сообщения
    "contact": "contact", "location": "location", "venue": "location", "poll": "poll",
    "story": "story", "invoice": "file",
}

_MEDIA_EXT_TYPES = {
    "jpg": "image", "jpeg": "image", "png": "image", "gif": "image", "webp": "image", "heic": "image", "bmp": "image", "svg": "image",
    "ogg": "voice", "oga": "voice", "opus": "voice", "mp3": "voice", "m4a": "voice", "wav": "voice", "aac": "voice",
    "mp4": "video", "mov": "video", "webm": "video", "mkv": "video", "avi": "video", "3gp": "video",
    "pdf": "file", "doc": "file", "docx": "file", "xls": "file", "xlsx": "file", "zip": "file", "rar": "file", "txt": "file",
}


def _media_type_from(raw_type, url, filename):
    """Определяет вид вложения: сначала по переданному типу, затем по расширению."""
    t = (str(raw_type or "")).strip().lower()
    if t in _MEDIA_TYPE_ALIASES:
        return _MEDIA_TYPE_ALIASES[t]
    src = str(filename or url or "").split("?")[0]
    ext = src.rsplit(".", 1)[-1].lower() if "." in src else ""
    return _MEDIA_EXT_TYPES.get(ext, "file")


def normalize_incoming_media(body):
    """Собирает вложения входящего сообщения из любых поддерживаемых полей.

    Понимает и обычные файлы (фото/видео/голос/документ по URL), и типы БЕЗ файла
    (контакт, геолокация, опрос) — их воркер присылает отдельными полями, а не
    ссылкой. Раньше такие сообщения сохранялись пустыми («без текста»), хотя
    содержимое у них есть — просто оно не файл.

    Возвращает (attachments_list, audio_url, duration_sec):
    attachments_list — список вложений в формате CRM (или None, если их нет);
    audio_url/duration_sec — голосовое отдельно, чтобы плеер в ленте работал
    так же, как для записей звонков.
    """
    items = []

    def add(url, raw_type=None, filename=None, duration=None):
        if not url or not isinstance(url, str) or not url.strip():
            return
        items.append({
            "type": _media_type_from(raw_type, url, filename),
            "url": url.strip(),
            "filename": filename or None,
            "duration_sec": duration if isinstance(duration, int) else None,
        })

    def add_meta(kind, label):
        """Вложение без файла — контакт/геолокация/опрос. Вместо url кладём
        читаемое summary, фронт покажет его как подпись с нужной иконкой."""
        if not label:
            return
        items.append({"type": kind, "url": None, "filename": label, "duration_sec": None})

    raw_list = body.get("attachments") or body.get("media") or body.get("files")
    if isinstance(raw_list, list):
        for a in raw_list:
            if isinstance(a, str):
                add(a)
            elif isinstance(a, dict):
                add(a.get("url") or a.get("media_url") or a.get("link") or a.get("href"),
                    a.get("type") or a.get("media_type") or a.get("kind"),
                    a.get("filename") or a.get("file_name") or a.get("name"),
                    a.get("duration_sec") or a.get("duration"))

    # Одиночное вложение отдельными полями — расширенный набор синонимов,
    # чтобы не зависеть от того, как конкретно воркер назвал поле.
    add(body.get("media_url") or body.get("file_url") or body.get("attachment_url")
        or body.get("document_url") or body.get("doc_url"),
        body.get("media_type") or body.get("attachment_type"),
        body.get("file_name") or body.get("filename"),
        body.get("duration_sec") or body.get("duration"))
    add(body.get("photo_url") or body.get("image_url") or body.get("sticker_url")
        or body.get("emoji_url"), "image",
        body.get("file_name") or body.get("filename"))
    add(body.get("video_url") or body.get("video_note_url") or body.get("round_video_url")
        or body.get("gif_url") or body.get("animation_url"), "video",
        body.get("file_name") or body.get("filename"))
    add(body.get("voice_url") or body.get("audio_url") or body.get("music_url"), "voice",
        body.get("file_name") or body.get("filename"),
        body.get("duration_sec") or body.get("duration"))

    # Типы без файла — контакт, геолокация, опрос, история (story)
    contact = body.get("contact") if isinstance(body.get("contact"), dict) else None
    if contact or body.get("contact_phone") or body.get("contact_name"):
        name = (contact or {}).get("name") or body.get("contact_name") or ""
        phone = (contact or {}).get("phone") or body.get("contact_phone") or ""
        add_meta("contact", f"{name} {phone}".strip() or "Контакт")
    lat = body.get("latitude") or (body.get("location") or {}).get("lat") if isinstance(body.get("location"), dict) else body.get("latitude")
    lon = body.get("longitude") or (body.get("location") or {}).get("lon") if isinstance(body.get("location"), dict) else body.get("longitude")
    if lat and lon:
        add_meta("location", f"Геолокация: {lat}, {lon}")
    poll = body.get("poll") if isinstance(body.get("poll"), dict) else None
    if poll or body.get("poll_question"):
        add_meta("poll", (poll or {}).get("question") or body.get("poll_question") or "Опрос")
    if body.get("is_story") or body.get("story_url"):
        add_meta("story", "Пересланная история")

    # Убираем дубли по URL (а для типов без url — по filename), сохраняя порядок
    seen, uniq = set(), []
    for it in items:
        key = it["url"] or f"meta:{it['type']}:{it['filename']}"
        if key in seen:
            continue
        seen.add(key)
        uniq.append(it)

    audio_url = next((it["url"] for it in uniq if it["type"] == "voice"), None)
    duration = next((it["duration_sec"] for it in uniq if it["type"] == "voice"), None)
    return (uniq or None), audio_url, duration

def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg}, ensure_ascii=False)}

def run_client_analysis(cur, conn, client_id, client_phone=None, client_name=None):
    """Пересобирает ИИ-анализ клиента по всей истории касаний.
    Возвращает (analysis_dict, error_message). error_message=None при успехе.
    Не бросает исключения — вызывающий код сам решает, что делать при ошибке
    (например, вебхук просто логирует и не валит сохранение сообщения)."""
    cur.execute(f"""
        SELECT channel, direction, text, duration_sec, created_at
        FROM {SCHEMA}.touch_events
        WHERE client_id=%s ORDER BY created_at ASC, id ASC
    """, (client_id,))
    rows = cur.fetchall()
    if not rows:
        return None, "нет касаний для анализа"

    lines = []
    client_replied = False  # был ли хоть один входящий контакт от клиента
    for r in rows:
        ch, direction, text, dur, created = r
        who = "Клиент" if direction == "in" else "Мы"
        if direction == "in":
            client_replied = True
        when = created.strftime("%d.%m %H:%M") if created else ""
        if ch == "call":
            body_txt = f"звонок {dur or 0} сек" + (f": {text}" if text else "")
        else:
            body_txt = text or "(без текста)"
        lines.append(f"[{when}] ({ch}) {who}: {body_txt}")
    history_text = "\n".join(lines[-200:])

    polza_key = os.environ.get("POLZA_API_KEY", "")
    if not polza_key:
        return None, "AI недоступен — нет ключа"

    sys_prompt = (
        "Отвечай только валидным JSON без markdown и пояснений. "
        "Ты обязан опираться СТРОГО на переданный текст истории — ни одного факта, "
        "события, реакции или намерения сверх того, что буквально написано в истории. "
        "Если данных недостаточно для вывода — прямо пиши об этом (например "
        "«клиент ещё не ответил»), а не додумывай."
    )
    # Явно предупреждаем модель, если клиент ещё ни разу не написал/не ответил —
    # иначе модель по умолчанию выдумывает «клиент проявил интерес» и т.п. на
    # основании одного нашего исходящего сообщения.
    reply_note = (
        "ВАЖНО: в истории НЕТ ни одного входящего сообщения/звонка от клиента — "
        "клиент ещё ни разу не ответил. Не пиши, что клиент «проявил интерес», "
        "«откликнулся» или как-либо отреагировал — этого не было. "
        "interest должен быть \"low\", state_summary должен честно отражать, что "
        "мы написали первыми и ответа пока нет, key_points и risks не должны "
        "содержать выдуманных реакций клиента."
        if not client_replied else
        "В истории есть хотя бы одно сообщение от клиента — используй факты из него."
    )
    user_prompt = (
        "Ты аналитик отдела продаж. На вход — вся история общения с клиентом "
        "(звонки и переписки из разных каналов) по порядку времени.\n"
        f"{reply_note}\n"
        "Верни ТОЛЬКО валидный JSON без markdown:\n"
        '{\n'
        '  "state_summary": "КРАТКО, 1-3 предложения (до 300 знаков): что нужно клиенту, на чём остановились, что мешает сделке. Без воды и вступлений.",\n'
        '  "next_action": "конкретная рекомендация к следующему касанию: что сказать/написать, когда и по какому каналу",\n'
        '  "interest": "high|medium|low",\n'
        '  "interest_label": "Высокий|Средний|Низкий",\n'
        '  "stage": "короткое название стадии сделки",\n'
        '  "outcome": "success|failure|pending",\n'
        '  "outcome_label": "Успех|Отказ|В работе",\n'
        '  "risks": ["риск1", "риск2"],\n'
        '  "key_points": ["важный факт о клиенте 1", "..."]\n'
        '}\n'
        "Правила: опирайся ТОЛЬКО на факты, буквально присутствующие в истории. "
        "Запрещено приписывать клиенту интерес, эмоции или действия, которых нет в "
        "тексте истории. Рекомендация должна быть практичной и конкретной.\n\n"
        f"История общения с клиентом{' ' + client_name if client_name else ''} ({client_phone or ''}):\n{history_text}"
    )
    payload = json.dumps({
        "model": "openai/gpt-4o-mini",
        "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_prompt}],
        "max_tokens": 800, "temperature": 0.1,
    }).encode()
    req = _ureq.Request(
        "https://api.polza.ai/api/v1/chat/completions", data=payload,
        headers={"Authorization": f"Bearer {polza_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with _ureq.urlopen(req, timeout=30) as r:
            ai_resp = json.loads(r.read().decode())
        content = ai_resp["choices"][0]["message"]["content"]
        m = re.search(r'\{[\s\S]*\}', content)
        if not m:
            return None, "AI вернул неожиданный формат"
        parsed = json.loads(m.group(0))
    except Exception as e:
        return None, f"AI ошибка: {str(e)[:200]}"

    state_summary  = parsed.get("state_summary")
    next_action    = parsed.get("next_action")
    interest       = parsed.get("interest")
    interest_label = parsed.get("interest_label")
    stage          = parsed.get("stage")
    outcome        = parsed.get("outcome")
    outcome_label  = parsed.get("outcome_label")
    risks          = json.dumps(parsed.get("risks") or [], ensure_ascii=False)
    key_points     = json.dumps(parsed.get("key_points") or [], ensure_ascii=False)

    cur.execute(f"""
        INSERT INTO {SCHEMA}.touch_client_analyses
            (client_id, state_summary, next_action, interest, interest_label,
             stage, outcome, outcome_label, risks, key_points)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (client_id, state_summary, next_action, interest, interest_label,
          stage, outcome, outcome_label, risks, key_points))
    cur.execute(f"""
        UPDATE {SCHEMA}.touch_clients
        SET state_summary=%s, next_action=%s, interest=%s, stage=%s, analysis_updated_at=NOW()
        WHERE id=%s
    """, (state_summary, next_action, interest, stage, client_id))

    # Комментарий в карточке заявки = краткая сводка по общению с клиентом.
    # Обновляем при каждом пересчёте анализа, чтобы менеджер видел суть,
    # не перечитывая всю переписку.
    if state_summary:
        cur.execute(f"""
            UPDATE {SCHEMA}.live_chats SET notes=%s
            WHERE id = (SELECT crm_contact_id FROM {SCHEMA}.touch_clients WHERE id=%s)
        """, (state_summary, client_id))

    conn.commit()

    return {
        "state_summary": state_summary, "next_action": next_action,
        "interest": interest, "interest_label": interest_label,
        "stage": stage, "outcome": outcome, "outcome_label": outcome_label,
        "risks": parsed.get("risks") or [], "key_points": parsed.get("key_points") or [],
    }, None


def imap_find_spam_folder(imap):
    """Находит реальное имя папки «Спам» в Gmail через IMAP.

    Проблема: Gmail хранит служебные папки в IMAP UTF-7 (например
    "[Gmail]/&BCEEPwQwBDw-" для русского интерфейса), а не как буквальные
    "[Gmail]/Спам" или "[Gmail]/Spam" — жёстко зашитые названия не находят
    папку (imap.select возвращает "NO"), и спам никогда не проверяется.
    Правильный способ — искать папку по флагу \\Junk, который Gmail
    присваивает ей независимо от языка интерфейса. Возвращает имя папки
    (готовое для передачи в imap.select) или None, если не нашли.
    """
    try:
        status, folders = imap.list()
        if status != "OK" or not folders:
            return None
        for f in folders:
            raw = f.decode("utf-8", errors="ignore") if isinstance(f, bytes) else str(f)
            if "\\Junk" in raw:
                # Формат строки: '(\\HasNoChildren \\Junk) "/" "ИмяПапки"'
                parts = raw.rsplit(' "/" ', 1)
                if len(parts) == 2:
                    return parts[1].strip()
    except Exception:
        return None
    return None


def normalize_phone(raw):
    """Нормализует номер к виду +7XXXXXXXXXX. Возвращает '' если номер невалиден."""
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


def log_incoming_lead(conn, channel, payload, company_id=None, parsed_phone=None):
    """Записывает СЫРУЮ входящую заявку в журнал ДО попытки создать карточку.

    Нужно, чтобы ни одна заявка не терялась бесследно: если карточку создать не
    удалось (сбой БД, таймаут функции, ошибка разбора текста) — сырой текст всё
    равно сохранён, заявку видно в журнале и можно завести руками.
    Возвращает id записи журнала (или None, если журнал недоступен).
    Никогда не бросает исключение — сбой журнала не должен ронять приём заявки.
    """
    try:
        with conn.cursor() as c:
            c.execute(
                f"""INSERT INTO {SCHEMA}.leads_webhook_raw_log
                        (company_id, channel, payload, parsed_phone)
                    VALUES (%s, %s, %s, %s) RETURNING id""",
                (company_id, channel, json.dumps(payload, ensure_ascii=False), parsed_phone),
            )
            log_id = c.fetchone()[0]
        conn.commit()
        return log_id
    except Exception as e:
        print(f"[leads-log] failed to write incoming lead: {type(e).__name__}: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
        return None


def finish_incoming_lead(conn, log_id, outcome, client_id=None, error=None, parsed_phone=None):
    """Отмечает в журнале, чем закончилась обработка заявки (created/duplicate/
    skipped/error). Тоже никогда не бросает исключение."""
    if not log_id:
        return
    try:
        with conn.cursor() as c:
            c.execute(
                f"""UPDATE {SCHEMA}.leads_webhook_raw_log
                    SET outcome=%s, client_id=%s, error=%s,
                        parsed_phone=COALESCE(%s, parsed_phone)
                    WHERE id=%s""",
                (outcome, client_id, error, parsed_phone, log_id),
            )
        conn.commit()
    except Exception as e:
        print(f"[leads-log] failed to finish lead log {log_id}: {type(e).__name__}: {e}")
        try:
            conn.rollback()
        except Exception:
            pass


def parse_tg_lead_text(text):
    """Разбирает текст заявки от бота-агрегатора в группе Telegram (формат вида
    «Заявка в Москве / Нужно сделать.../ площадь: 50 м². Срок: 7 дней /
    Телефон: +7.../ Удобнее общаться: MAX») в структурированные поля.
    Возвращает dict или None, если текст не похож на заявку (нет телефона)."""
    if not text or not isinstance(text, str):
        return None

    phone_m = re.search(r'[Тт]елефон:\s*(\+?\d[\d\s\-\(\)]{9,})', text)
    if not phone_m:
        return None  # без телефона это не заявка — обычное сообщение в группе
    phone = normalize_phone(phone_m.group(1))
    if not phone:
        return None

    city_m = re.search(r'[Зз]аявка\s+в\s+([^\n]+)', text)
    city = city_m.group(1).strip() if city_m else None

    area_m = re.search(r'площадь:\s*([\d.,]+)\s*м', text, re.IGNORECASE)
    area = None
    if area_m:
        try:
            area = float(area_m.group(1).replace(",", "."))
        except ValueError:
            area = None

    term_m = re.search(r'[Сс]рок:\s*([^\n.]+(?:\n[^\nА-ЯЁ][^\n]*)?)', text)
    term = re.sub(r'\s+', ' ', term_m.group(1)).strip() if term_m else None

    contact_m = re.search(r'[Уу]добнее общаться:\s*([^\n]+)', text)
    contact_via = contact_m.group(1).strip() if contact_m else None

    # Описание работ — весь текст после заголовка "Заявка в ..." и до первого
    # служебного поля (площадь/Телефон/Срок), с очисткой лишних пробелов.
    desc_m = re.search(
        r'[Зз]аявка\s+в\s+[^\n]+\n+(.+?)(?:,?\s*площадь:|\n[Тт]елефон:|\n[Сс]рок:)',
        text, re.DOTALL)
    description = re.sub(r'\s+', ' ', desc_m.group(1)).strip() if desc_m else None

    return {
        "phone": phone, "city": city, "area": area, "term": term,
        "contact_via": contact_via, "description": description,
    }


# Характерные фразы автоинформатора оператора связи («автоответчик» в быту).
# UIS не присылает отдельного признака "ответил человек / включился автоответчик",
# поэтому определяем эвристикой по тексту расшифровки — это те же служебные
# фразы, что видны в реальных примерах (см. touch_events.id=385,386 от 10.08).
_VOICEMAIL_PHRASES = (
    "абонент выключен", "абонент недоступен", "телефон выключен",
    "телефон занят", "перезвоните позже", "попробуйте перезвонить",
    "не может ответить на ваш звонок", "поставил вызов на удержание",
    "оставьте сообщение после сигнала", "находится вне зоны действия сети",
)


def detect_call_answered_by(text, duration_sec, status):
    """Определяет, кто принял звонок: 'human' (ответил человек),
    'voicemail' (автоответчик/автоинформатор оператора) или None (неизвестно —
    нет текста расшифровки, либо звонок не состоялся вовсе).
    Возвращает строку или None."""
    if status in ("missed", "no-answer", "noanswer", "busy", "declined", "initiated"):
        return None
    if not text or not text.strip():
        return None
    low = text.lower()
    if any(phrase in low for phrase in _VOICEMAIL_PHRASES):
        return "voicemail"
    if duration_sec and duration_sec > 0:
        return "human"
    # Есть текст, длительность 0 — короткий обрывок технического сообщения,
    # но без явных ключевых фраз. Не гадаем дальше — считаем неопределённым.
    return None


_MOSCOW_TZ = ZoneInfo("Europe/Moscow")


def default_next_call_date():
    """Автонапоминание о первом звонке новому клиенту: если заявка пришла
    позже 19:00 по Москве — автоматически ставим напоминание «Следующий
    звонок» на завтра на 10:00 по Москве (чтобы не звонить клиенту поздно
    вечером/ночью). В остальное время (рабочий день) напоминание не ставим —
    менеджер звонит сразу. Возвращает ISO-строку с московским смещением
    (для timestamptz-поля next_call_date) или None."""
    now_msk = datetime.now(_MOSCOW_TZ)
    if now_msk.hour < 19:
        return None
    tomorrow_10 = (now_msk + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    return tomorrow_10.isoformat()


ALL_CLIENT_FIELDS = [
    "client_name", "phone", "status", "sub_status", "client_status", "measure_date", "install_date",
    "next_call_date", "no_call_needed",
    "notes", "address", "area", "budget", "source",
    "comment_order", "comment_measure", "comment_install", "comment_client",
    "summary_comm", "summary_status", "is_service", "is_verified", "is_confirmed",
    "contract_sum", "prepayment", "extra_payment", "extra_agreement_sum",
    "discount_pct", "discount_amount",
    "prepayment_confirmed", "prepayment_confirmed_at", "prepayment_fact",
    "extra_payment_confirmed", "extra_payment_confirmed_at", "extra_payment_fact",
    "responsible_phone", "map_link", "tags",
    "photo_before_url", "photo_after_url", "document_url",
    "material_cost", "measure_cost", "install_cost", "management_cost", "cancel_reason",
    "project_id", "desired_measure_date", "desired_install_date",
]

def handler(event: dict, context) -> dict:
    """CRM-менеджер: клиенты, канбан, календарь, аналитика, файлы."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    resource = qs.get("r", "")
    # Воркер мессенджеров (VPS) ходит через ?action=worker_accounts (подчёркивания),
    # а не ?r=worker-accounts (дефисы) — поддерживаем оба варианта одним маппингом,
    # чтобы не переписывать сам воркер под наш стиль именования.
    if not resource and qs.get("action"):
        resource = qs["action"].replace("_", "-")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur = conn.cursor()

    # ── Определяем company_id по токену ──────────────────────────────────────
    # Мастер (пароль Sdauxbasstre228) → company_id = None (видит всё)
    # Клиент (авторизован через сайт) → company_id = его user_id
    headers = event.get("headers") or {}
    raw_token = (headers.get("X-Authorization") or headers.get("Authorization") or "").replace("Bearer ", "").strip()

    company_id = None   # None = мастер, видит всё
    is_master  = True
    is_owner   = False  # владелец компании (role='company') — полные права в своей компании
    master_uid = 0      # реальный uid текущего пользователя (для вставок)
    # Список статусов воронки, разрешённых текущему сотруднику (None = ограничений нет, видно всё)
    allowed_statuses = None
    # Список ID кастомных подэтапов (order_substatuses), разрешённых сотруднику.
    # Работает ТОЛЬКО как доп.ограничение поверх allowed_statuses: если у заявки
    # стоит sub_status, которого нет в этом списке — заявка недоступна, даже если
    # её основной status разрешён. None = ограничений по подэтапам нет.
    allowed_substatuses = None
    # Тонкая настройка доступа сотрудника (значения по умолчанию = прежнее поведение,
    # чтобы обновление ничего не изменило для уже заведённых сотрудников):
    orders_scope = "all"          # all | own | own_free — какие заявки видит
    orders_edit_own_only = False  # редактировать можно только свои заявки
    orders_reassign = False       # может вручную сменить ответственного у заявки
    calendar_event_types = None   # None = видны все типы событий календаря
    calendar_own_only = False     # в календаре только события по своим заявкам
    # Права на редактирование по каждому из 4 типов дат отдельно (желаемая/фактическая
    # × замер/монтаж). По умолчанию True (без ограничений) — обратная совместимость
    # для уже заведённых сотрудников, пока владелец явно не выключит право в настройках.
    dates_edit_rights = {
        "desired_measure_date": True,
        "desired_install_date": True,
        "measure_date": True,
        "install_date": True,
    }
    # True только если токен реально проверен и найдена активная сессия в БД.
    # Отсутствие токена НЕ должно трактоваться как доступ мастера (см. resource=="clients" ниже).
    authenticated = False

    current_user_name = None  # имя текущего сотрудника (для автора в журнале активности)
    if raw_token:
        cur.execute(f"""
            SELECT u.id, u.email, u.role, u.company_id, u.permissions, u.name
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (raw_token,))
        sess = cur.fetchone()
        if sess:
            authenticated = True
            uid, uemail, urole, ucompany_id, upermissions, current_user_name = sess
            # Владелец компании (role='company') — не мастер (супер-админ), но имеет
            # полные права внутри СВОЕЙ компании, как и hasPermission() на фронте
            # (role === "company" → true всегда). Раньше это нигде не проверялось
            # отдельно для orders_reassign, из-за чего владелец не мог назначить
            # ответственного вручную — запрос тихо отклонялся с 403.
            is_owner = (urole == "company")
            if uemail == "19.jeka.94@gmail.com":
                is_master  = True
                company_id = None   # мастер видит всё
                master_uid = uid    # реальный uid мастера для вставок
            else:
                is_master  = False
                master_uid = uid
                # Менеджер привязан к компании → видит данные владельца
                # Все остальные роли видят только свои данные (company_id = их uid)
                if urole == "manager" and ucompany_id:
                    company_id = ucompany_id
                    # Ограничение по этапам воронки — только для сотрудников (роль manager).
                    # Пустой список / отсутствие ключа = ограничений нет (видно всё, обратная совместимость)
                    if upermissions:
                        st = upermissions.get("allowed_statuses")
                        if isinstance(st, list) and len(st) > 0:
                            allowed_statuses = st
                        sub_st = upermissions.get("allowed_substatuses")
                        if isinstance(sub_st, list) and len(sub_st) > 0:
                            allowed_substatuses = [str(x) for x in sub_st]
                        # Видимость заявок по ответственному
                        sc = upermissions.get("orders_scope")
                        if sc in ("all", "own", "own_free"):
                            orders_scope = sc
                        orders_edit_own_only = bool(upermissions.get("orders_edit_own_only"))
                        orders_reassign = bool(upermissions.get("orders_reassign"))
                        # Календарь: типы событий и «только свои»
                        et = upermissions.get("calendar_event_types")
                        if isinstance(et, list) and len(et) > 0:
                            calendar_event_types = et
                        calendar_own_only = bool(upermissions.get("calendar_own_only"))
                        # Права на даты: ключ permissions вида "dates_edit_measure_date".
                        # Если ключа нет вообще (сотрудник не настроен персонально) — оставляем
                        # True (значение по умолчанию выше), чтобы не сломать существующих.
                        # Если ключ ЕСТЬ (хоть True, хоть False) — уважаем явное значение.
                        for _df in dates_edit_rights:
                            _k = f"dates_edit_{_df}"
                            if _k in upermissions:
                                dates_edit_rights[_df] = bool(upermissions.get(_k))
                else:
                    company_id = uid

    try:
        # ── UPLOAD FILE ───────────────────────────────────────────────────────
        if resource == "upload":
            file_data = body.get("data", "")
            filename = body.get("filename", "file")
            content_type = body.get("content_type", "application/octet-stream")
            # Необязательная папка в Хранилище (по умолчанию — "crm", как раньше).
            # Разрешаем только буквы/цифры/дефис/подчёркивание — защита от path traversal.
            folder = (body.get("folder") or "crm").strip("/")
            if not re.fullmatch(r"[A-Za-z0-9_\-]+", folder):
                folder = "crm"
            if not file_data:
                return err("no data")
            raw = base64.b64decode(file_data)
            ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
            key = f"{folder}/{uuid.uuid4()}.{ext}"
            s3 = get_s3()
            s3.put_object(Bucket="files", Key=key, Body=raw, ContentType=content_type)
            cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            return ok({"url": cdn_url, "key": key})

        # ── UPLOAD-PRESIGN: прямая загрузка в S3, в обход сервера ──────────────
        # Обычный "upload" гоняет файл через base64 в JSON — упирается в лимит
        # запроса (~6 МБ), поэтому крупные файлы (видео) не проходят. Здесь вместо
        # этого выдаём одноразовую подписанную ссылку: браузер сам грузит файл PUT-
        # запросом НАПРЯМУЮ в S3 (bucket.poehali.dev), сервер вообще не видит байты
        # файла — только имя и тип. Лимита размера запроса тут нет.
        if resource == "upload-presign" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            filename = body.get("filename", "file")
            content_type = body.get("content_type", "application/octet-stream")
            folder = (body.get("folder") or "crm").strip("/")
            if not re.fullmatch(r"[A-Za-z0-9_\-]+", folder):
                folder = "crm"
            ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
            key = f"{folder}/{uuid.uuid4()}.{ext}"
            s3 = get_s3()
            put_url = s3.generate_presigned_url(
                "put_object",
                Params={"Bucket": "files", "Key": key, "ContentType": content_type},
                ExpiresIn=600,  # 10 минут — с запасом на медленную мобильную сеть
            )
            cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            return ok({"put_url": put_url, "url": cdn_url, "key": key})

        # ── BUG REPORTS ──────────────────────────────────────────────────────
        if resource == "bug_reports":
            # Статусы, менять которые может только мастер
            MASTER_ONLY_STATUSES = ["in_progress", "done", "rejected"]
            VALID_STATUSES = ["new"] + MASTER_ONLY_STATUSES
            VALID_SEVERITY = ["critical", "important", "normal", "idea"]
            VALID_TYPES = ["bug", "improvement", "idea"]
            VALID_PLATFORMS = ["ios", "android", "desktop"]
            VALID_AREAS = ["agent", "crm", "builder"]
            MIN_DESCRIPTION_LEN = 50

            if method == "GET":
                cur.execute(
                    f"""SELECT id, title, description, severity, report_type, status,
                               attachments, author_id, author_name, created_at, updated_at,
                               platform, area
                        FROM {SCHEMA}.bug_reports
                        ORDER BY created_at DESC"""
                )
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok({"reports": rows, "is_master": is_master})

            if method == "POST":
                title = (body.get("title") or "").strip()[:255]
                description = (body.get("description") or "").strip()
                severity = body.get("severity", "normal")
                report_type = body.get("report_type", "bug")
                platform = body.get("platform", "")
                area = body.get("area", "")
                attachments = body.get("attachments", [])
                if severity not in VALID_SEVERITY:
                    severity = "normal"
                if report_type not in VALID_TYPES:
                    report_type = "bug"
                if platform not in VALID_PLATFORMS:
                    return err("выберите платформу")
                if area not in VALID_AREAS:
                    return err("выберите, где обнаружена проблема")
                if not description and not title:
                    return err("description required")
                if len(description) < MIN_DESCRIPTION_LEN:
                    return err(f"слишком мало описания — минимум {MIN_DESCRIPTION_LEN} символов")
                if not any((a or {}).get("type", "").startswith("image") for a in attachments):
                    return err("прикрепите скриншот проблемы")
                author_name = (body.get("author_name") or "").strip()[:255]
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.bug_reports
                        (title, description, severity, report_type, status, attachments, author_id, author_name, platform, area)
                        VALUES (%s,%s,%s,%s,'new',%s,%s,%s,%s,%s) RETURNING id""",
                    (title, description, severity, report_type,
                     json.dumps(attachments, ensure_ascii=False), master_uid or None, author_name, platform, area)
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                report_id = body.get("id")
                new_status = body.get("status", "")
                if not report_id or new_status not in VALID_STATUSES:
                    return err("id and valid status required")
                # Статусы В работе / Выполнен / Не выполнен — только мастер
                if new_status in MASTER_ONLY_STATUSES and not is_master:
                    return err("only master can set this status", 403)
                cur.execute(
                    f"UPDATE {SCHEMA}.bug_reports SET status=%s, updated_at=NOW() WHERE id=%s",
                    (new_status, report_id)
                )
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                if not is_master:
                    return err("only master can delete", 403)
                # Массовая чистка тестовых репортов, которые раньше создавал
                # автотест при каждом деплое («Тестовый баг-репорт», без автора).
                if (body.get("purge_test") or qs.get("purge_test")):
                    cur.execute(
                        f"""DELETE FROM {SCHEMA}.bug_reports
                            WHERE description = 'Тестовый баг-репорт'
                              AND COALESCE(title,'') = ''
                              AND COALESCE(author_name,'') = ''""")
                    removed = cur.rowcount
                    conn.commit()
                    return ok({"ok": True, "removed": removed})
                report_id = body.get("id") or qs.get("id")
                if not report_id:
                    return err("id required")
                cur.execute(f"DELETE FROM {SCHEMA}.bug_reports WHERE id=%s", (report_id,))
                conn.commit()
                return ok({"ok": True})

        # ── CLIENT FILES ─────────────────────────────────────────────────────
        # Файлы привязаны к client_id (карточка CRM) и/или project_id (проект плана).
        # Если у проекта плана есть crm_chat_id — фото сразу сохраняются с обоими
        # идентификаторами и видны и в плане, и в карточке CRM.
        if resource == "client_files":
            client_id = qs.get("client_id") or body.get("client_id")
            project_id = qs.get("project_id") or body.get("project_id")
            # Проверка обязательна только для GET/POST — DELETE/PUT удаляют/меняют
            # запись по id файла напрямую, без client_id/project_id.
            if method in ("GET", "POST") and not client_id and not project_id:
                return err("client_id or project_id required")

            if method == "GET":
                if project_id:
                    cur.execute(
                        f"""SELECT id, url, name, type, category, client_id, project_id, created_at
                            FROM {SCHEMA}.client_files WHERE project_id=%s ORDER BY created_at ASC""",
                        (int(project_id),)
                    )
                else:
                    cur.execute(
                        f"""SELECT id, url, name, type, category, client_id, project_id, created_at
                            FROM {SCHEMA}.client_files WHERE client_id=%s ORDER BY created_at ASC""",
                        (int(client_id),)
                    )
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                url = body.get("url", "")
                name = body.get("name", "файл")
                ftype = body.get("type", "image")
                category = (body.get("category") or "Фото до").strip()[:50]
                if not url:
                    return err("url required")

                final_client_id = int(client_id) if client_id else 0
                final_project_id = int(project_id) if project_id else None

                # Если фото добавляется из плана (project_id) и client_id не передан явно —
                # подтягиваем crm_chat_id проекта, чтобы фото сразу попало и в CRM.
                if final_project_id and not client_id:
                    cur.execute(
                        f"SELECT crm_chat_id FROM {SCHEMA}.plan_projects WHERE id=%s",
                        (final_project_id,)
                    )
                    prow = cur.fetchone()
                    if prow and prow[0]:
                        final_client_id = prow[0]

                cur.execute(
                    f"""INSERT INTO {SCHEMA}.client_files (client_id, project_id, url, name, type, category)
                        VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (final_client_id, final_project_id, url, name, ftype, category)
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id, "url": url, "name": name, "type": ftype, "category": category,
                           "client_id": final_client_id, "project_id": final_project_id})

            if method == "PUT":
                file_id = body.get("id")
                name = body.get("name", "")
                if not file_id or not name:
                    return err("id and name required")
                cur.execute(
                    f"UPDATE {SCHEMA}.client_files SET name=%s WHERE id=%s",
                    (name, int(file_id))
                )
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                file_id = body.get("id")
                if not file_id:
                    return err("id required")
                cur.execute(
                    f"DELETE FROM {SCHEMA}.client_files WHERE id=%s",
                    (int(file_id),)
                )
                conn.commit()
                return ok({"ok": True})

        # ── TEAM-MEMBERS: короткий список коллег для выбора ответственного ─────
        # Отдельно от auth?action=team-list (тот доступен только владельцу).
        # Здесь — любой авторизованный сотрудник компании может получить список
        # коллег, чтобы выбрать, кому передать заявку (если у него есть право
        # orders_reassign — проверяется на самой смене, не на чтении списка).
        if resource == "team-members" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id
            if owner_id is None:
                # Мастер без привязки к конкретной компании — берём company_id из
                # запроса (карточка заявки знает, какой компании она принадлежит)
                cq = qs.get("company_id")
                owner_id = int(cq) if cq else master_uid
            cur.execute(f"""
                SELECT id, COALESCE(NULLIF(name, ''), email) AS display_name
                FROM {SCHEMA}.users
                WHERE company_id=%s AND role='manager' AND removed_at IS NULL AND active IS NOT FALSE
                ORDER BY display_name
            """, (owner_id,))
            return ok({"members": [{"id": r[0], "name": r[1]} for r in cur.fetchall()]})

        # ── CLIENTS ──────────────────────────────────────────────────────────
        if resource == "clients":
            # Список/карточки клиентов (имена, телефоны) — доступ только по проверенному токену.
            # Без этого запрос без авторизации трактовался бы как "мастер" и отдавал бы всех клиентов всех компаний.
            if not authenticated:
                return err("Требуется авторизация", 401)
            if method == "GET":
                status_filter = qs.get("status", "")
                search = qs.get("search", "")
                mode = qs.get("mode", "")  # "leads" | "orders" | "" = all

                sql = f"""
                    SELECT lc.id, lc.session_id, lc.client_name, lc.phone, lc.status, lc.sub_status, lc.client_status,
                           lc.measure_date, lc.install_date, lc.notes, lc.address, lc.area, lc.budget, lc.source, lc.created_via, lc.created_at,
                           lc.comment_order, lc.comment_measure, lc.comment_install, lc.comment_client,
                           lc.summary_comm, lc.summary_status, lc.is_service, lc.is_verified, lc.is_confirmed,
                           lc.contract_sum, lc.prepayment, lc.extra_payment, lc.extra_agreement_sum,
                           lc.discount_pct, lc.discount_amount,
                           lc.prepayment_confirmed, lc.prepayment_confirmed_at, lc.prepayment_fact,
                           lc.extra_payment_confirmed, lc.extra_payment_confirmed_at, lc.extra_payment_fact,
                           lc.responsible_phone, lc.map_link, lc.tags,
                           lc.photo_before_url, lc.photo_after_url, lc.document_url,
                           lc.material_cost, lc.measure_cost, lc.install_cost, lc.management_cost, lc.cancel_reason,
                           lc.updated_at, lc.project_id, lc.avito_chat_url, lc.status_changed_at, lc.closed_at,
                           lc.next_call_date, lcall.last_call_at,
                           lc.desired_measure_date, lc.desired_install_date,
                           GREATEST(lc.updated_at, COALESCE(lact.last_touch_at, lc.updated_at)) AS last_activity_at,
                           COALESCE(missed.has_missed_call, FALSE) AS has_missed_call,
                           COALESCE(u.is_demo, FALSE) AS is_demo,
                           COALESCE(cfv.custom_costs_total, 0) AS custom_costs_total,
                           lc.assigned_to,
                           COALESCE(NULLIF(au.name, ''), au.email) AS assigned_name,
                           lc.assigned_manager2,
                           COALESCE(NULLIF(am2.name, ''), am2.email) AS assigned_manager2_name,
                           lc.assigned_measurer,
                           COALESCE(NULLIF(ams.name, ''), ams.email) AS assigned_measurer_name,
                           lc.assigned_technologist,
                           COALESCE(NULLIF(ate.name, ''), ate.email) AS assigned_technologist_name,
                           lc.assigned_installer,
                           COALESCE(NULLIF(ain.name, ''), ain.email) AS assigned_installer_name,
                           tc.state_summary AS ai_state_summary, tc.next_action AS ai_next_action,
                           tc.stage AS ai_stage, tc.analysis_updated_at AS ai_analysis_updated_at,
                           lc.last_action_summary, lc.last_action_summary_at
                    FROM {SCHEMA}.live_chats lc
                    LEFT JOIN {SCHEMA}.users u ON lc.company_id = u.id
                    LEFT JOIN {SCHEMA}.users au ON au.id = lc.assigned_to
                    LEFT JOIN {SCHEMA}.users am2 ON am2.id = lc.assigned_manager2
                    LEFT JOIN {SCHEMA}.users ams ON ams.id = lc.assigned_measurer
                    LEFT JOIN {SCHEMA}.users ate ON ate.id = lc.assigned_technologist
                    LEFT JOIN {SCHEMA}.users ain ON ain.id = lc.assigned_installer
                    -- ИИ-сводка по клиенту (state_summary/next_action/stage) считается в
                    -- touch_clients (см. crm-ai analyze-client). Один crm_contact_id может
                    -- встречаться в НЕСКОЛЬКИХ строках touch_clients (разные каналы одного
                    -- клиента) — обычный LEFT JOIN размножил бы строки списка заявок, поэтому
                    -- берём LATERAL с одной самой свежепроанализированной записью.
                    LEFT JOIN LATERAL (
                        SELECT state_summary, next_action, stage, analysis_updated_at
                        FROM {SCHEMA}.touch_clients
                        WHERE crm_contact_id = lc.id
                        ORDER BY analysis_updated_at DESC NULLS LAST LIMIT 1
                    ) tc ON true
                    LEFT JOIN (
                        -- Кастомные статьи затрат заказа (Технолог, Логистика, Менеджер и т.п.),
                        -- заведённые через "+ Добавить строку" в блоке "Затраты". Тип статьи
                        -- (cost/income) хранится в auto_rules_v2 — джойним по company_id+key,
                        -- чтобы случайно НЕ приплюсовать сюда кастомную статью ДОХОДА, если
                        -- такая когда-нибудь появится (иначе прибыль в аналитике завысится).
                        SELECT cfv.client_id, SUM(cfv.value) AS custom_costs_total
                        FROM {SCHEMA}.client_custom_fin_values cfv
                        JOIN {SCHEMA}.live_chats lc2 ON lc2.id = cfv.client_id
                        LEFT JOIN {SCHEMA}.auto_rules_v2 ar ON ar.company_id = lc2.company_id AND ar.key = cfv.row_key
                        WHERE COALESCE(ar.row_type, 'cost') = 'cost'
                        GROUP BY cfv.client_id
                    ) cfv ON cfv.client_id = lc.id
                    LEFT JOIN (
                        -- "Последний звонок" учитывает и входящие, и исходящие (сотрудник
                        -- сам звонил клиенту через кнопку «Позвонить») — раньше фильтровался
                        -- только direction='in', из-за чего исходящие звонки не отображались.
                        SELECT tc2.crm_contact_id AS contact_id, MAX(te.created_at) AS last_call_at
                        FROM {SCHEMA}.touch_clients tc2
                        JOIN {SCHEMA}.touch_events te ON te.client_id = tc2.id
                        WHERE te.channel='call' AND tc2.crm_contact_id IS NOT NULL
                        GROUP BY tc2.crm_contact_id
                    ) lcall ON lcall.contact_id = lc.id
                    LEFT JOIN (
                        -- "Последнее действие" (для счётчика в карточке) — самое свежее
                        -- КАСАНИЕ по заявке любого рода: звонок, входящее/исходящее сообщение
                        -- в любом канале. Итоговое значение = GREATEST(это, updated_at карточки),
                        -- т.к. updated_at уже обновляется при любой правке полей заявки.
                        SELECT tc4.crm_contact_id AS contact_id, MAX(te5.created_at) AS last_touch_at
                        FROM {SCHEMA}.touch_clients tc4
                        JOIN {SCHEMA}.touch_events te5 ON te5.client_id = tc4.id
                        WHERE tc4.crm_contact_id IS NOT NULL
                        GROUP BY tc4.crm_contact_id
                    ) lact ON lact.contact_id = lc.id
                    LEFT JOIN (
                        -- Пропущенный звонок считаем "непрочитанным" в карточке, пока по нему
                        -- нет исходящего звонка/сообщения ПОЗЖЕ времени пропуска (менеджер ещё не перезвонил).
                        SELECT tc3.crm_contact_id AS contact_id, TRUE AS has_missed_call
                        FROM {SCHEMA}.touch_clients tc3
                        JOIN {SCHEMA}.touch_events te3 ON te3.client_id = tc3.id
                        WHERE te3.channel='call' AND te3.direction='in'
                          AND te3.status IN ('missed','no-answer','noanswer','busy','declined')
                          AND tc3.crm_contact_id IS NOT NULL
                          AND NOT EXISTS (
                              SELECT 1 FROM {SCHEMA}.touch_events te4
                              WHERE te4.client_id = tc3.id
                                AND te4.created_at > te3.created_at
                                AND (te4.direction = 'out' OR (te4.channel='call' AND te4.status NOT IN ('missed','no-answer','noanswer','busy','declined')))
                          )
                        GROUP BY tc3.crm_contact_id
                    ) missed ON missed.contact_id = lc.id
                    WHERE (lc.status != 'deleted' OR lc.status = %s)
                """
                # Мастер видит всех — но скрываем демо-аккаунты чтобы не засорять список.
                # Исключение: если запрос идёт от самого демо-пользователя (company_id задан) —
                # он должен видеть своих клиентов, поэтому фильтр не применяем.
                params = [status_filter]
                if company_id is None:
                    sql += " AND COALESCE(u.is_demo, FALSE) = FALSE"
                if company_id is not None:
                    sql += " AND lc.company_id = %s"
                    params.append(company_id)
                if mode == "leads":
                    sql += f" AND status = ANY(%s)"
                    params.append(LEAD_STATUSES)
                elif mode == "orders":
                    sql += f" AND status = ANY(%s)"
                    params.append(ORDER_STATUSES)
                if status_filter:
                    sql += " AND status = %s"
                    params.append(status_filter)
                # Ограничение сотрудника по разрешённым этапам воронки
                if allowed_statuses is not None:
                    sql += " AND status = ANY(%s)"
                    params.append(allowed_statuses)
                # Ограничение сотрудника по разрешённым кастомным подэтапам: заявка без
                # подэтапа (sub_status IS NULL) не относится ни к какому подэтапу — не
                # скрываем её из-за этого ограничения, оно затрагивает только заявки,
                # у которых подэтап явно проставлен и не входит в разрешённый список.
                if allowed_substatuses is not None:
                    sql += " AND (lc.sub_status IS NULL OR lc.sub_status = ANY(%s))"
                    params.append(allowed_substatuses)
                # Видимость по ответственному: own — только свои заявки,
                # own_free — свои + СВОБОДНЫЕ (именно НОВЫЕ обращения без ответственного,
                # status='new'). Заявка без ответственного на более позднем этапе
                # (например замер/монтаж без назначенного менеджера) — это не «взять
                # в работу», а недосмотр, её должен явно назначить владелец/руководитель,
                # поэтому сотруднику она не показывается автоматически.
                if not is_master and orders_scope == "own":
                    sql += " AND lc.assigned_to = %s"
                    params.append(master_uid)
                elif not is_master and orders_scope == "own_free":
                    sql += " AND (lc.assigned_to = %s OR (lc.assigned_to IS NULL AND status = 'new'))"
                    params.append(master_uid)
                if search:
                    sql += " AND (client_name ILIKE %s OR phone ILIKE %s OR address ILIKE %s)"
                    params.extend([f"%{search}%"] * 3)
                sql += " ORDER BY created_at DESC"
                cur.execute(sql, params)
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                tags = body.get("tags", [])
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='mospotolkipro@gmail.com'")
                master_id_row = cur.fetchone()
                master_id = master_id_row[0] if master_id_row else None
                final_company_id = company_id if company_id is not None else master_id

                cur.execute(
                    f"""INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, status, client_status, measure_date, install_date,
                         notes, address, area, budget, source, created_via,
                         contract_sum, prepayment, responsible_phone, map_link, tags, company_id, next_call_date, is_service, status_changed_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                        RETURNING id""",
                    (
                        body.get("session_id", f"manual_{datetime.now().timestamp()}"),
                        body.get("client_name", ""),
                        body.get("phone", ""),
                        body.get("status", "new"),
                        body.get("client_status"),
                        body.get("measure_date"),
                        body.get("install_date"),
                        body.get("notes", ""),
                        body.get("address", ""),
                        body.get("area"),
                        body.get("budget"),
                        body.get("source"),
                        "manual",
                        body.get("contract_sum"),
                        body.get("prepayment"),
                        body.get("responsible_phone", ""),
                        body.get("map_link", ""),
                        tags,
                        final_company_id,
                        default_next_call_date(),
                        bool(body.get("is_service", False)),
                    )
                )
                new_id = cur.fetchone()[0]

                # Авто-канбан — первая колонка (только своей компании)
                cur.execute(f"SELECT id FROM {SCHEMA}.kanban_columns WHERE company_id=%s ORDER BY position LIMIT 1", (final_company_id,))
                first_col = cur.fetchone()
                if first_col:
                    col_id = first_col[0]
                    cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s AND company_id=%s", (col_id, final_company_id))
                    pos = cur.fetchone()[0]
                    name = body.get("client_name", "") or "Новый клиент"
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.kanban_cards (column_id, client_id, title, phone, priority, position, company_id)
                            VALUES (%s,%s,%s,%s,'medium',%s,%s)""",
                        (col_id, new_id, name, body.get("phone", ""), pos, final_company_id)
                    )

                # Авто-календарь для замера
                measure_date = body.get("measure_date")
                if measure_date:
                    name = body.get("client_name", "") or "Клиент"
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.calendar_events (client_id, title, description, event_type, start_time, color, company_id)
                            VALUES (%s,%s,%s,'measure',%s,'#f59e0b',%s)""",
                        (new_id, f"Замер: {name}", body.get("phone",""), measure_date, company_id)
                    )

                # Авто-календарь для монтажа
                install_date = body.get("install_date")
                if install_date:
                    name = body.get("client_name", "") or "Клиент"
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.calendar_events (client_id, title, description, event_type, start_time, color, company_id)
                            VALUES (%s,%s,%s,'install',%s,'#f97316',%s)""",
                        (new_id, f"Монтаж: {name}", body.get("address",""), install_date, company_id)
                    )

                conn.commit()
                return ok({"id": new_id})

            if method == "PUT" and qs.get("action") == "restore":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                if company_id is not None:
                    cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    owner_row = cur.fetchone()
                    if not owner_row or owner_row[0] != company_id:
                        return err("Клиент не найден", 404)
                cur.execute(
                    f"""UPDATE {SCHEMA}.live_chats
                        SET status = COALESCE(status_before_removal, 'new'), status_before_removal = NULL, removed_at = NULL
                        WHERE id=%s AND status='deleted'
                        RETURNING status""",
                    (int(cid),)
                )
                row = cur.fetchone()
                if not row:
                    return err("Заявка не найдена или уже восстановлена", 404)
                conn.commit()
                return ok({"restored": True, "status": row[0]})

            if method == "PUT":
                cid = qs.get("id")
                if not cid:
                    return err("id required")

                # Защита от IDOR: не-мастер может менять только клиентов своей компании.
                # Мастер (company_id is None) видит и правит всё, остальным — строгая проверка владения.
                if company_id is not None:
                    cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    owner_row = cur.fetchone()
                    if not owner_row or owner_row[0] != company_id:
                        return err("Клиент не найден", 404)

                # Ограничение сотрудника по разрешённым этапам воронки:
                # нельзя трогать заказ, который сейчас на недоступном этапе,
                # и нельзя переводить заказ на недоступный сотруднику этап
                if allowed_statuses is not None:
                    cur.execute(f"SELECT status FROM {SCHEMA}.live_chats WHERE id=%s AND company_id=%s", (int(cid), company_id))
                    cur_row = cur.fetchone()
                    if not cur_row or cur_row[0] not in allowed_statuses:
                        return err("Нет доступа к этому этапу воронки", 403)
                    new_status = body.get("status")
                    if new_status and new_status not in allowed_statuses:
                        return err("Нет доступа для перевода на этот этап", 403)

                # Ограничение сотрудника по разрешённым кастомным подэтапам (аналогично
                # allowed_statuses выше, но для order_substatuses): нельзя трогать заказ,
                # у которого сейчас стоит недоступный подэтап, и нельзя переводить заказ
                # на недоступный сотруднику подэтап. sub_status = NULL (подэтап не выбран)
                # ограничением не считается — блокируем только явно недоступный подэтап.
                if allowed_substatuses is not None:
                    cur.execute(f"SELECT sub_status FROM {SCHEMA}.live_chats WHERE id=%s AND company_id=%s", (int(cid), company_id))
                    cur_sub_row = cur.fetchone()
                    cur_sub = cur_sub_row[0] if cur_sub_row else None
                    if cur_sub is not None and cur_sub not in allowed_substatuses:
                        return err("Нет доступа к этому подэтапу", 403)
                    new_sub = body.get("sub_status")
                    if new_sub is not None and str(new_sub) not in allowed_substatuses:
                        return err("Нет доступа для перевода на этот подэтап", 403)

                # Ответственный за заявку: кто первым взял её в работу, тот и закрепляется.
                # Если заявка ещё ничья (assigned_to IS NULL) — записываем текущего сотрудника.
                # Если уже закреплена за другим и сотруднику разрешено править только свои —
                # изменение отклоняем, чтобы чужую заявку нельзя было перехватить.
                if not is_master and master_uid:
                    cur.execute(f"SELECT assigned_to FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    a_row = cur.fetchone()
                    current_owner = a_row[0] if a_row else None
                    if current_owner is None:
                        cur.execute(f"UPDATE {SCHEMA}.live_chats SET assigned_to=%s WHERE id=%s",
                                    (master_uid, int(cid)))
                        conn.commit()
                    elif orders_edit_own_only and current_owner != master_uid:
                        return err("Заявка закреплена за другим сотрудником", 403)

                # Ручная смена ответственного — отдельно от автозакрепления выше.
                # Разрешено владельцу/мастеру всегда, сотруднику — только если ему явно
                # выдано право orders_reassign. new_assigned_to == null — снять ответственного
                # (заявка снова станет "ничьей"), число — назначить конкретного сотрудника.
                if "assigned_to" in body:
                    if not (is_master or is_owner or orders_reassign):
                        return err("Нет прав менять ответственного", 403)
                    new_assigned_to = body.get("assigned_to")
                    scope_company = company_id if company_id is not None else None
                    if new_assigned_to is not None:
                        # Проверяем, что назначаемый — сотрудник этой же компании
                        check_company = scope_company
                        if check_company is None:
                            cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                            crow = cur.fetchone()
                            check_company = crow[0] if crow else None
                        cur.execute(f"""
                            SELECT id FROM {SCHEMA}.users
                            WHERE id=%s AND company_id=%s AND role='manager' AND removed_at IS NULL
                        """, (int(new_assigned_to), check_company))
                        if not cur.fetchone():
                            return err("Сотрудник не найден в этой компании", 404)
                        cur.execute(f"UPDATE {SCHEMA}.live_chats SET assigned_to=%s WHERE id=%s",
                                    (int(new_assigned_to), int(cid)))
                    else:
                        cur.execute(f"UPDATE {SCHEMA}.live_chats SET assigned_to=NULL WHERE id=%s", (int(cid),))
                    conn.commit()

                # Остальные 4 роли ответственных (2 линия, замерщик, технолог, монтажник) —
                # та же логика прав, что и у assigned_to: менять может владелец/мастер
                # или сотрудник с правом orders_reassign. Каждая роль — независимое поле,
                # заявка может быть одновременно закреплена за разными людьми по ролям.
                ROLE_FIELDS = ["assigned_manager2", "assigned_measurer", "assigned_technologist", "assigned_installer"]
                for role_field in ROLE_FIELDS:
                    if role_field in body:
                        if not (is_master or is_owner or orders_reassign):
                            return err("Нет прав менять ответственного", 403)
                        new_val = body.get(role_field)
                        if new_val is not None:
                            check_company = company_id
                            if check_company is None:
                                cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                                crow = cur.fetchone()
                                check_company = crow[0] if crow else None
                            cur.execute(f"""
                                SELECT id FROM {SCHEMA}.users
                                WHERE id=%s AND company_id=%s AND role='manager' AND removed_at IS NULL
                            """, (int(new_val), check_company))
                            if not cur.fetchone():
                                return err("Сотрудник не найден в этой компании", 404)
                            cur.execute(f"UPDATE {SCHEMA}.live_chats SET {role_field}=%s WHERE id=%s",
                                        (int(new_val), int(cid)))
                        else:
                            cur.execute(f"UPDATE {SCHEMA}.live_chats SET {role_field}=NULL WHERE id=%s", (int(cid),))
                        conn.commit()

                # При переводе на этап «В работе» (call) без явно указанного подэтапа —
                # автоматически ставим подэтап «Новый в работе» (если он есть у компании).
                new_status_val = body.get("status")
                if new_status_val == ("ca" "ll") and "sub_status" not in body:
                    cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    orow = cur.fetchone()
                    owner_cmp = (orow[0] if orow else None) or company_id
                    if owner_cmp is not None:
                        cur.execute(f"""SELECT id FROM {SCHEMA}.order_substatuses
                            WHERE company_id=%s AND parent_status='working' AND label='Новый в работе'
                            ORDER BY position, id LIMIT 1""", (owner_cmp,))
                        srow = cur.fetchone()
                        if srow:
                            body["sub_status"] = str(srow[0])

                # При быстром переводе на этап «Замер» (кнопка «Далее», drag&drop) без явной
                # даты и без явного подэтапа — не открываем модалку "укажите дату", а сразу
                # ставим подэтап «Дата замера не назначена». Дату менеджер добавит позже,
                # когда согласует её с клиентом.
                if new_status_val == "measure" and "sub_status" not in body and not body.get("measure_date"):
                    cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    orow = cur.fetchone()
                    owner_cmp = (orow[0] if orow else None) or company_id
                    if owner_cmp is not None:
                        cur.execute(f"""SELECT id FROM {SCHEMA}.order_substatuses
                            WHERE company_id=%s AND parent_status='measures' AND label='Дата замера не назначена'
                            ORDER BY position, id LIMIT 1""", (owner_cmp,))
                        srow = cur.fetchone()
                        if srow:
                            body["sub_status"] = str(srow[0])

                # Проверка прав на редактирование дат: мастер/владелец могут всегда,
                # сотруднику — только если явно не запрещено (dates_edit_rights).
                if not (is_master or is_owner):
                    for _df in ("desired_measure_date", "desired_install_date", "measure_date", "install_date"):
                        if _df in body and not dates_edit_rights.get(_df, True):
                            return err("Нет прав редактировать эту дату", 403)

                # Если менеджер вручную указывает дату замера (и явно не выбрал другой
                # подэтап), а у заявки сейчас висит подэтап «Дата замера не назначена» —
                # он потерял смысл (дата уже есть), поэтому снимаем его. sub_status=NULL
                # достаточно: сам статус заявки (status='measure') уже подписан «Замер
                # назначен» (см. STATUS_LABELS на фронте) — SubstatusPicker без активного
                # подэтапа показывает именно это как fallback, ничего дополнительно
                # ставить не нужно.
                if body.get("measure_date") and "sub_status" not in body:
                    cur.execute(f"""SELECT os.label FROM {SCHEMA}.live_chats lc
                        LEFT JOIN {SCHEMA}.order_substatuses os ON os.id::text = lc.sub_status
                        WHERE lc.id=%s""", (int(cid),))
                    cur_sub_row = cur.fetchone()
                    if cur_sub_row and cur_sub_row[0] == "Дата замера не назначена":
                        body["sub_status"] = None

                # Поля взаимоисключающие: если менеджер ставит «звонить не нужно» и явно
                # не передал новую дату звонка — гасим next_call_date, чтобы в карточке
                # не висело одновременно и напоминание, и отметка «звонить не нужно».
                if body.get("no_call_needed") is True and "next_call_date" not in body:
                    body["next_call_date"] = None
                if body.get("next_call_date") and "no_call_needed" not in body:
                    body["no_call_needed"] = False

                # Источник (source) определяется автоматически для заявок из интеграций
                # (Avito, квиз и т.п.) — редактировать его руками можно только у заявок,
                # созданных вручную в CRM (created_via='manual'). Тихо игнорируем попытку
                # изменить source у остальных, не роняя весь запрос ошибкой.
                if "source" in body:
                    cur.execute(f"SELECT created_via FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    cv_row = cur.fetchone()
                    if not cv_row or cv_row[0] != "manual":
                        body.pop("source")

                # Нельзя назначить замер/монтаж, не указав дату — иначе этап висит
                # «назначенным», а когда именно ехать, никто не знает. Дата может
                # прийти этим же запросом (модалка шлёт статус+дату вместе) либо уже
                # быть сохранена в карточке ранее.
                REQUIRED_DATE_BY_STATUS = {
                    "measure": ("measure_date", "Укажите дату замера"),
                    "install_scheduled": ("install_date", "Укажите дату монтажа"),
                }
                new_st = body.get("status")
                if new_st in REQUIRED_DATE_BY_STATUS:
                    date_field, err_msg = REQUIRED_DATE_BY_STATUS[new_st]
                    date_val = body.get(date_field)
                    if not date_val:
                        cur.execute(f"SELECT {date_field} FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                        d_row = cur.fetchone()
                        date_val = d_row[0] if d_row else None
                    # Исключение: подэтап «Дата замера не назначена» специально придуман
                    # для замера без даты (клиент ещё не согласовал время) — для него
                    # дату не требуем, в отличие от остальных подэтапов замера.
                    skip_date_check = False
                    if new_st == "measure" and body.get("sub_status"):
                        cur.execute(f"""SELECT label FROM {SCHEMA}.order_substatuses WHERE id=%s""",
                                    (int(body["sub_status"]),))
                        lb_row = cur.fetchone()
                        if lb_row and lb_row[0] == "Дата замера не назначена":
                            skip_date_check = True
                    if not date_val and not skip_date_check:
                        return err(err_msg)

                sets, vals = [], []
                for f in ALL_CLIENT_FIELDS:
                    if f in body:
                        if f == "tags":
                            sets.append(f"tags = %s")
                            vals.append(body[f])
                        else:
                            sets.append(f"{f} = %s")
                            vals.append(body[f] if body[f] != "" else None)
                if not sets:
                    # Запрос мог целиком состоять из assigned_to (смена ответственного) —
                    # это поле не входит в ALL_CLIENT_FIELDS и обрабатывается отдельно
                    # ВЫШЕ по коду, уже успешно. Раньше в этом случае здесь всё равно
                    # возвращалась ошибка "nothing to update", и карточка показывала
                    # красный текст под уже сохранённым ответственным.
                    if "assigned_to" in body:
                        return ok({"ok": True})
                    return err("nothing to update")
                sets.append("updated_at = NOW()")
                # Момент входа на этап — обновляем только при реальной смене статуса,
                # чтобы таймер «сколько на этапе» не сбрасывался при любой правке карточки.
                # Метка (tags) сбрасывается при реальном переходе на другой этап — метки
                # "Недозвон"/"Перезвонить" относятся к текущему этапу и не должны переезжать
                # вместе с заказом дальше по воронке. Если tags передан явно этим же запросом —
                # уважаем явное значение и не перетираем его.
                if "status" in body and "tags" not in body:
                    cur.execute(f"SELECT status FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    st_row = cur.fetchone()
                    if st_row and st_row[0] != body["status"]:
                        sets.append("tags = '{}'")
                if "status" in body:
                    sets.append("status_changed_at = NOW()")
                    # closed_at — момент фактического закрытия сделки, для денежных отчётов
                    # (выручка считается по месяцу получения, а не по месяцу создания заявки).
                    # Фиксируем один раз при первом переходе в 'done' и НЕ трогаем при
                    # повторных правках карточки, пока сделка остаётся закрытой.
                    # Если сделку вернули из 'done' в работу — сбрасываем, чтобы при
                    # повторном закрытии дата обновилась на актуальную.
                    if body["status"] == "done":
                        sets.append("closed_at = COALESCE(closed_at, NOW())")
                    else:
                        sets.append("closed_at = NULL")
                vals.append(int(cid))
                cur.execute(f"UPDATE {SCHEMA}.live_chats SET {', '.join(sets)} WHERE id = %s", vals)

                # Синхронизируем дату замера в календаре
                if "measure_date" in body:
                    cur.execute(f"SELECT client_name FROM {SCHEMA}.live_chats WHERE id = %s", (int(cid),))
                    nr = cur.fetchone()
                    name = (nr[0] if nr else "") or "Клиент"
                    cur.execute(f"SELECT id FROM {SCHEMA}.calendar_events WHERE client_id=%s AND event_type='measure' LIMIT 1", (int(cid),))
                    ex = cur.fetchone()
                    if body["measure_date"]:
                        if ex:
                            # Обновляем существующее, включая company_id если он был null
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time=%s, title=%s, company_id=COALESCE(company_id,%s) WHERE id=%s",
                                        (body["measure_date"], f"Замер: {name}", company_id, ex[0]))
                        else:
                            cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events (client_id,title,event_type,start_time,color,company_id)
                                VALUES (%s,%s,'measure',%s,'#f59e0b',%s)""", (int(cid), f"Замер: {name}", body["measure_date"], company_id))
                    else:
                        # Дата удалена — обнуляем start_time (скрываем из диапазона)
                        if ex:
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time='2000-01-01'::timestamptz WHERE id=%s", (ex[0],))

                # Синхронизируем дату монтажа в календаре
                if "install_date" in body:
                    cur.execute(f"SELECT client_name FROM {SCHEMA}.live_chats WHERE id = %s", (int(cid),))
                    nr = cur.fetchone()
                    name = (nr[0] if nr else "") or "Клиент"
                    cur.execute(f"SELECT id FROM {SCHEMA}.calendar_events WHERE client_id=%s AND event_type='install' LIMIT 1", (int(cid),))
                    ex = cur.fetchone()
                    if body["install_date"]:
                        if ex:
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time=%s, title=%s, company_id=COALESCE(company_id,%s) WHERE id=%s",
                                        (body["install_date"], f"Монтаж: {name}", company_id, ex[0]))
                        else:
                            cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events (client_id,title,event_type,start_time,color,company_id)
                                VALUES (%s,%s,'install',%s,'#f97316',%s)""", (int(cid), f"Монтаж: {name}", body["install_date"], company_id))
                    else:
                        if ex:
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time='2000-01-01'::timestamptz WHERE id=%s", (ex[0],))

                # Синхронизируем желаемые даты замера/монтажа в календаре — их ставит
                # 1 линия при первом контакте с клиентом, ещё не согласовано со
                # специалистом. Отдельные типы событий, чтобы не путать с фактическими.
                DESIRED_DATE_SYNC = [
                    ("desired_measure_date", "desired_measure", "Желаемый замер", "#38bdf8"),
                    ("desired_install_date", "desired_install", "Желаемый монтаж", "#a78bfa"),
                ]
                for date_field, ev_type, ev_title, ev_color in DESIRED_DATE_SYNC:
                    if date_field in body:
                        cur.execute(f"SELECT client_name FROM {SCHEMA}.live_chats WHERE id = %s", (int(cid),))
                        nr = cur.fetchone()
                        name = (nr[0] if nr else "") or "Клиент"
                        cur.execute(f"SELECT id FROM {SCHEMA}.calendar_events WHERE client_id=%s AND event_type=%s LIMIT 1", (int(cid), ev_type))
                        ex = cur.fetchone()
                        if body[date_field]:
                            if ex:
                                cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time=%s, title=%s, company_id=COALESCE(company_id,%s) WHERE id=%s",
                                            (body[date_field], f"{ev_title}: {name}", company_id, ex[0]))
                            else:
                                cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events (client_id,title,event_type,start_time,color,company_id)
                                    VALUES (%s,%s,%s,%s,%s,%s)""", (int(cid), f"{ev_title}: {name}", ev_type, body[date_field], ev_color, company_id))
                        else:
                            if ex:
                                cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time='2000-01-01'::timestamptz WHERE id=%s", (ex[0],))

                # Синхронизируем дату следующего звонка в календаре (блок «Касания»,
                # заполняется вручную сотрудником — напоминание для повторного созвона).
                if "next_call_date" in body:
                    cur.execute(f"SELECT client_name FROM {SCHEMA}.live_chats WHERE id = %s", (int(cid),))
                    nr = cur.fetchone()
                    name = (nr[0] if nr else "") or "Клиент"
                    cur.execute(f"SELECT id FROM {SCHEMA}.calendar_events WHERE client_id=%s AND event_type='next_call' LIMIT 1", (int(cid),))
                    ex = cur.fetchone()
                    if body["next_call_date"]:
                        if ex:
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time=%s, title=%s, company_id=COALESCE(company_id,%s) WHERE id=%s",
                                        (body["next_call_date"], f"Следующий звонок: {name}", company_id, ex[0]))
                        else:
                            cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events (client_id,title,event_type,start_time,color,company_id)
                                VALUES (%s,%s,'next_call',%s,'#3b82f6',%s)""", (int(cid), f"Следующий звонок: {name}", body["next_call_date"], company_id))
                    else:
                        if ex:
                            cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time='2000-01-01'::timestamptz WHERE id=%s", (ex[0],))

                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                cid = qs.get("id")
                if not cid:
                    return err("id required")
                # Защита от IDOR: не-мастер может удалять только клиентов своей компании.
                if company_id is not None:
                    cur.execute(f"SELECT company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(cid),))
                    owner_row = cur.fetchone()
                    if not owner_row or owner_row[0] != company_id:
                        return err("Клиент не найден", 404)
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET client_id=NULL WHERE client_id=%s", (int(cid),))
                cur.execute(f"UPDATE {SCHEMA}.calendar_events SET client_id=NULL WHERE client_id=%s", (int(cid),))
                cur.execute(
                    f"""UPDATE {SCHEMA}.live_chats
                        SET status_before_removal = status, removed_at = NOW(), status='deleted'
                        WHERE id=%s""",
                    (int(cid),)
                )
                conn.commit()
                return ok({"deleted": True})

        # ── CLIENT STATUSES ───────────────────────────────────────────────────
        if resource == "client_statuses":
            # Мастер раньше был жёстко привязан к company_id=2 (ошибка). Теперь у мастера
            # своя приватная конфигурация статусов на основе его собственного uid.
            cid_filter = company_id if company_id is not None else master_uid

            if method == "GET":
                cur.execute(f"""
                    SELECT id, name, color, sort_order FROM {SCHEMA}.client_statuses
                    WHERE company_id = %s ORDER BY sort_order, id
                """, (cid_filter,))
                rows = [{"id": r[0], "name": r[1], "color": r[2], "sort_order": r[3]} for r in cur.fetchall()]
                # Если нет статусов — вернуть дефолтные
                if not rows:
                    defaults = [
                        ("Новый", "#6366f1"), ("Активный", "#10b981"),
                        ("VIP", "#f59e0b"), ("Холодный", "#64748b"), ("Отказник", "#ef4444"),
                    ]
                    for i, (name, color) in enumerate(defaults):
                        cur.execute(f"""
                            INSERT INTO {SCHEMA}.client_statuses (company_id, name, color, sort_order)
                            VALUES (%s, %s, %s, %s) RETURNING id
                        """, (cid_filter, name, color, i))
                        new_id = cur.fetchone()[0]
                        rows.append({"id": new_id, "name": name, "color": color, "sort_order": i})
                    conn.commit()
                return ok(rows)

            if method == "POST":
                name = (body.get("name") or "").strip()
                color = body.get("color", "#7c3aed")
                if not name:
                    return err("name required")
                cur.execute(f"SELECT COALESCE(MAX(sort_order)+1,0) FROM {SCHEMA}.client_statuses WHERE company_id=%s", (cid_filter,))
                sort_order = cur.fetchone()[0]
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.client_statuses (company_id, name, color, sort_order)
                    VALUES (%s,%s,%s,%s) RETURNING id
                """, (cid_filter, name, color, sort_order))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id, "name": name, "color": color, "sort_order": sort_order})

            if method == "PUT":
                sid = qs.get("id") or body.get("id")
                if not sid:
                    return err("id required")
                sets, vals = [], []
                if "name" in body:
                    sets.append("name=%s"); vals.append(body["name"])
                if "color" in body:
                    sets.append("color=%s"); vals.append(body["color"])
                if "sort_order" in body:
                    sets.append("sort_order=%s"); vals.append(body["sort_order"])
                if not sets:
                    return err("nothing to update")
                vals.extend([int(sid), cid_filter])
                cur.execute(f"UPDATE {SCHEMA}.client_statuses SET {', '.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                sid = qs.get("id") or body.get("id")
                if not sid:
                    return err("id required")
                # Снимаем статус у клиентов которые его используют
                cur.execute(f"SELECT name FROM {SCHEMA}.client_statuses WHERE id=%s AND company_id=%s", (int(sid), cid_filter))
                row = cur.fetchone()
                if row:
                    cur.execute(f"UPDATE {SCHEMA}.live_chats SET client_status=NULL WHERE client_status=%s AND company_id=%s", (row[0], cid_filter))
                cur.execute(f"DELETE FROM {SCHEMA}.client_statuses WHERE id=%s AND company_id=%s", (int(sid), cid_filter))
                conn.commit()
                return ok({"ok": True})

        # ── ORDER SOURCES (Источники заявок) ──────────────────────────────────
        if resource == "order_sources":
            cid_filter = company_id if company_id is not None else master_uid

            if method == "GET":
                cur.execute(f"""
                    SELECT id, name, color, sort_order FROM {SCHEMA}.order_sources
                    WHERE company_id = %s ORDER BY sort_order, id
                """, (cid_filter,))
                rows = [{"id": r[0], "name": r[1], "color": r[2], "sort_order": r[3]} for r in cur.fetchall()]
                if not rows:
                    defaults = [
                        ("Авито", "#10b981"), ("Директ", "#3b82f6"), ("Квиз", "#f59e0b"),
                    ]
                    for i, (name, color) in enumerate(defaults):
                        cur.execute(f"""
                            INSERT INTO {SCHEMA}.order_sources (company_id, name, color, sort_order)
                            VALUES (%s, %s, %s, %s) RETURNING id
                        """, (cid_filter, name, color, i))
                        new_id = cur.fetchone()[0]
                        rows.append({"id": new_id, "name": name, "color": color, "sort_order": i})
                    conn.commit()
                return ok(rows)

            if method == "POST":
                name = (body.get("name") or "").strip()
                color = body.get("color", "#7c3aed")
                if not name:
                    return err("name required")
                cur.execute(f"SELECT COALESCE(MAX(sort_order)+1,0) FROM {SCHEMA}.order_sources WHERE company_id=%s", (cid_filter,))
                sort_order = cur.fetchone()[0]
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.order_sources (company_id, name, color, sort_order)
                        VALUES (%s,%s,%s,%s) RETURNING id
                    """, (cid_filter, name, color, sort_order))
                    new_id = cur.fetchone()[0]
                    conn.commit()
                except psycopg2.IntegrityError:
                    conn.rollback()
                    return err("Источник с таким названием уже есть", 409)
                return ok({"id": new_id, "name": name, "color": color, "sort_order": sort_order})

            if method == "PUT":
                sid = qs.get("id") or body.get("id")
                if not sid:
                    return err("id required")
                sets, vals = [], []
                if "name" in body:
                    sets.append("name=%s"); vals.append(body["name"])
                if "color" in body:
                    sets.append("color=%s"); vals.append(body["color"])
                if "sort_order" in body:
                    sets.append("sort_order=%s"); vals.append(body["sort_order"])
                if not sets:
                    return err("nothing to update")

                # Поле source у заказов (live_chats) хранит НАЗВАНИЕ источника (текст, не FK).
                # При переименовании источника нужно каскадно переименовать его и во всех
                # заказах, у которых стоит старое название — иначе они отвяжутся от источника.
                old_name = None
                if "name" in body:
                    cur.execute(f"SELECT name FROM {SCHEMA}.order_sources WHERE id=%s AND company_id=%s", (int(sid), cid_filter))
                    row = cur.fetchone()
                    old_name = row[0] if row else None

                vals.extend([int(sid), cid_filter])
                cur.execute(f"UPDATE {SCHEMA}.order_sources SET {', '.join(sets)} WHERE id=%s AND company_id=%s", vals)

                if old_name and old_name != body["name"]:
                    cur.execute(
                        f"UPDATE {SCHEMA}.live_chats SET source=%s WHERE source=%s AND company_id=%s",
                        (body["name"], old_name, cid_filter)
                    )

                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                sid = qs.get("id") or body.get("id")
                if not sid:
                    return err("id required")
                cur.execute(f"DELETE FROM {SCHEMA}.order_sources WHERE id=%s AND company_id=%s", (int(sid), cid_filter))
                conn.commit()
                return ok({"ok": True})

        # ── EXPENSE CATEGORIES (Справочник статей расходов) ───────────────────
        if resource == "expense-categories":
            cid_filter = company_id if company_id is not None else master_uid

            if method == "GET":
                cur.execute(f"""
                    SELECT id, name, kind, color, sort_order
                    FROM {SCHEMA}.expense_categories
                    WHERE company_id = %s AND is_active = TRUE
                    ORDER BY sort_order, id
                """, (cid_filter,))
                rows = [{"id": r[0], "name": r[1], "kind": r[2], "color": r[3], "sort_order": r[4]} for r in cur.fetchall()]
                if not rows:
                    # Базовый набор статей: реклама привязывается к источнику,
                    # остальные — общие расходы бизнеса. Пользователь правит список сам.
                    defaults = [
                        ("Реклама — услуга", "ad_service", "#f97316"),
                        ("Реклама — бюджет", "ad_budget",  "#fb923c"),
                        ("Зарплата",         "salary",     "#8b5cf6"),
                        ("Аренда",           "general",    "#06b6d4"),
                        ("Налоги",           "general",    "#ef4444"),
                        ("Прочее",           "general",    "#64748b"),
                    ]
                    for i, (name, kind, color) in enumerate(defaults):
                        cur.execute(f"""
                            INSERT INTO {SCHEMA}.expense_categories (company_id, name, kind, color, sort_order)
                            VALUES (%s,%s,%s,%s,%s) RETURNING id
                        """, (cid_filter, name, kind, color, i))
                        rows.append({"id": cur.fetchone()[0], "name": name, "kind": kind, "color": color, "sort_order": i})
                    conn.commit()
                return ok(rows)

            if method == "POST":
                name = (body.get("name") or "").strip()
                if not name:
                    return err("name required")
                kind  = body.get("kind") or "general"
                color = body.get("color") or "#f97316"
                cur.execute(f"SELECT COALESCE(MAX(sort_order)+1,0) FROM {SCHEMA}.expense_categories WHERE company_id=%s", (cid_filter,))
                sort_order = cur.fetchone()[0]
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.expense_categories (company_id, name, kind, color, sort_order)
                    VALUES (%s,%s,%s,%s,%s) RETURNING id
                """, (cid_filter, name, kind, color, sort_order))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id, "name": name, "kind": kind, "color": color, "sort_order": sort_order})

            if method == "PUT":
                cid_ = qs.get("id") or body.get("id")
                if not cid_:
                    return err("id required")
                sets, vals = [], []
                for f in ("name", "kind", "color", "sort_order"):
                    if f in body:
                        sets.append(f"{f}=%s"); vals.append(body[f])
                if not sets:
                    return err("nothing to update")
                vals.extend([int(cid_), cid_filter])
                cur.execute(f"UPDATE {SCHEMA}.expense_categories SET {', '.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                cid_ = qs.get("id") or body.get("id")
                if not cid_:
                    return err("id required")
                # Мягкое удаление: расходы прошлых периодов не теряют статью
                cur.execute(f"UPDATE {SCHEMA}.expense_categories SET is_active=FALSE WHERE id=%s AND company_id=%s", (int(cid_), cid_filter))
                conn.commit()
                return ok({"ok": True})

        # ── EXPENSES (Вложения: реклама, ЗП, аренда, налоги, прочее) ──────────
        if resource == "expenses":
            cid_filter = company_id if company_id is not None else master_uid

            if method == "GET":
                sql = f"""
                    SELECT e.id, e.category_id, ec.name, ec.kind, ec.color,
                           e.source_id, os.name, e.employee, e.amount, e.spent_on, e.comment
                    FROM {SCHEMA}.expenses e
                    LEFT JOIN {SCHEMA}.expense_categories ec ON ec.id = e.category_id
                    LEFT JOIN {SCHEMA}.order_sources os ON os.id = e.source_id
                    WHERE e.company_id = %s
                """
                params = [cid_filter]
                if qs.get("from"):
                    sql += " AND e.spent_on >= %s"; params.append(qs["from"])
                if qs.get("to"):
                    sql += " AND e.spent_on <= %s"; params.append(qs["to"])
                sql += " ORDER BY e.spent_on DESC, e.id DESC"
                cur.execute(sql, params)
                return ok([{
                    "id": r[0], "category_id": r[1], "category_name": r[2] or "Без статьи",
                    "category_kind": r[3] or "general", "category_color": r[4] or "#64748b",
                    "source_id": r[5], "source_name": r[6], "employee": r[7],
                    "amount": float(r[8] or 0), "spent_on": r[9].isoformat() if r[9] else None,
                    "comment": r[10],
                } for r in cur.fetchall()])

            if method == "POST":
                amount = body.get("amount")
                if amount in (None, ""):
                    return err("amount required")
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.expenses (company_id, category_id, source_id, employee, amount, spent_on, comment, created_by)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
                """, (
                    cid_filter,
                    int(body["category_id"]) if body.get("category_id") else None,
                    int(body["source_id"]) if body.get("source_id") else None,
                    (body.get("employee") or "").strip() or None,
                    float(amount),
                    body.get("spent_on") or datetime.now().date().isoformat(),
                    (body.get("comment") or "").strip() or None,
                    master_uid,
                ))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                eid = qs.get("id") or body.get("id")
                if not eid:
                    return err("id required")
                sets, vals = [], []
                if "category_id" in body:
                    sets.append("category_id=%s"); vals.append(int(body["category_id"]) if body["category_id"] else None)
                if "source_id" in body:
                    sets.append("source_id=%s"); vals.append(int(body["source_id"]) if body["source_id"] else None)
                if "employee" in body:
                    sets.append("employee=%s"); vals.append((body.get("employee") or "").strip() or None)
                if "amount" in body:
                    sets.append("amount=%s"); vals.append(float(body["amount"] or 0))
                if "spent_on" in body:
                    sets.append("spent_on=%s"); vals.append(body["spent_on"])
                if "comment" in body:
                    sets.append("comment=%s"); vals.append((body.get("comment") or "").strip() or None)
                if not sets:
                    return err("nothing to update")
                sets.append("updated_at=now()")
                vals.extend([int(eid), cid_filter])
                cur.execute(f"UPDATE {SCHEMA}.expenses SET {', '.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"ok": True})

            if method == "DELETE":
                eid = qs.get("id") or body.get("id")
                if not eid:
                    return err("id required")
                cur.execute(f"DELETE FROM {SCHEMA}.expenses WHERE id=%s AND company_id=%s", (int(eid), cid_filter))
                conn.commit()
                return ok({"ok": True})

        # ── STATS ─────────────────────────────────────────────────────────────
        if resource == "stats":
            cache_key = company_id if company_id is not None else "__master__"
            cached = _STATS_CACHE.get(cache_key)
            if cached and (datetime.now() - cached["at"]).total_seconds() < STATS_CACHE_TTL_SEC:
                return ok(cached["data"])

            S = SCHEMA
            W = "WHERE status != 'deleted'"
            if company_id is not None:
                W += f" AND company_id = {int(company_id)}"

            # Воронка — количество по каждому статусу
            cur.execute(f"SELECT status, COUNT(*) FROM {S}.live_chats {W} GROUP BY status")
            status_dist = {r[0]: r[1] for r in cur.fetchall()}

            # Общие счётчики
            total_leads   = sum(status_dist.get(s, 0) for s in LEAD_STATUSES)
            total_orders  = sum(status_dist.get(s, 0) for s in ORDER_STATUSES if s != 'cancelled')
            total_done    = status_dist.get('done', 0)
            total_cancel  = status_dist.get('cancelled', 0)
            total_all     = sum(status_dist.values())
            went_measure  = sum(status_dist.get(s, 0) for s in ["measure","measured","contract","prepaid","install_scheduled","install_done","extra_paid","done"])
            went_contract = sum(status_dist.get(s, 0) for s in ["contract","prepaid","install_scheduled","install_done","extra_paid","done"])

            # Предстоящие события — только актуальные статусы
            cid_filter = f" AND company_id = {int(company_id)}" if company_id is not None else ""
            cur.execute(f"SELECT COUNT(*) FROM {S}.live_chats WHERE measure_date >= NOW() AND status = 'measure'{cid_filter}")
            upcoming_measures = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {S}.live_chats WHERE install_date >= NOW() AND status = 'install_scheduled'{cid_filter}")
            upcoming_installs = cur.fetchone()[0]

            # Финансы
            cur.execute(f"SELECT COALESCE(SUM(contract_sum),0), COALESCE(SUM(prepayment),0), COALESCE(SUM(extra_payment),0), COALESCE(SUM(extra_agreement_sum),0) FROM {S}.live_chats WHERE status != 'deleted'{cid_filter}")
            r = cur.fetchone()
            total_contract, total_prepayment, total_extra, total_extra_agreement = float(r[0]), float(r[1]), float(r[2]), float(r[3])

            # "Получено" — разбивка по стадиям, считаем только ПОДТВЕРЖДЁННЫЕ платежи:
            #   Замеры  — заявка ещё без договора, денег с клиента не берём (всегда 0)
            #   Монтажи — договор подписан, работа идёт (подтверждённая предоплата)
            #   Финал   — сделка завершена (вся подтверждённая сумма: предоплата+доплата+допсоглашение)
            MONTAGE_STATUSES = ("contract", "prepaid", "install_scheduled", "install_done")
            cur.execute(f"""
                SELECT
                    COALESCE(SUM(CASE WHEN status IN {MONTAGE_STATUSES} AND prepayment_confirmed
                                       THEN COALESCE(prepayment_fact, prepayment) ELSE 0 END), 0) AS montage_received,
                    COALESCE(SUM(CASE WHEN status = 'done' THEN
                                       (CASE WHEN prepayment_confirmed THEN COALESCE(prepayment_fact, prepayment) ELSE 0 END) +
                                       (CASE WHEN extra_payment_confirmed THEN COALESCE(extra_payment_fact, extra_payment) ELSE 0 END) +
                                       COALESCE(extra_agreement_sum, 0)
                                  ELSE 0 END), 0) AS final_received
                FROM {S}.live_chats WHERE status != 'deleted'{cid_filter}
            """)
            r_stage = cur.fetchone()
            received_measure, received_montage, received_final = 0.0, float(r_stage[0]), float(r_stage[1])
            total_received = received_measure + received_montage + received_final

            # Себестоимость — встроенные статьи (материалы/замер/монтаж/менеджмент)
            # + кастомные статьи затрат (Технолог, Логистика, Менеджер и т.п. — заводятся
            # через "+ Добавить строку"). Кастомные фильтруем по row_type='cost' в auto_rules_v2,
            # чтобы случайно НЕ приплюсовать сюда кастомную статью ДОХОДА.
            cur.execute(f"""
                SELECT COALESCE(SUM(lc.material_cost),0), COALESCE(SUM(lc.measure_cost),0),
                       COALESCE(SUM(lc.install_cost),0), COALESCE(SUM(lc.management_cost),0),
                       COALESCE((
                           SELECT SUM(cfv.value)
                           FROM {S}.client_custom_fin_values cfv
                           JOIN {S}.live_chats lc2 ON lc2.id = cfv.client_id
                           LEFT JOIN {S}.auto_rules_v2 ar ON ar.company_id = lc2.company_id AND ar.key = cfv.row_key
                           WHERE lc2.status != 'deleted'{cid_filter.replace('company_id', 'lc2.company_id') if cid_filter else ''}
                             AND COALESCE(ar.row_type, 'cost') = 'cost'
                       ), 0)
                FROM {S}.live_chats lc WHERE lc.status != 'deleted'{cid_filter}
            """)
            r2 = cur.fetchone()
            total_material, total_measure_cost, total_install_cost = float(r2[0]), float(r2[1]), float(r2[2])
            total_management, total_custom_costs = float(r2[3]), float(r2[4])
            total_costs = total_material + total_measure_cost + total_install_cost + total_management + total_custom_costs
            total_profit = total_contract - total_costs

            # Причины отказов
            cur.execute(f"SELECT cancel_reason, COUNT(*) FROM {S}.live_chats WHERE status='cancelled' AND cancel_reason IS NOT NULL AND cancel_reason != '' GROUP BY cancel_reason ORDER BY COUNT(*) DESC LIMIT 10")
            cancel_reasons = [{"reason": r[0], "count": r[1]} for r in cur.fetchall()]

            # Динамика по месяцам — все 12 месяцев скользящего окна с нулями для пустых
            cmp_sql = f" AND company_id = {int(company_id)}" if company_id is not None else ""
            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                leads AS (
                    SELECT DATE_TRUNC('month', created_at) AS m, COUNT(*) AS cnt
                    FROM {S}.live_chats WHERE status != 'deleted'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(leads.cnt, 0)
                FROM months LEFT JOIN leads ON months.m = leads.m ORDER BY months.m
            """)
            monthly_leads = [{"month": r[0], "count": r[1]} for r in cur.fetchall()]

            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                done AS (
                    -- Завершённые считаем по месяцу ЗАКРЫТИЯ сделки — совпадает с рядом
                    -- стоящим графиком выручки/прибыли (тот же месяц закрытия)
                    SELECT DATE_TRUNC('month', COALESCE(closed_at, status_changed_at, updated_at, created_at)) AS m, COUNT(*) AS cnt
                    FROM {S}.live_chats WHERE status = 'done'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(done.cnt, 0)
                FROM months LEFT JOIN done ON months.m = done.m ORDER BY months.m
            """)
            monthly_done = [{"month": r[0], "count": r[1]} for r in cur.fetchall()]

            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                rev AS (
                    -- Выручка относится к месяцу ЗАКРЫТИЯ сделки (closed_at), а не создания
                    -- заявки — иначе деньги "приезжают" не в тот месяц. closed_at фиксируется
                    -- один раз при переходе в 'done'; для старых записей до его появления
                    -- используем ближайший доступный запасной вариант.
                    SELECT DATE_TRUNC('month', COALESCE(closed_at, status_changed_at, updated_at, created_at)) AS m,
                           COALESCE(SUM(contract_sum), 0) AS s
                    FROM {S}.live_chats WHERE status = 'done'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(rev.s, 0)
                FROM months LEFT JOIN rev ON months.m = rev.m ORDER BY months.m
            """)
            monthly_revenue = [{"month": r[0], "revenue": float(r[1])} for r in cur.fetchall()]

            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                costs AS (
                    -- Себестоимость — тем же месяцем, что и выручка (по дате закрытия сделки)
                    SELECT DATE_TRUNC('month', COALESCE(closed_at, status_changed_at, updated_at, created_at)) AS m,
                        COALESCE(SUM(material_cost),0) + COALESCE(SUM(measure_cost),0) + COALESCE(SUM(install_cost),0) AS s
                    FROM {S}.live_chats WHERE status = 'done'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(costs.s, 0)
                FROM months LEFT JOIN costs ON months.m = costs.m ORDER BY months.m
            """)
            monthly_costs = [{"month": r[0], "costs": float(r[1])} for r in cur.fetchall()]

            cur.execute(f"""
                WITH months AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                        DATE_TRUNC('month', NOW()),
                        INTERVAL '1 month'
                    ) AS m
                ),
                profit AS (
                    -- Прибыль — тем же месяцем, что и выручка (по дате закрытия сделки)
                    SELECT DATE_TRUNC('month', COALESCE(closed_at, status_changed_at, updated_at, created_at)) AS m,
                        COALESCE(SUM(contract_sum),0) - COALESCE(SUM(material_cost),0) - COALESCE(SUM(measure_cost),0) - COALESCE(SUM(install_cost),0) AS s
                    FROM {S}.live_chats WHERE status = 'done'{cmp_sql} GROUP BY 1
                )
                SELECT TO_CHAR(months.m, 'YYYY-MM'), COALESCE(profit.s, 0)
                FROM months LEFT JOIN profit ON months.m = profit.m ORDER BY months.m
            """)
            monthly_profit = [{"month": r[0], "profit": float(r[1])} for r in cur.fetchall()]

            # Средние значения
            cur.execute(f"SELECT AVG(area) FROM {S}.live_chats WHERE area IS NOT NULL AND status != 'deleted'{cmp_sql}")
            avg_area = float(cur.fetchone()[0] or 0)
            cur.execute(f"SELECT AVG(contract_sum) FROM {S}.live_chats WHERE contract_sum IS NOT NULL AND status != 'deleted'{cmp_sql}")
            avg_contract = float(cur.fetchone()[0] or 0)

            # Конверсия воронки
            funnel = [
                {"label": "Заявки",          "count": total_all,      "status": "all"},
                {"label": "Замер назначен",   "count": went_measure,   "status": "measure"},
                {"label": "До договора",      "count": went_contract,  "status": "contract"},
                {"label": "Завершённые",      "count": total_done,     "status": "done"},
            ]

            stats_data = {
                # Счётчики
                "total_all": total_all,
                "total_leads": total_leads,
                "total_orders": total_orders,
                "total_done": total_done,
                "total_cancel": total_cancel,
                "went_measure": went_measure,
                "went_contract": went_contract,
                "upcoming_measures": upcoming_measures,
                "upcoming_installs": upcoming_installs,
                # Финансы
                "total_contract": total_contract,
                "total_received": total_received,
                "received_measure": received_measure,
                "received_montage": received_montage,
                "received_final": received_final,
                "total_prepayment": total_prepayment,
                "total_extra": total_extra,
                "total_extra_agreement": total_extra_agreement,
                # Себестоимость
                "total_material": total_material,
                "total_measure_cost": total_measure_cost,
                "total_install_cost": total_install_cost,
                "total_management": total_management,
                "total_custom_costs": total_custom_costs,
                "total_costs": total_costs,
                "total_profit": total_profit,
                # Средние
                "avg_area": round(avg_area, 1),
                "avg_contract": round(avg_contract, 0),
                # Отказы
                "cancel_reasons": cancel_reasons,
                # Воронка
                "funnel": funnel,
                "status_dist": [{"status": k, "count": v} for k, v in status_dist.items()],
                # Динамика
                "monthly_leads": monthly_leads,
                "monthly_done": monthly_done,
                "monthly_revenue": monthly_revenue,
                "monthly_costs": monthly_costs,
                "monthly_profit": monthly_profit,
            }
            _STATS_CACHE[cache_key] = {"data": stats_data, "at": datetime.now()}
            return ok(stats_data)

        # ── KANBAN COLUMNS ────────────────────────────────────────────────────
        if resource == "kanban-columns":
            # Определяем effective_company_id: мастер смотрит company_id=2 (свои)
            kcmp = company_id if company_id is not None else 2
            if method == "GET":
                cur.execute(f"SELECT id, title, color, position FROM {SCHEMA}.kanban_columns WHERE company_id=%s ORDER BY position", (kcmp,))
                cols = [{"id": r[0], "title": r[1], "color": r[2], "position": r[3]} for r in cur.fetchall()]
                return ok(cols)
            if method == "POST":
                cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_columns WHERE company_id=%s", (kcmp,))
                pos = cur.fetchone()[0]
                cur.execute(f"INSERT INTO {SCHEMA}.kanban_columns (title,color,position,company_id) VALUES (%s,%s,%s,%s) RETURNING id",
                            (body.get("title","Новая"), body.get("color","#7c3aed"), pos, kcmp))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})
            if method == "PUT":
                cid = qs.get("id")
                if not cid: return err("id required")
                sets, vals = [], []
                for f in ["title","color","position"]:
                    if f in body: sets.append(f"{f}=%s"); vals.append(body[f])
                vals.extend([int(cid), kcmp])
                cur.execute(f"UPDATE {SCHEMA}.kanban_columns SET {','.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"updated": True})

        # ── KANBAN CARDS ──────────────────────────────────────────────────────
        if resource == "kanban-cards":
            kcmp = company_id if company_id is not None else 2
            if method == "GET":
                col_id = qs.get("column_id")
                if col_id:
                    cur.execute(f"""SELECT kc.id, kc.column_id, kc.client_id, kc.title, kc.description,
                        kc.phone, kc.amount, kc.priority, kc.position, kc.due_date, kc.created_at,
                        lc.client_name, lc.status as client_status, lc.tags
                        FROM {SCHEMA}.kanban_cards kc
                        LEFT JOIN {SCHEMA}.live_chats lc ON kc.client_id=lc.id
                        WHERE kc.column_id=%s AND kc.company_id=%s ORDER BY kc.position""", (int(col_id), kcmp))
                else:
                    cur.execute(f"""SELECT kc.id, kc.column_id, kc.client_id, kc.title, kc.description,
                        kc.phone, kc.amount, kc.priority, kc.position, kc.due_date, kc.created_at,
                        lc.client_name, lc.status as client_status, lc.tags
                        FROM {SCHEMA}.kanban_cards kc
                        LEFT JOIN {SCHEMA}.live_chats lc ON kc.client_id=lc.id
                        WHERE kc.company_id=%s ORDER BY kc.column_id, kc.position""", (kcmp,))
                cols_desc = [d[0] for d in cur.description]
                rows = [dict(zip(cols_desc, r)) for r in cur.fetchall()]
                return ok(rows)
            if method == "POST":
                cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s AND company_id=%s", (body.get("column_id"), kcmp))
                pos = cur.fetchone()[0]
                cur.execute(f"""INSERT INTO {SCHEMA}.kanban_cards
                    (column_id,client_id,title,description,phone,amount,priority,position,due_date,company_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (body.get("column_id"), body.get("client_id"), body.get("title",""),
                     body.get("description",""), body.get("phone",""), body.get("amount"),
                     body.get("priority","medium"), pos, body.get("due_date"), kcmp))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})
            if method == "PUT":
                cid = qs.get("id")
                if not cid: return err("id required")
                fields = ["column_id","title","description","phone","amount","priority","position","due_date","client_id"]
                sets, vals = [], []
                for f in fields:
                    if f in body: sets.append(f"{f}=%s"); vals.append(body[f])
                if not sets: return err("nothing to update")
                vals.extend([int(cid), kcmp])
                cur.execute(f"UPDATE {SCHEMA}.kanban_cards SET {','.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"updated": True})
            if method == "DELETE":
                cid = qs.get("id")
                if not cid: return err("id required")
                cur.execute(f"DELETE FROM {SCHEMA}.kanban_cards WHERE id=%s AND company_id=%s", (int(cid), kcmp))
                conn.commit()
                return ok({"deleted": True})

        # ── CALENDAR EVENTS ───────────────────────────────────────────────────
        if resource == "calendar-events":
            if method == "GET":
                month = qs.get("month"); year = qs.get("year")
                if is_master:
                    cond_args = []
                    if month and year:
                        cond = "WHERE EXTRACT(MONTH FROM ce.start_time)=%s AND EXTRACT(YEAR FROM ce.start_time)=%s"
                        cond_args = [int(month), int(year)]
                    else:
                        cond = ""
                    cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                        ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone, lc.address
                        FROM {SCHEMA}.calendar_events ce
                        LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                        {cond} {'AND' if cond else 'WHERE'} (lc.status IS NULL OR lc.status != 'deleted')
                        ORDER BY ce.start_time DESC LIMIT 200""", cond_args)
                else:
                    # Собираем условия по кусочкам: к базовым (компания, не удалённые)
                    # добавляются персональные ограничения сотрудника — разрешённые типы
                    # событий и «только по своим заявкам». Без настроек поведение прежнее.
                    cal_sql = f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                        ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone, lc.address
                        FROM {SCHEMA}.calendar_events ce
                        LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                        WHERE ce.company_id=%s AND (lc.status IS NULL OR lc.status != 'deleted')"""
                    cal_args = [company_id]
                    if month and year:
                        cal_sql += " AND EXTRACT(MONTH FROM ce.start_time)=%s AND EXTRACT(YEAR FROM ce.start_time)=%s"
                        cal_args += [int(month), int(year)]
                    if calendar_event_types is not None:
                        cal_sql += " AND ce.event_type = ANY(%s)"
                        cal_args.append(calendar_event_types)
                    if calendar_own_only and master_uid:
                        cal_sql += " AND lc.assigned_to = %s"
                        cal_args.append(master_uid)
                    cal_sql += " ORDER BY ce.start_time" if (month and year) else " ORDER BY ce.start_time DESC LIMIT 100"
                    cur.execute(cal_sql, cal_args)
                cols_desc = [d[0] for d in cur.description]
                return ok([dict(zip(cols_desc, r)) for r in cur.fetchall()])
            if method == "POST":
                cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events
                    (client_id,title,description,event_type,start_time,end_time,color,company_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (body.get("client_id"), body.get("title",""), body.get("description",""),
                     body.get("event_type","measure"), body.get("start_time"),
                     body.get("end_time"), body.get("color","#f59e0b"), company_id))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})
            if method == "PUT":
                cid = qs.get("id")
                if not cid: return err("id required")
                fields = ["title","description","event_type","start_time","end_time","color","client_id"]
                sets, vals = [], []
                for f in fields:
                    if f in body: sets.append(f"{f}=%s"); vals.append(body[f])
                if not sets: return err("nothing to update")
                vals.append(int(cid))
                # Мастер редактирует любое; компания — только своё
                if is_master:
                    cur.execute(f"UPDATE {SCHEMA}.calendar_events SET {','.join(sets)} WHERE id=%s", vals)
                else:
                    vals.append(company_id)
                    cur.execute(f"UPDATE {SCHEMA}.calendar_events SET {','.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"updated": True})
            if method == "DELETE":
                cid = qs.get("id")
                if not cid: return err("id required")
                if is_master:
                    cur.execute(f"DELETE FROM {SCHEMA}.calendar_events WHERE id=%s", (int(cid),))
                else:
                    cur.execute(f"DELETE FROM {SCHEMA}.calendar_events WHERE id=%s AND company_id=%s", (int(cid), company_id))
                conn.commit()
                return ok({"deleted": True})

        # ── ORDER SUBSTATUSES ─────────────────────────────────────────────────
        if resource == "substatuses":
            if method == "GET":
                parent = qs.get("parent_status")
                if company_id is not None:
                    if parent:
                        cur.execute(f"""SELECT id, parent_status, label, color, position
                            FROM {SCHEMA}.order_substatuses
                            WHERE company_id=%s AND parent_status=%s
                            ORDER BY position, id""", (company_id, parent))
                    else:
                        cur.execute(f"""SELECT id, parent_status, label, color, position
                            FROM {SCHEMA}.order_substatuses
                            WHERE company_id=%s
                            ORDER BY parent_status, position, id""", (company_id,))
                else:
                    cur.execute(f"""SELECT id, parent_status, label, color, position
                        FROM {SCHEMA}.order_substatuses
                        ORDER BY company_id, parent_status, position, id""")
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "POST":
                parent = body.get("parent_status", "")
                label  = body.get("label", "").strip()
                color  = body.get("color", "#a78bfa")
                if not parent or not label:
                    return err("parent_status and label required")
                # Защита от дублей (двойной клик / повторный запрос) — если этап
                # с таким названием на этом табе уже есть, просто возвращаем его.
                cur.execute(f"""SELECT id, position FROM {SCHEMA}.order_substatuses
                    WHERE company_id=%s AND parent_status=%s AND label=%s
                    ORDER BY id LIMIT 1""", (company_id, parent, label))
                existing = cur.fetchone()
                if existing:
                    return ok({"id": existing[0], "position": existing[1]})
                cur.execute(f"""SELECT COALESCE(MAX(position), -1) + 1
                    FROM {SCHEMA}.order_substatuses WHERE company_id=%s AND parent_status=%s""",
                    (company_id, parent))
                pos = cur.fetchone()[0]
                cur.execute(f"""INSERT INTO {SCHEMA}.order_substatuses
                    (company_id, parent_status, label, color, position)
                    VALUES (%s,%s,%s,%s,%s) RETURNING id""",
                    (company_id, parent, label, color, pos))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id, "position": pos})

            if method == "PUT":
                sid = qs.get("id")
                if not sid: return err("id required")
                fields = ["label", "color", "position"]
                sets, vals = [], []
                for f in fields:
                    if f in body:
                        sets.append(f"{f}=%s")
                        vals.append(body[f])
                if not sets: return err("nothing to update")
                vals.append(int(sid))
                vals.append(company_id)
                cur.execute(f"""UPDATE {SCHEMA}.order_substatuses
                    SET {','.join(sets)} WHERE id=%s AND company_id=%s""", vals)
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                sid = qs.get("id")
                if not sid: return err("id required")
                cur.execute(f"""DELETE FROM {SCHEMA}.order_substatuses
                    WHERE id=%s AND company_id=%s""", (int(sid), company_id))
                conn.commit()
                return ok({"deleted": True})

        # ── status-labels ── персонализация названий/цветов реальных этапов заявки
        # (contract, prepaid, install_scheduled и т.п.), общая для всех сотрудников компании
        if resource == "status-labels":
            if method == "GET":
                if company_id is not None:
                    cur.execute(f"""SELECT status, label, color
                        FROM {SCHEMA}.order_status_labels
                        WHERE company_id=%s""", (company_id,))
                else:
                    cur.execute(f"""SELECT status, label, color
                        FROM {SCHEMA}.order_status_labels""")
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "PUT":
                status = body.get("status", "").strip()
                if not status:
                    return err("status required")
                label = body.get("label")
                color = body.get("color")
                cur.execute(f"""INSERT INTO {SCHEMA}.order_status_labels
                    (company_id, status, label, color)
                    VALUES (%s,%s,%s,%s)
                    ON CONFLICT (company_id, status)
                    DO UPDATE SET
                        label=COALESCE(EXCLUDED.label, {SCHEMA}.order_status_labels.label),
                        color=COALESCE(EXCLUDED.color, {SCHEMA}.order_status_labels.color)""",
                    (company_id, status, label, color))
                conn.commit()
                return ok({"updated": True})

        # ── discount-history ──────────────────────────────────────────────────
        if resource == "discount-history":
            cid = qs.get("client_id")
            if not cid:
                return err("client_id required")
            cid = int(cid)

            if method == "GET":
                cur.execute(f"""
                    SELECT id, discount_pct, discount_amount, contract_sum_before, contract_sum_after, is_active, created_at
                    FROM {SCHEMA}.discount_history
                    WHERE client_id = %s AND is_active = true
                    ORDER BY created_at ASC
                """, (cid,))
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "POST":
                pct    = body.get("discount_pct", 0)
                amount = body.get("discount_amount", 0)
                before = body.get("contract_sum_before", 0)
                after  = body.get("contract_sum_after", 0)
                if not pct or not amount:
                    return err("discount_pct and discount_amount required")
                comp = company_id if company_id is not None else 0
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.discount_history
                        (client_id, company_id, discount_pct, discount_amount, contract_sum_before, contract_sum_after)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (cid, comp, pct, amount, before, after))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                # Пометить запись неактивной (мягкое удаление)
                rid = qs.get("id")
                if not rid:
                    return err("id required")
                cur.execute(f"""
                    UPDATE {SCHEMA}.discount_history
                    SET is_active = false
                    WHERE id = %s AND client_id = %s
                """, (int(rid), cid))
                conn.commit()
                return ok({"deactivated": True})

        # ── CUSTOM FIN VALUES (суммы кастомных статей затрат/доходов по заказу) ─
        if resource == "custom-fin-values":
            cid = qs.get("client_id")
            if not cid:
                return err("client_id required")
            cid = int(cid)

            if method == "GET":
                cur.execute(f"""
                    SELECT row_key, value
                    FROM {SCHEMA}.client_custom_fin_values
                    WHERE client_id = %s
                """, (cid,))
                return ok({r[0]: float(r[1]) if r[1] is not None else None for r in cur.fetchall()})

            if method == "POST":
                row_key = body.get("row_key", "")
                value = body.get("value")
                if not row_key:
                    return err("row_key required")
                if value is None or value == "":
                    cur.execute(f"""
                        DELETE FROM {SCHEMA}.client_custom_fin_values
                        WHERE client_id = %s AND row_key = %s
                    """, (cid, row_key))
                else:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.client_custom_fin_values (client_id, row_key, value)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (client_id, row_key) DO UPDATE SET
                            value = EXCLUDED.value,
                            updated_at = NOW()
                    """, (cid, row_key, value))
                conn.commit()
                return ok({"saved": True})

        # ── PLAN ROOMS BY CHAT (для сметы) ────────────────────────────────────
        if resource == "plan-rooms-by-chat":
            cmp = company_id if company_id is not None else master_uid
            chat_id = qs.get("chat_id")
            if not chat_id: return err("chat_id required")
            if method == "GET":
                cur.execute(f"""
                    SELECT r.id, r.name, r.data, r.thumbnail, r.include_in_estimate, r.include_drawing,
                           v.id AS active_variant_id, v.name AS active_variant_name,
                           v.data AS active_variant_data, v.thumbnail AS active_variant_thumbnail
                    FROM {SCHEMA}.live_chats c
                    JOIN {SCHEMA}.plan_projects p ON p.id = c.project_id
                    JOIN {SCHEMA}.room_plans r ON r.project_id = p.id
                    LEFT JOIN {SCHEMA}.plan_variants v ON v.room_id = r.id AND v.is_active = true
                    WHERE c.id=%s AND c.company_id=%s
                      AND r.name NOT LIKE '[удалена]%%'
                    ORDER BY r.created_at ASC
                """, (int(chat_id), cmp))
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

        # ── PLAN PROJECTS ─────────────────────────────────────────────────────
        if resource == "plan-projects":
            cmp = company_id if company_id is not None else master_uid

            if method == "GET":
                pid = qs.get("id")
                if pid:
                    cur.execute(f"""
                        SELECT id, company_id, name, client_name, address, phone, status, created_at, updated_at, crm_chat_id
                        FROM {SCHEMA}.plan_projects WHERE id=%s AND company_id=%s
                    """, (int(pid), cmp))
                    row = cur.fetchone()
                    if not row: return err("not found", 404)
                    cols = [d[0] for d in cur.description]
                    return ok(dict(zip(cols, row)))
                deleted_prefix = '\u0443\u0434\u0430\u043b\u0435\u043d\u0430'  # "удалена"
                cur.execute(f"""
                    SELECT p.id, p.company_id, p.name, p.client_name, p.address, p.phone, p.status, p.created_at, p.updated_at,
                           CASE WHEN lc.id IS NOT NULL AND lc.status != 'deleted' THEN p.crm_chat_id ELSE NULL END AS crm_chat_id,
                           (SELECT COUNT(*) FROM {SCHEMA}.room_plans r WHERE r.project_id = p.id AND r.name NOT LIKE %s) AS rooms_count
                    FROM {SCHEMA}.plan_projects p
                    LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = p.crm_chat_id
                    WHERE p.company_id=%s ORDER BY p.updated_at DESC
                """, ('[' + deleted_prefix + ']%', cmp))
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "POST":
                name = (body.get("name") or "").strip()
                if not name: return err("name required")
                client_name = body.get("client_name")
                address = body.get("address")
                phone = body.get("phone")
                crm_client_id = body.get("crm_client_id")  # ID существующей заявки CRM
                # Для вставок используем реальный uid (мастер имеет cmp=0, но uid реальный)
                insert_cmp = master_uid if cmp == 0 else cmp
                # 1. Создаём проект
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.plan_projects (company_id, name, client_name, address, phone, status)
                    VALUES (%s,%s,%s,%s,%s,%s) RETURNING id
                """, (insert_cmp, name, client_name, address, phone, body.get("status","draft")))
                new_id = cur.fetchone()[0]
                # 2. Привязываем к существующей заявке CRM или создаём новую
                if crm_client_id:
                    # Привязываемся к существующей заявке — обновляем project_id
                    cur.execute(f"UPDATE {SCHEMA}.live_chats SET project_id=%s WHERE id=%s AND company_id=%s RETURNING id",
                                (new_id, crm_client_id, insert_cmp))
                    row = cur.fetchone()
                    chat_id = row[0] if row else None
                    if not chat_id:
                        # Заявка не найдена — создаём новую
                        crm_client_id = None
                if not crm_client_id:
                    session_id = f"plan-{new_id}"
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.live_chats
                            (session_id, client_name, phone, address, status, created_via, company_id, project_id, next_call_date, status_changed_at)
                        VALUES (%s,%s,%s,%s,'new','plan',%s,%s,%s,NOW()) RETURNING id
                    """, (session_id, client_name or name, phone, address, insert_cmp, new_id, default_next_call_date()))
                    chat_id = cur.fetchone()[0]
                # 3. Связываем проект с заявкой
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET crm_chat_id=%s WHERE id=%s", (chat_id, new_id))
                # 4. Ищем колонку "С построителя" и добавляем канбан-карточку (только для новых заявок)
                if not crm_client_id:
                    cur.execute(f"SELECT id FROM {SCHEMA}.kanban_columns WHERE title='С построителя' AND company_id=%s LIMIT 1", (insert_cmp,))
                    col_row = cur.fetchone()
                    if col_row:
                        cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s AND company_id=%s", (col_row[0], insert_cmp))
                        pos = cur.fetchone()[0]
                        cur.execute(f"""INSERT INTO {SCHEMA}.kanban_cards
                            (column_id, client_id, title, phone, priority, position, company_id)
                            VALUES (%s,%s,%s,%s,'medium',%s,%s)""",
                            (col_row[0], chat_id, name, phone or "", pos, insert_cmp))
                conn.commit()
                return ok({"id": new_id, "crm_chat_id": chat_id})

            if method == "PUT":
                pid = qs.get("id")
                if not pid: return err("id required")
                allowed = ["name","client_name","address","phone","status"]
                sets, vals = [], []
                for f in allowed:
                    if f in body: sets.append(f"{f}=%s"); vals.append(body[f])
                if not sets: return err("nothing to update")
                sets.append("updated_at=NOW()")
                vals += [int(pid), cmp]
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET {','.join(sets)} WHERE id=%s AND company_id=%s", vals)
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                pid = qs.get("id")
                if not pid: return err("id required")
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET status='deleted' WHERE id=%s AND company_id=%s", (int(pid), cmp))
                conn.commit()
                return ok({"deleted": True})

        # ── PLAN ROOMS ────────────────────────────────────────────────────────
        if resource == "plan-rooms":
            cmp = company_id if company_id is not None else master_uid
            project_id = qs.get("project_id") or body.get("project_id")

            if method == "GET":
                rid = qs.get("id")
                if rid:
                    cur.execute(f"""
                        SELECT r.id, r.project_id, r.name, r.data, r.thumbnail, r.created_at, r.updated_at,
                               r.include_in_estimate, r.include_drawing
                        FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                        WHERE r.id=%s AND p.company_id=%s
                    """, (int(rid), cmp))
                    row = cur.fetchone()
                    if not row: return err("not found", 404)
                    cols = [d[0] for d in cur.description]
                    return ok(dict(zip(cols, row)))
                if not project_id: return err("project_id required")
                with_active = qs.get("with_active_variant") == "true"
                if with_active:
                    cur.execute(f"""
                        SELECT DISTINCT ON (r.id)
                               r.id, r.project_id, r.name, r.data, r.thumbnail, r.created_at, r.updated_at,
                               r.include_in_estimate, r.include_drawing,
                               v.id AS active_variant_id, v.name AS active_variant_name,
                               v.thumbnail AS active_variant_thumbnail
                        FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                        LEFT JOIN {SCHEMA}.plan_variants v ON v.room_id = r.id AND v.is_active = true
                        WHERE r.project_id=%s AND p.company_id=%s
                          AND r.name NOT LIKE '[удалена]%%'
                        ORDER BY r.id, r.created_at ASC
                    """, (int(project_id), cmp))
                else:
                    cur.execute(f"""
                        SELECT r.id, r.project_id, r.name, r.data, r.thumbnail, r.created_at, r.updated_at,
                               r.include_in_estimate, r.include_drawing
                        FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                        WHERE r.project_id=%s AND p.company_id=%s
                          AND r.name NOT LIKE '[удалена]%%'
                        ORDER BY r.created_at ASC
                    """, (int(project_id), cmp))
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

            if method == "POST":
                if not project_id: return err("project_id required")
                name = (body.get("name") or "Новая комната").strip()
                insert_cmp = master_uid if cmp == 0 else cmp
                # Проверяем что проект принадлежит компании (мастер видит все через company_id=0 или свой uid)
                cur.execute(f"SELECT id FROM {SCHEMA}.plan_projects WHERE id=%s AND (company_id=%s OR company_id=%s)", (int(project_id), cmp, insert_cmp))
                if not cur.fetchone(): return err("project not found", 404)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.room_plans (user_id, project_id, name, data)
                    VALUES (%s,%s,%s,'{{}}') RETURNING id
                """, (insert_cmp, int(project_id), name))
                new_id = cur.fetchone()[0]
                # Обновляем updated_at проекта
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET updated_at=NOW() WHERE id=%s", (int(project_id),))
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                rid = qs.get("id")
                if not rid: return err("id required")
                allowed = ["name","data","thumbnail","include_in_estimate","include_drawing"]
                sets, vals = [], []
                for f in allowed:
                    if f in body:
                        sets.append(f"{f}=%s")
                        vals.append(json.dumps(body[f]) if f == "data" else body[f])
                if not sets: return err("nothing to update")
                sets.append("updated_at=NOW()")
                vals.append(int(rid))
                cur.execute(f"""
                    UPDATE {SCHEMA}.room_plans SET {','.join(sets)} WHERE id=%s
                    AND project_id IN (SELECT id FROM {SCHEMA}.plan_projects WHERE company_id=%s)
                """, vals + [cmp])
                # Обновляем updated_at проекта
                if project_id:
                    cur.execute(f"UPDATE {SCHEMA}.plan_projects SET updated_at=NOW() WHERE id=%s", (int(project_id),))
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                rid = qs.get("id")
                if not rid: return err("id required")
                cur.execute(f"""
                    UPDATE {SCHEMA}.room_plans SET name=CONCAT('[удалена] ', name) WHERE id=%s
                    AND project_id IN (SELECT id FROM {SCHEMA}.plan_projects WHERE company_id=%s)
                """, (int(rid), cmp))
                conn.commit()
                return ok({"deleted": True})

        # ── PLAN VARIANTS ────────────────────────────────────────────────────────
        if resource == "plan-variants":
            cmp = company_id if company_id is not None else master_uid

            if method == "GET":
                room_id = qs.get("room_id")
                if not room_id: return err("room_id required")
                # Проверяем что комната принадлежит компании
                cur.execute(f"""
                    SELECT r.id FROM {SCHEMA}.room_plans r
                    JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                    WHERE r.id=%s AND p.company_id=%s
                """, (int(room_id), cmp))
                if not cur.fetchone(): return err("room not found", 404)
                cur.execute(f"""
                    SELECT id, room_id, name, data, thumbnail, is_active, created_at, updated_at
                    FROM {SCHEMA}.plan_variants WHERE room_id=%s AND name NOT LIKE '[удалён]%%'
                    ORDER BY created_at ASC
                """, (int(room_id),))
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                return ok(rows)

            if method == "POST":
                room_id = body.get("room_id")
                if not room_id: return err("room_id required")
                name = (body.get("name") or "Вариант 1").strip()
                data = body.get("data", {})
                thumbnail = body.get("thumbnail")
                # Проверяем доступ
                cur.execute(f"""
                    SELECT r.id FROM {SCHEMA}.room_plans r
                    JOIN {SCHEMA}.plan_projects p ON p.id = r.project_id
                    WHERE r.id=%s AND p.company_id=%s
                """, (int(room_id), cmp))
                if not cur.fetchone(): return err("room not found", 404)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.plan_variants (room_id, name, data, thumbnail, is_active)
                    VALUES (%s,%s,%s,%s,false) RETURNING id
                """, (int(room_id), name, json.dumps(data), thumbnail))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})

            if method == "PUT":
                vid = qs.get("id")
                if not vid: return err("id required")
                allowed = ["name","data","thumbnail","is_active"]
                sets, vals = [], []
                for f in allowed:
                    if f in body:
                        sets.append(f"{f}=%s")
                        vals.append(json.dumps(body[f]) if f == "data" else body[f])
                if not sets: return err("nothing to update")
                sets.append("updated_at=NOW()")
                vals.append(int(vid))
                if body.get("is_active"):
                    cur.execute(f"""
                        UPDATE {SCHEMA}.plan_variants SET is_active=false
                        WHERE room_id=(SELECT room_id FROM {SCHEMA}.plan_variants WHERE id=%s)
                        AND id != %s
                    """, (int(vid), int(vid)))
                cur.execute(f"""
                    UPDATE {SCHEMA}.plan_variants SET {','.join(sets)} WHERE id=%s
                    AND room_id IN (
                        SELECT r.id FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id=r.project_id
                        WHERE p.company_id=%s
                    )
                """, vals + [cmp])
                conn.commit()
                return ok({"updated": True})

            if method == "DELETE":
                vid = qs.get("id")
                if not vid: return err("id required")
                cur.execute(f"""
                    UPDATE {SCHEMA}.plan_variants SET name=CONCAT('[удалён] ', name) WHERE id=%s
                    AND room_id IN (
                        SELECT r.id FROM {SCHEMA}.room_plans r
                        JOIN {SCHEMA}.plan_projects p ON p.id=r.project_id
                        WHERE p.company_id=%s
                    )
                """, (int(vid), cmp))
                conn.commit()
                return ok({"deleted": True})

        # ── PLAN-ROOMS-BY-CHAT — комнаты проекта по chat_id (для сметы в CRM) ────
        if resource == "plan-rooms-by-chat":
            chat_id_val = qs.get("chat_id") or body.get("chat_id")
            if not chat_id_val: return err("chat_id required", 400)
            cmp = company_id if company_id is not None else master_uid
            if method == "GET":
                cur.execute(f"""
                    SELECT r.id, r.project_id, r.name, r.data, r.thumbnail,
                           r.created_at, r.updated_at, r.include_in_estimate, r.include_drawing,
                           v.id    AS active_variant_id,
                           v.name  AS active_variant_name,
                           v.thumbnail AS active_variant_thumbnail,
                           v.data  AS active_variant_data
                    FROM {SCHEMA}.plan_projects p
                    JOIN {SCHEMA}.room_plans r ON r.project_id = p.id
                    LEFT JOIN {SCHEMA}.plan_variants v ON v.room_id = r.id AND v.is_active = true
                    WHERE p.crm_chat_id = %s AND p.company_id = %s
                      AND r.name NOT LIKE '[удалена]%%'
                    ORDER BY r.created_at ASC
                """, (int(chat_id_val), cmp))
                cols = [d[0] for d in cur.description]
                return ok([dict(zip(cols, r)) for r in cur.fetchall()])

        # ── PLAN-CRM-SYNC — синхронизация данных проект ↔ заявка CRM ────────────
        if resource == "plan-crm-sync":
            cmp = company_id if company_id is not None else master_uid

            # GET: получить связанную заявку CRM по project_id
            if method == "GET":
                pid = qs.get("project_id")
                if not pid: return err("project_id required")
                cur.execute(f"""
                    SELECT lc.id, lc.client_name, lc.phone, lc.address, lc.status,
                           lc.contract_sum, lc.notes, lc.project_id, p.crm_chat_id,
                           p.name as project_name
                    FROM {SCHEMA}.plan_projects p
                    LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = p.crm_chat_id
                    WHERE p.id=%s AND p.company_id=%s
                """, (int(pid), cmp))
                row = cur.fetchone()
                if not row: return err("not found", 404)
                cols = [d[0] for d in cur.description]
                return ok(dict(zip(cols, row)))

            # PUT: синхронизировать данные из построителя → CRM и обратно
            if method == "PUT":
                pid = qs.get("project_id")
                if not pid: return err("project_id required")
                # Получаем связанную заявку
                cur.execute(f"""
                    SELECT p.crm_chat_id FROM {SCHEMA}.plan_projects p
                    WHERE p.id=%s AND p.company_id=%s
                """, (int(pid), cmp))
                row = cur.fetchone()
                if not row: return err("project not found", 404)
                chat_id = row[0]
                # Обновляем поля которые пришли
                plan_fields = ["name","client_name","address","phone","status"]
                crm_fields  = ["client_name","phone","address","contract_sum","notes"]
                # Синхронизируем plan_projects
                p_sets, p_vals = [], []
                for f in plan_fields:
                    if f in body:
                        p_sets.append(f"{f}=%s"); p_vals.append(body[f])
                if p_sets:
                    p_sets.append("updated_at=NOW()")
                    p_vals += [int(pid), cmp]
                    cur.execute(f"UPDATE {SCHEMA}.plan_projects SET {','.join(p_sets)} WHERE id=%s AND company_id=%s", p_vals)
                # Синхронизируем live_chats если есть связь
                if chat_id:
                    c_sets, c_vals = [], []
                    name_val = body.get("client_name") or body.get("name")
                    if name_val: c_sets.append("client_name=%s"); c_vals.append(name_val)
                    for f in ["phone","address","contract_sum","notes"]:
                        if f in body: c_sets.append(f"{f}=%s"); c_vals.append(body[f])
                    if c_sets:
                        c_sets.append("updated_at=NOW()")
                        c_vals.append(chat_id)
                        cur.execute(f"UPDATE {SCHEMA}.live_chats SET {','.join(c_sets)} WHERE id=%s", c_vals)
                conn.commit()
                return ok({"synced": True, "project_id": int(pid), "crm_chat_id": chat_id})

        # ── PLAN-CRM-LINK — создать CRM-заявку для существующего проекта ─────────
        if resource == "plan-crm-link":
            if method == "POST":
                pid = qs.get("project_id") or body.get("project_id")
                if not pid: return err("project_id required")
                insert_cmp = master_uid if (company_id is None or company_id == 0) else company_id
                # Берём проект — проверяем владельца
                cur.execute(f"SELECT id, name, client_name, phone, address, crm_chat_id FROM {SCHEMA}.plan_projects WHERE id=%s AND company_id=%s", (int(pid), insert_cmp))
                row = cur.fetchone()
                if not row: return err("project not found", 404)
                proj_id, proj_name, client_name, phone, address, existing_chat = row
                if existing_chat:
                    return ok({"crm_chat_id": existing_chat, "already_linked": True})
                # Создаём заявку
                session_id = f"plan-{proj_id}"
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, address, status, created_via, company_id, project_id, next_call_date, status_changed_at)
                    VALUES (%s,%s,%s,%s,'new','plan',%s,%s,%s,NOW()) RETURNING id
                """, (session_id, client_name or proj_name, phone, address, insert_cmp, proj_id, default_next_call_date()))
                chat_id = cur.fetchone()[0]
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET crm_chat_id=%s, company_id=%s WHERE id=%s", (chat_id, insert_cmp, proj_id))
                # Канбан
                cur.execute(f"SELECT id FROM {SCHEMA}.kanban_columns WHERE title='С построителя' AND company_id=%s LIMIT 1", (insert_cmp,))
                col_row = cur.fetchone()
                if col_row:
                    cur.execute(f"SELECT COALESCE(MAX(position)+1,0) FROM {SCHEMA}.kanban_cards WHERE column_id=%s AND company_id=%s", (col_row[0], insert_cmp))
                    pos = cur.fetchone()[0]
                    cur.execute(f"INSERT INTO {SCHEMA}.kanban_cards (column_id, client_id, title, phone, priority, position, company_id) VALUES (%s,%s,%s,%s,'medium',%s,%s)",
                        (col_row[0], chat_id, proj_name, phone or "", pos, insert_cmp))
                # Авто-синк сметы: если для проекта есть сохранённая смета в другой заявке — берём её сумму
                cur.execute(f"""
                    SELECT se.total_standard FROM {SCHEMA}.saved_estimates se
                    JOIN {SCHEMA}.live_chats lc ON lc.id = se.chat_id
                    WHERE lc.project_id = %s AND se.total_standard IS NOT NULL
                    ORDER BY se.created_at DESC LIMIT 1
                """, (proj_id,))
                est_row = cur.fetchone()
                if est_row and est_row[0]:
                    cur.execute(f"UPDATE {SCHEMA}.live_chats SET contract_sum=%s WHERE id=%s", (est_row[0], chat_id))
                conn.commit()
                return ok({"crm_chat_id": chat_id})

        # ── PLAN-CRM-ATTACH — привязать существующий проект к существующей заявке ─
        if resource == "plan-crm-attach":
            if method == "POST":
                pid     = qs.get("project_id") or body.get("project_id")
                chat_id = qs.get("chat_id")    or body.get("chat_id")
                if not pid:     return err("project_id required")
                if not chat_id: return err("chat_id required")
                attach_cmp = master_uid if (company_id is None or company_id == 0) else company_id
                # Проверяем что проект наш
                cur.execute(f"SELECT id FROM {SCHEMA}.plan_projects WHERE id=%s AND company_id=%s", (int(pid), attach_cmp))
                if not cur.fetchone(): return err("project not found", 404)
                # Проверяем что заявка наша
                cur.execute(f"SELECT id FROM {SCHEMA}.live_chats WHERE id=%s AND company_id=%s AND status!='deleted'", (int(chat_id), attach_cmp))
                if not cur.fetchone(): return err("chat not found", 404)
                # Связываем
                cur.execute(f"UPDATE {SCHEMA}.plan_projects SET crm_chat_id=%s, updated_at=NOW() WHERE id=%s AND company_id=%s", (int(chat_id), int(pid), attach_cmp))
                cur.execute(f"UPDATE {SCHEMA}.live_chats SET project_id=%s, updated_at=NOW() WHERE id=%s AND company_id=%s", (int(pid), int(chat_id), attach_cmp))
                # Авто-синк сметы: если у проекта уже есть сохранённая смета — обновляем contract_sum заявки
                cur.execute(f"""
                    SELECT se.total_standard FROM {SCHEMA}.saved_estimates se
                    JOIN {SCHEMA}.live_chats lc ON lc.id = se.chat_id
                    WHERE lc.project_id = %s AND se.total_standard IS NOT NULL
                    ORDER BY se.created_at DESC LIMIT 1
                """, (int(pid),))
                est_row = cur.fetchone()
                if est_row and est_row[0]:
                    cur.execute(f"UPDATE {SCHEMA}.live_chats SET contract_sum=%s WHERE id=%s", (est_row[0], int(chat_id)))
                conn.commit()
                return ok({"ok": True, "project_id": int(pid), "crm_chat_id": int(chat_id)})

        # ── CREATE-ESTIMATE-FOR-CHAT — создать смету для существующей заявки ───
        if resource == "create-estimate-for-chat":
            if method == "POST":
                chat_id_val = body.get("chat_id")
                blocks_val  = body.get("blocks", [])
                totals_val  = body.get("totals", [])
                if not chat_id_val: return err("chat_id required")
                if not blocks_val:  return err("blocks required")
                import re as _re
                # Извлекаем суммы из totals
                def _extract(keyword):
                    for t_line in totals_val:
                        if keyword.lower() in t_line.lower():
                            nums = _re.findall(r"[\d\s]+", t_line.replace("\u00a0", " "))
                            cleaned = "".join("".join(nums).split())
                            if cleaned.isdigit(): return float(cleaned)
                    return None
                total_econom   = _extract("econom")
                total_standard = _extract("standard")
                total_premium  = _extract("premium")
                # Проверяем что заявка существует
                cur.execute(f"SELECT id, company_id FROM {SCHEMA}.live_chats WHERE id=%s", (int(chat_id_val),))
                chat_row = cur.fetchone()
                if not chat_row: return err("chat not found", 404)
                # Удаляем старую смету для этой заявки если есть
                cur.execute(f"DELETE FROM {SCHEMA}.saved_estimates WHERE chat_id=%s", (int(chat_id_val),))
                # Создаём новую смету
                insert_cmp = master_uid if (company_id is None or company_id == 0) else company_id
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.saved_estimates
                      (user_id, chat_id, title, blocks, totals, total_econom, total_standard, total_premium, final_phrase)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, '')
                    RETURNING id
                """, (
                    insert_cmp,
                    int(chat_id_val),
                    "Смета на натяжные потолки",
                    json.dumps(blocks_val, ensure_ascii=False),
                    json.dumps(totals_val, ensure_ascii=False),
                    total_econom, total_standard, total_premium,
                ))
                new_id = cur.fetchone()[0]
                # Считаем material_cost, installation_cost и management_cost по прайсу
                material_cost_total = 0
                installation_cost_total = 0
                management_cost_total = 0
                try:
                    # Глобальные флаги
                    cmp_id = master_uid if (company_id is None or company_id == 0) else company_id
                    cur.execute(f"SELECT use_installation_price, use_measure_price, use_management_price FROM {SCHEMA}.auto_rules_settings WHERE company_id=%s", (cmp_id,))
                    _s = cur.fetchone()
                    use_install_global    = bool(_s[0]) if _s else False
                    use_measure_global    = bool(_s[1]) if _s else False
                    use_management_global = bool(_s[2]) if _s else False

                    cur.execute(f"""
                        SELECT p.name, p.purchase_price, p.installation_price, p.measure_price, p.management_price, s.is_material
                        FROM {SCHEMA}.ai_prices p
                        JOIN {SCHEMA}.price_category_settings s ON s.category = p.category
                        WHERE p.active=true AND (p.purchase_price > 0 OR p.installation_price > 0 OR p.measure_price > 0 OR p.management_price > 0)
                    """)
                    mat_map = {}
                    inst_map = {}
                    meas_map = {}
                    mgmt_map = {}
                    for row in cur.fetchall():
                        name_key = row[0].strip().lower()
                        if row[5] and row[1]:
                            mat_map[name_key] = float(row[1])
                        if use_install_global and row[2]:
                            inst_map[name_key] = float(row[2])
                        if use_measure_global and row[3]:
                            meas_map[name_key] = float(row[3])
                        if use_management_global and row[4]:
                            mgmt_map[name_key] = float(row[4])
                    for block in blocks_val:
                        for item in block.get("items", []):
                            item_name = item.get("name", "").strip().lower()
                            val_str = str(item.get("value", "")).replace("\u00a0", " ")
                            m = _re.match(r"([\d]+(?:[.,]\d+)?)", val_str.strip())
                            qty = float(m.group(1).replace(",", ".")) if m else 1.0
                            if item_name in mat_map:
                                material_cost_total += mat_map[item_name] * qty
                            if item_name in inst_map:
                                installation_cost_total += inst_map[item_name] * qty
                            if item_name in meas_map:
                                installation_cost_total += meas_map[item_name] * qty
                            if item_name in mgmt_map:
                                management_cost_total += mgmt_map[item_name] * qty
                    material_cost_total = int(round(material_cost_total))
                    installation_cost_total = int(round(installation_cost_total))
                    management_cost_total = int(round(management_cost_total))
                except Exception:
                    pass
                # Обновляем contract_sum, material_cost, install_cost в заявке
                update_parts = []
                update_vals = []
                if total_standard:
                    update_parts.append("contract_sum=%s"); update_vals.append(total_standard)
                if material_cost_total > 0:
                    update_parts.append("material_cost=%s"); update_vals.append(material_cost_total)
                if installation_cost_total > 0:
                    update_parts.append("install_cost=%s"); update_vals.append(installation_cost_total)
                if management_cost_total > 0:
                    update_parts.append("management_cost=%s"); update_vals.append(management_cost_total)
                if update_parts:
                    cur.execute(
                        f"UPDATE {SCHEMA}.live_chats SET {', '.join(update_parts)} WHERE id=%s",
                        update_vals + [int(chat_id_val)]
                    )
                conn.commit()
                return ok({"ok": True, "estimate_id": new_id})

        # ── PLAN-SHARE — публичные ссылки на чертежи ──────────────────────────
        if resource == "plan-share":
            import secrets as _secrets

            # GET по токену — публичный доступ, без авторизации
            if method == "GET":
                token = qs.get("token")
                if not token: return err("token required")
                cur.execute(f"""
                    SELECT ps.id, ps.token, ps.room_ids, ps.title, ps.chat_id,
                           ps.created_at, ps.expires_at
                    FROM {SCHEMA}.plan_shares ps
                    WHERE ps.token=%s AND (ps.expires_at IS NULL OR ps.expires_at > NOW())
                """, (token,))
                row = cur.fetchone()
                if not row: return err("not found", 404)
                cols = [d[0] for d in cur.description]
                share = dict(zip(cols, row))
                room_ids = share["room_ids"] or []
                # Загружаем комнаты
                rooms = []
                if room_ids:
                    # psycopg2 требует tuple для ANY — конвертируем list в tuple
                    ids_tuple = tuple(int(i) for i in room_ids)
                    placeholders = ",".join(["%s"] * len(ids_tuple))
                    cur.execute(f"""
                        SELECT r.id, r.name, r.data, r.thumbnail, r.include_in_estimate,
                               v.id AS active_variant_id, v.name AS active_variant_name,
                               v.data AS active_variant_data, v.thumbnail AS active_variant_thumbnail
                        FROM {SCHEMA}.room_plans r
                        LEFT JOIN {SCHEMA}.plan_variants v ON v.room_id = r.id AND v.is_active = true
                        WHERE r.id IN ({placeholders}) AND r.name NOT LIKE '[удалена]%%'
                        ORDER BY r.created_at ASC
                    """, ids_tuple)
                    rcols = [d[0] for d in cur.description]
                    rooms = [dict(zip(rcols, r)) for r in cur.fetchall()]
                return ok({"share": share, "rooms": rooms})

            # POST — создать новую ссылку (требует авторизации)
            if method == "POST":
                insert_cmp = master_uid if (company_id is None or company_id == 0) else company_id
                room_ids = body.get("room_ids", [])
                chat_id_val = body.get("chat_id")
                title = body.get("title", "Чертежи")
                if not room_ids: return err("room_ids required")
                token = _secrets.token_hex(12)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.plan_shares (token, company_id, chat_id, room_ids, title)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id, token
                """, (token, insert_cmp, chat_id_val, room_ids, title))
                row = cur.fetchone()
                conn.commit()
                return ok({"id": row[0], "token": row[1]})

            # DELETE — удалить ссылку
            if method == "DELETE":
                token = qs.get("token") or body.get("token")
                if not token: return err("token required")
                cur.execute(f"DELETE FROM {SCHEMA}.plan_shares WHERE token=%s", (token,))
                conn.commit()
                return ok({"deleted": True})

        # ── ORDER-SHARE — постоянная публичная ссылка на заявку целиком ───────────
        # (адрес, площадь, даты замера/монтажа, статус, смета) — одна ссылка на
        # заявку, данные всегда актуальные (грузятся заново при каждом открытии).
        if resource == "order-share":
            import secrets as _secrets

            # GET по токену — публичный доступ, без авторизации
            if method == "GET":
                token = qs.get("token")
                if not token: return err("token required")
                cur.execute(f"""
                    SELECT os.chat_id
                    FROM {SCHEMA}.order_shares os
                    WHERE os.token=%s
                """, (token,))
                srow = cur.fetchone()
                if not srow: return err("not found", 404)
                chat_id_val = srow[0]

                cur.execute(f"""
                    SELECT id, client_name, address, area, status, sub_status,
                           measure_date, install_date, created_at
                    FROM {SCHEMA}.live_chats
                    WHERE id=%s
                """, (chat_id_val,))
                orow = cur.fetchone()
                if not orow: return err("заявка удалена", 404)
                ocols = [d[0] for d in cur.description]
                order = dict(zip(ocols, orow))

                cur.execute(f"""
                    SELECT title, blocks, totals, final_phrase,
                           total_econom, total_standard, total_premium, chosen_tier
                    FROM {SCHEMA}.saved_estimates
                    WHERE chat_id=%s ORDER BY id DESC LIMIT 1
                """, (chat_id_val,))
                erow = cur.fetchone()
                estimate = None
                if erow:
                    ecols = [d[0] for d in cur.description]
                    estimate = dict(zip(ecols, erow))

                return ok({"order": order, "estimate": estimate})

            # POST — вернуть уже существующий токен для этой заявки, либо создать
            # новый (по умолчанию ссылка постоянная и переиспользуется).
            if method == "POST":
                if not authenticated:
                    return err("Требуется авторизация", 401)
                insert_cmp = master_uid if (company_id is None or company_id == 0) else company_id
                chat_id_val = body.get("chat_id")
                if not chat_id_val: return err("chat_id required")

                cur.execute(f"SELECT token FROM {SCHEMA}.order_shares WHERE chat_id=%s LIMIT 1", (int(chat_id_val),))
                existing = cur.fetchone()
                if existing:
                    return ok({"token": existing[0]})

                token = _secrets.token_hex(12)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.order_shares (token, company_id, chat_id)
                    VALUES (%s, %s, %s) RETURNING token
                """, (token, insert_cmp, int(chat_id_val)))
                row = cur.fetchone()
                conn.commit()
                return ok({"token": row[0]})

        # ── INTEGRATIONS: настройки внешних сервисов компании (config JSONB) ──────
        if resource == "integrations":
            if not authenticated:
                return err("Требуется авторизация", 401)
            # владелец интеграций = компания (для менеджера) либо сам пользователь
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            # Секретные поля (шифруются в БД, наружу отдаются маской "••••")
            SECRET_KEYS = ("avito_client_secret", "whatsapp_token", "mistral_key",
                           "openai_key", "assemblyai_key", "whisper_key", "other_key",
                           "uis_api_key", "tg_leads_bot_token")
            SECRET_MASK = "••••••••"

            # GET — прочитать config компании (секреты маскируем, не отдаём открыто)
            if method == "GET":
                cur.execute(
                    f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s",
                    (owner_id,))
                row = cur.fetchone()
                cfg = dict(row[0]) if row and row[0] else {}
                for k in SECRET_KEYS:
                    if cfg.get(k):
                        cfg[k] = SECRET_MASK  # значение задано, но наружу не отдаём
                # Служебные OAuth-токены Avito — наружу не отдаём вообще, только флаг подключения
                cfg.pop("_avito_oauth_access_token", None)
                cfg.pop("_avito_oauth_refresh_token", None)
                cfg["avito_connected"] = bool(cfg.get("_avito_oauth_connected"))
                return ok({"config": cfg})

            # POST — сохранить config (upsert). Секреты шифруем; маску игнорируем
            # (значит поле не меняли — оставляем прежнее зашифрованное значение).
            if method == "POST":
                cfg = body.get("config", {})
                if not isinstance(cfg, dict):
                    return err("config must be an object")

                cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
                prev_row = cur.fetchone()
                prev_cfg = dict(prev_row[0]) if prev_row and prev_row[0] else {}

                for k in SECRET_KEYS:
                    if k not in cfg:
                        continue
                    val = cfg[k]
                    if val == SECRET_MASK or val == "":
                        # не меняли (пришла маска) — оставляем прежнее значение
                        if prev_cfg.get(k):
                            cfg[k] = prev_cfg[k]
                        else:
                            cfg.pop(k, None)
                    elif isinstance(val, str) and val.startswith("enc:"):
                        pass  # уже зашифровано — не трогаем
                    else:
                        cfg[k] = encrypt_secret(val)

                cur.execute(f"""
                    INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (company_id)
                    DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
                """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
                conn.commit()
                return ok({"saved": True})

        # ── AVITO-CHECK: реальная проверка связи с Avito (кнопка «Проверить») ──────
        if resource == "avito-check" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else {}
            client_id_a = cfg.get("avito_client_id")
            client_secret_a = decrypt_secret(cfg.get("avito_client_secret"))
            if not client_id_a or not client_secret_a:
                return err("Сначала сохраните Client ID и Client Secret", 400)

            token, terr = avito_get_token(client_id_a, client_secret_a)
            if terr:
                return err(terr, 400)
            try:
                me = avito_api_get(token, "/core/v1/accounts/self")
                avito_user_id = me.get("id")
            except Exception as e:
                return err(f"Avito: не удалось получить профиль: {str(e)[:150]}", 400)

            cfg["_avito_user_id"] = avito_user_id

            # Автоматически подписываем Avito на входящие сообщения (webhook v3).
            # Нужен секретный ключ вебхука — генерируем, если ещё нет.
            wh_key = cfg.get("_channel_webhook_key")
            if not wh_key:
                wh_key = uuid.uuid4().hex
                cfg["_channel_webhook_key"] = wh_key
            webhook_url = (f"{SELF_FUNCTION_URL}?r=avito-webhook"
                           f"&company_id={owner_id}&key={wh_key}")
            webhook_ok = False
            webhook_err = None
            try:
                wdata = json.dumps({"url": webhook_url}).encode()
                wreq = _ureq.Request("https://api.avito.ru/messenger/v3/webhook", data=wdata,
                                     headers={"Authorization": f"Bearer {token}",
                                              "Content-Type": "application/json"}, method="POST")
                with _ureq.urlopen(wreq, timeout=15) as r:
                    webhook_resp_raw = r.read().decode()
                webhook_ok = True
                cfg["_avito_webhook_registered"] = True
                print(f"[avito-check] webhook register response: {webhook_resp_raw[:300]}")
            except Exception as e:
                webhook_err = str(e)[:200]
                print(f"[avito-check] webhook register failed: {webhook_err}")

            cur.execute(f"""
                INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
            """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
            conn.commit()

            return ok({"ok": True, "avito_user_id": avito_user_id,
                       "name": me.get("name") or me.get("email"),
                       "webhook_registered": webhook_ok, "webhook_error": webhook_err})

        # ── AVITO-AUTH-URL: ссылка для входа владельца Avito-аккаунта (OAuth) ───────
        # ПРИМЕЧАНИЕ (29.07): для приложений типа «персональная авторизация» этот
        # путь НЕ работает (Avito отвечает «Что-то пошло не так» на /oauth) — и не
        # нужен: обычный client_credentials-токен уже даёт права messenger:read/write
        # (см. avito_get_messenger_token). Эндпоинт оставлен для др. типов приложений.
        if resource == "avito-auth-url" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else {}
            client_id_a = cfg.get("avito_client_id")
            if not client_id_a:
                return err("Сначала сохраните Client ID", 400)

            state = f"{owner_id}:{uuid.uuid4().hex}"
            return ok({"auth_url": avito_oauth_auth_url(client_id_a, state),
                       "redirect_uri": AVITO_REDIRECT_URI, "state": state})

        # ── AVITO-CALLBACK: приём code после входа владельца Avito-аккаунта ────────
        if resource == "avito-callback" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            code = body.get("code")
            if not code:
                return err("code обязателен", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else {}
            client_id_a = cfg.get("avito_client_id")
            client_secret_a = decrypt_secret(cfg.get("avito_client_secret"))
            if not client_id_a or not client_secret_a:
                return err("Сначала сохраните Client ID и Client Secret", 400)

            resp, oerr = avito_oauth_exchange_code(code, client_id_a, client_secret_a)
            if oerr:
                return err(oerr, 400)

            import time
            cfg["_avito_oauth_access_token"] = encrypt_secret(resp["access_token"])
            cfg["_avito_oauth_refresh_token"] = encrypt_secret(resp.get("refresh_token", ""))
            cfg["_avito_oauth_expires_at"] = time.time() + resp.get("expires_in", 86400)
            cfg["_avito_oauth_connected"] = True

            # Перерегистрируем вебхук уже ЭТИМ токеном (с правами messenger:read/write) —
            # именно это заставляет Avito реально доставлять сообщения на наш URL.
            wh_key = cfg.get("_channel_webhook_key")
            if not wh_key:
                wh_key = uuid.uuid4().hex
                cfg["_channel_webhook_key"] = wh_key
            webhook_url = (f"{SELF_FUNCTION_URL}?r=avito-webhook"
                           f"&company_id={owner_id}&key={wh_key}")
            webhook_ok = False
            webhook_err = None
            try:
                wdata = json.dumps({"url": webhook_url}).encode()
                wreq = _ureq.Request("https://api.avito.ru/messenger/v3/webhook", data=wdata,
                                     headers={"Authorization": f"Bearer {resp['access_token']}",
                                              "Content-Type": "application/json"}, method="POST")
                with _ureq.urlopen(wreq, timeout=15) as r:
                    r.read()
                webhook_ok = True
                cfg["_avito_webhook_registered"] = True
            except Exception as e:
                webhook_err = str(e)[:200]

            cur.execute(f"""
                INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
            """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
            conn.commit()

            return ok({"ok": True, "connected": True,
                       "webhook_registered": webhook_ok, "webhook_error": webhook_err})

        # ── AVITO-WEBHOOK-STATUS: диагностика — что реально видит Avito (список подписок) ──
        if resource == "avito-webhook-status" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else {}

            token, terr = avito_get_messenger_token(cur, conn, owner_id, cfg)
            if terr:
                return err(terr, 400)
            try:
                subs = avito_api_get(token, "/messenger/v1/subscriptions")
            except Exception as e:
                return err(f"Не удалось получить подписки: {str(e)[:200]}", 400)

            expected_url = (f"{SELF_FUNCTION_URL}?r=avito-webhook"
                            f"&company_id={owner_id}&key={cfg.get('_channel_webhook_key')}")
            return ok({"subscriptions": subs, "expected_url": expected_url,
                       "connected": bool(cfg.get("_avito_oauth_connected"))})

        # ── FIN-SETTINGS: настройки блока Доходы/Затраты — общие на компанию ───────
        # (видимость строк, кастомные строки). Раньше жили в localStorage браузера —
        # теперь одна настройка на всех сотрудников компании.
        if resource == "fin-settings":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            if method == "GET":
                cur.execute(
                    f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s",
                    (owner_id,))
                row = cur.fetchone()
                cfg = row[0] if row else {}
                return ok({
                    "row_visibility": cfg.get("_fin_row_visibility") or {},
                    "custom_fin_rows": cfg.get("_fin_custom_rows") or [],
                })

            if method == "POST":
                row_vis = body.get("row_visibility")
                custom_rows = body.get("custom_fin_rows")
                cur.execute(
                    f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s",
                    (owner_id,))
                row = cur.fetchone()
                cfg = dict(row[0]) if row and row[0] else {}
                if row_vis is not None:
                    if not isinstance(row_vis, dict):
                        return err("row_visibility must be an object")
                    cfg["_fin_row_visibility"] = row_vis
                if custom_rows is not None:
                    if not isinstance(custom_rows, list):
                        return err("custom_fin_rows must be an array")
                    cfg["_fin_custom_rows"] = custom_rows
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (company_id)
                    DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
                """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
                conn.commit()
                return ok({"saved": True})

        # ── TOUCHES: лента касаний клиента (модуль «Касания») ─────────────────────
        if resource == "touches":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            if method == "GET":
                client_id = qs.get("client_id")
                contact_id = qs.get("contact_id")  # id заявки live_chats (для Avito и др. каналов без телефона)
                phone_q = qs.get("phone")
                name_q = qs.get("name")
                cols = ("id, phone, name, state_summary, next_action, "
                        "interest, stage, analysis_updated_at, chat_type, group_title")

                if client_id:
                    # Режим по id touch_clients (обратная совместимость)
                    cur.execute(
                        f"SELECT {cols} FROM {SCHEMA}.touch_clients "
                        f"WHERE id=%s AND company_id=%s",
                        (client_id, owner_id))
                    cli = cur.fetchone()
                    if not cli:
                        return err("not found", 404)
                elif contact_id:
                    # Режим по id заявки: находим touch_clients, привязанный к этой заявке
                    # (touch_clients.crm_contact_id = live_chats.id). ПРИОРИТЕТ выше телефона:
                    # если у заявки уже есть переписка (напр. Avito по chat_id), а менеджер
                    # позже вписал телефон клиента вручную — канал сменился, но клиент тот же,
                    # переписка не должна теряться. При этом если телефон передан и у найденной
                    # записи он ещё не заполнен — дописываем его сюда же (не создаём нового).
                    cur.execute(
                        f"SELECT {cols} FROM {SCHEMA}.touch_clients "
                        f"WHERE crm_contact_id=%s AND company_id=%s ORDER BY id LIMIT 1",
                        (contact_id, owner_id))
                    cli = cur.fetchone()
                    if cli and phone_q:
                        norm = normalize_phone(phone_q)
                        if norm and not (cli[1] or "").strip():
                            cur.execute(
                                f"UPDATE {SCHEMA}.touch_clients SET phone=%s WHERE id=%s RETURNING {cols}",
                                (norm, cli[0]))
                            cli = cur.fetchone()
                            conn.commit()
                    if not cli:
                        # Нет привязанного touch_client по заявке — история касаний ещё не
                        # начиналась. Если при этом передан телефон — ищем/заводим клиента
                        # по нему как обычно (стандартный сценарий без Avito).
                        if phone_q:
                            norm = normalize_phone(phone_q)
                            if not norm:
                                return err("phone invalid")
                            cur.execute(
                                f"SELECT {cols} FROM {SCHEMA}.touch_clients "
                                f"WHERE phone=%s AND company_id=%s",
                                (norm, owner_id))
                            cli = cur.fetchone()
                            if not cli:
                                cur.execute(
                                    f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone, name, crm_contact_id) "
                                    f"VALUES (%s, %s, %s, %s) RETURNING {cols}",
                                    (owner_id, norm, name_q or None, contact_id))
                                cli = cur.fetchone()
                                conn.commit()
                            else:
                                # Найден по телефону, но не был привязан к этой заявке — привязываем
                                cur.execute(
                                    f"UPDATE {SCHEMA}.touch_clients SET crm_contact_id=%s WHERE id=%s AND crm_contact_id IS NULL",
                                    (contact_id, cli[0]))
                                conn.commit()
                        else:
                            return ok({"client": None, "touches": []})
                elif phone_q:
                    # Режим по номеру телефона: найти или создать touch_clients
                    norm = normalize_phone(phone_q)
                    if not norm:
                        return err("phone invalid")
                    cur.execute(
                        f"SELECT {cols} FROM {SCHEMA}.touch_clients "
                        f"WHERE phone=%s AND company_id=%s",
                        (norm, owner_id))
                    cli = cur.fetchone()
                    if not cli:
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone, name) "
                            f"VALUES (%s, %s, %s) RETURNING {cols}",
                            (owner_id, norm, name_q or None))
                        cli = cur.fetchone()
                        conn.commit()
                else:
                    return err("client_id or phone required")

                client_id = cli[0]
                # Общая на компанию отметка прочтения диалога (для счётчика непрочитанных)
                cur.execute(f"SELECT last_read_at FROM {SCHEMA}.touch_clients WHERE id=%s", (client_id,))
                _lr = cur.fetchone()
                last_read_at = _lr[0].isoformat() if _lr and _lr[0] else None
                client = {
                    "id": cli[0], "phone": cli[1], "name": cli[2],
                    "state_summary": cli[3], "next_action": cli[4],
                    "interest": cli[5], "stage": cli[6],
                    "analysis_updated_at": cli[7],
                    "last_read_at": last_read_at,
                    "chat_type": cli[8], "group_title": cli[9],
                }
                # Лента касаний по времени. status='hidden' — технические дубли звонков
                # (черновик click-to-call, который из-за сбоя не смог смэтчиться с
                # вебхуком завершения по external_id) — в ленте не показываем.
                # sender_name — кто из участников группы написал (для личных диалогов пусто).
                cur.execute(f"""
                    SELECT id, channel, direction, external_id, text, audio_url,
                           duration_sec, attachments, status, created_at, reply_to_id, sender_name,
                           starred, reactions
                    FROM {SCHEMA}.touch_events
                    WHERE client_id=%s AND status != 'hidden'
                    ORDER BY created_at ASC, id ASC
                """, (client_id,))
                touches = [{
                    "id": r[0], "channel": r[1], "direction": r[2], "external_id": r[3],
                    "text": r[4], "audio_url": r[5], "duration_sec": r[6],
                    "attachments": r[7], "status": r[8], "created_at": r[9],
                    "answered_by": (detect_call_answered_by(r[4], r[6], r[8]) if r[1] == "call" else None),
                    "reply_to_id": r[10], "sender_name": r[11],
                    "starred": r[12], "reactions": r[13],
                } for r in cur.fetchall()]

                # Последний детальный ИИ-анализ клиента (для вкладки «Аналитика»)
                cur.execute(f"""
                    SELECT state_summary, next_action, interest, interest_label,
                           stage, outcome, outcome_label, risks, key_points, created_at
                    FROM {SCHEMA}.touch_client_analyses
                    WHERE client_id=%s ORDER BY created_at DESC, id DESC LIMIT 1
                """, (client_id,))
                a = cur.fetchone()
                analysis = None
                if a:
                    analysis = {
                        "state_summary": a[0], "next_action": a[1],
                        "interest": a[2], "interest_label": a[3],
                        "stage": a[4], "outcome": a[5], "outcome_label": a[6],
                        "risks": a[7], "key_points": a[8], "created_at": a[9],
                    }
                return ok({"client": client, "touches": touches, "analysis": analysis})

        # ── ANALYZE-CLIENT / ANALYZE-CALL: перенесены в отдельную функцию crm-ai —
        # это операции, ждущие внешний ИИ-сервис до 30 сек, тогда как остальной
        # CRM отвечает за доли секунды. См. backend/crm-ai/index.py.

        # ═══════════════════════════════════════════════════════════════════════════
        # МЕССЕНДЖЕРЫ (ЛИНИИ): несколько Telegram/MAX-аккаунтов на компанию.
        # Воркер на VPS обслуживает сразу много компаний — сам приходит за работой
        # (pull-модель, открытых портов у воркера нет).
        # ═══════════════════════════════════════════════════════════════════════════

        # ── MESSENGER-CONFIG: ключ компании + адрес CRM для настройки воркера ──────
        if resource == "messenger-config":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = dict(row[0]) if row and row[0] else {}

            if method == "GET":
                return ok({
                    "webhook_key": cfg.get("_messenger_webhook_key"),
                    "base_url": SELF_FUNCTION_URL,
                    "enabled": cfg.get("messenger_enabled") == "true",
                })

            if method == "POST":
                if body.get("regenerate") or not cfg.get("_messenger_webhook_key"):
                    cfg["_messenger_webhook_key"] = uuid.uuid4().hex
                if "enabled" in body:
                    cfg["messenger_enabled"] = "true" if body.get("enabled") else "false"
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
                """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
                conn.commit()
                return ok({"webhook_key": cfg.get("_messenger_webhook_key"), "base_url": SELF_FUNCTION_URL})

            return err("unknown method")

        # ── MESSENGER-ACCOUNTS-LIST: список линий компании (экран настроек) ────────
        if resource == "messenger-accounts-list" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)
            cur.execute(f"""
                SELECT id, channel, title, external_id, phone, is_active, auth_status,
                       auth_payload, account_name, created_at
                FROM {SCHEMA}.messenger_accounts
                WHERE company_id=%s
                ORDER BY sort_order, id
            """, (owner_id,))
            items = [{
                "id": r[0], "channel": r[1], "title": r[2], "external_id": r[3],
                "phone": r[4], "is_active": r[5], "auth_status": r[6],
                "auth_payload": r[7] if r[6] in ("qr_ready", "password_requested", "error") else None,
                "account_name": r[8], "created_at": r[9],
            } for r in cur.fetchall()]
            return ok({"accounts": items})

        # ── MESSENGER-ACCOUNT-SAVE: создать/обновить линию ──────────────────────────
        if resource == "messenger-account-save" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            acc_id = body.get("id")
            channel_v = body.get("channel")
            title_v = (body.get("title") or "").strip()
            phone_v = (body.get("phone") or "").strip() or None
            is_active_v = body.get("is_active", True)

            if not acc_id:
                if channel_v not in ("telegram", "max"):
                    return err("channel должен быть telegram или max")
                if not title_v:
                    return err("title обязателен")
                if channel_v == "max" and not phone_v:
                    return err("для MAX номер телефона обязателен")
                external_id_v = body.get("external_id") or f"line_{uuid.uuid4().hex[:10]}"
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.messenger_accounts
                        (company_id, channel, title, external_id, phone, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (owner_id, channel_v, title_v, external_id_v, phone_v, is_active_v))
                new_id = cur.fetchone()[0]
                conn.commit()
                return ok({"id": new_id})
            else:
                cur.execute(f"SELECT id FROM {SCHEMA}.messenger_accounts WHERE id=%s AND company_id=%s", (acc_id, owner_id))
                if not cur.fetchone():
                    return err("линия не найдена", 404)
                cur.execute(f"""
                    UPDATE {SCHEMA}.messenger_accounts
                    SET title=COALESCE(%s, title), phone=COALESCE(%s, phone), is_active=COALESCE(%s, is_active)
                    WHERE id=%s AND company_id=%s
                """, (title_v or None, phone_v, is_active_v, acc_id, owner_id))
                conn.commit()
                return ok({"id": acc_id})

        # ── MESSENGER-ACCOUNT-DELETE: удалить линию (история сообщений остаётся) ───
        if resource == "messenger-account-delete" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)
            acc_id = body.get("id")
            if not acc_id:
                return err("id обязателен")
            cur.execute(f"""
                UPDATE {SCHEMA}.touch_events SET account_id=NULL WHERE account_id=%s
            """, (acc_id,))
            cur.execute(f"""
                DELETE FROM {SCHEMA}.messenger_accounts WHERE id=%s AND company_id=%s
            """, (acc_id, owner_id))
            conn.commit()
            return ok({"ok": True})

        # ── MESSENGER-ACCOUNT-AUTH-START: запросить вход по линии ──────────────────
        if resource == "messenger-account-auth-start" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)
            acc_id = body.get("id")
            if not acc_id:
                return err("id обязателен")
            cur.execute(f"""
                UPDATE {SCHEMA}.messenger_accounts
                SET auth_status='requested', auth_payload=NULL, auth_value=NULL, auth_updated_at=NOW()
                WHERE id=%s AND company_id=%s
            """, (acc_id, owner_id))
            if cur.rowcount == 0:
                return err("линия не найдена", 404)
            conn.commit()
            return ok({"ok": True})

        # ── MESSENGER-ACCOUNT-AUTH-SUBMIT: сотрудник ввёл код/пароль ────────────────
        if resource == "messenger-account-auth-submit" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)
            acc_id = body.get("id")
            value_v = (body.get("value") or "").strip()
            if not acc_id or not value_v:
                return err("id и value обязательны")
            cur.execute(f"""
                SELECT auth_status FROM {SCHEMA}.messenger_accounts WHERE id=%s AND company_id=%s
            """, (acc_id, owner_id))
            row = cur.fetchone()
            if not row:
                return err("линия не найдена", 404)
            cur_status = row[0]
            next_status = "code_submitted" if cur_status == "code_requested" else \
                          "password_submitted" if cur_status == "password_requested" else None
            if not next_status:
                return err("линия сейчас не ждёт код/пароль", 400)
            cur.execute(f"""
                UPDATE {SCHEMA}.messenger_accounts
                SET auth_status=%s, auth_value=%s, auth_updated_at=NOW()
                WHERE id=%s AND company_id=%s
            """, (next_status, value_v, acc_id, owner_id))
            conn.commit()
            return ok({"ok": True})

        # ── MESSENGER-ACCOUNT-AUTH-CANCEL: сбросить статус авторизации ──────────────
        if resource == "messenger-account-auth-cancel" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)
            acc_id = body.get("id")
            if not acc_id:
                return err("id обязателен")
            cur.execute(f"""
                UPDATE {SCHEMA}.messenger_accounts
                SET auth_status='none', auth_payload=NULL, auth_value=NULL, auth_updated_at=NOW()
                WHERE id=%s AND company_id=%s
            """, (acc_id, owner_id))
            conn.commit()
            return ok({"ok": True})

        # ── Проверка ключа воркера (X-Webhook-Key) для всех worker_* ниже ──────────
        def _messenger_worker_owner():
            """Возвращает owner_id по X-Webhook-Key. company_id в адресе необязателен —
            ключ уникален на компанию, воркер может присылать только заголовок."""
            wh_key = (event.get("headers") or {}).get("X-Webhook-Key", "")
            if not wh_key:
                return None
            company_id_q = qs.get("company_id")
            if company_id_q:
                try:
                    oid = int(company_id_q)
                except ValueError:
                    return None
                cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (oid,))
                r = cur.fetchone()
                cfg_w = r[0] if r else None
                if not cfg_w or cfg_w.get("_messenger_webhook_key") != wh_key:
                    return None
                return oid
            # company_id не передан — находим компанию по одному только ключу
            cur.execute(f"""
                SELECT company_id FROM {SCHEMA}.integrations
                WHERE config->>'_messenger_webhook_key' = %s
            """, (wh_key,))
            r = cur.fetchone()
            return r[0] if r else None

        # ── WORKER-ACCOUNTS: список активных линий компании (для воркера) ──────────
        if resource == "worker-accounts" and method == "GET":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            cur.execute(f"""
                SELECT external_id, channel, phone FROM {SCHEMA}.messenger_accounts
                WHERE company_id=%s AND is_active=TRUE
            """, (owner_id,))
            items = [{"external_id": r[0], "channel": r[1], "phone": r[2]} for r in cur.fetchall()]
            return ok({"accounts": items})

        # ── WORKER-NAMES-PENDING: контакты MAX/Telegram без имени (для дозаполнения
        # задним числом) — воркер по каждому chat_id спрашивает имя у мессенджера
        # напрямую (у него открыта сессия), CRM своими силами это узнать не может.
        if resource == "worker-names-pending" and method == "GET":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            channel_q = qs.get("channel")
            cur.execute(f"""
                SELECT id, channel_ids, phone
                FROM {SCHEMA}.touch_clients
                WHERE company_id=%s AND chat_type='private'
                      AND (name IS NULL OR name = '')
                      AND channel_ids IS NOT NULL AND channel_ids != '{{}}'::jsonb
                ORDER BY id DESC
                LIMIT 200
            """, (owner_id,))
            items = []
            for cid, channel_ids, phone in cur.fetchall():
                for ch, chat_id in (channel_ids or {}).items():
                    if ch not in ("telegram", "max"):
                        continue
                    if channel_q and ch != channel_q:
                        continue
                    items.append({"client_id": cid, "channel": ch, "chat_id": chat_id, "phone": phone})
            return ok({"items": items})

        # ── WORKER-NAMES-UPDATE: воркер присылает найденное имя контакта ───────────
        if resource == "worker-names-update" and method == "POST":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            cid = body.get("client_id")
            name_v = (body.get("name") or "").strip()
            if not cid or not name_v:
                return err("client_id и name обязательны")
            # COALESCE(NULLIF(...)) — не затираем имя, если его кто-то уже ввёл руками
            # между запросом списка и ответом воркера (защита от гонки).
            cur.execute(f"""
                UPDATE {SCHEMA}.touch_clients
                SET name = COALESCE(NULLIF(name, ''), %s)
                WHERE id=%s AND company_id=%s
            """, (name_v, int(cid), owner_id))
            conn.commit()
            return ok({"ok": True})

        # ── WORKER-AUTH-PENDING: линии, ожидающие действий по авторизации ──────────
        if resource == "worker-auth-pending" and method == "GET":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            cur.execute(f"""
                SELECT id, external_id, channel, phone, auth_status, auth_value
                FROM {SCHEMA}.messenger_accounts
                WHERE company_id=%s AND auth_status NOT IN ('none', 'authorized')
            """, (owner_id,))
            items = [{
                "id": r[0], "external_id": r[1], "channel": r[2], "phone": r[3],
                "auth_status": r[4], "auth_value": r[5],
            } for r in cur.fetchall()]
            return ok({"accounts": items})

        # ── WORKER-AUTH-UPDATE: воркер отчитывается о ходе авторизации линии ───────
        if resource == "worker-auth-update" and method == "POST":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            acc_id = body.get("id")
            status_v = body.get("status")
            payload_v = body.get("payload")
            valid_statuses = ("connecting", "qr_ready", "code_requested", "password_requested",
                               "authorized", "error")
            if not acc_id or status_v not in valid_statuses:
                return err("id и валидный status обязательны")
            if status_v == "authorized":
                cur.execute(f"""
                    UPDATE {SCHEMA}.messenger_accounts
                    SET auth_status='authorized', auth_payload=NULL, auth_value=NULL,
                        account_name=%s, auth_updated_at=NOW()
                    WHERE id=%s AND company_id=%s
                """, (payload_v, acc_id, owner_id))
            else:
                # consume_value: воркер подтверждает, что забрал введённый код/пароль —
                # затираем auth_value, чтобы не отдать его повторно по ошибке.
                if body.get("consume_value"):
                    cur.execute(f"""
                        UPDATE {SCHEMA}.messenger_accounts
                        SET auth_status=%s, auth_payload=%s, auth_value=NULL, auth_updated_at=NOW()
                        WHERE id=%s AND company_id=%s
                    """, (status_v, payload_v, acc_id, owner_id))
                else:
                    cur.execute(f"""
                        UPDATE {SCHEMA}.messenger_accounts
                        SET auth_status=%s, auth_payload=%s, auth_updated_at=NOW()
                        WHERE id=%s AND company_id=%s
                    """, (status_v, payload_v, acc_id, owner_id))
            conn.commit()
            return ok({"ok": True})

        # ── WORKER-INCOMING: новое сообщение от воркера → лента «Касания» ──────────
        if resource == "worker-incoming" and method == "POST":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)

            channel_v = body.get("channel")
            phone_v = body.get("phone")
            chat_id_v = body.get("chat_id")
            external_msg_id_v = body.get("external_msg_id")
            text_v = body.get("text")
            reply_to_ext_v = body.get("reply_to_external_msg_id")
            external_id_v = body.get("external_id")  # какая линия приняла сообщение
            # Воркер сам определяет направление: 'out' — это МЫ написали (в т.ч. вручную
            # с телефона тем же аккаунтом-линией), 'in' — написал клиент. Раньше это поле
            # не читалось вообще, и ЛЮБОЕ сообщение (даже наше) записывалось как 'in' —
            # из-за этого переписка выглядела так, будто клиент пишет сам себе.
            direction_v = "out" if body.get("direction") == "out" else "in"

            # Тип чата: группа или личная переписка.
            # Воркер может прислать признак явно (chat_type/is_group). Если не прислал —
            # определяем по ID чата: и в Telegram, и в MAX у групп он отрицательный.
            # Без этого групповые чаты MAX попадали в CRM как обычные личные диалоги.
            raw_chat_type = (body.get("chat_type") or "").strip().lower()
            is_group_flag = body.get("is_group")
            chat_id_str = str(chat_id_v) if chat_id_v not in (None, "") else ""
            if raw_chat_type in ("group", "chat", "supergroup", "channel"):
                chat_type_v = "channel" if raw_chat_type == "channel" else "group"
            elif raw_chat_type == "private":
                chat_type_v = "private"
            elif is_group_flag is True:
                chat_type_v = "group"
            elif is_group_flag is False:
                chat_type_v = "private"
            else:
                chat_type_v = "group" if chat_id_str.startswith("-") else "private"

            # Название группы и имя автора сообщения внутри группы
            group_title_v = body.get("group_title") or body.get("chat_title") or None
            sender_name_v = body.get("sender_name") or body.get("from_name") or None
            # Имя контакта (MAX не передаёт телефон — имя единственный способ узнать человека)
            contact_name_v = (body.get("name") or body.get("contact_name")
                              or body.get("first_name") or body.get("username") or None)
            # Как подписывать карточку: у группы — её название, у личного чата — имя контакта
            display_name_v = (group_title_v if chat_type_v != "private" else contact_name_v)
            if chat_type_v == "private" and not contact_name_v:
                print(f"[worker-incoming] NO NAME channel={channel_v} chat_id={chat_id_v} raw_body={json.dumps(body, ensure_ascii=False)}")

            # Вложения из мессенджера. Воркер может прислать их в разных видах:
            # готовым списком attachments или одиночными полями media_url/media_type.
            # Приводим всё к единому формату CRM: [{type, url, filename, duration_sec}].
            incoming_atts, incoming_audio, incoming_dur = normalize_incoming_media(body)

            # Сообщение пришло совсем пустым: ни текста, ни распознанного вложения.
            # Логируем сырое тело целиком — единственный способ понять, что именно
            # воркер прислал в этот раз (новый тип контента, который мы ещё не умеем
            # разбирать), не имея прямого доступа к самому воркеру на VPS.
            if not text_v and not incoming_atts:
                print(f"[worker-incoming] EMPTY payload channel={channel_v} raw_body={json.dumps(body, ensure_ascii=False)}")

            if channel_v not in ("telegram", "max"):
                return err("unknown channel")
            if not phone_v and not chat_id_v:
                return err("phone или chat_id обязателен")

            account_id_v = None
            if external_id_v:
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.messenger_accounts WHERE company_id=%s AND external_id=%s
                """, (owner_id, external_id_v))
                arow = cur.fetchone()
                account_id_v = arow[0] if arow else None

            # Матчинг клиента: сначала по телефону, иначе по chat_id из прошлой переписки
            client_row = None
            if phone_v:
                norm = normalize_phone(phone_v)
                if norm:
                    cur.execute(f"SELECT id FROM {SCHEMA}.touch_clients WHERE phone=%s AND company_id=%s", (norm, owner_id))
                    client_row = cur.fetchone()
                    if not client_row:
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone, name, chat_type, group_title) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                            (owner_id, norm, display_name_v, chat_type_v, group_title_v))
                        client_row = cur.fetchone()
                        conn.commit()
            if not client_row and chat_id_v:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.touch_clients WHERE company_id=%s AND channel_ids->>%s = %s",
                    (owner_id, channel_v, str(chat_id_v)))
                client_row = cur.fetchone()
                if not client_row:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.touch_clients (company_id, name, channel_ids, chat_type, group_title) VALUES (%s, %s, %s::jsonb, %s, %s) RETURNING id",
                        (owner_id, display_name_v, json.dumps({channel_v: str(chat_id_v)}), chat_type_v, group_title_v))
                    client_row = cur.fetchone()
                    conn.commit()
            if not client_row:
                return err("не удалось определить клиента", 400)
            client_id_v = client_row[0]

            if chat_id_v:
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_clients
                    SET channel_ids = COALESCE(channel_ids, '{{}}'::jsonb) || %s::jsonb
                    WHERE id=%s
                """, (json.dumps({channel_v: str(chat_id_v)}), client_id_v))
                conn.commit()

            # Дозаполняем карточку тем, что узнали из входящего сообщения.
            # Правило: НЕ затираем данные, введённые человеком вручную — заполняем
            # только пустые поля. Тип чата поправляем, если он ошибочно 'private',
            # а на деле пришла группа (так чинятся старые карточки MAX).
            cur.execute(f"""
                UPDATE {SCHEMA}.touch_clients
                SET name = COALESCE(NULLIF(name, ''), %s),
                    group_title = COALESCE(NULLIF(group_title, ''), %s),
                    chat_type = CASE WHEN %s <> 'private' THEN %s ELSE chat_type END
                WHERE id = %s
            """, (display_name_v, group_title_v, chat_type_v, chat_type_v, client_id_v))
            conn.commit()

            reply_to_id_v = None
            if reply_to_ext_v:
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.touch_events WHERE channel=%s AND external_id=%s
                """, (channel_v, reply_to_ext_v))
                rrow = cur.fetchone()
                reply_to_id_v = rrow[0] if rrow else None

            try:
                # Статус для нашего же исходящего (написали вручную с телефона) — сразу
                # 'sent', а не 'received' (тот означает «клиент прочитал», что для только
                # что отправленного сообщения неверно).
                status_v = "sent" if direction_v == "out" else "received"
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.touch_events
                        (client_id, channel, direction, external_id, text, status, reply_to_id,
                         account_id, sender_name, attachments, audio_url, duration_sec)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                """, (client_id_v, channel_v, direction_v, external_msg_id_v, text_v, status_v, reply_to_id_v, account_id_v,
                      sender_name_v,
                      json.dumps(incoming_atts, ensure_ascii=False) if incoming_atts else None,
                      incoming_audio, incoming_dur))
                conn.commit()
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return ok({"duplicate": True, "client_id": client_id_v})

            return ok({"client_id": client_id_v})

        # ── WORKER-PENDING: очередь исходящих для воркера (линии/мессенджеры) ──────
        if resource == "worker-pending" and method == "GET":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            channel_q = qs.get("channel")
            cur.execute(f"""
                SELECT te.id, te.client_id, te.text, te.channel, tc.channel_ids, tc.phone, ma.external_id,
                       te.attachments, te.reply_to_id,
                       (SELECT rt.external_id FROM {SCHEMA}.touch_events rt WHERE rt.id = te.reply_to_id)
                FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id
                LEFT JOIN {SCHEMA}.messenger_accounts ma ON ma.id = te.account_id
                WHERE tc.company_id=%s AND te.direction='out' AND te.status='pending'
                      AND te.channel IN ('telegram', 'max')
                      {"AND te.channel=%s" if channel_q else ""}
                ORDER BY te.created_at ASC
                LIMIT 20
            """, (owner_id, channel_q) if channel_q else (owner_id,))
            rows = cur.fetchall()
            ids = [r[0] for r in rows]
            items = []
            for touch_id, cid, text, msg_channel, channel_ids, phone, ext_line, atts, reply_id, reply_ext in rows:
                # Вложения отдаём и списком, и первым файлом отдельными полями —
                # чтобы воркер понял их в любом из форматов, без подгонки версий.
                att_list = atts if isinstance(atts, list) else []
                first = att_list[0] if att_list else None
                items.append({
                    "message_id": touch_id,
                    "touch_id": touch_id,
                    "client_id": cid,
                    "channel": msg_channel,
                    "chat_id": (channel_ids or {}).get(msg_channel),
                    "phone": phone,
                    "text": text,
                    "line_external_id": ext_line,
                    "external_id": ext_line,
                    "attachments": att_list,
                    "media_url": (first or {}).get("url"),
                    "media_type": (first or {}).get("type"),
                    "file_name": (first or {}).get("filename"),
                    "reply_to_id": reply_id,
                    "reply_to_external_msg_id": reply_ext,
                })
            if ids:
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_events SET status='sending' WHERE id = ANY(%s)
                """, (ids,))
                conn.commit()
            return ok({"messages": items})

        # ── WORKER-MARK-SENT: воркер подтверждает отправку/ошибку ──────────────────
        if resource == "worker-mark-sent" and method == "POST":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            touch_id_v = body.get("message_id")
            ok_v = body.get("ok")
            if not touch_id_v:
                return err("message_id обязателен")
            if ok_v:
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_events SET status='sent', external_id=COALESCE(%s, external_id)
                    WHERE id=%s
                """, (body.get("external_msg_id"), touch_id_v))
                # MAX отдаёт chat_id только при первой успешной отправке (написали
                # первыми по номеру) — без этого следующее входящее от клиента
                # не свяжется с диалогом. Сохраняем в channel_ids клиента, если пришёл.
                chat_id_v = body.get("chat_id")
                if chat_id_v:
                    cur.execute(f"""
                        SELECT client_id, channel FROM {SCHEMA}.touch_events WHERE id=%s
                    """, (touch_id_v,))
                    trow = cur.fetchone()
                    if trow:
                        cur.execute(f"""
                            UPDATE {SCHEMA}.touch_clients
                            SET channel_ids = COALESCE(channel_ids, '{{}}'::jsonb) || %s::jsonb
                            WHERE id=%s
                        """, (json.dumps({trow[1]: str(chat_id_v)}), trow[0]))
            else:
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_events SET status='error' WHERE id=%s
                """, (touch_id_v,))
            conn.commit()
            return ok({"ok": True})

        # ── WORKER-REACTION: клиент поставил/снял реакцию на сообщение ─────────────
        # Воркер сообщает о реакции в мессенджере. Ищем сообщение по его ID в канале
        # (external_id) — это надёжнее, чем по внутреннему id CRM.
        if resource == "worker-reaction" and method == "POST":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            channel_v = body.get("channel")
            ext_msg_v = body.get("external_msg_id") or body.get("message_external_id")
            emoji_v = (body.get("emoji") or body.get("reaction") or "").strip()
            author_v = body.get("author") or body.get("sender_name") or None
            removed_v = bool(body.get("removed"))
            if not channel_v or not ext_msg_v:
                return err("channel и external_msg_id обязательны")
            cur.execute(f"""
                SELECT te.id, te.reactions FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id
                WHERE tc.company_id=%s AND te.channel=%s AND te.external_id=%s
                LIMIT 1
            """, (owner_id, channel_v, str(ext_msg_v)))
            rrow = cur.fetchone()
            if not rrow:
                return ok({"skipped": "message not found"})
            cur_reactions = rrow[1] if isinstance(rrow[1], list) else []
            # Убираем прошлую реакцию этого же автора, затем добавляем новую
            cur_reactions = [x for x in cur_reactions
                             if not (isinstance(x, dict) and x.get("author") == author_v)]
            if emoji_v and not removed_v:
                cur_reactions.append({"emoji": emoji_v, "author": author_v, "by": "in"})
            cur.execute(f"""
                UPDATE {SCHEMA}.touch_events SET reactions=%s::jsonb WHERE id=%s
            """, (json.dumps(cur_reactions, ensure_ascii=False) if cur_reactions else None, rrow[0]))
            conn.commit()
            return ok({"ok": True, "touch_id": rrow[0]})

        # ── WORKER-STAR: клиент отметил сообщение в мессенджере ────────────────────
        if resource == "worker-star" and method == "POST":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            channel_v = body.get("channel")
            ext_msg_v = body.get("external_msg_id") or body.get("message_external_id")
            if not channel_v or not ext_msg_v:
                return err("channel и external_msg_id обязательны")
            cur.execute(f"""
                UPDATE {SCHEMA}.touch_events te SET starred=%s
                FROM {SCHEMA}.touch_clients tc
                WHERE tc.id = te.client_id AND tc.company_id=%s
                      AND te.channel=%s AND te.external_id=%s
            """, (bool(body.get("starred", True)), owner_id, channel_v, str(ext_msg_v)))
            conn.commit()
            return ok({"ok": True})

        # ── TOUCH-RESEND: повторная отправка сообщения после ошибки ────────────────
        # Не создаём копию: возвращаем то же сообщение в очередь, чтобы история
        # переписки не засорялась дублями. Воркер заберёт его на ближайшем опросе.
        if resource == "touch-resend" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            touch_id_v = body.get("touch_id") or body.get("message_id")
            if not touch_id_v:
                return err("touch_id обязателен")
            cur.execute(f"""
                UPDATE {SCHEMA}.touch_events te SET status='pending'
                FROM {SCHEMA}.touch_clients tc
                WHERE tc.id = te.client_id AND tc.company_id=%s
                      AND te.id=%s AND te.direction='out'
                      AND te.status IN ('error', 'sending')
                RETURNING te.channel
            """, (owner_id, touch_id_v))
            rrow = cur.fetchone()
            conn.commit()
            if not rrow:
                return err("сообщение не найдено или его нельзя переотправить", 404)
            if rrow[0] in ("telegram", "max"):
                notify_worker_push("resend")
            return ok({"ok": True, "status": "pending"})

        # ── TOUCH-STAR: менеджер отметил сообщение в CRM ───────────────────────────
        if resource == "touch-star" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            touch_id_v = body.get("touch_id")
            if not touch_id_v:
                return err("touch_id обязателен")
            cur.execute(f"""
                UPDATE {SCHEMA}.touch_events te SET starred=%s
                FROM {SCHEMA}.touch_clients tc
                WHERE tc.id = te.client_id AND tc.company_id=%s AND te.id=%s
                RETURNING te.starred
            """, (bool(body.get("starred", True)), owner_id, touch_id_v))
            rrow = cur.fetchone()
            conn.commit()
            if not rrow:
                return err("сообщение не найдено", 404)
            return ok({"ok": True, "starred": rrow[0]})

        # ── TOUCH-REACT: менеджер поставил реакцию на сообщение ────────────────────
        # Реакция сохраняется в CRM сразу; если канал поддерживает — воркер
        # доставит её в мессенджер (для этого отдаём её в очередь на отправку).
        if resource == "touch-react" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            touch_id_v = body.get("touch_id")
            emoji_v = (body.get("emoji") or "").strip()
            if not touch_id_v:
                return err("touch_id обязателен")
            cur.execute(f"""
                SELECT te.id, te.reactions FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id
                WHERE tc.company_id=%s AND te.id=%s
            """, (owner_id, touch_id_v))
            rrow = cur.fetchone()
            if not rrow:
                return err("сообщение не найдено", 404)
            cur_reactions = rrow[1] if isinstance(rrow[1], list) else []
            # Реакция менеджера одна: старую свою убираем, новую ставим
            cur_reactions = [x for x in cur_reactions
                             if not (isinstance(x, dict) and x.get("by") == "out")]
            if emoji_v:
                cur_reactions.append({"emoji": emoji_v, "author": "Менеджер", "by": "out"})
            cur.execute(f"""
                UPDATE {SCHEMA}.touch_events SET reactions=%s::jsonb WHERE id=%s
            """, (json.dumps(cur_reactions, ensure_ascii=False) if cur_reactions else None, touch_id_v))
            # Реакция на сообщение клиента — это по сути реакция/ответ менеджера,
            # диалог считается просмотренным: сдвигаем «прочитано до» на момент ЭТОГО
            # сообщения (не на "сейчас" — если после него пришло что-то ещё, оно
            # должно остаться непрочитанным), иначе список диалогов слева продолжает
            # показывать его как неотвеченный, хотя менеджер уже отреагировал.
            if emoji_v:
                # touch_events.created_at хранится БЕЗ часового пояса, а last_read_at — С
                # поясом (та же особенность отмечена в calc_unread) — приводим явно к
                # timestamptz, иначе GREATEST падает с ошибкой несовместимых типов.
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_clients SET last_read_at = GREATEST(
                        COALESCE(last_read_at, 'epoch'::timestamptz),
                        (SELECT created_at::timestamptz FROM {SCHEMA}.touch_events WHERE id=%s)
                    )
                    WHERE id = (SELECT client_id FROM {SCHEMA}.touch_events WHERE id=%s)
                """, (touch_id_v, touch_id_v))
            conn.commit()
            return ok({"ok": True, "reactions": cur_reactions})

        # ── WORKER-MARK-READ: собеседник прочитал сообщение(я) ──────────────────────
        if resource == "worker-mark-read" and method == "POST":
            owner_id = _messenger_worker_owner()
            if not owner_id:
                return err("неверный ключ", 401)
            channel_v = body.get("channel")
            chat_id_v = body.get("chat_id")
            if not channel_v or not chat_id_v:
                return err("channel и chat_id обязательны")
            cur.execute(f"""
                SELECT tc.id FROM {SCHEMA}.touch_clients tc
                WHERE tc.company_id=%s AND tc.channel_ids->>%s = %s
            """, (owner_id, channel_v, str(chat_id_v)))
            crow = cur.fetchone()
            if crow:
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_events SET status='received'
                    WHERE client_id=%s AND channel=%s AND direction='out' AND status='sent'
                """, (crow[0], channel_v))
                conn.commit()
            return ok({"ok": True})

        # ── MESSENGER-REGISTRY: реестр всех компаний для воркера на VPS ────────────
        # Воркер опрашивает этот единственный эндпоинт (например раз в час) и сам
        # подтягивает список компаний с включённой интеграцией — руками дописывать
        # TENANTS в config.py и перезапускать процесс на VPS больше не нужно.
        # Защита — общий TG_PROXY_TOKEN (не секрет отдельной компании, воркер и так
        # его знает).
        if resource == "messenger-registry" and method == "GET":
            worker_token = (event.get("headers") or {}).get("X-Worker-Token", "")
            if not worker_token or worker_token != os.environ.get("TG_PROXY_TOKEN"):
                return err("неверный токен воркера", 401)

            cur.execute(f"""
                SELECT company_id, config->>'_messenger_webhook_key'
                FROM {SCHEMA}.integrations
                WHERE config->>'messenger_enabled' = 'true' AND config->>'_messenger_webhook_key' IS NOT NULL
            """)
            companies = cur.fetchall()

            tenants = []
            for cid, wh_key in companies:
                cur.execute(f"""
                    SELECT external_id, channel, phone FROM {SCHEMA}.messenger_accounts
                    WHERE company_id=%s AND is_active=TRUE
                """, (cid,))
                accounts = [{"external_id": r[0], "channel": r[1], "phone": r[2]} for r in cur.fetchall()]
                tenants.append({
                    "tenant_id": f"company_{cid}",
                    "company_id": cid,
                    "crm_base_url": SELF_FUNCTION_URL,
                    "webhook_key": wh_key,
                    "accounts": accounts,
                })
            return ok({"tenants": tenants})

        # ── AVITO-WEBHOOK: приём входящих от Avito Messenger (Avito шлёт сам) ──────
        # URL этого вебхука регистрируется в Avito. Защита — секретный ключ в query.
        if resource == "avito-webhook" and method == "POST":
            company_id_q = qs.get("company_id")
            webhook_key  = qs.get("key", "")
            if not company_id_q or not webhook_key:
                return err("company_id и key обязательны", 401)
            try:
                owner_id = int(company_id_q)
            except ValueError:
                return err("company_id invalid")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else None
            if not cfg or cfg.get("_channel_webhook_key") != webhook_key:
                return err("неверный ключ", 401)
            if cfg.get("avito_enabled") == "false":
                return ok({"skipped": True, "reason": "disabled"})

            # ── Постоянный сырой лог входящих событий Avito ──────────────────────
            # Раньше события звонков терялись без следа — сохраняем КАЖДОЕ сырое
            # событие в отдельную таблицу ДО какой-либо фильтрации/парсинга, чтобы
            # при потере заявки можно было посмотреть, что именно прислал Avito
            # (формат события может отличаться от ожидаемого — value.type у Avito
            # непостоянен, у звонков встречается и как payload.type, и как
            # payload.value.type в разных версиях API).
            raw_log_id = None
            try:
                payload_outer = (body or {}).get("payload") or {}
                _probe_value = payload_outer.get("value") or {}
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.avito_webhook_raw_log
                        (company_id, msg_type, chat_id, payload)
                        VALUES (%s,%s,%s,%s::jsonb) RETURNING id""",
                    (owner_id,
                     (payload_outer.get("type") or _probe_value.get("type") or ""),
                     str(_probe_value.get("chat_id") or ""),
                     json.dumps(body, ensure_ascii=False))
                )
                raw_log_id = cur.fetchone()[0]
                conn.commit()
            except Exception as _log_err:
                conn.rollback()
                print(f"[avito-webhook] raw log insert failed: {str(_log_err)[:300]}")

            # Формат Avito: {"payload": {"type":"message","value":{...}}}.
            # ⚠️ Тип события ищем И на внешнем уровне (payload.type), И на
            # внутреннем (payload.value.type) — раньше читали только внутренний,
            # из-за чего события, где тип приходит снаружи (что похоже на случай
            # со звонками), не распознавались и молча терялись.
            value = ((body or {}).get("payload") or {}).get("value") or {}
            outer_type = ((body or {}).get("payload") or {}).get("type") or ""
            av_chat_id = value.get("chat_id")
            av_author  = value.get("author_id")
            av_user_id = value.get("user_id")  # получатель = наш аккаунт
            content    = value.get("content") or {}
            text       = content.get("text")
            msg_id     = value.get("id")
            msg_type   = (value.get("type") or outer_type or "").lower()

            # ── Не-текстовые сообщения: картинки и звонки ────────────────────────
            # Раньше сюда попадал только текст, поэтому фото от клиента и звонки
            # (входящие / исходящие / пропущенные) в переписку не сохранялись вообще.
            av_attachments = None
            if msg_type == "image":
                # Avito отдаёт несколько размеров — берём самый крупный доступный
                img = content.get("image") or {}
                sizes = img.get("sizes") or {}
                img_url = None
                if isinstance(sizes, dict) and sizes:
                    def _px(k):
                        try:
                            return int(str(k).split("x")[0])
                        except Exception:
                            return 0
                    img_url = sizes[max(sizes.keys(), key=_px)]
                img_url = img_url or img.get("url")
                if img_url:
                    av_attachments = [{"type": "image", "url": img_url}]
                    text = text or "Фото"

            elif "call" in msg_type:
                # Звонок: показываем понятную строку прямо в ленте переписки.
                # Проверяем "call" по вхождению (а не точным равенством), т.к. у
                # Avito встречаются варианты названия типа события (call,
                # voice_call, missed_call и т.п.) — точное сравнение раньше
                # пропускало часть звонков молча.
                call = content.get("call") or value.get("call") or {}
                st = (call.get("status") or "").lower()
                secs = call.get("duration") or call.get("duration_sec") or 0
                if "missed" in msg_type or st in ("missed", "no-answer", "noanswer", "busy", "declined"):
                    text = "Пропущенный звонок"
                elif secs:
                    mm, ss = divmod(int(secs or 0), 60)
                    dur = f"{mm} мин {ss} сек" if mm else f"{ss} сек"
                    text = f"Звонок · {dur}"
                else:
                    text = "Звонок"

            # Служебные события без чата/содержимого пропускаем — но фиксируем
            # причину в сыром логе, чтобы не гадать при следующей потере заявки.
            if not av_chat_id or not text:
                if raw_log_id:
                    try:
                        cur.execute(
                            f"UPDATE {SCHEMA}.avito_webhook_raw_log SET error=%s WHERE id=%s",
                            (f"skipped: chat_id={av_chat_id!r} text={text!r} msg_type={msg_type!r}", raw_log_id))
                        conn.commit()
                    except Exception:
                        conn.rollback()
                return ok({"skipped": True})

            # Определяем направление: если автор — наш аккаунт Avito, значит сообщение
            # написал менеджер (в кабинете Avito или из нашей системы) → это исходящее.
            # Раньше такие события просто отбрасывались, поэтому переписка была неполной:
            # ответы менеджера, набранные в самом Avito, в систему не попадали.
            is_own = bool(av_author and av_user_id and str(av_author) == str(av_user_id))
            av_direction = "out" if is_own else "in"

            # Защита от дублей: если это сообщение мы сами отправили из системы,
            # оно уже сохранено (external_id записан при отправке) — второй раз не пишем.
            if is_own and msg_id:
                cur.execute(
                    f"SELECT 1 FROM {SCHEMA}.touch_events WHERE channel='avito' AND external_id=%s",
                    (f"avito_{msg_id}",))
                if cur.fetchone():
                    return ok({"duplicate_own": True})

            # Прямая ссылка на диалог в веб-версии Avito (для кнопки «Открыть в Avito»)
            avito_chat_url = f"https://www.avito.ru/profile/messenger/channel/{av_chat_id}"

            # Находим/создаём клиента по avito chat_id (телефона в Avito обычно нет)
            cur.execute(
                f"SELECT id FROM {SCHEMA}.touch_clients WHERE company_id=%s AND channel_ids->>'avito' = %s",
                (owner_id, str(av_chat_id)))
            client_row = cur.fetchone()
            is_new_client = not client_row
            if is_new_client:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.touch_clients (company_id, name, channel_ids) "
                    f"VALUES (%s, %s, %s::jsonb) RETURNING id",
                    (owner_id, None, json.dumps({"avito": str(av_chat_id)})))
                client_row = cur.fetchone()
                conn.commit()
            client_id = client_row[0]

            # Первое сообщение от нового Avito-клиента — сразу создаём заявку в CRM
            # (та же таблица, что и остальные заявки), с меткой источника «Авито».
            if is_new_client:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.users WHERE email='mospotolkipro@gmail.com'")
                master_row = cur.fetchone()
                master_id = master_row[0] if master_row else None
                final_company_id = owner_id or master_id

                # Пытаемся получить настоящее имя покупателя через Avito API.
                # Если не получилось (нет токена / API недоступен) — используем заглушку,
                # приём сообщения это не блокирует (Avito ждёт быстрый ответ).
                real_name = None
                our_uid = cfg.get("_avito_user_id")
                token, terr = avito_get_messenger_token(cur, conn, owner_id, cfg)
                if token:
                    real_name = avito_fetch_client_name(token, av_user_id, av_chat_id, our_uid)
                client_name = real_name or "Клиент с Avito"

                cur.execute(f"""
                    INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, status, notes, source, created_via, company_id, avito_chat_url, next_call_date, status_changed_at)
                    VALUES (%s, %s, %s, 'new', %s, 'Авито', 'chat', %s, %s, %s, NOW())
                    RETURNING id
                """, (f"avito_{av_chat_id}", client_name, "",
                      (f"Первое сообщение менеджера: {text[:200]}" if av_direction == "out"
                       else f"Первое сообщение: {text[:200]}"), final_company_id, avito_chat_url, default_next_call_date()))
                new_order_id = cur.fetchone()[0]
                cur.execute(
                    f"UPDATE {SCHEMA}.touch_clients SET crm_contact_id=%s, name=%s WHERE id=%s",
                    (new_order_id, real_name, client_id))
                conn.commit()
            else:
                # Клиент уже есть. Если имя ещё не получено (пусто/заглушка) — пробуем
                # дозагрузить его сейчас: у Avito имя часто появляется позже первого касания.
                cur.execute(
                    f"SELECT name FROM {SCHEMA}.touch_clients WHERE id=%s", (client_id,))
                nrow = cur.fetchone()
                cur_name = (nrow[0] if nrow else None) or ""
                if not cur_name.strip() or cur_name.strip() == "Клиент с Avito":
                    our_uid = cfg.get("_avito_user_id")
                    token, terr = avito_get_messenger_token(cur, conn, owner_id, cfg)
                    if token:
                        fresh_name = avito_fetch_client_name(token, av_user_id, av_chat_id, our_uid)
                        if fresh_name and fresh_name.strip() != (cur_name or "").strip():
                            cur.execute(
                                f"UPDATE {SCHEMA}.touch_clients SET name=%s WHERE id=%s",
                                (fresh_name, client_id))
                            # Обновляем и связанную заявку в CRM (если там ещё заглушка)
                            cur.execute(f"""
                                UPDATE {SCHEMA}.live_chats SET client_name=%s
                                WHERE session_id=%s
                                  AND (client_name IS NULL OR client_name='' OR client_name='Клиент с Avito')
                            """, (fresh_name, f"avito_{av_chat_id}"))
                            conn.commit()

            try:
                # direction: 'in' — написал клиент, 'out' — ответил менеджер
                # (в том числе прямо в кабинете Avito — такие сообщения теперь тоже видны).
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.touch_events
                        (client_id, channel, direction, external_id, text, status, attachments)
                    VALUES (%s, 'avito', %s, %s, %s, %s, %s::jsonb)
                """, (client_id, av_direction, f"avito_{msg_id}" if msg_id else None, text,
                      "sent" if av_direction == "out" else "received",
                      json.dumps(av_attachments) if av_attachments else None))
                conn.commit()
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return ok({"duplicate": True})

            # ВАЖНО: ИИ-анализ клиента (внешний вызов до 45 сек) сюда специально НЕ включаем —
            # Avito ждёт быстрый ответ на вебхук (около 2 сек) и молча отключает доставку,
            # если сервер отвечает медленно. Анализ пересобирается отдельно — при открытии
            # карточки клиента в CRM (см. resource == "touches" analyze).
            if raw_log_id:
                try:
                    cur.execute(f"UPDATE {SCHEMA}.avito_webhook_raw_log SET processed=true WHERE id=%s", (raw_log_id,))
                    conn.commit()
                except Exception:
                    conn.rollback()
            return ok({"client_id": client_id, "saved": True})

        # ── UIS-WEBHOOK-CONFIG: секретный ключ + URL вебхука для ЛК UIS ──
        if resource == "uis-webhook-config":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = dict(row[0]) if row and row[0] else {}

            if method == "GET":
                wh_key = cfg.get("_uis_webhook_key")
                webhook_url = (f"{SELF_FUNCTION_URL}?r=uis-webhook&company_id={owner_id}&key={wh_key}"
                               if wh_key else None)
                cur.execute(f"""
                    SELECT COUNT(*) FROM {SCHEMA}.touch_events te
                    JOIN {SCHEMA}.touch_clients tc ON tc.id=te.client_id
                    WHERE te.channel='call' AND tc.company_id=%s
                """, (owner_id,))
                calls_count = cur.fetchone()[0]
                return ok({
                    "webhook_url": webhook_url,
                    "calls_count": calls_count,
                    "last_event_at": cfg.get("_uis_last_event_at"),
                })

            if method == "POST" and body.get("regenerate"):
                new_key = uuid.uuid4().hex
                cfg["_uis_webhook_key"] = new_key
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
                """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
                conn.commit()
                webhook_url = f"{SELF_FUNCTION_URL}?r=uis-webhook&company_id={owner_id}&key={new_key}"
                return ok({"webhook_url": webhook_url})

            return err("unknown action")

        # ── UIS-ROUTE-CALL: узел "Интерактивная обработка вызова" в сценарии UIS ───
        # UIS дёргает этот адрес ВО ВРЕМЯ звонка (до соединения с сотрудником) и
        # спрашивает, на какую линию направить клиента. Мы смотрим на этап сделки
        # в CRM по номеру телефона и отвечаем "line1" или "line2". Защита — тот же
        # секретный ключ, что и у uis-webhook (сервис ровно тот же — UIS этой же
        # компании, отдельный ключ не нужен).
        if resource == "uis-route-call":
            company_id_q = qs.get("company_id")
            webhook_key  = qs.get("key", "")
            if not company_id_q or not webhook_key:
                return err("company_id и key обязательны", 401)
            try:
                owner_id = int(company_id_q)
            except ValueError:
                return err("company_id invalid")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else None
            if not cfg or cfg.get("_uis_webhook_key") != webhook_key:
                return err("неверный ключ", 401)

            # Номер клиента может прийти и в query, и в теле — UIS настраивается
            # по-разному в зависимости от узла. Берём из обоих источников.
            flat = _uis_flatten(body or {})
            flat.update(qs)
            raw_phone = _uis_pick(flat, [
                "contact_phone_number", "contact_phone", "phone", "numa", "caller_number", "from",
            ])
            contact_phone = normalize_phone(raw_phone) if raw_phone else ""
            last10 = contact_phone[-10:] if contact_phone else None

            line = "line1"  # по умолчанию — новый/неизвестный клиент идёт на 1-ю линию
            if last10:
                cur.execute(f"""
                    SELECT status, sub_status FROM {SCHEMA}.live_chats
                    WHERE company_id=%s AND phone IS NOT NULL AND status NOT IN ('deleted')
                      AND right(regexp_replace(phone,'\\D','','g'),10)=%s
                    ORDER BY created_at DESC LIMIT 1
                """, (owner_id, last10))
                deal = cur.fetchone()
                if deal:
                    status, sub_status = deal
                    if status in ("new", "call"):
                        line = "line1"
                    elif status == "measure":
                        cur.execute(f"""
                            SELECT id FROM {SCHEMA}.order_substatuses
                            WHERE company_id=%s AND parent_status='measures' AND label='Новый замер'
                        """, (owner_id,))
                        srow = cur.fetchone()
                        new_zamer_id = str(srow[0]) if srow else None
                        line = "line1" if (new_zamer_id and sub_status == new_zamer_id) else "line2"
                    else:
                        line = "line2"

            department = cfg.get(f"uis_{line}_department") or ""
            return ok({"line": line, "department": department, "phone": contact_phone})

        # ── UIS-WEBHOOK: приём событий звонков от АТС UIS (шлёт сама UIS) ──────────
        # URL регистрируется в личном кабинете UIS. Защита — company_id+key в query,
        # как у avito-webhook. Отвечаем максимально быстро — БЕЗ расшифровки и ИИ
        # (тот же принцип, что и у avito-webhook: внешний сервис ждёт быстрый ответ).
        if resource == "uis-webhook" and method == "POST":
            company_id_q = qs.get("company_id")
            webhook_key  = qs.get("key", "")
            if not company_id_q or not webhook_key:
                return err("company_id и key обязательны", 401)
            try:
                owner_id = int(company_id_q)
            except ValueError:
                return err("company_id invalid")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else None
            if not cfg or cfg.get("_uis_webhook_key") != webhook_key:
                return err("неверный ключ", 401)

            call = uis_extract_call(body)
            if not call["phone"] and not call["session_id"]:
                return ok({"skipped": True})  # служебное событие без полезных данных

            # Ищем клиента по последним 10 цифрам номера — UIS иногда присылает
            # номер в разных форматах (с +7/8/без кода и т.п.).
            last10 = call["phone"][-10:] if call["phone"] else None
            client_row = None
            if last10:
                cur.execute(f"""
                    SELECT id, crm_contact_id FROM {SCHEMA}.touch_clients
                    WHERE company_id=%s AND phone IS NOT NULL
                      AND right(regexp_replace(phone,'\\D','','g'),10)=%s
                    LIMIT 1
                """, (owner_id, last10))
                client_row = cur.fetchone()

            if not client_row and call["phone"]:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone) VALUES (%s, %s) RETURNING id, crm_contact_id",
                    (owner_id, call["phone"]))
                client_row = cur.fetchone()
                conn.commit()

            if not client_row:
                return ok({"skipped": True})  # нет ни номера, ни известного клиента — нечего привязать

            client_id, existing_contact_id = client_row

            # Звонок ни разу не привязан к заявке — не важно, звонили этому номеру
            # раньше вручную (touch_client уже был, но без заявки) или это первый
            # контакт вообще. Раньше заявка создавалась ТОЛЬКО для совсем нового
            # номера — из-за этого повторный входящий звонок уже известного, но
            # ещё не заведённого в CRM клиента, нигде не появлялся. Теперь для
            # любого входящего без заявки сначала ищем подходящую заявку по
            # телефону (вдруг клиент уже есть в CRM, просто с этим номером ещё
            # не сопоставлен) — и только если такой нет, заводим новую.
            if call["direction"] == "in" and not existing_contact_id and last10:
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.live_chats
                    WHERE company_id=%s AND phone IS NOT NULL AND status != 'deleted'
                      AND right(regexp_replace(phone,'\\D','','g'),10)=%s
                    ORDER BY created_at DESC LIMIT 1
                """, (owner_id, last10))
                found = cur.fetchone()
                if found:
                    cur.execute(
                        f"UPDATE {SCHEMA}.touch_clients SET crm_contact_id=%s WHERE id=%s",
                        (found[0], client_id))
                    conn.commit()
                else:
                    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='mospotolkipro@gmail.com'")
                    master_row = cur.fetchone()
                    master_id = master_row[0] if master_row else None
                    final_company_id = owner_id or master_id
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.live_chats
                            (session_id, client_name, phone, status, notes, source, created_via, company_id, next_call_date, status_changed_at)
                        VALUES (%s, %s, %s, 'new', %s, 'Звонок на прямую', 'call', %s, %s, NOW())
                        RETURNING id
                    """, (f"uis_{call['session_id'] or uuid.uuid4().hex}", "Клиент по звонку", call["phone"],
                          "Первый звонок через АТС UIS", final_company_id, default_next_call_date()))
                    new_order_id = cur.fetchone()[0]
                    cur.execute(
                        f"UPDATE {SCHEMA}.touch_clients SET crm_contact_id=%s WHERE id=%s",
                        (new_order_id, client_id))
                    conn.commit()

            # Дедупликация: если запись уже создана кнопкой click-to-call (черновик
            # status='initiated' с тем же external_id=session_id) — дополняем её,
            # а не плодим дубль (см. UNIQUE(channel, external_id) в touch_events).
            cur.execute(f"""
                INSERT INTO {SCHEMA}.touch_events
                    (client_id, channel, direction, external_id, audio_url, duration_sec, status)
                VALUES (%s, 'call', %s, %s, %s, %s, %s)
                ON CONFLICT (channel, external_id) WHERE external_id IS NOT NULL
                DO UPDATE SET
                    audio_url=COALESCE(EXCLUDED.audio_url, {SCHEMA}.touch_events.audio_url),
                    duration_sec=EXCLUDED.duration_sec,
                    status=EXCLUDED.status
                RETURNING id
            """, (client_id, call["direction"], call["session_id"], call["record_url"],
                  call["duration"], call["status"]))
            touch_id = cur.fetchone()[0]

            # Синхронизируем «Последний звонок» в календаре (виден в блоке «Касания»
            # карточки клиента) — только для заявок, у которых уже есть привязанная
            # заявка в CRM (crm_contact_id). Одно событие на клиента, дата обновляется.
            cur.execute(f"SELECT crm_contact_id FROM {SCHEMA}.touch_clients WHERE id=%s", (client_id,))
            crow = cur.fetchone()
            crm_contact_id = crow[0] if crow else None
            if crm_contact_id:
                cur.execute(f"SELECT client_name FROM {SCHEMA}.live_chats WHERE id = %s", (crm_contact_id,))
                nr = cur.fetchone()
                name = (nr[0] if nr else "") or "Клиент"
                cur.execute(f"SELECT id FROM {SCHEMA}.calendar_events WHERE client_id=%s AND event_type='last_call' LIMIT 1", (crm_contact_id,))
                ex = cur.fetchone()
                event_time = datetime.now().isoformat()
                if ex:
                    cur.execute(f"UPDATE {SCHEMA}.calendar_events SET start_time=%s, title=%s, company_id=COALESCE(company_id,%s) WHERE id=%s",
                                (event_time, f"Последний звонок: {name}", owner_id, ex[0]))
                else:
                    cur.execute(f"""INSERT INTO {SCHEMA}.calendar_events (client_id,title,event_type,start_time,color,company_id)
                        VALUES (%s,%s,'last_call',%s,'#8b5cf6',%s)""", (crm_contact_id, f"Последний звонок: {name}", event_time, owner_id))

            cfg["_uis_last_event_at"] = datetime.now().isoformat()
            cur.execute(f"""
                INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
            """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
            conn.commit()

            return ok({"client_id": client_id, "touch_id": touch_id, "saved": True})

        # ── CLICK-TO-CALL: кнопка «Позвонить» инициирует реальный звонок через UIS ──
        if resource == "click-to-call" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            phone_q = body.get("phone")
            client_id_q = body.get("client_id")
            if not phone_q:
                return err("phone required")
            contact_phone = normalize_phone(phone_q)
            if not contact_phone:
                return err("phone invalid")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else {}
            if not cfg.get("uis_enabled"):
                return err("Телефония UIS отключена в настройках", 400)
            api_key = decrypt_secret(cfg.get("uis_api_key"))
            if not api_key:
                return err("Заполните API-ключ в настройках телефонии", 400)

            # Два отдельных номера УИС — один на линию (без платной функции
            # "Интерактивная обработка вызова"). Каждый сотрудник привязан к своей
            # линии (users.uis_line: 1 или 2) — звонок уходит с номера ЕГО линии.
            # Нет привязки к линии → используем номер линии 1 (обратная совместимость).
            cur.execute(f"SELECT uis_phone, uis_line FROM {SCHEMA}.users WHERE id=%s", (master_uid,))
            urow = cur.fetchone()
            operator_phone = normalize_phone(urow[0]) if urow and urow[0] else None
            operator_line = (urow[1] if urow else None) or 1
            if not operator_phone:
                return err("У вас не указан номер в АТС — заполните его в настройках телефонии", 400)

            virtual_number_raw = cfg.get("uis_virtual_phone_number") if operator_line == 1 \
                else (cfg.get("uis_line2_virtual_phone_number") or cfg.get("uis_virtual_phone_number"))
            if not virtual_number_raw:
                return err("Заполните виртуальный номер в настройках телефонии", 400)
            # UIS принимает номер только цифрами (+7XXXXXXXXXX) — в настройках номер
            # мог быть введён с пробелами/скобками ("+7 (495) 487-74-77"), из-за чего
            # API отвечал "Invalid parameter value" по полю virtual_phone_number.
            virtual_number = normalize_phone(virtual_number_raw)
            if not virtual_number:
                return err("Виртуальный номер в настройках телефонии указан некорректно", 400)

            # Клиент в модуле «Касания»: находим по id (если передан) или по телефону, иначе создаём
            client_row = None
            if client_id_q:
                cur.execute(f"SELECT id, crm_contact_id FROM {SCHEMA}.touch_clients WHERE id=%s AND company_id=%s",
                            (client_id_q, owner_id))
                client_row = cur.fetchone()
            if not client_row:
                cur.execute(f"SELECT id, crm_contact_id FROM {SCHEMA}.touch_clients WHERE company_id=%s AND phone=%s",
                            (owner_id, contact_phone))
                client_row = cur.fetchone()
                if not client_row:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone) VALUES (%s, %s) RETURNING id, crm_contact_id",
                        (owner_id, contact_phone))
                    client_row = cur.fetchone()
                    conn.commit()
            client_id, existing_contact_id = client_row

            # Звонок из карточки заявки (кнопка «Позвонить» рядом с телефоном), но
            # этот touch_client ещё не привязан ни к одной заявке — довязываем по
            # номеру телефона, чтобы звонок сразу лёг в ленту «Касания» этой заявки,
            # а не потерялся в отдельной, не связанной с заявкой истории.
            if not existing_contact_id:
                last10 = contact_phone[-10:]
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.live_chats
                    WHERE company_id=%s AND phone IS NOT NULL AND status != 'deleted'
                      AND right(regexp_replace(phone,'\\D','','g'),10)=%s
                    ORDER BY created_at DESC LIMIT 1
                """, (owner_id, last10))
                found = cur.fetchone()
                if found:
                    cur.execute(
                        f"UPDATE {SCHEMA}.touch_clients SET crm_contact_id=%s WHERE id=%s",
                        (found[0], client_id))
                    conn.commit()

            session_id, call_err = uis_start_call(api_key, virtual_number, operator_phone, contact_phone)
            if call_err:
                return err(call_err, 502)

            # Черновая запись — звонок появится в карточке сразу, не дожидаясь вебхука.
            # Вебхук о завершении найдёт её по session_id (external_id) и дополнит.
            cur.execute(f"""
                INSERT INTO {SCHEMA}.touch_events (client_id, channel, direction, external_id, status)
                VALUES (%s, 'call', 'out', %s, 'initiated')
                ON CONFLICT (channel, external_id) WHERE external_id IS NOT NULL DO NOTHING
                RETURNING id
            """, (client_id, session_id))
            trow = cur.fetchone()
            conn.commit()

            return ok({"ok": True, "client_id": client_id, "session_id": session_id,
                       "touch_id": trow[0] if trow else None})

        # ── TG-LEADS-CHECK: сохранить токен бота-«слушателя» и проверить связь ─────
        # Бот должен быть добавлен в группу, куда падают заявки от бота-агрегатора,
        # с ВЫКЛЮЧЕННЫМ Privacy Mode (иначе Telegram не пришлёт боту чужие сообщения).
        if resource == "tg-leads-check" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else {}
            bot_token = decrypt_secret(cfg.get("tg_leads_bot_token"))
            if not bot_token:
                return err("Сначала сохраните токен бота", 400)

            # getMe и setWebhook независимы друг от друга (setWebhook не требует
            # результата getMe) — запускаем ОБА запроса ПАРАЛЛЕЛЬНО в потоках вместо
            # последовательного вызова. Раньше они шли один за другим с таймаутом 4+4 сек,
            # а сеть из этого окружения до api.telegram.org сама по себе не мгновенная —
            # последовательно это не укладывалось и обрывалось как "нет ответа" даже на
            # валидном токене. Параллельно оба успевают за общий бюджет ~8 сек.
            import concurrent.futures

            wh_key = cfg.get("_tg_leads_webhook_key")
            if not wh_key:
                wh_key = uuid.uuid4().hex
                cfg["_tg_leads_webhook_key"] = wh_key
            webhook_url = f"{SELF_FUNCTION_URL}?r=tg-leads-webhook&company_id={owner_id}&key={wh_key}"

            def _call_get_me():
                return tg_api_request(f"bot{bot_token}/getMe")

            def _call_set_webhook():
                wdata = json.dumps({"url": webhook_url, "allowed_updates": ["message"]}).encode()
                return tg_api_request(f"bot{bot_token}/setWebhook", data=wdata)

            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                fut_me = pool.submit(_call_get_me)
                fut_wh = pool.submit(_call_set_webhook)

                try:
                    me = fut_me.result()
                except Exception as e:
                    print(f"[tg-leads-check] getMe failed: {type(e).__name__}: {e}")
                    return err(f"Telegram: {type(e).__name__} — {str(e)[:150]}", 400)

                if not me.get("ok"):
                    return err("Telegram: неверный токен бота", 400)
                bot_username = me["result"].get("username")

                webhook_ok = False
                webhook_err = None
                try:
                    wresp = fut_wh.result()
                    webhook_ok = bool(wresp.get("ok"))
                    if not webhook_ok:
                        webhook_err = wresp.get("description", "неизвестная ошибка")
                except Exception as e:
                    webhook_err = str(e)[:200]

            cfg["_tg_leads_bot_username"] = bot_username
            cfg["_tg_leads_webhook_registered"] = webhook_ok
            cur.execute(f"""
                INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
            """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
            conn.commit()

            return ok({"ok": True, "bot_username": bot_username,
                       "webhook_registered": webhook_ok, "webhook_error": webhook_err})

        # ── TG-LEADS-WEBHOOK: приём апдейтов от бота-«слушателя» (Telegram Bot API) ─
        # Бот стоит в группе с чужим ботом-агрегатором заявок. Мы разбираем текст
        # каждого сообщения — если это похоже на заявку (см. parse_tg_lead_text),
        # сразу создаём карточку в CRM. Отвечаем быстро — Telegram ждёт ответ < 60 сек.
        if resource == "tg-leads-webhook" and method == "POST":
            company_id_q = qs.get("company_id")
            webhook_key = qs.get("key", "")
            if not company_id_q or not webhook_key:
                return err("company_id и key обязательны", 401)
            try:
                owner_id = int(company_id_q)
            except ValueError:
                return err("company_id invalid")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else None
            if not cfg or cfg.get("_tg_leads_webhook_key") != webhook_key:
                return err("неверный ключ", 401)
            if cfg.get("tg_leads_enabled") == "false":
                return ok({"skipped": True, "reason": "disabled"})

            msg = (body or {}).get("message") or {}
            text = msg.get("text") or msg.get("caption")
            if not text:
                return ok({"skipped": True})  # не текстовое сообщение (стикер, фото без подписи и т.д.)

            lead = parse_tg_lead_text(text)
            # Пишем в журнал ВСЁ, что похоже на заявку (есть слово «Телефон»), даже если
            # разобрать не удалось — иначе такая заявка потеряется бесследно.
            log_id = None
            if lead or re.search(r'[Тт]елефон', text):
                log_id = log_incoming_lead(conn, "telegram_leads", body or {},
                                           company_id=owner_id,
                                           parsed_phone=(lead or {}).get("phone"))
            if not lead:
                finish_incoming_lead(conn, log_id, "skipped", error="не распознано как заявка")
                return ok({"skipped": True, "reason": "not a lead"})  # обычное сообщение в группе, не заявка

            # Дедупликация: используем message_id из Telegram как уникальный внешний id,
            # чтобы повторная доставка того же апдейта не создала вторую заявку.
            msg_id = msg.get("message_id")
            chat_id_tg = (msg.get("chat") or {}).get("id")
            session_id = f"tgleads_{chat_id_tg}_{msg_id}" if msg_id else f"tgleads_{uuid.uuid4().hex}"

            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='mospotolkipro@gmail.com'")
            master_row = cur.fetchone()
            master_id = master_row[0] if master_row else None
            final_company_id = owner_id or master_id

            notes_parts = []
            if lead["description"]:
                notes_parts.append(lead["description"])
            if lead["term"]:
                notes_parts.append(f"Срок: {lead['term']}")
            if lead["contact_via"]:
                notes_parts.append(f"Удобнее общаться: {lead['contact_via']}")
            notes = "\n".join(notes_parts) if notes_parts else None

            # Разовый сбой БД не должен убивать заявку — пробуем записать ещё раз.
            new_row = None
            last_db_err = None
            for attempt in range(3):
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.live_chats
                            (session_id, client_name, phone, status, address, area, notes, source, created_via, company_id, next_call_date, status_changed_at)
                        VALUES (%s, %s, %s, 'new', %s, %s, %s, 'Telegram-заявки', 'telegram_leads', %s, %s, NOW())
                        ON CONFLICT (session_id) DO NOTHING
                        RETURNING id
                    """, (session_id, "Заявка из Telegram", lead["phone"],
                          lead["city"], lead["area"], notes, final_company_id, default_next_call_date()))
                    new_row = cur.fetchone()
                    conn.commit()
                    last_db_err = None
                    break
                except psycopg2.Error as e:
                    last_db_err = f"{type(e).__name__}: {str(e)[:300]}"
                    print(f"[tg-leads-webhook] insert failed (attempt {attempt + 1}/3): {last_db_err}")
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    if attempt < 2:
                        time.sleep(0.3 * (attempt + 1))

            if last_db_err:
                # Заявка не создалась, но сырой текст уже в журнале — не потеряется.
                finish_incoming_lead(conn, log_id, "error", error=last_db_err)
                return err("db error", 500)

            if not new_row:
                finish_incoming_lead(conn, log_id, "duplicate")
                return ok({"duplicate": True})

            finish_incoming_lead(conn, log_id, "created", client_id=new_row[0])
            return ok({"created": True, "client_id": new_row[0]})

        # ── EMAIL-LEADS-POLL: заявки с leakad.ru, присылаемые НЕ вебхуком, а на
        # почту (noreply@egokad.ru → mospotolkipro@gmail.com, письма часто попадают
        # в Спам). Telegram-бот тут не подходит (см. tg-leads-webhook — Telegram
        # запрещает боту видеть сообщения от другого бота), а leakad.ru отправляет
        # именно email. У облачных функций нет своего "будильника" — этот эндпоинт
        # должен периодически дёргать внешний бесплатный cron-сервис (cron-job.org),
        # каждый раз он заходит в почту по IMAP, разбирает текст письма (тем же
        # парсером, что и для Telegram — формат заявки идентичный) и заводит
        # карточку в CRM. Доступ — по секретному ключу EMAIL_LEADS_POLL_KEY в query,
        # чтобы эндпоинт не мог дёрнуть кто попало.
        # Тот же самый обход почты доступен и по кнопке «Проверить почту сейчас»
        # во вкладке «Интеграции» — тогда вместо секретного ключа достаточно быть
        # авторизованным в CRM (resource=email-leads-check-now, POST).
        if resource in ("email-leads-poll", "email-leads-check-now"):
            if resource == "email-leads-check-now":
                if not authenticated:
                    return err("Требуется авторизация", 401)
                owner_id = company_id or master_uid
            else:
                poll_key = qs.get("key", "")
                expected_key = os.environ.get("EMAIL_LEADS_POLL_KEY")
                if not expected_key or poll_key != expected_key:
                    return err("unauthorized", 401)
                # Будильник не знает company_id (дёргает публичный URL без токена) —
                # берём настройки почты мастер-аккаунта (единственный, кто её сейчас использует).
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='mospotolkipro@gmail.com'")
                m = cur.fetchone()
                owner_id = m[0] if m else None

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = dict(row[0]) if row and row[0] else {}

            # Ящик и пароль: сначала берём настройки из «Интеграций» (редактируемые
            # в интерфейсе). Если их нет — дефолт mospotolkipro@gmail.com +
            # LEAKAD_IMAP_APP_PASSWORD (эта пара логин/пароль всегда должна совпадать,
            # иначе IMAP отдаёт AUTHENTICATIONFAILED — сюда НЕ подставлять SMTP_USER,
            # это другой ящик 19.jeka.94@gmail.com с другим паролем).
            smtp_user = cfg.get("email_leads_mailbox") or "mospotolkipro@gmail.com"
            smtp_password = decrypt_secret(cfg.get("email_leads_password")) or os.environ.get("LEAKAD_IMAP_APP_PASSWORD")
            if not smtp_user or not smtp_password:
                return err("почта не настроена — впишите ящик и пароль приложения в «Интеграциях»", 400)

            if cfg.get("email_leads_enabled") == "false":
                return ok({"skipped": True, "reason": "disabled"})

            import imaplib
            import email as email_lib

            SENDER = cfg.get("email_leads_sender") or "noreply@egokad.ru"

            def _extract_email_text(msg):
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain" and not part.get_filename():
                            charset = part.get_content_charset() or "utf-8"
                            try:
                                return part.get_payload(decode=True).decode(charset, errors="ignore")
                            except Exception:
                                continue
                    return None
                charset = msg.get_content_charset() or "utf-8"
                try:
                    return msg.get_payload(decode=True).decode(charset, errors="ignore")
                except Exception:
                    return None

            try:
                imap = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=8)
                imap.login(smtp_user, smtp_password)
            except Exception as e:
                return err(f"imap login failed: {type(e).__name__}: {e}", 502)

            if owner_id:
                master_id = owner_id
            else:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='mospotolkipro@gmail.com'")
                master_row = cur.fetchone()
                master_id = master_row[0] if master_row else None

            created, skipped, error_count, recovered = 0, 0, 0, 0
            spam_folder = imap_find_spam_folder(imap)
            folders_to_check = ["INBOX"] + ([spam_folder] if spam_folder else [])

            try:
                for folder in folders_to_check:
                    try:
                        status, _ = imap.select(folder)
                    except Exception:
                        continue
                    if status != "OK":
                        continue
                    status, data = imap.search(None, f'(UNSEEN FROM "{SENDER}")')
                    if status != "OK" or not data or not data[0]:
                        continue
                    for eid in data[0].split():
                        log_id = None
                        try:
                            status, msg_data = imap.fetch(eid, "(RFC822)")
                            if status != "OK" or not msg_data or not msg_data[0]:
                                continue
                            msg = email_lib.message_from_bytes(msg_data[0][1])
                            message_id = msg.get("Message-ID") or f"emlid_{uuid.uuid4().hex}"
                            text = _extract_email_text(msg)
                            lead = parse_tg_lead_text(text) if text else None

                            # Журналируем ЛЮБОЕ письмо от отправителя заявок сразу — это
                            # независимая от вебхука копия, по ней и делаем сверку ниже.
                            log_id = log_incoming_lead(
                                conn, "email_leads",
                                {"message_id": message_id, "text": text},
                                company_id=master_id, parsed_phone=(lead or {}).get("phone"),
                            )

                            if not lead:
                                imap.store(eid, "+FLAGS", "\\Seen")
                                finish_incoming_lead(conn, log_id, "skipped", error="не распознано как заявка")
                                skipped += 1
                                continue

                            # ── Сверка с вебхуком ──────────────────────────────────
                            # Если заявка с этим телефоном уже пришла через вебхук
                            # (leakad/Telegram) за последние 3 суток — письмо только
                            # ПОДТВЕРЖДАЕТ, что вебхук сработал, вторую карточку не
                            # создаём. Если совпадения нет — вебхук, скорее всего,
                            # не сработал, и заявку нужно завести именно из письма
                            # (помечаем как "recovered", чтобы это было явно видно).
                            # Сравниваем ТОЛЬКО по цифрам номера — в БД телефон хранится
                            # в разных форматах ("+7 (958) 801-94-60" и "+79588019460"),
                            # текстовое сравнение "=" их не совпадёт и создаст дубль.
                            cur.execute(f"""
                                SELECT id FROM {SCHEMA}.live_chats
                                WHERE regexp_replace(phone, '\\D', '', 'g') = regexp_replace(%s, '\\D', '', 'g')
                                  AND created_via IN ('leakad_webhook','telegram_leads')
                                  AND created_at > NOW() - INTERVAL '3 days'
                                ORDER BY created_at DESC LIMIT 1
                            """, (lead["phone"],))
                            matched = cur.fetchone()
                            if matched:
                                imap.store(eid, "+FLAGS", "\\Seen")
                                finish_incoming_lead(conn, log_id, "duplicate",
                                                      client_id=matched[0],
                                                      error="уже создана вебхуком — подтверждение по почте")
                                skipped += 1
                                continue
                            is_recovered = True

                            session_id = f"emaillead_{hashlib.sha256(message_id.encode()).hexdigest()[:32]}"
                            notes_parts = []
                            if lead["description"]:
                                notes_parts.append(lead["description"])
                            if lead["term"]:
                                notes_parts.append(f"Срок: {lead['term']}")
                            if lead["contact_via"]:
                                notes_parts.append(f"Удобнее общаться: {lead['contact_via']}")
                            if is_recovered:
                                notes_parts.append("⚠️ Восстановлено с почты — не найдено по вебхуку (возможно, он не сработал)")
                            notes = "\n".join(notes_parts) if notes_parts else None

                            # Источник "Квиз" — не "Email-заявки": почта тут лишь резервный
                            # канал доставки той же заявки с leakad.ru (когда вебхук не
                            # сработал), а не отдельный рекламный источник. Один источник —
                            # без дублей в статистике и на карточках.
                            cur.execute(f"""
                                INSERT INTO {SCHEMA}.live_chats
                                    (session_id, client_name, phone, status, address, area, notes, source, created_via, company_id, next_call_date, status_changed_at)
                                VALUES (%s, %s, %s, 'new', %s, %s, %s, 'Квиз', 'email_leads', %s, %s, NOW())
                                ON CONFLICT (session_id) DO NOTHING
                                RETURNING id
                            """, (session_id, "Заявка с сайта (email)", lead["phone"],
                                  lead["city"], lead["area"], notes, master_id, default_next_call_date()))
                            new_row = cur.fetchone()
                            conn.commit()
                            imap.store(eid, "+FLAGS", "\\Seen")
                            if new_row:
                                created += 1
                                recovered += 1
                                finish_incoming_lead(conn, log_id, "recovered", client_id=new_row[0],
                                                      error="создано из письма — не найдено по вебхуку")
                            else:
                                skipped += 1
                                finish_incoming_lead(conn, log_id, "duplicate")
                        except Exception as e:
                            conn.rollback()
                            error_count += 1
                            finish_incoming_lead(conn, log_id, "error", error=str(e)[:300])
                            continue
            finally:
                try:
                    imap.logout()
                except Exception:
                    pass

            return ok({"created": created, "skipped": skipped, "errors": error_count, "recovered": recovered})

        # ── LEAKAD-WEBHOOK: заявки с leakad.ru напрямую по вебхуку (без задержек
        # почты). Реальный формат (уточнён поддержкой leakad 10.08): JSON с полями
        # phone/телефон (обязательное), name/title/имя, comment/комментарий (тот же
        # текст, что раньше приходил письмом/в Telegram), city/город, source/источник.
        # На случай смены формата или ручного теста текстом — оставлен запасной
        # разбор старым парсером (text/message/body/caption или сырой текст).
        # ВАЖНО: коды ответа теперь смысловые — 200+id при успехе, 400/422 при отказе,
        # а не всегда 200 (по требованию leakad — иначе они не отличают потерю заявки).
        if resource == "leakad-webhook" and method == "POST":
            webhook_key = qs.get("key", "")
            expected_key = os.environ.get("LEAKAD_WEBHOOK_KEY")
            if not expected_key or webhook_key != expected_key:
                return err("unauthorized", 401)

            cur.execute(f"SELECT i.config FROM {SCHEMA}.users u LEFT JOIN {SCHEMA}.integrations i ON i.company_id=u.id WHERE u.email='mospotolkipro@gmail.com'")
            _row = cur.fetchone()
            _cfg = dict(_row[0]) if _row and _row[0] else {}
            if _cfg.get("leakad_webhook_enabled") == "false":
                return ok({"ok": True, "skipped": True, "reason": "disabled"})

            raw_body = event.get("body") or ""
            if event.get("isBase64Encoded"):
                try:
                    raw_body = base64.b64decode(raw_body).decode("utf-8", errors="ignore")
                except Exception:
                    pass

            payload = body if isinstance(body, dict) and body else {}
            if not payload and raw_body:
                # На случай если пришлют application/x-www-form-urlencoded вместо JSON
                try:
                    from urllib.parse import parse_qsl
                    parsed_form = dict(parse_qsl(raw_body))
                    if parsed_form:
                        payload = parsed_form
                except Exception:
                    pass

            phone_raw = payload.get("phone") or payload.get("телефон")
            name = payload.get("name") or payload.get("title") or payload.get("имя")
            comment = payload.get("comment") or payload.get("комментарий")
            city = payload.get("city") or payload.get("город")
            # Источник всегда фиксированный "Квиз" — независимо от того, что реально
            # прислал leakad.ru в своём поле source (там бывает то "Egokad CRM",
            # то не заполнено вовсе). В воронке уже есть категория "Квиз" —
            # все заявки с leakad.ru должны попадать именно туда одним источником.
            source_name = "Квиз"

            lead = None
            if not phone_raw:
                # Запасной путь — старый текстовый формат (ручной тест, старая интеграция)
                text = payload.get("text") or payload.get("message") or payload.get("body") or payload.get("caption")
                if not text and raw_body and not payload:
                    text = raw_body
                lead = parse_tg_lead_text(text) if text else None
                if lead:
                    phone_raw = lead["phone"]
                    city = city or lead["city"]

            # Журналируем ЛЮБОЙ входящий запрос сразу — даже если телефон не распознан.
            # Иначе такая заявка исчезает бесследно и восстановить её неоткуда.
            phone = normalize_phone(phone_raw) if phone_raw else ""
            log_id = log_incoming_lead(conn, "leakad_webhook", payload or {"_raw": raw_body},
                                       parsed_phone=phone or None)
            if not phone:
                finish_incoming_lead(conn, log_id, "skipped", error="нет телефона / не распознан")
                return err("нет поля phone (или телефон не распознан)", 422)

            # Если comment совпадает по формату со старым текстом заявки — вытащим
            # из него срок и удобный способ связи тем же парсером, что и раньше.
            parsed_comment = parse_tg_lead_text(comment) if comment else None
            area = (parsed_comment or {}).get("area") if parsed_comment else None

            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='mospotolkipro@gmail.com'")
            master_row = cur.fetchone()
            master_id = master_row[0] if master_row else None

            dedup_key = json.dumps({"phone": phone, "comment": comment, "city": city}, ensure_ascii=False, sort_keys=True)
            session_id = f"leakadwh_{hashlib.sha256(dedup_key.encode()).hexdigest()[:32]}"

            notes_parts = []
            if parsed_comment and parsed_comment.get("description"):
                notes_parts.append(parsed_comment["description"])
            elif comment:
                notes_parts.append(comment)
            if parsed_comment and parsed_comment.get("term"):
                notes_parts.append(f"Срок: {parsed_comment['term']}")
            if parsed_comment and parsed_comment.get("contact_via"):
                notes_parts.append(f"Удобнее общаться: {parsed_comment['contact_via']}")
            notes = "\n".join(notes_parts) if notes_parts else None

            # Разовый сбой БД не должен убивать заявку — пробуем записать ещё раз.
            new_row = None
            last_db_err = None
            for attempt in range(3):
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.live_chats
                            (session_id, client_name, phone, status, address, area, notes, source, created_via, company_id, next_call_date, status_changed_at)
                        VALUES (%s, %s, %s, 'new', %s, %s, %s, %s, 'leakad_webhook', %s, %s, NOW())
                        ON CONFLICT (session_id) DO NOTHING
                        RETURNING id
                    """, (session_id, name or "Заявка с сайта (leakad)", phone,
                          city, area, notes, source_name, master_id, default_next_call_date()))
                    new_row = cur.fetchone()
                    conn.commit()
                    last_db_err = None
                    break
                except psycopg2.Error as e:
                    last_db_err = f"{type(e).__name__}: {str(e)[:300]}"
                    print(f"[leakad-webhook] insert failed (attempt {attempt + 1}/3): {last_db_err}")
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    if attempt < 2:
                        time.sleep(0.3 * (attempt + 1))

            if last_db_err:
                # Заявка не создалась, но сырой запрос уже в журнале — не потеряется.
                finish_incoming_lead(conn, log_id, "error", error=last_db_err)
                return err("db error", 500)

            if not new_row:
                finish_incoming_lead(conn, log_id, "duplicate")
                return ok({"ok": True, "duplicate": True})

            finish_incoming_lead(conn, log_id, "created", client_id=new_row[0])
            return ok({"ok": True, "id": new_row[0]})

        # ── LEADS-LOG: журнал входящих заявок. Показывает ВСЁ, что пришло по вебхукам,
        # включая заявки, которые не удалось создать (сбой БД, не распознан телефон).
        # Нужен, чтобы потерянные заявки были видны и их можно было завести вручную.
        if resource == "leads-log" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            only_lost = qs.get("lost") == "1"
            limit = min(int(qs.get("limit", "100") or 100), 500)
            where = "WHERE outcome IN ('error','skipped')" if only_lost else ""
            cur.execute(f"""
                SELECT id, channel, parsed_phone, outcome, client_id, error, created_at, payload
                FROM {SCHEMA}.leads_webhook_raw_log
                {where}
                ORDER BY created_at DESC
                LIMIT {limit}
            """)
            cols = [d[0] for d in cur.description]
            return ok([dict(zip(cols, r)) for r in cur.fetchall()])

        # ── LEADS-SOURCES-INFO: сводка по источникам заявок для вкладки «Интеграции».
        # Отдаёт готовый адрес вебхука (с секретным ключом — только авторизованным,
        # чтобы ключ не лежал в коде сайта) и статистику: сколько заявок пришло
        # по каждому каналу и когда была последняя.
        if resource == "leads-sources-info" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)

            wh_key = os.environ.get("LEAKAD_WEBHOOK_KEY")
            webhook_url = (f"{SELF_FUNCTION_URL}?r=leakad-webhook&key={wh_key}") if wh_key else None

            owner_id = company_id or master_uid
            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = dict(row[0]) if row and row[0] else {}

            # Ящик/отправитель: значения из «Интеграций», если не заданы — дефолт mospotolkipro@gmail.com
            # (тот же порядок приоритета, что и в реальной IMAP-логике выше — иначе
            # карточка покажет не тот адрес, для которого реально проверяется пароль).
            email_address = cfg.get("email_leads_mailbox") or "mospotolkipro@gmail.com"
            email_sender = cfg.get("email_leads_sender") or "noreply@egokad.ru"
            has_password = bool(cfg.get("email_leads_password") or os.environ.get("LEAKAD_IMAP_APP_PASSWORD"))

            stats = {}
            for via in ("leakad_webhook", "email_leads", "telegram_leads"):
                cur.execute(f"""
                    SELECT COUNT(*), MAX(created_at)
                    FROM {SCHEMA}.live_chats WHERE created_via=%s
                """, (via,))
                r = cur.fetchone()
                stats[via] = {
                    "count": r[0] if r else 0,
                    "last_at": r[1].isoformat() if r and r[1] else None,
                }

            return ok({
                "webhook_url": webhook_url,
                "webhook_enabled": cfg.get("leakad_webhook_enabled") != "false",
                "email_configured": has_password,
                "email_address": email_address,
                "email_sender": email_sender,
                "email_has_password": has_password,
                "email_enabled": cfg.get("email_leads_enabled") != "false",
                "tg_leads_enabled": cfg.get("tg_leads_enabled") != "false",
                "stats": stats,
            })

        # ── EMAIL-LEADS-CONFIG: сохранить ящик/отправителя/пароль почты для заявок ──
        if resource == "email-leads-config" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = dict(row[0]) if row and row[0] else {}

            mailbox = (body.get("mailbox") or "").strip()
            sender = (body.get("sender") or "").strip()
            password = (body.get("password") or "").strip()

            if mailbox:
                cfg["email_leads_mailbox"] = mailbox
            if sender:
                cfg["email_leads_sender"] = sender
            if password:
                cfg["email_leads_password"] = encrypt_secret(password)
            if "enabled" in body:
                cfg["email_leads_enabled"] = "true" if body.get("enabled") else "false"

            cur.execute(f"""
                INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
            """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
            conn.commit()
            return ok({"saved": True})

        # ── SOURCE-TOGGLE: включить/выключить источник заявок одним переключателем ──
        # Универсальный эндпоинт для тумблеров на карточках (вебхук leakad, почта,
        # Telegram-группа) — просто пишет флаг *_enabled в config компании.
        if resource == "source-toggle" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            source = body.get("source")
            enabled = bool(body.get("enabled"))
            key_map = {
                "leakad_webhook": "leakad_webhook_enabled",
                "email_leads": "email_leads_enabled",
                "telegram_leads": "tg_leads_enabled",
                "avito": "avito_enabled",
            }
            cfg_key = key_map.get(source)
            if not cfg_key:
                return err("unknown source")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = dict(row[0]) if row and row[0] else {}
            cfg[cfg_key] = "true" if enabled else "false"

            cur.execute(f"""
                INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
            """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
            conn.commit()
            return ok({"saved": True, "enabled": enabled})

        # ── UIS-EMPLOYEES: номера сотрудников в АТС (для click-to-call) ────────────
        if resource == "uis-employees":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            if method == "GET":
                cur.execute(f"""
                    SELECT id, name, phone, uis_phone, uis_line FROM {SCHEMA}.users
                    WHERE removed_at IS NULL AND (id=%s OR (company_id=%s AND role='manager'))
                    ORDER BY (id=%s) DESC, name
                """, (owner_id, owner_id, owner_id))
                rows = cur.fetchall()
                return ok({"employees": [
                    {"id": r[0], "name": r[1], "phone": r[2], "uis_phone": r[3], "uis_line": r[4] or 1} for r in rows
                ]})

            if method == "POST":
                user_id = body.get("user_id")
                uis_phone_val = (body.get("uis_phone") or "").strip() or None
                if not user_id:
                    return err("user_id required")
                sets = ["uis_phone=%s"]
                vals = [uis_phone_val]
                # uis_line — необязательное поле: линия сотрудника (1 или 2), к какому
                # номеру УИС он привязан для исходящих звонков (click-to-call).
                if "uis_line" in body:
                    line_val = body.get("uis_line")
                    if line_val not in (1, 2, None):
                        return err("uis_line должен быть 1 или 2")
                    sets.append("uis_line=%s")
                    vals.append(line_val)
                vals += [int(user_id), owner_id, owner_id]
                cur.execute(f"""
                    UPDATE {SCHEMA}.users SET {', '.join(sets)}
                    WHERE id=%s AND (id=%s OR company_id=%s)
                    RETURNING id
                """, vals)
                updated = cur.fetchone()
                if not updated:
                    return err("Сотрудник не найден", 404)
                conn.commit()
                return ok({"ok": True})

            return err("unknown method")

        # ── TRANSCRIBE-CALL: перенесён в отдельную функцию crm-ai — скачивание
        # записи + распознавание речи могут занять больше времени, чем короткий
        # таймаут "быстрой" crm-manager. См. backend/crm-ai/index.py.

        # ── CHANNELS-SELFTEST: живая проверка каналов «в один клик» ────────────────
        # Отправляет реальное тестовое сообщение в Telegram и MAX на указанный номер
        # и возвращает id этих сообщений. Дальше фронт опрашивает channels-selftest-status
        # и показывает реальный результат доставки (а не просто «линия авторизована»).
        if resource == "channels-selftest" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            phone_q = normalize_phone(body.get("phone") or "")
            if not phone_q:
                return err("Укажите номер телефона для проверки")

            # Находим или заводим тестового клиента по этому номеру
            cur.execute(f"SELECT id FROM {SCHEMA}.touch_clients WHERE phone=%s AND company_id=%s",
                        (phone_q, owner_id))
            crow = cur.fetchone()
            if crow:
                test_client_id = crow[0]
            else:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.touch_clients (company_id, phone, name)
                    VALUES (%s, %s, %s) RETURNING id
                """, (owner_id, phone_q, "Проверка каналов"))
                test_client_id = cur.fetchone()[0]
                conn.commit()

            # Сбрасываем ранее сохранённую привязку chat_id тестового контакта — если
            # она осталась от старой/чужой переписки (например по этому номеру когда-то
            # писал другой человек и chat_id сохранился неверно), send-message использует
            # ЕЁ вместо нового поиска по номеру, и тест покажет "sent", хотя реально
            # уходит не туда. Проверка каналов должна каждый раз искать заново по номеру.
            cur.execute(f"""
                UPDATE {SCHEMA}.touch_clients SET channel_ids = '{{}}'::jsonb WHERE id=%s
            """, (test_client_id,))
            conn.commit()

            stamp = datetime.now(ZoneInfo("Europe/Moscow")).strftime("%d.%m %H:%M:%S")
            results = {}
            for ch in ("telegram", "max"):
                # Ищем активную авторизованную линию канала
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.messenger_accounts
                    WHERE company_id=%s AND channel=%s AND is_active=TRUE AND auth_status='authorized'
                    ORDER BY id LIMIT 1
                """, (owner_id, ch))
                line_row = cur.fetchone()
                if not line_row:
                    results[ch] = {"ok": False, "error": "Нет подключённой линии — авторизуйте её ниже"}
                    continue
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.touch_events
                        (client_id, channel, direction, text, status, account_id)
                    VALUES (%s, %s, 'out', %s, 'pending', %s)
                    RETURNING id
                """, (test_client_id, ch, f"Проверка связи CRM · {stamp}", line_row[0]))
                results[ch] = {"ok": True, "touch_id": cur.fetchone()[0]}
            conn.commit()
            notify_worker_push("channels-selftest")
            return ok({"client_id": test_client_id, "results": results})

        # ── CHANNELS-SELFTEST-STATUS: чем закончилась проверка каналов ─────────────
        if resource == "channels-selftest-status" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            ids_raw = (qs.get("ids") or "").strip()
            wanted = [int(x) for x in ids_raw.split(",") if x.strip().isdigit()]
            if not wanted:
                return err("ids обязателен")
            cur.execute(f"""
                SELECT te.id, te.channel, te.status FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id
                WHERE tc.company_id=%s AND te.id = ANY(%s)
            """, (owner_id, wanted))
            return ok({"items": [{"touch_id": r[0], "channel": r[1], "status": r[2]} for r in cur.fetchall()]})

        # ── SEND-MESSAGE: сотрудник отправляет ответ клиенту из вкладки «Касания» ───
        # Кладёт сообщение в ленту со статусом 'pending' — воркер на VPS заберёт его
        # через worker-pending (опрос) и подтвердит через worker-mark-sent.
        if resource == "send-message" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            client_id = body.get("client_id")
            phone_q   = body.get("phone")
            channel   = body.get("channel")
            requested_account_id = body.get("account_id")
            text      = (body.get("text") or "").strip()
            # Вложения: список [{type: "image"|"file"|"voice", url, filename?, duration_sec?}].
            # Сообщение должно содержать текст ИЛИ хотя бы одно вложение.
            attachments = body.get("attachments") or []
            if not isinstance(attachments, list):
                attachments = []
            # На какое сообщение отвечаем (реплай) — только визуальная привязка внутри
            # CRM (цитата в интерфейсе), в сам канал (Telegram/Avito) реплай не уходит.
            reply_to_id = body.get("reply_to_id")
            if not channel or (not text and not attachments):
                return err("channel и (text или attachments) обязательны")
            if channel not in ("telegram", "max", "avito", "whatsapp"):
                return err("unknown channel")
            if channel == "avito" and attachments:
                return err("Avito пока не поддерживает отправку вложений", 400)

            if client_id:
                cur.execute(
                    f"SELECT id, channel_ids, phone FROM {SCHEMA}.touch_clients WHERE id=%s AND company_id=%s",
                    (client_id, owner_id))
            elif phone_q:
                norm = normalize_phone(phone_q)
                if not norm:
                    return err("phone invalid")
                cur.execute(
                    f"SELECT id, channel_ids, phone FROM {SCHEMA}.touch_clients WHERE phone=%s AND company_id=%s",
                    (norm, owner_id))
            else:
                return err("client_id или phone обязателен")
            cli = cur.fetchone()
            if not cli:
                return err("client not found", 404)
            client_id, channel_ids, client_phone = cli[0], (cli[1] or {}), cli[2]

            external_chat_id = channel_ids.get(channel)
            if not external_chat_id:
                # Telegram/MAX: если клиент ещё не писал сам, но у него есть телефон —
                # воркер попробует найти его в Telegram по номеру (как обычный "добавить
                # контакт по номеру") и написать первым. Для Avito/WhatsApp такого пути
                # нет — там переписка возможна только после первого сообщения клиента.
                if channel in ("telegram", "max") and client_phone:
                    pass  # отправляем в pending без external_chat_id — воркер разрулит по phone
                else:
                    return err(f"нет привязки к каналу «{channel}» — клиент ещё не писал через него", 400)

            # Avito отправляется СРАЗУ через API (без воркера), Telegram/MAX — через
            # очередь pending (их заберёт воркер на VPS).
            initial_status = "pending"
            out_external_id = None  # id сообщения в канале (заполняем для Avito — защита от дублей)
            line_account_id = None  # какая именно линия (аккаунт) должна отправить — для воркера
            if channel in ("telegram", "max"):
                line_account_id = None
                # Если менеджер явно выбрал линию в интерфейсе — используем её
                # (проверяем, что она принадлежит компании, тому же каналу,
                # активна и авторизована — иначе тихо переходим к автовыбору).
                if requested_account_id:
                    cur.execute(f"""
                        SELECT id FROM {SCHEMA}.messenger_accounts
                        WHERE id=%s AND company_id=%s AND channel=%s
                          AND is_active=TRUE AND auth_status='authorized'
                    """, (requested_account_id, owner_id, channel))
                    req_row = cur.fetchone()
                    if req_row:
                        line_account_id = req_row[0]
                    else:
                        return err("Выбранная линия недоступна — проверьте авторизацию в Интеграциях", 400)
                if not line_account_id:
                    # Без привязки к конкретной линии воркер не знает, каким аккаунтом
                    # отправлять — сообщение зависало бы в pending навсегда.
                    # Если у компании НЕСКОЛЬКО линий одного канала — важно ответить с
                    # ТОЙ ЖЕ линии, с которой клиент переписывался раньше (иначе ответ
                    # уйдёт с чужого аккаунта или вообще не найдёт получателя). Смотрим
                    # последнее входящее сообщение этого клиента в этом канале — его
                    # account_id и есть «правильная» линия.
                    cur.execute(f"""
                        SELECT te.account_id FROM {SCHEMA}.touch_events te
                        WHERE te.client_id=%s AND te.channel=%s AND te.direction='in' AND te.account_id IS NOT NULL
                        ORDER BY te.created_at DESC LIMIT 1
                    """, (client_id, channel))
                    prev_row = cur.fetchone()
                    if prev_row:
                        cur.execute(f"""
                            SELECT id FROM {SCHEMA}.messenger_accounts
                            WHERE id=%s AND is_active=TRUE AND auth_status='authorized'
                        """, (prev_row[0],))
                        active_prev = cur.fetchone()
                        if active_prev:
                            line_account_id = active_prev[0]
                if not line_account_id:
                    # Истории нет (первый контакт) или прежняя линия отключена —
                    # берём любую активную авторизованную линию этого канала.
                    cur.execute(f"""
                        SELECT id FROM {SCHEMA}.messenger_accounts
                        WHERE company_id=%s AND channel=%s AND is_active=TRUE AND auth_status='authorized'
                        ORDER BY id LIMIT 1
                    """, (owner_id, channel))
                    line_row = cur.fetchone()
                    if not line_row:
                        label = "Telegram" if channel == "telegram" else "MAX"
                        return err(f"Нет подключённой линии {label} — авторизуйте линию в Интеграциях", 400)
                    line_account_id = line_row[0]
            if channel == "avito":
                cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
                arow = cur.fetchone()
                acfg = arow[0] if arow else {}
                token, terr = avito_get_messenger_token(cur, conn, owner_id, acfg)
                avito_user_id = acfg.get("_avito_user_id")
                if terr or not avito_user_id:
                    return err(terr or "Avito не настроен — нажмите «Подключить Avito» в Интеграциях", 400)
                sent_msg_id, serr = avito_send_message(token, avito_user_id, external_chat_id, text)
                initial_status = "error" if serr else "sent"
                # Запоминаем id сообщения от Avito — по нему вебхук поймёт, что это
                # НАШЕ отправленное сообщение, и не создаст дубль в переписке.
                if sent_msg_id:
                    out_external_id = f"avito_{sent_msg_id}"

            cur.execute(f"""
                INSERT INTO {SCHEMA}.touch_events (client_id, channel, direction, external_id, text, attachments, status, reply_to_id, account_id)
                VALUES (%s, %s, 'out', %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
            """, (client_id, channel, out_external_id, text,
                  json.dumps(attachments, ensure_ascii=False) if attachments else None, initial_status,
                  reply_to_id, line_account_id))
            new_row = cur.fetchone()
            conn.commit()
            if channel in ("telegram", "max") and initial_status == "pending":
                notify_worker_push("send-message")

            return ok({
                "touch_id": new_row[0],
                "created_at": new_row[1],
                "status": initial_status,
            })

        # ── TOUCH-INBOX: список диалогов для раздела «Сообщения» (единый инбокс) ──
        # Все клиенты, у кого есть хотя бы одно касание, отсортированы по времени
        # последнего сообщения (свежие сверху). Отдаём превью последнего сообщения,
        # канал, направление и id связанной заявки (для открытия переписки справа).
        if resource == "touch-inbox" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            # По умолчанию групповые чаты/каналы Telegram не показываем в общем
            # списке диалогов — это не переписка с клиентом, а мусор из групп,
            # куда добавлен рабочий аккаунт. ?include_groups=1 — показать и их.
            include_groups = qs.get("include_groups") == "1"
            group_filter = "" if include_groups else "AND tc.chat_type = 'private'"

            # Фильтр по источнику: показывать только диалоги, где последнее
            # сообщение пришло/ушло по выбранному каналу. Пусто/"all" — все каналы.
            channel_q = (qs.get("channel") or "").strip().lower()
            params = [owner_id]
            channel_filter = ""
            if channel_q and channel_q != "all":
                channel_filter = "AND le.channel = %s"
                params.append(channel_q)

            cur.execute(f"""
                SELECT tc.id, tc.name, tc.phone, tc.crm_contact_id,
                       tc.interest, tc.stage,
                       le.channel, le.direction, le.text, le.created_at,
                       (SELECT COUNT(*) FROM {SCHEMA}.touch_events te2
                        WHERE te2.client_id = tc.id AND te2.direction = 'in') AS in_count,
                       tc.pinned, tc.favorite,
                       lc.source, lc.avito_chat_url, tc.last_read_at,
                       tc.chat_type, tc.group_title,
                       le.status, le.has_attachments, le.has_my_reaction
                FROM {SCHEMA}.touch_clients tc
                JOIN LATERAL (
                    SELECT channel, direction, text, created_at, status,
                           (attachments IS NOT NULL OR audio_url IS NOT NULL) AS has_attachments,
                           EXISTS (
                               SELECT 1 FROM jsonb_array_elements(COALESCE(reactions, '[]'::jsonb)) rx
                               WHERE rx->>'by' = 'out'
                           ) AS has_my_reaction
                    FROM {SCHEMA}.touch_events te
                    WHERE te.client_id = tc.id
                    ORDER BY te.created_at DESC, te.id DESC
                    LIMIT 1
                ) le ON TRUE
                LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = tc.crm_contact_id
                WHERE tc.company_id = %s AND tc.hidden = FALSE {group_filter} {channel_filter}
                ORDER BY tc.pinned DESC, le.created_at DESC
                LIMIT 200
            """, tuple(params))
            dialogs = []
            for r in cur.fetchall():
                last_dir, last_at, last_read_at = r[7], r[9], r[15]
                # unread — ОБЩЕЕ на компанию: последнее событие входящее и новее last_read_at.
                # ВАЖНО: created_at хранится без часового пояса, а last_read_at — с поясом.
                # Их прямое сравнение роняло весь список диалогов, поэтому приводим к общему виду.
                is_unread = calc_unread(last_dir, last_at, last_read_at)
                dialogs.append({
                    "client_id": r[0],
                    "name": r[1],
                    "phone": r[2],
                    "contact_id": r[3],
                    "interest": r[4],
                    "stage": r[5],
                    "last_channel": r[6],
                    "last_direction": r[7],
                    "last_text": (r[8] or "")[:120],
                    "last_at": r[9],
                    "unread": is_unread,
                    "in_count": r[10],
                    "pinned": bool(r[11]),
                    "favorite": bool(r[12]),
                    "source": r[13],
                    "avito_chat_url": r[14],
                    "chat_type": r[16],
                    "group_title": r[17],
                    # Статус последнего сообщения — чтобы в списке диалогов сразу
                    # было видно «Ошибка»/«Отправляется», не открывая переписку.
                    "last_status": r[18],
                    # Пустое входящее без вложений = воркер не смог распознать
                    # содержимое (стикер/реакция/неизвестный тип). Показываем честно.
                    "last_has_attachments": bool(r[19]),
                    # На последнее (входящее) сообщение уже стоит наша реакция —
                    # менеджер по сути ответил, хотя формально последним писал клиент.
                    "last_has_my_reaction": bool(r[20]),
                })
            return ok({"dialogs": dialogs})

        # ── TOUCH-FLAGS: изменить пометки диалога (закрепить / избранное / скрыть) ──
        # PUT ?r=touch-flags&client_id=123  body: {"pinned": true} / {"favorite": true} / {"hidden": true}
        # Меняем только переданные поля — остальные не трогаем.
        if resource == "touch-flags" and method == "PUT":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)
            client_id = (qs.get("client_id") or "").strip()
            if not client_id.isdigit():
                return err("client_id required", 400)
            allowed = {"pinned", "favorite", "hidden"}
            sets, vals = [], []
            for key in allowed:
                if key in body:
                    sets.append(f"{key} = %s")
                    vals.append(bool(body[key]))
            if not sets:
                return err("no fields to update", 400)
            vals.extend([int(client_id), owner_id])
            cur.execute(
                f"UPDATE {SCHEMA}.touch_clients SET {', '.join(sets)} "
                f"WHERE id = %s AND company_id = %s",
                vals,
            )
            conn.commit()
            return ok({"updated": True})

        # ── TOUCH-HIDDEN: список скрытых диалогов (для возврата из корзины) ──
        # Тот же формат, что touch-inbox, но только hidden = TRUE.
        if resource == "touch-hidden" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"""
                SELECT tc.id, tc.name, tc.phone, tc.crm_contact_id,
                       le.channel, le.direction, le.text, le.created_at,
                       lc.source, lc.avito_chat_url
                FROM {SCHEMA}.touch_clients tc
                JOIN LATERAL (
                    SELECT channel, direction, text, created_at
                    FROM {SCHEMA}.touch_events te
                    WHERE te.client_id = tc.id
                    ORDER BY te.created_at DESC, te.id DESC
                    LIMIT 1
                ) le ON TRUE
                LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = tc.crm_contact_id
                WHERE tc.company_id = %s AND tc.hidden = TRUE
                ORDER BY le.created_at DESC
                LIMIT 200
            """, (owner_id,))
            hidden = [{
                "client_id": r[0],
                "name": r[1],
                "phone": r[2],
                "contact_id": r[3],
                "last_channel": r[4],
                "last_direction": r[5],
                "last_text": (r[6] or "")[:120],
                "last_at": r[7],
                "source": r[8],
                "avito_chat_url": r[9],
            } for r in cur.fetchall()]
            return ok({"dialogs": hidden})

        # ── TOUCH-BADGES: срез (интерес/стадия/непрочитано) по всем клиентам компании ──
        # для бейджей в списке контактов. Один запрос вместо похода в каждую карточку.
        if resource == "touch-badges" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"""
                SELECT tc.phone, tc.interest, tc.stage, tc.next_action,
                       (SELECT te.direction FROM {SCHEMA}.touch_events te
                        WHERE te.client_id = tc.id
                        ORDER BY te.created_at DESC, te.id DESC LIMIT 1) AS last_direction,
                       (SELECT te.created_at FROM {SCHEMA}.touch_events te
                        WHERE te.client_id = tc.id
                        ORDER BY te.created_at DESC, te.id DESC LIMIT 1) AS last_at,
                       tc.last_read_at
                FROM {SCHEMA}.touch_clients tc
                WHERE tc.company_id = %s AND tc.phone IS NOT NULL
            """, (owner_id,))
            badges = {}
            for phone, interest, stage, next_action, last_direction, last_at, last_read_at in cur.fetchall():
                digits = re.sub(r"\D", "", phone or "")[-10:]
                if not digits:
                    continue
                # unread — ОБЩЕЕ на компанию: последнее входящее событие новее last_read_at
                is_unread = calc_unread(last_direction, last_at, last_read_at)
                badges[digits] = {
                    "interest": interest,
                    "stage": stage,
                    "next_action": next_action,
                    "unread": is_unread,
                }
            return ok({"badges": badges})

        # ── TOUCH-DASHBOARD: лёгкий дашборд модуля «Касания» ───────────────────────
        if resource == "touch-dashboard" and method == "GET":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            days = qs.get("days", "30")
            try:
                days = max(1, min(365, int(days)))
            except (TypeError, ValueError):
                days = 30

            # Опциональный фильтр по источнику заявки. Касание связано с заявкой
            # через touch_clients.crm_contact_id -> live_chats.id, где хранится source.
            src = (qs.get("source") or "").strip()
            # SQL-фрагмент (JOIN + условие) и доп. параметр для каждого запроса.
            src_join = ""
            src_cond = ""
            if src:
                src_join = f" JOIN {SCHEMA}.live_chats slc ON slc.id = tc.crm_contact_id"
                src_cond = " AND slc.source = %s"

            # Всего касаний за период + распределение по каналам
            params = [owner_id, str(days)] + ([src] if src else [])
            cur.execute(f"""
                SELECT te.channel, COUNT(*) AS cnt
                FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id{src_join}
                WHERE tc.company_id = %s AND te.created_at >= NOW() - (%s || ' days')::interval{src_cond}
                GROUP BY te.channel ORDER BY cnt DESC
            """, tuple(params))
            by_channel = [{"channel": r[0], "count": r[1]} for r in cur.fetchall()]
            total_touches = sum(x["count"] for x in by_channel)

            # Конверсия по итогам последнего анализа каждого клиента (за всё время)
            params = [owner_id] + ([src] if src else [])
            cur.execute(f"""
                SELECT last.outcome, COUNT(*) FROM (
                    SELECT DISTINCT ON (client_id) client_id, outcome
                    FROM {SCHEMA}.touch_client_analyses
                    ORDER BY client_id, created_at DESC, id DESC
                ) last
                JOIN {SCHEMA}.touch_clients tc ON tc.id = last.client_id{src_join}
                WHERE tc.company_id = %s{src_cond}
                GROUP BY last.outcome
            """, tuple(params))
            outcome_rows = cur.fetchall()
            outcome_dist = {o or "pending": c for o, c in outcome_rows}
            analyzed_total = sum(outcome_dist.values())
            success_count = outcome_dist.get("success", 0)
            conversion_pct = round(success_count / analyzed_total * 100) if analyzed_total else 0

            # Топ клиентов «требуют внимания»: высокий интерес или последнее касание — входящее.
            # unread (непрочитано) — ОБЩЕЕ на компанию: последнее входящее событие новее,
            # чем last_read_at (момент, когда любой сотрудник открыл диалог).
            params = [owner_id] + ([src] if src else [])
            cur.execute(f"""
                SELECT tc.id, tc.name, tc.phone, tc.interest, tc.stage, tc.next_action,
                       (SELECT te.direction FROM {SCHEMA}.touch_events te
                        WHERE te.client_id = tc.id ORDER BY te.created_at DESC, te.id DESC LIMIT 1) AS last_direction,
                       (SELECT te.created_at FROM {SCHEMA}.touch_events te
                        WHERE te.client_id = tc.id ORDER BY te.created_at DESC, te.id DESC LIMIT 1) AS last_at,
                       tc.last_read_at
                FROM {SCHEMA}.touch_clients tc{src_join}
                WHERE tc.company_id = %s AND (tc.interest = 'high' OR tc.next_action IS NOT NULL){src_cond}
                ORDER BY tc.analysis_updated_at DESC NULLS LAST
                LIMIT 8
            """, tuple(params))
            attention = []
            for r in cur.fetchall():
                last_direction, last_at, last_read_at = r[6], r[7], r[8]
                is_unread = calc_unread(last_direction, last_at, last_read_at)
                attention.append({
                    "id": r[0], "name": r[1], "phone": r[2], "interest": r[3],
                    "stage": r[4], "next_action": r[5], "unread": is_unread,
                })

            # Средняя оценка звонков за период (только реально проанализированные ИИ)
            params = [owner_id, str(days)] + ([src] if src else [])
            cur.execute(f"""
                SELECT AVG(t.operator_score)::float, COUNT(*)
                FROM {SCHEMA}.touch_call_transcripts t
                JOIN {SCHEMA}.touch_events te ON te.id = t.touch_id
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id{src_join}
                WHERE tc.company_id = %s AND t.operator_score IS NOT NULL
                  AND te.created_at >= NOW() - (%s || ' days')::interval{src_cond}
            """, tuple(params))
            score_row = cur.fetchone()
            avg_operator_score = round(score_row[0], 1) if score_row and score_row[0] is not None else None
            scored_calls_count = score_row[1] if score_row else 0

            return ok({
                "days": days,
                "total_touches": total_touches,
                "by_channel": by_channel,
                "conversion_pct": conversion_pct,
                "analyzed_total": analyzed_total,
                "attention": attention,
                "avg_operator_score": avg_operator_score,
                "scored_calls_count": scored_calls_count,
            })

        # ── ЖУРНАЛ АКТИВНОСТИ ПО КЛИЕНТУ (общий на компанию, с автором) ────────
        if resource == "activity-log":
            if not authenticated:
                return err("Требуется авторизация", 401)

            if method == "GET":
                cid = qs.get("client_id")
                if not cid:
                    return err("client_id required")
                cur.execute(f"""
                    SELECT id, user_name, icon, color, text, created_at
                    FROM {SCHEMA}.activity_log
                    WHERE client_id = %s
                    ORDER BY created_at ASC, id ASC
                """, (int(cid),))
                rows = cur.fetchall()
                return ok([{
                    "id": r[0], "author": r[1], "icon": r[2], "color": r[3],
                    "text": r[4], "created_at": r[5].isoformat() if r[5] else None,
                } for r in rows])

            if method == "POST":
                cid = body.get("client_id")
                text = (body.get("text") or "").strip()
                if not cid or not text:
                    return err("client_id and text required")
                icon = (body.get("icon") or "Circle")[:64]
                color = (body.get("color") or "#8b5cf6")[:16]
                owner_cmp = company_id if company_id is not None else master_uid
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.activity_log
                        (client_id, company_id, user_id, user_name, icon, color, text)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at
                """, (int(cid), owner_cmp, master_uid, current_user_name, icon, color, text))
                new_id, created = cur.fetchone()
                conn.commit()
                return ok({
                    "id": new_id, "author": current_user_name, "icon": icon,
                    "color": color, "text": text,
                    "created_at": created.isoformat() if created else None,
                })

        # ── ОТМЕТКА ПРОЧТЕНИЯ КАСАНИЙ (общая на компанию) ─────────────────────
        if resource == "touch-read" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)
            # Отмечаем прочитанным диалог по одному из идентификаторов:
            #  client_id  — id записи touch_clients
            #  contact_id — id заявки live_chats (touch_clients.crm_contact_id)
            #  phone      — номер телефона клиента
            # Либо все сразу, если ничего не передано.
            tc_id      = body.get("client_id")
            contact_id = body.get("contact_id")
            phone      = body.get("phone")
            if tc_id:
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_clients SET last_read_at = NOW()
                    WHERE id = %s AND company_id = %s
                """, (int(tc_id), owner_id))
            elif contact_id:
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_clients SET last_read_at = NOW()
                    WHERE crm_contact_id = %s AND company_id = %s
                """, (int(contact_id), owner_id))
            elif phone:
                norm = normalize_phone(phone)
                if norm:
                    cur.execute(f"""
                        UPDATE {SCHEMA}.touch_clients SET last_read_at = NOW()
                        WHERE phone = %s AND company_id = %s
                    """, (norm, owner_id))
            else:
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_clients SET last_read_at = NOW()
                    WHERE company_id = %s
                """, (owner_id,))
            conn.commit()
            return ok({"ok": True})

        return err("unknown resource", 404)

    except Exception as e:
        conn.rollback()
        print(f"[crm-manager] error: {e}")
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()