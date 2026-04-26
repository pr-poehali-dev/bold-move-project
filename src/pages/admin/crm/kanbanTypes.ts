export const KANBAN_COLS = [
  { id: "new",       label: "Новые заявки", color: "#8b5cf6", statuses: ["new"]                                                                    },
  { id: "working",   label: "В работе",     color: "#a78bfa", statuses: ["call"]                                                                   },
  { id: "measures",  label: "Замеры",       color: "#f59e0b", statuses: ["measure", "measured"]                                                    },
  { id: "installs",  label: "Монтажи",      color: "#f97316", statuses: ["contract","prepaid","install_scheduled","install_done","extra_paid"]      },
  { id: "done",      label: "Выполнено",    color: "#10b981", statuses: ["done"]                                                                   },
  { id: "cancelled", label: "Отказники",    color: "#ef4444", statuses: ["cancelled"]                                                              },
] as const;

export type ColId = typeof KANBAN_COLS[number]["id"];
export type KanbanCol = typeof KANBAN_COLS[number];

// Кастомная колонка (добавляется пользователем)
export interface CustomKanbanCol {
  id: string;       // "custom_col_<timestamp>"
  label: string;
  color: string;
  statuses: string[];  // всегда []
}

export const DROP_STATUS: Record<string, string> = {
  new:       "new",
  working:   "call",
  measures:  "measure",
  installs:  "contract",
  done:      "done",
  cancelled: "cancelled",
};

export const NEXT_STATUS: Record<string, string> = {
  new: "call", call: "measure", measure: "measured", measured: "contract",
  contract: "prepaid", prepaid: "install_scheduled",
  install_scheduled: "install_done", install_done: "extra_paid", extra_paid: "done",
};

export const NEXT_LABEL: Record<string, string> = {
  new: "Взять в работу", call: "Назначить замер", measure: "Замер выполнен",
  measured: "Подписать договор", contract: "Предоплата", prepaid: "Назначить монтаж",
  install_scheduled: "Монтаж выполнен", install_done: "Доплата", extra_paid: "Завершить",
};

export const DEFAULT_WIDTH = 240;
export const MIN_WIDTH = 160;
export const MAX_WIDTH = 480;
export const LS_GLOBAL_WIDTH = "kanban_global_width";

export const LS_KEY         = "kanban_col_widths";
export const LS_HIDDEN      = "kanban_hidden_cols";
export const LS_LABELS      = "kanban_col_labels";
export const LS_COLORS      = "kanban_col_colors";
export const LS_CUSTOM_COLS = "kanban_custom_cols";

export function loadColors(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_COLORS) || "{}"); } catch { return {}; }
}
export function saveColors(c: Record<string, string>) {
  localStorage.setItem(LS_COLORS, JSON.stringify(c));
}

export function loadWidths(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
export function saveWidths(w: Record<string, number>) {
  localStorage.setItem(LS_KEY, JSON.stringify(w));
}
export function loadGlobalWidth(): number {
  try { const v = localStorage.getItem(LS_GLOBAL_WIDTH); return v ? Number(v) : DEFAULT_WIDTH; } catch { return DEFAULT_WIDTH; }
}
export function saveGlobalWidth(w: number) {
  localStorage.setItem(LS_GLOBAL_WIDTH, String(w));
}
export function loadHidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_HIDDEN) || "[]")); } catch { return new Set(); }
}
export function loadLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_LABELS) || "{}"); } catch { return {}; }
}
export function loadCustomCols(): CustomKanbanCol[] {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM_COLS) || "[]"); } catch { return []; }
}
export function saveCustomCols(cols: CustomKanbanCol[]) {
  localStorage.setItem(LS_CUSTOM_COLS, JSON.stringify(cols));
}
