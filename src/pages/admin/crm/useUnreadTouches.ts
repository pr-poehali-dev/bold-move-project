import { useEffect, useState } from "react";
import { crmFetch } from "./crmApi";

interface TouchLite {
  direction: string;
  created_at: string;
}

const seenKey = (contactId: number) => `touches_seen_${contactId}`;

// Количество сообщений от клиента (входящих), пришедших ПОСЛЕ последнего открытия
// вкладки «Касания». Открыл вкладку — счётчик обнуляется и запоминает момент;
// новые входящие после этого снова увеличивают счётчик.
export function useUnreadTouches(contactId: number | undefined, phone: string | undefined, active: boolean): number {
  const [count, setCount] = useState(0);
  const key = contactId != null ? seenKey(contactId) : null;

  // Вкладка открыта — считаем всё прочитанным и запоминаем момент просмотра
  useEffect(() => {
    if (active && key) {
      localStorage.setItem(key, String(Date.now()));
      setCount(0);
    }
  }, [active, key]);

  useEffect(() => {
    if (!contactId && !phone) return;
    let alive = true;
    const check = async () => {
      try {
        const extra: Record<string, string> = {};
        if (contactId) extra.contact_id = String(contactId);
        if (phone) extra.phone = phone;
        const d = await crmFetch("touches", undefined, extra) as { touches?: TouchLite[] };
        if (!alive) return;
        if (active) { setCount(0); return; }
        const lastSeen = key ? Number(localStorage.getItem(key) || 0) : 0;
        const touches = d?.touches ?? [];
        const unread = touches.filter(tt => tt.direction === "in" && new Date(tt.created_at).getTime() > lastSeen).length;
        setCount(unread);
      } catch { /* тихо */ }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, phone, active]);

  return count;
}