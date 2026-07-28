import { useState, useEffect } from "react";
import { Client, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { ORDERS_TABS, ALL_TAB_ID } from "./ordersTypes";
import { OrdersClientCard } from "./OrdersClientCard";
import { OrdersClientRow } from "./OrdersClientRow";
import { OrdersTabs, Substatus } from "./OrdersTabs";
import { SyncedCol } from "./syncedCols";

interface TabDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  statuses: readonly string[];
  emptyText: string;
}

// Подгруппы внутри таба "Финальный" — переключатель показывает только одну группу за раз
const DONE_GROUPS = [
  { key: "done" as const,      label: "Выполнено", statuses: ["done"],      color: "#10b981", icon: "CheckCircle2" },
  { key: "cancelled" as const, label: "Отказ",      statuses: ["cancelled"],color: "#ef4444", icon: "XCircle" },
];

interface Props {
  allClients: Client[];
  loading: boolean;
  viewMode: "grid" | "list";
  search: string;
  activeTab: string;
  onSelect: (c: Client) => void;
  onNextStep: (id: number, nextStatus: string) => void;
  onSetActiveTab: (tab: string) => void;
  onSwipeBuilder?: (client: Client) => void;
  onSwipeAgent?: (client: Client) => void;
  // tabs config
  tabLabels: Record<string, string>;
  tabColors: Record<string, string>;
  hiddenTabs: Set<string>;
  customTabs: SyncedCol[];
  onSaveLabel: (id: string, val: string) => void;
  onSaveColor: (id: string, color: string) => void;
  onDeleteTab: (id: string) => void;
  onAddTab: () => void;
  substatuses: Substatus[];
  onSubstatusesChange: (list: Substatus[]) => void;
  // персонализация названий/цветов реальных этапов (status) внутри вкладки
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  onSaveStatusLabel: (status: string, val: string) => void;
  onSaveStatusColor: (status: string, color: string) => void;
}

export function OrdersListView({
  allClients, loading, viewMode, search, activeTab, onSelect, onNextStep, onSetActiveTab,
  onSwipeBuilder, onSwipeAgent,
  tabLabels, tabColors, hiddenTabs, customTabs,
  onSaveLabel, onSaveColor, onDeleteTab, onAddTab,
  substatuses, onSubstatusesChange,
  statusLabels, statusColors, onSaveStatusLabel, onSaveStatusColor,
}: Props) {
  const t = useTheme();
  const [doneSubFilter, setDoneSubFilter] = useState<typeof DONE_GROUPS[number]["key"]>("done");

  // Активный статус-фильтр (кликабельная бирка под шапкой). Сбрасывается при смене вкладки.
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  useEffect(() => { setActiveStatusFilter(null); }, [activeTab]);

  const allTabDefs: TabDef[] = [
    ...ORDERS_TABS.filter(tab => !hiddenTabs.has(tab.id)).map(tab => ({
      id: tab.id, label: tabLabels[tab.id] || tab.label, icon: tab.icon,
      color: tabColors[tab.id] || tab.color, statuses: tab.statuses as readonly string[], emptyText: tab.emptyText,
    })),
    ...customTabs.map(tab => ({
      id: tab.id, label: tabLabels[tab.id] || tab.label, icon: (tab as SyncedCol & { icon?: string }).icon || "Layers",
      color: tabColors[tab.id] || tab.color,
      statuses: Array.isArray((tab as { statuses?: string[] }).statuses) ? (tab as { statuses?: string[] }).statuses as readonly string[] : [] as readonly string[],
      emptyText: (tab as { emptyText?: string }).emptyText || "Нет данных",
    })),
  ] satisfies TabDef[];

  const allTabDef: TabDef = { id: ALL_TAB_ID, label: "Все", icon: "LayoutGrid", color: "#64748b", statuses: [], emptyText: "Заявок нет" };
  const currentTab = activeTab === ALL_TAB_ID ? allTabDef : allTabDefs.find(tab => tab.id === activeTab) ?? allTabDefs[0];
  const clientsByStatus = activeTab === ALL_TAB_ID ? allClients : allClients.filter(c => currentTab.statuses.includes(c.status ?? ""));

  // Реальные этапы (статусы) текущей вкладки — бирки показываются только когда
  // на вкладке больше одного статуса (иначе делить нечего: leads/working — по одному).
  // Вкладка "done" уже имеет свой переключатель Выполнено/Отказ — бирки там не дублируем.
  const tabStatuses = activeTab !== "done" && currentTab.statuses.length > 1 ? currentTab.statuses : [];
  const currentClients = activeStatusFilter != null
    ? clientsByStatus.filter(c => c.status === activeStatusFilter)
    : clientsByStatus;

  const renderSubstatusBadges = () => tabStatuses.length > 0 && (
    <div className="flex gap-1.5 flex-wrap mb-4">
      {tabStatuses.map(s => {
        const label = statusLabels[s] || STATUS_LABELS[s] || s;
        const color = statusColors[s] || STATUS_COLORS[s] || "#8b5cf6";
        const cnt = clientsByStatus.filter(c => c.status === s).length;
        const isSel = activeStatusFilter === s;
        return (
          <button key={s} onClick={() => setActiveStatusFilter(isSel ? null : s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border font-medium transition"
            style={{
              background: isSel ? color + "22" : color + "10",
              borderColor: isSel ? color : color + "30",
              color,
            }}>
            {label} <span className="font-bold">{cnt}</span>
          </button>
        );
      })}
    </div>
  );

  const filterSearch = (list: Client[]) => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      (c.client_name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.address || "").toLowerCase().includes(q) ||
      String(c.id).includes(q)
    );
  };

  // На вкладке "Замеры" сортируем по дате замера, на "Монтажи" — по дате монтажа.
  // Ближайшие по времени — первыми, заявки без даты — в конце.
  const sortByDate = (list: Client[]) => {
    const field = activeTab === "measures" ? "measure_date" : activeTab === "installs" ? "install_date" : null;
    if (!field) return list;
    return [...list].sort((a, b) => {
      const da = a[field] ? new Date(a[field] as string).getTime() : Infinity;
      const db = b[field] ? new Date(b[field] as string).getTime() : Infinity;
      return da - db;
    });
  };

  const renderCard = (c: Client) => (
    <OrdersClientCard key={c.id} c={c} allClients={allClients} onClick={() => onSelect(c)} onNextStep={onNextStep}
      onSwipeBuilder={onSwipeBuilder} onSwipeAgent={onSwipeAgent} />
  );
  const renderRow = (c: Client) => (
    <OrdersClientRow key={c.id} c={c} allClients={allClients} onClick={() => onSelect(c)} onNextStep={onNextStep}
      onSwipeBuilder={onSwipeBuilder} onSwipeAgent={onSwipeAgent} />
  );

  return (
    <>
      <OrdersTabs
        allClients={allClients}
        activeTab={activeTab}
        onSelect={onSetActiveTab}
        tabLabels={tabLabels}
        tabColors={tabColors}
        hiddenTabs={hiddenTabs}
        customTabs={customTabs}
        onSaveLabel={onSaveLabel}
        onSaveColor={onSaveColor}
        onDeleteTab={onDeleteTab}
        onAddTab={onAddTab}
        substatuses={substatuses}
        onSubstatusesChange={onSubstatusesChange}
        statusLabels={statusLabels}
        statusColors={statusColors}
        onSaveStatusLabel={onSaveStatusLabel}
        onSaveStatusColor={onSaveStatusColor}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === "installs" ? (
        <div>
          {renderSubstatusBadges()}
          {viewMode === "list" ? (
            <div className="space-y-2">
              {sortByDate(filterSearch(currentClients)).map(renderRow)}
              {currentClients.length === 0 && <div className="py-12 text-sm text-center" style={{ color: t.textMute }}>Нет активных монтажей</div>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {sortByDate(filterSearch(currentClients)).map(renderCard)}
              {currentClients.length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                  <Icon name="Wrench" size={28} className="mb-2 opacity-30" />
                  <span className="text-sm">Нет активных монтажей</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === "done" ? (
        <div>
          {/* Переключатель Выполнено / Отказ — показывает только одну группу за раз */}
          <div className="flex gap-2 mb-4">
            {DONE_GROUPS.map(group => {
              const isSel = doneSubFilter === group.key;
              const cnt = currentClients.filter(c => group.statuses.includes(c.status ?? "")).length;
              return (
                <button key={group.key} onClick={() => setDoneSubFilter(group.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                  style={{
                    background: isSel ? group.color + "18" : t.surface,
                    border: `1px solid ${isSel ? group.color + "45" : t.border}`,
                    color: isSel ? group.color : t.textMute,
                  }}>
                  <Icon name={group.icon} size={13} />
                  {group.label}
                  <span className="px-1.5 py-0.5 rounded-md" style={{ background: group.color + "20", color: group.color }}>{cnt}</span>
                </button>
              );
            })}
          </div>

          {(() => {
            const group = DONE_GROUPS.find(g => g.key === doneSubFilter) ?? DONE_GROUPS[0];
            const items = filterSearch(currentClients.filter(c => group.statuses.includes(c.status ?? "")));
            return viewMode === "list" ? (
              <div className="space-y-2">
                {items.length === 0
                  ? <div className="py-12 text-sm text-center" style={{ color: t.textMute }}>Нет записей</div>
                  : items.map(renderRow)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {items.length === 0
                  ? <div className="col-span-3 py-12 text-sm text-center" style={{ color: t.textMute }}>Нет записей</div>
                  : items.map(renderCard)}
              </div>
            );
          })()}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {renderSubstatusBadges()}
          <div className="space-y-2">
            {sortByDate(filterSearch(currentClients)).map(renderRow)}
            {currentClients.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                <Icon name={currentTab?.icon || "Inbox"} size={28} className="mb-2 opacity-30" />
                <span className="text-sm">{currentTab?.emptyText || "Нет данных"}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {renderSubstatusBadges()}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {sortByDate(filterSearch(currentClients)).map(renderCard)}
            {currentClients.length === 0 && (
              <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                <Icon name={currentTab?.icon || "Inbox"} size={28} className="mb-2 opacity-30" />
                <span className="text-sm">{currentTab?.emptyText || "Нет данных"}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}