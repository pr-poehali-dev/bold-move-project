import { useEffect, useRef } from "react";
import { crmFetch } from "./crmApi";

// Сколько минут считаем сводку свежей — чаще не пересобираем, чтобы не тратить
// деньги на ИИ при каждом открытии одной и той же карточки.
const FRESH_MINUTES = 60;

interface TouchesResp {
  client?: { id?: number; analysis_updated_at?: string | null };
  touches?: unknown[];
  error?: string;
}

/**
 * Автоматически обновляет ИИ-сводку по общению при открытии карточки клиента.
 * Результат ИИ пишет в комментарий заявки (на стороне сервера).
 *
 * Запускается только если: есть переписка, сводка устарела (или её нет)
 * и в этой вкладке браузера мы её ещё не пересобирали.
 *
 * @param orderId  id заявки — открытая карточка
 * @param phone    телефон клиента (может отсутствовать у Avito)
 * @param enabled  запускать ли (false — например карточка ещё не готова)
 * @param onDone   вызывается после успешного обновления, чтобы перечитать карточку
 */
export function useAutoSummary(
  orderId: number | undefined,
  phone: string | undefined,
  enabled: boolean,
  onDone?: () => void,
) {
  // Чтобы не дёргать ИИ повторно при перерисовках/переключении вкладок
  const doneFor = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled || !orderId) return;
    if (doneFor.current.has(orderId)) return;

    let cancelled = false;

    (async () => {
      try {
        // 1. Узнаём клиента касаний и когда сводка обновлялась
        const extra: Record<string, string> = {};
        if (phone) extra.phone = phone;
        else extra.crm_contact_id = String(orderId);

        const d = await crmFetch("touches", undefined, extra) as TouchesResp;
        if (cancelled || !d || d.error || !d.client?.id) return;

        const touchCount = Array.isArray(d.touches) ? d.touches.length : 0;
        if (touchCount === 0) return; // нечего суммировать

        const updatedAt = d.client.analysis_updated_at;
        if (updatedAt) {
          const ageMin = (Date.now() - new Date(updatedAt).getTime()) / 60000;
          if (ageMin < FRESH_MINUTES) { doneFor.current.add(orderId); return; }
        }

        // 2. Пересобираем сводку — сервер запишет её в комментарий заявки
        doneFor.current.add(orderId);
        const res = await crmFetch("analyze-client", {
          method: "POST",
          body: JSON.stringify({ client_id: d.client.id }),
        }) as { error?: string };

        if (!cancelled && res && !res.error) onDone?.();
      } catch { /* тихо: сводка — не критичная функция */ }
    })();

    return () => { cancelled = true; };
  }, [orderId, phone, enabled, onDone]);
}
