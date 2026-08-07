import { useState } from "react";
import { toast } from "sonner";
import { crmFetch } from "./crmApi";

/**
 * Звонок через АТС UIS (click-to-call). Если UIS не настроен или запрос
 * не удался — показываем понятную причину ошибки (тостом), чтобы было ясно,
 * что делать. Откат на обычную ссылку tel: происходит только тогда, когда
 * телефония вообще не подключена (не настроена) — чтобы кнопка не переставала
 * быть полезной. Если телефония подключена, но запрос не удался (например у
 * сотрудника не указан номер в АТС) — звонок через tel: не открываем, только
 * показываем причину, иначе пользователь решит что звонок совершается дважды.
 */
export function useCallClient() {
  const [calling, setCalling] = useState(false);

  const call = async (phone: string, clientId?: number) => {
    if (!phone || calling) return;
    setCalling(true);
    try {
      const res = await crmFetch("click-to-call", {
        method: "POST",
        body: JSON.stringify({ phone, client_id: clientId }),
      }) as { ok?: boolean; error?: string };
      if (!res?.ok) {
        const isUisNotConfigured = (res?.error || "").includes("Телефония UIS отключена");
        if (isUisNotConfigured) {
          window.location.href = `tel:${phone}`;
        } else {
          toast.error(res?.error || "Не удалось совершить звонок");
        }
      }
    } catch {
      toast.error("Не удалось совершить звонок — проверьте соединение");
    }
    setCalling(false);
  };

  return { call, calling };
}