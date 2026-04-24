import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["crm-manager"];

export function crmFetch(resource: string, opts?: RequestInit, extra?: Record<string, string>) {
  let url = `${BASE}?r=${resource}`;
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => { url += `&${k}=${encodeURIComponent(v)}`; });
  }
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  }).then(r => r.json());
}

export const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  measure: "Замер назначен",
  measured: "Замер выполнен",
  contract: "Договор",
  install: "Монтаж",
  done: "Готово",
  cancelled: "Отменён",
};

export const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6",
  measure: "#f59e0b",
  measured: "#8b5cf6",
  contract: "#06b6d4",
  install: "#f97316",
  done: "#10b981",
  cancelled: "#ef4444",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  measure: "Замер",
  payment: "Оплата",
  install: "Монтаж",
  call: "Звонок",
  other: "Другое",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
};

export function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}
