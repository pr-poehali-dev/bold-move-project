import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import ClientDrawer from "./ClientDrawer";

interface Stats {
  total_all: number; total_leads: number; total_orders: number;
  total_done: number; total_cancel: number;
  went_measure: number; went_contract: number;
  upcoming_measures: number; upcoming_installs: number;
  total_contract: number; total_received: number;
  total_prepayment: number; total_extra: number;
  total_material: number; total_measure_cost: number; total_install_cost: number;
  total_costs: number; total_profit: number;
  avg_area: number; avg_contract: number;
  cancel_reasons: { reason: string; count: number }[];
  funnel: { label: string; count: number; status: string }[];
  status_dist: { status: string; count: number }[];
  monthly_leads:   { month: string; count: number }[];
  monthly_done:    { month: string; count: number }[];
  monthly_revenue: { month: string; revenue: number }[];
  monthly_costs:   { month: string; costs: number }[];
  monthly_profit:  { month: string; profit: number }[];
}

type AnalyticsTab = "overview" | "finance" | "dynamics";

const ANALYTICS_TABS: { id: AnalyticsTab; label: string; icon: string }[] = [
  { id: "overview",  label: "Обзор",    icon: "LayoutDashboard" },
  { id: "finance",   label: "Финансы",  icon: "Banknote" },
  { id: "dynamics",  label: "Динамика", icon: "TrendingUp" },
];

function Money({ val, className = "" }: { val: number; className?: string }) {
  const t = useTheme();
  return <span className={className || ""} style={!className ? { color: t.text } : {}}>
    {val > 0 ? val.toLocaleString("ru-RU") + " ₽" : "—"}
  </span>;
}

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  const t = useTheme();
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + "18" }}>
        <Icon name={icon} size={17} style={{ color }} />
      </div>
      <div className="text-xs mb-0.5" style={{ color: t.textMute }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: t.text }}>{typeof value === "number" ? value.toLocaleString("ru-RU") : value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: t.textMute }}>{sub}</div>}
      <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: color }} />
    </div>
  );
}

export default function CrmAnalytics() {
  const t = useTheme();
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<AnalyticsTab>("overview");

  // Графики — переключатели
  const [leadsMode,   setLeadsMode]   = useState<"leads" | "done" | "both">("both");
  const [revenueMode, setRevenueMode] = useState<"revenue" | "costs" | "profit" | "all">("all");

  // Фильтр месяцев
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo,   setMonthTo]   = useState("");

  // Последние заявки + drawer
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [drawerClient,  setDrawerClient]  = useState<Client | null>(null);

  useEffect(() => {
    crmFetch("stats").then(d => { setStats(d as Stats); setLoading(false); }).catch(() => setLoading(false));
    crmFetch("clients").then((d: unknown) => {
      if (Array.isArray(d)) setRecentClients((d as Client[]).filter((c: Client) => c.status !== "deleted").slice(0, 10));
    }).catch(() => {});
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const EMPTY: Stats = {
    total_all: 0, total_leads: 0, total_orders: 0, total_done: 0, total_cancel: 0,
    went_measure: 0, went_contract: 0, upcoming_measures: 0, upcoming_installs: 0,
    total_contract: 0, total_received: 0, total_prepayment: 0, total_extra: 0,
    total_material: 0, total_measure_cost: 0, total_install_cost: 0,
    total_costs: 0, total_profit: 0, avg_area: 0, avg_contract: 0,
    cancel_reasons: [], funnel: [], status_dist: [],
    monthly_leads: [], monthly_done: [], monthly_revenue: [], monthly_costs: [], monthly_profit: [],
  };
  const s = stats ?? EMPTY;

  // Конверсии
  const convMeasure  = s.total_all     > 0 ? Math.round((s.went_measure  / s.total_all)     * 100) : 0;
  const convContract = s.went_measure  > 0 ? Math.round((s.went_contract / s.went_measure)  * 100) : 0;
  const convDone     = s.went_contract > 0 ? Math.round((s.total_done    / s.went_contract) * 100) : 0;
  const cancelRate   = s.total_all     > 0 ? Math.round((s.total_cancel  / s.total_all)     * 100) : 0;

  // Pie данные
  const costPie = [
    { name: "Материалы", value: s.total_material,     color: "#ef4444" },
    { name: "Замеры",    value: s.total_measure_cost, color: "#f59e0b" },
    { name: "Монтажи",   value: s.total_install_cost, color: "#f97316" },
  ].filter(c => c.value > 0);

  const statusPie = s.status_dist
    .filter(x => x.status !== "deleted")
    .map(x => ({ name: STATUS_LABELS[x.status] || x.status, value: x.count, color: STATUS_COLORS[x.status] || "#666" }));

  // Динамика по месяцам
  const allMerged = s.monthly_leads.map(d => ({
    month:   d.month,
    leads:   d.count,
    done:    s.monthly_done.find(x => x.month === d.month)?.count      ?? 0,
    revenue: s.monthly_revenue.find(x => x.month === d.month)?.revenue ?? 0,
    costs:   s.monthly_costs.find(x => x.month === d.month)?.costs     ?? 0,
    profit:  s.monthly_profit.find(x => x.month === d.month)?.profit   ?? 0,
  }));
  const merged = allMerged.filter(d =>
    (!monthFrom || d.month >= monthFrom) &&
    (!monthTo   || d.month <= monthTo)
  );

  // Воронка для обзора
  const funnelData = [
    { label: "Заявки",       count: s.total_all,       color: "#8b5cf6", pct: 100 },
    { label: "Ушли на замер", count: s.went_measure,   color: "#f59e0b", pct: s.total_all > 0 ? Math.round(s.went_measure / s.total_all * 100) : 0 },
    { label: "Подписали договор", count: s.went_contract, color: "#06b6d4", pct: s.total_all > 0 ? Math.round(s.went_contract / s.total_all * 100) : 0 },
    { label: "Завершённые",  count: s.total_done,      color: "#10b981", pct: s.total_all > 0 ? Math.round(s.total_done / s.total_all * 100) : 0 },
    { label: "Отказников",   count: s.total_cancel,    color: "#ef4444", pct: s.total_all > 0 ? Math.round(s.total_cancel / s.total_all * 100) : 0 },
  ];

  const tooltipStyle = { backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 12 };

  return (
    <div className="space-y-4">

      {/* Заголовок + подвкладки */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Аналитика</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>Всего заявок: {s.total_all}</p>
        </div>
        <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
          {ANALYTICS_TABS.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition"
              style={{
                background: tab === tb.id ? "#7c3aed22" : "transparent",
                color: tab === tb.id ? "#a78bfa" : t.textMute,
                borderRight: tb.id !== "dynamics" ? `1px solid ${t.border}` : undefined,
              }}>
              <Icon name={tb.icon} size={13} /> {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ ОБЗОР ══════════════ */}
      {tab === "overview" && (
        <div className="space-y-5">

          {/* KPI — счётчики */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard icon="Users"       label="Всего заявок"    value={s.total_all}      sub={`${s.total_leads} лидов · ${s.total_orders} заказов`} color="#8b5cf6" />
            <KpiCard icon="CalendarDays" label="Замеров предстоит" value={s.upcoming_measures} sub={`${s.upcoming_installs} монтажей скоро`} color="#f59e0b" />
            <KpiCard icon="FileText"    label="Договоров"       value={s.went_contract}  sub={`${convContract}% от замеров`} color="#06b6d4" />
            <KpiCard icon="CheckCircle2" label="Завершено"      value={s.total_done}     sub={`${s.total_cancel} отказов`} color="#10b981" />
          </div>

          {/* KPI — конверсии */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard icon="TrendingUp"     label="Конверсия в замер"  value={`${convMeasure}%`}  sub={`${s.went_measure} из ${s.total_all}`}    color="#f59e0b" />
            <KpiCard icon="FileSignature"  label="Замер → договор"    value={`${convContract}%`} sub={`${s.went_contract} из ${s.went_measure}`} color="#06b6d4" />
            <KpiCard icon="CheckCircle2"   label="Договор → завершён" value={`${convDone}%`}     sub={`${s.total_done} завершено`}              color="#10b981" />
            <KpiCard icon="XCircle"        label="Процент отказов"    value={`${cancelRate}%`}   sub={`${s.total_cancel} отказников`}           color="#ef4444" />
          </div>

          {/* Воронка + последние заявки */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Воронка продаж */}
            <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-violet-500" />
                <span className="text-sm font-bold" style={{ color: t.text }}>Воронка продаж</span>
              </div>
              <div className="space-y-3">
                {funnelData.map(f => (
                  <div key={f.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs" style={{ color: t.textSub }}>{f.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: t.text }}>{f.count}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: f.color + "18", color: f.color }}>{f.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: t.surface2 }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${f.pct}%`, background: f.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Последние заявки */}
            <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-violet-500" />
                <span className="text-sm font-bold" style={{ color: t.text }}>Последние заявки</span>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-lg" style={{ color: t.textMute, background: t.surface2 }}>нажми → открыть</span>
              </div>
              {recentClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8" style={{ color: t.textMute }}>
                  <Icon name="Inbox" size={24} className="mb-2 opacity-30" />
                  <span className="text-sm">Заявок пока нет</span>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: t.border2 }}>
                  {recentClients.map(c => (
                    <button key={c.id} onClick={() => setDrawerClient(c)}
                      className="w-full flex items-center gap-3 py-2.5 text-left transition hover:opacity-80 group">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{ background: (STATUS_COLORS[c.status] || "#8b5cf6") + "25", color: STATUS_COLORS[c.status] || "#8b5cf6" }}>
                        {(c.client_name || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                        <div className="text-[10px] truncate" style={{ color: t.textMute }}>{c.phone || "—"}</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0 font-medium"
                        style={{ background: (STATUS_COLORS[c.status] || "#8b5cf6") + "20", color: STATUS_COLORS[c.status] || "#8b5cf6" }}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                      <Icon name="ChevronRight" size={12} style={{ color: t.textMute }} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Распределение по статусам — bar chart */}
          {statusPie.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-violet-500" />
                <span className="text-sm font-bold" style={{ color: t.text }}>Распределение по статусам</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusPie} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: t.textMute }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10, fill: t.textMute }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [v, "Клиентов"]}
                  />
                  <Bar dataKey="value" name="Клиентов" radius={[4, 4, 0, 0]}>
                    {statusPie.map((sp, i) => (
                      <Cell key={i} fill={sp.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ФИНАНСЫ ══════════════ */}
      {tab === "finance" && (
        <div className="space-y-5">

          {/* Финансовые KPI */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard icon="Banknote"    label="Сумма договоров" value={s.total_contract > 0 ? s.total_contract.toLocaleString("ru-RU") + " ₽" : "—"} color="#10b981" />
            <KpiCard icon="Wallet"      label="Получено"        value={s.total_received > 0 ? s.total_received.toLocaleString("ru-RU") + " ₽" : "—"} sub="предоплата + доплата" color="#06b6d4" />
            <KpiCard icon="Receipt"     label="Все затраты"     value={s.total_costs > 0 ? s.total_costs.toLocaleString("ru-RU") + " ₽" : "—"} color="#ef4444" />
            <KpiCard icon="TrendingUp"  label="Прибыль"         value={s.total_profit !== 0 ? (s.total_profit > 0 ? "+" : "") + s.total_profit.toLocaleString("ru-RU") + " ₽" : "—"} color={s.total_profit >= 0 ? "#10b981" : "#ef4444"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* P&L */}
            <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold" style={{ color: t.text }}>P&L (доходы / расходы)</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Сумма договоров",    val: s.total_contract,      cls: "font-semibold text-white" },
                  { label: "Получено",           val: s.total_received,      cls: "font-semibold text-emerald-400" },
                  { label: "Материалы (расход)", val: s.total_material,      cls: "font-semibold text-red-400",    neg: true },
                  { label: "Замеры (расход)",    val: s.total_measure_cost,  cls: "font-semibold text-red-400/70", neg: true },
                  { label: "Монтажи (расход)",   val: s.total_install_cost,  cls: "font-semibold text-red-400/70", neg: true },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center text-sm pb-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
                    <span style={{ color: t.textMute }}>{r.label}</span>
                    <span className={r.cls}>
                      {r.val > 0 ? `${r.neg ? "−" : "+"}${r.val.toLocaleString("ru-RU")} ₽` : "—"}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm font-bold" style={{ color: t.text }}>Прибыль</span>
                  <span className={`text-xl font-bold ${s.total_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.total_profit >= 0 ? "+" : ""}{s.total_profit.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* Структура затрат — donut */}
            <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-red-500" />
                <span className="text-sm font-bold" style={{ color: t.text }}>Структура затрат</span>
              </div>
              {costPie.length > 0 ? (
                <>
                  <div className="flex justify-center mb-3">
                    <PieChart width={150} height={150}>
                      <Pie data={costPie} cx={70} cy={70} innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={2} stroke={t.surface}>
                        {costPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </div>
                  <div className="space-y-2">
                    {costPie.map(c => (
                      <div key={c.name} className="flex justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                          <span style={{ color: t.textSub }}>{c.name}</span>
                        </div>
                        <span className="font-semibold" style={{ color: t.text }}>{c.value.toLocaleString("ru-RU")} ₽</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs pt-2 border-t font-bold" style={{ borderColor: t.border2 }}>
                      <span style={{ color: t.textSub }}>Итого затраты</span>
                      <span style={{ color: t.text }}>{s.total_costs.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8" style={{ color: t.textMute }}>
                  <Icon name="PieChart" size={28} className="mb-2 opacity-30" />
                  <span className="text-sm">Нет данных о затратах</span>
                </div>
              )}
            </div>

            {/* Средние показатели + предстоящее */}
            <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-cyan-500" />
                  <span className="text-sm font-bold" style={{ color: t.text }}>Средние показатели</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Средняя площадь",  val: s.avg_area > 0     ? `${s.avg_area.toFixed(1)} м²`                           : "—" },
                    { label: "Средний договор",   val: s.avg_contract > 0 ? `${Math.round(s.avg_contract).toLocaleString("ru-RU")} ₽` : "—" },
                    { label: "Предоплата",        val: s.total_prepayment > 0 ? `${s.total_prepayment.toLocaleString("ru-RU")} ₽`     : "—" },
                    { label: "Доплата",           val: s.total_extra > 0  ? `${s.total_extra.toLocaleString("ru-RU")} ₽`             : "—" },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-xs py-1.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
                      <span style={{ color: t.textMute }}>{r.label}</span>
                      <span className="font-semibold" style={{ color: t.text }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-amber-500" />
                  <span className="text-sm font-bold" style={{ color: t.text }}>Предстоящие события</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Замеров запланировано", val: s.upcoming_measures, color: "#f59e0b", icon: "Ruler" },
                    { label: "Монтажей запланировано", val: s.upcoming_installs, color: "#f97316", icon: "Wrench" },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between px-3 py-2 rounded-xl"
                      style={{ background: r.color + "10", border: `1px solid ${r.color}25` }}>
                      <div className="flex items-center gap-2 text-xs" style={{ color: r.color }}>
                        <Icon name={r.icon} size={12} /> {r.label}
                      </div>
                      <span className="font-bold text-sm" style={{ color: r.color }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ДИНАМИКА ══════════════ */}
      {tab === "dynamics" && (
        <div className="space-y-5">

          {/* Графики */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Заявки vs Завершённые */}
            <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-violet-500" />
                  <span className="text-sm font-bold" style={{ color: t.text }}>Заявки vs Завершённые</span>
                </div>
                <div className="flex items-center gap-1">
                  {(["leads", "done", "both"] as const).map(m => (
                    <button key={m} onClick={() => setLeadsMode(m)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                      style={leadsMode === m ? { background: "#7c3aed", color: "#fff" } : { background: t.surface2, color: t.textMute }}>
                      {m === "leads" ? "Заявки" : m === "done" ? "Завершённые" : "Оба"}
                    </button>
                  ))}
                  <input type="month" value={monthFrom} onChange={e => setMonthFrom(e.target.value)}
                    className="rounded-lg px-2 py-1 text-xs ml-2 focus:outline-none"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textSub }} />
                  <span className="text-xs" style={{ color: t.textMute }}>—</span>
                  <input type="month" value={monthTo} onChange={e => setMonthTo(e.target.value)}
                    className="rounded-lg px-2 py-1 text-xs focus:outline-none"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textSub }} />
                  {(monthFrom || monthTo) && (
                    <button onClick={() => { setMonthFrom(""); setMonthTo(""); }}
                      className="px-2 py-1 rounded-lg text-xs transition"
                      style={{ background: t.surface2, color: t.textMute }}>×</button>
                  )}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={merged} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: t.textMute }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: t.textMute }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {leadsMode !== "done" && <Bar dataKey="leads" name="Заявки" fill="#8b5cf6" radius={[4,4,0,0]} />}
                  {leadsMode !== "leads" && <Bar dataKey="done"  name="Завершённые" fill="#10b981" radius={[4,4,0,0]} />}
                  {leadsMode === "both" && <Legend wrapperStyle={{ fontSize: 11, color: t.textMute }} />}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Выручка / Затраты / Прибыль */}
            <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-emerald-500" />
                  <span className="text-sm font-bold" style={{ color: t.text }}>Выручка / Затраты / Прибыль</span>
                </div>
                <div className="flex items-center gap-1">
                  {(["revenue", "costs", "profit", "all"] as const).map(m => (
                    <button key={m} onClick={() => setRevenueMode(m)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                      style={revenueMode === m ? { background: "#7c3aed", color: "#fff" } : { background: t.surface2, color: t.textMute }}>
                      {m === "revenue" ? "Выручка" : m === "costs" ? "Затраты" : m === "profit" ? "Прибыль" : "Все"}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={merged} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border2} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: t.textMute }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: t.textMute }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}к` : v} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toLocaleString("ru-RU") + " ₽", ""]} />
                  {(revenueMode === "revenue" || revenueMode === "all") && <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />}
                  {(revenueMode === "costs"   || revenueMode === "all") && <Line type="monotone" dataKey="costs"   name="Затраты" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />}
                  {(revenueMode === "profit"  || revenueMode === "all") && <Line type="monotone" dataKey="profit"  name="Прибыль" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />}
                  {revenueMode === "all" && <Legend wrapperStyle={{ fontSize: 11, color: t.textMute }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Причины отказов */}
          <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full bg-red-500" />
              <span className="text-sm font-bold" style={{ color: t.text }}>Причины отказов</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-lg" style={{ color: t.textMute, background: t.surface2 }}>{s.total_cancel} отказников</span>
            </div>
            {s.cancel_reasons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10" style={{ color: t.textMute }}>
                <Icon name="ThumbsUp" size={28} className="mb-2 opacity-30" />
                <span className="text-sm">Отказов нет — отлично!</span>
                <span className="text-xs mt-1">Указывайте причину при смене статуса на «Отменён»</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {s.cancel_reasons.map((r, i) => {
                  const pct = s.total_cancel > 0 ? Math.round(r.count / s.total_cancel * 100) : 0;
                  return (
                    <div key={i} className="rounded-xl p-3" style={{ background: t.surface2 }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-md bg-red-500/15 flex items-center justify-center text-[10px] font-bold text-red-400">{i+1}</div>
                        <span className="flex-1 text-sm truncate" style={{ color: t.textSub }}>{r.reason}</span>
                        <span className="text-sm font-bold" style={{ color: t.text }}>{r.count}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-red-400" style={{ background: "rgba(239,68,68,0.1)" }}>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: t.border }}>
                        <div className="h-full rounded-full bg-red-500/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer клиента */}
      {drawerClient && (
        <ClientDrawer
          client={drawerClient}
          allClientOrders={(() => {
            const phone = (drawerClient.phone || "").trim().replace(/\D/g, "");
            return phone ? recentClients.filter(c => (c.phone || "").trim().replace(/\D/g, "") === phone) : [drawerClient];
          })()}
          onClose={() => setDrawerClient(null)}
          onUpdated={() => {
            crmFetch("clients").then((d: unknown) => {
              if (Array.isArray(d)) setRecentClients((d as Client[]).filter((c: Client) => c.status !== "deleted").slice(0, 10));
            }).catch(() => {});
            setDrawerClient(null);
          }}
          onDeleted={() => {
            setRecentClients(prev => prev.filter(c => c.id !== drawerClient.id));
            setDrawerClient(null);
          }}
        />
      )}
    </div>
  );
}