import json, re, os
import urllib.request as _ureq
from shared import ok, err


def handle(action, method, params, body, token, event, conn, cur):

    if action == "crm-risk-ai" and method == "POST":
        items        = body.get("items", [])
        max_discount = body.get("max_discount", 30)
        custom_prompt = body.get("custom_prompt", "")
        raw_mode     = body.get("raw_mode", False)
        if not items: return err("items обязателен")

        base_prompt = custom_prompt.strip() if custom_prompt else (
            "Ты эксперт по монтажу натяжных потолков. Оцени сложность монтажа "
            "по позициям сметы и рекомендуй оптимальную скидку клиенту.\n\n"
            "Критерии: простой объект (прямоугольник, одно полотно) → скидка ближе к максимуму; "
            "сложный (многоуровневый, ниши, много закладных) → минимальная скидка."
        )
        if raw_mode:
            prompt = f"{base_prompt}\n\nПозиции сметы:\n" + "\n".join(f"{i+1}. {it}" for i, it in enumerate(items[:40]))
        else:
            prompt = (
                f"{base_prompt}\n\nПозиции сметы:\n"
                + "\n".join(f"{i+1}. {it}" for i, it in enumerate(items[:40]))
                + f"\n\nМаксимально допустимая скидка: {max_discount}%\n\n"
                f"Ответь строго в JSON без markdown:\n"
                f'{{"level":"low|mid|high","recommended_discount":число от 0 до {max_discount},'
                f'"reason":"краткое объяснение (1-2 предложения)","items":["риск 1","риск 2"]}}'
            )

        or_key = os.environ.get("OPENROUTER_API_KEY_2", "") or os.environ.get("OPENROUTER_API_KEY", "")
        if not or_key: return err("AI недоступен — нет ключа")

        sys_msg = "Отвечай чётко и по делу." if raw_mode else "Отвечай только JSON без markdown."
        payload = json.dumps({
            "model": "openai/gpt-4o-mini",
            "messages": [{"role": "system", "content": sys_msg}, {"role": "user", "content": prompt}],
            "max_tokens": 600 if raw_mode else 400, "temperature": 0,
        }).encode()
        req = _ureq.Request("https://openrouter.ai/api/v1/chat/completions", data=payload,
                            headers={"Authorization": f"Bearer {or_key}", "Content-Type": "application/json",
                                     "HTTP-Referer": "https://mospotolki.ru"}, method="POST")
        try:
            with _ureq.urlopen(req, timeout=30) as r:
                ai_resp = json.loads(r.read().decode())
            content = ai_resp["choices"][0]["message"]["content"]
            if raw_mode:
                return ok({"reason": content.strip(), "summary": content.strip()})
            m = re.search(r'\{[\s\S]*\}', content)
            if not m: return err("AI вернул неожиданный формат")
            return ok(json.loads(m.group(0)))
        except Exception as e:
            return err(f"AI ошибка: {str(e)[:100]}")

    if action == "complexity-eval" and method == "POST":
        items = body.get("items", [])
        if not items: return err("items обязателен")
        or_key = os.environ.get("OPENROUTER_API_KEY_2", "") or os.environ.get("OPENROUTER_API_KEY", "")
        if not or_key: return err("AI недоступен — нет ключа")

        names_list = "\n".join(f'{i+1}. {it["name"]}' for i, it in enumerate(items[:15]))
        prompt = (
            f"Ты эксперт по монтажу натяжных потолков. "
            f"Оцени каждую позицию из списка по трём параметрам:\n"
            f"- complexity: сложность монтажа от 1 до 10\n"
            f"- weight: влияние на риск скидки от 1 до 10\n"
            f"- reason: 1 предложение — почему такая сложность\n"
            f"- weight_reason: 1 предложение — почему такое влияние\n\n"
            f"Позиции:\n{names_list}\n\n"
            f"Ответь строго JSON массивом без markdown, ровно {len(items)} элементов:\n"
            f'[{{"idx":1,"complexity":5,"weight":5,"reason":"Стандартная операция.","weight_reason":"Умеренно влияет."}}, ...]'
        )
        payload = json.dumps({
            "model": "openai/gpt-4o-mini",
            "messages": [{"role": "system", "content": "Отвечай только JSON массивом без markdown и пояснений."},
                         {"role": "user", "content": prompt}],
            "max_tokens": 1200, "temperature": 0,
        }).encode()
        req = _ureq.Request("https://openrouter.ai/api/v1/chat/completions", data=payload,
                            headers={"Authorization": f"Bearer {or_key}", "Content-Type": "application/json",
                                     "HTTP-Referer": "https://mospotolki.ru"}, method="POST")
        try:
            with _ureq.urlopen(req, timeout=30) as r:
                ai_resp = json.loads(r.read().decode())
            content = ai_resp["choices"][0]["message"]["content"]
            m = re.search(r'\[[\s\S]*\]', content)
            if not m: return err("AI вернул неожиданный формат")
            parsed = json.loads(m.group(0))
            result = []
            for i, entry in enumerate(parsed):
                if i < len(items):
                    result.append({
                        "id": items[i]["id"],
                        "complexity": max(1, min(10, int(entry.get("complexity", 5)))),
                        "weight": max(1, min(10, int(entry.get("weight", 5)))),
                        "reason": str(entry.get("reason", "")).strip(),
                        "weight_reason": str(entry.get("weight_reason", "")).strip(),
                    })
            return ok({"results": result})
        except Exception as e:
            return err(f"AI ошибка: {str(e)[:100]}")

    return None
