import { createContext, useContext } from "react";
import type { OrderSource } from "./crmApi";

export const OrderSourcesContext = createContext<OrderSource[]>([]);
export const useOrderSourcesCtx = () => useContext(OrderSourcesContext);

export const SOURCE_TECH_LABELS: Record<string, string> = {
  chat: "Чат", plan: "Построитель", manual: "Вручную",
};

export function sourceDisplay(
  value: string | null | undefined,
  sources: OrderSource[],
): { label: string; color: string } | null {
  if (!value) return null;
  const found = sources.find(s => s.name === value);
  if (found) return { label: found.name, color: found.color };
  const tech = SOURCE_TECH_LABELS[value];
  if (tech) return { label: tech, color: "#64748b" };
  return { label: value, color: "#64748b" };
}
