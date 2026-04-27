import { useState, useRef } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, ORDER_STATUSES, Client } from "./crmApi";
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
}

export default function ClientDrawer({ client, allClientOrders, onClose, onUpdated, onDeleted, isLocalCard, defaultTab = "client", defaultOrderId }: Props) {
  const t = useTheme();
  const [data, setData]               = useState<Client>(client);
  const [saving, setSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerTab, setDrawerTab]     = useState<"client" | "orders">(defaultTab);
  const [comments, setComments]       = useState<{ text: string; date: string }[]>([]);
  const [editingName, setEditingName] = useState(false);
  const nameValRef                    = useRef("");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4" onClick={onClose}
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
        onClick={e => e.stopPropagation()}
        >

        {/* ── Шапка ── */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{ background: STATUS_COLORS[data.status] + "35", border: `2px solid ${STATUS_COLORS[data.status]}50` }}>
              {(data.client_name || "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              {editingName ? (
                <input
                  autoFocus
                  defaultValue={data.client_name || ""}
                  onChange={e => { nameValRef.current = e.target.value; }}
                  onBlur={() => { setEditingName(false); save({ client_name: nameValRef.current }); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); setEditingName(false); save({ client_name: nameValRef.current }); }
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="text-base font-bold text-white bg-transparent focus:outline-none focus:border-b focus:border-violet-500"
                  style={{ borderBottom: "1px solid #7c3aed" }}
                />
              ) : (
                <div
                  className="text-base font-bold text-white cursor-text hover:opacity-80 transition"
                  onClick={() => { nameValRef.current = data.client_name || ""; setEditingName(true); }}
                >
                  {data.client_name || "Без имени"}
                </div>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold"
                  style={{ background: STATUS_COLORS[data.status] + "25", color: STATUS_COLORS[data.status] }}>
                  {STATUS_LABELS[data.status] || data.status}
                </span>
                {data.phone && <span className="text-xs" style={{ color: t.textMute }}>{data.phone}</span>}
                {data.contract_sum ? (
                  <span className="text-xs font-bold text-emerald-400">{data.contract_sum.toLocaleString("ru-RU")} ₽</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
            {copied && <span className="text-xs text-violet-300 whitespace-nowrap">Скопировано!</span>}
            <button
              onClick={() => setHideHidden(v => { const next = !v; localStorage.setItem("drawer_hide_hidden", String(next)); return next; })}
              className="p-2 rounded-lg hover:bg-white/5 transition"
              style={{ color: hideHidden ? "#a78bfa" : t.textMute }}
              title={hideHidden ? "Показать скрытые блоки" : "Скрыть скрытые блоки"}
            >
              <Icon name={hideHidden ? "EyeOff" : "Eye"} size={15} />
            </button>
            <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg hover:bg-red-500/10 transition" style={{ color: t.textMute }}>
              <Icon name="Trash2" size={15} />
            </button>
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
        <div className="flex-1 overflow-y-auto">

          {/* КЛИЕНТ */}
          {drawerTab === "client" && (
            <ClientTab data={data} save={save} />
          )}

          {/* ЗАЯВКИ */}
          {drawerTab === "orders" && (
            <div className="flex flex-row h-full min-h-0">

              {/* Список заявок — боковая панель (только desktop-стиль) */}
              <div className={`flex-shrink-0 transition-all duration-200 border-r ${ordersListOpen ? "w-56 md:w-64" : "w-9"}`} style={{ borderColor: t.border }}>

                {/* Кнопка-переключатель */}
                <button
                  className="w-full h-10 flex items-center justify-center transition hover:bg-white/5"
                  style={{ borderBottom: `1px solid ${t.border}`, color: t.textMute }}
                  onClick={() => setOrdersListOpen(v => !v)}
                  title={ordersListOpen ? "Свернуть список" : "Развернуть список заявок"}>
                  <Icon name={ordersListOpen ? "ChevronLeft" : "ChevronRight"} size={14} />
                </button>

                {/* Список — виден только когда открыт */}
                <div className={`${ordersListOpen ? "flex" : "hidden"} flex-col overflow-y-auto gap-2 p-2 sm:p-3`}
                  style={{ borderColor: t.border }}>
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
                          className="flex-shrink-0 sm:flex-shrink-[unset] text-left rounded-xl transition"
                          style={{
                            background: isActive ? "#7c3aed18" : t.surface2,
                            border: `1px solid ${isActive ? "#7c3aed60" : t.border}`,
                            minWidth: 130,
                            padding: "8px 10px",
                          }}>
                          <div className="flex items-center justify-between mb-1 gap-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold truncate"
                              style={{ background: STATUS_COLORS[order.status] + "20", color: STATUS_COLORS[order.status] }}>
                              {STATUS_LABELS[order.status] || order.status}
                            </span>
                            <span className="text-[10px] flex-shrink-0" style={{ color: t.textMute }}>#{order.id}</span>
                          </div>
                          <div className="text-xs truncate" style={{ color: t.textSub }}>{order.address || "Без адреса"}</div>
                          {order.contract_sum ? (
                            <div className="text-xs font-bold text-emerald-400">{Number(order.contract_sum).toLocaleString("ru-RU")} ₽</div>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Контент выбранной заявки */}
              <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
                {/* Оверлей-триггер для открытия списка */}
                {!ordersListOpen && (
                  <div className="absolute inset-0 z-10 cursor-pointer"
                    title="Развернуть список заявок"
                    onClick={() => setOrdersListOpen(true)} />
                )}
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
        <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black/60" onClick={() => setConfirmDelete(false)}>
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ background: t.surface, border: "1px solid rgba(239,68,68,0.25)" }} onClick={e => e.stopPropagation()}>
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