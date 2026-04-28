import json, os, hashlib, secrets, psycopg2
from datetime import datetime

SCHEMA = os.environ.get("DB_SCHEMA", "t_p45929761_bold_move_project")

BUSINESS_ROLES = ("installer", "company")
DISCOUNT_ROLES = ("designer", "foreman")
DEFAULT_DISCOUNT = 10  # % для designer/foreman

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

        cur.execute(
            f"INSERT INTO {SCHEMA}.users (email, password_hash, name, phone, role, approved, discount) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (email, hash_password(password), name, phone or None, role, approved, discount)
        )
        user_id = cur.fetchone()[0]

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
                   u.company_name, u.company_inn, u.company_addr, u.website, u.telegram
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)

        uid, email, name, phone, role, approved, discount, company_name, company_inn, company_addr, website, telegram = row
        return ok({"user": {
            "id": uid, "email": email, "name": name, "phone": phone,
            "role": role or "client", "approved": approved, "discount": discount or 0,
            "is_master": (email == "19.jeka.94@gmail.com"),
            "company_name": company_name, "company_inn": company_inn,
            "company_addr": company_addr, "website": website, "telegram": telegram,
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

        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET name=%s, phone=%s, company_name=%s, company_inn=%s,
                company_addr=%s, website=%s, telegram=%s, updated_at=NOW()
            WHERE id=%s
        """, (name or None, phone or None, company_name or None, company_inn or None,
              company_addr or None, website or None, telegram or None, uid))
        conn.commit()
        return ok({"ok": True})

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
            WHERE role IN ('designer', 'foreman')
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
            where = "WHERE role IN ('installer','company') AND approved=false AND rejected=false"
        elif status_filter == "approved":
            where = "WHERE role IN ('installer','company') AND approved=true"
        elif status_filter == "rejected":
            where = "WHERE role IN ('installer','company') AND rejected=true"
        else:
            where = "WHERE role IN ('installer','company')"

        cur.execute(f"""
            SELECT id, email, name, phone, role, approved, rejected, discount,
                   created_at, subscription_start, subscription_end
            FROM {SCHEMA}.users
            {where}
            ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        return ok({"users": [{
            "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
            "role": r[4], "approved": r[5], "rejected": r[6], "discount": r[7] or 0,
            "created_at": str(r[8])[:19],
            "subscription_start": str(r[9])[:19] if r[9] else None,
            "subscription_end":   str(r[10])[:19] if r[10] else None,
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
            SELECT u.id, u.email, u.name, u.phone, u.discount
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        user_id, email, user_name, phone, user_discount = row

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

        return ok({
            "ok": True,
            "estimate_id": estimate_id,
            "chat_id": chat_id,
            "discount": user_discount or 0,
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
                   COUNT(e.id) as estimates_count, u.rejected, u.subscription_start, u.subscription_end
            FROM {SCHEMA}.users u
            LEFT JOIN {SCHEMA}.saved_estimates e ON e.user_id = u.id
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
        } for r in rows]})

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

    return err("Неизвестное действие", 404)