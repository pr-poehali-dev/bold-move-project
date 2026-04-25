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

export const ORDERS_TABS = [
  { id: "leads",    label: "Заявки",    icon: "Inbox",        color: "#8b5cf6", statuses: ["new"] as readonly string[],                                         emptyText: "Новых заявок нет" },
  { id: "working",  label: "В работе",  icon: "Zap",          color: "#a78bfa", statuses: ["call"] as readonly string[],                                        emptyText: "Нет заявок в работе" },
  { id: "measures", label: "Замеры",    icon: "Ruler",        color: "#f59e0b", statuses: ["measure","measured"] as readonly string[],                          emptyText: "Нет замеров" },
  { id: "installs", label: "Монтажи",   icon: "Wrench",       color: "#f97316", statuses: ["contract","prepaid","install_scheduled","install_done","extra_paid"] as readonly string[], emptyText: "Нет активных монтажей" },
  { id: "done",     label: "Выполнено", icon: "CheckCircle2", color: "#10b981", statuses: ["done","cancelled"] as readonly string[],                             emptyText: "Нет завершённых заказов" },
] as const;

export type OrdersTabId = typeof ORDERS_TABS[number]["id"];

export const INSTALL_STEPS = [
  { status: "contract",          label: "Договор",    color: "#06b6d4" },
  { status: "prepaid",           label: "Предоплата", color: "#0ea5e9" },
  { status: "install_scheduled", label: "Назначен",   color: "#f97316" },
  { status: "install_done",      label: "Выполнен",   color: "#fb923c" },
  { status: "extra_paid",        label: "Доплата",    color: "#84cc16" },
];
