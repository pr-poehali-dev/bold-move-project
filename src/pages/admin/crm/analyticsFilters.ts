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

// "custom" — произвольный диапазон дат, задаётся через модалку «Выбрать период»
export type PeriodFilter = "all" | "week" | "first_half" | "second_half" | "month" | "custom";

/** Произвольный диапазон: даты в формате "YYYY-MM-DD" (границы включительно). */
export interface CustomRange { from: string; to: string }

export const PERIOD_OPTIONS: { id: PeriodFilter; label: string }[] = [
  { id: "all",         label: "За всё время" },
  { id: "week",        label: "За неделю" },
  { id: "first_half",  label: "С 1 по 15" },
  { id: "second_half", label: "С 16 по 31" },
  { id: "month",       label: "За месяц" },
];

/** Человекочитаемая подпись периода (для шапки аналитики). */
export function periodLabel(period: PeriodFilter, range?: CustomRange | null): string {
  if (period === "custom" && range?.from && range?.to) {
    const fmt = (s: string) => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleDateString("ru-RU");
    };
    return `с ${fmt(range.from)} по ${fmt(range.to)}`;
  }
  return PERIOD_OPTIONS.find(o => o.id === period)?.label.toLowerCase() ?? "";
}

function inPeriod(iso: string | null | undefined, period: PeriodFilter, range?: CustomRange | null): boolean {
  if (period === "all") return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;

  if (period === "week") {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return d.getTime() >= weekAgo;
  }

  if (period === "custom") {
    if (!range?.from || !range?.to) return true;
    const from = new Date(`${range.from}T00:00:00`).getTime();
    const to   = new Date(`${range.to}T23:59:59.999`).getTime();
    if (isNaN(from) || isNaN(to)) return true;
    return d.getTime() >= from && d.getTime() <= to;
  }

  // "month" и половины месяца считаем внутри ТЕКУЩЕГО календарного месяца
  const now = new Date();
  const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (!sameMonth) return false;
  if (period === "month") return true;
  const day = d.getDate();
  return period === "first_half" ? day <= 15 : day >= 16;
}

/** Применяет к списку заявок все фильтры сразу (источник / стадия / период). */
export function applyAnalyticsFilters(
  clients: Client[],
  opts: { source?: string; stage?: StageFilter; period?: PeriodFilter; range?: CustomRange | null },
): Client[] {
  const { source = "", stage = "", period = "all", range = null } = opts;
  return clients.filter(c => {
    if (source && (c.source || "") !== source) return false;
    if (stage && !STAGE_STATUSES[stage].includes(c.status)) return false;
    if (!inPeriod(c.created_at, period, range)) return false;
    return true;
  });
}