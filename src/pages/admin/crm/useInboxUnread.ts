import { useEffect, useState } from "react";
import { crmFetch } from "./crmApi";

interface DialogLite {
  contact_id: number | null;
  last_direction: "in" | "out";
  last_at: string;
}

const seenKey = (contactId: number) => `touches_seen_${contactId}`;

// Общее число диалогов с непрочитанными входящими (для красного кружка на вкладке
// «Сообщения»). Непрочитано = последнее сообщение входящее и новее момента, когда
// диалог последний раз открывали (хранится локально по contact_id).
export function useInboxUnread(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const check = async () => {
      try {
        const d = await crmFetch("touch-inbox") as { dialogs?: DialogLite[] };
        if (!alive) return;
        const list = d?.dialogs ?? [];
        const n = list.filter(x => {
          if (x.last_direction !== "in") return false;
          if (x.contact_id == null) return true;
          const seen = Number(localStorage.getItem(seenKey(x.contact_id)) || 0);
          return new Date(x.last_at).getTime() > seen;
        }).length;
        setCount(n);
      } catch { /* тихо */ }
    };
    check();
    const timer = setInterval(check, 8000);
    return () => { alive = false; clearInterval(timer); };
  }, [enabled]);

  return count;
}
