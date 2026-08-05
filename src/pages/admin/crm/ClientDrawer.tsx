import { useState } from "react";
import { Client, ClientStatus } from "./crmApi";
import { useTheme } from "./themeContext";
import EstimateEditor from "./EstimateEditor";
import ClientTab from "./ClientTab";
import DrawerPlanTab from "./DrawerPlanTab";
import DrawerTouchesTab from "./DrawerTouchesTab";
import DrawerAnalyticsTab from "./DrawerAnalyticsTab";
import PdfOptionsModal from "./PdfOptionsModal";
import { useEstimateData } from "./useEstimateData";
import { DrawerHeader } from "./DrawerHeader";
import { DrawerTabsBar } from "./DrawerTabsBar";
import { DrawerOrdersPanel } from "./DrawerOrdersPanel";
import { DrawerDeleteConfirm } from "./DrawerDeleteConfirm";
import { useUnreadTouches } from "./useUnreadTouches";
import { useClientDrawerState } from "./useClientDrawerState";
import { useAutoSummary } from "./useAutoSummary";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [copied] = useState(false);
  const [hideHidden, setHideHidden]   = useState(() => localStorage.getItem("drawer_hide_hidden") === "true");
  const [ordersListOpen, setOrdersListOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const {
    data, saving, drawerTab, setDrawerTab,
    selectedOrderId, setSelectedOrderId, orderData, setOrderData,
    save, saveOrder, ord, handleDelete, lsKey, orderTitle, displayColor,
  } = useClientDrawerState(client, allClientOrders, isLocalCard, defaultTab, defaultOrderId, contactMode, onUpdated, onDeleted);

  const unreadTouches = useUnreadTouches(data.id, data.phone || undefined, drawerTab === "touches");

  // Комментарий заявки = краткая ИИ-сводка по общению. Обновляем при открытии
  // карточки (не чаще раза в час), результат подтягиваем в поля формы.
  useAutoSummary(data.id, data.phone || undefined, !isLocalCard, onUpdated);
  const estimateData = useEstimateData(orderData.id, orderData.client_name, orderData.phone);

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
              setOrderInnerTab={() => {}}
              ordersListOpen={ordersListOpen}
              setOrdersListOpen={setOrdersListOpen}
              saveOrder={saveOrder}
              setComments={() => {}}
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
        <DrawerDeleteConfirm
          t={t}
          orderId={ord.id}
          clientName={ord.client_name || ""}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}