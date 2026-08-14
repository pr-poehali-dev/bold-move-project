import { Client } from "./crmApi";

// Фильтры вкладки «Аналитика»: по стадии сделки и по периоду.
// Оба списка — простые массивы: чтобы добавить/убрать вариант,
// достаточно поправить массив, остальной код менять не нужно.

export type StageFilter = "" | "measure" | "montage" | "final";

export const STAGE_STATUSES: Record<Exclude<StageFilter, "">, string[]> = {
  // Замеры — договора ещё нет, идёт просчёт
  measure: ["new", "call", "measure", "measured"],
  // Монтажи — договор подписан, работа идёт
  montage: ["contract", "prepaid", "install_scheduled", "install_done"],
  // Финал — сделка полностью завершена
  final:   ["done"],
};

export const STAGE_OPTIONS: { id: StageFilter; label: string }[] = [
  { id: "",        label: "Все стадии" },
  { id: "measure", label: "Замеры" },
  { id: "montage", label: "Монтажи" },
  { id: "final",   label: "Финал" },
];

export type PeriodFilter = "all" | "week" | "first_half" | "second_half";

export const PERIOD_OPTIONS: { id: PeriodFilter; label: string }[] = [
  { id: "all",         label: "За всё время" },
  { id: "week",        label: "За неделю" },
  { id: "first_half",  label: "С 1 по 15" },
  { id: "second_half", label: "С 16 по 31" },
];

function inPeriod(iso: string | null | undefined, period: PeriodFilter): boolean {
  if (period === "all") return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;

  if (period === "week") {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return d.getTime() >= weekAgo;
  }

  // Половины месяца считаем внутри ТЕКУЩЕГО месяца
  const now = new Date();
  const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (!sameMonth) return false;
  const day = d.getDate();
  return period === "first_half" ? day <= 15 : day >= 16;
}

/** Применяет к списку заявок все три фильтра сразу (источник / стадия / период). */
export function applyAnalyticsFilters(
  clients: Client[],
  opts: { source?: string; stage?: StageFilter; period?: PeriodFilter },
): Client[] {
  const { source = "", stage = "", period = "all" } = opts;
  return clients.filter(c => {
    if (source && (c.source || "") !== source) return false;
    if (stage && !STAGE_STATUSES[stage].includes(c.status)) return false;
    if (!inPeriod(c.created_at, period)) return false;
    return true;
  });
}
