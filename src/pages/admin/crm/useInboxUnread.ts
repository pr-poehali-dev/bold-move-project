import { useEffect, useState } from "react";
import { crmFetch } from "./crmApi";

interface DialogLite {
  unread: boolean;
}

// Общее число диалогов с непрочитанными входящими (для красного кружка на вкладке
// «Сообщения»). Признак unread приходит с сервера (touch_clients.last_read_at —
// общая на компанию отметка прочтения, см. calc_unread в backend/crm-manager) —
// та же логика, что красит строки диалогов жирным в списке (MessagesDialogRow).
export function useInboxUnread(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) { setCount(0); return; }
    let alive = true;
    const check = async () => {
      try {
        const d = await crmFetch("touch-inbox") as { dialogs?: DialogLite[] };
        if (!alive) return;
        const list = d?.dialogs ?? [];
        setCount(list.filter(x => x.unread).length);
      } catch { /* тихо */ }
    };
    check();
    const timer = setInterval(() => {
      if (document.hidden) return; // вкладка браузера свёрнута/неактивна — не дёргаем сервер впустую
      check();
    }, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, [enabled]);

  return count;
}