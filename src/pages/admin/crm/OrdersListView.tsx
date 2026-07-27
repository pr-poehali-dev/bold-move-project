import { useState } from "react";
import { Client } from "./crmApi";
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
}

export function OrdersListView({
  allClients, loading, viewMode, search, activeTab, onSelect, onNextStep, onSetActiveTab,
  onSwipeBuilder, onSwipeAgent,
  tabLabels, tabColors, hiddenTabs, customTabs,
  onSaveLabel, onSaveColor, onDeleteTab, onAddTab,
  substatuses, onSubstatusesChange,
}: Props) {
  const t = useTheme();
  const [doneSubFilter, setDoneSubFilter] = useState<typeof DONE_GROUPS[number]["key"]>("done");

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
  const currentClients = activeTab === ALL_TAB_ID ? allClients : allClients.filter(c => currentTab.statuses.includes(c.status ?? ""));

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

  // На вкладке "Замеры" — сортируем по дате замера (ближайшие первыми, без даты — в конце)
  const sortByMeasureDate = (list: Client[]) => {
    if (activeTab !== "measures") return list;
    return [...list].sort((a, b) => {
      const da = a.measure_date ? new Date(a.measure_date).getTime() : Infinity;
      const db = b.measure_date ? new Date(b.measure_date).getTime() : Infinity;
      return da - db;
    });
  };

  const renderCard = (c: Client) => (
    <OrdersClientCard key={c.id} c={c} onClick={() => onSelect(c)} onNextStep={onNextStep}
      onSwipeBuilder={onSwipeBuilder} onSwipeAgent={onSwipeAgent} />
  );
  const renderRow = (c: Client) => (
    <OrdersClientRow key={c.id} c={c} onClick={() => onSelect(c)} onNextStep={onNextStep}
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
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === "installs" ? (
        <div>
          {substatuses.filter(s => s.parent_status === "installs").length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-4">
              {substatuses.filter(s => s.parent_status === "installs").map(s => {
                const cnt = allClients.filter(c => c.sub_status === String(s.id)).length;
                return (
                  <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border font-medium"
                    style={{ background: s.color + "10", borderColor: s.color + "30", color: s.color }}>
                    {s.label} <span className="font-bold">{cnt}</span>
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === "list" ? (
            <div className="space-y-2">
              {filterSearch(currentClients).map(renderRow)}
              {currentClients.length === 0 && <div className="py-12 text-sm text-center" style={{ color: t.textMute }}>Нет активных монтажей</div>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filterSearch(currentClients).map(renderCard)}
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
        <div className="space-y-2">
          {sortByMeasureDate(filterSearch(currentClients)).map(renderRow)}
          {currentClients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
              <Icon name={currentTab?.icon || "Inbox"} size={28} className="mb-2 opacity-30" />
              <span className="text-sm">{currentTab?.emptyText || "Нет данных"}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {sortByMeasureDate(filterSearch(currentClients)).map(renderCard)}
          {currentClients.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
              <Icon name={currentTab?.icon || "Inbox"} size={28} className="mb-2 opacity-30" />
              <span className="text-sm">{currentTab?.emptyText || "Нет данных"}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}