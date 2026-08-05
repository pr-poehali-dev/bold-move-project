import { useState } from "react";
import { crmFetch } from "./crmApi";

/**
 * Звонок через АТС UIS (click-to-call). Если UIS не настроен или запрос
 * не удался — молча откатывается на обычную ссылку tel:, чтобы кнопка
 * «Позвонить» никогда не переставала работать.
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
        window.location.href = `tel:${phone}`;
      }
    } catch {
      window.location.href = `tel:${phone}`;
    }
    setCalling(false);
  };

  return { call, calling };
}
