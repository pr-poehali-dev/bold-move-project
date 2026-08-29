import { Client } from "./crmApi";
import { CustomOrdersTab } from "./ordersTypes";

export const PRESET_COLORS = [
  "#8b5cf6","#a78bfa","#6366f1","#3b82f6","#06b6d4",
  "#10b981","#f59e0b","#f97316","#ef4444","#ec4899",
  "#64748b","#e2e8f0",
];

export interface Substatus {
  id: number;
  parent_status: string;
  label: string;
  color: string;
  position: number;
}

export interface TabDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  statuses: readonly string[];
  emptyText: string;
}

export interface Props {
  allClients: Client[];
  activeTab: string;
  onSelect: (id: string) => void;
  tabLabels: Record<string, string>;
  tabColors: Record<string, string>;
  hiddenTabs: Set<string>;
  customTabs: CustomOrdersTab[];
  onSaveLabel: (id: string, val: string) => void;
  onSaveColor: (id: string, color: string) => void;
  onDeleteTab: (id: string) => void;
  onAddTab: () => void;
  substatuses: Substatus[];
  onSubstatusesChange: (list: Substatus[]) => void;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  onSaveStatusLabel: (status: string, val: string) => void;
  onSaveStatusColor: (status: string, color: string) => void;
  /** Группы дублей, помеченные как «не дубль» — их заявки не считаются повторами
   *  (ключ группы = отсортированные id через запятую, см. groupKeyOf в mergeFields.ts) */
  notDupKeys?: Set<string>;
}