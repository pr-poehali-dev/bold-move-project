import { useState } from "react";
import { crmFetch, Client, getClientOrders } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";
import CrmActionModal from "./CrmActionModal";
import { AddClientModal } from "./AddClientModal";
import { useTheme } from "./themeContext";
import { OrdersEventsPanel } from "./OrdersEventsPanel";
import { OrdersKanbanView } from "./OrdersKanbanView";
import { OrdersListView } from "./OrdersListView";
import type { Substatus } from "./OrdersTabs";
import { useOrderSources } from "@/hooks/useOrderSources";
import { OrderSourcesContext } from "./orderSourcesContext";
import { TrashModal } from "./TrashModal";
import { useOrdersTabsConfig } from "./useOrdersTabsConfig";
import { useOrderActionModal } from "./useOrderActionModal";
import { useOrdersUrlParams } from "./useOrdersUrlParams";
import { useStageDateGuard } from "./useStageDateGuard";
import { StageDateConfirm } from "./StageDateConfirm";

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
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState("leads");
  const [selected, setSelected]   = useState<Client | null>(null);
  const [viewMode, setViewMode]   = useState<"grid" | "list" | "kanban">("grid");
  const [trashOpen, setTrashOpen] = useState(false);
  const { sources } = useOrderSources();

  const clients = allClients;

  const { showAddModal, setShowAddModal, newOrderLinkProjectId, setNewOrderLinkProjectId } =
    useOrdersUrlParams(allClients, initialOrderId, setSelected);

  const tabsConfig = useOrdersTabsConfig();

  // Смена статуса с защитой «замер/монтаж нельзя назначить без даты»:
  // если даты нет — сначала открывается модалка выбора даты (см. useStageDateGuard).
  const stageGuard = useStageDateGuard(onStatusChange);
  const handleNextStep = async (id: number, nextStatus: string) => {
    const client = allClients.find(c => c.id === id);
    if (!client) return;
    await stageGuard.requestStatusChange(client, nextStatus);
  };

  // Смена подстатуса прямо с карточки/бейджа (без открытия заявки) — тот же
  // PUT, что и в StatusSelector, но статус остаётся прежним, меняется только этап внутри.
  const handleSaveSubStatus = async (id: number, subStatusId: number) => {
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ sub_status: String(subStatusId) }) }, { id: String(id) });
    onReload();
  };

  const { actionModal, actionLoading, handleSwipeBuilder, handleSwipeAgent, handleActionConfirm, closeActionModal } =
    useOrderActionModal(onReload);

  return (
    <OrderSourcesContext.Provider value={sources}>
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

          {/* Корзина удалённых заявок */}
          <button onClick={() => setTrashOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-semibold transition hover:opacity-90 flex-shrink-0"
            style={{ background: t.surface, color: t.textMute, border: `1px solid ${t.border}` }}
            title="Корзина">
            <Icon name="Trash2" size={13} />
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
          allClients={clients}
          search={search}
          onSearch={setSearch}
          onSelect={setSelected}
          onNextStep={handleNextStep}
          onSaveSubStatus={handleSaveSubStatus}
          onRequestStatus={stageGuard.requestStatusChange}
        />
      ) : (
        <OrdersListView
          allClients={clients}
          loading={loading}
          viewMode={viewMode}
          search={search}
          activeTab={activeTab}
          onSelect={setSelected}
          onNextStep={handleNextStep}
          onSaveSubStatus={handleSaveSubStatus}
          onSetActiveTab={setActiveTab}
          onSwipeBuilder={handleSwipeBuilder}
          onSwipeAgent={handleSwipeAgent}
          tabLabels={tabsConfig.tabLabels}
          tabColors={tabsConfig.tabColors}
          hiddenTabs={tabsConfig.hiddenTabs}
          customTabs={tabsConfig.customTabs}
          onSaveLabel={tabsConfig.handleSaveLabel}
          onSaveColor={tabsConfig.handleSaveColor}
          onDeleteTab={tabsConfig.handleDeleteTab}
          onAddTab={tabsConfig.handleAddTab}
          substatuses={substatuses}
          onSubstatusesChange={onSubstatusesChange}
          statusLabels={tabsConfig.statusLabels}
          statusColors={tabsConfig.statusColors}
          onSaveStatusLabel={tabsConfig.handleSaveStatusLabel}
          onSaveStatusColor={tabsConfig.handleSaveStatusColor}
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
          onDeleted={(deletedId) => { setSelected(null); onClientRemoved(deletedId); }}
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
          onClose={() => { setShowAddModal(false); setNewOrderLinkProjectId(null); }}
          onCreated={() => { onReload(); setShowAddModal(false); setNewOrderLinkProjectId(null); }}
          linkProjectId={newOrderLinkProjectId}
        />
      )}

      {/* Дата этапа — замер/монтаж нельзя назначить без даты */}
      {stageGuard.pending && (
        <StageDateConfirm
          t={t}
          nextStatus={stageGuard.pending.nextStatus}
          currentDate={
            stageGuard.pending.nextStatus === "measure"
              ? stageGuard.pending.client.measure_date
              : stageGuard.pending.client.install_date
          }
          currentComment={
            stageGuard.pending.nextStatus === "measure"
              ? stageGuard.pending.client.comment_measure
              : stageGuard.pending.client.comment_install
          }
          onConfirm={stageGuard.confirmWithDate}
          onCancel={stageGuard.cancelStageDate}
        />
      )}

      {/* Модалка подтверждения — Построитель / Агент */}
      {actionModal && (
        <CrmActionModal
          type={actionModal.type}
          clientName={actionModal.client.client_name || `Заявка №${actionModal.client.id}`}
          loading={actionLoading}
          onConfirm={handleActionConfirm}
          onCancel={closeActionModal}
        />
      )}

      {/* Корзина удалённых заявок */}
      {trashOpen && (
        <TrashModal
          onClose={() => setTrashOpen(false)}
          onRestored={onReload}
        />
      )}
    </div>
    </OrderSourcesContext.Provider>
  );
}