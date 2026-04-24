import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, LEAD_STATUSES, Client, DEFAULT_TAGS } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";
import { useTheme } from "./themeContext";

function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#8b5cf6","#3b82f6","#f59e0b","#10b981","#f97316","#ec4899","#06b6d4"];
  const color = colors[(name || "?").charCodeAt(0) % colors.length];
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: color + "30", border: `1.5px solid ${color}40`, color: "#fff" }}>
      {initials}
    </div>
  );
}

export default function CrmClients() {
  const t = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState({ client_name: "", phone: "", status: "new", address: "", notes: "", measure_date: "" });

  const load = () => {
    setLoading(true);
    const extra: Record<string, string> = { mode: "leads" };
    if (search) extra.search = search;
    if (statusFilter) extra.status = statusFilter;
    crmFetch("clients", undefined, extra).then(d => {
      setClients(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [search, statusFilter]); // eslint-disable-line

  const addClient = async () => {
    if (!newClient.client_name.trim()) return;
    await crmFetch("clients", { method: "POST", body: JSON.stringify(newClient) });
    setShowAdd(false);
    setNewClient({ client_name: "", phone: "", status: "new", address: "", notes: "", measure_date: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Все клиенты</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>
            Лиды до подписания договора · <span style={{ color: t.textSub }}>{clients.length}</span>
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-xl font-medium transition shadow-lg shadow-violet-900/30">
          <Icon name="UserPlus" size={14} /> Добавить клиента
        </button>
      </div>

      {/* Поиск + фильтры */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52">
          <Icon name="Search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, адресу..."
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/40 transition"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setStatusFilter("")}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition border ${!statusFilter ? "bg-violet-600/15 border-violet-500/30 text-violet-300" : "hover:border-white/15"}`}
            style={!statusFilter ? {} : { borderColor: t.border, color: t.textMute }}>
            Все
          </button>
          {LEAD_STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
              className="px-3 py-2 rounded-xl text-xs font-medium transition border"
              style={statusFilter === s
                ? { background: STATUS_COLORS[s] + "20", color: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] + "40" }
                : { borderColor: t.border, color: t.textMute }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица */}
      <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <div className="grid grid-cols-[1fr_150px_180px_140px_140px_40px] px-5 py-3" style={{ borderBottom: `1px solid ${t.border2}` }}>
          {["Клиент", "Телефон", "Адрес", "Статус", "Дата замера", ""].map(h => (
            <div key={h} className="text-xs font-medium" style={{ color: t.textMute }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: t.textMute }}>Клиенты не найдены</div>
        ) : clients.map(c => (
          <div key={c.id}
            onClick={() => setSelected(c)}
            className="grid grid-cols-[1fr_150px_180px_140px_140px_40px] px-5 py-3 hover:bg-white/[0.02] cursor-pointer transition items-center"
            style={{ borderBottom: `1px solid ${t.border2}` }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={c.client_name} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "—"}</div>
                {c.tags && c.tags.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {c.tags.slice(0, 2).map(tag => {
                      const tagDef = DEFAULT_TAGS.find(d => d.label === tag);
                      return (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: (tagDef?.color || "#666") + "20", color: tagDef?.color || "#888" }}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="text-sm truncate" style={{ color: t.textSub }}>{c.phone || "—"}</div>
            <div className="text-sm truncate" style={{ color: t.textMute }}>{c.address || "—"}</div>
            <div>
              <span className="px-2 py-1 rounded-lg text-xs font-medium"
                style={{ background: STATUS_COLORS[c.status] + "18", color: STATUS_COLORS[c.status] }}>
                {STATUS_LABELS[c.status] || c.status}
              </span>
            </div>
            <div className="text-xs" style={{ color: t.textMute }}>
              {c.measure_date ? new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"}
            </div>
            <div className="transition" style={{ color: t.textMute }}>
              <Icon name="ChevronRight" size={14} />
            </div>
          </div>
        ))}
      </div>

      {/* Боковая карточка */}
      {selected && (
        <ClientDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load(); }}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}

      {/* Модалка добавления */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: t.text }}>Новый клиент</h3>
              <button onClick={() => setShowAdd(false)} className="transition" style={{ color: t.textMute }}>
                <Icon name="X" size={17} />
              </button>
            </div>
            <div className="space-y-3">
              {([["client_name","Имя *"],["phone","Телефон"],["address","Адрес"]] as [keyof typeof newClient, string][]).map(([f, l]) => (
                <div key={f}>
                  <label className="text-xs mb-1.5 block" style={{ color: t.textMute }}>{l}</label>
                  <input
                    value={newClient[f]}
                    onChange={e => setNewClient({ ...newClient, [f]: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/40 transition"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: t.textMute }}>Статус</label>
                  <select
                    value={newClient.status}
                    onChange={e => setNewClient({ ...newClient, status: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/40 transition"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}>
                    {LEAD_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: t.textMute }}>Дата замера</label>
                  <input
                    type="datetime-local"
                    value={newClient.measure_date}
                    onChange={e => setNewClient({ ...newClient, measure_date: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/40 transition"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs mt-3" style={{ color: t.textMute }}>
              Клиент автоматически появится в Канбане{newClient.measure_date ? " и Календаре" : ""}
            </p>
            <div className="flex gap-2 mt-4">
              <button onClick={addClient} disabled={!newClient.client_name.trim()}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm rounded-xl font-medium transition">
                Добавить
              </button>
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl text-sm transition hover:bg-white/[0.08]"
                style={{ background: t.surface2, color: t.textSub }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
