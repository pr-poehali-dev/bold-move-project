import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";

interface Client {
  id: number;
  client_name: string;
  phone: string;
  status: string;
  measure_date: string | null;
  address: string;
  area: number | null;
  budget: number | null;
  created_at: string;
  notes: string;
}

const ORDER_STATUSES = ["measure", "measured", "contract", "install", "done", "cancelled"];

export default function CrmOrders() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);

  const load = () => {
    setLoading(true);
    const extra: Record<string, string> = {};
    if (search) extra.search = search;
    if (statusFilter) extra.status = statusFilter;
    crmFetch("clients", undefined, extra).then(d => {
      const filtered = (Array.isArray(d) ? d : []).filter((c: Client) => ORDER_STATUSES.includes(c.status));
      setClients(filtered);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [search, statusFilter]); // eslint-disable-line

  const saveEdit = async () => {
    if (!editing) return;
    await crmFetch("clients", { method: "PUT", body: JSON.stringify(editing) }, { id: String(editing.id) });
    setEditing(null);
    load();
  };

  const totalBudget = clients.reduce((s, c) => s + (c.budget || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Все заказы</h2>
          <p className="text-xs text-white/30 mt-0.5">
            Показано: <span className="text-violet-400 font-semibold">{clients.length}</span> заказов
            {totalBudget > 0 && <> · Итого: <span className="text-emerald-400 font-semibold">{totalBudget.toLocaleString("ru-RU")} ₽</span></>}
          </p>
        </div>
      </div>

      {/* Поиск + фильтры */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Icon name="Search" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по ID заказа, товару, клиенту..."
            className="w-full bg-[#0e0e1c] border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/60 transition" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{ id: "", label: "Все" }, ...ORDER_STATUSES.map(s => ({ id: s, label: STATUS_LABELS[s] }))].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-medium transition border ${statusFilter === f.id && !f.id ? "bg-violet-600/20 border-violet-500/50 text-violet-300" : statusFilter === f.id && f.id ? "border-current" : "bg-transparent border-white/8 text-white/40 hover:text-white/70 hover:border-white/20"}`}
              style={statusFilter === f.id && f.id ? { background: STATUS_COLORS[f.id] + "20", borderColor: STATUS_COLORS[f.id] + "50", color: STATUS_COLORS[f.id] } : {}}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-[#0e0e1c] border border-white/8 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[100px_1fr_160px_120px_120px_120px_48px] gap-4 px-5 py-3 border-b border-white/6">
          {["ID", "Клиент", "Адрес", "Площадь", "Бюджет", "Статус", ""].map(h => (
            <div key={h} className="text-xs text-white/30 font-medium">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 text-white/25 text-sm">Заказы не найдены</div>
        ) : clients.map(c => (
          <div key={c.id} className="grid grid-cols-[100px_1fr_160px_120px_120px_120px_48px] gap-4 px-5 py-3.5 border-b border-white/5 hover:bg-white/[0.02] transition items-center">
            <div className="text-xs text-white/30 font-mono">ORD-{String(c.id).padStart(4, "0")}</div>
            <div>
              <div className="text-sm font-semibold text-white">{c.client_name || "—"}</div>
              <div className="text-xs text-white/30">{c.phone || ""}</div>
            </div>
            <div className="text-xs text-white/45 truncate">{c.address || "—"}</div>
            <div className="text-sm text-white/60">{c.area ? `${c.area} м²` : "—"}</div>
            <div className="text-sm font-bold text-emerald-400">{c.budget ? `${c.budget.toLocaleString("ru-RU")} ₽` : "—"}</div>
            <div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: (STATUS_COLORS[c.status] || "#666") + "20", color: STATUS_COLORS[c.status] || "#aaa" }}>
                {STATUS_LABELS[c.status] || c.status}
              </span>
            </div>
            <div>
              <button onClick={() => setEditing(c)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 text-white/30 hover:text-white transition">
                <Icon name="Pencil" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Модалка редактирования */}
      {editing && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#12121f] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Редактировать заказ <span className="text-white/30 font-normal">ORD-{String(editing.id).padStart(4,"0")}</span></h3>
              <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white transition"><Icon name="X" size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/35 mb-1.5 block">Площадь (м²)</label>
                  <input type="number" value={editing.area || ""} onChange={e => setEditing({ ...editing, area: +e.target.value })}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition" />
                </div>
                <div>
                  <label className="text-xs text-white/35 mb-1.5 block">Бюджет (₽)</label>
                  <input type="number" value={editing.budget || ""} onChange={e => setEditing({ ...editing, budget: +e.target.value })}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/35 mb-1.5 block">Статус</label>
                <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition">
                  {ORDER_STATUSES.map(s => <option key={s} value={s} className="bg-[#1a1a2e]">{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/35 mb-1.5 block">Дата замера</label>
                <input type="datetime-local" value={editing.measure_date ? editing.measure_date.slice(0, 16) : ""}
                  onChange={e => setEditing({ ...editing, measure_date: e.target.value })}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition" />
              </div>
              <div>
                <label className="text-xs text-white/35 mb-1.5 block">Заметки</label>
                <textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={2}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveEdit} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-xl font-medium transition">Сохранить</button>
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-xl transition">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
