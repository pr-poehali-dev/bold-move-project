export interface Stats {
  total_all: number; total_leads: number; total_orders: number;
  total_done: number; total_cancel: number;
  went_measure: number; went_contract: number;
  upcoming_measures: number; upcoming_installs: number;
  total_contract: number; total_received: number;
  total_prepayment: number; total_extra: number;
  total_material: number; total_measure_cost: number; total_install_cost: number;
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

export type AnalyticsTab = "overview" | "finance" | "dynamics";

export const ANALYTICS_TABS: { id: AnalyticsTab; label: string; icon: string }[] = [
  { id: "overview",  label: "Обзор",    icon: "LayoutDashboard" },
  { id: "finance",   label: "Финансы",  icon: "Banknote" },
  { id: "dynamics",  label: "Динамика", icon: "TrendingUp" },
];

export const EMPTY_STATS: Stats = {
  total_all: 0, total_leads: 0, total_orders: 0, total_done: 0, total_cancel: 0,
  went_measure: 0, went_contract: 0, upcoming_measures: 0, upcoming_installs: 0,
  total_contract: 0, total_received: 0, total_prepayment: 0, total_extra: 0,
  total_material: 0, total_measure_cost: 0, total_install_cost: 0,
  total_costs: 0, total_profit: 0, avg_area: 0, avg_contract: 0,
  cancel_reasons: [], funnel: [], status_dist: [],
  monthly_leads: [], monthly_done: [], monthly_revenue: [], monthly_costs: [], monthly_profit: [],
};
