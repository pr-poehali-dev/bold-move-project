import { useState, useRef } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, ORDER_STATUSES, Client, DEFAULT_TAGS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import EstimateEditor from "./EstimateEditor";
import DrawerInfoTab from "./DrawerInfoTab";

interface Props {
  client: Client;
  allClientOrders: Client[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  isLocalCard?: boolean;
  defaultTab?: "client" | "info" | "orders" | "estimate";
}

export default function ClientDrawer({ client, allClientOrders, onClose, onUpdated, onDeleted, isLocalCard, defaultTab = "client" }: Props) {
  const t = useTheme();
  const [data, setData]               = useState<Client>(client);
  const [saving, setSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerTab, setDrawerTab]     = useState<"client" | "info" | "orders" | "estimate">(defaultTab);
  const [comments, setComments]       = useState<{ text: string; date: string }[]>([]);
  const [editingName, setEditingName] = useState(false);
  const nameValRef                    = useRef("");
  const [copied, setCopied]           = useState(false);
  const [hideHidden, setHideHidden]   = useState(() => localStorage.getItem("drawer_hide_hidden") === "true");



  const save = async (patch: Partial<Client>) => {
    setData(prev => ({ ...prev, ...patch }));
    if (isLocalCard) return;
    setSaving(true);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify(patch) }, { id: String(data.id) });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(5px)" }}>

      <div className="w-full flex flex-col overflow-hidden shadow-2xl"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 20,
          maxWidth: drawerTab === "estimate" ? 1100 : 1160,
          maxHeight: "92vh",
        }}
        onClick={e => e.stopPropagation()}>

        {/* ── Шапка ── */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
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
        <div className="flex px-6 gap-1 pt-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          {([
            { id: "client",   label: "Клиент",  icon: "User" },
            { id: "info",     label: "Заявка",  icon: "ClipboardEdit" },
            { id: "estimate", label: "Смета",   icon: "FileSpreadsheet" },
            { id: "orders",   label: `История (${allClientOrders.length})`, icon: "ClipboardList" },
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
            <div className="px-6 py-5 space-y-4 max-w-lg">
              {/* Имя */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: t.textMute }}>Имя клиента</label>
                <input
                  defaultValue={data.client_name || ""}
                  onBlur={e => { if (e.target.value !== data.client_name) save({ client_name: e.target.value }); }}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
                  placeholder="Введите имя"
                />
              </div>
              {/* Телефон */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: t.textMute }}>Телефон</label>
                <input
                  defaultValue={data.phone || ""}
                  onBlur={e => { if (e.target.value !== data.phone) save({ phone: e.target.value }); }}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
                  placeholder="+7 (___) ___-__-__"
                />
              </div>
              {/* Ответственный */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: t.textMute }}>Ответственный (прораб / дизайнер)</label>
                <input
                  defaultValue={data.responsible_phone || ""}
                  onBlur={e => { if (e.target.value !== (data.responsible_phone || "")) save({ responsible_phone: e.target.value }); }}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
                  placeholder="Имя или телефон"
                />
              </div>
              {/* Заметка */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: t.textMute }}>Заметка о клиенте</label>
                <textarea
                  defaultValue={data.notes || ""}
                  onBlur={e => { if (e.target.value !== (data.notes || "")) save({ notes: e.target.value }); }}
                  rows={3}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition resize-none"
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
                  placeholder="Комментарий..."
                />
              </div>
              {/* Теги */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: t.textMute }}>Метки</label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_TAGS.map(tag => {
                    const active = (data.tags || []).includes(tag.label);
                    return (
                      <button key={tag.label}
                        onClick={() => {
                          const cur = data.tags || [];
                          const next = active ? cur.filter(t => t !== tag.label) : [...cur, tag.label];
                          save({ tags: next });
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                        style={{
                          background: active ? tag.color + "30" : t.surface2,
                          color: active ? tag.color : t.textMute,
                          border: `1px solid ${active ? tag.color + "60" : t.border}`,
                        }}>
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* СМЕТА */}
          {drawerTab === "estimate" && (
            <div className="px-6 py-4">
              <EstimateEditor chatId={data.id} clientName={data.client_name} clientPhone={data.phone} />
            </div>
          )}

          {/* ИСТОРИЯ */}
          {drawerTab === "orders" && (
            <div className="px-6 py-4 space-y-2">
              {allClientOrders.length === 0 && (
                <div className="py-12 text-center text-sm" style={{ color: t.textMute }}>Нет заявок</div>
              )}
              {[...allClientOrders]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(order => (
                  <button key={order.id} onClick={() => { setData(order); setDrawerTab("info"); }}
                    className="w-full text-left rounded-xl p-3.5 transition"
                    style={{
                      background: data.id === order.id ? "#7c3aed18" : t.surface2,
                      border: `1px solid ${data.id === order.id ? "#7c3aed50" : t.border}`,
                    }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                        style={{ background: STATUS_COLORS[order.status] + "20", color: STATUS_COLORS[order.status] }}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                      <span className="text-[11px]" style={{ color: t.textMute }}>
                        {new Date(order.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate" style={{ color: t.textSub }}>{order.address || "Адрес не указан"}</span>
                      {order.contract_sum ? (
                        <span className="text-sm font-bold text-emerald-400 whitespace-nowrap">
                          {Number(order.contract_sum).toLocaleString("ru-RU")} ₽
                        </span>
                      ) : null}
                    </div>
                    {data.id === order.id && (
                      <div className="text-[10px] mt-1 font-semibold" style={{ color: "#7c3aed" }}>● Открыта сейчас</div>
                    )}
                  </button>
                ))}
            </div>
          )}

          {/* ЗАЯВКА */}
          {drawerTab === "info" && (
            <DrawerInfoTab
              data={data}
              client={client}
              setData={setData}
              save={save}
              setComments={setComments}
              hideHidden={hideHidden}
            />
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