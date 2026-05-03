import { useState, useEffect } from "react";
import { crmFetch, Client, getClientOrders } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";
import { useTheme } from "./themeContext";
import { ORDERS_TABS } from "./ordersTypes";
import {
  loadSyncedCustomCols, loadSyncedHidden, loadSyncedLabels, loadSyncedColors,
  saveSyncedLabels, saveSyncedColors,
  addSyncedCol, deleteSyncedCol, SyncedCol,
} from "./syncedCols";
import { OrdersEventsPanel } from "./OrdersEventsPanel";
import { OrdersKanbanView } from "./OrdersKanbanView";
import { OrdersListView } from "./OrdersListView";
import type { Substatus } from "./OrdersTabs";

interface Props {
  clients: Client[];
  loading: boolean;
  onStatusChange: (id: number, status: string) => void;
  onClientRemoved: (id: number) => void;
  onReload: () => void;
  initialOrderId?: number | null;
  canEdit?:          boolean;
  canOrdersEdit?:    boolean;
  canFinance?:       boolean;
  canFiles?:         boolean;
  canFieldContacts?: boolean;
  canFieldAddress?:  boolean;
  canFieldDates?:    boolean;
  canFieldFinance?:  boolean;
  canFieldFiles?:    boolean;
  canFieldCancel?:   boolean;
  substatuses?: Substatus[];
  onSubstatusesChange?: (list: Substatus[]) => void;
}

export default function CrmOrders({ clients: allClients, loading, onStatusChange, onClientRemoved, onReload, initialOrderId, canEdit = true, canOrdersEdit = true, canFinance = true, canFiles = true, canFieldContacts = true, canFieldAddress = true, canFieldDates = true, canFieldFinance = true, canFieldFiles = true, canFieldCancel = true, substatuses = [], onSubstatusesChange = () => {} }: Props) {
  const t = useTheme();
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState("leads");
  const [selected, setSelected]   = useState<Client | null>(null);
  const [viewMode, setViewMode]   = useState<"grid" | "list" | "kanban">("grid");

  // Open client from URL ?order= or from calendar
  useEffect(() => {
    if (!initialOrderId || allClients.length === 0) return;
    const found = allClients.find(c => c.id === initialOrderId);
    if (found) {
      setSelected(found);
      const url = new URL(window.location.href);
      url.searchParams.delete("order");
      window.history.replaceState({}, "", url.toString());
    }
  }, [initialOrderId, allClients]);

  // ── Tabs/columns — single source of truth ────────────────────────────────
  const [tabLabels,  setTabLabels]  = useState<Record<string, string>>(loadSyncedLabels);
  const [tabColors,  setTabColors]  = useState<Record<string, string>>(loadSyncedColors);
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(loadSyncedHidden);
  const [customTabs, setCustomTabs] = useState<SyncedCol[]>(loadSyncedCustomCols);

  const handleSaveLabel = (id: string, val: string) => {
    setTabLabels(prev => { const next = { ...prev, [id]: val }; saveSyncedLabels(next); return next; });
  };
  const handleSaveColor = (id: string, color: string) => {
    setTabColors(prev => { const next = { ...prev, [id]: color }; saveSyncedColors(next); return next; });
  };
  const handleDeleteTab = (id: string) => {
    const isBuiltin = ORDERS_TABS.some(t => t.id === id);
    const msg = isBuiltin
      ? `Скрыть этап «${tabLabels[id] || id}»? Он исчезнет из воронки и из канбан-доски.`
      : `Удалить этап «${tabLabels[id] || id}»? Он удалится из воронки и из канбан-доски.`;
    if (!window.confirm(msg)) return;
    deleteSyncedCol(id, isBuiltin);
    if (isBuiltin) {
      setHiddenTabs(prev => { const next = new Set(prev); next.add(id); return next; });
    } else {
      setCustomTabs(prev => prev.filter(c => c.id !== id));
    }
  };
  const handleAddTab = () => {
    const col = addSyncedCol("Новый этап", "#8b5cf6", "Layers");
    setCustomTabs(prev => [...prev, col]);
  };

  // ── Shared client actions ─────────────────────────────────────────────────
  const handleNextStep = async (id: number, nextStatus: string) => {
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: nextStatus }) }, { id: String(id) });
    onStatusChange(id, nextStatus);
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Воронка заказов</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>Всего клиентов: {allClients.length}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode switcher */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            {([
              { mode: "grid",   icon: "LayoutGrid", label: "Карточки" },
              { mode: "list",   icon: "List",       label: "Список" },
              { mode: "kanban", icon: "Kanban",     label: "Канбан" },
            ] as const).map(({ mode, icon, label }) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold transition"
                style={{
                  background: viewMode === mode ? "#7c3aed22" : "transparent",
                  color: viewMode === mode ? "#7c3aed" : t.textMute,
                  borderRight: mode !== "kanban" ? `1px solid ${t.border}` : undefined,
                }}>
                <Icon name={icon} size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:w-64 sm:flex-none min-w-[140px]">
            <Icon name="Search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
        </div>
      </div>

      {/* Events panel: overdue + upcoming */}
      <OrdersEventsPanel
        allClients={allClients}
        loading={loading}
        onSelect={setSelected}
      />

      {/* Kanban or list/grid view */}
      {viewMode === "kanban" ? (
        <OrdersKanbanView
          allClients={allClients}
          search={search}
          onSearch={setSearch}
          onStatusChange={onStatusChange}
          onSelect={setSelected}
          onNextStep={handleNextStep}
        />
      ) : (
        <OrdersListView
          allClients={allClients}
          loading={loading}
          viewMode={viewMode}
          search={search}
          activeTab={activeTab}
          onSelect={setSelected}
          onNextStep={handleNextStep}
          onSetActiveTab={setActiveTab}
          tabLabels={tabLabels}
          tabColors={tabColors}
          hiddenTabs={hiddenTabs}
          customTabs={customTabs}
          onSaveLabel={handleSaveLabel}
          onSaveColor={handleSaveColor}
          onDeleteTab={handleDeleteTab}
          onAddTab={handleAddTab}
          substatuses={substatuses}
          onSubstatusesChange={onSubstatusesChange}
        />
      )}

      {selected && (
        <ClientDrawer
          client={selected}
          defaultTab="orders"
          defaultOrderId={selected.id}
          allClientOrders={getClientOrders(selected, allClients)}
          onClose={() => setSelected(null)}
          onUpdated={() => { onReload(); }}
          onDeleted={() => { setSelected(null); onClientRemoved(selected.id); }}
          canEdit={canEdit}
          canOrdersEdit={canOrdersEdit}
          canFinance={canFinance}
          canFiles={canFiles}
          canFieldContacts={canFieldContacts}
          canFieldAddress={canFieldAddress}
          canFieldDates={canFieldDates}
          canFieldFinance={canFieldFinance}
          canFieldFiles={canFieldFiles}
          canFieldCancel={canFieldCancel}
        />
      )}
    </div>
  );
}