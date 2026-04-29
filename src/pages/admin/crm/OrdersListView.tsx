import { Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { ORDERS_TABS, INSTALL_STEPS } from "./ordersTypes";
import { OrdersClientCard } from "./OrdersClientCard";
import { OrdersClientRow } from "./OrdersClientRow";
import { OrdersTabs } from "./OrdersTabs";
import { SyncedCol } from "./syncedCols";

interface TabDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  statuses: readonly string[];
  emptyText: string;
}

interface Props {
  allClients: Client[];
  loading: boolean;
  viewMode: "grid" | "list";
  search: string;
  activeTab: string;
  onSelect: (c: Client) => void;
  onNextStep: (id: number, nextStatus: string) => void;
  onSetActiveTab: (tab: string) => void;
  // tabs config
  tabLabels: Record<string, string>;
  tabColors: Record<string, string>;
  hiddenTabs: Set<string>;
  customTabs: SyncedCol[];
  onSaveLabel: (id: string, val: string) => void;
  onSaveColor: (id: string, color: string) => void;
  onDeleteTab: (id: string) => void;
  onAddTab: () => void;
}

export function OrdersListView({
  allClients, loading, viewMode, search, activeTab, onSelect, onNextStep, onSetActiveTab,
  tabLabels, tabColors, hiddenTabs, customTabs,
  onSaveLabel, onSaveColor, onDeleteTab, onAddTab,
}: Props) {
  const t = useTheme();

  const allTabDefs: TabDef[] = [
    ...ORDERS_TABS.filter(tab => !hiddenTabs.has(tab.id)).map(tab => ({
      id: tab.id, label: tabLabels[tab.id] || tab.label, icon: tab.icon,
      color: tabColors[tab.id] || tab.color, statuses: tab.statuses as readonly string[], emptyText: tab.emptyText,
    })),
    ...customTabs.map(tab => ({
      id: tab.id, label: tabLabels[tab.id] || tab.label, icon: (tab as SyncedCol & { icon?: string }).icon || "Layers",
      color: tabColors[tab.id] || tab.color, statuses: [] as readonly string[], emptyText: "Нет данных",
    })),
  ] satisfies TabDef[];

  const currentTab = allTabDefs.find(tab => tab.id === activeTab) ?? allTabDefs[0];
  const currentClients = currentTab ? allClients.filter(c => currentTab.statuses.includes(c.status)) : [];

  const filterSearch = (list: Client[]) => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      (c.client_name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.address || "").toLowerCase().includes(q)
    );
  };

  const renderCard = (c: Client) => (
    <OrdersClientCard key={c.id} c={c} onClick={() => onSelect(c)} onNextStep={onNextStep} />
  );
  const renderRow = (c: Client) => (
    <OrdersClientRow key={c.id} c={c} onClick={() => onSelect(c)} onNextStep={onNextStep} />
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
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === "installs" ? (
        <div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {INSTALL_STEPS.map(s => {
              const cnt = allClients.filter(c => c.status === s.status).length;
              return (
                <div key={s.status} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border font-medium"
                  style={{ background: s.color + "10", borderColor: s.color + "30", color: s.color }}>
                  {s.label} <span className="font-bold">{cnt}</span>
                </div>
              );
            })}
          </div>
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
        <div className="space-y-5">
          {[
            { label: "Завершённые", statuses: ["done"],      color: "#10b981", icon: "CheckCircle2" },
            { label: "Отказники",   statuses: ["cancelled"], color: "#ef4444", icon: "XCircle" },
          ].map(group => {
            const items = filterSearch(currentClients.filter(c => group.statuses.includes(c.status)));
            return (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name={group.icon} size={14} style={{ color: group.color }} />
                  <span className="text-sm font-bold" style={{ color: t.textSub }}>{group.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                    style={{ background: group.color + "18", color: group.color }}>{items.length}</span>
                </div>
                {viewMode === "list" ? (
                  <div className="space-y-2">
                    {items.length === 0
                      ? <div className="py-4 text-sm text-center" style={{ color: t.textMute }}>Нет записей</div>
                      : items.map(renderRow)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                    {items.length === 0
                      ? <div className="col-span-3 py-4 text-sm text-center" style={{ color: t.textMute }}>Нет записей</div>
                      : items.map(renderCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {filterSearch(currentClients).map(renderRow)}
          {currentClients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
              <Icon name={currentTab?.icon || "Inbox"} size={28} className="mb-2 opacity-30" />
              <span className="text-sm">{currentTab?.emptyText || "Нет данных"}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filterSearch(currentClients).map(renderCard)}
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