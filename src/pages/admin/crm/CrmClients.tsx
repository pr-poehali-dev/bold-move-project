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

const ALL_STATUSES = Object.keys(STATUS_LABELS);

export default function CrmClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState({ client_name: "", phone: "", status: "new", address: "", notes: "" });

  const load = () => {
    setLoading(true);
    const extra: Record<string, string> = {};
    if (search) extra.search = search;
    if (statusFilter) extra.status = statusFilter;
    crmFetch("clients", undefined, extra).then(d => { setClients(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { load(); }, [search, statusFilter]); // eslint-disable-line

  const saveEdit = async () => {
    if (!editing) return;
    await crmFetch("clients", { method: "PUT", body: JSON.stringify(editing) }, { id: String(editing.id) });
    setEditing(null);
    load();
  };

  const addClient = async () => {
    await crmFetch("clients", { method: "POST", body: JSON.stringify(newClient) });
    setShowAdd(false);
    setNewClient({ client_name: "", phone: "", status: "new", address: "", notes: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Все клиенты</h2>
          <p className="text-xs text-white/40">Показано: {clients.length}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition">
          <Icon name="UserPlus" size={14} /> Добавить
        </button>
      </div>

      {/* Поиск и фильтры */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или телефону..."
            className="w-full bg-[#13131f] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setStatusFilter("")} className={`px-3 py-2 rounded-lg text-xs transition ${!statusFilter ? "bg-violet-600 text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>Все</button>
          {ALL_STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
              className={`px-3 py-2 rounded-lg text-xs transition ${statusFilter === s ? "text-white" : "bg-white/5 text-white/50 hover:text-white"}`}
              style={statusFilter === s ? { background: STATUS_COLORS[s] + "33", color: STATUS_COLORS[s] } : {}}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-[#13131f] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-xs text-white/40 font-medium px-5 py-3">Имя</th>
              <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Телефон</th>
              <th className="text-left text-xs text-white/40 font-medium px-4 py-3 hidden md:table-cell">Адрес</th>
              <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Статус</th>
              <th className="text-left text-xs text-white/40 font-medium px-4 py-3 hidden lg:table-cell">Дата замера</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-white/30 text-sm">Загрузка...</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-white/30 text-sm">Клиенты не найдены</td></tr>
            ) : clients.map(c => (
              <>
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/3 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                  <td className="px-5 py-3">
                    <div className="text-sm font-semibold text-white">{c.client_name || "—"}</div>
                    <div className="text-xs text-white/30">#{c.id}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white/70">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-sm text-white/50 hidden md:table-cell">{c.address || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: (STATUS_COLORS[c.status] || "#666") + "33", color: STATUS_COLORS[c.status] || "#aaa" }}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40 hidden lg:table-cell">
                    {c.measure_date ? new Date(c.measure_date).toLocaleDateString("ru-RU") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={e => { e.stopPropagation(); setEditing(c); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition">
                      <Icon name="Pencil" size={13} />
                    </button>
                  </td>
                </tr>
                {expanded === c.id && (
                  <tr key={`exp-${c.id}`} className="bg-white/2 border-b border-white/5">
                    <td colSpan={6} className="px-5 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div><span className="text-white/40">Площадь:</span> <span className="text-white ml-1">{c.area ? `${c.area} м²` : "—"}</span></div>
                        <div><span className="text-white/40">Бюджет:</span> <span className="text-white ml-1">{c.budget ? `${c.budget.toLocaleString("ru-RU")} ₽` : "—"}</span></div>
                        <div><span className="text-white/40">Источник:</span> <span className="text-white ml-1">{c.source || "—"}</span></div>
                        <div><span className="text-white/40">Добавлен:</span> <span className="text-white ml-1">{new Date(c.created_at).toLocaleDateString("ru-RU")}</span></div>
                        {c.notes && <div className="col-span-2 md:col-span-4"><span className="text-white/40">Заметки:</span> <span className="text-white ml-1">{c.notes}</span></div>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модалка редактирования */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Редактировать клиента</h3>
            <div className="space-y-3">
              {[["client_name", "Имя"], ["phone", "Телефон"], ["address", "Адрес"]].map(([f, l]) => (
                <div key={f}>
                  <label className="text-xs text-white/40 mb-1 block">{l}</label>
                  <input value={(editing as Record<string, string>)[f] || ""} onChange={e => setEditing({ ...editing, [f]: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-white/40 mb-1 block">Статус</label>
                <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
                  {ALL_STATUSES.map(s => <option key={s} value={s} className="bg-[#1a1a2e]">{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Дата замера</label>
                <input type="datetime-local" value={editing.measure_date ? editing.measure_date.slice(0, 16) : ""}
                  onChange={e => setEditing({ ...editing, measure_date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Заметки</label>
                <textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveEdit} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition">Сохранить</button>
              <button onClick={() => setEditing(null)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка добавления */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Добавить клиента</h3>
            <div className="space-y-3">
              {[["client_name", "Имя"], ["phone", "Телефон"], ["address", "Адрес"]].map(([f, l]) => (
                <div key={f}>
                  <label className="text-xs text-white/40 mb-1 block">{l}</label>
                  <input value={(newClient as Record<string, string>)[f] || ""} onChange={e => setNewClient({ ...newClient, [f]: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-white/40 mb-1 block">Статус</label>
                <select value={newClient.status} onChange={e => setNewClient({ ...newClient, status: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
                  {ALL_STATUSES.map(s => <option key={s} value={s} className="bg-[#1a1a2e]">{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Заметки</label>
                <textarea value={newClient.notes} onChange={e => setNewClient({ ...newClient, notes: e.target.value })} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={addClient} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition">Добавить</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}