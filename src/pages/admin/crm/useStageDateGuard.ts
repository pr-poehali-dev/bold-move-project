import { useState } from "react";
import { Client, crmFetch } from "./crmApi";
import { needStageDate } from "./stageDateRules";
import type { StageDatePatch } from "./StageDateConfirm";

/**
 * Общая защита «нельзя назначить замер/монтаж без даты».
 *
 * Используется во всех местах смены статуса (кнопка «Далее» на карточке,
 * drag&drop на канбан-досках), чтобы правило жило в одном месте:
 * - если у заявки уже есть нужная дата — статус меняется сразу, как раньше;
 * - если даты нет — открывается модалка, и статус сохраняется ВМЕСТЕ с датой
 *   одним запросом (backend тоже это требует, см. crm-manager).
 *
 * @param applyStatus  как применить смену статуса локально (оптимистичное обновление)
 * @param onDone       вызвать после успешного сохранения (перезагрузка списка)
 */
export function useStageDateGuard(
  applyStatus: (id: number, status: string) => void,
  onDone?: () => void,
) {
  const [pending, setPending] = useState<{ client: Client; nextStatus: string } | null>(null);

  /** Пытаемся сменить статус. Вернёт true, если ушёл запрос; false — открыта модалка. */
  const requestStatusChange = async (client: Client, nextStatus: string): Promise<boolean> => {
    // Быстрый перевод на «Замер» (кнопка «Далее», drag&drop) не спрашивает дату —
    // backend сам подставит подэтап «Дата замера не назначена», менеджер укажет
    // дату позже, когда согласует её с клиентом. Модалка с датой остаётся только
    // для монтажа и для ручного выбора конкретного подэтапа замера в карточке.
    if (nextStatus !== "measure" && needStageDate(client, nextStatus)) {
      setPending({ client, nextStatus });
      return false;
    }
    await saveStatus(client, nextStatus);
    return true;
  };

  const saveStatus = async (client: Client, nextStatus: string) => {
    const prevStatus = client.status;
    applyStatus(client.id, nextStatus);
    const res = await crmFetch("clients", {
      method: "PUT",
      body: JSON.stringify({ status: nextStatus }),
    }, { id: String(client.id) }) as { error?: string };
    if (res?.error) {
      applyStatus(client.id, prevStatus); // откат визуального изменения
      alert(res.error);
      return;
    }
    onDone?.();
  };

  /** Пользователь выбрал дату в модалке — шлём статус + дату одним запросом */
  const confirmWithDate = async (patch: StageDatePatch) => {
    if (!pending) return;
    const { client } = pending;
    const prevStatus = client.status;
    applyStatus(client.id, patch.status);
    setPending(null);
    const res = await crmFetch("clients", {
      method: "PUT",
      body: JSON.stringify(patch),
    }, { id: String(client.id) }) as { error?: string };
    if (res?.error) {
      applyStatus(client.id, prevStatus);
      alert(res.error);
      return;
    }
    onDone?.();
  };

  return {
    /** Данные для модалки (null — модалка закрыта) */
    pending,
    requestStatusChange,
    confirmWithDate,
    cancelStageDate: () => setPending(null),
  };
}