import json, re, secrets, base64, os
import urllib.request as _ureq
import boto3
from datetime import datetime, timezone, timedelta
from shared import SCHEMA, MASTER_EMAIL, ok, err, check_is_master, hash_password, verify_password, needs_rehash


def handle(action, method, params, body, token, event, conn, cur):

    # ── WL-менеджеры: вход ───────────────────────────────────────────────────
    if action == "wl-login" and method == "POST":
        email    = (body.get("email") or "").strip().lower()
        password = (body.get("password") or "").strip()
        if not email or not password:
            return err("Email и пароль обязательны")
        cur.execute(f"SELECT id, name, wl_role, approved, password_hash FROM {SCHEMA}.wl_managers WHERE email = %s", (email,))
        row = cur.fetchone()
        if not row: return err("Неверный email или пароль")
        mgr_id, mgr_name, wl_role, approved, pwd_hash = row
        if not verify_password(password, pwd_hash): return err("Неверный email или пароль")
        if not approved: return err("Аккаунт ожидает одобрения мастера")
        if needs_rehash(pwd_hash):
            cur.execute(f"UPDATE {SCHEMA}.wl_managers SET password_hash=%s WHERE id=%s", (hash_password(password), mgr_id))
        tok = secrets.token_hex(32)
        cur.execute(f"INSERT INTO {SCHEMA}.wl_manager_sessions (manager_id, token, expires_at) VALUES (%s, %s, NOW() + INTERVAL '30 days')", (mgr_id, tok))
        conn.commit()
        return ok({"token": tok, "manager": {"id": mgr_id, "name": mgr_name, "email": email, "wl_role": wl_role}})

    # ── WL-менеджеры: кто я ──────────────────────────────────────────────────
    if action == "wl-me" and method == "GET":
        if not token: return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT m.id, m.name, m.email, m.wl_role, m.approved FROM {SCHEMA}.wl_managers m
            JOIN {SCHEMA}.wl_manager_sessions s ON s.manager_id = m.id
            WHERE s.token = %s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row: return err("Сессия не найдена", 401)
        mgr_id, mgr_name, mgr_email, wl_role, approved = row
        if not approved: return err("Аккаунт не одобрен", 403)
        return ok({"manager": {"id": mgr_id, "name": mgr_name, "email": mgr_email, "wl_role": wl_role}})

    # ── WL-менеджеры: список ─────────────────────────────────────────────────
    if action == "wl-staff-list" and method == "GET":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        cur.execute(f"""
            SELECT id, name, email, wl_role, approved, created_at,
                   (SELECT COUNT(*) FROM {SCHEMA}.demo_companies dc WHERE dc.manager_id = m.id) AS companies_count
            FROM {SCHEMA}.wl_managers m ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        return ok({"staff": [{"id": r[0], "name": r[1], "email": r[2], "wl_role": r[3],
                               "approved": r[4], "created_at": str(r[5])[:10],
                               "companies_count": int(r[6] or 0)} for r in rows]})

    # ── WL-менеджеры: добавить ───────────────────────────────────────────────
    if action == "wl-staff-invite" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        name     = (body.get("name") or "").strip()
        email    = (body.get("email") or "").strip().lower()
        password = (body.get("password") or "").strip()
        wl_role  = body.get("wl_role", "manager")
        if wl_role not in ("manager", "master_manager"): wl_role = "manager"
        if not name or not email or not password: return err("Имя, email и пароль обязательны")
        cur.execute(f"SELECT id FROM {SCHEMA}.wl_managers WHERE email=%s", (email,))
        if cur.fetchone(): return err("Менеджер с таким email уже существует")
        cur.execute(f"""
            INSERT INTO {SCHEMA}.wl_managers (name, email, password_hash, wl_role, approved)
            VALUES (%s, %s, %s, %s, TRUE) RETURNING id
        """, (name, email, hash_password(password), wl_role))
        new_id = cur.fetchone()[0]
        conn.commit()
        return ok({"id": new_id, "name": name, "email": email, "wl_role": wl_role, "approved": False})

    # ── WL-менеджеры: одобрить ───────────────────────────────────────────────
    if action == "wl-staff-approve" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        mgr_id   = body.get("id")
        approved = body.get("approved")
        wl_role  = body.get("wl_role")
        if mgr_id is None: return err("id обязателен")
        sets, vals = [], []
        if approved is not None: sets.append("approved = %s"); vals.append(bool(approved))
        if wl_role in ("manager", "master_manager"): sets.append("wl_role = %s"); vals.append(wl_role)
        if not sets: return err("Нечего обновлять")
        vals.append(int(mgr_id))
        cur.execute(f"UPDATE {SCHEMA}.wl_managers SET {', '.join(sets)} WHERE id = %s", vals)
        conn.commit()
        return ok({"ok": True})

    # ── WL-менеджеры: удалить ────────────────────────────────────────────────
    if action == "wl-staff-delete" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        mgr_id = body.get("id")
        if not mgr_id: return err("id обязателен")
        cur.execute(f"DELETE FROM {SCHEMA}.wl_managers WHERE id = %s", (int(mgr_id),))
        conn.commit()
        return ok({"ok": True})

    # ── WL-менеджеры: редактировать ──────────────────────────────────────────
    if action == "wl-staff-update" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        mgr_id    = body.get("id")
        if not mgr_id: return err("id обязателен")
        name      = (body.get("name") or "").strip()
        email_new = (body.get("email") or "").strip().lower()
        password  = (body.get("password") or "").strip()
        wl_role   = body.get("wl_role")
        sets, vals = [], []
        if name: sets.append("name = %s"); vals.append(name)
        if email_new:
            cur.execute(f"SELECT id FROM {SCHEMA}.wl_managers WHERE email=%s AND id != %s", (email_new, int(mgr_id)))
            if cur.fetchone(): return err("Менеджер с таким email уже существует")
            sets.append("email = %s"); vals.append(email_new)
        if password: sets.append("password_hash = %s"); vals.append(hash_password(password))
        if wl_role in ("manager", "master_manager"): sets.append("wl_role = %s"); vals.append(wl_role)
        if not sets: return err("Нечего обновлять")
        vals.append(int(mgr_id))
        cur.execute(f"UPDATE {SCHEMA}.wl_managers SET {', '.join(sets)} WHERE id = %s", vals)
        conn.commit()
        return ok({"ok": True})

    # ── WL: назначить компанию ───────────────────────────────────────────────
    if action == "wl-assign-company" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        demo_id    = body.get("demo_id")
        manager_id = body.get("manager_id")
        if not demo_id: return err("demo_id обязателен")
        cur.execute(f"UPDATE {SCHEMA}.demo_companies SET manager_id = %s WHERE id = %s", (manager_id, int(demo_id)))
        conn.commit()
        return ok({"ok": True})

    # ── WL: порядок компаний ─────────────────────────────────────────────────
    if action == "wl-reorder" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.email FROM {SCHEMA}.user_sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        master_row = cur.fetchone()
        is_wl_master = master_row and master_row[0] == MASTER_EMAIL
        if not is_wl_master:
            cur.execute(f"""
                SELECT m.id FROM {SCHEMA}.wl_managers m JOIN {SCHEMA}.wl_manager_sessions s ON s.manager_id = m.id
                WHERE s.token=%s AND s.expires_at > NOW() AND m.approved = TRUE
            """, (token,))
            if not cur.fetchone(): return err("Доступ запрещён", 403)
        ordered_ids = body.get("ordered_ids", [])
        if not ordered_ids: return err("ordered_ids обязателен")
        for i, demo_id_item in enumerate(ordered_ids):
            cur.execute(f"UPDATE {SCHEMA}.demo_companies SET sort_order = %s WHERE id = %s", (i + 1, int(demo_id_item)))
        conn.commit()
        return ok({"ok": True})

    # ── WL: список демо-компаний (для мастера/менеджера) ─────────────────────
    if action == "admin-wl-companies" and method == "GET":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        cur.execute(f"""
            SELECT id, email, name, company_name, bot_name, brand_color,
                   support_phone, estimates_balance, created_at, agent_purchased_at
            FROM {SCHEMA}.users WHERE has_own_agent = TRUE AND removed_at IS NULL
            ORDER BY agent_purchased_at DESC NULLS LAST, id DESC
        """)
        rows = cur.fetchall()
        return ok({"companies": [{"id": r[0], "email": r[1] or "", "name": r[2] or "",
                                   "company_name": r[3] or "", "bot_name": r[4] or "",
                                   "brand_color": r[5] or "#8b5cf6", "support_phone": r[6] or "",
                                   "estimates_balance": r[7] or 0,
                                   "created_at": str(r[8])[:10] if r[8] else "",
                                   "purchased_at": str(r[9])[:10] if r[9] else ""} for r in rows]})

    # ── Создать демо-компанию ────────────────────────────────────────────────
    if action == "admin-create-demo-company" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        site_url     = body.get("site_url", "").strip()
        company_name = body.get("company_name", "").strip() or "Демо-компания"
        brand        = body.get("brand", {}) or {}
        if not site_url: return err("site_url обязателен")
        slug = re.sub(r"https?://", "", site_url).split("/")[0].replace(".", "-")
        demo_email = f"demo-{slug}-{secrets.token_hex(4)}@demo.local"
        temp_pass  = secrets.token_urlsafe(10)
        cur.execute(f"""
            INSERT INTO {SCHEMA}.users
              (email, password_hash, name, role, approved, has_own_agent,
               estimates_balance, agent_purchased_at,
               company_name, bot_name, bot_greeting,
               brand_color, brand_logo_url, bot_avatar_url,
               support_phone, support_email, telegram, website,
               working_hours, pdf_footer_address)
            VALUES (%s,%s,%s,'company',TRUE,TRUE, 10, NOW(),
                    %s,%s,%s, %s,%s,%s, %s,%s,%s,%s, %s,%s) RETURNING id
        """, (
            demo_email, hash_password(temp_pass), company_name,
            company_name,
            brand.get("bot_name") or company_name,
            brand.get("bot_greeting") or f"Здравствуйте! Я помощник компании «{company_name}».",
            brand.get("brand_color") or "#8b5cf6",
            brand.get("brand_logo_url"), brand.get("bot_avatar_url"),
            brand.get("support_phone"), brand.get("support_email"),
            brand.get("telegram"), brand.get("website"),
            brand.get("working_hours"), brand.get("pdf_footer_address"),
        ))
        new_id = cur.fetchone()[0]
        new_token = secrets.token_hex(32)
        cur.execute(f"INSERT INTO {SCHEMA}.user_sessions (user_id, token, expires_at) VALUES (%s, %s, NOW() + INTERVAL '30 days')", (new_id, new_token))
        cur.execute(f"INSERT INTO {SCHEMA}.demo_companies (site_url, company_id) VALUES (%s, %s)", (site_url, new_id))
        conn.commit()
        return ok({"company_id": new_id, "token": new_token, "email": demo_email, "password": temp_pass})

    # ── Список демо-компаний ─────────────────────────────────────────────────
    if action == "admin-demo-companies" and method == "GET":
        if not token: return err("Требуется авторизация", 401)
        is_master_user = False
        wl_manager_row = None
        cur.execute(f"""
            SELECT m.id, m.wl_role, m.approved, m.email FROM {SCHEMA}.wl_managers m
            JOIN {SCHEMA}.wl_manager_sessions s ON s.manager_id = m.id
            WHERE s.token = %s AND s.expires_at > NOW()
        """, (token,))
        wl_row = cur.fetchone()
        if wl_row:
            if not wl_row[2]: return err("Аккаунт не одобрен", 403)
            if wl_row[3] == MASTER_EMAIL or wl_row[1] == "master_manager": is_master_user = True
            else: wl_manager_row = wl_row
        else:
            cur.execute(f"""
                SELECT u.email FROM {SCHEMA}.user_sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id
                WHERE s.token=%s AND s.expires_at > NOW()
            """, (token,))
            user_row = cur.fetchone()
            if user_row and user_row[0] == MASTER_EMAIL: is_master_user = True
            else: return err("Доступ запрещён", 403)

        if is_master_user:
            manager_filter, filter_params = "", ()
        elif wl_manager_row and wl_manager_row[1] == "master_manager":
            manager_filter, filter_params = "", ()
        else:
            manager_filter = "AND dc.manager_id = %s"
            filter_params  = (wl_manager_row[0],)

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
                   dc.manager_id, wm.name AS manager_name,
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
              dc.sort_order ASC, dc.created_at DESC
        """, filter_params)
        rows = cur.fetchall()
        return ok({"companies": [{
            "demo_id": r[0], "site_url": r[1], "created_at": str(r[2])[:16] if r[2] else "",
            "company_id": r[3], "email": r[4] or "", "company_name": r[5] or "",
            "bot_name": r[6] or "", "brand_color": r[7] or "",
            "support_phone": r[8] or "", "estimates_balance": r[9] or 0,
            "has_own_agent": bool(r[10]), "brand_logo_url": r[11] or "",
            "deleted": r[12] is not None, "status": r[13] or "new",
            "contact_name": r[14] or "", "contact_phone": r[15] or "",
            "contact_position": r[16] or "", "notes": r[17] or "",
            "next_action": r[18] or "", "next_action_date": str(r[19]) if r[19] else "",
            "trial_until": str(r[20])[:10] if r[20] else None,
            "agent_purchased_at": str(r[21])[:10] if r[21] else None,
            "estimates_used": int(r[22] or 0),
            "presentation_at": str(r[23])[:16] if r[23] else None,
            "manager_id": r[24], "manager_name": r[25] or "",
            "bot_avatar_url": r[26] or "", "support_email": r[27] or "",
            "telegram_url": r[28] or "", "working_hours": r[29] or "",
            "pdf_footer_address": r[30] or "",
        } for r in rows]})

    # ── Обновить демо-компанию ────────────────────────────────────────────────
    if action == "admin-update-demo" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        demo_id = body.get("demo_id")
        if not demo_id: return err("demo_id обязателен")
        dc_allowed = ["status", "contact_name", "contact_phone", "contact_position",
                      "notes", "next_action", "next_action_date"]
        u_allowed  = ["company_name", "bot_name", "brand_color", "support_phone",
                      "support_email", "telegram", "website", "working_hours", "pdf_footer_address"]
        dc_sets, dc_vals = [], []
        u_sets, u_vals   = [], []
        for key in dc_allowed:
            if key in body:
                dc_sets.append(f"{key} = %s")
                dc_vals.append(body[key] if body[key] not in ("", None) else None)
        for key in u_allowed:
            if key in body:
                u_sets.append(f"{key} = %s")
                val = body[key]
                u_vals.append(str(val).strip() if val not in ("", None) else None)
        if dc_sets:
            dc_vals.append(int(demo_id))
            cur.execute(f"UPDATE {SCHEMA}.demo_companies SET {', '.join(dc_sets)} WHERE id = %s", dc_vals)
        if u_sets:
            cur.execute(f"SELECT company_id FROM {SCHEMA}.demo_companies WHERE id=%s", (int(demo_id),))
            cid_row = cur.fetchone()
            if cid_row:
                u_vals.append(cid_row[0])
                cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(u_sets)} WHERE id = %s", u_vals)
        conn.commit()
        return ok({"ok": True})

    # ── Удалить демо-компанию ─────────────────────────────────────────────────
    if action == "admin-delete-demo-company" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        demo_id = body.get("demo_id")
        if not demo_id: return err("demo_id обязателен")
        cur.execute(f"SELECT company_id FROM {SCHEMA}.demo_companies WHERE id=%s", (int(demo_id),))
        row = cur.fetchone()
        if not row: return err("Демо-компания не найдена", 404)
        company_id = row[0]
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET removed_at=NOW(), removed_name=name, removed_email=email,
                email=CONCAT('_removed_', id, '_', email)
            WHERE id=%s AND removed_at IS NULL
        """, (company_id,))
        conn.commit()
        return ok({"ok": True})

    # ── Активировать агента ───────────────────────────────────────────────────
    if action == "admin-activate-agent" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        company_id = body.get("company_id")
        if not company_id: return err("company_id обязателен")
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET has_own_agent=TRUE, agent_purchased_at=COALESCE(agent_purchased_at, NOW())
            WHERE id=%s
        """, (int(company_id),))
        conn.commit()
        return ok({"ok": True})

    # ── Загрузить чек оплаты ──────────────────────────────────────────────────
    if action == "admin-upload-receipt" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        demo_id      = body.get("demo_id")
        image_b64    = body.get("image_b64", "")
        image_ext    = body.get("image_ext", "jpg")
        company_name = body.get("company_name", "Компания")
        company_cid  = body.get("company_id", "")
        if not demo_id or not image_b64: return err("demo_id и image_b64 обязательны")
        img_bytes = base64.b64decode(image_b64)
        s3 = boto3.client("s3", endpoint_url="https://bucket.poehali.dev",
                          aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                          aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])
        key = f"receipts/receipt_{demo_id}_{secrets.token_hex(4)}.{image_ext}"
        ct  = "image/jpeg" if image_ext in ("jpg", "jpeg") else "image/png" if image_ext == "png" else "application/octet-stream"
        s3.put_object(Bucket="files", Key=key, Body=img_bytes, ContentType=ct)
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        cur.execute(f"UPDATE {SCHEMA}.demo_companies SET payment_receipt_url=%s, status='paid' WHERE id=%s", (cdn_url, int(demo_id)))
        conn.commit()
        tg_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        tg_chat  = os.environ.get("TELEGRAM_OWNER_CHAT_ID", "")
        if tg_token and tg_chat:
            caption = f"💰 Оплатили агента!\n\n🏢 {company_name}\nID #{company_cid}\n\nЧек приложен."
            try:
                payload = json.dumps({"chat_id": tg_chat, "photo": cdn_url, "caption": caption}).encode()
                req = _ureq.Request(f"https://api.telegram.org/bot{tg_token}/sendPhoto",
                                    data=payload, headers={"Content-Type": "application/json"}, method="POST")
                _ureq.urlopen(req, timeout=10)
            except Exception as e:
                print(f"[receipt] TG send error: {e}")
        return ok({"ok": True, "receipt_url": cdn_url})

    # ── Презентации: занятые слоты ────────────────────────────────────────────
    if action == "demo-busy-slots" and method == "GET":
        date_str = params.get("date")
        cur.execute(f"""
            SELECT scheduled_at FROM {SCHEMA}.demo_presentations
            WHERE status = 'scheduled'
            AND scheduled_at >= %s::date - INTERVAL '1 day'
            AND scheduled_at <  %s::date + INTERVAL '2 days'
        """, (date_str, date_str))
        rows = cur.fetchall()
        MSK = timezone(timedelta(hours=3))
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        busy_hours = []
        for (scheduled_at,) in rows:
            dt_utc = scheduled_at.replace(tzinfo=timezone.utc) if scheduled_at.tzinfo is None else scheduled_at
            dt_msk = dt_utc.astimezone(MSK)
            if dt_msk.date() == target_date:
                busy_hours.append(dt_msk.hour)
        return ok({"busy_hours": busy_hours})

    # ── Презентации: список ───────────────────────────────────────────────────
    if action == "demo-presentations" and method == "GET":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        month = params.get("month")
        year  = params.get("year")
        base_select = f"""
            SELECT dp.id, dp.demo_id, dp.scheduled_at, dp.duration_min,
                   dp.notes, dp.status, dp.created_at,
                   dc.site_url, u.company_name, u.brand_color, u.brand_logo_url,
                   dc.contact_name, dc.contact_phone
            FROM {SCHEMA}.demo_presentations dp
            JOIN {SCHEMA}.demo_companies dc ON dc.id = dp.demo_id
            JOIN {SCHEMA}.users u ON u.id = dc.company_id
        """
        if month and year:
            cur.execute(base_select + " WHERE EXTRACT(MONTH FROM dp.scheduled_at) = %s AND EXTRACT(YEAR FROM dp.scheduled_at) = %s ORDER BY dp.scheduled_at",
                        (int(month), int(year)))
        else:
            cur.execute(base_select + " WHERE dp.status = 'scheduled' ORDER BY dp.scheduled_at")
        rows = cur.fetchall()
        return ok({"presentations": [{
            "id": r[0], "demo_id": r[1], "scheduled_at": str(r[2]),
            "duration_min": r[3], "notes": r[4] or "", "status": r[5],
            "created_at": str(r[6]), "site_url": r[7] or "",
            "company_name": r[8] or "", "brand_color": r[9] or "#8b5cf6",
            "brand_logo_url": r[10] or "", "contact_name": r[11] or "",
            "contact_phone": r[12] or "",
        } for r in rows]})

    # ── Презентации: запланировать ────────────────────────────────────────────
    if action == "demo-schedule-presentation" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        demo_id      = body.get("demo_id")
        scheduled_at = body.get("scheduled_at")
        duration_min = int(body.get("duration_min", 60))
        notes        = (body.get("notes") or "").strip()
        if not demo_id or not scheduled_at: return err("demo_id и scheduled_at обязательны")
        MSK = timezone(timedelta(hours=3))
        new_dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        new_msk = new_dt.astimezone(MSK)
        hour_start = new_msk.replace(minute=0, second=0, microsecond=0)
        hour_end   = hour_start + timedelta(hours=1)
        cur.execute(f"""
            SELECT scheduled_at FROM {SCHEMA}.demo_presentations
            WHERE status = 'scheduled' AND scheduled_at >= %s AND scheduled_at < %s
        """, (hour_start.astimezone(timezone.utc), hour_end.astimezone(timezone.utc)))
        if cur.fetchone(): return err("В это время уже запланирован показ")
        cur.execute(f"""
            INSERT INTO {SCHEMA}.demo_presentations (demo_id, scheduled_at, duration_min, notes)
            VALUES (%s, %s, %s, %s) RETURNING id
        """, (int(demo_id), scheduled_at, duration_min, notes or None))
        pres_id = cur.fetchone()[0]
        cur.execute(f"UPDATE {SCHEMA}.demo_companies SET status = 'presentation' WHERE id = %s", (int(demo_id),))
        conn.commit()
        return ok({"ok": True, "presentation_id": pres_id})

    # ── Презентации: отметить проведённой ────────────────────────────────────
    if action == "demo-mark-presented" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        demo_id = body.get("demo_id")
        if not demo_id: return err("demo_id обязателен")
        cur.execute(f"""
            UPDATE {SCHEMA}.demo_presentations SET status = 'done'
            WHERE demo_id = %s AND status = 'scheduled' RETURNING scheduled_at
        """, (int(demo_id),))
        pres_row = cur.fetchone()
        if pres_row:
            call_at   = pres_row[0] + timedelta(hours=4)
            call_date = call_at.date().isoformat()
        else:
            call_date = (datetime.now(timezone.utc) + timedelta(hours=4)).date().isoformat()
        cur.execute(f"""
            UPDATE {SCHEMA}.demo_companies
            SET status = 'presented',
                next_action = 'Связаться с клиентом после презентации',
                next_action_date = %s
            WHERE id = %s
        """, (call_date, int(demo_id)))
        conn.commit()
        return ok({"ok": True, "next_action_date": call_date})

    # ── Презентации: перенести ────────────────────────────────────────────────
    if action == "demo-reschedule-presentation" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        pres_id      = body.get("presentation_id")
        scheduled_at = body.get("scheduled_at")
        duration_min = body.get("duration_min")
        notes        = body.get("notes")
        if not pres_id or not scheduled_at: return err("presentation_id и scheduled_at обязательны")
        MSK = timezone(timedelta(hours=3))
        new_dt2  = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        new_msk2 = new_dt2.astimezone(MSK)
        hs2 = new_msk2.replace(minute=0, second=0, microsecond=0)
        he2 = hs2 + timedelta(hours=1)
        cur.execute(f"""
            SELECT scheduled_at FROM {SCHEMA}.demo_presentations
            WHERE status = 'scheduled' AND id != %s AND scheduled_at >= %s AND scheduled_at < %s
        """, (int(pres_id), hs2.astimezone(timezone.utc), he2.astimezone(timezone.utc)))
        if cur.fetchone(): return err("В это время уже запланирован показ")
        sets = ["scheduled_at = %s"]
        vals = [scheduled_at]
        if duration_min is not None: sets.append("duration_min = %s"); vals.append(int(duration_min))
        if notes is not None: sets.append("notes = %s"); vals.append(notes.strip() or None)
        vals.append(int(pres_id))
        cur.execute(f"UPDATE {SCHEMA}.demo_presentations SET {', '.join(sets)} WHERE id = %s", vals)
        conn.commit()
        return ok({"ok": True})

    # ── Демо-доступ: выдаём токен единого общего демо-аккаунта ──────────────
    if action == "create-demo" and method == "POST":
        # Ищем общий демо-аккаунт по флагу is_demo_master
        cur.execute(f"""
            SELECT id, email, name FROM {SCHEMA}.users
            WHERE is_demo = TRUE AND company_name = 'demo_master'
            LIMIT 1
        """)
        master_row = cur.fetchone()
        if not master_row:
            return err("Демо-режим временно недоступен", 503)
        user_id, demo_email, demo_name = master_row

        # Создаём короткую сессию на 24 часа (read-only показ)
        new_token = secrets.token_hex(32)
        cur.execute(f"""
            INSERT INTO {SCHEMA}.user_sessions (user_id, token, expires_at)
            VALUES (%s, %s, NOW() + INTERVAL '24 hours')
        """, (user_id, new_token))
        conn.commit()
        return ok({"token": new_token, "user": {
            "id": user_id, "email": demo_email, "name": "Демо-пользователь",
            "role": "company", "approved": True, "discount": 0,
            "is_demo": True, "is_master": False,
            "has_own_agent": False, "estimates_balance": 999, "demo_expires_at": None,
        }})

    # ── Очистка просроченных демо ─────────────────────────────────────────────
    if action == "cleanup-demo" and method == "POST":
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE is_demo = TRUE AND demo_expires_at < NOW()")
        expired_ids = [r[0] for r in cur.fetchall()]
        if not expired_ids: return ok({"deleted": 0})
        ids_sql = ",".join(str(i) for i in expired_ids)
        cur.execute(f"DELETE FROM {SCHEMA}.user_sessions WHERE user_id IN ({ids_sql})")
        cur.execute(f"DELETE FROM {SCHEMA}.saved_estimates WHERE user_id IN ({ids_sql})")
        cur.execute(f"DELETE FROM {SCHEMA}.balance_transactions WHERE user_id IN ({ids_sql})")
        cur.execute(f"DELETE FROM {SCHEMA}.live_chats WHERE company_id IN ({ids_sql})")
        cur.execute(f"DELETE FROM {SCHEMA}.kanban_cards WHERE company_id IN ({ids_sql})")
        cur.execute(f"DELETE FROM {SCHEMA}.plan_projects WHERE company_id IN ({ids_sql})")
        cur.execute(f"DELETE FROM {SCHEMA}.kanban_columns WHERE company_id IN ({ids_sql})")
        cur.execute(f"DELETE FROM {SCHEMA}.users WHERE id IN ({ids_sql})")
        conn.commit()
        return ok({"deleted": len(expired_ids)})

    return None