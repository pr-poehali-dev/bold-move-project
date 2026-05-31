import json, re, secrets as sec
import urllib.request as _ur
from shared import SCHEMA, BUSINESS_ROLES, ok, err


def handle(action, method, params, body, token, event, conn, cur):

    # ── Смета по chat_id ──────────────────────────────────────────────────────
    if action == "estimate-by-chat" and method == "GET":
        chat_id = params.get("chat_id")
        if not chat_id:
            return err("chat_id required")
        cur.execute(f"""
            SELECT e.id, e.title, e.blocks, e.totals, e.final_phrase,
                   e.total_econom, e.total_standard, e.total_premium, e.status, e.created_at,
                   lc.material_cost, e.chosen_tier
            FROM {SCHEMA}.saved_estimates e
            LEFT JOIN {SCHEMA}.live_chats lc ON lc.id = e.chat_id
            WHERE e.chat_id=%s ORDER BY e.id DESC LIMIT 1
        """, (int(chat_id),))
        row = cur.fetchone()
        if not row:
            return ok({"estimate": None})
        return ok({"estimate": {
            "id": row[0], "title": row[1], "blocks": row[2], "totals": row[3], "final_phrase": row[4],
            "total_econom": float(row[5]) if row[5] else None,
            "total_standard": float(row[6]) if row[6] else None,
            "total_premium": float(row[7]) if row[7] else None,
            "status": row[8], "created_at": str(row[9])[:19],
            "material_cost": int(row[10]) if row[10] else None,
            "chosen_tier": row[11],
        }})

    # ── Обновить смету ────────────────────────────────────────────────────────
    if action == "update-estimate" and method == "POST":
        est_id = params.get("id")
        if not est_id:
            return err("id required")
        blocks_new = body.get("blocks", [])
        totals_new = body.get("totals", [])

        def _extract(keyword):
            for t in totals_new:
                if keyword.lower() in t.lower():
                    nums = re.findall(r"[\d\s]+", t.replace("\u00a0", " "))
                    cleaned = "".join("".join(nums).split())
                    if cleaned.isdigit():
                        return float(cleaned)
            return None

        chosen_tier_val = body.get("chosen_tier", None)
        cur.execute(f"""
            UPDATE {SCHEMA}.saved_estimates
            SET blocks=%s, totals=%s,
                total_econom=%s, total_standard=%s, total_premium=%s,
                chosen_tier=%s, updated_at=NOW()
            WHERE id=%s
        """, (
            json.dumps(blocks_new, ensure_ascii=False),
            json.dumps(totals_new, ensure_ascii=False),
            _extract("econom"), _extract("standard"), _extract("premium"),
            chosen_tier_val, int(est_id),
        ))
        conn.commit()
        return ok({"ok": True})

    # ── Выбрать согласованный тир сметы ──────────────────────────────────────
    if action == "choose-estimate-tier" and method == "POST":
        est_id = params.get("id")
        if not est_id:
            return err("id required")
        tier = body.get("chosen_tier")
        cur.execute(f"""
            UPDATE {SCHEMA}.saved_estimates SET chosen_tier=%s, updated_at=NOW()
            WHERE id=%s RETURNING chat_id, total_econom, total_standard, total_premium
        """, (tier, int(est_id)))
        row = cur.fetchone()
        if row and row[0]:
            chat_id_val = row[0]
            tier_map = {"econom": row[1], "standard": row[2], "premium": row[3]}
            chosen_sum = tier_map.get(tier) if tier else None
            if chosen_sum is not None:
                cur.execute(f"UPDATE {SCHEMA}.live_chats SET contract_sum=%s WHERE id=%s", (chosen_sum, chat_id_val))
        conn.commit()
        return ok({"ok": True})

    # ── Сохранить смету → заявка в CRM ───────────────────────────────────────
    if action == "save-estimate" and method == "POST":
        if not token:
            return err("Требуется авторизация", 401)

        cur.execute(f"""
            SELECT u.id, u.email, u.name, u.phone, u.discount, u.role, u.estimates_balance,
                   u.trial_until, (u.trial_until IS NOT NULL AND u.trial_until < NOW()) AS trial_expired,
                   u.company_id
            FROM {SCHEMA}.user_sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token=%s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return err("Токен недействителен", 401)
        user_id, email, user_name, phone, user_discount, user_role, estimates_balance, trial_until, trial_expired, u_company_id = row

        if user_role in ("company", "installer"):
            crm_company_id = user_id
        elif user_role == "manager" and u_company_id:
            crm_company_id = u_company_id
        else:
            crm_company_id = user_id

        if user_role in BUSINESS_ROLES:
            if (estimates_balance or 0) <= 0:
                return err("Недостаточно смет на балансе. Пополните пакет.", 403)
            cur.execute(f"UPDATE {SCHEMA}.users SET estimates_balance = estimates_balance - 1 WHERE id = %s", (user_id,))
            cur.execute(f"INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, reason) VALUES (%s, -1, 'estimate_created')", (user_id,))

        blocks       = body.get("blocks", [])
        totals       = body.get("totals", [])
        final_phrase = body.get("finalPhrase", "")
        linked_chat_id = body.get("linked_chat_id")

        def extract_sum(keyword):
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
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            user_id, "Смета на натяжные потолки",
            json.dumps(blocks, ensure_ascii=False), json.dumps(totals, ensure_ascii=False),
            final_phrase, total_econom, total_standard, total_premium,
        ))
        estimate_id = cur.fetchone()[0]

        material_cost_total = installation_cost_total = management_cost_total = 0
        try:
            cur.execute(f"SELECT use_installation_price, use_measure_price, use_management_price FROM {SCHEMA}.auto_rules_settings WHERE company_id=%s", (crm_company_id,))
            settings_row = cur.fetchone()
            use_install_global    = bool(settings_row[0]) if settings_row else False
            use_measure_global    = bool(settings_row[1]) if settings_row else False
            use_management_global = bool(settings_row[2]) if settings_row else False
            cur.execute(f"""
                SELECT p.name, p.purchase_price, p.installation_price, p.measure_price, p.management_price, s.is_material
                FROM {SCHEMA}.ai_prices p
                JOIN {SCHEMA}.price_category_settings s ON s.category = p.category
                WHERE p.active=true AND (p.purchase_price > 0 OR p.installation_price > 0 OR p.measure_price > 0 OR p.management_price > 0)
            """)
            mat_map = inst_map = meas_map = mgmt_map = {}
            mat_map, inst_map, meas_map, mgmt_map = {}, {}, {}, {}
            for r in cur.fetchall():
                nk = r[0].strip().lower()
                if r[5] and r[1]: mat_map[nk] = float(r[1])
                if use_install_global and r[2]: inst_map[nk] = float(r[2])
                if use_measure_global and r[3]: meas_map[nk] = float(r[3])
                if use_management_global and r[4]: mgmt_map[nk] = float(r[4])
            for block in blocks:
                for item in block.get("items", []):
                    item_name = item.get("name", "").strip().lower()
                    val_str = str(item.get("value", "")).replace("\u00a0", " ")
                    m = re.match(r"([\d]+(?:[.,]\d+)?)", val_str.strip())
                    qty = float(m.group(1).replace(",", ".")) if m else 1.0
                    if item_name in mat_map: material_cost_total += mat_map[item_name] * qty
                    if item_name in inst_map: installation_cost_total += inst_map[item_name] * qty
                    if item_name in meas_map: installation_cost_total += meas_map[item_name] * qty
                    if item_name in mgmt_map: management_cost_total += mgmt_map[item_name] * qty
            material_cost_total     = int(round(material_cost_total))
            installation_cost_total = int(round(installation_cost_total))
            management_cost_total   = int(round(management_cost_total))
        except Exception:
            material_cost_total = installation_cost_total = management_cost_total = 0

        chat_id = None
        if linked_chat_id:
            cur.execute(f"""
                UPDATE {SCHEMA}.live_chats
                SET contract_sum=%s, material_cost=%s, install_cost=%s, management_cost=%s
                WHERE id=%s AND company_id=%s RETURNING id
            """, (
                total_standard,
                material_cost_total if material_cost_total > 0 else None,
                installation_cost_total if installation_cost_total > 0 else None,
                management_cost_total if management_cost_total > 0 else None,
                int(linked_chat_id), crm_company_id,
            ))
            row = cur.fetchone()
            chat_id = row[0] if row else None

        if not linked_chat_id or not chat_id:
            session_id = f"estimate-{estimate_id}-{sec.token_hex(6)}"
            cur.execute(f"""
                INSERT INTO {SCHEMA}.live_chats
                  (session_id, client_name, phone, status, source, contract_sum, material_cost, install_cost, management_cost, company_id)
                VALUES (%s, %s, %s, 'new', 'estimate', %s, %s, %s, %s, %s) RETURNING id
            """, (
                session_id, user_name or email, phone or "", total_standard,
                material_cost_total if material_cost_total > 0 else None,
                installation_cost_total if installation_cost_total > 0 else None,
                management_cost_total if management_cost_total > 0 else None,
                crm_company_id,
            ))
            chat_id = cur.fetchone()[0]

        cur.execute(f"UPDATE {SCHEMA}.saved_estimates SET chat_id=%s WHERE id=%s", (chat_id, estimate_id))

        if total_standard and crm_company_id:
            cur.execute(f"SELECT auto_mode, use_installation_price, use_measure_price, use_management_price FROM {SCHEMA}.auto_rules_settings WHERE company_id=%s", (crm_company_id,))
            settings_row = cur.fetchone()
            if settings_row and settings_row[0]:
                _use_install    = bool(settings_row[1]) if settings_row[1] is not None else False
                _use_measure    = bool(settings_row[2]) if settings_row[2] is not None else False
                _use_management = bool(settings_row[3]) if settings_row[3] is not None else False
                cur.execute(f"""
                    SELECT key, pct, row_type FROM {SCHEMA}.auto_rules_v2
                    WHERE company_id=%s AND enabled=true AND pct IS NOT NULL AND pct > 0
                """, (crm_company_id,))
                rules = cur.fetchall()
                if rules:
                    auto_patch = {}
                    cost_keys   = {"material_cost", "measure_cost", "install_cost", "management_cost"}
                    income_keys = {"prepayment", "extra_payment"}
                    for r_key, r_pct, r_type in rules:
                        if r_key == "manager_cost": r_key = "management_cost"
                        if r_key == "install_cost"    and _use_install:    continue
                        if r_key == "measure_cost"    and _use_measure:    continue
                        if r_key == "management_cost" and _use_management: continue
                        if r_key in cost_keys or r_key in income_keys:
                            auto_patch[r_key] = int(round(float(total_standard) * float(r_pct) / 100))
                    if auto_patch:
                        set_parts = ", ".join(f"{k}=%s" for k in auto_patch)
                        cur.execute(
                            f"UPDATE {SCHEMA}.live_chats SET {set_parts} WHERE id=%s",
                            list(auto_patch.values()) + [chat_id]
                        )

        conn.commit()

        cur.execute(f"SELECT estimates_balance FROM {SCHEMA}.users WHERE id=%s", (user_id,))
        new_balance = cur.fetchone()[0] or 0

        try:
            cur2 = conn.cursor()
            cur2.execute(f"SELECT has_own_agent, tg_bot_token, tg_notify_chat_id, company_name FROM {SCHEMA}.users WHERE id=%s", (crm_company_id,))
            tg_row = cur2.fetchone()
            cur2.close()
            if tg_row and tg_row[0] and tg_row[1] and tg_row[2]:
                tg_token, tg_chat = tg_row[1], tg_row[2]
                client_display = user_name or email or "—"
                phone_display  = phone or "не указан"
                sum_display    = f"{total_standard:,}".replace(",", " ") if total_standard else "—"
                msg = (
                    f"📋 <b>Новая заявка!</b>\n"
                    f"👤 {client_display}\n📞 {phone_display}\n"
                    f"💰 Смета: <b>{sum_display} ₽</b>\n"
                    f"🔗 /company?order={chat_id}"
                )
                _payload = json.dumps({"chat_id": tg_chat, "text": msg, "parse_mode": "HTML"}).encode()
                _req = _ur.Request(
                    f"https://api.telegram.org/bot{tg_token}/sendMessage",
                    data=_payload, headers={"Content-Type": "application/json"},
                )
                try: _ur.urlopen(_req, timeout=5)
                except Exception: pass
        except Exception:
            pass

        return ok({
            "ok": True, "estimate_id": estimate_id, "chat_id": chat_id,
            "discount": user_discount or 0, "estimates_balance": new_balance,
        })

    # ── Список смет пользователя ──────────────────────────────────────────────
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
            WHERE e.user_id = %s ORDER BY e.created_at DESC
        """, (user_id,))
        rows = cur.fetchall()
        return ok({"estimates": [{
            "id": r[0], "title": r[1],
            "total_econom": float(r[2]) if r[2] else None,
            "total_standard": float(r[3]) if r[3] else None,
            "total_premium": float(r[4]) if r[4] else None,
            "status": r[5], "created_at": str(r[6])[:19],
            "crm_status": r[7], "chat_id": r[8],
            "blocks": r[9] if r[9] else [], "totals": r[10] if r[10] else [],
            "final_phrase": r[11] or "",
        } for r in rows]})

    return None
