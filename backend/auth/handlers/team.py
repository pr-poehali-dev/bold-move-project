import json, secrets
from shared import SCHEMA, MASTER_EMAIL, ok, err, hash_password


def handle(action, method, params, body, token, event, conn, cur):

    def get_owner_or_err():
        if not token:
            return None, err("Требуется авторизация", 401)
        cur.execute(f"""
            SELECT u.id, u.role, u.email FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return None, err("Токен недействителен", 401)
        uid, role, email = row
        is_master = (email == MASTER_EMAIL)
        if role != "company" and not is_master:
            return None, err("Доступ только для роли 'Компания'", 403)
        return (uid, role, is_master), None

    if action == "team-list" and method == "GET":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, is_master = owner
        if is_master:
            # Мастер видит всех сотрудников всех компаний (любая роль, привязанная к company_id)
            cur.execute(f"""
                SELECT u.id, u.email, u.name, u.phone, u.role, u.approved, u.created_at,
                       u.permissions, (u.temp_password_plain IS NOT NULL) AS has_pending_password, u.company_id,
                       u.team_role_id, c.name AS company_name, u.active
                FROM {SCHEMA}.users u
                LEFT JOIN {SCHEMA}.users c ON c.id = u.company_id
                WHERE u.company_id IS NOT NULL AND u.removed_at IS NULL
                ORDER BY u.company_id, u.created_at DESC
            """)
        else:
            cur.execute(f"""
                SELECT u.id, u.email, u.name, u.phone, u.role, u.approved, u.created_at,
                       u.permissions, (u.temp_password_plain IS NOT NULL) AS has_pending_password, u.company_id,
                       u.team_role_id, c.name AS company_name, u.active
                FROM {SCHEMA}.users u
                LEFT JOIN {SCHEMA}.users c ON c.id = u.company_id
                WHERE u.company_id = %s AND u.removed_at IS NULL AND u.id <> %s
                ORDER BY u.created_at DESC
            """, (owner_id, owner_id))
        rows = cur.fetchall()
        return ok({"members": [{
            "id": r[0], "email": r[1], "name": r[2], "phone": r[3],
            "role": r[4], "approved": r[5], "created_at": str(r[6])[:19],
            "permissions": r[7], "has_pending_password": r[8], "company_id": r[9],
            "team_role_id": r[10], "company_name": r[11], "active": r[12],
        } for r in rows]})

    if action == "team-toggle-active" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, is_master = owner
        member_id = body.get("member_id") or body.get("user_id")
        if not member_id:
            return err("member_id обязателен")
        enable = bool(body.get("active"))
        # Компания управляет только своими сотрудниками, мастер — любыми
        if is_master:
            cur.execute(f"""
                UPDATE {SCHEMA}.users SET active=%s
                WHERE id=%s AND role='manager' AND removed_at IS NULL
                RETURNING id
            """, (enable, int(member_id)))
        else:
            cur.execute(f"""
                UPDATE {SCHEMA}.users SET active=%s
                WHERE id=%s AND company_id=%s AND role='manager' AND removed_at IS NULL
                RETURNING id
            """, (enable, int(member_id), owner_id))
        updated = cur.fetchone()
        if not updated:
            return err("Сотрудник не найден", 404)
        conn.commit()
        return ok({"id": updated[0], "active": enable})

    # ── РОЛИ КОМАНДЫ (шаблоны наборов прав) ─────────────────────────────────
    if action == "team-roles-list" and method == "GET":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, is_master = owner
        cmp = owner_id if not is_master else owner_id  # мастер тоже видит только свои шаблоны
        cur.execute(f"""
            SELECT id, name, permissions, created_at
            FROM {SCHEMA}.team_roles
            WHERE company_id=%s AND removed_at IS NULL
            ORDER BY created_at ASC
        """, (cmp,))
        rows = cur.fetchall()
        return ok({"roles": [{
            "id": r[0], "name": r[1], "permissions": r[2], "created_at": str(r[3])[:19],
        } for r in rows]})

    if action == "team-roles-create" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, _ = owner
        name = (body.get("name") or "").strip()
        permissions = body.get("permissions") or {}
        if not name:
            return err("Укажите название роли")
        cur.execute(f"""
            INSERT INTO {SCHEMA}.team_roles (company_id, name, permissions)
            VALUES (%s, %s, %s::jsonb) RETURNING id, created_at
        """, (owner_id, name, json.dumps(permissions)))
        new_id, created_at = cur.fetchone()
        conn.commit()
        return ok({"role": {"id": new_id, "name": name, "permissions": permissions, "created_at": str(created_at)[:19]}})

    if action == "team-roles-update" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, _ = owner
        role_id = body.get("role_id")
        name = (body.get("name") or "").strip()
        permissions = body.get("permissions")
        if not role_id:
            return err("role_id обязателен")
        cur.execute(f"SELECT id FROM {SCHEMA}.team_roles WHERE id=%s AND company_id=%s AND removed_at IS NULL", (int(role_id), owner_id))
        if not cur.fetchone():
            return err("Роль не найдена", 404)
        sets, vals = [], []
        if name:
            sets.append("name=%s"); vals.append(name)
        if permissions is not None:
            sets.append("permissions=%s::jsonb"); vals.append(json.dumps(permissions))
        if not sets:
            return err("Нечего обновлять")
        sets.append("updated_at=NOW()")
        vals.append(int(role_id))
        cur.execute(f"UPDATE {SCHEMA}.team_roles SET {', '.join(sets)} WHERE id=%s", vals)
        # Синхронизируем права всем сотрудникам, привязанным к этой роли
        if permissions is not None:
            cur.execute(f"UPDATE {SCHEMA}.users SET permissions=%s::jsonb WHERE team_role_id=%s", (json.dumps(permissions), int(role_id)))
        cur.execute(f"SELECT id, name, permissions, created_at FROM {SCHEMA}.team_roles WHERE id=%s", (int(role_id),))
        r = cur.fetchone()
        conn.commit()
        return ok({"role": {"id": r[0], "name": r[1], "permissions": r[2], "created_at": str(r[3])[:19]}})

    if action == "team-roles-delete" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, _ = owner
        role_id = body.get("role_id")
        if not role_id:
            return err("role_id обязателен")
        cur.execute(f"""
            UPDATE {SCHEMA}.team_roles SET removed_at=NOW()
            WHERE id=%s AND company_id=%s AND removed_at IS NULL
        """, (int(role_id), owner_id))
        # Отвязываем сотрудников от удалённой роли (их текущие права сохраняются как есть)
        cur.execute(f"UPDATE {SCHEMA}.users SET team_role_id=NULL WHERE team_role_id=%s", (int(role_id),))
        conn.commit()
        return ok({"ok": True})

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

        temp_password = secrets.token_urlsafe(8)[:10]
        default_permissions = {
            "crm_view": False, "agent_view": False, "plan_view": False, "admin_panel_view": False,
            "clients_view": False, "clients_edit": False,
            "orders_view": False, "orders_edit": False,
            "kanban_view": False, "kanban_edit": False,
            "calendar_view": False, "calendar_edit": False,
            "analytics_view": False, "finance_view": False,
            "files_view": False, "files_edit": False,
            "prices_view": False, "prices_edit": False,
            "rules_view": False, "rules_edit": False,
            "prompt_view": False, "prompt_edit": False,
            "faq_view": False, "faq_edit": False,
            "corrections_view": False, "corrections_edit": False,
            "field_contacts": False, "field_address": False,
            "field_dates": False, "field_finance": False,
            "field_notes": False, "field_files": False, "field_cancel": False,
        }

        # Если передана роль (шаблон) — подставляем её права вместо пустых по умолчанию
        role_id = body.get("role_id")
        final_permissions = default_permissions
        if role_id:
            cur.execute(f"SELECT permissions FROM {SCHEMA}.team_roles WHERE id=%s AND company_id=%s AND removed_at IS NULL", (int(role_id), owner_id))
            role_row = cur.fetchone()
            if not role_row:
                return err("Роль не найдена", 404)
            final_permissions = role_row[0]

        cur.execute(f"""
            INSERT INTO {SCHEMA}.users
              (email, password_hash, name, phone, role, approved, company_id, invited_by,
               permissions, temp_password_plain, team_role_id)
            VALUES (%s, %s, %s, %s, 'manager', TRUE, %s, %s, %s::jsonb, %s, %s) RETURNING id
        """, (
            invitee_email, hash_password(temp_password),
            invitee_name or None, invitee_phone or None,
            owner_id, owner_id,
            json.dumps(final_permissions), temp_password,
            int(role_id) if role_id else None,
        ))
        new_id = cur.fetchone()[0]
        conn.commit()
        return ok({"ok": True, "member_id": new_id, "email": invitee_email})

    if action == "team-update-permissions" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, is_master = owner
        member_id   = body.get("member_id")
        permissions = body.get("permissions")
        # role_id: число — привязать к роли и подставить её права; null — оставить как есть (ручные права);
        # ключ можно не передавать вовсе, тогда team_role_id не трогаем
        role_id_provided = "role_id" in body
        role_id = body.get("role_id")
        if not member_id or permissions is None:
            return err("member_id и permissions обязательны")
        company_clause = "" if is_master else "AND company_id=%s"
        if role_id_provided:
            params_ = (json.dumps(permissions), int(role_id) if role_id else None, int(member_id)) if is_master \
                else (json.dumps(permissions), int(role_id) if role_id else None, int(member_id), owner_id)
            cur.execute(f"UPDATE {SCHEMA}.users SET permissions=%s::jsonb, team_role_id=%s WHERE id=%s {company_clause}", params_)
        else:
            params_ = (json.dumps(permissions), int(member_id)) if is_master else (json.dumps(permissions), int(member_id), owner_id)
            cur.execute(f"UPDATE {SCHEMA}.users SET permissions=%s::jsonb WHERE id=%s {company_clause}", params_)
        conn.commit()
        return ok({"ok": True})

    if action == "team-show-password" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, is_master = owner
        member_id = body.get("member_id")
        if not member_id:
            return err("member_id обязателен")
        company_clause = "" if is_master else "AND company_id=%s"
        params_ = (int(member_id),) if is_master else (int(member_id), owner_id)
        cur.execute(f"""
            SELECT temp_password_plain FROM {SCHEMA}.users
            WHERE id=%s {company_clause} AND removed_at IS NULL
        """, params_)
        row = cur.fetchone()
        if not row:
            return err("Сотрудник не найден", 404)
        password = row[0]
        if password:
            cur.execute(f"UPDATE {SCHEMA}.users SET temp_password_plain=NULL WHERE id=%s", (int(member_id),))
            conn.commit()
        return ok({"password": password})

    if action == "team-remove" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, is_master = owner
        member_id = body.get("member_id")
        if not member_id:
            return err("member_id обязателен")
        company_clause = "" if is_master else "AND company_id=%s"
        params_ = (int(member_id),) if is_master else (int(member_id), owner_id)
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET removed_at=NOW(), removed_name=name, removed_email=email,
                email=CONCAT('_removed_', id, '_', email)
            WHERE id=%s {company_clause} AND removed_at IS NULL
        """, params_)
        conn.commit()
        return ok({"ok": True})

    if action == "team-reset-password" and method == "POST":
        owner, e = get_owner_or_err()
        if e: return e
        owner_id, _, is_master = owner
        member_id = body.get("member_id")
        if not member_id:
            return err("member_id обязателен")
        company_clause = "" if is_master else "AND company_id=%s"
        params_ = (int(member_id),) if is_master else (int(member_id), owner_id)
        cur.execute(f"""
            SELECT id FROM {SCHEMA}.users
            WHERE id=%s {company_clause} AND removed_at IS NULL
        """, params_)
        if not cur.fetchone():
            return err("Сотрудник не найден", 404)
        new_password = secrets.token_urlsafe(8)[:10]
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET password_hash=%s, temp_password_plain=NULL
            WHERE id=%s
        """, (hash_password(new_password), int(member_id)))
        # Пароль сразу показывается в ответе — считаем его переданным, плашка "нет пароля" не нужна.
        # Завершаем ВСЕ активные сессии сотрудника — старый пароль (и его сессии) должны сразу перестать работать.
        cur.execute(f"UPDATE {SCHEMA}.user_sessions SET expires_at=NOW() WHERE user_id=%s", (int(member_id),))
        conn.commit()
        return ok({"ok": True, "temp_password": new_password})

    return None