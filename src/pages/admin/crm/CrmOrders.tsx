import { useState } from "react";
import { crmFetch, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";
import { useTheme } from "./themeContext";
import { ORDERS_TABS, OrdersTabId, INSTALL_STEPS } from "./ordersTypes";
import { OrdersClientCard } from "./OrdersClientCard";
import { OrdersClientRow } from "./OrdersClientRow";
import { OrdersTabs } from "./OrdersTabs";

interface Props {
  clients: Client[];
  loading: boolean;
  onStatusChange: (id: number, status: string) => void;
  onClientRemoved: (id: number) => void;
  onReload: () => void;
}

export default function CrmOrders({ clients: allClients, loading, onStatusChange, onClientRemoved, onReload }: Props) {
  const t = useTheme();
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState<OrdersTabId>("leads");
  const [selected, setSelected]   = useState<Client | null>(null);
  const [viewMode, setViewMode]   = useState<"grid" | "list">("grid");

  const handleNextStep = async (id: number, nextStatus: string) => {
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: nextStatus }) }, { id: String(id) });
    onStatusChange(id, nextStatus);
  };

  const currentTab     = ORDERS_TABS.find(t => t.id === activeTab)!;
  const currentClients = allClients.filter(c => currentTab.statuses.includes(c.status));

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
    <OrdersClientCard key={c.id} c={c} onClick={() => setSelected(c)} onNextStep={handleNextStep} />
  );
  const renderRow = (c: Client) => (
    <OrdersClientRow key={c.id} c={c} onClick={() => setSelected(c)} onNextStep={handleNextStep} />
  );

  return (
    <div className="space-y-4">

      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Воронка заказов</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>Всего клиентов: {allClients.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            <button onClick={() => setViewMode("grid")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition"
              style={{ background: viewMode === "grid" ? "#7c3aed22" : "transparent", color: viewMode === "grid" ? "#7c3aed" : t.textMute }}>
              <Icon name="LayoutGrid" size={13} /> Карточки
            </button>
            <button onClick={() => setViewMode("list")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition"
              style={{ background: viewMode === "list" ? "#7c3aed22" : "transparent", color: viewMode === "list" ? "#7c3aed" : t.textMute }}>
              <Icon name="List" size={13} /> Список
            </button>
          </div>
          <div className="relative w-64">
            <Icon name="Search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону..."
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
        </div>
      </div>

      {/* Табы */}
      <OrdersTabs allClients={allClients} activeTab={activeTab} onSelect={setActiveTab} />

      {/* Контент */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
              <Icon name={currentTab.icon} size={28} className="mb-2 opacity-30" />
              <span className="text-sm">{currentTab.emptyText}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filterSearch(currentClients).map(renderCard)}
          {currentClients.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
              <Icon name={currentTab.icon} size={28} className="mb-2 opacity-30" />
              <span className="text-sm">{currentTab.emptyText}</span>
            </div>
          )}
        </div>
      )}

      {selected && (
        <ClientDrawer
          client={selected}
          allClientOrders={(() => {
            const phone = (selected.phone || "").trim().replace(/\D/g, "");
            return phone ? allClients.filter(c => (c.phone || "").trim().replace(/\D/g, "") === phone) : [selected];
          })()}
          onClose={() => setSelected(null)}
          onUpdated={() => { onReload(); }}
          onDeleted={() => { setSelected(null); onClientRemoved(selected.id); }}
        />
      )}
    </div>
  );
}