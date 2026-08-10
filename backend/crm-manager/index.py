import json
import os
import re
import hashlib
import base64
import uuid
import psycopg2
import boto3
import urllib.request as _ureq
from datetime import datetime

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

def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

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
    for r in rows:
        ch, direction, text, dur, created = r
        who = "Клиент" if direction == "in" else "Мы"
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

    sys_prompt = "Отвечай только валидным JSON без markdown и пояснений."
    user_prompt = (
        "Ты аналитик отдела продаж. На вход — вся история общения с клиентом "
        "(звонки и переписки из разных каналов) по порядку времени.\n"
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
        "Правила: опирайся только на факты из истории, не выдумывай. "
        "Рекомендация должна быть практичной и конкретной.\n\n"
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


ALL_CLIENT_FIELDS = [
    "client_name", "phone", "status", "sub_status", "client_status", "measure_date", "install_date",
    "next_call_date",
    "notes", "address", "area", "budget", "source",
    "contract_sum", "prepayment", "extra_payment", "extra_agreement_sum",
    "discount_pct", "discount_amount",
    "prepayment_confirmed", "prepayment_confirmed_at", "prepayment_fact",
    "extra_payment_confirmed", "extra_payment_confirmed_at", "extra_payment_fact",
    "responsible_phone", "map_link", "tags",
    "photo_before_url", "photo_after_url", "document_url",
    "material_cost", "measure_cost", "install_cost", "management_cost", "cancel_reason",
    "project_id",
]

def handler(event: dict, context) -> dict:
    """CRM-менеджер: клиенты, канбан, календарь, аналитика, файлы."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    resource = qs.get("r", "")
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
    master_uid = 0      # реальный uid текущего пользователя (для вставок)
    # Список статусов воронки, разрешённых текущему сотруднику (None = ограничений нет, видно всё)
    allowed_statuses = None
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

        # ── BUG REPORTS ──────────────────────────────────────────────────────
        if resource == "bug_reports":
            # Статусы, менять которые может только мастер
            MASTER_ONLY_STATUSES = ["in_progress", "done", "rejected"]
            VALID_STATUSES = ["new"] + MASTER_ONLY_STATUSES
            VALID_SEVERITY = ["critical", "important", "normal", "idea"]
            VALID_TYPES = ["bug", "improvement", "idea"]

            if method == "GET":
                cur.execute(
                    f"""SELECT id, title, description, severity, report_type, status,
                               attachments, author_id, author_name, created_at, updated_at
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
                attachments = body.get("attachments", [])
                if severity not in VALID_SEVERITY:
                    severity = "normal"
                if report_type not in VALID_TYPES:
                    report_type = "bug"
                if not description and not title:
                    return err("description required")
                author_name = (body.get("author_name") or "").strip()[:255]
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.bug_reports
                        (title, description, severity, report_type, status, attachments, author_id, author_name)
                        VALUES (%s,%s,%s,%s,'new',%s,%s,%s) RETURNING id""",
                    (title, description, severity, report_type,
                     json.dumps(attachments, ensure_ascii=False), master_uid or None, author_name)
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
                report_id = body.get("id") or qs.get("id")
                if not report_id:
                    return err("id required")
                if not is_master:
                    return err("only master can delete", 403)
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
                           lc.contract_sum, lc.prepayment, lc.extra_payment, lc.extra_agreement_sum,
                           lc.discount_pct, lc.discount_amount,
                           lc.prepayment_confirmed, lc.prepayment_confirmed_at, lc.prepayment_fact,
                           lc.extra_payment_confirmed, lc.extra_payment_confirmed_at, lc.extra_payment_fact,
                           lc.responsible_phone, lc.map_link, lc.tags,
                           lc.photo_before_url, lc.photo_after_url, lc.document_url,
                           lc.material_cost, lc.measure_cost, lc.install_cost, lc.management_cost, lc.cancel_reason,
                           lc.updated_at, lc.project_id, lc.avito_chat_url, lc.status_changed_at,
                           lc.next_call_date, lcall.last_call_at,
                           COALESCE(missed.has_missed_call, FALSE) AS has_missed_call,
                           COALESCE(u.is_demo, FALSE) AS is_demo,
                           COALESCE(cfv.custom_costs_total, 0) AS custom_costs_total
                    FROM {SCHEMA}.live_chats lc
                    LEFT JOIN {SCHEMA}.users u ON lc.company_id = u.id
                    LEFT JOIN (
                        SELECT client_id, SUM(value) AS custom_costs_total
                        FROM {SCHEMA}.client_custom_fin_values
                        GROUP BY client_id
                    ) cfv ON cfv.client_id = lc.id
                    LEFT JOIN (
                        SELECT tc2.crm_contact_id AS contact_id, MAX(te.created_at) AS last_call_at
                        FROM {SCHEMA}.touch_clients tc2
                        JOIN {SCHEMA}.touch_events te ON te.client_id = tc2.id
                        WHERE te.channel='call' AND te.direction='in' AND tc2.crm_contact_id IS NOT NULL
                        GROUP BY tc2.crm_contact_id
                    ) lcall ON lcall.contact_id = lc.id
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
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='19.jeka.94@gmail.com'")
                master_id_row = cur.fetchone()
                master_id = master_id_row[0] if master_id_row else None
                final_company_id = company_id if company_id is not None else master_id

                cur.execute(
                    f"""INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, status, client_status, measure_date, install_date,
                         notes, address, area, budget, source, created_via,
                         contract_sum, prepayment, responsible_phone, map_link, tags, company_id, status_changed_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
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
            total_received = total_prepayment + total_extra

            # Себестоимость
            cur.execute(f"SELECT COALESCE(SUM(material_cost),0), COALESCE(SUM(measure_cost),0), COALESCE(SUM(install_cost),0) FROM {S}.live_chats WHERE status != 'deleted'{cid_filter}")
            r2 = cur.fetchone()
            total_material, total_measure_cost, total_install_cost = float(r2[0]), float(r2[1]), float(r2[2])
            total_costs = total_material + total_measure_cost + total_install_cost
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
                    SELECT DATE_TRUNC('month', created_at) AS m, COUNT(*) AS cnt
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
                    SELECT DATE_TRUNC('month', created_at) AS m, COALESCE(SUM(contract_sum), 0) AS s
                    FROM {S}.live_chats WHERE contract_sum IS NOT NULL AND status != 'deleted'{cmp_sql} GROUP BY 1
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
                    SELECT DATE_TRUNC('month', created_at) AS m,
                        COALESCE(SUM(material_cost),0) + COALESCE(SUM(measure_cost),0) + COALESCE(SUM(install_cost),0) AS s
                    FROM {S}.live_chats WHERE status != 'deleted'{cmp_sql} GROUP BY 1
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
                    SELECT DATE_TRUNC('month', created_at) AS m,
                        COALESCE(SUM(contract_sum),0) - COALESCE(SUM(material_cost),0) - COALESCE(SUM(measure_cost),0) - COALESCE(SUM(install_cost),0) AS s
                    FROM {S}.live_chats WHERE status != 'deleted'{cmp_sql} GROUP BY 1
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
                "total_prepayment": total_prepayment,
                "total_extra": total_extra,
                "total_extra_agreement": total_extra_agreement,
                # Себестоимость
                "total_material": total_material,
                "total_measure_cost": total_measure_cost,
                "total_install_cost": total_install_cost,
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
                    if month and year:
                        cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                            ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone, lc.address
                            FROM {SCHEMA}.calendar_events ce
                            LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                            WHERE ce.company_id=%s
                              AND EXTRACT(MONTH FROM ce.start_time)=%s
                              AND EXTRACT(YEAR FROM ce.start_time)=%s
                              AND (lc.status IS NULL OR lc.status != 'deleted')
                            ORDER BY ce.start_time""", (company_id, int(month), int(year)))
                    else:
                        cur.execute(f"""SELECT ce.id, ce.client_id, ce.title, ce.description, ce.event_type,
                            ce.start_time, ce.end_time, ce.color, ce.created_at, lc.client_name, lc.phone, lc.address
                            FROM {SCHEMA}.calendar_events ce
                            LEFT JOIN {SCHEMA}.live_chats lc ON ce.client_id=lc.id
                            WHERE ce.company_id=%s
                              AND (lc.status IS NULL OR lc.status != 'deleted')
                            ORDER BY ce.start_time DESC LIMIT 100""", (company_id,))
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
                            (session_id, client_name, phone, address, status, created_via, company_id, project_id, status_changed_at)
                        VALUES (%s,%s,%s,%s,'new','plan',%s,%s,NOW()) RETURNING id
                    """, (session_id, client_name or name, phone, address, insert_cmp, new_id))
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
                        (session_id, client_name, phone, address, status, created_via, company_id, project_id, status_changed_at)
                    VALUES (%s,%s,%s,%s,'new','plan',%s,%s,NOW()) RETURNING id
                """, (session_id, client_name or proj_name, phone, address, insert_cmp, proj_id))
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
                        "interest, stage, analysis_updated_at")

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
                }
                # Лента касаний по времени. status='hidden' — технические дубли звонков
                # (черновик click-to-call, который из-за сбоя не смог смэтчиться с
                # вебхуком завершения по external_id) — в ленте не показываем.
                cur.execute(f"""
                    SELECT id, channel, direction, external_id, text, audio_url,
                           duration_sec, attachments, status, created_at
                    FROM {SCHEMA}.touch_events
                    WHERE client_id=%s AND status != 'hidden'
                    ORDER BY created_at ASC, id ASC
                """, (client_id,))
                touches = [{
                    "id": r[0], "channel": r[1], "direction": r[2], "external_id": r[3],
                    "text": r[4], "audio_url": r[5], "duration_sec": r[6],
                    "attachments": r[7], "status": r[8], "created_at": r[9],
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

        # ── ANALYZE-CLIENT: ИИ-пересбор сводки по всей истории касаний ────────────
        if resource == "analyze-client" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            client_id = body.get("client_id") if isinstance(body, dict) else None
            phone_q = body.get("phone") if isinstance(body, dict) else None
            if not client_id and not phone_q:
                return err("client_id or phone required")

            if client_id:
                cur.execute(
                    f"SELECT id, phone, name FROM {SCHEMA}.touch_clients WHERE id=%s AND company_id=%s",
                    (client_id, owner_id))
            else:
                norm = normalize_phone(phone_q)
                if not norm:
                    return err("phone invalid")
                cur.execute(
                    f"SELECT id, phone, name FROM {SCHEMA}.touch_clients WHERE phone=%s AND company_id=%s",
                    (norm, owner_id))
            cli = cur.fetchone()
            if not cli:
                return err("client not found", 404)
            client_id, client_phone, client_name = cli[0], cli[1], cli[2]

            analysis, err_msg = run_client_analysis(cur, conn, client_id, client_phone, client_name)
            if err_msg:
                return err(err_msg, 400 if "нет касаний" in err_msg else 500 if "нет ключа" in err_msg else 502)

            return ok({"client_id": client_id, "analysis": analysis})

        # ── ANALYZE-CALL: ИИ-оценка отдельного звонка (перенос ТЗ 8.1) ─────────────
        if resource == "analyze-call" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            touch_id = body.get("touch_id") if isinstance(body, dict) else None
            if not touch_id:
                return err("touch_id required")

            # Проверяем принадлежность звонка компании и достаём текст
            cur.execute(f"""
                SELECT te.id, te.text, te.duration_sec, te.channel
                FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id
                WHERE te.id=%s AND tc.company_id=%s
            """, (touch_id, owner_id))
            row = cur.fetchone()
            if not row:
                return err("звонок не найден", 404)
            _, event_text, duration_sec, channel = row
            if channel != "call":
                return err("это касание не звонок", 400)

            # Транскрипт: либо детальный (touch_call_transcripts.full_text), либо текст касания
            cur.execute(f"""
                SELECT id, full_text FROM {SCHEMA}.touch_call_transcripts
                WHERE touch_id=%s
            """, (touch_id,))
            tr = cur.fetchone()
            transcript_text = (tr[1] if tr and tr[1] else event_text) or ""
            if not transcript_text.strip():
                return err("нет текста звонка для анализа", 400)

            polza_key = os.environ.get("POLZA_API_KEY", "")
            if not polza_key:
                return err("AI недоступен — нет ключа", 500)

            sys_prompt = "Отвечай только валидным JSON без markdown и пояснений."
            user_prompt = (
                "Ты эксперт по анализу звонков отдела продаж. На вход — транскрипт звонка "
                "между оператором и клиентом. Оцени звонок и верни ТОЛЬКО валидный JSON:\n"
                '{\n'
                '  "call_type": "incoming|outgoing|repeat",\n'
                '  "call_type_label": "Входящий|Исходящий|Повторный",\n'
                '  "qualification": "qualified|unqualified|spam",\n'
                '  "qualification_label": "Целевой|Нецелевой|Спам",\n'
                '  "client_interest": "high|medium|low",\n'
                '  "client_interest_label": "Высокий|Средний|Низкий",\n'
                '  "outcome": "success|failure|pending",\n'
                '  "outcome_label": "Успех|Отказ|В работе",\n'
                '  "fail_reason": "причина отказа, если есть, иначе null",\n'
                '  "success_factor": "что сработало, если успех, иначе null",\n'
                '  "operator_score": число от 1 до 10 — качество работы оператора,\n'
                '  "operator_followed_script": true|false,\n'
                '  "operator_handled_objections": true|false,\n'
                '  "operator_comment": "1-2 предложения обратной связи оператору",\n'
                '  "summary": "краткое содержание звонка (2-3 предложения)",\n'
                '  "key_phrases_client": ["фраза клиента 1", "..."],\n'
                '  "key_phrases_operator": ["фраза оператора 1", "..."]\n'
                '}\n'
                "Правила: опирайся только на факты из транскрипта, не выдумывай.\n\n"
                f"Длительность звонка: {duration_sec or 0} сек.\n"
                f"Транскрипт:\n{transcript_text[:6000]}"
            )
            payload = json.dumps({
                "model": "openai/gpt-4o-mini",
                "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_prompt}],
                "max_tokens": 700, "temperature": 0.1,
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
                    return err("AI вернул неожиданный формат", 502)
                parsed = json.loads(m.group(0))
            except Exception as e:
                return err(f"AI ошибка: {str(e)[:200]}", 502)

            fields = {
                "call_type": parsed.get("call_type"),
                "call_type_label": parsed.get("call_type_label"),
                "qualification": parsed.get("qualification"),
                "qualification_label": parsed.get("qualification_label"),
                "client_interest": parsed.get("client_interest"),
                "client_interest_label": parsed.get("client_interest_label"),
                "outcome": parsed.get("outcome"),
                "outcome_label": parsed.get("outcome_label"),
                "fail_reason": parsed.get("fail_reason"),
                "success_factor": parsed.get("success_factor"),
                "operator_score": parsed.get("operator_score"),
                "operator_followed_script": parsed.get("operator_followed_script"),
                "operator_handled_objections": parsed.get("operator_handled_objections"),
                "operator_comment": parsed.get("operator_comment"),
                "summary": parsed.get("summary"),
                "key_phrases_client": json.dumps(parsed.get("key_phrases_client") or [], ensure_ascii=False),
                "key_phrases_operator": json.dumps(parsed.get("key_phrases_operator") or [], ensure_ascii=False),
            }
            try:
                score = int(fields["operator_score"])
                fields["operator_score"] = max(1, min(10, score))
            except (TypeError, ValueError):
                fields["operator_score"] = None

            if tr:
                set_sql = ", ".join(f"{k}=%s" for k in fields)
                cur.execute(
                    f"UPDATE {SCHEMA}.touch_call_transcripts SET {set_sql}, analyzed_at=NOW() WHERE touch_id=%s",
                    (*fields.values(), touch_id))
            else:
                cols = ", ".join(["touch_id", *fields.keys(), "analyzed_at"])
                placeholders = ", ".join(["%s"] * (len(fields) + 1) + ["NOW()"])
                cur.execute(
                    f"INSERT INTO {SCHEMA}.touch_call_transcripts ({cols}) VALUES ({placeholders})",
                    (touch_id, *fields.values()))
            conn.commit()

            return ok({
                "touch_id": touch_id,
                "analysis": {
                    **{k: v for k, v in fields.items() if k not in ("key_phrases_client", "key_phrases_operator")},
                    "key_phrases_client": parsed.get("key_phrases_client") or [],
                    "key_phrases_operator": parsed.get("key_phrases_operator") or [],
                },
            })

        # ── CHANNEL-CONFIG: секретный ключ приёма сообщений для воркера на VPS ─────
        # Компания видит/генерирует свой ключ во вкладке «Интеграции». Этот ключ
        # воркер (Telethon/PyMax) подставляет в заголовок при вызове channel-webhook.
        if resource == "channel-config":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = dict(row[0]) if row and row[0] else {}

            if method == "GET":
                return ok({"webhook_key": cfg.get("_channel_webhook_key")})

            if method == "POST" and body.get("regenerate"):
                new_key = uuid.uuid4().hex
                cfg["_channel_webhook_key"] = new_key
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.integrations (company_id, config, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (company_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW()
                """, (owner_id, json.dumps(cfg, ensure_ascii=False)))
                conn.commit()
                return ok({"webhook_key": new_key})

            return err("unknown action")

        # ── CHANNEL-WEBHOOK: приём сообщения от воркера (Telegram/MAX) ─────────────
        # Вызывается НЕ сотрудником, а нашим воркером на VPS — авторизация через
        # секретный webhook_key (не через сессию пользователя).
        if resource == "channel-webhook" and method == "POST":
            company_id_q = qs.get("company_id")
            webhook_key  = (event.get("headers") or {}).get("X-Webhook-Key", "")
            if not company_id_q or not webhook_key:
                return err("company_id и X-Webhook-Key обязательны", 401)
            try:
                owner_id = int(company_id_q)
            except ValueError:
                return err("company_id invalid")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else None
            if not cfg or cfg.get("_channel_webhook_key") != webhook_key:
                return err("неверный ключ", 401)

            channel     = body.get("channel")       # "telegram" | "max"
            direction   = body.get("direction", "in")  # "in" (обычно вебхук = входящее)
            phone       = body.get("phone")         # если воркер знает номер
            external_chat_id = body.get("external_chat_id")  # id чата в канале (fallback без телефона)
            name        = body.get("name")
            text        = body.get("text")
            external_id = body.get("external_id")   # id сообщения в канале — защита от дублей
            attachments = body.get("attachments")

            if channel not in ("telegram", "max", "avito", "whatsapp"):
                return err("unknown channel")
            if not phone and not external_chat_id:
                return err("phone или external_chat_id обязателен")

            # Находим/создаём клиента: приоритет — телефон, иначе внешний id канала
            # (channel_ids — JSONB {"telegram": "12345", "max": "..."}, ищем по конкретному каналу)
            client_row = None
            if phone:
                norm = normalize_phone(phone)
                if norm:
                    cur.execute(
                        f"SELECT id FROM {SCHEMA}.touch_clients WHERE phone=%s AND company_id=%s",
                        (norm, owner_id))
                    client_row = cur.fetchone()
                    if not client_row:
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone, name) VALUES (%s, %s, %s) RETURNING id",
                            (owner_id, norm, name))
                        client_row = cur.fetchone()
                        conn.commit()
            if not client_row and external_chat_id:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.touch_clients "
                    f"WHERE company_id=%s AND channel_ids->>%s = %s",
                    (owner_id, channel, str(external_chat_id)))
                client_row = cur.fetchone()
                if not client_row:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.touch_clients (company_id, name, channel_ids) "
                        f"VALUES (%s, %s, %s::jsonb) RETURNING id",
                        (owner_id, name, json.dumps({channel: str(external_chat_id)})))
                    client_row = cur.fetchone()
                    conn.commit()

            client_id = client_row[0]

            # Запоминаем/обновляем external_chat_id клиента для этого канала —
            # нужно, чтобы send-message знал, куда именно слать ответ.
            if external_chat_id:
                cur.execute(f"""
                    UPDATE {SCHEMA}.touch_clients
                    SET channel_ids = COALESCE(channel_ids, '{{}}'::jsonb) || %s::jsonb
                    WHERE id=%s
                """, (json.dumps({channel: str(external_chat_id)}), client_id))
                conn.commit()

            # Сохраняем касание (UNIQUE(channel, external_id) защищает от повторной вставки того же вебхука)
            try:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.touch_events (client_id, channel, direction, external_id, text, attachments, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'received')
                """, (client_id, channel, direction, external_id,
                      text, json.dumps(attachments, ensure_ascii=False) if attachments else None))
                conn.commit()
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                return ok({"duplicate": True, "client_id": client_id})

            # Автоматический пересбор ИИ-анализа при входящем — но не чаще раза в 10 минут
            # на клиента (если пишет несколько сообщений подряд, анализ не дублируем).
            analysis = None
            if direction == "in":
                cur.execute(
                    f"SELECT analysis_updated_at FROM {SCHEMA}.touch_clients WHERE id=%s",
                    (client_id,))
                au_row = cur.fetchone()
                au = au_row[0] if au_row else None
                if au is None or (datetime.now() - au).total_seconds() >= ANALYSIS_THROTTLE_SEC:
                    analysis, analysis_err = run_client_analysis(cur, conn, client_id, phone, name)
                    if analysis_err:
                        print(f"[channel-webhook] analysis skipped: {analysis_err}")

            return ok({"client_id": client_id, "saved": True, "analysis": analysis})

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

            # ── ВРЕМЕННАЯ ДИАГНОСТИКА (включено ~на 2 дня) ──────────────────────
            # Логируем ПОЛНЫЙ сырой JSON от Avito, чтобы проверить: приходит ли в
            # событиях (звонок / отклик / «показал номер») подменный телефон покупателя.
            # Ставим ДО отсева событий без текста — именно такие события нас интересуют.
            # TODO: удалить после снятия данных.
            try:
                print(f"[avito-webhook RAW] {json.dumps(body, ensure_ascii=False)[:4000]}")
            except Exception:
                print(f"[avito-webhook RAW] <unserializable body>")

            # Формат Avito: {"payload": {"type":"message","value":{...}}}
            value = ((body or {}).get("payload") or {}).get("value") or {}
            av_chat_id = value.get("chat_id")
            av_author  = value.get("author_id")
            av_user_id = value.get("user_id")  # получатель = наш аккаунт
            content    = value.get("content") or {}
            text       = content.get("text")
            msg_id     = value.get("id")
            msg_type   = (value.get("type") or "").lower()

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

            elif msg_type == "call":
                # Звонок: показываем понятную строку прямо в ленте переписки
                call = content.get("call") or {}
                st = (call.get("status") or "").lower()
                secs = call.get("duration") or call.get("duration_sec") or 0
                if st in ("missed", "no-answer", "noanswer", "busy", "declined"):
                    text = "Пропущенный звонок"
                else:
                    mm, ss = divmod(int(secs or 0), 60)
                    dur = f"{mm} мин {ss} сек" if mm else f"{ss} сек"
                    text = f"Звонок · {dur}" if secs else "Звонок"

            # Служебные события без чата/содержимого пропускаем
            if not av_chat_id or not text:
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
                    f"SELECT id FROM {SCHEMA}.users WHERE email='19.jeka.94@gmail.com'")
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
                        (session_id, client_name, phone, status, notes, source, created_via, company_id, avito_chat_url, status_changed_at)
                    VALUES (%s, %s, %s, 'new', %s, 'Авито', 'chat', %s, %s, NOW())
                    RETURNING id
                """, (f"avito_{av_chat_id}", client_name, "",
                      (f"Первое сообщение менеджера: {text[:200]}" if av_direction == "out"
                       else f"Первое сообщение: {text[:200]}"), final_company_id, avito_chat_url))
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
            return ok({"client_id": client_id, "saved": True})

        # ── UIS-WEBHOOK-CONFIG: секретный ключ + URL вебхука для ЛК UIS (аналог channel-config) ──
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
            client_row = None
            if call["phone"]:
                last10 = call["phone"][-10:]
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.touch_clients
                    WHERE company_id=%s AND phone IS NOT NULL
                      AND right(regexp_replace(phone,'\\D','','g'),10)=%s
                    LIMIT 1
                """, (owner_id, last10))
                client_row = cur.fetchone()

            is_new_client = False
            if not client_row and call["phone"]:
                is_new_client = True
                cur.execute(
                    f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone) VALUES (%s, %s) RETURNING id",
                    (owner_id, call["phone"]))
                client_row = cur.fetchone()
                conn.commit()

            if not client_row:
                return ok({"skipped": True})  # нет ни номера, ни известного клиента — нечего привязать

            client_id = client_row[0]

            # Новый клиент по звонку — сразу создаём заявку в CRM (как и для Avito),
            # чтобы звонок не терялся без карточки. Только для ВХОДЯЩИХ звонков —
            # если это мы сами кому-то позвонили (direction='out', например через
            # ручной набор в UIS, не через кнопку «Позвонить»), заявку не создаём:
            # исходящий звонок не означает нового клиента, обратившегося к нам.
            if is_new_client and call["direction"] == "in":
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='19.jeka.94@gmail.com'")
                master_row = cur.fetchone()
                master_id = master_row[0] if master_row else None
                final_company_id = owner_id or master_id
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, status, notes, source, created_via, company_id, status_changed_at)
                    VALUES (%s, %s, %s, 'new', %s, 'Звонок на прямую', 'call', %s, NOW())
                    RETURNING id
                """, (f"uis_{call['session_id'] or uuid.uuid4().hex}", "Клиент по звонку", call["phone"],
                      "Первый звонок через АТС UIS", final_company_id))
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
            virtual_number_raw = cfg.get("uis_virtual_phone_number")
            if not api_key or not virtual_number_raw:
                return err("Заполните API-ключ и виртуальный номер в настройках телефонии", 400)
            # UIS принимает номер только цифрами (+7XXXXXXXXXX) — в настройках номер
            # мог быть введён с пробелами/скобками ("+7 (495) 487-74-77"), из-за чего
            # API отвечал "Invalid parameter value" по полю virtual_phone_number.
            virtual_number = normalize_phone(virtual_number_raw)
            if not virtual_number:
                return err("Виртуальный номер в настройках телефонии указан некорректно", 400)

            cur.execute(f"SELECT uis_phone FROM {SCHEMA}.users WHERE id=%s", (master_uid,))
            urow = cur.fetchone()
            operator_phone = normalize_phone(urow[0]) if urow and urow[0] else None
            if not operator_phone:
                return err("У вас не указан номер в АТС — заполните его в настройках телефонии", 400)

            # Клиент в модуле «Касания»: находим по id (если передан) или по телефону, иначе создаём
            client_row = None
            if client_id_q:
                cur.execute(f"SELECT id FROM {SCHEMA}.touch_clients WHERE id=%s AND company_id=%s",
                            (client_id_q, owner_id))
                client_row = cur.fetchone()
            if not client_row:
                cur.execute(f"SELECT id FROM {SCHEMA}.touch_clients WHERE company_id=%s AND phone=%s",
                            (owner_id, contact_phone))
                client_row = cur.fetchone()
                if not client_row:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.touch_clients (company_id, phone) VALUES (%s, %s) RETURNING id",
                        (owner_id, contact_phone))
                    client_row = cur.fetchone()
                    conn.commit()
            client_id = client_row[0]

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

            msg = (body or {}).get("message") or {}
            text = msg.get("text") or msg.get("caption")
            if not text:
                return ok({"skipped": True})  # не текстовое сообщение (стикер, фото без подписи и т.д.)

            lead = parse_tg_lead_text(text)
            if not lead:
                return ok({"skipped": True, "reason": "not a lead"})  # обычное сообщение в группе, не заявка

            # Дедупликация: используем message_id из Telegram как уникальный внешний id,
            # чтобы повторная доставка того же апдейта не создала вторую заявку.
            msg_id = msg.get("message_id")
            chat_id_tg = (msg.get("chat") or {}).get("id")
            session_id = f"tgleads_{chat_id_tg}_{msg_id}" if msg_id else f"tgleads_{uuid.uuid4().hex}"

            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='19.jeka.94@gmail.com'")
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

            try:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, status, address, area, notes, source, created_via, company_id, status_changed_at)
                    VALUES (%s, %s, %s, 'new', %s, %s, %s, 'Telegram-заявки', 'telegram_leads', %s, NOW())
                    ON CONFLICT (session_id) DO NOTHING
                    RETURNING id
                """, (session_id, "Заявка из Telegram", lead["phone"],
                      lead["city"], lead["area"], notes, final_company_id))
                new_row = cur.fetchone()
                conn.commit()
            except psycopg2.Error:
                conn.rollback()
                return err("db error", 500)

            if not new_row:
                return ok({"duplicate": True})

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
        if resource == "email-leads-poll" and method == "GET":
            poll_key = qs.get("key", "")
            expected_key = os.environ.get("EMAIL_LEADS_POLL_KEY")
            if not expected_key or poll_key != expected_key:
                return err("unauthorized", 401)

            smtp_user = os.environ.get("SMTP_USER")
            smtp_password = os.environ.get("SMTP_PASSWORD")
            if not smtp_user or not smtp_password:
                return err("почта не настроена (SMTP_USER/SMTP_PASSWORD)", 400)

            import imaplib
            import email as email_lib

            SENDER = "noreply@egokad.ru"

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

            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='19.jeka.94@gmail.com'")
            master_row = cur.fetchone()
            master_id = master_row[0] if master_row else None

            created, skipped, error_count = 0, 0, 0

            try:
                for folder in ("INBOX", '"[Gmail]/Spam"', '"[Gmail]/Спам"'):
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
                        try:
                            status, msg_data = imap.fetch(eid, "(RFC822)")
                            if status != "OK" or not msg_data or not msg_data[0]:
                                continue
                            msg = email_lib.message_from_bytes(msg_data[0][1])
                            message_id = msg.get("Message-ID") or f"emlid_{uuid.uuid4().hex}"
                            text = _extract_email_text(msg)
                            lead = parse_tg_lead_text(text) if text else None
                            if not lead:
                                imap.store(eid, "+FLAGS", "\\Seen")
                                skipped += 1
                                continue

                            session_id = f"emaillead_{hashlib.sha256(message_id.encode()).hexdigest()[:32]}"
                            notes_parts = []
                            if lead["description"]:
                                notes_parts.append(lead["description"])
                            if lead["term"]:
                                notes_parts.append(f"Срок: {lead['term']}")
                            if lead["contact_via"]:
                                notes_parts.append(f"Удобнее общаться: {lead['contact_via']}")
                            notes = "\n".join(notes_parts) if notes_parts else None

                            cur.execute(f"""
                                INSERT INTO {SCHEMA}.live_chats
                                    (session_id, client_name, phone, status, address, area, notes, source, created_via, company_id, status_changed_at)
                                VALUES (%s, %s, %s, 'new', %s, %s, %s, 'Email-заявки', 'email_leads', %s, NOW())
                                ON CONFLICT (session_id) DO NOTHING
                                RETURNING id
                            """, (session_id, "Заявка с сайта (email)", lead["phone"],
                                  lead["city"], lead["area"], notes, master_id))
                            new_row = cur.fetchone()
                            conn.commit()
                            imap.store(eid, "+FLAGS", "\\Seen")
                            if new_row:
                                created += 1
                            else:
                                skipped += 1
                        except Exception:
                            conn.rollback()
                            error_count += 1
                            continue
            finally:
                try:
                    imap.logout()
                except Exception:
                    pass

            return ok({"created": created, "skipped": skipped, "errors": error_count})

        # ── LEAKAD-WEBHOOK: заявки с leakad.ru напрямую по вебхуку (без задержек
        # почты). Формат текста заявки такой же, как в письмах/Telegram — разбираем
        # тем же parse_tg_lead_text. Точный формат тела запроса leakad.ru заранее
        # неизвестен, поэтому принимаем гибко: JSON с полем text/message/body,
        # либо сырой текст в теле запроса. Защита — секретный ключ в query.
        if resource == "leakad-webhook" and method == "POST":
            webhook_key = qs.get("key", "")
            expected_key = os.environ.get("LEAKAD_WEBHOOK_KEY")
            if not expected_key or webhook_key != expected_key:
                return err("unauthorized", 401)

            raw_body = event.get("body") or ""
            if event.get("isBase64Encoded"):
                try:
                    raw_body = base64.b64decode(raw_body).decode("utf-8", errors="ignore")
                except Exception:
                    pass

            text = None
            if isinstance(body, dict) and body:
                text = body.get("text") or body.get("message") or body.get("body") or body.get("caption")
            if not text and raw_body:
                text = raw_body

            lead = parse_tg_lead_text(text) if text else None
            if not lead:
                return ok({"skipped": True, "reason": "not a lead"})

            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email='19.jeka.94@gmail.com'")
            master_row = cur.fetchone()
            master_id = master_row[0] if master_row else None

            session_id = f"leakadwh_{hashlib.sha256(text.encode()).hexdigest()[:32]}"
            notes_parts = []
            if lead["description"]:
                notes_parts.append(lead["description"])
            if lead["term"]:
                notes_parts.append(f"Срок: {lead['term']}")
            if lead["contact_via"]:
                notes_parts.append(f"Удобнее общаться: {lead['contact_via']}")
            notes = "\n".join(notes_parts) if notes_parts else None

            try:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.live_chats
                        (session_id, client_name, phone, status, address, area, notes, source, created_via, company_id, status_changed_at)
                    VALUES (%s, %s, %s, 'new', %s, %s, %s, 'Leakad-заявки', 'leakad_webhook', %s, NOW())
                    ON CONFLICT (session_id) DO NOTHING
                    RETURNING id
                """, (session_id, "Заявка с сайта (leakad)", lead["phone"],
                      lead["city"], lead["area"], notes, master_id))
                new_row = cur.fetchone()
                conn.commit()
            except psycopg2.Error:
                conn.rollback()
                return err("db error", 500)

            if not new_row:
                return ok({"duplicate": True})

            return ok({"created": True, "client_id": new_row[0]})

        # ── UIS-EMPLOYEES: номера сотрудников в АТС (для click-to-call) ────────────
        if resource == "uis-employees":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            if method == "GET":
                cur.execute(f"""
                    SELECT id, name, phone, uis_phone FROM {SCHEMA}.users
                    WHERE removed_at IS NULL AND (id=%s OR (company_id=%s AND role='manager'))
                    ORDER BY (id=%s) DESC, name
                """, (owner_id, owner_id, owner_id))
                rows = cur.fetchall()
                return ok({"employees": [
                    {"id": r[0], "name": r[1], "phone": r[2], "uis_phone": r[3]} for r in rows
                ]})

            if method == "POST":
                user_id = body.get("user_id")
                uis_phone_val = (body.get("uis_phone") or "").strip() or None
                if not user_id:
                    return err("user_id required")
                cur.execute(f"""
                    UPDATE {SCHEMA}.users SET uis_phone=%s
                    WHERE id=%s AND (id=%s OR company_id=%s)
                    RETURNING id
                """, (uis_phone_val, int(user_id), owner_id, owner_id))
                updated = cur.fetchone()
                if not updated:
                    return err("Сотрудник не найден", 404)
                conn.commit()
                return ok({"ok": True})

            return err("unknown method")

        # ── TRANSCRIBE-CALL: расшифровка записи звонка по требованию ───────────────
        # Не делаем это внутри uis-webhook — вебхук должен отвечать быстро (см.
        # комментарий там же), а скачивание + распознавание могут занять больше
        # времени, чем таймаут функции. Вызывается фронтом при открытии ленты
        # касаний (см. useAutoTranscribe.ts).
        if resource == "transcribe-call" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            touch_id = body.get("touch_id")
            if not touch_id:
                return err("touch_id required")

            cur.execute(f"""
                SELECT te.id, te.audio_url, te.text, te.channel
                FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id=te.client_id
                WHERE te.id=%s AND tc.company_id=%s
            """, (touch_id, owner_id))
            row = cur.fetchone()
            if not row:
                return err("звонок не найден", 404)
            _, audio_url, existing_text, channel = row
            if channel != "call":
                return err("это касание не звонок", 400)
            if existing_text:
                return ok({"touch_id": touch_id, "text": existing_text, "cached": True})
            if not audio_url:
                return err("нет записи звонка", 400)

            deepgram_key = os.environ.get("DEEPGRAM_API_KEY", "")
            if not deepgram_key:
                return err("Транскрибация недоступна — нет ключа", 500)

            cur.execute(f"UPDATE {SCHEMA}.touch_events SET status='transcribing' WHERE id=%s", (touch_id,))
            conn.commit()

            try:
                areq = _ureq.Request(audio_url, method="GET")
                with _ureq.urlopen(areq, timeout=20) as r:
                    audio_bytes = r.read()
            except Exception as e:
                cur.execute(f"UPDATE {SCHEMA}.touch_events SET status='received' WHERE id=%s", (touch_id,))
                conn.commit()
                return err(f"Не удалось скачать запись: {str(e)[:150]}", 502)

            try:
                dreq = _ureq.Request(
                    "https://api.deepgram.com/v1/listen?model=nova-2&language=ru&punctuate=true",
                    data=audio_bytes,
                    headers={"Authorization": f"Token {deepgram_key}", "Content-Type": "audio/mpeg"},
                    method="POST")
                with _ureq.urlopen(dreq, timeout=25) as r:
                    dg_resp = json.loads(r.read().decode())
                text = dg_resp.get("results", {}).get("channels", [{}])[0] \
                    .get("alternatives", [{}])[0].get("transcript", "")
            except Exception as e:
                cur.execute(f"UPDATE {SCHEMA}.touch_events SET status='received' WHERE id=%s", (touch_id,))
                conn.commit()
                return err(f"Ошибка транскрибации: {str(e)[:150]}", 502)

            cur.execute(f"UPDATE {SCHEMA}.touch_events SET text=%s, status='received' WHERE id=%s", (text, touch_id))
            cur.execute(f"SELECT id FROM {SCHEMA}.touch_call_transcripts WHERE touch_id=%s", (touch_id,))
            trow = cur.fetchone()
            if trow:
                cur.execute(f"UPDATE {SCHEMA}.touch_call_transcripts SET full_text=%s WHERE touch_id=%s",
                            (text, touch_id))
            else:
                cur.execute(f"INSERT INTO {SCHEMA}.touch_call_transcripts (touch_id, full_text) VALUES (%s, %s)",
                            (touch_id, text))
            conn.commit()

            return ok({"touch_id": touch_id, "text": text})

        # ── SEND-MESSAGE: сотрудник отправляет ответ клиенту из вкладки «Касания» ───
        # Кладёт сообщение в ленту со статусом 'pending' — воркер на VPS заберёт его
        # через pending-messages (опрос) и подтвердит через mark-sent.
        if resource == "send-message" and method == "POST":
            if not authenticated:
                return err("Требуется авторизация", 401)
            owner_id = company_id or master_uid
            if not owner_id:
                return err("company not resolved", 400)

            client_id = body.get("client_id")
            phone_q   = body.get("phone")
            channel   = body.get("channel")
            text      = (body.get("text") or "").strip()
            if not channel or not text:
                return err("channel и text обязательны")
            if channel not in ("telegram", "max", "avito", "whatsapp"):
                return err("unknown channel")

            if client_id:
                cur.execute(
                    f"SELECT id, channel_ids FROM {SCHEMA}.touch_clients WHERE id=%s AND company_id=%s",
                    (client_id, owner_id))
            elif phone_q:
                norm = normalize_phone(phone_q)
                if not norm:
                    return err("phone invalid")
                cur.execute(
                    f"SELECT id, channel_ids FROM {SCHEMA}.touch_clients WHERE phone=%s AND company_id=%s",
                    (norm, owner_id))
            else:
                return err("client_id или phone обязателен")
            cli = cur.fetchone()
            if not cli:
                return err("client not found", 404)
            client_id, channel_ids = cli[0], (cli[1] or {})

            external_chat_id = channel_ids.get(channel)
            if not external_chat_id:
                return err(f"нет привязки к каналу «{channel}» — клиент ещё не писал через него", 400)

            # Avito отправляется СРАЗУ через API (без воркера), Telegram/MAX — через
            # очередь pending (их заберёт воркер на VPS).
            initial_status = "pending"
            out_external_id = None  # id сообщения в канале (заполняем для Avito — защита от дублей)
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
                INSERT INTO {SCHEMA}.touch_events (client_id, channel, direction, external_id, text, status)
                VALUES (%s, %s, 'out', %s, %s, %s)
                RETURNING id, created_at
            """, (client_id, channel, out_external_id, text, initial_status))
            new_row = cur.fetchone()
            conn.commit()

            return ok({
                "touch_id": new_row[0],
                "created_at": new_row[1],
                "status": initial_status,
            })

        # ── PENDING-MESSAGES: воркер на VPS опрашивает — есть что отправить? ───────
        # Тот же секретный ключ, что и channel-webhook (без сессии сотрудника).
        if resource == "pending-messages" and method == "GET":
            company_id_q = qs.get("company_id")
            webhook_key  = (event.get("headers") or {}).get("X-Webhook-Key", "")
            channel_q    = qs.get("channel")
            if not company_id_q or not webhook_key or not channel_q:
                return err("company_id, channel и X-Webhook-Key обязательны", 401)
            try:
                owner_id = int(company_id_q)
            except ValueError:
                return err("company_id invalid")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else None
            if not cfg or cfg.get("_channel_webhook_key") != webhook_key:
                return err("неверный ключ", 401)

            cur.execute(f"""
                SELECT te.id, te.client_id, te.text, tc.channel_ids
                FROM {SCHEMA}.touch_events te
                JOIN {SCHEMA}.touch_clients tc ON tc.id = te.client_id
                WHERE tc.company_id=%s AND te.channel=%s AND te.direction='out' AND te.status='pending'
                ORDER BY te.created_at ASC
                LIMIT 20
            """, (owner_id, channel_q))
            items = []
            for touch_id, cid, text, channel_ids in cur.fetchall():
                external_chat_id = (channel_ids or {}).get(channel_q)
                if not external_chat_id:
                    continue
                items.append({
                    "touch_id": touch_id,
                    "client_id": cid,
                    "external_chat_id": external_chat_id,
                    "text": text,
                })
            return ok({"messages": items})

        # ── MARK-SENT: воркер подтверждает — сообщение реально ушло (или ошибка) ───
        if resource == "mark-sent" and method == "POST":
            company_id_q = qs.get("company_id")
            webhook_key  = (event.get("headers") or {}).get("X-Webhook-Key", "")
            if not company_id_q or not webhook_key:
                return err("company_id и X-Webhook-Key обязательны", 401)
            try:
                owner_id = int(company_id_q)
            except ValueError:
                return err("company_id invalid")

            cur.execute(f"SELECT config FROM {SCHEMA}.integrations WHERE company_id=%s", (owner_id,))
            row = cur.fetchone()
            cfg = row[0] if row else None
            if not cfg or cfg.get("_channel_webhook_key") != webhook_key:
                return err("неверный ключ", 401)

            touch_id = body.get("touch_id")
            success  = body.get("success", True)
            if not touch_id:
                return err("touch_id required")

            cur.execute(f"""
                UPDATE {SCHEMA}.touch_events te
                SET status=%s
                FROM {SCHEMA}.touch_clients tc
                WHERE te.id=%s AND te.client_id=tc.id AND tc.company_id=%s
            """, ("sent" if success else "error", touch_id, owner_id))
            conn.commit()
            return ok({"updated": True})

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

            cur.execute(f"""
                SELECT tc.id, tc.name, tc.phone, tc.crm_contact_id,
                       tc.interest, tc.stage,
                       le.channel, le.direction, le.text, le.created_at,
                       (SELECT COUNT(*) FROM {SCHEMA}.touch_events te2
                        WHERE te2.client_id = tc.id AND te2.direction = 'in') AS in_count,
                       tc.pinned, tc.favorite,
                       lc.source, lc.avito_chat_url, tc.last_read_at
                FROM {SCHEMA}.touch_clients tc
                JOIN LATERAL (
                    SELECT channel, direction, text, created_at
                    FROM {SCHEMA}.touch_events te
                    WHERE te.client_id = tc.id
                    ORDER BY te.created_at DESC, te.id DESC
                    LIMIT 1
                ) le ON TRUE
                LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = tc.crm_contact_id
                WHERE tc.company_id = %s AND tc.hidden = FALSE
                ORDER BY tc.pinned DESC, le.created_at DESC
                LIMIT 200
            """, (owner_id,))
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