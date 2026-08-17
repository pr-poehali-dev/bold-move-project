export interface Stats {
  total_all: number; total_leads: number; total_orders: number;
  total_done: number; total_cancel: number;
  went_measure: number; went_contract: number;
  upcoming_measures: number; upcoming_installs: number;
  total_contract: number; total_received: number;
  received_measure: number; received_montage: number; received_final: number;
  total_prepayment: number; total_extra: number;
  total_material: number; total_measure_cost: number; total_install_cost: number;
  total_management: number; total_custom_costs: number;
  total_costs: number; total_profit: number;
  avg_area: number; avg_contract: number;
  cancel_reasons: { reason: string; count: number }[];
  funnel: { label: string; count: number; status: string }[];
  status_dist: { status: string; count: number }[];
  monthly_leads:   { month: string; count: number }[];
  monthly_done:    { month: string; count: number }[];
  monthly_revenue: { month: string; revenue: number }[];
  monthly_costs:   { month: string; costs: number }[];
  monthly_profit:  { month: string; profit: number }[];
}

/** Воронка по месяцам: сколько заявок прошло каждый этап в конкретном месяце.
 *  Не зависит от фильтра стадии в шапке — показывает весь путь заявок целиком. */
export interface FunnelMonth {
  month: string;
  leads: number;    // пришли (дата создания)
  measures: number; // дошли до замера (дата замера)
  montages: number; // дошли до монтажа (дата монтажа)
  done: number;     // закрыты (дата закрытия сделки)
}

export type AnalyticsTab = "overview" | "finance" | "expenses" | "touches";

export const ANALYTICS_TABS: { id: AnalyticsTab; label: string; icon: string }[] = [
  { id: "overview",  label: "Обзор",    icon: "LayoutDashboard" },
  { id: "finance",   label: "Финансы",  icon: "Banknote" },
  { id: "expenses",  label: "Расходы",  icon: "Receipt" },
  { id: "touches",   label: "Касания",  icon: "MessagesSquare" },
];

export const EMPTY_STATS: Stats = {
  total_all: 0, total_leads: 0, total_orders: 0, total_done: 0, total_cancel: 0,
  went_measure: 0, went_contract: 0, upcoming_measures: 0, upcoming_installs: 0,
  total_contract: 0, total_received: 0,
  received_measure: 0, received_montage: 0, received_final: 0,
  total_prepayment: 0, total_extra: 0,
  total_material: 0, total_measure_cost: 0, total_install_cost: 0,
  total_management: 0, total_custom_costs: 0,
  total_costs: 0, total_profit: 0, avg_area: 0, avg_contract: 0,
  cancel_reasons: [], funnel: [], status_dist: [],
  monthly_leads: [], monthly_done: [], monthly_revenue: [], monthly_costs: [], monthly_profit: [],
};