// ── Types and constants for CrmOrders ────────────────────────────────────────

export const NEXT_STATUS: Record<string, string> = {
  new:               "call",
  call:              "measure",
  measure:           "measured",
  measured:          "contract",
  contract:          "prepaid",
  prepaid:           "install_scheduled",
  install_scheduled: "install_done",
  install_done:      "extra_paid",
  extra_paid:        "done",
};

export const NEXT_LABEL: Record<string, string> = {
  new:               "Взять в работу",
  call:              "Назначить замер",
  measure:           "Замер выполнен",
  measured:          "Подписать договор",
  contract:          "Предоплата получена",
  prepaid:           "Назначить монтаж",
  install_scheduled: "Монтаж выполнен",
  install_done:      "Доплата получена",
  extra_paid:        "Завершить заказ",
};

// Особый таб "Все" — показывает все заявки без фильтра по статусу.
// Не входит в ORDERS_TABS (не редактируется, не скрывается, всегда первый).
export const ALL_TAB_ID = "all";

// Особый таб «Другие сделки» — фильтрует не по статусу, а по признаку заявки.
// Внутри него две подвкладки (см. OTHER_GROUPS в OrdersListView):
//  • «Сервис» — флаг is_service: мелкие доделки/переделки по сданному объекту;
//  • «Дубли» — повторные заявки с тем же телефоном (признак считает сервер,
//    duplicate_count/duplicate_ids, см. crm-manager).
// Такие заявки идут по обычным статусам воронки, отдельного статуса у них нет.
export const SERVICE_TAB_ID = "service";

// Заявка-повтор: у клиента с этим телефоном есть заявка, созданная РАНЬШЕ.
// Самая ранняя заявка остаётся в обычной воронке и повтором не считается —
// иначе из этапов пропал бы и оригинал, а вместе с ним деньги из сумм по вкладкам.
export function isDuplicateRepeat(c: { id: number; duplicate_ids?: number[] | null }): boolean {
  const ids = c.duplicate_ids ?? [];
  if (ids.length < 2) return false;
  return Math.min(...ids) !== c.id;
}

// Сервисные заявки (доделки/переделки) идут по своей упрощённой мини-воронке из
// 3 этапов — вместо полной цепочки монтажа (Договор → Предоплата → ... → Доплата).
// Значения статуса переиспользуют обычные "new"/"install_scheduled"/"done" —
// у них уже есть готовые понятные подписи в STATUS_LABELS.
// «call» (В работе) — обычный этап и для сервисных заявок: мастер сначала созванивается
// с клиентом и только потом назначает выезд. Без него сервисные заявки в статусе call
// выпадали из мини-воронки: у карточки не было кнопки следующего шага, а бирка этапа
// не показывалась, хотя такие заявки в списке есть.
export const SERVICE_STATUSES = ["new", "call", "install_scheduled", "done", "cancelled"] as const;

export const SERVICE_NEXT_STATUS: Record<string, string> = {
  new:               "call",
  call:              "install_scheduled",
  install_scheduled: "done",
};

export const SERVICE_NEXT_LABEL: Record<string, string> = {
  new:               "Взять в работу",
  call:              "Назначить монтаж",
  install_scheduled: "Завершить",
};

export const ORDERS_TABS = [
  { id: "leads",    label: "Заявки",    icon: "Inbox",        color: "#8b5cf6", statuses: ["new"] as readonly string[],                                         emptyText: "Новых заявок нет" },
  { id: "working",  label: "В работе",  icon: "Zap",          color: "#a78bfa", statuses: ["call"] as readonly string[],                                        emptyText: "Нет заявок в работе" },
  { id: "measures", label: "Замеры",    icon: "Ruler",        color: "#f59e0b", statuses: ["measure","measured"] as readonly string[],                          emptyText: "Нет замеров" },
  { id: "installs", label: "Монтажи",   icon: "Wrench",       color: "#f97316", statuses: ["contract","prepaid","install_scheduled","install_done","extra_paid"] as readonly string[], emptyText: "Нет активных монтажей" },
  { id: "done",     label: "Финальный", icon: "CheckCircle2", color: "#10b981", statuses: ["done","cancelled"] as readonly string[],                             emptyText: "Нет завершённых заказов" },
  // Другие сделки — фильтр по признакам заявки (сервис / дубль), а не по статусу
  // (statuses пустой). Обработка особая, см. SERVICE_TAB_ID в OrdersListView/OrdersTabs.
  { id: SERVICE_TAB_ID, label: "Другие сделки", icon: "Layers", color: "#14b8a6", statuses: [] as readonly string[], emptyText: "Нет других сделок" },
] as const;

export type OrdersTabId = typeof ORDERS_TABS[number]["id"];

// ── Персонализация табов (localStorage) ───────────────────────────────────────
export const LS_TAB_LABELS  = "orders_tab_labels";
export const LS_TAB_COLORS  = "orders_tab_colors";
export const LS_TAB_HIDDEN  = "orders_tab_hidden";
export const LS_CUSTOM_TABS = "orders_custom_tabs";

export interface CustomOrdersTab {
  id: string;
  label: string;
  color: string;
  icon: string;
  statuses: string[];
  emptyText: string;
}

export function loadTabLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_TAB_LABELS) || "{}"); } catch { return {}; }
}
export function saveTabLabels(v: Record<string, string>) {
  localStorage.setItem(LS_TAB_LABELS, JSON.stringify(v));
}
export function loadTabColors(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_TAB_COLORS) || "{}"); } catch { return {}; }
}
export function saveTabColors(v: Record<string, string>) {
  localStorage.setItem(LS_TAB_COLORS, JSON.stringify(v));
}
export function loadTabHidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_TAB_HIDDEN) || "[]")); } catch { return new Set(); }
}
export function saveTabHidden(v: Set<string>) {
  localStorage.setItem(LS_TAB_HIDDEN, JSON.stringify([...v]));
}
export function loadCustomTabs(): CustomOrdersTab[] {
  try {
    const raw: CustomOrdersTab[] = JSON.parse(localStorage.getItem(LS_CUSTOM_TABS) || "[]");
    return raw.map(t => ({
      ...t,
      statuses:  Array.isArray(t.statuses)  ? t.statuses  : [],
      emptyText: t.emptyText ?? "Нет данных",
      icon:      t.icon      ?? "Layers",
    }));
  } catch { return []; }
}
export function saveCustomTabs(v: CustomOrdersTab[]) {
  localStorage.setItem(LS_CUSTOM_TABS, JSON.stringify(v));
}

export const INSTALL_STEPS = [
  { status: "contract",          label: "Договор",    color: "#06b6d4" },
  { status: "prepaid",           label: "Предоплата", color: "#0ea5e9" },
  { status: "install_scheduled", label: "Назначен",   color: "#f97316" },
  { status: "install_done",      label: "Выполнен",   color: "#fb923c" },
  { status: "extra_paid",        label: "Доплата",    color: "#84cc16" },
];

// ── Персонализация названий/цветов ЭТАПОВ (статусов) внутри вкладки ──────────
// Ключ записи — сам status (напр. "install_scheduled"), значение — новое label/color.
// Используется бирками-подстатусами на вкладках "Замеры" и "Монтажи" + шестерёнкой их настройки.
// Хранится в БД (таблица order_status_labels, ресурс "status-labels" в crm-manager) —
// общая для всех сотрудников компании, см. CrmOrders.tsx.