import { useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import EstimateEditor from "./EstimateEditor";
import DrawerInfoTab from "./DrawerInfoTab";
import ClientTab from "./ClientTab";

interface Props {
  client: Client;
  allClientOrders: Client[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  isLocalCard?: boolean;
  defaultTab?: "client" | "orders";
  defaultOrderId?: number;
  canEdit?:          boolean;
  canOrdersEdit?:    boolean;
  canFinance?:       boolean;
  canFiles?:         boolean;
  canFieldContacts?: boolean;
  canFieldAddress?:  boolean;
  canFieldDates?:    boolean;
  canFieldFinance?:  boolean;
  canFieldNotes?:    boolean;
  canFieldFiles?:    boolean;
  canFieldCancel?:   boolean;
}

export default function ClientDrawer({ client, allClientOrders, onClose, onUpdated, onDeleted, isLocalCard, defaultTab = "client", defaultOrderId, canEdit = true, canOrdersEdit = true, canFinance = true, canFiles = true, canFieldContacts = true, canFieldAddress = true, canFieldDates = true, canFieldFinance = true, canFieldNotes = true, canFieldFiles = true, canFieldCancel = true }: Props) {
  const t = useTheme();
  const [data, setData]               = useState<Client>(client);
  const [saving, setSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerTab, setDrawerTab]     = useState<"client" | "orders">(defaultTab);
  const [comments, setComments]       = useState<{ text: string; date: string }[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [hideHidden, setHideHidden]   = useState(() => localStorage.getItem("drawer_hide_hidden") === "true");
  const [selectedOrderId, setSelectedOrderId] = useState<number>(defaultOrderId ?? client.id);
  const [orderInnerTab, setOrderInnerTab] = useState<"info" | "estimate">("info");
  const [ordersListOpen, setOrdersListOpen] = useState(false);

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

  const saveOrder = async (patch: Partial<Client>) => {
    setOrderData(prev => ({ ...prev, ...patch }));
    if (isLocalCard) return;
    setSaving(true);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify(patch) }, { id: String(orderData.id) });
    setSaving(false);
    onUpdated();
  };

  const handleDelete = async () => {
    if (!isLocalCard) {
      await crmFetch("clients", { method: "DELETE" }, { id: String(data.id) });
    }
    onDeleted();
  };

  const ord = drawerTab === "orders" ? orderData : data;
  const lsKey = `order_title_${ord.id}`;
  const customTitle = localStorage.getItem(lsKey);
  const orderTitle = customTitle || `Заявка №${ord.id}`;
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
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
            {/* Цветной аватар с номером */}
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
              style={{ background: displayColor + "35", border: `2px solid ${displayColor}50` }}>
              <span className="text-xs sm:text-sm">{ord.id}</span>
            </div>

            <div className="min-w-0 flex-1">
              {/* Название заявки */}
              {editingTitle ? (
                <input
                  autoFocus
                  defaultValue={orderTitle}
                  onBlur={e => {
                    const val = e.target.value.trim();
                    if (val && val !== `Заявка №${ord.id}`) {
                      localStorage.setItem(lsKey, val);
                    } else {
                      localStorage.removeItem(lsKey);
                    }
                    setEditingTitle(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  className="text-sm sm:text-base font-bold bg-transparent focus:outline-none block w-full"
                  style={{ color: "#fff", borderBottom: "1px solid #7c3aed", minWidth: 0 }}
                />
              ) : (
                <div
                  className="text-sm sm:text-base font-bold text-white truncate cursor-text hover:opacity-80 transition"
                  style={{ maxWidth: "min(180px, 40vw)" }}
                  title="Нажмите чтобы изменить название"
                  onClick={() => setEditingTitle(true)}>
                  {orderTitle}
                </div>
              )}

              {/* Статус + сумма */}
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-md font-semibold flex-shrink-0"
                  style={{ background: displayColor + "25", color: displayColor }}>
                  {STATUS_LABELS[ord.status] || ord.status}
                </span>
                {canFinance && ord.contract_sum ? (
                  <span className="text-xs font-bold text-emerald-400 flex-shrink-0">
                    {ord.contract_sum.toLocaleString("ru-RU")} ₽
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Правые кнопки */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {saving && <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
            {copied && <span className="hidden sm:inline text-xs text-violet-300 whitespace-nowrap">Скопировано!</span>}

            {/* Скрыть блоки — только на десктопе */}
            <button
              onClick={() => setHideHidden(v => { const next = !v; localStorage.setItem("drawer_hide_hidden", String(next)); return next; })}
              className="hidden sm:flex p-2 rounded-lg hover:bg-white/5 transition"
              style={{ color: hideHidden ? "#a78bfa" : t.textMute }}
              title={hideHidden ? "Показать скрытые блоки" : "Скрыть скрытые блоки"}>
              <Icon name={hideHidden ? "EyeOff" : "Eye"} size={15} />
            </button>

            {canEdit && (
              <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg hover:bg-red-500/10 transition" style={{ color: t.textMute }}>
                <Icon name="Trash2" size={15} />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* ── Табы ── */}
        <div className="flex px-3 sm:px-6 gap-1 pt-2 sm:pt-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          {([
            { id: "client",   label: "Клиент",  icon: "User" },
            { id: "orders",   label: `Заявки (${allClientOrders.length})`, icon: "ClipboardList" },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setDrawerTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition"
              style={drawerTab === tab.id
                ? { color: "#7c3aed", borderBottom: "2px solid #7c3aed", marginBottom: -1 }
                : { color: t.textMute }}>
              <Icon name={tab.icon} size={13} /> {tab.label}
            </button>
          ))}
        </div>

        {/* ── Контент ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* КЛИЕНТ */}
          {drawerTab === "client" && (
            <ClientTab data={data} save={save} />
          )}

          {/* ЗАЯВКИ */}
          {drawerTab === "orders" && (
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
                {/* Внутренние табы */}
                <div className="flex px-3 sm:px-4 gap-1 pt-2 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
                  {([
                    { id: "info" as const,     label: "Заявка",  icon: "ClipboardEdit" },
                    { id: "estimate" as const, label: "Смета",   icon: "FileSpreadsheet" },
                  ]).map(tab => (
                    <button key={tab.id} onClick={() => setOrderInnerTab(tab.id)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition"
                      style={orderInnerTab === tab.id
                        ? { color: "#7c3aed", borderBottom: "2px solid #7c3aed", marginBottom: -1 }
                        : { color: t.textMute }}>
                      <Icon name={tab.icon} size={12} /> {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {orderInnerTab === "info" && (
                    <DrawerInfoTab
                      key={orderData.id}
                      data={orderData}
                      client={client}
                      setData={setOrderData}
                      save={saveOrder}
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
                      canFieldNotes={canFieldNotes}
                      canFieldFiles={canFieldFiles}
                      canFieldCancel={canFieldCancel}
                    />
                  )}
                  {orderInnerTab === "estimate" && (
                    <div className="px-3 sm:px-6 py-4">
                      <EstimateEditor chatId={orderData.id} clientName={orderData.client_name} clientPhone={orderData.phone} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Подтверждение удаления */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black/60 p-4" onClick={() => setConfirmDelete(false)}>
          <div className="rounded-2xl p-6 w-full max-w-xs shadow-2xl" style={{ background: t.surface, border: "1px solid rgba(239,68,68,0.25)" }} onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-red-400" />
            </div>
            <h3 className="text-base font-bold text-center mb-2 text-white">Удалить клиента?</h3>
            <p className="text-sm text-center mb-5" style={{ color: t.textMute }}>«{data.client_name || "Клиент"}» будет удалён</p>
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