"""Вход через Google / Яндекс / VK / Telegram — использует ту же систему сессий, что и обычный
логин (таблица user_sessions), а не отдельный JWT. Поэтому соц-пользователь получает
точно такой же токен и попадает в тот же личный кабинет."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError

from shared import SCHEMA, ok, err

# =============================================================================
# Провайдеры — URL-ы OAuth
# =============================================================================

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

YANDEX_AUTH_URL = "https://oauth.yandex.ru/authorize"
YANDEX_TOKEN_URL = "https://oauth.yandex.ru/token"
YANDEX_USER_INFO_URL = "https://login.yandex.ru/info"

VK_AUTHORIZE_URL = "https://id.vk.com/authorize"
VK_TOKEN_URL = "https://id.vk.com/oauth2/auth"
VK_USER_INFO_URL = "https://id.vk.com/oauth2/user_info"


# =============================================================================
# HTTP-хелперы
# =============================================================================

def _post_form(url: str, data: dict) -> dict:
    request = Request(
        url,
        data=urlencode(data).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode())
    except HTTPError as e:
        try:
            return json.loads(e.read().decode())
        except json.JSONDecodeError:
            return {"error": "http_error", "error_description": "Provider API request failed"}


def _get_json(url: str, headers: dict) -> dict:
    request = Request(url, headers=headers, method="GET")
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode())


# =============================================================================
# Google
# =============================================================================

def _google_auth_url() -> dict:
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "")
    if not client_id or not redirect_uri:
        return None
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "consent",
    }
    return {"auth_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}", "state": state}


def _google_user_from_code(code: str) -> dict | None:
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "")
    if not client_id or not client_secret:
        return None
    token_data = _post_form(GOOGLE_TOKEN_URL, {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
    })
    if "error" in token_data or not token_data.get("access_token"):
        return None
    info = _get_json(GOOGLE_USER_INFO_URL, {"Authorization": f"Bearer {token_data['access_token']}"})
    return {
        "provider_id": info.get("sub", ""),
        "email": info.get("email", ""),
        "name": info.get("name", ""),
        "avatar_url": info.get("picture", ""),
    }


# =============================================================================
# Яндекс
# =============================================================================

def _yandex_auth_url() -> dict:
    client_id = os.environ.get("YANDEX_CLIENT_ID", "")
    redirect_uri = os.environ.get("YANDEX_REDIRECT_URI", "")
    if not client_id or not redirect_uri:
        return None
    state = secrets.token_urlsafe(16)
    params = {"client_id": client_id, "redirect_uri": redirect_uri, "response_type": "code", "state": state}
    return {"auth_url": f"{YANDEX_AUTH_URL}?{urlencode(params)}", "state": state}


def _yandex_user_from_code(code: str) -> dict | None:
    client_id = os.environ.get("YANDEX_CLIENT_ID", "")
    client_secret = os.environ.get("YANDEX_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return None
    token_data = _post_form(YANDEX_TOKEN_URL, {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
    })
    if "error" in token_data or not token_data.get("access_token"):
        return None
    info = _get_json(YANDEX_USER_INFO_URL, {
        "Authorization": f"OAuth {token_data['access_token']}",
        "Content-Type": "application/json",
    })
    real_name = info.get("real_name") or info.get("display_name") or info.get("login", "")
    avatar_id = info.get("default_avatar_id")
    avatar_url = f"https://avatars.yandex.net/get-yapic/{avatar_id}/islands-200" if avatar_id else ""
    return {
        "provider_id": str(info.get("id", "")),
        "email": info.get("default_email", ""),
        "name": real_name,
        "avatar_url": avatar_url,
    }


# =============================================================================
# VK (PKCE) — code_verifier хранится на клиенте и присылается вместе с code
# =============================================================================

def _vk_auth_url() -> dict:
    client_id = os.environ.get("VK_CLIENT_ID", "")
    redirect_uri = os.environ.get("VK_REDIRECT_URI", "")
    if not client_id or not redirect_uri:
        return None
    state = secrets.token_urlsafe(16)
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("utf-8").rstrip("=")
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode("utf-8")).digest()
    ).decode("utf-8").rstrip("=")
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "email",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return {"auth_url": f"{VK_AUTHORIZE_URL}?{urlencode(params)}", "state": state, "code_verifier": code_verifier}


def _vk_user_from_code(code: str, code_verifier: str, device_id: str) -> dict | None:
    client_id = os.environ.get("VK_CLIENT_ID", "")
    client_secret = os.environ.get("VK_CLIENT_SECRET", "")
    redirect_uri = os.environ.get("VK_REDIRECT_URI", "")
    if not client_id or not client_secret or not code_verifier:
        return None
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
        "code_verifier": code_verifier,
    }
    if device_id:
        data["device_id"] = device_id
    token_data = _post_form(VK_TOKEN_URL, data)
    if "error" in token_data or not token_data.get("access_token"):
        return None
    info_data = _post_form(VK_USER_INFO_URL, {"access_token": token_data["access_token"], "client_id": client_id})
    info = info_data.get("user", {})
    first_name = info.get("first_name", "")
    last_name = info.get("last_name", "")
    return {
        "provider_id": str(info.get("user_id", info.get("id", ""))),
        "email": info.get("email", ""),
        "name": f"{first_name} {last_name}".strip(),
        "avatar_url": info.get("avatar", ""),
    }


# =============================================================================
# Telegram Login Widget — проверка подписи данных
# =============================================================================

def _telegram_check_auth(data: dict) -> dict | None:
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return None
    received_hash = data.get("hash", "")
    if not received_hash:
        return None

    check_fields = {k: v for k, v in data.items() if k != "hash" and v is not None}
    data_check_string = "\n".join(f"{k}={check_fields[k]}" for k in sorted(check_fields.keys()))

    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    auth_date = int(data.get("auth_date", 0))
    if time.time() - auth_date > 86400:
        return None

    first_name = data.get("first_name", "")
    last_name = data.get("last_name", "")
    return {
        "provider_id": str(data.get("id", "")),
        "email": "",
        "name": f"{first_name} {last_name}".strip(),
        "avatar_url": data.get("photo_url", ""),
    }


# =============================================================================
# Общая логика: найти/создать пользователя и выдать такую же сессию, как при обычном логине
# =============================================================================

PROVIDER_FIELD = {"google": "google_id", "yandex": "yandex_id", "vk": "vk_id", "telegram": "telegram_id"}


def _login_or_create(cur, conn, provider: str, social: dict) -> dict:
    field = PROVIDER_FIELD[provider]
    provider_id = social["provider_id"]
    email = (social.get("email") or "").strip().lower()
    name = social.get("name") or ""
    avatar_url = social.get("avatar_url") or ""

    # 1. Поиск по provider_id
    cur.execute(f"SELECT id, name, email, role, approved, discount, role_selected FROM {SCHEMA}.users WHERE {field}=%s", (provider_id,))
    row = cur.fetchone()

    if row:
        user_id, db_name, db_email, role, approved, discount, role_selected = row
        cur.execute(f"UPDATE {SCHEMA}.users SET updated_at=NOW() WHERE id=%s", (user_id,))
    else:
        # 2. Поиск по email — привязка провайдера к существующему аккаунту
        row = None
        if email:
            cur.execute(f"SELECT id, name, email, role, approved, discount, role_selected FROM {SCHEMA}.users WHERE email=%s", (email,))
            row = cur.fetchone()

        if row:
            user_id, db_name, db_email, role, approved, discount, role_selected = row
            cur.execute(
                f"UPDATE {SCHEMA}.users SET {field}=%s, avatar_url=COALESCE(avatar_url,%s), updated_at=NOW() WHERE id=%s",
                (provider_id, avatar_url, user_id)
            )
        else:
            # 3. Новый пользователь — сразу approved=True, роль client, но требуем выбрать роль (role_selected=FALSE)
            cur.execute(
                f"""INSERT INTO {SCHEMA}.users
                    (email, password_hash, name, {field}, avatar_url, role, approved, discount, role_selected)
                    VALUES (%s, '', %s, %s, %s, 'client', TRUE, 0, FALSE)
                    RETURNING id""",
                (email or None, name, provider_id, avatar_url)
            )
            user_id = cur.fetchone()[0]
            db_name, db_email, role, approved, discount, role_selected = name, email, "client", True, 0, False

    new_token = secrets.token_hex(32)
    cur.execute(f"INSERT INTO {SCHEMA}.user_sessions (user_id, token) VALUES (%s,%s)", (user_id, new_token))
    conn.commit()

    return {
        "token": new_token,
        "user": {
            "id": user_id, "email": db_email, "name": db_name,
            "role": role, "approved": approved, "discount": discount or 0,
            "role_selected": bool(role_selected),
        },
    }


# =============================================================================
# Роутер
# =============================================================================

def handle(action, method, params, body, token, event, conn, cur):
    if action == "google-auth-url" and method == "GET":
        data = _google_auth_url()
        return ok(data) if data else err("Google авторизация не настроена", 500)

    if action == "google-callback" and method == "POST":
        code = body.get("code", "")
        if not code:
            return err("Код авторизации обязателен")
        social = _google_user_from_code(code)
        if not social:
            return err("Не удалось получить данные от Google")
        return ok(_login_or_create(cur, conn, "google", social))

    if action == "yandex-auth-url" and method == "GET":
        data = _yandex_auth_url()
        return ok(data) if data else err("Яндекс авторизация не настроена", 500)

    if action == "yandex-callback" and method == "POST":
        code = body.get("code", "")
        if not code:
            return err("Код авторизации обязателен")
        social = _yandex_user_from_code(code)
        if not social:
            return err("Не удалось получить данные от Яндекс")
        return ok(_login_or_create(cur, conn, "yandex", social))

    if action == "vk-auth-url" and method == "GET":
        data = _vk_auth_url()
        return ok(data) if data else err("VK авторизация не настроена", 500)

    if action == "vk-callback" and method == "POST":
        code = body.get("code", "")
        code_verifier = body.get("code_verifier", "")
        device_id = body.get("device_id", "")
        if not code or not code_verifier:
            return err("Код авторизации и code_verifier обязательны")
        social = _vk_user_from_code(code, code_verifier, device_id)
        if not social:
            return err("Не удалось получить данные от VK")
        return ok(_login_or_create(cur, conn, "vk", social))

    if action == "telegram-bot-id" and method == "GET":
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        if not bot_token or ":" not in bot_token:
            return err("Telegram авторизация не настроена", 500)
        return ok({"bot_id": bot_token.split(":")[0]})

    if action == "telegram-callback" and method == "POST":
        social = _telegram_check_auth(body)
        if not social:
            return err("Не удалось подтвердить данные Telegram")
        return ok(_login_or_create(cur, conn, "telegram", social))

    return None