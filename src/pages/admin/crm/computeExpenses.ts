import { Client } from "./crmApi";
import { Expense } from "@/hooks/useExpenses";
import { CustomRange, PeriodFilter } from "./analyticsFilters";

// Расчёт экономики вложений: сколько потратили (реклама / ЗП / общие),
// сколько заработали и какова стоимость лида на каждом этапе воронки.
// Всё считается в браузере — сервер не нагружаем.

const WENT_MEASURE = ["measure", "measured", "contract", "prepaid", "install_scheduled", "install_done", "extra_paid", "done"];
const WENT_MONTAGE = ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid", "done"];

/** Строка таблицы «Воронка и стоимость лида по источникам». */
export interface SourceRow {
  source: string;
  adService: number;
  adBudget: number;
  adTotal: number;
  leads: number;
  measures: number;
  montages: number;
  finals: number;
  cplLead: number | null;
  cplMeasure: number | null;
  cplMontage: number | null;
  cplFinal: number | null;
  convFinal: number | null;
  revenue: number;
}

/** Итоговая экономика: доход, все виды вложений, чистая прибыль. */
export interface ExpenseSummary {
  income: number;
  adTotal: number;
  adService: number;
  adBudget: number;
  salaryTotal: number;
  generalTotal: number;
  dealCosts: number;
  totalSpend: number;
  netProfit: number;
  profitability: number | null;
  leads: number;
  finals: number;
  cplLead: number | null;
  cac: number | null;
  convFinal: number | null;
}

const safeDiv = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** Попадает ли дата расхода в выбранный период шапки аналитики. */
export function expenseInPeriod(spentOn: string | null, period: PeriodFilter, range?: CustomRange | null): boolean {
  if (period === "all") return true;
  if (!spentOn) return false;
  const d = new Date(`${spentOn}T12:00:00`);
  if (isNaN(d.getTime())) return false;

  if (period === "week") return d.getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000;

  if (period === "custom") {
    if (!range?.from || !range?.to) return true;
    const from = new Date(`${range.from}T00:00:00`).getTime();
    const to   = new Date(`${range.to}T23:59:59.999`).getTime();
    if (isNaN(from) || isNaN(to)) return true;
    return d.getTime() >= from && d.getTime() <= to;
  }

  const now = new Date();
  if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
  if (period === "month") return true;
  return period === "first_half" ? d.getDate() <= 15 : d.getDate() >= 16;
}

/** Отбирает расходы под выбранный период (и источник, если он задан в шапке). */
export function filterExpenses(
  expenses: Expense[],
  opts: { period?: PeriodFilter; range?: CustomRange | null; source?: string },
): Expense[] {
  const { period = "all", range = null, source = "" } = opts;
  return expenses.filter(e => {
    if (!expenseInPeriod(e.spent_on, period, range)) return false;
    // Фильтр по источнику применяем только к рекламным расходам:
    // ЗП и общие расходы к конкретному каналу не привязаны.
    if (source && (e.category_kind === "ad_service" || e.category_kind === "ad_budget")) {
      return (e.source_name || "") === source;
    }
    return true;
  });
}

/** Разбивка заявок по этапам воронки в разрезе рекламных источников. */
function funnelBySource(clients: Client[]) {
  const map = new Map<string, { leads: number; measures: number; montages: number; finals: number; revenue: number }>();
  for (const c of clients) {
    const key = c.source || "Без источника";
    const row = map.get(key) ?? { leads: 0, measures: 0, montages: 0, finals: 0, revenue: 0 };
    row.leads += 1;
    if (WENT_MEASURE.includes(c.status)) row.measures += 1;
    if (WENT_MONTAGE.includes(c.status)) row.montages += 1;
    if (c.status === "done") {
      row.finals += 1;
      row.revenue += Number(c.contract_sum) || 0;
    }
    map.set(key, row);
  }
  return map;
}

/** Главная таблица: одна строка = один источник, стоимость лида на каждом этапе. */
export function computeSourceRows(clients: Client[], expenses: Expense[]): SourceRow[] {
  const funnel = funnelBySource(clients);

  const adBySource = new Map<string, { service: number; budget: number }>();
  for (const e of expenses) {
    if (e.category_kind !== "ad_service" && e.category_kind !== "ad_budget") continue;
    const key = e.source_name || "Без источника";
    const row = adBySource.get(key) ?? { service: 0, budget: 0 };
    if (e.category_kind === "ad_service") row.service += e.amount;
    else row.budget += e.amount;
    adBySource.set(key, row);
  }

  const names = new Set<string>([...funnel.keys(), ...adBySource.keys()]);

  return [...names].map(name => {
    const f  = funnel.get(name)    ?? { leads: 0, measures: 0, montages: 0, finals: 0, revenue: 0 };
    const ad = adBySource.get(name) ?? { service: 0, budget: 0 };
    const adTotal = ad.service + ad.budget;
    return {
      source: name,
      adService: ad.service,
      adBudget: ad.budget,
      adTotal,
      leads: f.leads,
      measures: f.measures,
      montages: f.montages,
      finals: f.finals,
      // Расхода нет (органика, сарафан) → стоимость лида не считаем, показываем «—»
      cplLead:    adTotal > 0 ? safeDiv(adTotal, f.leads)    : null,
      cplMeasure: adTotal > 0 ? safeDiv(adTotal, f.measures) : null,
      cplMontage: adTotal > 0 ? safeDiv(adTotal, f.montages) : null,
      cplFinal:   adTotal > 0 ? safeDiv(adTotal, f.finals)   : null,
      convFinal:  f.leads > 0 ? (f.finals / f.leads) * 100   : null,
      revenue: f.revenue,
    };
  }).sort((a, b) => b.adTotal - a.adTotal || b.leads - a.leads);
}

/** Итоги: доход минус все вложения = реальный результат по деньгам. */
export function computeExpenseSummary(
  clients: Client[],
  expenses: Expense[],
  opts: { income: number; dealCosts: number },
): ExpenseSummary {
  let adService = 0, adBudget = 0, salaryTotal = 0, generalTotal = 0;
  for (const e of expenses) {
    if (e.category_kind === "ad_service")      adService    += e.amount;
    else if (e.category_kind === "ad_budget")  adBudget     += e.amount;
    else if (e.category_kind === "salary")     salaryTotal  += e.amount;
    else                                       generalTotal += e.amount;
  }
  const adTotal    = adService + adBudget;
  const totalSpend = adTotal + salaryTotal + generalTotal + opts.dealCosts;
  const netProfit  = opts.income - totalSpend;

  const leads  = clients.length;
  const finals = clients.filter(c => c.status === "done").length;

  return {
    income: opts.income,
    adTotal, adService, adBudget, salaryTotal, generalTotal,
    dealCosts: opts.dealCosts,
    totalSpend,
    netProfit,
    profitability: opts.income > 0 ? (netProfit / opts.income) * 100 : null,
    leads, finals,
    cplLead: adTotal > 0 ? safeDiv(adTotal, leads)  : null,
    cac:     adTotal > 0 ? safeDiv(adTotal, finals) : null,
    convFinal: leads > 0 ? (finals / leads) * 100   : null,
  };
}

/** Данные для круговой диаграммы структуры вложений. */
export function computeExpensePie(
  expenses: Expense[],
  mode: "category" | "source" | "type",
): { name: string; value: number; color: string }[] {
  const map = new Map<string, { value: number; color: string }>();
  const palette = ["#f97316", "#8b5cf6", "#06b6d4", "#10b981", "#ef4444", "#f59e0b", "#64748b", "#ec4899"];
  let idx = 0;

  for (const e of expenses) {
    let key: string;
    let color: string;
    if (mode === "category") {
      key = e.category_name;
      color = e.category_color;
    } else if (mode === "source") {
      const isAd = e.category_kind === "ad_service" || e.category_kind === "ad_budget";
      key = isAd ? (e.source_name || "Реклама без источника") : "Не реклама";
      color = palette[idx % palette.length];
    } else {
      key = e.category_kind === "ad_service" ? "Услуга"
          : e.category_kind === "ad_budget" ? "Бюджет"
          : e.category_kind === "salary"    ? "Зарплаты"
          : "Общие";
      color = key === "Услуга" ? "#f97316" : key === "Бюджет" ? "#fb923c" : key === "Зарплаты" ? "#8b5cf6" : "#64748b";
    }
    const row = map.get(key);
    if (row) row.value += e.amount;
    else { map.set(key, { value: e.amount, color }); idx++; }
  }

  return [...map.entries()]
    .map(([name, v]) => ({ name, value: v.value, color: v.color }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

export const fmtMoney = (v: number | null): string =>
  v === null ? "—" : `${Math.round(v).toLocaleString("ru-RU")} ₽`;

export const fmtPct = (v: number | null): string =>
  v === null ? "—" : `${v.toFixed(1).replace(".0", "")}%`;
