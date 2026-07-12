import json, os, secrets
import urllib.request
from datetime import datetime, timezone, timedelta
from shared import SCHEMA, BUSINESS_ROLES, DISCOUNT_ROLES, DEFAULT_DISCOUNT, TRIAL_ESTIMATES, TRIAL_DAYS, MASTER_EMAIL, ok, err, hash_password, verify_password, needs_rehash, hash_code
from email_utils import send_verification_code


def handle(action, method, params, body, token, event, conn, cur):

    # ── Регистрация ──────────────────────────────────────────────────────────
    if action == "register" and method == "POST":
        email        = (body.get("email") or "").strip().lower()
        password     = body.get("password") or ""
        name         = (body.get("name") or "").strip()
        phone        = (body.get("phone") or "").strip()
        role         = (body.get("role") or "client").strip()
        company_name = (body.get("company_name") or "").strip() or None
        company_addr = (body.get("company_addr") or "").strip() or None

        if role not in ("client", "designer", "foreman", "installer", "company"):
            role = "client"
        if not email or not password:
            return err("Email и пароль обязательны")
        if len(password) < 6:
            return err("Пароль минимум 6 символов")

        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email=%s", (email,))
        if cur.fetchone():
            return err("Email уже зарегистрирован")

        approved          = True
        discount          = DEFAULT_DISCOUNT if role in DISCOUNT_ROLES else 0
        is_business       = role in BUSINESS_ROLES
        init_balance      = TRIAL_ESTIMATES if is_business else 0
        trial_sql         = f"NOW() + INTERVAL '{TRIAL_DAYS} days'" if is_business else "NULL"
        has_own_agent_val = "TRUE" if is_business else "FALSE"

        cur.execute(
            f"""INSERT INTO {SCHEMA}.users
                (email, password_hash, name, phone, role, approved, discount,
                 estimates_balance, trial_until, has_own_agent, company_name, company_addr)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s, {trial_sql}, {has_own_agent_val}, %s, %s)
                RETURNING id""",
            (email, hash_password(password), name, phone or None, role, approved, discount,
             init_balance, company_name, company_addr)
        )
        user_id = cur.fetchone()[0]
        if is_business:
            cur.execute(
                f"INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, reason) VALUES (%s, %s, 'trial_signup')",
                (user_id, TRIAL_ESTIMATES)
            )

        smtp_configured = bool(os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"))
        if smtp_configured:
            code = f"{secrets.randbelow(1000000):06d}"
            cur.execute(
                f"""INSERT INTO {SCHEMA}.email_verification_tokens (user_id, code_hash, expires_at)
                    VALUES (%s, %s, NOW() + INTERVAL '15 minutes')""",
                (user_id, hash_code(code))
            )
            cur.execute(f"UPDATE {SCHEMA}.users SET email_verified=FALSE WHERE id=%s", (user_id,))
            conn.commit()
            sent = send_verification_code(email, code, name)
            resp = {"email_verification_required": True, "email": email}
            if not sent:
                # SMTP настроен, но отправка не удалась — не блокируем регистрацию
                resp["send_failed"] = True
            return ok(resp)

        new_token = secrets.token_hex(32)
        cur.execute(f"INSERT INTO {SCHEMA}.user_sessions (user_id, token) VALUES (%s,%s)", (user_id, new_token))
        conn.commit()
        return ok({"token": new_token, "user": {
            "id": user_id, "email": email, "name": name,
            "role": role, "approved": True, "discount": discount,
            "has_own_agent": is_business, "trial_until": None,
        }})

    # ── Подтверждение email ──────────────────────────────────────────────────
    if action == "verify-email" and method == "POST":
        email = (body.get("email") or "").strip().lower()
        code  = (body.get("code") or "").strip()
        if not email or not code:
            return err("Укажите email и код")

        cur.execute(f"SELECT id, name, role, approved, discount FROM {SCHEMA}.users WHERE email=%s", (email,))
        row = cur.fetchone()
        if not row:
            return err("Пользователь не найден")
        user_id, name, role, approved, discount = row

        cur.execute(
            f"""SELECT id, code_hash FROM {SCHEMA}.email_verification_tokens
                WHERE user_id=%s AND expires_at > NOW() ORDER BY id DESC LIMIT 1""",
            (user_id,)
        )
        trow = cur.fetchone()
        if not trow or trow[1] != hash_code(code):
            return err("Неверный или истёкший код")

        cur.execute(f"UPDATE {SCHEMA}.users SET email_verified=TRUE WHERE id=%s", (user_id,))
        new_token = secrets.token_hex(32)
        cur.execute(f"INSERT INTO {SCHEMA}.user_sessions (user_id, token) VALUES (%s,%s)", (user_id, new_token))
        conn.commit()
        return ok({"token": new_token, "user": {
            "id": user_id, "email": email, "name": name,
            "role": role, "approved": approved, "discount": discount or 0,
        }})

    # ── Повторная отправка кода подтверждения ────────────────────────────────
    if action == "resend-verification" and method == "POST":
        email = (body.get("email") or "").strip().lower()
        if not email:
            return err("Укажите email")
        cur.execute(f"SELECT id, name, email_verified FROM {SCHEMA}.users WHERE email=%s", (email,))
        row = cur.fetchone()
        if not row:
            return ok({"ok": True})
        user_id, name, email_verified = row
        if email_verified:
            return err("Email уже подтверждён")
        code = f"{secrets.randbelow(1000000):06d}"
        cur.execute(
            f"""INSERT INTO {SCHEMA}.email_verification_tokens (user_id, code_hash, expires_at)
                VALUES (%s, %s, NOW() + INTERVAL '15 minutes')""",
            (user_id, hash_code(code))
        )
        conn.commit()
        send_verification_code(email, code, name)
        return ok({"ok": True})

    # ── Вход ─────────────────────────────────────────────────────────────────
    if action == "login" and method == "POST":
        email    = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""
        if not email or not password:
            return err("Email и пароль обязательны")
        cur.execute(
            f"SELECT id, name, email, role, approved, discount, email_verified, password_hash FROM {SCHEMA}.users WHERE email=%s",
            (email,)
        )
        row = cur.fetchone()
        if not row or not verify_password(password, row[7]):
            return err("Неверный email или пароль")
        user_id, name, email_db, role, approved, discount, email_verified, pwd_hash = row
        if needs_rehash(pwd_hash):
            cur.execute(f"UPDATE {SCHEMA}.users SET password_hash=%s WHERE id=%s", (hash_password(password), user_id))
            conn.commit()
        is_master = (email_db == MASTER_EMAIL)
        if not email_verified and not is_master:
            return ok({"email_verification_required": True, "email": email_db})
        if not approved and not is_master:
            return ok({"pending": True, "role": role})
        new_token = secrets.token_hex(32)
        cur.execute(f"INSERT INTO {SCHEMA}.user_sessions (user_id, token) VALUES (%s,%s)", (user_id, new_token))
        conn.commit()
        return ok({"token": new_token, "user": {
            "id": user_id, "email": email_db, "name": name,
            "role": role, "approved": approved, "discount": discount or 0,
            "is_master": is_master,
        }})

    # ── Профиль ───────────────────────────────────────────────────────────────
    if action == "me" and method == "GET":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone, u.role, u.approved, u.discount,
                   u.company_name, u.company_inn, u.company_addr, u.website, u.telegram,
                   u.estimates_balance, u.trial_until, u.permissions, u.company_id,
                   u.has_own_agent, u.agent_purchased_at,
                   u.bot_name, u.bot_greeting, u.bot_avatar_url, u.brand_logo_url,
                   u.brand_color, u.support_phone, u.support_email, u.max_url,
                   u.working_hours, u.pdf_footer_address, COALESCE(u.telegram_url, u.telegram) AS telegram_url, u.pdf_text_color,
                   u.brand_logo_url_dark, u.brand_logo_orientation, u.pdf_logo_bg,
                   u.bot_avatar_bg, u.kanban_enabled,
                   u.tg_bot_token, u.tg_notify_chat_id,
                   u.max_bot_token, u.max_notify_chat_id,
                   u.nav_config, u.nav_hidden_ids,
                   u.is_demo, u.demo_expires_at, u.role_selected
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)

        (uid, email, name, phone, role, approved, discount, company_name, company_inn,
         company_addr, website, telegram, estimates_balance, trial_until, permissions,
         ucompany_id, has_own_agent, agent_purchased_at,
         bot_name, bot_greeting, bot_avatar_url, brand_logo_url, brand_color,
         support_phone, support_email, max_url, working_hours, pdf_footer_address, telegram_url, pdf_text_color,
         brand_logo_url_dark, brand_logo_orientation, pdf_logo_bg, bot_avatar_bg, kanban_enabled,
         tg_bot_token, tg_notify_chat_id, max_bot_token, max_notify_chat_id,
         nav_config, nav_hidden_ids, is_demo, demo_expires_at, role_selected) = row

        is_master    = (email == MASTER_EMAIL)
        trial_expired = False
        if not is_master and role in BUSINESS_ROLES and trial_until:
            cur.execute(f"SELECT subscription_end FROM {SCHEMA}.users WHERE id=%s", (uid,))
            sub_row = cur.fetchone()
            subscription_end = sub_row[0] if sub_row else None
            now = datetime.utcnow()
            trial_expired_flag = trial_until.replace(tzinfo=None) < now
            has_paid_sub = subscription_end and subscription_end.replace(tzinfo=None) > now
            if trial_expired_flag and not has_paid_sub:
                trial_expired  = True
                approved       = False
                has_own_agent  = False
                cur.execute(f"UPDATE {SCHEMA}.users SET approved=FALSE WHERE id=%s AND approved=TRUE", (uid,))
                conn.commit()

        if is_demo and demo_expires_at:
            now_utc = datetime.utcnow()
            expires = demo_expires_at.replace(tzinfo=None) if demo_expires_at.tzinfo else demo_expires_at
            if expires < now_utc:
                return err("Демо-сессия истекла", 401)

        user_data = {
            "id": uid, "email": email, "name": name, "phone": phone,
            "role": role, "approved": approved, "discount": discount or 0,
            "role_selected": bool(role_selected),
            "company_name": company_name, "company_inn": company_inn, "company_addr": company_addr,
            "website": website, "telegram": telegram,
            "estimates_balance": estimates_balance or 0,
            "trial_until": str(trial_until)[:19] if trial_until else None,
            "trial_expired": trial_expired,
            "permissions": permissions,
            "company_id": ucompany_id,
            "has_own_agent": bool(has_own_agent),
            "agent_purchased_at": str(agent_purchased_at)[:19] if agent_purchased_at else None,
            "is_master": is_master,
            "bot_name": bot_name, "bot_greeting": bot_greeting,
            "bot_avatar_url": bot_avatar_url, "bot_avatar_bg": bot_avatar_bg,
            "brand_logo_url": brand_logo_url, "brand_logo_url_dark": brand_logo_url_dark,
            "brand_logo_orientation": brand_logo_orientation,
            "brand_color": brand_color, "support_phone": support_phone,
            "support_email": support_email, "max_url": max_url,
            "working_hours": working_hours, "pdf_footer_address": pdf_footer_address,
            "telegram_url": telegram_url, "pdf_text_color": pdf_text_color,
            "pdf_logo_bg": pdf_logo_bg,
            "tg_bot_token": tg_bot_token, "tg_notify_chat_id": tg_notify_chat_id,
            "max_bot_token": max_bot_token, "max_notify_chat_id": max_notify_chat_id,
            "nav_config": nav_config, "nav_hidden_ids": nav_hidden_ids,
            "kanban_enabled": bool(kanban_enabled),
            "is_demo": bool(is_demo),
        }
        return ok({"user": user_data, **user_data})

    # ── Выход ─────────────────────────────────────────────────────────────────
    if action == "logout" and method == "POST":
        if token:
            cur.execute(f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE token=%s", (token,))
            conn.commit()
        return ok({"ok": True})

    # ── Обновление профиля ────────────────────────────────────────────────────
    if action == "update-profile" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.id FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        uid = row[0]

        name         = (body.get("name") or "").strip()
        phone        = (body.get("phone") or "").strip()
        company_name = (body.get("company_name") or "").strip()
        company_inn  = (body.get("company_inn") or "").strip()
        company_addr = (body.get("company_addr") or "").strip()
        website      = (body.get("website") or "").strip()
        telegram     = (body.get("telegram") or "").strip()
        new_role     = (body.get("role") or "").strip()

        ALLOWED_ROLES = ("client", "designer", "foreman", "installer", "company")
        if new_role and new_role not in ALLOWED_ROLES:
            return err("Недопустимая роль")

        cur.execute(f"SELECT role, approved FROM {SCHEMA}.users WHERE id=%s", (uid,))
        cur_row = cur.fetchone()
        current_role, _ = cur_row if cur_row else (None, False)

        if new_role and new_role != current_role:
            new_approved = new_role not in BUSINESS_ROLES
            new_discount = DEFAULT_DISCOUNT if new_role in DISCOUNT_ROLES else 0
            cur.execute(f"""
                UPDATE {SCHEMA}.users
                SET name=%s, phone=%s, company_name=%s, company_inn=%s,
                    company_addr=%s, website=%s, telegram=%s,
                    role=%s, approved=%s, discount=%s, role_selected=TRUE, updated_at=NOW()
                WHERE id=%s
            """, (name or None, phone or None, company_name or None, company_inn or None,
                  company_addr or None, website or None, telegram or None,
                  new_role, new_approved, new_discount, uid))
        else:
            cur.execute(f"""
                UPDATE {SCHEMA}.users
                SET name=%s, phone=%s, company_name=%s, company_inn=%s,
                    company_addr=%s, website=%s, telegram=%s, updated_at=NOW()
                WHERE id=%s
            """, (name or None, phone or None, company_name or None, company_inn or None,
                  company_addr or None, website or None, telegram or None, uid))
        conn.commit()
        cur.execute(f"""
            SELECT id, email, name, phone, role, approved, discount,
                   company_name, company_inn, company_addr, website, telegram, role_selected
            FROM {SCHEMA}.users WHERE id=%s
        """, (uid,))
        u = cur.fetchone()
        return ok({"ok": True, "user": {
            "id": u[0], "email": u[1], "name": u[2], "phone": u[3],
            "role": u[4], "approved": u[5], "discount": u[6] or 0,
            "company_name": u[7], "company_inn": u[8], "company_addr": u[9],
            "website": u[10], "telegram": u[11], "role_selected": bool(u[12]),
        }})

    # ── Восстановление пароля ─────────────────────────────────────────────────
    if action == "reset-password" and method == "POST":
        email = (body.get("email") or "").strip().lower()
        if not email:
            return err("Укажите Email")
        cur.execute(f"SELECT id, name FROM {SCHEMA}.users WHERE email=%s", (email,))
        row = cur.fetchone()
        if not row:
            return ok({"ok": True})
        uid, name = row
        new_password = secrets.token_urlsafe(8)
        cur.execute(f"UPDATE {SCHEMA}.users SET password_hash=%s, updated_at=NOW() WHERE id=%s",
                    (hash_password(new_password), uid))
        cur.execute(f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE user_id=%s", (uid,))
        conn.commit()
        tg_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        tg_chat  = os.environ.get("TELEGRAM_OWNER_CHAT_ID", "")
        if tg_token and tg_chat:
            msg = f"🔑 Сброс пароля\nEmail: {email}\nНовый пароль: {new_password}"
            payload = json.dumps({"chat_id": tg_chat, "text": msg}).encode()
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{tg_token}/sendMessage",
                data=payload, headers={"Content-Type": "application/json"}, method="POST"
            )
            try: urllib.request.urlopen(req, timeout=5)
            except: pass
        return ok({"ok": True, "password": new_password})

    # ── Смена пароля ──────────────────────────────────────────────────────────
    if action == "change-password" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        old_password = body.get("old_password") or ""
        new_password = body.get("new_password") or ""
        if not old_password or not new_password:
            return err("Укажите текущий и новый пароль")
        if len(new_password) < 6:
            return err("Новый пароль должен быть не короче 6 символов")
        if old_password == new_password:
            return err("Новый пароль совпадает с текущим")
        cur.execute(f"""
            SELECT u.id, u.password_hash FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        uid, current_hash = row
        if not verify_password(old_password, current_hash):
            return err("Текущий пароль введён неверно")
        cur.execute(f"UPDATE {SCHEMA}.users SET password_hash=%s, updated_at=NOW() WHERE id=%s",
                    (hash_password(new_password), uid))
        cur.execute(f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE user_id=%s AND token<>%s", (uid, token))
        conn.commit()
        return ok({"ok": True})

    # ── Бренд: обновить ───────────────────────────────────────────────────────
    if action == "update-brand" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.id, u.role, u.has_own_agent, u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        uid, urole, has_agent, uemail = row
        is_master = (uemail == MASTER_EMAIL)
        if not is_master and (urole != "company" or not has_agent):
            return err("Брендинг доступен только компаниям с активированным «Свой агент»", 403)

        ALLOWED = [
            "bot_name", "bot_greeting", "bot_avatar_url", "bot_avatar_bg",
            "brand_logo_url", "brand_color", "support_phone", "support_email", "max_url",
            "working_hours", "pdf_footer_address", "telegram_url", "pdf_text_color",
            "brand_logo_url_dark", "brand_logo_orientation", "pdf_logo_bg",
            "tg_bot_token", "tg_notify_chat_id", "max_bot_token", "max_notify_chat_id",
            "nav_config", "nav_hidden_ids",
        ]
        JSON_FIELDS = {"nav_config", "nav_hidden_ids"}
        sets, vals = [], []
        for k in ALLOWED:
            if k in body:
                v = body.get(k)
                if k in JSON_FIELDS:
                    v = json.dumps(v, ensure_ascii=False) if v is not None else None
                elif isinstance(v, str):
                    v = v.strip() or None
                sets.append(f"{k}=%s")
                vals.append(v)
        if not sets:
            return err("Нет полей для обновления")
        vals.append(uid)
        cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(sets)}, updated_at=NOW() WHERE id=%s", tuple(vals))
        conn.commit()
        return ok({"ok": True})

    # ── Бренд: получить ───────────────────────────────────────────────────────
    if action == "get-brand" and method == "GET":
        company_id = params.get("company_id")
        if company_id:
            cur.execute(f"""
                SELECT id, bot_name, bot_greeting, bot_avatar_url, bot_avatar_bg,
                       brand_logo_url, brand_logo_url_dark, brand_logo_orientation,
                       brand_color, support_phone, support_email, max_url,
                       working_hours, pdf_footer_address, COALESCE(telegram_url, telegram) AS telegram_url,
                       pdf_text_color, pdf_logo_bg, nav_config, nav_hidden_ids, company_name
                FROM {SCHEMA}.users WHERE id=%s
            """, (int(company_id),))
        elif token:
            cur.execute(f"""
                SELECT u.id, u.bot_name, u.bot_greeting, u.bot_avatar_url, u.bot_avatar_bg,
                       u.brand_logo_url, u.brand_logo_url_dark, u.brand_logo_orientation,
                       u.brand_color, u.support_phone, u.support_email, u.max_url,
                       u.working_hours, u.pdf_footer_address, COALESCE(u.telegram_url, u.telegram) AS telegram_url,
                       u.pdf_text_color, u.pdf_logo_bg, u.nav_config, u.nav_hidden_ids, u.company_name
                FROM {SCHEMA}.user_sessions s
                JOIN {SCHEMA}.users u ON u.id = s.user_id
                WHERE s.token=%s AND s.expires_at > NOW()
            """, (token,))
        else:
            return err("company_id или токен обязателен")
        row = cur.fetchone()
        if not row:
            return err("Не найдено", 404)
        return ok({
            "id": row[0], "bot_name": row[1], "bot_greeting": row[2],
            "bot_avatar_url": row[3], "bot_avatar_bg": row[4],
            "brand_logo_url": row[5], "brand_logo_url_dark": row[6],
            "brand_logo_orientation": row[7], "brand_color": row[8],
            "support_phone": row[9], "support_email": row[10], "max_url": row[11],
            "working_hours": row[12], "pdf_footer_address": row[13],
            "telegram_url": row[14], "pdf_text_color": row[15], "pdf_logo_bg": row[16],
            "nav_config": row[17], "nav_hidden_ids": row[18], "company_name": row[19],
        })

    # ── Флаг канбана ──────────────────────────────────────────────────────────
    if action == "set-kanban" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.id FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        uid     = row[0]
        enabled = bool(body.get("enabled", False))
        cur.execute(f"UPDATE {SCHEMA}.users SET kanban_enabled=%s WHERE id=%s", (enabled, uid))
        conn.commit()
        return ok({"ok": True, "kanban_enabled": enabled})

    return None