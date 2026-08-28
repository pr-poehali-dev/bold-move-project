import { STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { ThemeCtx } from "./themeContext";
import DrawerInfoTab from "./DrawerInfoTab";

interface Props {
  t: ThemeCtx;
  client: Client;
  allClientOrders: Client[];
  selectedOrderId: number;
  setSelectedOrderId: (id: number) => void;
  orderData: Client;
  setOrderData: (c: Client) => void;
  setOrderInnerTab: (tab: "info" | "estimate") => void;
  ordersListOpen: boolean;
  setOrdersListOpen: (v: boolean) => void;
  saveOrder: (patch: Partial<Client>) => Promise<boolean>;
  hideHidden: boolean;
  canEdit: boolean;
  canOrdersEdit: boolean;
  /** Этапы воронки, разрешённые сотруднику (null = ограничений нет) */
  allowedStatuses?: string[] | null;
  canFinance: boolean;
  canFiles: boolean;
  canFieldContacts: boolean;
  canFieldAddress: boolean;
  canFieldDates: boolean;
  canFieldFinance: boolean;
  canFieldFiles: boolean;
  canFieldCancel: boolean;
  onUpdated: () => void;
  /** Перейти на вкладку «Касания» и поставить курсор в поле ввода (иконка «написать» у телефона) */
  onGoToTouches?: () => void;
}

export function DrawerOrdersPanel({
  t, client, allClientOrders, selectedOrderId, setSelectedOrderId, orderData, setOrderData, setOrderInnerTab,
  ordersListOpen, setOrdersListOpen, saveOrder, hideHidden,
  canEdit, canOrdersEdit, allowedStatuses = null, canFinance, canFiles, canFieldContacts, canFieldAddress, canFieldDates,
  canFieldFinance, canFieldFiles, canFieldCancel, onUpdated, onGoToTouches,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0">

      {/* ── МОБИЛЕ: горизонтальный скролл заявок сверху ── */}
      {allClientOrders.length > 1 && (
        <div className="sm:hidden flex-shrink-0 px-3 pt-2 pb-0">
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {[...allClientOrders]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map(order => {
                const isActive = order.id === selectedOrderId;
                const color = STATUS_COLORS[order.status] || "#8b5cf6";
                return (
                  <button key={order.id}
                    onClick={() => { setSelectedOrderId(order.id); setOrderData(order); setOrderInnerTab("info"); }}
                    className="flex-shrink-0 text-left rounded-xl transition"
                    style={{
                      background: isActive ? "#7c3aed18" : t.surface2,
                      border: `1.5px solid ${isActive ? "#7c3aed70" : t.border}`,
                      padding: "8px 12px",
                      minWidth: 140,
                      maxWidth: 170,
                    }}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold truncate" style={{ color: t.text }}>
                        {localStorage.getItem(`order_title_${order.id}`) || `Заявка №${order.id}`}
                      </span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: color + "20", color }}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                    {canFinance && order.contract_sum ? (
                      <div className="text-[10px] font-bold text-emerald-400 mt-1">
                        {Number(order.contract_sum).toLocaleString("ru-RU")} ₽
                      </div>
                    ) : null}
                  </button>
                );
              })}
          </div>
          {/* Разделитель */}
          <div className="h-px mt-1" style={{ background: t.border }} />
        </div>
      )}

      {/* ── ДЕСКТОП: боковая панель заявок ── */}
      <div className={`hidden sm:flex flex-shrink-0 transition-all duration-200 border-r flex-col ${ordersListOpen ? "w-56 md:w-64" : "w-9 cursor-pointer hover:bg-white/[0.02]"}`}
        style={{ borderColor: t.border }}
        onClick={!ordersListOpen ? () => setOrdersListOpen(true) : undefined}
        title={!ordersListOpen ? "Развернуть список заявок" : undefined}>

        {!ordersListOpen && (
          <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-0.5 h-3 rounded-full opacity-20" style={{ background: t.textMute }} />
            ))}
          </div>
        )}
        {ordersListOpen && (
          <button
            className="w-full h-10 flex items-center justify-center transition hover:bg-white/5 flex-shrink-0"
            style={{ borderBottom: `1px solid ${t.border}`, color: t.textMute }}
            onClick={e => { e.stopPropagation(); setOrdersListOpen(false); }}
            title="Свернуть список">
            <Icon name="ChevronLeft" size={14} />
          </button>
        )}

        <div className={`${ordersListOpen ? "flex" : "hidden"} flex-col overflow-y-auto gap-2 p-2 sm:p-3`}>
          {allClientOrders.length === 0 && (
            <div className="py-4 text-center text-xs w-full" style={{ color: t.textMute }}>Нет заявок</div>
          )}
          {[...allClientOrders]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map(order => {
              const isActive = order.id === selectedOrderId;
              return (
                <button key={order.id}
                  onClick={() => { setSelectedOrderId(order.id); setOrderData(order); setOrderInnerTab("info"); setOrdersListOpen(false); }}
                  className="flex-shrink-0 text-left rounded-xl transition"
                  style={{
                    background: isActive ? "#7c3aed18" : t.surface2,
                    border: `1px solid ${isActive ? "#7c3aed60" : t.border}`,
                    minWidth: 130,
                    padding: "8px 10px",
                  }}>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-bold truncate" style={{ color: t.text }}>
                      {localStorage.getItem(`order_title_${order.id}`) || `Заявка №${order.id}`}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 font-semibold"
                      style={{ background: STATUS_COLORS[order.status] + "20", color: STATUS_COLORS[order.status] }}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {order.client_name && (
                      <div className="flex items-center gap-1 text-[10px]" style={{ color: t.textMute }}>
                        <Icon name="User" size={8} style={{ color: "#8b5cf6", flexShrink: 0 }} />
                        <span className="truncate">{order.client_name}</span>
                      </div>
                    )}
                    {order.phone && (
                      <div className="flex items-center gap-1 text-[10px]" style={{ color: t.textMute }}>
                        <Icon name="Phone" size={8} style={{ color: "#10b981", flexShrink: 0 }} />
                        <span className="truncate">{order.phone}</span>
                      </div>
                    )}
                    {order.address && (
                      <div className="flex items-center gap-1 text-[10px]" style={{ color: t.textMute }}>
                        <Icon name="MapPin" size={8} style={{ color: "#f59e0b", flexShrink: 0 }} />
                        <span className="truncate">{order.address}</span>
                      </div>
                    )}
                    {order.contract_sum ? (
                      <div className="flex items-center gap-1 text-[10px]">
                        <Icon name="Banknote" size={8} style={{ color: "#10b981", flexShrink: 0 }} />
                        <span className="font-bold text-emerald-400">{Number(order.contract_sum).toLocaleString("ru-RU")} ₽</span>
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Контент выбранной заявки */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <DrawerInfoTab
            key={orderData.id}
            data={orderData}
            client={client}
            setData={setOrderData}
            save={saveOrder}
            hideHidden={hideHidden}
            canEdit={canEdit}
            canOrdersEdit={canOrdersEdit}
            allowedStatuses={allowedStatuses}
            canFinance={canFinance}
            canFiles={canFiles}
            canFieldContacts={canFieldContacts}
            canFieldAddress={canFieldAddress}
            canFieldDates={canFieldDates}
            canFieldFinance={canFieldFinance}
            canFieldFiles={canFieldFiles}
            canFieldCancel={canFieldCancel}
            onReload={onUpdated}
            onGoToTouches={onGoToTouches}
          />
        </div>
      </div>
    </div>
  );
}