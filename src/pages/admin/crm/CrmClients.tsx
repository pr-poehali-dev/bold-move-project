import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";

interface Client {
  id: number;
  session_id: string;
  client_name: string;
  phone: string;
  status: string;
  measure_date: string | null;
  notes: string;
  address: string;
  area: number | null;
  budget: number | null;
  source: string;
  created_at: string;
}

const ALL_STATUSES = Object.keys(STATUS_LABELS).filter(s => s !== "deleted");

function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#8b5cf6","#3b82f6","#f59e0b","#10b981","#f97316","#ec4899","#06b6d4"];
  const color = colors[(name || "").charCodeAt(0) % colors.length];
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: color + "33", border: `1.5px solid ${color}50` }}>
      {initials}
    </div>
  );
}

export default function CrmClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({ client_name: "", phone: "", status: "new", address: "", notes: "", measure_date: "" });

  const load = () => {
    setLoading(true);
    const extra: Record<string, string> = {};
    if (search) extra.search = search;
    if (statusFilter) extra.status = statusFilter;
    crmFetch("clients", undefined, extra).then(d => {
      const list = (Array.isArray(d) ? d : []).filter((c: Client) => c.status !== "deleted");
      setClients(list);
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

  const deleteClient = async (c: Client) => {
    await crmFetch("clients", { method: "DELETE" }, { id: String(c.id) });
    setConfirmDelete(null);
    setEditing(null);
    load();
  };

  const addClient = async () => {
    await crmFetch("clients", { method: "POST", body: JSON.stringify(newClient) });
    setShowAdd(false);
    setNewClient({ client_name: "", phone: "", status: "new", address: "", notes: "", measure_date: "" });
    load();
  };

  return (
    <div className="space-y-4">
      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Все клиенты</h2>
          <p className="text-xs text-white/30 mt-0.5">Показано: {clients.length}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-xl font-medium transition">
          <Icon name="UserPlus" size={15} /> Добавить клиента
        </button>
      </div>

      {/* Поиск + фильтры */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Icon name="Search" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени, компании, email..."
            className="w-full bg-[#0e0e1c] border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/60 transition" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{ id: "", label: "Все" }, ...ALL_STATUSES.map(s => ({ id: s, label: STATUS_LABELS[s] }))].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-medium transition border ${statusFilter === f.id
                ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                : "bg-transparent border-white/8 text-white/40 hover:text-white/70 hover:border-white/20"
              }`}
              style={statusFilter === f.id && f.id ? { background: STATUS_COLORS[f.id] + "22", borderColor: STATUS_COLORS[f.id] + "50", color: STATUS_COLORS[f.id] } : {}}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-[#0e0e1c] border border-white/8 rounded-2xl overflow-hidden">
        {/* Шапка таблицы */}
        <div className="grid grid-cols-[1fr_140px_200px_120px_100px_48px] gap-4 px-5 py-3 border-b border-white/6">
          {["Имя", "Телефон", "Компания / Адрес", "Статус", "Заказов", ""].map(h => (
            <div key={h} className="text-xs text-white/30 font-medium">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 text-white/25 text-sm">Клиенты не найдены</div>
        ) : clients.map(c => (
          <div key={c.id}>
            <div
              className="grid grid-cols-[1fr_140px_200px_120px_100px_48px] gap-4 px-5 py-3.5 border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition items-center"
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
              {/* Имя */}
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={c.client_name} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{c.client_name || "—"}</div>
                  <div className="text-xs text-white/30">#{c.id}</div>
                </div>
              </div>
              {/* Телефон */}
              <div className="text-sm text-white/60 truncate">{c.phone || "—"}</div>
              {/* Адрес */}
              <div className="text-sm text-white/40 truncate">{c.address || "—"}</div>
              {/* Статус */}
              <div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: (STATUS_COLORS[c.status] || "#666") + "20", color: STATUS_COLORS[c.status] || "#aaa" }}>
                  {STATUS_LABELS[c.status] || c.status}
                </span>
              </div>
              {/* Бюджет */}
              <div className="text-sm font-semibold text-emerald-400">{c.budget ? `${c.budget.toLocaleString("ru-RU")} ₽` : "—"}</div>
              {/* Действия */}
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => setEditing(c)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 text-white/30 hover:text-white transition">
                  <Icon name="Pencil" size={13} />
                </button>
              </div>
            </div>

            {/* Раскрывашка */}
            {expanded === c.id && (
              <div className="bg-white/[0.015] border-b border-white/5 px-5 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-white/35 mb-1">Площадь</div>
                    <div className="text-white font-semibold">{c.area ? `${c.area} м²` : "—"}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-white/35 mb-1">Дата замера</div>
                    <div className="text-white font-semibold">{c.measure_date ? new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "—"}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-white/35 mb-1">Источник</div>
                    <div className="text-white font-semibold">{c.source || "—"}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-white/35 mb-1">Добавлен</div>
                    <div className="text-white font-semibold">{new Date(c.created_at).toLocaleDateString("ru-RU")}</div>
                  </div>
                </div>
                {c.notes && <div className="text-xs text-white/40 bg-white/5 rounded-xl p-3"><span className="text-white/25">Заметки: </span>{c.notes}</div>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditing(c)} className="px-4 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs rounded-lg transition">Редактировать</button>
                  <button onClick={() => setConfirmDelete(c)} className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs rounded-lg transition">Удалить</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Модалка редактирования */}
      {editing && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#12121f] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Редактировать клиента</h3>
              <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white transition"><Icon name="X" size={18} /></button>
            </div>
            <div className="space-y-3">
              {([["client_name","Имя"], ["phone","Телефон"], ["address","Адрес"]] as [keyof Client, string][]).map(([f, l]) => (
                <div key={f}>
                  <label className="text-xs text-white/35 mb-1.5 block">{l}</label>
                  <input value={String(editing[f] || "")} onChange={e => setEditing({ ...editing, [f]: e.target.value })}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition" />
                </div>
              ))}
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
                  {ALL_STATUSES.map(s => <option key={s} value={s} className="bg-[#1a1a2e]">{STATUS_LABELS[s]}</option>)}
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
              <button onClick={() => { setConfirmDelete(editing); setEditing(null); }} className="py-2.5 px-4 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm rounded-xl transition">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* Подтверждение удаления */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-[#12121f] border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-red-400" />
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">Удалить клиента?</h3>
            <p className="text-sm text-white/40 text-center mb-5">«{confirmDelete.client_name || "Клиент"}» будет помечен как удалённый</p>
            <div className="flex gap-2">
              <button onClick={() => deleteClient(confirmDelete)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl font-medium transition">Удалить</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-xl transition">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка добавления */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[#12121f] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Новый клиент</h3>
              <button onClick={() => setShowAdd(false)} className="text-white/30 hover:text-white transition"><Icon name="X" size={18} /></button>
            </div>
            <div className="space-y-3">
              {([["client_name","Имя *"], ["phone","Телефон"], ["address","Адрес"]] as [keyof typeof newClient, string][]).map(([f, l]) => (
                <div key={f}>
                  <label className="text-xs text-white/35 mb-1.5 block">{l}</label>
                  <input value={newClient[f]} onChange={e => setNewClient({ ...newClient, [f]: e.target.value })}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition" />
                </div>
              ))}
              <div>
                <label className="text-xs text-white/35 mb-1.5 block">Статус</label>
                <select value={newClient.status} onChange={e => setNewClient({ ...newClient, status: e.target.value })}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition">
                  {ALL_STATUSES.map(s => <option key={s} value={s} className="bg-[#1a1a2e]">{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/35 mb-1.5 block">Дата замера</label>
                <input type="datetime-local" value={newClient.measure_date} onChange={e => setNewClient({ ...newClient, measure_date: e.target.value })}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition" />
              </div>
              <div>
                <label className="text-xs text-white/35 mb-1.5 block">Заметки</label>
                <textarea value={newClient.notes} onChange={e => setNewClient({ ...newClient, notes: e.target.value })} rows={2}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition resize-none" />
              </div>
            </div>
            <p className="text-xs text-white/25 mt-3">Клиент автоматически появится в Канбане{newClient.measure_date ? " и Календаре" : ""}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={addClient} disabled={!newClient.client_name.trim()} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm rounded-xl font-medium transition">Добавить</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-xl transition">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
