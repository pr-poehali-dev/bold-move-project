// ── Единое хранилище этапов воронки (Заказы ↔ Канбан) ────────────────────────
// Встроенные этапы — константа, общая для обоих видов

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
  icon: string;        // для Заказов
  statuses: string[];  // клиентские статусы БД входящие в этап
  emptyText: string;   // для Заказов
}

export const BUILTIN_STAGES: PipelineStage[] = [
  { id: "leads",    label: "Заявки",    icon: "Inbox",        color: "#8b5cf6", statuses: ["new"],                                                                               emptyText: "Новых заявок нет" },
  { id: "working",  label: "В работе",  icon: "Zap",          color: "#a78bfa", statuses: ["call"],                                                                              emptyText: "Нет заявок в работе" },
  { id: "measures", label: "Замеры",    icon: "Ruler",        color: "#f59e0b", statuses: ["measure","measured"],                                                                emptyText: "Нет замеров" },
  { id: "installs", label: "Монтажи",   icon: "Wrench",       color: "#f97316", statuses: ["contract","prepaid","install_scheduled","install_done","extra_paid"],                emptyText: "Нет активных монтажей" },
  { id: "done",     label: "Выполнено", icon: "CheckCircle2", color: "#10b981", statuses: ["done","cancelled"],                                                                  emptyText: "Нет завершённых заказов" },
];

// Маппирование colId → первый статус (при drag-and-drop / переходе)
export const DROP_STATUS: Record<string, string> = {
  leads:    "new",
  working:  "call",
  measures: "measure",
  installs: "contract",
  done:     "done",
};

// ── Единые ключи localStorage ─────────────────────────────────────────────────
export const LS_PIPELINE_LABELS  = "pipeline_labels";   // Record<id, string>
export const LS_PIPELINE_COLORS  = "pipeline_colors";   // Record<id, string>
export const LS_PIPELINE_HIDDEN  = "pipeline_hidden";   // string[]
export const LS_PIPELINE_CUSTOM  = "pipeline_custom";   // CustomStage[]

export interface CustomStage {
  id: string;     // "custom_stage_<timestamp>"
  label: string;
  color: string;
  icon: string;
  statuses: string[];
  emptyText: string;
}

// ── Функции чтения/записи ─────────────────────────────────────────────────────
export function loadPipelineLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_PIPELINE_LABELS) || "{}"); } catch { return {}; }
}
export function savePipelineLabels(v: Record<string, string>) {
  localStorage.setItem(LS_PIPELINE_LABELS, JSON.stringify(v));
}

export function loadPipelineColors(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_PIPELINE_COLORS) || "{}"); } catch { return {}; }
}
export function savePipelineColors(v: Record<string, string>) {
  localStorage.setItem(LS_PIPELINE_COLORS, JSON.stringify(v));
}

export function loadPipelineHidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_PIPELINE_HIDDEN) || "[]")); } catch { return new Set(); }
}
export function savePipelineHidden(v: Set<string>) {
  localStorage.setItem(LS_PIPELINE_HIDDEN, JSON.stringify([...v]));
}

export function loadCustomStages(): CustomStage[] {
  try { return JSON.parse(localStorage.getItem(LS_PIPELINE_CUSTOM) || "[]"); } catch { return []; }
}
export function saveCustomStages(v: CustomStage[]) {
  localStorage.setItem(LS_PIPELINE_CUSTOM, JSON.stringify(v));
}

// ── Получить все этапы (встроенные + кастомные) с учётом переименований/цветов ─
export function getAllStages(
  labels: Record<string, string>,
  colors: Record<string, string>,
  customStages: CustomStage[],
  hidden: Set<string>,
  includeHidden = false,
): (PipelineStage & { isBuiltin: boolean })[] {
  const builtin = BUILTIN_STAGES
    .filter(s => includeHidden || !hidden.has(s.id))
    .map(s => ({
      ...s,
      label: labels[s.id] || s.label,
      color: colors[s.id] || s.color,
      isBuiltin: true,
    }));

  const custom = customStages
    .filter(s => includeHidden || !hidden.has(s.id))
    .map(s => ({
      ...s,
      label: labels[s.id] || s.label,
      color: colors[s.id] || s.color,
      isBuiltin: false,
    }));

  return [...builtin, ...custom];
}

// Мигрировать старые данные из разных ключей в единый формат
export function migrateOldData() {
  // Если уже мигрировали — пропускаем
  if (localStorage.getItem("pipeline_migrated")) return;

  // Мигрируем labels (берём из kanban, они более свежие если есть)
  const kanbanLabels = JSON.parse(localStorage.getItem("kanban_col_labels") || "{}");
  const ordersLabels = JSON.parse(localStorage.getItem("orders_tab_labels") || "{}");
  const merged = { ...ordersLabels, ...kanbanLabels };

  // Маппинг старых kanban id → новые pipeline id
  const KANBAN_TO_PIPELINE: Record<string, string> = {
    new: "leads", working: "working", measures: "measures", installs: "installs",
    done: "done", cancelled: "done",
  };
  const ORDERS_TO_PIPELINE: Record<string, string> = {
    leads: "leads", working: "working", measures: "measures", installs: "installs", done: "done",
  };

  const pipelineLabels: Record<string, string> = {};
  Object.entries(kanbanLabels).forEach(([k, v]) => {
    const pid = KANBAN_TO_PIPELINE[k] || k;
    pipelineLabels[pid] = v as string;
  });
  Object.entries(ordersLabels).forEach(([k, v]) => {
    const pid = ORDERS_TO_PIPELINE[k] || k;
    if (!pipelineLabels[pid]) pipelineLabels[pid] = v as string;
  });

  // Мигрируем colors
  const kanbanColors = JSON.parse(localStorage.getItem("kanban_col_colors") || "{}");
  const ordersColors = JSON.parse(localStorage.getItem("orders_tab_colors") || "{}");
  const pipelineColors: Record<string, string> = {};
  Object.entries(kanbanColors).forEach(([k, v]) => {
    const pid = KANBAN_TO_PIPELINE[k] || k;
    pipelineColors[pid] = v as string;
  });

  // Мигрируем hidden
  const kanbanHidden: string[] = JSON.parse(localStorage.getItem("kanban_hidden_cols") || "[]");
  const ordersHidden: string[] = JSON.parse(localStorage.getItem("orders_tab_hidden") || "[]");
  const pipelineHidden = new Set<string>();
  kanbanHidden.forEach(k => { const pid = KANBAN_TO_PIPELINE[k]; if (pid) pipelineHidden.add(pid); });
  ordersHidden.forEach(k => { const pid = ORDERS_TO_PIPELINE[k]; if (pid) pipelineHidden.add(pid); });

  // Мигрируем кастомные (берём из orders_custom_tabs как более полные)
  const customTabs = JSON.parse(localStorage.getItem("orders_custom_tabs") || "[]");
  const customStages: CustomStage[] = customTabs.map((t: { id: string; label: string; color: string; icon: string; statuses: string[]; emptyText: string }) => ({
    id: t.id.startsWith("custom_tab_") ? t.id.replace("custom_tab_", "custom_stage_") : t.id,
    label: t.label,
    color: t.color,
    icon: t.icon || "Layers",
    statuses: t.statuses || [],
    emptyText: t.emptyText || "",
  }));

  if (Object.keys(pipelineLabels).length) savePipelineLabels(pipelineLabels);
  if (Object.keys(pipelineColors).length) savePipelineColors(pipelineColors);
  if (pipelineHidden.size) savePipelineHidden(pipelineHidden);
  if (customStages.length) saveCustomStages(customStages);

  localStorage.setItem("pipeline_migrated", "1");
}
