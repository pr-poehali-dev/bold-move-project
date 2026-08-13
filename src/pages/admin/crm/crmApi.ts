import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["crm-manager"];
// Медленные ИИ-операции (анализ клиента/звонка, расшифровка записи) вынесены
// в отдельную функцию crm-ai — у неё свой (больший) таймаут, не влияющий на
// быструю crm-manager. См. backend/crm-ai/index.py.
const AI_BASE = (func2url as Record<string, string>)["crm-ai"];

// Токен пробрасывается из AuthContext через этот setter
let _authToken: string | null = null;
export function setCrmToken(t: string | null) { _authToken = t; }
export function getCrmToken() { return _authToken; }

function waitForToken(ms = 3000): Promise<void> {
  return new Promise(resolve => {
    if (_authToken) { resolve(); return; }
    const start = Date.now();
    const check = () => {
      if (_authToken || Date.now() - start > ms) { resolve(); return; }
      setTimeout(check, 100);
    };
    check();
  });
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchFrom(base: string, resource: string, opts?: RequestInit, extra?: Record<string, string>): Promise<unknown> {
  await waitForToken();
  let url = `${base}?r=${resource}`;
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => { url += `&${k}=${encodeURIComponent(v)}`; });
  }
  const authHeader = _authToken ? { "X-Authorization": `Bearer ${_authToken}` } : {};
  const doFetch = () => fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeader, ...(opts?.headers || {}) },
  });

  // Мобильная сеть нестабильна: разовый обрыв связи или временный сбой (401/5xx на
  // GET-запросе) не должен выглядеть как "вылет из системы". Делаем до 2 тихих
  // повторов с паузой. Повторяем только безопасные GET-запросы (без body/метода POST),
  // чтобы не задублировать создание/изменение данных.
  const method = (opts?.method || "GET").toUpperCase();
  const retriable = method === "GET";
  const maxRetries = retriable ? 2 : 0;

  for (let attempt = 0; ; attempt++) {
    try {
      const r = await doFetch();
      // 401/5xx на GET — возможно, токен ещё не подхватился или сервер моргнул: повторяем
      if (retriable && (r.status === 401 || r.status >= 500) && attempt < maxRetries) {
        await sleep(attempt === 0 ? 500 : 1200);
        continue;
      }
      return await r.json();
    } catch (e) {
      // Сетевая ошибка — повторяем, если ещё есть попытки
      if (attempt < maxRetries) { await sleep(attempt === 0 ? 500 : 1200); continue; }
      throw e;
    }
  }
}

export async function crmFetch(resource: string, opts?: RequestInit, extra?: Record<string, string>): Promise<unknown> {
  return fetchFrom(BASE, resource, opts, extra);
}

// Для analyze-client / analyze-call / transcribe-call — те же токен и логика
// повторов, но запрос уходит в crm-ai (см. комментарий про AI_BASE выше).
export async function crmAiFetch(resource: string, opts?: RequestInit, extra?: Record<string, string>): Promise<unknown> {
  return fetchFrom(AI_BASE, resource, opts, extra);
}

export async function uploadFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // btoa через спред падает на больших файлах (stack overflow) — конвертируем чанками
  let b64 = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  b64 = btoa(b64);
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
  call:              "В работе",
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
  measure:    "Замер",
  install:    "Монтаж",
  next_call:  "Следующий звонок",
  last_call:  "Последний звонок",
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  measure:    "#f59e0b",
  install:    "#f97316",
  next_call:  "#3b82f6",
  last_call:  "#8b5cf6",
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

// Метки (теги) — только 2 варианта, ставится максимум одна метка сразу.
// Метка сбрасывается автоматически при смене этапа/статуса заказа (см. backend/crm-manager).
export const DEFAULT_TAGS = [
  { label: "Недозвон",    color: "#ef4444" },
  { label: "Перезвонить", color: "#f59e0b" },
];

export interface ClientStatus {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

export interface OrderSource {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

export interface Client {
  id: number;
  session_id: string;
  client_name: string;
  phone: string;
  status: string;
  client_status: string | null;
  measure_date: string | null;
  install_date: string | null;
  notes: string | null;
  /** Блок «Комментарий» — 4 отдельных поля + 2 Summary (см. DrawerCommentsBlock). Опциональны — локальные демо-карточки их не создают. */
  comment_order?: string | null;
  comment_measure?: string | null;
  comment_install?: string | null;
  comment_client?: string | null;
  /** Заполняется автоматически ИИ-анализом переписки (analyze-client) */
  summary_comm?: string | null;
  /** Пока заполняется вручную/на будущее — отдельного ИИ-анализа состояния заказа ещё нет */
  summary_status?: string | null;
  address: string | null;
  area: number | null;
  budget: number | null;
  source: string | null;
  created_via?: string | null;
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
  management_cost: number | null;
  custom_costs_total?: number | null;
  cancel_reason: string | null;
  sub_status: string | null;
  updated_at: string | null;
  discount_pct: number | null;
  discount_amount: number | null;
  prepayment_confirmed: boolean | null;
  prepayment_confirmed_at: string | null;
  prepayment_fact: number | null;
  extra_payment_confirmed: boolean | null;
  extra_payment_confirmed_at: string | null;
  extra_payment_fact: number | null;
  project_id?: number | null;
  is_demo?: boolean;
  avito_chat_url?: string | null;
  status_changed_at?: string | null;
  next_call_date?: string | null;
  last_call_at?: string | null;
  has_missed_call?: boolean;
  /** Менеджер отметил при закрытии карточки, что звонить клиенту больше не нужно */
  no_call_needed?: boolean;
}

export function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

// Компактная длительность нахождения на этапе: «5 мин», «3 ч», «2 дн».
// from — момент входа на этап (status_changed_at). Пусто → возвращает "".
export function stageDuration(from: string | null | undefined): string {
  if (!from) return "";
  const start = new Date(from).getTime();
  if (isNaN(start)) return "";
  const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return `${days} дн`;
}

// Группировка заявок по клиенту — ТОЛЬКО по телефону.
// По имени НЕ группируем: тёзки (напр. несколько «Александр» без телефона) —
// это разные люди, объединять их нельзя. Заявка без телефона — всегда отдельная.
export function getClientOrders(client: Client, allClients: Client[]): Client[] {
  const phone = (client.phone || "").trim().replace(/\D/g, "");
  if (phone) {
    return allClients.filter(c => (c.phone || "").trim().replace(/\D/g, "") === phone);
  }
  return [client];
}