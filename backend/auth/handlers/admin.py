import secrets as _sec
from shared import SCHEMA, ok, err, check_is_master, hash_password


PACKAGES = {
    "start":    {"name": "Старт",    "estimates": 5,   "price": 490},
    "standard": {"name": "Стандарт", "estimates": 20,  "price": 990},
    "pro":      {"name": "Про",      "estimates": 60,  "price": 1990},
    "business": {"name": "Бизнес",   "estimates": 150, "price": 3990},
}


def handle(action, method, params, body, token, event, conn, cur):

    if action == "packages" and method == "GET":
        return ok({"packages": [{"id": k, **v} for k, v in PACKAGES.items()]})

    if action == "check-master" and method == "GET":
        if not token: return ok({"is_master": False})
        return ok({"is_master": check_is_master(token, cur, SCHEMA)})

    if action == "pending-users" and method == "GET":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        role_filter = params.get("role_group", "business")
        roles = ("installer", "company") if role_filter == "business" else ("designer", "foreman")
        cur.execute(f"""
            SELECT id, email, name, phone, role, discount, created_at
            FROM {SCHEMA}.users WHERE role = ANY(%s) AND approved = false ORDER BY created_at DESC
        """, (list(roles),))
        rows = cur.fetchall()
        return ok({"users": [{"id": r[0], "email": r[1], "name": r[2], "phone": r[3],
                               "role": r[4], "discount": r[5] or 0, "created_at": str(r[6])[:19]} for r in rows]})

    if action == "pro-users" and method == "GET":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        cur.execute(f"""
            SELECT id, email, name, phone, role, approved, discount, created_at FROM {SCHEMA}.users
            WHERE role IN ('designer', 'foreman') AND removed_at IS NULL ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        return ok({"users": [{"id": r[0], "email": r[1], "name": r[2], "phone": r[3],
                               "role": r[4], "approved": r[5], "discount": r[6] or 0,
                               "created_at": str(r[7])[:19]} for r in rows]})

    if action == "approve-user" and method == "POST":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        user_id = body.get("user_id")
        if not user_id: return err("user_id required")
        cur.execute(f"UPDATE {SCHEMA}.users SET approved=true, rejected=false WHERE id=%s", (int(user_id),))
        conn.commit()
        return ok({"ok": True})

    if action == "reject-user" and method == "POST":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        user_id = body.get("user_id")
        if not user_id: return err("user_id required")
        cur.execute(f"UPDATE {SCHEMA}.users SET approved=false, rejected=true WHERE id=%s", (int(user_id),))
        conn.commit()
        return ok({"ok": True})

    if action == "set-discount" and method == "POST":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        user_id  = body.get("user_id")
        discount = body.get("discount")
        if user_id is None or discount is None: return err("user_id и discount обязательны")
        cur.execute(f"UPDATE {SCHEMA}.users SET discount=%s WHERE id=%s", (int(discount), int(user_id)))
        conn.commit()
        return ok({"ok": True})

    if action == "business-users" and method == "GET":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        sf = params.get("status", "all")
        if sf == "pending":   where = "WHERE role IN ('installer','company') AND approved=false AND rejected=false AND removed_at IS NULL"
        elif sf == "approved": where = "WHERE role IN ('installer','company') AND approved=true AND removed_at IS NULL"
        elif sf == "rejected": where = "WHERE role IN ('installer','company') AND rejected=true AND removed_at IS NULL"
        else:                  where = "WHERE role IN ('installer','company') AND removed_at IS NULL"
        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone, u.role, u.approved, u.rejected, u.discount,
                   u.created_at, u.estimates_balance,
                   u.has_own_agent, u.agent_purchased_at, u.trial_until,
                   COALESCE(SUM(CASE WHEN bt.amount > 0 THEN bt.amount ELSE 0 END), 0) AS total_bought,
                   EXISTS(SELECT 1 FROM {SCHEMA}.demo_companies dc WHERE dc.company_id = u.id) AS invited_by_master,
                   (SELECT COUNT(*) FROM {SCHEMA}.users m WHERE m.company_id = u.id AND m.role = 'manager' AND m.removed_at IS NULL) AS members_count
            FROM {SCHEMA}.users u LEFT JOIN {SCHEMA}.balance_transactions bt ON bt.user_id = u.id
            {where} GROUP BY u.id ORDER BY u.created_at DESC
        """)
        rows = cur.fetchall()
        return ok({"users": [{
            "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
            "role": r[4], "approved": r[5], "rejected": r[6], "discount": r[7] or 0,
            "created_at": str(r[8])[:19],
            "estimates_balance": r[9] or 0, "has_own_agent": bool(r[10]),
            "agent_purchased_at": str(r[11])[:19] if r[11] else None,
            "trial_until": str(r[12])[:19] if r[12] else None,
            "total_bought": int(r[13] or 0),
            "source": "invited" if r[14] else "self",
            "members_count": int(r[15] or 0),
        } for r in rows]})

    if action == "admin-user-transactions" and method == "GET":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        uid = params.get("user_id")
        if not uid: return err("user_id обязателен")
        cur.execute(f"""
            SELECT id, amount, reason, created_at FROM {SCHEMA}.balance_transactions
            WHERE user_id = %s ORDER BY created_at DESC LIMIT 50
        """, (int(uid),))
        rows = cur.fetchall()
        return ok({"transactions": [{"id": r[0], "amount": r[1], "reason": r[2] or "",
                                      "created_at": str(r[3])[:19] if r[3] else ""} for r in rows]})

    if action == "admin-users" and method == "GET":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone, u.role, u.approved, u.discount, u.created_at,
                   COUNT(e.id) as estimates_count, u.rejected,
                   u.estimates_balance, u.trial_until, u.has_own_agent, u.agent_purchased_at,
                   EXISTS(SELECT 1 FROM {SCHEMA}.demo_companies dc WHERE dc.company_id = u.id) AS invited_by_master,
                   u.company_id
            FROM {SCHEMA}.users u LEFT JOIN {SCHEMA}.saved_estimates e ON e.user_id = u.id
            WHERE u.removed_at IS NULL GROUP BY u.id ORDER BY u.created_at DESC
        """)
        rows = cur.fetchall()
        return ok({"users": [{
            "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
            "role": r[4] or "client", "approved": r[5], "discount": r[6] or 0,
            "created_at": str(r[7])[:19], "estimates_count": r[8], "rejected": r[9] or False,
            "estimates_balance": r[10] or 0,
            "trial_until": str(r[11])[:19] if r[11] else None,
            "has_own_agent": bool(r[12]),
            "agent_purchased_at": str(r[13])[:19] if r[13] else None,
            "source": "invited" if r[14] else "self",
            "company_id": r[15],
        } for r in rows]})

    if action == "admin-toggle-own-agent" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        user_id = body.get("user_id")
        enable  = bool(body.get("enable"))
        if not user_id: return err("user_id обязателен")
        uid = int(user_id)
        if enable:
            cur.execute(f"""
                UPDATE {SCHEMA}.users
                SET has_own_agent=TRUE, agent_purchased_at=COALESCE(agent_purchased_at, NOW()), trial_until=NULL
                WHERE id=%s
            """, (uid,))
        else:
            cur.execute(f"UPDATE {SCHEMA}.users SET has_own_agent=FALSE WHERE id=%s", (uid,))
        conn.commit()
        return ok({"ok": True, "has_own_agent": enable})

    if action == "admin-login-as" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        target_id = body.get("user_id")
        if not target_id: return err("user_id обязателен")
        new_token = _sec.token_hex(32)
        cur.execute(f"""
            INSERT INTO {SCHEMA}.user_sessions (user_id, token, expires_at)
            VALUES (%s, %s, NOW() + INTERVAL '8 hours')
        """, (int(target_id), new_token))
        conn.commit()
        return ok({"token": new_token})

    if action == "admin-ensure-balance" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        target_id = body.get("user_id")
        if not target_id: return err("user_id обязателен")
        cur.execute(f"SELECT estimates_balance FROM {SCHEMA}.users WHERE id=%s", (int(target_id),))
        row = cur.fetchone()
        if not row: return err("Пользователь не найден", 404)
        balance     = row[0] or 0
        min_balance = body.get("min_balance", 5)
        added = 0
        if balance < min_balance:
            added = min_balance - balance
            cur.execute(f"UPDATE {SCHEMA}.users SET estimates_balance = %s, trial_until = NULL WHERE id=%s", (min_balance, int(target_id)))
            cur.execute(f"INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, reason) VALUES (%s, %s, 'admin_top_up')", (int(target_id), added))
            conn.commit()
        if body.get("sync_name"):
            cur.execute(f"UPDATE {SCHEMA}.users SET name = company_name WHERE id = %s AND company_name IS NOT NULL AND company_name != ''", (int(target_id),))
            conn.commit()
        return ok({"balance_before": balance, "balance_after": max(balance, min_balance), "added": added})

    if action == "admin-user-estimates" and method == "GET":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        user_id = params.get("user_id")
        if not user_id: return err("user_id required")
        cur.execute(f"""
            SELECT e.id, e.title, e.total_standard, e.status, e.created_at, lc.status
            FROM {SCHEMA}.saved_estimates e LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = e.chat_id
            WHERE e.user_id = %s ORDER BY e.created_at DESC
        """, (int(user_id),))
        rows = cur.fetchall()
        return ok({"estimates": [{"id": r[0], "title": r[1],
                                   "total_standard": float(r[2]) if r[2] else None,
                                   "status": r[3], "created_at": str(r[4])[:19], "crm_status": r[5]} for r in rows]})

    if action == "add-balance" and method == "POST":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        user_id = body.get("user_id")
        amount  = body.get("amount")
        reason  = body.get("reason", "admin_manual")
        if not user_id or amount is None: return err("user_id и amount обязательны")
        uid = int(user_id); amt = int(amount)
        cur.execute(f"UPDATE {SCHEMA}.users SET estimates_balance = estimates_balance + %s WHERE id=%s", (amt, uid))
        cur.execute(f"INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, reason) VALUES (%s, %s, %s)", (uid, amt, reason))
        conn.commit()
        cur.execute(f"SELECT estimates_balance FROM {SCHEMA}.users WHERE id=%s", (uid,))
        new_bal = cur.fetchone()[0] or 0
        return ok({"ok": True, "estimates_balance": new_bal})

    if action == "balance-history" and method == "GET":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        user_id = params.get("user_id")
        if not user_id: return err("user_id required")
        cur.execute(f"""
            SELECT id, amount, reason, created_at FROM {SCHEMA}.balance_transactions
            WHERE user_id=%s ORDER BY created_at DESC LIMIT 50
        """, (int(user_id),))
        rows = cur.fetchall()
        return ok({"history": [{"id": r[0], "amount": r[1], "reason": r[2], "created_at": str(r[3])[:19]} for r in rows]})

    if action == "delete-user" and method == "POST":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        user_id = body.get("user_id")
        if not user_id: return err("user_id required")
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET removed_at=NOW(), removed_name=name, removed_email=email,
                email=CONCAT('_removed_', id, '_', email)
            WHERE id=%s AND removed_at IS NULL
        """, (int(user_id),))
        conn.commit()
        return ok({"ok": True})

    if action == "restore-user" and method == "POST":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        user_id = body.get("user_id")
        if not user_id: return err("user_id required")
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET email=removed_email, removed_at=NULL, removed_name=NULL, removed_email=NULL
            WHERE id=%s AND removed_at IS NOT NULL
        """, (int(user_id),))
        conn.commit()
        return ok({"ok": True})

    if action == "removed-users" and method == "GET":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        role_group = params.get("group", "all")
        if role_group == "business":   where = "WHERE role IN ('installer','company') AND removed_at IS NOT NULL"
        elif role_group == "pro":      where = "WHERE role IN ('designer','foreman') AND removed_at IS NOT NULL"
        else:                          where = "WHERE removed_at IS NOT NULL"
        cur.execute(f"""
            SELECT id, removed_email, removed_name, role, removed_at, approved, rejected, discount,
                   created_at
            FROM {SCHEMA}.users {where} ORDER BY removed_at DESC
        """)
        rows = cur.fetchall()
        return ok({"users": [{
            "id": r[0], "email": r[1] or "", "name": r[2], "role": r[3],
            "removed_at": str(r[4])[:19], "approved": r[5], "rejected": r[6], "discount": r[7] or 0,
            "created_at": str(r[8])[:19],
        } for r in rows]})

    if action == "admin-stats" and method == "GET":
        if not check_is_master(token, cur, SCHEMA): return err("Доступ только для мастера", 403)
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
        total_users = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE role IN ('installer','company') AND approved=false AND rejected=false")
        pending = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE role IN ('installer','company') AND estimates_balance > 0 AND removed_at IS NULL")
        active_subs = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.saved_estimates")
        total_estimates = cur.fetchone()[0]
        cur.execute(f"""
            SELECT id, email, name, phone, role, trial_until, telegram FROM {SCHEMA}.users
            WHERE role IN ('installer','company') AND removed_at IS NULL
              AND trial_until > NOW() AND trial_until < NOW() + INTERVAL '3 days'
              AND estimates_balance <= 0
            ORDER BY trial_until ASC
        """)
        expiring = cur.fetchall()
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at > NOW() - INTERVAL '7 days'")
        new_week = cur.fetchone()[0]
        cur.execute(f"SELECT role, COUNT(*) FROM {SCHEMA}.users GROUP BY role")
        by_role = {r[0]: r[1] for r in cur.fetchall()}
        return ok({
            "total_users": total_users, "pending": pending,
            "active_subs": active_subs, "total_estimates": total_estimates,
            "new_week": new_week, "by_role": by_role,
            "expiring_soon": [{"id": r[0], "email": r[1], "name": r[2], "phone": r[3],
                                "role": r[4], "subscription_end": str(r[5])[:19], "telegram": r[6]} for r in expiring],
        })

    if action == "get-pricing-rules" and method == "GET":
        cur.execute(f"""
            SELECT econom_mult, premium_mult, econom_label, standard_label, premium_label, no_discount_on_econom
            FROM {SCHEMA}.pricing_settings ORDER BY id LIMIT 1
        """)
        row = cur.fetchone()
        if not row:
            return ok({"econom_mult": 0.85, "premium_mult": 1.27,
                       "econom_label": "Econom", "standard_label": "Standard", "premium_label": "Premium",
                       "no_discount_on_econom": False})
        return ok({"econom_mult": float(row[0]), "premium_mult": float(row[1]),
                   "econom_label": row[2], "standard_label": row[3], "premium_label": row[4],
                   "no_discount_on_econom": bool(row[5]) if row[5] is not None else False})

    if action == "save-pricing-rules" and method == "POST":
        if not token: return err("Требуется авторизация", 401)
        is_master = check_is_master(token, cur, SCHEMA)
        if not is_master:
            cur.execute(f"""
                SELECT u.role FROM {SCHEMA}.user_sessions s
                JOIN {SCHEMA}.users u ON u.id = s.user_id
                WHERE s.token=%s AND s.expires_at > NOW()
            """, (token,))
            row = cur.fetchone()
            if not row: return err("Токен недействителен", 401)
            if row[0] not in ("company", "installer"): return err("Нет прав на изменение правил цен", 403)

        econom_mult           = float(body.get("econom_mult", 0.85))
        premium_mult          = float(body.get("premium_mult", 1.27))
        econom_label          = (body.get("econom_label") or "Econom").strip()
        standard_label        = (body.get("standard_label") or "Standard").strip()
        premium_label         = (body.get("premium_label") or "Premium").strip()
        no_discount_on_econom = bool(body.get("no_discount_on_econom", False))

        cur.execute(f"SELECT id FROM {SCHEMA}.pricing_settings LIMIT 1")
        row = cur.fetchone()
        if row:
            cur.execute(f"""
                UPDATE {SCHEMA}.pricing_settings
                SET econom_mult=%s, premium_mult=%s, econom_label=%s, standard_label=%s, premium_label=%s, no_discount_on_econom=%s
            """, (econom_mult, premium_mult, econom_label, standard_label, premium_label, no_discount_on_econom))
        else:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.pricing_settings
                  (econom_mult, premium_mult, econom_label, standard_label, premium_label, no_discount_on_econom)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (econom_mult, premium_mult, econom_label, standard_label, premium_label, no_discount_on_econom))
        conn.commit()
        return ok({"ok": True})

    return None