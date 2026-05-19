import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { crmFetch, Client, getClientOrders, getCrmToken } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";
import CrmActionModal from "./CrmActionModal";
import { AddClientModal } from "./AddClientModal";
import { useTheme } from "./themeContext";
import { ORDERS_TABS } from "./ordersTypes";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];
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
  onDrawerClose?: () => void;
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

export default function CrmOrders({ clients: allClients, loading, onStatusChange, onClientRemoved, onReload, initialOrderId, onDrawerClose, canEdit = true, canOrdersEdit = true, canFinance = true, canFiles = true, canFieldContacts = true, canFieldAddress = true, canFieldDates = true, canFieldFinance = true, canFieldFiles = true, canFieldCancel = true, substatuses = [], onSubstatusesChange = () => {} }: Props) {
  const t = useTheme();
  const navigate = useNavigate();
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState("leads");
  const [selected, setSelected]   = useState<Client | null>(null);
  const [viewMode, setViewMode]   = useState<"grid" | "list" | "kanban">("grid");

  // Open client from URL ?order= or from calendar
  const [initialHandled, setInitialHandled] = useState(false);
  useEffect(() => {
    if (!initialOrderId || allClients.length === 0 || initialHandled) return;
    const found = allClients.find(c => c.id === initialOrderId);
    if (found) {
      setSelected(found);
      setInitialHandled(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("order");
      window.history.replaceState({}, "", url.toString());
    }
  }, [initialOrderId, allClients, initialHandled]);

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

  // ── Модалка подтверждения действия ───────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionModal, setActionModal] = useState<{ type: "builder" | "agent"; client: Client } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleSwipeBuilder = (client: Client) => setActionModal({ type: "builder", client });
  const handleSwipeAgent   = (client: Client) => setActionModal({ type: "agent",   client });

  const handleActionConfirm = async () => {
    if (!actionModal) return;
    setActionLoading(true);

    if (actionModal.type === "builder") {
      const client = actionModal.client;

      // Если проект уже привязан — просто открываем его
      if (client.project_id) {
        // Сохраняем привязку к CRM-заявке чтобы смета сохранялась в неё же
        localStorage.setItem("crm_linked_session", JSON.stringify({
          chat_id: client.id,
          session_id: client.session_id,
          client_name: client.client_name || `Заявка №${client.id}`,
          phone: client.phone || "",
          address: client.address || "",
        }));
        setActionModal(null);
        setActionLoading(false);
        navigate(`/plan?project_id=${client.project_id}`);
        return;
      }

      // Создаём новый проект в построителе с данными клиента
      const token = getCrmToken();
      const res = await fetch(`${CRM_URL}?r=plan-projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: client.client_name || `Заявка №${client.id}`,
          client_name: client.client_name || "",
          address: client.address || "",
          phone: client.phone || "",
          crm_client_id: client.id,
        }),
      });
      const data = await res.json();
      if (data.id) {
        // Привязываем project_id к заявке в CRM
        await crmFetch("clients", {
          method: "PUT",
          body: JSON.stringify({ project_id: data.id }),
        }, { id: String(client.id) });
        // Сохраняем привязку к CRM-заявке чтобы смета сохранялась в неё же
        localStorage.setItem("crm_linked_session", JSON.stringify({
          chat_id: client.id,
          session_id: client.session_id,
          client_name: client.client_name || `Заявка №${client.id}`,
          phone: client.phone || "",
          address: client.address || "",
        }));
        onReload();
        setActionModal(null);
        setActionLoading(false);
        navigate(`/plan?project_id=${data.id}`);
      } else {
        setActionLoading(false);
      }

    } else {
      // Переходим в агент с привязкой к заявке через session_id
      const client = actionModal.client;
      localStorage.setItem("crm_linked_session", JSON.stringify({
        chat_id: client.id,
        session_id: client.session_id,
        client_name: client.client_name || `Заявка №${client.id}`,
        phone: client.phone || "",
        address: client.address || "",
      }));
      setActionModal(null);
      setActionLoading(false);
      navigate("/");
    }
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
                  background: viewMode === mode ? t.accent + "22" : "transparent",
                  color: viewMode === mode ? t.accent : t.textMute,
                  borderRight: mode !== "kanban" ? `1px solid ${t.border}` : undefined,
                }}>
                <Icon name={icon} size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Кнопка добавления */}
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition hover:opacity-90 flex-shrink-0"
            style={{ background: t.accent, color: "#fff" }}>
            <Icon name="Plus" size={14} />
            <span className="hidden sm:inline">Заявка</span>
          </button>

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
          onSwipeBuilder={handleSwipeBuilder}
          onSwipeAgent={handleSwipeAgent}
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
          onClose={() => { setSelected(null); onDrawerClose?.(); }}
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
          onOpenBuilder={handleSwipeBuilder}
          onOpenAgent={handleSwipeAgent}
        />
      )}

      {/* Модалка добавления новой заявки */}
      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { onReload(); setShowAddModal(false); }}
        />
      )}

      {/* Модалка подтверждения — Построитель / Агент */}
      {actionModal && (
        <CrmActionModal
          type={actionModal.type}
          clientName={actionModal.client.client_name || `Заявка №${actionModal.client.id}`}
          loading={actionLoading}
          onConfirm={handleActionConfirm}
          onCancel={() => { if (!actionLoading) setActionModal(null); }}
        />
      )}
    </div>
  );
}