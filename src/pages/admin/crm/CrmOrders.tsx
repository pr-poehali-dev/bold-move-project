import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, ORDER_STATUSES, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";

function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#8b5cf6","#3b82f6","#f59e0b","#10b981","#f97316","#ec4899","#06b6d4"];
  const color = colors[(name || "?").charCodeAt(0) % colors.length];
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ background: color + "30", border: `1.5px solid ${color}40` }}>
      {initials}
    </div>
  );
}

export default function CrmOrders() {
  const [orders, setOrders] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);

  const load = () => {
    setLoading(true);
    const extra: Record<string, string> = { mode: "orders" };
    if (search) extra.search = search;
    if (statusFilter) extra.status = statusFilter;
    crmFetch("clients", undefined, extra).then(d => {
      setOrders(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [search, statusFilter]); // eslint-disable-line

  const totalRevenue = orders.reduce((s, o) => s + (o.contract_sum || 0), 0);
  const totalPaid = orders.reduce((s, o) => s + (o.prepayment || 0) + (o.extra_payment || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Все заказы</h2>
          <p className="text-xs text-white/25 mt-0.5">
            Показано: <span className="text-white/40">{orders.length}</span>
            {totalRevenue > 0 && <> · Договоры: <span className="text-emerald-400/80">{totalRevenue.toLocaleString("ru-RU")} ₽</span></>}
            {totalPaid > 0 && <> · Получено: <span className="text-emerald-400">{totalPaid.toLocaleString("ru-RU")} ₽</span></>}
          </p>
        </div>
      </div>

      {/* Поиск + фильтры */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52">
          <Icon name="Search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по ID заказа, товару, клиенту..."
            className="w-full bg-[#0a0a16] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setStatusFilter("")}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition border ${!statusFilter ? "bg-violet-600/15 border-violet-500/30 text-violet-300" : "border-white/[0.06] text-white/35 hover:text-white/60"}`}>
            Все
          </button>
          {ORDER_STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition border ${statusFilter === s ? "border-current" : "border-white/[0.06] text-white/35 hover:text-white/60"}`}
              style={statusFilter === s ? { background: STATUS_COLORS[s] + "20", color: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] + "40" } : {}}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-[#0a0a16] border border-white/[0.05] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_150px_120px_140px_150px_40px] px-5 py-3 border-b border-white/[0.04]">
          {["ID","Клиент","Адрес","Площадь","Договор","Статус",""].map(h => (
            <div key={h} className="text-xs text-white/25 font-medium">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-white/20 text-sm">Заказы не найдены</div>
        ) : orders.map(o => (
          <div key={o.id}
            onClick={() => setSelected(o)}
            className="grid grid-cols-[80px_1fr_150px_120px_140px_150px_40px] px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition items-center">
            <div className="text-xs text-white/25 font-mono">ORD-{String(o.id).padStart(4,"0")}</div>
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={o.client_name} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/90 truncate">{o.client_name || "—"}</div>
                <div className="text-xs text-white/30 truncate">{o.phone || ""}</div>
              </div>
            </div>
            <div className="text-sm text-white/35 truncate">{o.address || "—"}</div>
            <div className="text-sm text-white/45">{o.area ? `${o.area} м²` : "—"}</div>
            <div>
              {o.contract_sum ? (
                <div>
                  <div className="text-sm font-semibold text-emerald-400">{o.contract_sum.toLocaleString("ru-RU")} ₽</div>
                  {(o.prepayment || o.extra_payment) && (
                    <div className="text-[10px] text-white/30">
                      оплачено {((o.prepayment||0)+(o.extra_payment||0)).toLocaleString("ru-RU")} ₽
                    </div>
                  )}
                </div>
              ) : <span className="text-white/25 text-sm">—</span>}
            </div>
            <div>
              <span className="px-2 py-1 rounded-lg text-xs font-medium"
                style={{ background: STATUS_COLORS[o.status] + "18", color: STATUS_COLORS[o.status] }}>
                {STATUS_LABELS[o.status] || o.status}
              </span>
            </div>
            <div className="text-white/20 hover:text-white/50 transition">
              <Icon name="ChevronRight" size={14} />
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <ClientDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => load()}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
