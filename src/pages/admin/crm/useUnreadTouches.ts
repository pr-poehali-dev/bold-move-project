import { useEffect, useState } from "react";
import { crmFetch } from "./crmApi";

interface TouchLite {
  direction: string;
  created_at: string;
}

// Количество входящих сообщений от клиента, пришедших ПОСЛЕ последнего прочтения
// диалога ЛЮБЫМ сотрудником компании. Отметка прочтения (last_read_at) общая —
// хранится в БД (touch_clients.last_read_at), а не в localStorage отдельного браузера,
// поэтому счётчик одинаковый у всех: прочитал один — стало прочитано у всех.
export function useUnreadTouches(contactId: number | undefined, phone: string | undefined, active: boolean): number {
  const [count, setCount] = useState(0);

  // Вкладка открыта — отмечаем прочитанным на сервере (общая отметка) и обнуляем счётчик
  useEffect(() => {
    if (!active) return;
    if (contactId == null && !phone) return;
    setCount(0);
    const payload: Record<string, unknown> = {};
    if (contactId != null) payload.contact_id = contactId;
    else if (phone) payload.phone = phone;
    crmFetch("touch-read", { method: "POST", body: JSON.stringify(payload) }).catch(() => {});
  }, [active, contactId, phone]);

  useEffect(() => {
    if (contactId == null && !phone) return;
    // Вкладка «Переписка» уже открыта — вся история и так на экране (её
    // опрашивает DrawerTouchesTab), повторный опрос тех же данных здесь не нужен.
    if (active) return;
    let alive = true;
    const check = async () => {
      try {
        const extra: Record<string, string> = {};
        if (contactId != null) extra.contact_id = String(contactId);
        if (phone) extra.phone = phone;
        const d = await crmFetch("touches", undefined, extra) as {
          touches?: TouchLite[];
          client?: { last_read_at?: string | null } | null;
        };
        if (!alive) return;
        if (active) { setCount(0); return; }
        const lastReadMs = d?.client?.last_read_at ? new Date(d.client.last_read_at).getTime() : 0;
        const touches = d?.touches ?? [];
        const unread = touches.filter(tt => tt.direction === "in" && new Date(tt.created_at).getTime() > lastReadMs).length;
        setCount(unread);
      } catch { /* тихо */ }
    };
    check();
    const timer = setInterval(() => {
      if (document.hidden) return; // вкладка браузера свёрнута/неактивна — не дёргаем сервер впустую
      check();
    }, 60000);
    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, phone, active]);

  return count;
}