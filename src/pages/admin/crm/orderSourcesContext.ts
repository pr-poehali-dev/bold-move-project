import { createContext, useContext } from "react";
import type { OrderSource } from "./crmApi";

export const OrderSourcesContext = createContext<OrderSource[]>([]);
export const useOrderSourcesCtx = () => useContext(OrderSourcesContext);

// Источник — только маркетинговый канал (Авито/ВК/Сайт). Технический канал
// создания заявки (Чат/Построитель/CRM) хранится отдельно в поле created_via.
export function sourceDisplay(
  value: string | null | undefined,
  sources: OrderSource[],
): { label: string; color: string } | null {
  if (!value) return null;
  const found = sources.find(s => s.name === value);
  if (found) return { label: found.name, color: found.color };
  return { label: value, color: "#64748b" };
}