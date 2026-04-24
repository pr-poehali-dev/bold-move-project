import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["crm-manager"];

// Токен пробрасывается из AuthContext через этот setter
let _authToken: string | null = null;
export function setCrmToken(t: string | null) { _authToken = t; }

export function crmFetch(resource: string, opts?: RequestInit, extra?: Record<string, string>) {
  let url = `${BASE}?r=${resource}`;
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => { url += `&${k}=${encodeURIComponent(v)}`; });
  }
  const authHeader = _authToken ? { "X-Authorization": `Bearer ${_authToken}` } : {};
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeader, ...(opts?.headers || {}) },
  }).then(r => r.json());
}

export async function uploadFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const res = await crmFetch("upload", {
    method: "POST",
    body: JSON.stringify({ data: b64, filename: file.name, content_type: file.type }),
  });
  return res.url as string;
}

// ── Воронка ────────────────────────────────────────────────────────────────

// Лиды — до подписания договора
export const LEAD_STATUSES = ["new", "call", "measure", "measured"];
// Заказы — после подписания договора
export const ORDER_STATUSES = ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid", "done", "cancelled"];

export const STATUS_LABELS: Record<string, string> = {
  // Лиды
  new:               "Новая заявка",
  call:              "Звонок назначен",
  measure:           "Замер назначен",
  measured:          "Замер выполнен",
  // Заказы
  contract:          "Договор подписан",
  prepaid:           "Предоплата получена",
  install_scheduled: "Монтаж назначен",
  install_done:      "Монтаж выполнен",
  extra_paid:        "Доплата получена",
  done:              "Завершён",
  cancelled:         "Отменён",
  deleted:           "Удалён",
};

export const STATUS_COLORS: Record<string, string> = {
  new:               "#3b82f6",
  call:              "#a78bfa",
  measure:           "#f59e0b",
  measured:          "#8b5cf6",
  contract:          "#06b6d4",
  prepaid:           "#0ea5e9",
  install_scheduled: "#f97316",
  install_done:      "#fb923c",
  extra_paid:        "#84cc16",
  done:              "#10b981",
  cancelled:         "#ef4444",
  deleted:           "#6b7280",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  measure: "Замер",
  install: "Монтаж",
  payment: "Оплата",
  call:    "Звонок",
  other:   "Другое",
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  measure: "#f59e0b",
  install: "#f97316",
  payment: "#10b981",
  call:    "#3b82f6",
  other:   "#8b5cf6",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low:    "Низкий",
  medium: "Средний",
  high:   "Высокий",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low:    "#10b981",
  medium: "#f59e0b",
  high:   "#ef4444",
};

// Метки (теги) — предустановленные + пользовательские
export const DEFAULT_TAGS = [
  { label: "Квартира",   color: "#3b82f6" },
  { label: "Дом",        color: "#10b981" },
  { label: "Офис",       color: "#f59e0b" },
  { label: "Срочно",     color: "#ef4444" },
  { label: "VIP",        color: "#f59e0b" },
  { label: "Повторный",  color: "#8b5cf6" },
  { label: "Дизайнер",   color: "#06b6d4" },
  { label: "Прораб",     color: "#f97316" },
];

export interface Client {
  id: number;
  session_id: string;
  client_name: string;
  phone: string;
  status: string;
  measure_date: string | null;
  install_date: string | null;
  notes: string | null;
  address: string | null;
  area: number | null;
  budget: number | null;
  source: string | null;
  created_at: string;
  contract_sum: number | null;
  prepayment: number | null;
  extra_payment: number | null;
  extra_agreement_sum: number | null;
  responsible_phone: string | null;
  map_link: string | null;
  tags: string[] | null;
  photo_before_url: string | null;
  photo_after_url: string | null;
  document_url: string | null;
  material_cost: number | null;
  measure_cost: number | null;
  install_cost: number | null;
  cancel_reason: string | null;
}

export function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}