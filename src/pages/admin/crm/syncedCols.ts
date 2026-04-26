/**
 * Единый источник правды для колонок воронки/канбана.
 * Заказы и Канбан используют ОДНИ И ТЕ ЖЕ ключи localStorage.
 *
 * Встроенные колонки (KANBAN_COLS / ORDERS_TABS) имеют одинаковые id:
 *   leads/new, working, measures, installs, done
 *
 * Кастомные колонки — один общий список: "synced_custom_cols"
 * Скрытые колонки — один общий список: "synced_hidden_cols"
 * Метки — один общий список: "synced_col_labels"
 * Цвета — один общий список: "synced_col_colors"
 */

export const LS_SYNCED_CUSTOM  = "synced_custom_cols";
export const LS_SYNCED_HIDDEN  = "synced_hidden_cols";
export const LS_SYNCED_LABELS  = "synced_col_labels";
export const LS_SYNCED_COLORS  = "synced_col_colors";

export interface SyncedCol {
  id: string;
  label: string;
  color: string;
  icon?: string;
}

// ── Кастомные колонки ─────────────────────────────────────────────────────────
export function loadSyncedCustomCols(): SyncedCol[] {
  try { return JSON.parse(localStorage.getItem(LS_SYNCED_CUSTOM) || "[]"); } catch { return []; }
}
export function saveSyncedCustomCols(cols: SyncedCol[]) {
  localStorage.setItem(LS_SYNCED_CUSTOM, JSON.stringify(cols));
}

// ── Скрытые встроенные колонки ────────────────────────────────────────────────
export function loadSyncedHidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SYNCED_HIDDEN) || "[]")); } catch { return new Set(); }
}
export function saveSyncedHidden(v: Set<string>) {
  localStorage.setItem(LS_SYNCED_HIDDEN, JSON.stringify([...v]));
}

// ── Метки колонок ─────────────────────────────────────────────────────────────
export function loadSyncedLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_SYNCED_LABELS) || "{}"); } catch { return {}; }
}
export function saveSyncedLabels(v: Record<string, string>) {
  localStorage.setItem(LS_SYNCED_LABELS, JSON.stringify(v));
}

// ── Цвета колонок ─────────────────────────────────────────────────────────────
export function loadSyncedColors(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_SYNCED_COLORS) || "{}"); } catch { return {}; }
}
export function saveSyncedColors(v: Record<string, string>) {
  localStorage.setItem(LS_SYNCED_COLORS, JSON.stringify(v));
}

// ── Добавить колонку ──────────────────────────────────────────────────────────
export function addSyncedCol(label: string, color = "#8b5cf6", icon = "Layers"): SyncedCol {
  const id = `custom_col_${Date.now()}`;
  const col: SyncedCol = { id, label, color, icon };
  const current = loadSyncedCustomCols();
  saveSyncedCustomCols([...current, col]);
  return col;
}

// ── Удалить / скрыть колонку ──────────────────────────────────────────────────
export function deleteSyncedCol(id: string, isBuiltin: boolean) {
  if (isBuiltin) {
    const hidden = loadSyncedHidden();
    hidden.add(id);
    saveSyncedHidden(hidden);
  } else {
    const cols = loadSyncedCustomCols().filter(c => c.id !== id);
    saveSyncedCustomCols(cols);
  }
}
