import { useState } from "react";
import { crmFetch, STATUS_COLORS, Client, ClientStatus } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import EstimateEditor from "./EstimateEditor";
import ClientTab from "./ClientTab";
import DrawerPlanTab from "./DrawerPlanTab";
import DrawerTouchesTab from "./DrawerTouchesTab";
import DrawerAnalyticsTab from "./DrawerAnalyticsTab";
import PdfOptionsModal from "./PdfOptionsModal";
import { useEstimateData } from "./useEstimateData";
import { DrawerHeader } from "./DrawerHeader";
import { DrawerTabsBar, DrawerTabId } from "./DrawerTabsBar";
import { DrawerOrdersPanel } from "./DrawerOrdersPanel";
import { useUnreadTouches } from "./useUnreadTouches";

interface Props {
  client: Client;
  allClientOrders: Client[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: (deletedId: number) => void;
  isLocalCard?: boolean;
  defaultTab?: "client" | "orders" | "touches";
  /** Открыто из списка «Клиенты» — контакт, а не конкретная заявка: шапка показывает имя, а не «Заявка №X» */
  contactMode?: boolean;
  defaultOrderId?: number;
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
  statuses?:         ClientStatus[];
  onOpenBuilder?: (client: Client) => void;
  onOpenAgent?:   (client: Client) => void;
}

export default function ClientDrawer({ client, allClientOrders, onClose, onUpdated, onDeleted, isLocalCard, defaultTab = "client", contactMode = false, defaultOrderId, canEdit = true, canOrdersEdit = true, canFinance = true, canFiles = true, canFieldContacts = true, canFieldAddress = true, canFieldDates = true, canFieldFinance = true, canFieldFiles = true, canFieldCancel = true, statuses = [], onOpenBuilder, onOpenAgent }: Props) {
  const t = useTheme();
  const [data, setData]               = useState<Client>(client);
  const [saving, setSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerTab, setDrawerTab]     = useState<DrawerTabId>(defaultTab as "client" | "orders" | "plan" | "touches");
  const [comments, setComments]       = useState<{ text: string; date: string }[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [hideHidden, setHideHidden]   = useState(() => localStorage.getItem("drawer_hide_hidden") === "true");
  const [selectedOrderId, setSelectedOrderId] = useState<number>(defaultOrderId ?? client.id);
  const [orderInnerTab, setOrderInnerTab] = useState<"info" | "estimate">("info");
  const [ordersListOpen, setOrdersListOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const unreadTouches = useUnreadTouches(data.id, data.phone || undefined, drawerTab === "touches");

  const save = async (patch: Partial<Client>) => {
    setData(prev => ({ ...prev, ...patch }));
    if (isLocalCard) return;
    setSaving(true);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify(patch) }, { id: String(data.id) });
    setSaving(false);
    onUpdated();
  };

  const [orderData, setOrderData] = useState<Client>(
    allClientOrders.find(o => o.id === selectedOrderId) ?? allClientOrders[0] ?? data
  );

  const estimateData = useEstimateData(orderData.id, orderData.client_name, orderData.phone);

  const saveOrder = async (patch: Partial<Client>) => {
    setOrderData(prev => ({ ...prev, ...patch }));
    if (isLocalCard) return;
    setSaving(true);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify(patch) }, { id: String(orderData.id) });
    setSaving(false);
    onUpdated();
  };

  const ord = drawerTab === "orders" ? orderData : data;

  const handleDelete = async () => {
    const targetId = ord.id;
    if (!isLocalCard) {
      await crmFetch("clients", { method: "DELETE" }, { id: String(targetId) });
    }
    onDeleted(targetId);
  };

  const lsKey = `order_title_${ord.id}`;
  const customTitle = localStorage.getItem(lsKey);
  // В режиме «Клиенты» заголовок — имя человека, а не номер конкретной заявки
  const orderTitle = contactMode
    ? (data.client_name || "Клиент без имени")
    : (customTitle || `Заявка №${ord.id}`);
  const displayColor = STATUS_COLORS[ord.status] || "#8b5cf6";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(5px)" }}>

      <div className="w-full flex flex-col overflow-hidden shadow-2xl"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: "clamp(0px, 4vw, 20px)",
          maxWidth: 1160,
          height: "100dvh",
          maxHeight: "100dvh",
        }}
        onClick={e => e.stopPropagation()}>

        {/* ── Шапка ── */}
        <DrawerHeader
          t={t}
          ord={ord}
          data={data}
          save={save}
          contactMode={contactMode}
          editingTitle={editingTitle}
          setEditingTitle={setEditingTitle}
          orderTitle={orderTitle}
          lsKey={lsKey}
          displayColor={displayColor}
          statuses={statuses}
          canEdit={canEdit}
          canFinance={canFinance}
          saving={saving}
          copied={copied}
          hideHidden={hideHidden}
          setHideHidden={setHideHidden}
          setConfirmDelete={setConfirmDelete}
          onClose={onClose}
          onOpenAgent={onOpenAgent}
          onOpenBuilder={onOpenBuilder}
        />

        {/* ── Табы: капсулы с фоном ── */}
        <DrawerTabsBar
          t={t}
          drawerTab={drawerTab}
          setDrawerTab={setDrawerTab}
          ordersCount={allClientOrders.length}
          unreadTouches={unreadTouches}
          setPdfModalOpen={setPdfModalOpen}
        />

        {/* ── Контент ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* КЛИЕНТ */}
          {drawerTab === "client" && (
            <ClientTab data={data} save={save} />
          )}

          {/* КАСАНИЯ */}
          {drawerTab === "touches" && (
            <DrawerTouchesTab phone={data.phone} name={data.client_name} contactId={data.id} />
          )}

          {/* АНАЛИТИКА */}
          {drawerTab === "analytics" && (
            <DrawerAnalyticsTab phone={data.phone} name={data.client_name} />
          )}

          {/* ЧЕРТЕЖИ */}
          {drawerTab === "plan" && (
            <DrawerPlanTab chatId={data.id} projectId={data.project_id} />
          )}

          {/* СМЕТА */}
          {drawerTab === "estimate" && (
            <div className="px-3 sm:px-6 py-4">
              <EstimateEditor
                chatId={orderData.id}
                clientName={orderData.client_name}
                clientPhone={orderData.phone}
                initialData={estimateData}
                onEstimateSaved={() => {
                  estimateData.reload();
                  onUpdated();
                }}
                onContractSumChanged={(sum) => {
                  setOrderData(prev => ({ ...prev, contract_sum: sum }));
                  onUpdated();
                }}
              />
            </div>
          )}


          {/* ЗАЯВКИ */}
          {drawerTab === "orders" && (
            <DrawerOrdersPanel
              t={t}
              client={client}
              allClientOrders={allClientOrders}
              selectedOrderId={selectedOrderId}
              setSelectedOrderId={setSelectedOrderId}
              orderData={orderData}
              setOrderData={setOrderData}
              setOrderInnerTab={setOrderInnerTab}
              ordersListOpen={ordersListOpen}
              setOrdersListOpen={setOrdersListOpen}
              saveOrder={saveOrder}
              setComments={setComments}
              hideHidden={hideHidden}
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
              onUpdated={onUpdated}
            />
          )}
        </div>
      </div>

      {/* PDF-модалка — доступна с любой вкладки */}
      {pdfModalOpen && (
        <PdfOptionsModal
          onConfirm={opts => { estimateData.doPrint(opts); setPdfModalOpen(false); }}
          onClose={() => setPdfModalOpen(false)}
        />
      )}

      {/* Подтверждение удаления */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black/60 p-4" onClick={() => setConfirmDelete(false)}>
          <div className="rounded-2xl p-6 w-full max-w-xs shadow-2xl" style={{ background: t.surface, border: "1px solid rgba(239,68,68,0.25)" }} onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-red-400" />
            </div>
            <h3 className="text-base font-bold text-center mb-2 text-white">Удалить заявку?</h3>
            <p className="text-sm text-center mb-5" style={{ color: t.textMute }}>Заявка №{ord.id} «{ord.client_name || "Клиент"}» будет удалена</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl font-semibold transition">Удалить</button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 text-sm rounded-xl transition"
                style={{ background: t.surface2, color: t.textSub }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}