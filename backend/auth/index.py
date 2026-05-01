import json, os, hashlib, secrets, psycopg2, base64
import urllib.request as _ureq
import boto3
from datetime import datetime

SCHEMA = os.environ.get("DB_SCHEMA", "t_p45929761_bold_move_project")

BUSINESS_ROLES = ("installer", "company")
DISCOUNT_ROLES = ("designer", "foreman")
DEFAULT_DISCOUNT = 10  # % для designer/foreman
TRIAL_ESTIMATES = 20   # бесплатный пакет при регистрации
TRIAL_DAYS      = 4    # срок действия триала

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

def handler(event: dict, context) -> dict:
    """Авторизация: register / login / me / logout / approve-user / pending-users / set-discount"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
            "Access-Control-Max-Age": "86400",
        }, "body": ""}

    method   = event.get("httpMethod", "GET")
    params   = event.get("queryStringParameters") or {}
    action   = params.get("action", "")
    body_raw = event.get("body") or "{}"
    body     = json.loads(body_raw) if body_raw else {}

    headers   = event.get("headers") or {}
    raw_token = headers.get("X-Authorization") or headers.get("Authorization") or ""
    token     = raw_token.replace("Bearer ", "").strip()

    conn = get_conn()
    cur  = conn.cursor()

    # ── Регистрация ──────────────────────────────────────────────────────────
    if action == "register" and method == "POST":
        email    = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""
        name     = (body.get("name") or "").strip()
        phone    = (body.get("phone") or "").strip()
        role     = (body.get("role") or "client").strip()

        if role not in ("client", "designer", "foreman", "installer", "company"):
            role = "client"

        if not email or not password:
            return err("Email и пароль обязательны")
        if len(password) < 6:
            return err("Пароль минимум 6 символов")

        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email=%s", (email,))
        if cur.fetchone():
            return err("Email уже зарегистрирован")

        # Бизнес-роли ждут одобрения; клиенты/дизайнеры/прорабы — сразу approved
        approved = role not in BUSINESS_ROLES
        discount = DEFAULT_DISCOUNT if role in DISCOUNT_ROLES else 0

        # Триал для бизнес-ролей: TRIAL_ESTIMATES смет на TRIAL_DAYS дней
        is_business = role in BUSINESS_ROLES
        init_balance = TRIAL_ESTIMATES if is_business else 0
        trial_sql    = f"NOW() + INTERVAL '{TRIAL_DAYS} days'" if is_business else "NULL"

        cur.execute(
            f"""INSERT INTO {SCHEMA}.users
                (email, password_hash, name, phone, role, approved, discount, estimates_balance, trial_until)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s, {trial_sql})
                RETURNING id""",
            (email, hash_password(password), name, phone or None, role, approved, discount, init_balance)
        )
        user_id = cur.fetchone()[0]

        if is_business:
            cur.execute(
                f"INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, reason) VALUES (%s, %s, 'trial_signup')",
                (user_id, TRIAL_ESTIMATES)
            )

        if approved:
            new_token = secrets.token_hex(32)
            cur.execute(
                f"INSERT INTO {SCHEMA}.user_sessions (user_id, token) VALUES (%s,%s)",
                (user_id, new_token)
            )
            conn.commit()
            return ok({"token": new_token, "user": {
                "id": user_id, "email": email, "name": name,
                "role": role, "approved": True, "discount": discount,
            }})
        else:
            conn.commit()
            return ok({"pending": True, "role": role})

    # ── Вход ─────────────────────────────────────────────────────────────────
    if action == "login" and method == "POST":
        email    = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""

        if not email or not password:
            return err("Email и пароль обязательны")

        cur.execute(
            f"SELECT id, name, email, role, approved, discount FROM {SCHEMA}.users WHERE email=%s AND password_hash=%s",
            (email, hash_password(password))
        )
        row = cur.fetchone()
        if not row:
            return err("Неверный email или пароль")

        user_id, name, email_db, role, approved, discount = row
        is_master = (email_db == "19.jeka.94@gmail.com")

        if not approved and not is_master:
            return ok({"pending": True, "role": role})

        new_token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {SCHEMA}.user_sessions (user_id, token) VALUES (%s,%s)",
            (user_id, new_token)
        )
        conn.commit()
        return ok({"token": new_token, "user": {
            "id": user_id, "email": email_db, "name": name,
            "role": role, "approved": approved, "discount": discount or 0,
            "is_master": is_master,
        }})

    # ── Профиль (проверка токена) ─────────────────────────────────────────────
    if action == "me" and method == "GET":
        if not token:
            return err("Требуется авторизация", 401)

        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone, u.role, u.approved, u.discount,
                   u.company_name, u.company_inn, u.company_addr, u.website, u.telegram,
                   u.estimates_balance, u.trial_until, u.permissions, u.company_id,
                   u.has_own_agent,
                   u.bot_name, u.bot_greeting, u.bot_avatar_url, u.brand_logo_url,
                   u.brand_color, u.support_phone, u.support_email, u.max_url,
                   u.working_hours, u.pdf_footer_address, u.telegram_url, u.pdf_text_color,
                   u.brand_logo_url_dark, u.brand_logo_orientation, u.pdf_logo_bg,
                   u.bot_avatar_bg
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)

        (uid, email, name, phone, role, approved, discount, company_name, company_inn,
         company_addr, website, telegram, estimates_balance, trial_until, permissions,
         ucompany_id, has_own_agent,
         bot_name, bot_greeting, bot_avatar_url, brand_logo_url, brand_color,
         support_phone, support_email, max_url, working_hours, pdf_footer_address, telegram_url, pdf_text_color,
         brand_logo_url_dark, brand_logo_orientation, pdf_logo_bg, bot_avatar_bg) = row

        return ok({"user": {
            "id": uid, "email": email, "name": name, "phone": phone,
            "role": role or "client", "approved": approved, "discount": discount or 0,
            "is_master": (email == "19.jeka.94@gmail.com"),
            "company_name": company_name, "company_inn": company_inn,
            "company_addr": company_addr, "website": website, "telegram": telegram,
            "estimates_balance": estimates_balance or 0,
            "trial_until": str(trial_until)[:19] if trial_until else None,
            "permissions": permissions,
            "company_id": ucompany_id,
            "has_own_agent": bool(has_own_agent),
            "brand": {
                "bot_name": bot_name, "bot_greeting": bot_greeting,
                "bot_avatar_url": bot_avatar_url,
                "brand_logo_url": brand_logo_url, "brand_color": brand_color,
                "support_phone": support_phone, "support_email": support_email,
                "max_url": max_url, "working_hours": working_hours,
                "pdf_footer_address": pdf_footer_address,
                "telegram_url": telegram_url,
                "pdf_text_color": pdf_text_color,
                "brand_logo_url_dark":    brand_logo_url_dark,
                "brand_logo_orientation": brand_logo_orientation or "horizontal",
                "pdf_logo_bg":            pdf_logo_bg or "auto",
                "bot_avatar_bg":          bot_avatar_bg or "transparent",
            },
        }})

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

        # Читаем текущую роль и approved из БД
        cur.execute(f"SELECT role, approved FROM {SCHEMA}.users WHERE id=%s", (uid,))
        cur_row = cur.fetchone()
        current_role, current_approved = cur_row if cur_row else (None, False)

        # Сбрасываем approved ТОЛЬКО если роль реально изменилась
        if new_role and new_role != current_role:
            new_approved = new_role not in BUSINESS_ROLES
            new_discount = DEFAULT_DISCOUNT if new_role in DISCOUNT_ROLES else 0
            cur.execute(f"""
                UPDATE {SCHEMA}.users
                SET name=%s, phone=%s, company_name=%s, company_inn=%s,
                    company_addr=%s, website=%s, telegram=%s,
                    role=%s, approved=%s, discount=%s, updated_at=NOW()
                WHERE id=%s
            """, (name or None, phone or None, company_name or None, company_inn or None,
                  company_addr or None, website or None, telegram or None,
                  new_role, new_approved, new_discount, uid))
        else:
            # Роль не изменилась — обновляем только данные профиля, approved не трогаем
            cur.execute(f"""
                UPDATE {SCHEMA}.users
                SET name=%s, phone=%s, company_name=%s, company_inn=%s,
                    company_addr=%s, website=%s, telegram=%s, updated_at=NOW()
                WHERE id=%s
            """, (name or None, phone or None, company_name or None, company_inn or None,
                  company_addr or None, website or None, telegram or None, uid))

        conn.commit()

        # Возвращаем обновлённые данные пользователя
        cur.execute(f"""
            SELECT id, email, name, phone, role, approved, discount,
                   company_name, company_inn, company_addr, website, telegram
            FROM {SCHEMA}.users WHERE id=%s
        """, (uid,))
        u = cur.fetchone()
        return ok({"ok": True, "user": {
            "id": u[0], "email": u[1], "name": u[2], "phone": u[3],
            "role": u[4], "approved": u[5], "discount": u[6] or 0,
            "company_name": u[7], "company_inn": u[8], "company_addr": u[9],
            "website": u[10], "telegram": u[11],
        }})

    # ── Восстановление пароля ────────────────────────────────────────────────
    if action == "reset-password" and method == "POST":
        email = (body.get("email") or "").strip().lower()
        if not email:
            return err("Укажите Email")
        cur.execute(f"SELECT id, name FROM {SCHEMA}.users WHERE email=%s", (email,))
        row = cur.fetchone()
        if not row:
            return ok({"ok": True})  # не раскрываем что email не найден
        uid, name = row

        new_password = secrets.token_urlsafe(8)
        cur.execute(f"UPDATE {SCHEMA}.users SET password_hash=%s, updated_at=NOW() WHERE id=%s",
                    (hash_password(new_password), uid))
        cur.execute(f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE user_id=%s", (uid,))
        conn.commit()

        import urllib.request
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
            SELECT u.id, u.password_hash
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        uid, current_hash = row

        if current_hash != hash_password(old_password):
            return err("Текущий пароль введён неверно")

        cur.execute(
            f"UPDATE {SCHEMA}.users SET password_hash=%s, updated_at=NOW() WHERE id=%s",
            (hash_password(new_password), uid)
        )
        # Все остальные сессии — деактивируем (текущая остаётся живой)
        cur.execute(
            f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE user_id=%s AND token<>%s",
            (uid, token)
        )
        conn.commit()
        return ok({"ok": True})

    # ── Бренд: обновить (только владелец-company с активированным "Свой агент") ─
    if action == "update-brand" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.id, u.role, u.has_own_agent, u.email
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        uid, urole, has_agent, uemail = row
        is_master = (uemail == "19.jeka.94@gmail.com")
        if not is_master and (urole != "company" or not has_agent):
            return err("Брендинг доступен только компаниям с активированным «Свой агент»", 403)

        # Обновляем только переданные поля (NULL допустим — обнуляет)
        ALLOWED = [
            "bot_name", "bot_greeting", "bot_avatar_url", "bot_avatar_bg",
            "brand_logo_url", "brand_color",
            "support_phone", "support_email", "max_url",
            "working_hours", "pdf_footer_address", "telegram_url", "pdf_text_color",
            "brand_logo_url_dark", "brand_logo_orientation", "pdf_logo_bg",
        ]
        sets = []
        vals = []
        for k in ALLOWED:
            if k in body:
                v = body.get(k)
                if isinstance(v, str):
                    v = v.strip() or None
                sets.append(f"{k}=%s")
                vals.append(v)
        if not sets:
            return err("Нет полей для обновления")
        vals.append(uid)
        cur.execute(
            f"UPDATE {SCHEMA}.users SET {', '.join(sets)}, updated_at=NOW() WHERE id=%s",
            tuple(vals)
        )
        conn.commit()
        return ok({"ok": True})

    # ── Бренд: получить публично по ?company_id=  (для подмены на главной) ────
    if action == "get-brand" and method == "GET":
        company_id = params.get("company_id")
        if not company_id:
            return err("company_id обязателен")
        cur.execute(f"""
            SELECT id, role, has_own_agent,
                   bot_name, bot_greeting, bot_avatar_url, brand_logo_url, brand_color,
                   support_phone, support_email, max_url, working_hours,
                   pdf_footer_address, company_name, telegram, website, telegram_url, pdf_text_color,
                   brand_logo_url_dark, brand_logo_orientation, pdf_logo_bg
            FROM {SCHEMA}.users
            WHERE id=%s AND removed_at IS NULL
        """, (int(company_id),))
        r = cur.fetchone()
        if not r:
            return err("Компания не найдена", 404)
        cid, role, has_agent, bot_name, bot_greeting, bot_avatar_url, brand_logo_url, brand_color, \
            support_phone, support_email, max_url, working_hours, pdf_footer_address, \
            company_name, telegram, website, telegram_url, pdf_text_color, \
            brand_logo_url_dark, brand_logo_orientation, pdf_logo_bg = r
        # Если у пользователя нет активной услуги — возвращаем пустой бренд
        if not has_agent or role != "company":
            return ok({"brand": None})
        return ok({"brand": {
            "company_id": cid,
            "company_name": company_name,
            "bot_name": bot_name,
            "bot_greeting": bot_greeting,
            "bot_avatar_url": bot_avatar_url,
            "brand_logo_url": brand_logo_url,
            "brand_color": brand_color,
            "support_phone": support_phone,
            "support_email": support_email,
            "max_url": max_url,
            "telegram": telegram,
            "website": website,
            "working_hours": working_hours,
            "pdf_footer_address": pdf_footer_address,
            "telegram_url": telegram_url,
            "pdf_text_color": pdf_text_color,
            "brand_logo_url_dark":    brand_logo_url_dark,
            "brand_logo_orientation": brand_logo_orientation or "horizontal",
            "pdf_logo_bg":            pdf_logo_bg or "auto",
        }})

    # ── Выход ─────────────────────────────────────────────────────────────────
    if action == "logout" and method == "POST":
        if token:
            cur.execute(f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE token=%s", (token,))
            conn.commit()
        return ok({"ok": True})

    # ── Мастер: список pending-пользователей ──────────────────────────────────
    if action == "pending-users" and method == "GET":
        role_filter = params.get("role_group", "business")
        if role_filter == "business":
            roles = ("installer", "company")
        else:
            roles = ("designer", "foreman")

        cur.execute(f"""
            SELECT id, email, name, phone, role, discount, created_at
            FROM {SCHEMA}.users
            WHERE role = ANY(%s) AND approved = false
            ORDER BY created_at DESC
        """, (list(roles),))
        rows = cur.fetchall()
        return ok({"users": [{
            "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
            "role": r[4], "discount": r[5] or 0, "created_at": str(r[6])[:19],
        } for r in rows]})

    # ── Мастер: список дизайнеров/прорабов (все, включая одобренных) ──────────
    if action == "pro-users" and method == "GET":
        cur.execute(f"""
            SELECT id, email, name, phone, role, approved, discount, created_at
            FROM {SCHEMA}.users
            WHERE role IN ('designer', 'foreman') AND removed_at IS NULL
            ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        return ok({"users": [{
            "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
            "role": r[4], "approved": r[5], "discount": r[6] or 0,
            "created_at": str(r[7])[:19],
        } for r in rows]})

    # ── Мастер: одобрить пользователя ─────────────────────────────────────────
    if action == "approve-user" and method == "POST":
        user_id = body.get("user_id")
        if not user_id:
            return err("user_id required")
        cur.execute(f"UPDATE {SCHEMA}.users SET approved=true, rejected=false WHERE id=%s", (int(user_id),))
        conn.commit()
        return ok({"ok": True})

    # ── Мастер: отклонить пользователя ────────────────────────────────────────
    if action == "reject-user" and method == "POST":
        user_id = body.get("user_id")
        if not user_id:
            return err("user_id required")
        cur.execute(f"UPDATE {SCHEMA}.users SET approved=false, rejected=true WHERE id=%s", (int(user_id),))
        conn.commit()
        return ok({"ok": True})

    # ── Мастер: установить подписку ───────────────────────────────────────────
    if action == "set-subscription" and method == "POST":
        user_id = body.get("user_id")
        days    = body.get("days")  # продлить на N дней от сегодня или от текущего конца
        if user_id is None or days is None:
            return err("user_id и days обязательны")
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET subscription_start = COALESCE(subscription_start, NOW()),
                subscription_end   = GREATEST(COALESCE(subscription_end, NOW()), NOW()) + INTERVAL '%s days',
                approved           = true,
                rejected           = false
            WHERE id = %s
        """, (int(days), int(user_id)))
        conn.commit()
        # Возвращаем новые даты
        cur.execute(f"SELECT subscription_start, subscription_end FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
        row = cur.fetchone()
        return ok({"ok": True, "subscription_start": str(row[0])[:19] if row[0] else None, "subscription_end": str(row[1])[:19] if row[1] else None})

    # ── Мастер: установить скидку пользователю ────────────────────────────────
    if action == "set-discount" and method == "POST":
        user_id  = body.get("user_id")
        discount = body.get("discount")
        if user_id is None or discount is None:
            return err("user_id и discount обязательны")
        cur.execute(f"UPDATE {SCHEMA}.users SET discount=%s WHERE id=%s", (int(discount), int(user_id)))
        conn.commit()
        return ok({"ok": True})

    # ── Мастер: бизнес-пользователи (монтажники/компании) с фильтром ──────────
    if action == "business-users" and method == "GET":
        status_filter = params.get("status", "all")
        if status_filter == "pending":
            where = "WHERE role IN ('installer','company') AND approved=false AND rejected=false AND removed_at IS NULL"
        elif status_filter == "approved":
            where = "WHERE role IN ('installer','company') AND approved=true AND removed_at IS NULL"
        elif status_filter == "rejected":
            where = "WHERE role IN ('installer','company') AND rejected=true AND removed_at IS NULL"
        else:
            where = "WHERE role IN ('installer','company') AND removed_at IS NULL"

        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone, u.role, u.approved, u.rejected, u.discount,
                   u.created_at, u.subscription_start, u.subscription_end, u.estimates_balance,
                   u.has_own_agent, u.agent_purchased_at, u.trial_until,
                   COALESCE(SUM(CASE WHEN bt.amount > 0 THEN bt.amount ELSE 0 END), 0) AS total_bought
            FROM {SCHEMA}.users u
            LEFT JOIN {SCHEMA}.balance_transactions bt ON bt.user_id = u.id
            {where}
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """)
        rows = cur.fetchall()
        return ok({"users": [{
            "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
            "role": r[4], "approved": r[5], "rejected": r[6], "discount": r[7] or 0,
            "created_at":         str(r[8])[:19],
            "subscription_start": str(r[9])[:19]  if r[9]  else None,
            "subscription_end":   str(r[10])[:19] if r[10] else None,
            "estimates_balance":  r[11] or 0,
            "has_own_agent":      bool(r[12]),
            "agent_purchased_at": str(r[13])[:19] if r[13] else None,
            "trial_until":        str(r[14])[:19] if r[14] else None,
            "total_bought":       int(r[15] or 0),
        } for r in rows]})

    # ── История транзакций пользователя ──────────────────────────────────────
    if action == "admin-user-transactions" and method == "GET":
        uid = params.get("user_id")
        if not uid:
            return err("user_id обязателен")
        cur.execute(f"""
            SELECT id, amount, reason, created_at
            FROM {SCHEMA}.balance_transactions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        """, (int(uid),))
        rows = cur.fetchall()
        return ok({"transactions": [{
            "id":         r[0],
            "amount":     r[1],
            "reason":     r[2] or "",
            "created_at": str(r[3])[:19] if r[3] else "",
        } for r in rows]})

    # ── Смета по chat_id ──────────────────────────────────────────────────────
    if action == "estimate-by-chat" and method == "GET":
        chat_id = params.get("chat_id")
        if not chat_id:
            return err("chat_id required")
        cur.execute(f"""
            SELECT id, title, blocks, totals, final_phrase,
                   total_econom, total_standard, total_premium, status, created_at
            FROM {SCHEMA}.saved_estimates WHERE chat_id=%s ORDER BY id DESC LIMIT 1
        """, (int(chat_id),))
        row = cur.fetchone()
        if not row:
            return ok({"estimate": None})
        return ok({"estimate": {
            "id": row[0], "title": row[1],
            "blocks": row[2], "totals": row[3], "final_phrase": row[4],
            "total_econom":   float(row[5]) if row[5] else None,
            "total_standard": float(row[6]) if row[6] else None,
            "total_premium":  float(row[7]) if row[7] else None,
            "status": row[8], "created_at": str(row[9])[:19],
        }})

    # ── Обновить смету ─────────────────────────────────────────────────────────
    if action == "update-estimate" and method == "POST":
        est_id = params.get("id")
        if not est_id:
            return err("id required")
        blocks_new = body.get("blocks", [])
        totals_new = body.get("totals", [])

        import re as _re
        def _extract(keyword):
            for t in totals_new:
                if keyword.lower() in t.lower():
                    nums = _re.findall(r"[\d\s]+", t.replace("\u00a0", " "))
                    cleaned = "".join("".join(nums).split())
                    if cleaned.isdigit():
                        return float(cleaned)
            return None

        cur.execute(f"""
            UPDATE {SCHEMA}.saved_estimates
            SET blocks=%s, totals=%s,
                total_econom=%s, total_standard=%s, total_premium=%s,
                updated_at=NOW()
            WHERE id=%s
        """, (
            json.dumps(blocks_new, ensure_ascii=False),
            json.dumps(totals_new, ensure_ascii=False),
            _extract("econom"), _extract("standard"), _extract("premium"),
            int(est_id),
        ))
        conn.commit()
        return ok({"ok": True})

    # ── Сохранить смету → заявка в CRM ────────────────────────────────────────
    if action == "save-estimate" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)

        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone, u.discount, u.role, u.estimates_balance,
                   u.trial_until, (u.trial_until IS NOT NULL AND u.trial_until < NOW()) AS trial_expired
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        user_id, email, user_name, phone, user_discount, user_role, estimates_balance, trial_until, trial_expired = row

        # Для монтажников/компаний проверяем и списываем баланс
        if user_role in BUSINESS_ROLES:
            if trial_expired:
                return err("Пробный период закончился. Пополните пакет.", 403)
            if (estimates_balance or 0) <= 0:
                return err("Недостаточно смет на балансе. Пополните пакет.", 403)
            cur.execute(f"""
                UPDATE {SCHEMA}.users SET estimates_balance = estimates_balance - 1 WHERE id = %s
            """, (user_id,))
            cur.execute(f"""
                INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, reason)
                VALUES (%s, -1, 'estimate_created')
            """, (user_id,))

        blocks       = body.get("blocks", [])
        totals       = body.get("totals", [])
        final_phrase = body.get("finalPhrase", "")

        def extract_sum(keyword):
            import re
            for t in totals:
                if keyword.lower() in t.lower():
                    nums = re.findall(r"[\d\s]+", t.replace("\u00a0", " "))
                    cleaned = "".join("".join(nums).split())
                    if cleaned.isdigit():
                        return float(cleaned)
            return None

        total_econom   = extract_sum("econom")
        total_standard = extract_sum("standard")
        total_premium  = extract_sum("premium")

        cur.execute(f"""
            INSERT INTO {SCHEMA}.saved_estimates
              (user_id, title, blocks, totals, final_phrase, total_econom, total_standard, total_premium)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id,
            "Смета на натяжные потолки",
            json.dumps(blocks, ensure_ascii=False),
            json.dumps(totals, ensure_ascii=False),
            final_phrase,
            total_econom, total_standard, total_premium,
        ))
        estimate_id = cur.fetchone()[0]

        material_cost_total = 0
        try:
            cur.execute(f"SELECT name, purchase_price FROM {SCHEMA}.ai_prices WHERE active=true AND purchase_price > 0")
            price_map = {row[0].strip().lower(): int(row[1]) for row in cur.fetchall()}
            for block in blocks:
                for item in block.get("items", []):
                    item_name = item.get("name", "").strip().lower()
                    val_str = item.get("value", "")
                    import re as _re
                    nums = _re.findall(r"\d[\d\s]*", str(val_str).replace("\u00a0", " "))
                    qty = int("".join(nums[0].split())) if nums else 1
                    if item_name in price_map:
                        material_cost_total += price_map[item_name] * qty
        except Exception:
            material_cost_total = 0

        import secrets as sec
        session_id = f"estimate-{estimate_id}-{sec.token_hex(6)}"
        cur.execute(f"""
            INSERT INTO {SCHEMA}.live_chats
              (session_id, client_name, phone, status, source, contract_sum, material_cost)
            VALUES (%s, %s, %s, 'new', 'estimate', %s, %s)
            RETURNING id
        """, (
            session_id,
            user_name or email,
            phone or "",
            total_standard,
            material_cost_total if material_cost_total > 0 else None,
        ))
        chat_id = cur.fetchone()[0]

        cur.execute(f"UPDATE {SCHEMA}.saved_estimates SET chat_id=%s WHERE id=%s", (chat_id, estimate_id))
        conn.commit()

        # Читаем актуальный баланс после возможного списания
        cur.execute(f"SELECT estimates_balance FROM {SCHEMA}.users WHERE id=%s", (user_id,))
        new_balance = cur.fetchone()[0] or 0

        return ok({
            "ok": True,
            "estimate_id": estimate_id,
            "chat_id": chat_id,
            "discount": user_discount or 0,
            "estimates_balance": new_balance,
        })

    # ── Список смет пользователя ───────────────────────────────────────────────
    if action == "my-estimates" and method == "GET":
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
        user_id = row[0]

        cur.execute(f"""
            SELECT e.id, e.title, e.total_econom, e.total_standard, e.total_premium,
                   e.status, e.created_at, lc.status as crm_status, lc.id as chat_id,
                   e.blocks, e.totals, e.final_phrase
            FROM {SCHEMA}.saved_estimates e
            LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = e.chat_id
            WHERE e.user_id = %s
            ORDER BY e.created_at DESC
        """, (user_id,))
        rows = cur.fetchall()
        estimates = [{
            "id": r[0], "title": r[1],
            "total_econom": float(r[2]) if r[2] else None,
            "total_standard": float(r[3]) if r[3] else None,
            "total_premium": float(r[4]) if r[4] else None,
            "status": r[5], "created_at": str(r[6])[:19],
            "crm_status": r[7], "chat_id": r[8],
            "blocks": r[9] if r[9] else [],
            "totals": r[10] if r[10] else [],
            "final_phrase": r[11] or "",
        } for r in rows]
        return ok({"estimates": estimates})

    # ── Мастер: список всех пользователей ────────────────────────────────────
    if action == "admin-users" and method == "GET":
        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone, u.role, u.approved, u.discount, u.created_at,
                   COUNT(e.id) as estimates_count, u.rejected, u.subscription_start, u.subscription_end,
                   u.estimates_balance, u.trial_until, u.has_own_agent, u.agent_purchased_at
            FROM {SCHEMA}.users u
            LEFT JOIN {SCHEMA}.saved_estimates e ON e.user_id = u.id
            WHERE u.removed_at IS NULL
            GROUP BY u.id ORDER BY u.created_at DESC
        """)
        rows = cur.fetchall()
        return ok({"users": [{
            "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
            "role": r[4] or "client", "approved": r[5], "discount": r[6] or 0,
            "created_at": str(r[7])[:19], "estimates_count": r[8],
            "rejected": r[9] or False,
            "subscription_start": str(r[10])[:19] if r[10] else None,
            "subscription_end":   str(r[11])[:19] if r[11] else None,
            "estimates_balance":  r[12] or 0,
            "trial_until":        str(r[13])[:19] if r[13] else None,
            "has_own_agent":      bool(r[14]),
            "agent_purchased_at": str(r[15])[:19] if r[15] else None,
        } for r in rows]})

    # ── Мастер: переключить флаг "Свой агент" у компании ─────────────────────
    if action == "admin-toggle-own-agent" and method == "POST":
        # Только мастер
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        user_id = body.get("user_id")
        enable  = bool(body.get("enable"))
        if not user_id:
            return err("user_id обязателен")
        uid = int(user_id)

        if enable:
            cur.execute(f"""
                UPDATE {SCHEMA}.users
                SET has_own_agent=TRUE, agent_purchased_at=COALESCE(agent_purchased_at, NOW())
                WHERE id=%s
            """, (uid,))
        else:
            cur.execute(f"""
                UPDATE {SCHEMA}.users SET has_own_agent=FALSE WHERE id=%s
            """, (uid,))
        conn.commit()
        return ok({"ok": True, "has_own_agent": enable})

    # ── Мастер: войти под любым пользователем (выдать его токен) ─────────────
    if action == "admin-login-as" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        target_id = body.get("user_id")
        if not target_id:
            return err("user_id обязателен")

        # Создаём сессию для целевого пользователя
        import secrets as _sec
        new_token = _sec.token_hex(32)
        cur.execute(f"""
            INSERT INTO {SCHEMA}.user_sessions (user_id, token, expires_at)
            VALUES (%s, %s, NOW() + INTERVAL '8 hours')
        """, (int(target_id), new_token))
        conn.commit()
        return ok({"token": new_token})

    # ── Мастер: проверить и докинуть баланс смет компании ────────────────────
    if action == "admin-ensure-balance" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        target_id = body.get("user_id")
        if not target_id:
            return err("user_id обязателен")

        cur.execute(f"SELECT estimates_balance FROM {SCHEMA}.users WHERE id=%s", (int(target_id),))
        row = cur.fetchone()
        if not row:
            return err("Пользователь не найден", 404)
        balance = row[0] or 0
        added = 0
        min_balance = body.get("min_balance", 5)
        if balance < min_balance:
            added = min_balance - balance
            cur.execute(f"""
                UPDATE {SCHEMA}.users SET estimates_balance = %s WHERE id=%s
            """, (min_balance, int(target_id)))
            cur.execute(f"""
                INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, reason)
                VALUES (%s, %s, 'admin_top_up')
            """, (int(target_id), added))
            conn.commit()
        # Синхронизируем name = company_name если передан флаг
        if body.get("sync_name"):
            cur.execute(f"""
                UPDATE {SCHEMA}.users SET name = company_name
                WHERE id = %s AND company_name IS NOT NULL AND company_name != ''
            """, (int(target_id),))
            conn.commit()
        return ok({"balance_before": balance, "balance_after": max(balance, min_balance), "added": added})

    # ── Мастер: сметы конкретного пользователя ────────────────────────────────
    if action == "admin-user-estimates" and method == "GET":
        user_id = params.get("user_id")
        if not user_id:
            return err("user_id required")
        cur.execute(f"""
            SELECT e.id, e.title, e.total_standard, e.status, e.created_at, lc.status
            FROM {SCHEMA}.saved_estimates e
            LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = e.chat_id
            WHERE e.user_id = %s ORDER BY e.created_at DESC
        """, (int(user_id),))
        rows = cur.fetchall()
        return ok({"estimates": [{
            "id": r[0], "title": r[1],
            "total_standard": float(r[2]) if r[2] else None,
            "status": r[3], "created_at": str(r[4])[:19], "crm_status": r[5],
        } for r in rows]})

    # ── КОМАНДА компании (владелец-company управляет своими менеджерами) ─────
    # Хелпер: вернуть (uid, role, is_master) текущего пользователя или ошибку
    def get_owner_or_err():
        if not token:
            return None, err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.id, u.role, u.email
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return None, err("Токен недействителен", 401)
        uid, role, email = row
        is_master = (email == "19.jeka.94@gmail.com")
        # Доступ к команде: только company или мастер
        if role != "company" and not is_master:
            return None, err("Доступ только для роли 'Компания'", 403)
        return (uid, role, is_master), None

    # Список членов команды (своей)
    if action == "team-list" and method == "GET":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, _ = owner
        cur.execute(f"""
            SELECT id, email, name, phone, role, approved, created_at,
                   permissions, (temp_password_plain IS NOT NULL) AS has_pending_password
            FROM {SCHEMA}.users
            WHERE company_id = %s AND removed_at IS NULL AND id <> %s
            ORDER BY created_at DESC
        """, (owner_id, owner_id))
        rows = cur.fetchall()
        return ok({"members": [{
            "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
            "role": r[4], "approved": r[5],
            "created_at": str(r[6])[:19],
            "permissions": r[7],
            "has_pending_password": r[8],
        } for r in rows]})

    # Приглашение нового сотрудника (создание менеджера в компании)
    # ВАЖНО: пароль НЕ возвращается сразу — он сохраняется в temp_password_plain.
    # Владелец сначала настраивает права, потом вызывает team-show-password.
    if action == "team-invite" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, _ = owner

        invitee_email = (body.get("email") or "").strip().lower()
        invitee_name  = (body.get("name") or "").strip()
        invitee_phone = (body.get("phone") or "").strip()

        if not invitee_email:
            return err("Укажите email сотрудника")
        if "@" not in invitee_email or "." not in invitee_email:
            return err("Некорректный email")

        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email=%s", (invitee_email,))
        if cur.fetchone():
            return err("Пользователь с таким email уже зарегистрирован")

        # Генерим временный пароль (10 символов). Сохраняем plain, чтобы владелец
        # мог получить его уже после настройки прав.
        temp_password = secrets.token_urlsafe(8)[:10]

        # По умолчанию — все права отключены (владелец сам настроит)
        default_permissions = {
            "crm_view": False, "crm_edit": False,
            "finance": False, "calendar": False,
            "analytics": False, "kanban": False,
            "files": False, "settings": False,
        }

        cur.execute(f"""
            INSERT INTO {SCHEMA}.users
              (email, password_hash, name, phone, role, approved, company_id, invited_by,
               permissions, temp_password_plain)
            VALUES (%s, %s, %s, %s, 'manager', TRUE, %s, %s, %s::jsonb, %s)
            RETURNING id
        """, (
            invitee_email, hash_password(temp_password),
            invitee_name or None, invitee_phone or None,
            owner_id, owner_id,
            json.dumps(default_permissions), temp_password,
        ))
        new_id = cur.fetchone()[0]
        conn.commit()

        return ok({
            "ok": True,
            "member": {
                "id": new_id, "email": invitee_email,
                "name": invitee_name, "phone": invitee_phone,
                "role": "manager", "approved": True,
                "permissions": default_permissions,
                "has_pending_password": True,
            },
        })

    # Обновление прав сотрудника
    if action == "team-update-permissions" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, _ = owner

        member_id = body.get("member_id")
        perms     = body.get("permissions")
        if not member_id or perms is None:
            return err("member_id и permissions обязательны")

        cur.execute(f"""
            SELECT id FROM {SCHEMA}.users
            WHERE id=%s AND company_id=%s AND removed_at IS NULL
        """, (int(member_id), owner_id))
        if not cur.fetchone():
            return err("Сотрудник не найден в вашей команде", 404)

        cur.execute(f"""
            UPDATE {SCHEMA}.users SET permissions=%s::jsonb, updated_at=NOW() WHERE id=%s
        """, (json.dumps(perms), int(member_id)))
        conn.commit()
        return ok({"ok": True, "permissions": perms})

    # Получить временный пароль (доступно один раз — пока есть temp_password_plain)
    if action == "team-show-password" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, _ = owner

        member_id = body.get("member_id")
        if not member_id:
            return err("member_id required")

        cur.execute(f"""
            SELECT id, email, temp_password_plain FROM {SCHEMA}.users
            WHERE id=%s AND company_id=%s AND removed_at IS NULL
        """, (int(member_id), owner_id))
        row = cur.fetchone()
        if not row:
            return err("Сотрудник не найден", 404)
        _, member_email, plain = row
        if not plain:
            return err("Пароль уже был показан. Используйте «Сбросить пароль».", 410)

        # Чистим plain после показа
        cur.execute(f"""
            UPDATE {SCHEMA}.users SET temp_password_plain=NULL WHERE id=%s
        """, (int(member_id),))
        conn.commit()
        return ok({"ok": True, "email": member_email, "temp_password": plain})

    # Удаление сотрудника (мягкое)
    if action == "team-remove" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, _ = owner

        member_id = body.get("member_id")
        if not member_id:
            return err("member_id required")
        member_id = int(member_id)

        # Проверяем, что удаляемый — действительно член этой команды
        cur.execute(f"""
            SELECT id FROM {SCHEMA}.users
            WHERE id=%s AND company_id=%s AND removed_at IS NULL
        """, (member_id, owner_id))
        if not cur.fetchone():
            return err("Сотрудник не найден в вашей команде", 404)

        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET removed_at=NOW(), removed_name=name, removed_email=email,
                email=CONCAT('_removed_', id, '_', email)
            WHERE id=%s
        """, (member_id,))
        # Гасим все его сессии
        cur.execute(f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE user_id=%s", (member_id,))
        conn.commit()
        return ok({"ok": True})

    # Сброс пароля сотрудника владельцем (отдаём новый временный пароль)
    if action == "team-reset-password" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, _ = owner

        member_id = body.get("member_id")
        if not member_id:
            return err("member_id required")
        member_id = int(member_id)

        cur.execute(f"""
            SELECT id, email FROM {SCHEMA}.users
            WHERE id=%s AND company_id=%s AND removed_at IS NULL
        """, (member_id, owner_id))
        row = cur.fetchone()
        if not row:
            return err("Сотрудник не найден в вашей команде", 404)

        new_password = secrets.token_urlsafe(8)[:10]
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET password_hash=%s, updated_at=NOW(), temp_password_plain=NULL
            WHERE id=%s
        """, (hash_password(new_password), member_id))
        # Сбрасываем сессии
        cur.execute(f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE user_id=%s", (member_id,))
        conn.commit()
        return ok({"ok": True, "temp_password": new_password})

    # ── Пакеты смет ──────────────────────────────────────────────────────────
    PACKAGES = {
        "start":    {"name": "Старт",    "estimates": 5,   "price": 490},
        "standard": {"name": "Стандарт", "estimates": 20,  "price": 990},
        "pro":      {"name": "Про",      "estimates": 60,  "price": 1990},
        "business": {"name": "Бизнес",   "estimates": 150, "price": 3990},
    }

    # ── Список пакетов (публичный) ────────────────────────────────────────────
    if action == "packages" and method == "GET":
        return ok({"packages": [
            {"id": k, **v} for k, v in PACKAGES.items()
        ]})

    # ── Мастер: ручное начисление баланса ────────────────────────────────────
    if action == "add-balance" and method == "POST":
        user_id = body.get("user_id")
        amount  = body.get("amount")
        reason  = body.get("reason", "admin_manual")
        if not user_id or amount is None:
            return err("user_id и amount обязательны")
        uid = int(user_id)
        amt = int(amount)
        cur.execute(f"""
            UPDATE {SCHEMA}.users SET estimates_balance = estimates_balance + %s WHERE id=%s
        """, (amt, uid))
        cur.execute(f"""
            INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, reason) VALUES (%s, %s, %s)
        """, (uid, amt, reason))
        conn.commit()
        cur.execute(f"SELECT estimates_balance FROM {SCHEMA}.users WHERE id=%s", (uid,))
        new_bal = cur.fetchone()[0] or 0
        return ok({"ok": True, "estimates_balance": new_bal})

    # ── История транзакций пользователя (для мастера) ─────────────────────────
    if action == "balance-history" and method == "GET":
        user_id = params.get("user_id")
        if not user_id:
            return err("user_id required")
        cur.execute(f"""
            SELECT id, amount, reason, created_at FROM {SCHEMA}.balance_transactions
            WHERE user_id=%s ORDER BY created_at DESC LIMIT 50
        """, (int(user_id),))
        rows = cur.fetchall()
        return ok({"history": [
            {"id": r[0], "amount": r[1], "reason": r[2], "created_at": str(r[3])[:19]}
            for r in rows
        ]})

    # ── Мастер: мягкое удаление пользователя ────────────────────────────────
    if action == "delete-user" and method == "POST":
        user_id = body.get("user_id")
        if not user_id:
            return err("user_id required")
        uid = int(user_id)
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET removed_at=NOW(), removed_name=name, removed_email=email,
                email=CONCAT('_removed_', id, '_', email)
            WHERE id=%s AND removed_at IS NULL
        """, (uid,))
        conn.commit()
        return ok({"ok": True})

    # ── Мастер: восстановить пользователя ────────────────────────────────────
    if action == "restore-user" and method == "POST":
        user_id = body.get("user_id")
        if not user_id:
            return err("user_id required")
        uid = int(user_id)
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET email=removed_email, removed_at=NULL, removed_name=NULL, removed_email=NULL
            WHERE id=%s AND removed_at IS NOT NULL
        """, (uid,))
        conn.commit()
        return ok({"ok": True})

    # ── Мастер: список удалённых пользователей ───────────────────────────────
    if action == "removed-users" and method == "GET":
        role_group = params.get("group", "all")
        if role_group == "business":
            where = "WHERE role IN ('installer','company') AND removed_at IS NOT NULL"
        elif role_group == "pro":
            where = "WHERE role IN ('designer','foreman') AND removed_at IS NOT NULL"
        else:
            where = "WHERE removed_at IS NOT NULL"
        cur.execute(f"""
            SELECT id, removed_email, removed_name, role, removed_at, approved, rejected, discount,
                   created_at, subscription_start, subscription_end
            FROM {SCHEMA}.users {where}
            ORDER BY removed_at DESC
        """)
        rows = cur.fetchall()
        return ok({"users": [{
            "id": r[0], "email": r[1] or "", "name": r[2],
            "role": r[3], "removed_at": str(r[4])[:19],
            "approved": r[5], "rejected": r[6], "discount": r[7] or 0,
            "created_at": str(r[8])[:19],
            "subscription_start": str(r[9])[:19] if r[9] else None,
            "subscription_end":   str(r[10])[:19] if r[10] else None,
        } for r in rows]})

    # ── Мастер: статистика дашборда ───────────────────────────────────────────
    if action == "admin-stats" and method == "GET":
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
        total_users = cur.fetchone()[0]

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE role IN ('installer','company') AND approved=false AND rejected=false")
        pending = cur.fetchone()[0]

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE subscription_end > NOW()")
        active_subs = cur.fetchone()[0]

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.saved_estimates")
        total_estimates = cur.fetchone()[0]

        # Заканчивается подписка в ближайшие 7 дней
        cur.execute(f"""
            SELECT id, email, name, phone, role, subscription_end, telegram
            FROM {SCHEMA}.users
            WHERE subscription_end > NOW() AND subscription_end < NOW() + INTERVAL '7 days'
            ORDER BY subscription_end ASC
        """)
        expiring = cur.fetchall()

        # Новые за 7 дней
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at > NOW() - INTERVAL '7 days'")
        new_week = cur.fetchone()[0]

        # По ролям
        cur.execute(f"SELECT role, COUNT(*) FROM {SCHEMA}.users GROUP BY role")
        by_role = {r[0]: r[1] for r in cur.fetchall()}

        return ok({
            "total_users": total_users,
            "pending": pending,
            "active_subs": active_subs,
            "total_estimates": total_estimates,
            "new_week": new_week,
            "by_role": by_role,
            "expiring_soon": [{
                "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
                "role": r[4], "subscription_end": str(r[5])[:19], "telegram": r[6],
            } for r in expiring],
        })

    # ── Правила 3 цен: получить ───────────────────────────────────────────────
    if action == "get-pricing-rules" and method == "GET":
        cur.execute(f"""
            SELECT econom_mult, premium_mult, econom_label, standard_label, premium_label
            FROM {SCHEMA}.pricing_settings ORDER BY id LIMIT 1
        """)
        row = cur.fetchone()
        if not row:
            return ok({"econom_mult": 0.85, "premium_mult": 1.27,
                       "econom_label": "Econom", "standard_label": "Standard", "premium_label": "Premium"})
        return ok({
            "econom_mult":    float(row[0]),
            "premium_mult":   float(row[1]),
            "econom_label":   row[2],
            "standard_label": row[3],
            "premium_label":  row[4],
        })

    # ── Правила 3 цен: сохранить (только мастер или company) ─────────────────
    if action == "save-pricing-rules" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email, u.role FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        uemail, urole = row
        is_master = (uemail == "19.jeka.94@gmail.com")
        if not is_master and urole not in ("company", "installer"):
            return err("Нет прав на изменение правил цен", 403)

        econom_mult    = float(body.get("econom_mult", 0.85))
        premium_mult   = float(body.get("premium_mult", 1.27))
        econom_label   = (body.get("econom_label") or "Econom").strip()
        standard_label = (body.get("standard_label") or "Standard").strip()
        premium_label  = (body.get("premium_label") or "Premium").strip()

        # Upsert: обновить первую запись или создать
        cur.execute(f"SELECT id FROM {SCHEMA}.pricing_settings LIMIT 1")
        existing = cur.fetchone()
        if existing:
            cur.execute(f"""
                UPDATE {SCHEMA}.pricing_settings
                SET econom_mult=%s, premium_mult=%s,
                    econom_label=%s, standard_label=%s, premium_label=%s,
                    updated_at=NOW()
                WHERE id=%s
            """, (econom_mult, premium_mult, econom_label, standard_label, premium_label, existing[0]))
        else:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.pricing_settings
                  (econom_mult, premium_mult, econom_label, standard_label, premium_label)
                VALUES (%s, %s, %s, %s, %s)
            """, (econom_mult, premium_mult, econom_label, standard_label, premium_label))
        conn.commit()
        return ok({"ok": True})

    # ── Мастер: список WL-компаний ───────────────────────────────────────────
    if action == "admin-wl-companies" and method == "GET":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)
        cur.execute(f"""
            SELECT id, email, name, company_name, bot_name, brand_color,
                   support_phone, estimates_balance, created_at, agent_purchased_at
            FROM {SCHEMA}.users
            WHERE has_own_agent = TRUE AND removed_at IS NULL
            ORDER BY agent_purchased_at DESC NULLS LAST, id DESC
        """)
        rows = cur.fetchall()
        return ok({"companies": [{
            "id":               r[0],
            "email":            r[1] or "",
            "name":             r[2] or "",
            "company_name":     r[3] or "",
            "bot_name":         r[4] or "",
            "brand_color":      r[5] or "#8b5cf6",
            "support_phone":    r[6] or "",
            "estimates_balance": r[7] or 0,
            "created_at":       str(r[8])[:10] if r[8] else "",
            "purchased_at":     str(r[9])[:10] if r[9] else "",
        } for r in rows]})

    # ── Мастер: создать демо-компанию из данных парсинга ─────────────────────
    if action == "admin-create-demo-company" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        site_url     = body.get("site_url", "").strip()
        company_name = body.get("company_name", "").strip() or "Демо-компания"
        brand        = body.get("brand", {}) or {}

        if not site_url:
            return err("site_url обязателен")

        # Генерируем уникальный email для демо-аккаунта
        import secrets as _sec
        slug = re.sub(r"https?://", "", site_url).split("/")[0].replace(".", "-")
        demo_email = f"demo-{slug}-{_sec.token_hex(4)}@demo.local"
        temp_pass  = _sec.token_urlsafe(10)
        pw_hash    = hash_password(temp_pass)

        # Создаём пользователя
        cur.execute(f"""
            INSERT INTO {SCHEMA}.users
              (email, password_hash, name, role, approved, has_own_agent,
               estimates_balance, agent_purchased_at,
               company_name, bot_name, bot_greeting,
               brand_color, brand_logo_url, bot_avatar_url,
               support_phone, support_email, telegram, website,
               working_hours, pdf_footer_address)
            VALUES (%s,%s,%s,'company',TRUE,TRUE,
                    10, NOW(),
                    %s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s)
            RETURNING id
        """, (
            demo_email, pw_hash, company_name,
            company_name,
            brand.get("bot_name") or company_name,
            brand.get("bot_greeting") or f"Здравствуйте! Я помощник компании «{company_name}».",
            brand.get("brand_color") or "#8b5cf6",
            brand.get("brand_logo_url"),
            brand.get("bot_avatar_url"),
            brand.get("support_phone"),
            brand.get("support_email"),
            brand.get("telegram"),
            brand.get("website"),
            brand.get("working_hours"),
            brand.get("pdf_footer_address"),
        ))
        new_id = cur.fetchone()[0]

        # Создаём сессию (токен на 30 дней)
        new_token = _sec.token_hex(32)
        cur.execute(f"""
            INSERT INTO {SCHEMA}.user_sessions (user_id, token, expires_at)
            VALUES (%s, %s, NOW() + INTERVAL '30 days')
        """, (new_id, new_token))

        # Записываем в demo_companies
        cur.execute(f"""
            INSERT INTO {SCHEMA}.demo_companies (site_url, company_id)
            VALUES (%s, %s)
        """, (site_url, new_id))

        conn.commit()
        return ok({
            "company_id": new_id,
            "token":      new_token,
            "email":      demo_email,
            "password":   temp_pass,
        })

    # ── WL-менеджеры: вход ───────────────────────────────────────────────────
    if action == "wl-login" and method == "POST":
        email    = (body.get("email") or "").strip().lower()
        password = (body.get("password") or "").strip()
        if not email or not password:
            return err("Email и пароль обязательны")
        cur.execute(f"""
            SELECT id, name, wl_role, approved, password_hash
            FROM {SCHEMA}.wl_managers WHERE email = %s
        """, (email,))
        row = cur.fetchone()
        if not row:
            return err("Неверный email или пароль")
        mgr_id, mgr_name, wl_role, approved, pwd_hash = row
        if pwd_hash != hash_password(password):
            return err("Неверный email или пароль")
        if not approved:
            return err("Аккаунт ожидает одобрения мастера")
        tok = secrets.token_hex(32)
        cur.execute(f"""
            INSERT INTO {SCHEMA}.user_sessions (user_id, token, expires_at, session_type)
            VALUES (%s, %s, NOW() + INTERVAL '30 days', 'wl_manager')
        """, (mgr_id, tok))
        conn.commit()
        return ok({"token": tok, "manager": {
            "id": mgr_id, "name": mgr_name,
            "email": email, "wl_role": wl_role,
        }})

    # ── WL-менеджеры: кто я ──────────────────────────────────────────────────
    if action == "wl-me" and method == "GET":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT m.id, m.name, m.email, m.wl_role, m.approved
            FROM {SCHEMA}.wl_managers m
            JOIN {SCHEMA}.user_sessions s ON s.user_id = m.id
            WHERE s.token = %s AND s.expires_at > NOW() AND s.session_type = 'wl_manager'
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Сессия не найдена", 401)
        mgr_id, mgr_name, mgr_email, wl_role, approved = row
        if not approved:
            return err("Аккаунт не одобрен", 403)
        return ok({"manager": {
            "id": mgr_id, "name": mgr_name,
            "email": mgr_email, "wl_role": wl_role,
        }})

    # ── WL-менеджеры: список (только мастер) ─────────────────────────────────
    if action == "wl-staff-list" and method == "GET":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)
        cur.execute(f"""
            SELECT id, name, email, wl_role, approved, created_at,
                   (SELECT COUNT(*) FROM {SCHEMA}.demo_companies dc WHERE dc.manager_id = m.id) AS companies_count
            FROM {SCHEMA}.wl_managers m ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        return ok({"staff": [{
            "id": r[0], "name": r[1], "email": r[2],
            "wl_role": r[3], "approved": r[4],
            "created_at": str(r[5])[:10],
            "companies_count": int(r[6] or 0),
        } for r in rows]})

    # ── WL-менеджеры: добавить (только мастер) ───────────────────────────────
    if action == "wl-staff-invite" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)
        name     = (body.get("name") or "").strip()
        email    = (body.get("email") or "").strip().lower()
        password = (body.get("password") or "").strip()
        wl_role  = body.get("wl_role", "manager")
        if wl_role not in ("manager", "master_manager"):
            wl_role = "manager"
        if not name or not email or not password:
            return err("Имя, email и пароль обязательны")
        cur.execute(f"SELECT id FROM {SCHEMA}.wl_managers WHERE email=%s", (email,))
        if cur.fetchone():
            return err("Менеджер с таким email уже существует")
        cur.execute(f"""
            INSERT INTO {SCHEMA}.wl_managers (name, email, password_hash, wl_role, approved)
            VALUES (%s, %s, %s, %s, FALSE) RETURNING id
        """, (name, email, hash_password(password), wl_role))
        new_id = cur.fetchone()[0]
        conn.commit()
        return ok({"id": new_id, "name": name, "email": email, "wl_role": wl_role, "approved": False})

    # ── WL-менеджеры: одобрить/отклонить (только мастер) ────────────────────
    if action == "wl-staff-approve" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)
        mgr_id  = body.get("id")
        approved = body.get("approved")
        wl_role  = body.get("wl_role")
        if mgr_id is None:
            return err("id обязателен")
        sets, vals = [], []
        if approved is not None:
            sets.append("approved = %s"); vals.append(bool(approved))
        if wl_role in ("manager", "master_manager"):
            sets.append("wl_role = %s"); vals.append(wl_role)
        if not sets:
            return err("Нечего обновлять")
        vals.append(int(mgr_id))
        cur.execute(f"UPDATE {SCHEMA}.wl_managers SET {', '.join(sets)} WHERE id = %s", vals)
        conn.commit()
        return ok({"ok": True})

    # ── WL-менеджеры: удалить (только мастер) ────────────────────────────────
    if action == "wl-staff-delete" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)
        mgr_id = body.get("id")
        if not mgr_id:
            return err("id обязателен")
        cur.execute(f"DELETE FROM {SCHEMA}.wl_managers WHERE id = %s", (int(mgr_id),))
        conn.commit()
        return ok({"ok": True})

    # ── WL-менеджеры: редактировать (только мастер) ──────────────────────────
    if action == "wl-staff-update" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)
        mgr_id = body.get("id")
        if not mgr_id:
            return err("id обязателен")
        name     = (body.get("name") or "").strip()
        email_new = (body.get("email") or "").strip().lower()
        password  = (body.get("password") or "").strip()
        wl_role   = body.get("wl_role")
        sets, vals = [], []
        if name:
            sets.append("name = %s"); vals.append(name)
        if email_new:
            cur.execute(f"SELECT id FROM {SCHEMA}.wl_managers WHERE email=%s AND id != %s", (email_new, int(mgr_id)))
            if cur.fetchone():
                return err("Менеджер с таким email уже существует")
            sets.append("email = %s"); vals.append(email_new)
        if password:
            sets.append("password_hash = %s"); vals.append(hash_password(password))
        if wl_role in ("manager", "master_manager"):
            sets.append("wl_role = %s"); vals.append(wl_role)
        if not sets:
            return err("Нечего обновлять")
        vals.append(int(mgr_id))
        cur.execute(f"UPDATE {SCHEMA}.wl_managers SET {', '.join(sets)} WHERE id = %s", vals)
        conn.commit()
        return ok({"ok": True})

    # ── WL-менеджеры: назначить компанию ─────────────────────────────────────
    if action == "wl-assign-company" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)
        demo_id    = body.get("demo_id")
        manager_id = body.get("manager_id")  # None = снять назначение
        if not demo_id:
            return err("demo_id обязателен")
        cur.execute(f"""
            UPDATE {SCHEMA}.demo_companies SET manager_id = %s WHERE id = %s
        """, (manager_id, int(demo_id)))
        conn.commit()
        return ok({"ok": True})

    # ── WL: сохранить порядок компаний ───────────────────────────────────────
    if action == "wl-reorder" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        # Доступно мастеру и wl-менеджерам
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        master_row = cur.fetchone()
        is_wl_master = master_row and master_row[0] == "19.jeka.94@gmail.com"
        if not is_wl_master:
            cur.execute(f"""
                SELECT m.id FROM {SCHEMA}.wl_managers m
                JOIN {SCHEMA}.user_sessions s ON s.user_id = m.id
                WHERE s.token=%s AND s.expires_at > NOW() AND m.approved = TRUE
            """, (token,))
            if not cur.fetchone():
                return err("Доступ запрещён", 403)
        # ordered_ids — список demo_id в нужном порядке
        ordered_ids = body.get("ordered_ids", [])
        if not ordered_ids:
            return err("ordered_ids обязателен")
        for i, demo_id_item in enumerate(ordered_ids):
            cur.execute(f"""
                UPDATE {SCHEMA}.demo_companies SET sort_order = %s WHERE id = %s
            """, (i + 1, int(demo_id_item)))
        conn.commit()
        return ok({"ok": True})

    # ── Мастер: список демо-компаний ─────────────────────────────────────────
    if action == "admin-demo-companies" and method == "GET":
        if not token:
            return err("Требуется авторизация", 401)

        # Проверяем: мастер или wl-менеджер?
        # ВАЖНО: сначала ищем в wl_managers (чтобы избежать коллизии id с users)
        is_master_user = False
        wl_manager_row = None

        cur.execute(f"""
            SELECT m.id, m.wl_role, m.approved, m.email FROM {SCHEMA}.wl_managers m
            JOIN {SCHEMA}.user_sessions s ON s.user_id = m.id
            WHERE s.token = %s AND s.expires_at > NOW() AND s.session_type = 'wl_manager'
        """, (token,))
        wl_row = cur.fetchone()

        if wl_row:
            # Токен принадлежит wl-менеджеру
            if not wl_row[2]:
                return err("Аккаунт не одобрен", 403)
            if wl_row[3] == "19.jeka.94@gmail.com" or wl_row[1] == "master_manager":
                is_master_user = True
            else:
                wl_manager_row = wl_row
        else:
            # Может это обычный мастер-пользователь?
            cur.execute(f"""
                SELECT u.email FROM {SCHEMA}.user_sessions s
                JOIN {SCHEMA}.users u ON u.id = s.user_id
                WHERE s.token=%s AND s.expires_at > NOW()
            """, (token,))
            user_row = cur.fetchone()
            if user_row and user_row[0] == "19.jeka.94@gmail.com":
                is_master_user = True
            else:
                return err("Доступ запрещён", 403)

        # Формируем WHERE для фильтрации по менеджеру
        if is_master_user:
            manager_filter = ""
            filter_params = ()
        elif wl_manager_row[1] == "master_manager":
            # Мастер-менеджер видит все компании
            manager_filter = ""
            filter_params = ()
        else:
            # Обычный менеджер — только свои
            manager_filter = "AND dc.manager_id = %s"
            filter_params = (wl_manager_row[0],)

        cur.execute(f"""
            SELECT dc.id, dc.site_url, dc.created_at,
                   u.id, u.email, u.company_name, u.bot_name, u.brand_color,
                   u.support_phone, u.estimates_balance, u.has_own_agent,
                   u.brand_logo_url, u.removed_at,
                   dc.status, dc.contact_name, dc.contact_phone, dc.contact_position,
                   dc.notes, dc.next_action, dc.next_action_date,
                   u.trial_until, u.agent_purchased_at,
                   COUNT(e.id) AS estimates_used,
                   (SELECT dp.scheduled_at FROM {SCHEMA}.demo_presentations dp
                    WHERE dp.demo_id = dc.id AND dp.status = 'scheduled'
                    ORDER BY dp.scheduled_at LIMIT 1) AS presentation_at,
                   dc.manager_id,
                   wm.name AS manager_name,
                   u.bot_avatar_url, u.support_email,
                   COALESCE(u.telegram_url, u.telegram) AS telegram_url,
                   u.working_hours, u.pdf_footer_address
            FROM {SCHEMA}.demo_companies dc
            JOIN {SCHEMA}.users u ON u.id = dc.company_id
            LEFT JOIN {SCHEMA}.saved_estimates e ON e.user_id = u.id
            LEFT JOIN {SCHEMA}.wl_managers wm ON wm.id = dc.manager_id
            WHERE 1=1 {manager_filter}
            GROUP BY dc.id, dc.site_url, dc.created_at,
                     u.id, u.email, u.company_name, u.bot_name, u.brand_color,
                     u.support_phone, u.estimates_balance, u.has_own_agent,
                     u.brand_logo_url, u.removed_at,
                     dc.status, dc.contact_name, dc.contact_phone, dc.contact_position,
                     dc.notes, dc.next_action, dc.next_action_date,
                     u.trial_until, u.agent_purchased_at, dc.manager_id, wm.name,
                     u.bot_avatar_url, u.support_email, u.telegram_url, u.telegram,
                     u.working_hours, u.pdf_footer_address
            ORDER BY
              CASE WHEN dc.sort_order = 0 THEN 0 ELSE 1 END ASC,
              dc.sort_order ASC,
              dc.created_at DESC
        """, filter_params)
        rows = cur.fetchall()
        return ok({"companies": [{
            "demo_id":              r[0],
            "site_url":             r[1],
            "created_at":           str(r[2])[:16] if r[2] else "",
            "company_id":           r[3],
            "email":                r[4] or "",
            "company_name":         r[5] or "",
            "bot_name":             r[6] or "",
            "brand_color":          r[7] or "",
            "support_phone":        r[8] or "",
            "estimates_balance":    r[9] or 0,
            "has_own_agent":        bool(r[10]),
            "brand_logo_url":       r[11] or "",
            "deleted":              r[12] is not None,
            "status":               r[13] or "new",
            "contact_name":         r[14] or "",
            "contact_phone":        r[15] or "",
            "contact_position":     r[16] or "",
            "notes":                r[17] or "",
            "next_action":          r[18] or "",
            "next_action_date":     str(r[19]) if r[19] else "",
            "trial_until":          str(r[20])[:10] if r[20] else None,
            "agent_purchased_at":   str(r[21])[:10] if r[21] else None,
            "estimates_used":       int(r[22] or 0),
            "presentation_at":      str(r[23])[:16] if r[23] else None,
            "manager_id":           r[24],
            "manager_name":         r[25] or "",
            "bot_avatar_url":       r[26] or "",
            "support_email":        r[27] or "",
            "telegram":             r[28] or "",
            "working_hours":        r[29] or "",
            "pdf_footer_address":   r[30] or "",
        } for r in rows]})

    # ── Мастер: обновить данные демо-компании (pipeline) ─────────────────────
    if action == "admin-update-demo" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        demo_id = body.get("demo_id")
        if not demo_id:
            return err("demo_id обязателен")

        # Поля demo_companies
        dc_allowed = ["status", "contact_name", "contact_phone", "contact_position",
                      "notes", "next_action", "next_action_date"]
        # Поля users (бренд)
        u_allowed  = ["company_name", "bot_name", "brand_color", "support_phone",
                      "support_email", "telegram", "website", "working_hours", "pdf_footer_address"]

        dc_sets, dc_vals = [], []
        u_sets,  u_vals  = [], []

        for key in dc_allowed:
            if key in body:
                dc_sets.append(f"{key} = %s")
                val = body[key]
                dc_vals.append(val if val not in ("", None) else None)

        for key in u_allowed:
            if key in body:
                u_sets.append(f"{key} = %s")
                val = body[key]
                u_sets_val = str(val).strip() if val not in ("", None) else None
                u_vals.append(u_sets_val)

        if dc_sets:
            dc_vals.append(int(demo_id))
            cur.execute(f"""
                UPDATE {SCHEMA}.demo_companies
                SET {', '.join(dc_sets)}
                WHERE id = %s
            """, dc_vals)

        if u_sets:
            # Получаем company_id
            cur.execute(f"SELECT company_id FROM {SCHEMA}.demo_companies WHERE id=%s", (int(demo_id),))
            cid_row = cur.fetchone()
            if cid_row:
                u_vals.append(cid_row[0])
                cur.execute(f"""
                    UPDATE {SCHEMA}.users
                    SET {', '.join(u_sets)}
                    WHERE id = %s
                """, u_vals)

        conn.commit()
        return ok({"ok": True})

    # ── Мастер: удалить демо-компанию ────────────────────────────────────────
    if action == "admin-delete-demo-company" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        demo_id = body.get("demo_id")
        if not demo_id:
            return err("demo_id обязателен")

        # Получаем company_id
        cur.execute(f"SELECT company_id FROM {SCHEMA}.demo_companies WHERE id=%s", (int(demo_id),))
        row = cur.fetchone()
        if not row:
            return err("Демо-компания не найдена", 404)
        company_id = row[0]

        # Soft-delete пользователя
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET removed_at=NOW(), removed_name=name, removed_email=email,
                email=CONCAT('_removed_', id, '_', email)
            WHERE id=%s AND removed_at IS NULL
        """, (company_id,))
        # Удаляем из demo_companies
        cur.execute(f"DELETE FROM {SCHEMA}.demo_companies WHERE id=%s", (int(demo_id),))
        conn.commit()
        return ok({"ok": True})

    # ── Мастер: активировать агента для демо-компании ────────────────────────
    if action == "admin-activate-agent" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        company_id = body.get("company_id")
        if not company_id:
            return err("company_id обязателен")
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET has_own_agent=TRUE, agent_purchased_at=COALESCE(agent_purchased_at, NOW())
            WHERE id=%s
        """, (int(company_id),))
        conn.commit()
        return ok({"ok": True})

    # ── Мастер: загрузить чек оплаты и перевести в статус paid ───────────────
    if action == "admin-upload-receipt" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        demo_id      = body.get("demo_id")
        image_b64    = body.get("image_b64", "")
        image_ext    = body.get("image_ext", "jpg")
        company_name = body.get("company_name", "Компания")
        company_cid  = body.get("company_id", "")

        if not demo_id or not image_b64:
            return err("demo_id и image_b64 обязательны")

        # Загружаем чек в S3
        img_bytes = base64.b64decode(image_b64)
        s3 = boto3.client(
            "s3",
            endpoint_url="https://bucket.poehali.dev",
            aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        )
        key = f"receipts/receipt_{demo_id}_{secrets.token_hex(4)}.{image_ext}"
        ct  = "image/jpeg" if image_ext in ("jpg", "jpeg") else "image/png" if image_ext == "png" else "application/octet-stream"
        s3.put_object(Bucket="files", Key=key, Body=img_bytes, ContentType=ct)
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

        # Сохраняем URL и меняем статус
        cur.execute(f"""
            UPDATE {SCHEMA}.demo_companies
            SET payment_receipt_url=%s, status='paid'
            WHERE id=%s
        """, (cdn_url, int(demo_id)))
        conn.commit()

        # Отправляем фото в Telegram
        tg_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        tg_chat  = os.environ.get("TELEGRAM_OWNER_CHAT_ID", "")
        if tg_token and tg_chat:
            caption = f"💰 Оплатили агента!\n\n🏢 {company_name}\nID #{company_cid}\n\nЧек приложен."
            try:
                payload = json.dumps({
                    "chat_id": tg_chat,
                    "photo":   cdn_url,
                    "caption": caption,
                }).encode()
                req = _ureq.Request(
                    f"https://api.telegram.org/bot{tg_token}/sendPhoto",
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                _ureq.urlopen(req, timeout=10)
            except Exception as e:
                print(f"[receipt] TG send error: {e}")

        return ok({"ok": True, "receipt_url": cdn_url})

    # ── Презентации: проверить занятые слоты ─────────────────────────────────
    if action == "demo-busy-slots" and method == "GET":
        date_str = params.get("date")  # YYYY-MM-DD
        # scheduled_at хранится в UTC, МСК = UTC+3
        # Берём все показы за сутки с запасом (±1 день) и фильтруем на Python
        cur.execute(f"""
            SELECT scheduled_at
            FROM {SCHEMA}.demo_presentations
            WHERE status = 'scheduled'
            AND scheduled_at >= %s::date - INTERVAL '1 day'
            AND scheduled_at <  %s::date + INTERVAL '2 days'
        """, (date_str, date_str))
        rows = cur.fetchall()
        busy_hours = []
        from datetime import datetime, timezone, timedelta
        MSK = timezone(timedelta(hours=3))
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        for (scheduled_at,) in rows:
            # Конвертируем в МСК
            if scheduled_at.tzinfo is None:
                dt_utc = scheduled_at.replace(tzinfo=timezone.utc)
            else:
                dt_utc = scheduled_at
            dt_msk = dt_utc.astimezone(MSK)
            if dt_msk.date() == target_date:
                busy_hours.append(dt_msk.hour)
        return ok({"busy_hours": busy_hours})

    # ── Презентации: список всех (для мастера) ────────────────────────────────
    if action == "demo-presentations" and method == "GET":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        month = params.get("month")
        year  = params.get("year")
        if month and year:
            cur.execute(f"""
                SELECT dp.id, dp.demo_id, dp.scheduled_at, dp.duration_min,
                       dp.notes, dp.status, dp.created_at,
                       dc.site_url, u.company_name, u.brand_color, u.brand_logo_url,
                       dc.contact_name, dc.contact_phone
                FROM {SCHEMA}.demo_presentations dp
                JOIN {SCHEMA}.demo_companies dc ON dc.id = dp.demo_id
                JOIN {SCHEMA}.users u ON u.id = dc.company_id
                WHERE EXTRACT(MONTH FROM dp.scheduled_at) = %s
                  AND EXTRACT(YEAR  FROM dp.scheduled_at) = %s
                ORDER BY dp.scheduled_at
            """, (int(month), int(year)))
        else:
            cur.execute(f"""
                SELECT dp.id, dp.demo_id, dp.scheduled_at, dp.duration_min,
                       dp.notes, dp.status, dp.created_at,
                       dc.site_url, u.company_name, u.brand_color, u.brand_logo_url,
                       dc.contact_name, dc.contact_phone
                FROM {SCHEMA}.demo_presentations dp
                JOIN {SCHEMA}.demo_companies dc ON dc.id = dp.demo_id
                JOIN {SCHEMA}.users u ON u.id = dc.company_id
                WHERE dp.status = 'scheduled'
                ORDER BY dp.scheduled_at
            """)
        rows = cur.fetchall()
        return ok({"presentations": [{
            "id":           r[0],
            "demo_id":      r[1],
            "scheduled_at": str(r[2]),
            "duration_min": r[3],
            "notes":        r[4] or "",
            "status":       r[5],
            "created_at":   str(r[6]),
            "site_url":     r[7] or "",
            "company_name": r[8] or "",
            "brand_color":  r[9] or "#8b5cf6",
            "brand_logo_url": r[10] or "",
            "contact_name": r[11] or "",
            "contact_phone": r[12] or "",
        } for r in rows]})

    # ── Презентации: создать запись на показ ──────────────────────────────────
    if action == "demo-schedule-presentation" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        demo_id      = body.get("demo_id")
        scheduled_at = body.get("scheduled_at")  # ISO string
        duration_min = int(body.get("duration_min", 60))
        notes        = (body.get("notes") or "").strip()

        if not demo_id or not scheduled_at:
            return err("demo_id и scheduled_at обязательны")

        # Проверка: нет показа в тот же час (Python-логика, без date_trunc)
        from datetime import datetime, timezone, timedelta
        MSK = timezone(timedelta(hours=3))
        new_dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        new_msk = new_dt.astimezone(MSK)
        new_hour_start = new_msk.replace(minute=0, second=0, microsecond=0)
        new_hour_end   = new_hour_start + timedelta(hours=1)
        cur.execute(f"""
            SELECT scheduled_at FROM {SCHEMA}.demo_presentations
            WHERE status = 'scheduled'
            AND scheduled_at >= %s AND scheduled_at < %s
        """, (new_hour_start.astimezone(timezone.utc), new_hour_end.astimezone(timezone.utc)))
        if cur.fetchone():
            return err("В это время уже запланирован показ")

        cur.execute(f"""
            INSERT INTO {SCHEMA}.demo_presentations (demo_id, scheduled_at, duration_min, notes)
            VALUES (%s, %s, %s, %s) RETURNING id
        """, (int(demo_id), scheduled_at, duration_min, notes or None))
        pres_id = cur.fetchone()[0]

        # Обновляем статус демо-компании → presentation
        cur.execute(f"""
            UPDATE {SCHEMA}.demo_companies SET status = 'presentation' WHERE id = %s
        """, (int(demo_id),))

        conn.commit()
        return ok({"ok": True, "presentation_id": pres_id})

    # ── Презентации: отметить показ проведён ─────────────────────────────────
    if action == "demo-mark-presented" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        demo_id = body.get("demo_id")
        if not demo_id:
            return err("demo_id обязателен")

        # Переводим все scheduled→done, берём дату показа
        cur.execute(f"""
            UPDATE {SCHEMA}.demo_presentations SET status = 'done'
            WHERE demo_id = %s AND status = 'scheduled'
            RETURNING scheduled_at
        """, (int(demo_id),))
        pres_row = cur.fetchone()

        # Следующий шаг: связаться через 4 часа после показа
        from datetime import datetime, timezone, timedelta
        if pres_row:
            call_at = pres_row[0] + timedelta(hours=4)
            call_date = call_at.date().isoformat()
        else:
            call_date = (datetime.now(timezone.utc) + timedelta(hours=4)).date().isoformat()

        # Обновляем статус демо-компании → presented + ставим задачу для менеджера
        cur.execute(f"""
            UPDATE {SCHEMA}.demo_companies
            SET status = 'presented',
                next_action = 'Связаться с клиентом после презентации',
                next_action_date = %s
            WHERE id = %s
        """, (call_date, int(demo_id)))

        conn.commit()
        return ok({"ok": True, "next_action_date": call_date})

    # ── Презентации: обновить/перенести ──────────────────────────────────────
    if action == "demo-reschedule-presentation" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row or row[0] != "19.jeka.94@gmail.com":
            return err("Доступ только для мастера", 403)

        pres_id      = body.get("presentation_id")
        scheduled_at = body.get("scheduled_at")
        duration_min = body.get("duration_min")
        notes        = body.get("notes")

        if not pres_id or not scheduled_at:
            return err("presentation_id и scheduled_at обязательны")

        # Проверка: нет другого показа в тот же час (Python-логика, без date_trunc)
        from datetime import datetime, timezone, timedelta
        MSK = timezone(timedelta(hours=3))
        new_dt2 = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        new_msk2 = new_dt2.astimezone(MSK)
        hour_start2 = new_msk2.replace(minute=0, second=0, microsecond=0)
        hour_end2   = hour_start2 + timedelta(hours=1)
        cur.execute(f"""
            SELECT scheduled_at FROM {SCHEMA}.demo_presentations
            WHERE status = 'scheduled' AND id != %s
            AND scheduled_at >= %s AND scheduled_at < %s
        """, (int(pres_id), hour_start2.astimezone(timezone.utc), hour_end2.astimezone(timezone.utc)))
        if cur.fetchone():
            return err("В это время уже запланирован показ")

        sets = ["scheduled_at = %s"]
        vals = [scheduled_at]
        if duration_min is not None:
            sets.append("duration_min = %s"); vals.append(int(duration_min))
        if notes is not None:
            sets.append("notes = %s"); vals.append(notes.strip() or None)
        vals.append(int(pres_id))

        cur.execute(f"""
            UPDATE {SCHEMA}.demo_presentations SET {', '.join(sets)} WHERE id = %s
        """, vals)
        conn.commit()
        return ok({"ok": True})

    # ── CRM: AI оценка риска скидки по позициям сметы ────────────────────────
    if action == "crm-risk-ai" and method == "POST":
        items = body.get("items", [])
        max_discount = body.get("max_discount", 30)
        custom_prompt = body.get("custom_prompt", "")
        if not items:
            return err("items обязателен")

        base_prompt = custom_prompt.strip() if custom_prompt else (
            "Ты эксперт по монтажу натяжных потолков. Оцени сложность монтажа "
            "по позициям сметы и рекомендуй оптимальную скидку клиенту.\n\n"
            "Критерии: простой объект (прямоугольник, одно полотно) → скидка ближе к максимуму; "
            "сложный (многоуровневый, ниши, много закладных) → минимальная скидка."
        )

        prompt = (
            f"{base_prompt}\n\n"
            f"Позиции сметы:\n"
            + "\n".join(f"{i+1}. {it}" for i, it in enumerate(items[:40]))
            + f"\n\nМаксимально допустимая скидка: {max_discount}%\n\n"
            f"Ответь строго в JSON без markdown:\n"
            f'{{"level":"low|mid|high",'
            f'"recommended_discount":число от 0 до {max_discount},'
            f'"reason":"краткое объяснение (1-2 предложения)",'
            f'"items":["риск 1","риск 2"]}}'
        )

        or_key = os.environ.get("OPENROUTER_API_KEY_2", "") or os.environ.get("OPENROUTER_API_KEY", "")
        if not or_key:
            return err("AI недоступен — нет ключа")

        import urllib.request as _req2
        payload = json.dumps({
            "model": "openai/gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "Отвечай только JSON без markdown."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 400,
            "temperature": 0,
        }).encode()
        req2 = _req2.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {or_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://mospotolki.ru",
            },
            method="POST",
        )
        try:
            with _req2.urlopen(req2, timeout=30) as r2:
                ai_resp = json.loads(r2.read().decode())
            content = ai_resp["choices"][0]["message"]["content"]
            # Вытаскиваем JSON из ответа
            import re as _re
            m = _re.search(r'\{[\s\S]*\}', content)
            if not m:
                return err("AI вернул неожиданный формат")
            result = json.loads(m.group(0))
            return ok(result)
        except Exception as e:
            return err(f"AI ошибка: {str(e)[:100]}")

    return err("Неизвестное действие", 404)