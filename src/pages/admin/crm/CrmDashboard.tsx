import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell, Legend,
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

function Money({ val, color = "text-white" }: { val: number; color?: string }) {
  return <span className={color}>{val > 0 ? val.toLocaleString("ru-RU") + " ₽" : "—"}</span>;
}

function StatCard({ icon, label, value, sub, color, grad }: {
  icon: string; label: string; value: string | number; sub?: string; color: string; grad: string;
}) {
  const t = useTheme();
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${grad} rounded-2xl p-5`} style={{ border: `1px solid ${t.border}` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + "20" }}>
          <Icon name={icon} size={19} style={{ color }} />
        </div>
      </div>
      <div className="text-xs mb-0.5" style={{ color: t.textMute }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: t.text }}>{typeof value === "number" ? value.toLocaleString("ru-RU") : value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: t.textMute }}>{sub}</div>}
      <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.07]" style={{ background: color }} />
    </div>
  );
}

// ── Утилита: объединить данные по месяцам, всегда показывая все 12 ──────────
function mergeMonths(
  leads:   { month: string; count: number }[],
  done:    { month: string; count: number }[],
  revenue: { month: string; revenue: number }[],
  costs:   { month: string; costs: number }[],
  profit:  { month: string; profit: number }[],
) {
  // Бэкенд уже возвращает 12 месяцев, просто объединяем по ключу
  const months = leads.map(d => d.month);
  return months.map(m => ({
    month:   m,
    leads:   leads.find(d => d.month === m)?.count     ?? 0,
    done:    done.find(d => d.month === m)?.count      ?? 0,
    revenue: revenue.find(d => d.month === m)?.revenue ?? 0,
    costs:   costs.find(d => d.month === m)?.costs     ?? 0,
    profit:  profit.find(d => d.month === m)?.profit   ?? 0,
  }));
}

export default function CrmDashboard() {
  const t = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Переключатели графиков
  const [leadsMode,   setLeadsMode]   = useState<"leads" | "done" | "both">("leads");
  const [revenueMode, setRevenueMode] = useState<"revenue" | "costs" | "profit" | "all">("revenue");

  // Фильтр месяцев
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo,   setMonthTo]   = useState("");

  // Последние заявки + drawer
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [drawerClient,  setDrawerClient]  = useState<Client | null>(null);

  useEffect(() => {
    crmFetch("stats")
      .then(d => { if (d && !d.error) setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
    crmFetch("clients").then((d: Client[] | unknown) => {
      if (Array.isArray(d)) setRecentClients((d as Client[]).filter((c: Client) => c.status !== "deleted").slice(0, 8));
    }).catch(() => {});
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  const convMeasure  = stats.total_all     > 0 ? Math.round((stats.went_measure  / stats.total_all)     * 100) : 0;
  const convContract = stats.went_measure  > 0 ? Math.round((stats.went_contract / stats.went_measure)  * 100) : 0;
  const convDone     = stats.went_contract > 0 ? Math.round((stats.total_done    / stats.went_contract) * 100) : 0;

  // Объединяем и фильтруем по диапазону месяцев
  const allMerged = mergeMonths(
    stats.monthly_leads, stats.monthly_done,
    stats.monthly_revenue, stats.monthly_costs, stats.monthly_profit,
  );
  const merged = allMerged.filter(d =>
    (!monthFrom || d.month >= monthFrom) &&
    (!monthTo   || d.month <= monthTo)
  );

  // Конфиги режимов
  const LEADS_MODES = {
    leads: { label: "Заявки",      color: "#8b5cf6", gradId: "gradLeads" },
    done:  { label: "Завершённые", color: "#10b981", gradId: "gradDone"  },
    both:  { label: "Оба",         color: "#8b5cf6", gradId: "gradLeads" },
  } as const;

  const REVENUE_MODES = {
    revenue: { label: "Выручка",  color: "#10b981" },
    costs:   { label: "Затраты",  color: "#ef4444" },
    profit:  { label: "Прибыль",  color: "#f59e0b" },
    all:     { label: "Все",      color: "#10b981" },
  } as const;

  const lm = LEADS_MODES[leadsMode];

  return (
    <div className="space-y-5">

      {/* ── Строка 1: главные метрики ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon="Users" label="Всего заявок" value={stats.total_all} sub={`${stats.total_leads} лидов · ${stats.total_orders} заказов`} color="#8b5cf6" grad="from-violet-600/15 to-transparent" />
        <StatCard icon="CalendarDays" label="Замеров предстоит" value={stats.upcoming_measures} sub={`${stats.upcoming_installs} монтажей скоро`} color="#f59e0b" grad="from-amber-600/15 to-transparent" />
        <StatCard icon="FileText" label="Договоров" value={stats.went_contract} sub={`${convContract}% от замеров`} color="#06b6d4" grad="from-cyan-600/15 to-transparent" />
        <StatCard icon="CheckCircle2" label="Завершено" value={stats.total_done} sub={`${stats.total_cancel} отказов`} color="#10b981" grad="from-emerald-600/15 to-transparent" />
      </div>

      {/* ── Строка 2: деньги ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Финансовая сводка */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Финансовая сводка</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Сумма договоров",   val: stats.total_contract,   color: "text-white" },
              { label: "Получено (предоплата+доплата)", val: stats.total_received, color: "text-emerald-400" },
              { label: "Стоимость материалов", val: stats.total_material, color: "text-red-400" },
              { label: "Стоимость замеров",   val: stats.total_measure_cost, color: "text-red-400/70" },
              { label: "Стоимость монтажей",  val: stats.total_install_cost, color: "text-red-400/70" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center py-1.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
                <span className="text-xs" style={{ color: t.textMute }}>{r.label}</span>
                <Money val={r.val} color={r.color} />
              </div>
            ))}
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-bold" style={{ color: t.text }}>Прибыль</span>
              <span className={`text-lg font-bold ${stats.total_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats.total_profit >= 0 ? "+" : ""}{stats.total_profit.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        </div>

        {/* Воронка */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-violet-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Воронка продаж</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Заявок",           count: stats.total_all,      pct: 100,         color: "#8b5cf6" },
              { label: "Ушли на замер",    count: stats.went_measure,   pct: convMeasure, color: "#f59e0b" },
              { label: "Подписали договор",count: stats.went_contract,  pct: convContract, color: "#06b6d4" },
              { label: "Завершено",        count: stats.total_done,     pct: convDone,    color: "#10b981" },
              { label: "Отказников",       count: stats.total_cancel,   pct: stats.total_all > 0 ? Math.round((stats.total_cancel / stats.total_all) * 100) : 0, color: "#ef4444" },
            ].map(f => (
              <div key={f.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: t.textSub }}>{f.label}</span>
                  <span className="font-semibold" style={{ color: t.text }}>{f.count} <span style={{ color: t.textMute }}>({f.pct}%)</span></span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: t.border }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${f.pct}%`, background: f.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Себестоимость pie-like */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-red-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Себестоимость</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Материалы",  val: stats.total_material,     color: "#ef4444", icon: "Package" },
              { label: "Замеры",     val: stats.total_measure_cost, color: "#f59e0b", icon: "Ruler" },
              { label: "Монтажи",    val: stats.total_install_cost, color: "#f97316", icon: "Wrench" },
            ].map(c => {
              const pct = stats.total_costs > 0 ? Math.round((c.val / stats.total_costs) * 100) : 0;
              return (
                <div key={c.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: c.color + "20" }}>
                    <Icon name={c.icon} size={14} style={{ color: c.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: t.textSub }}>{c.label}</span>
                      <span style={{ color: t.text }}>{c.val > 0 ? c.val.toLocaleString("ru-RU") + " ₽" : "—"}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: t.border }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2" style={{ borderTop: `1px solid ${t.border}` }}>
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: t.textMute }}>Итого затраты</span>
                <span className="text-sm font-bold text-red-400">{stats.total_costs > 0 ? stats.total_costs.toLocaleString("ru-RU") + " ₽" : "—"}</span>
              </div>
              {stats.avg_contract > 0 && (
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs" style={{ color: t.textMute }}>Средний чек</span>
                  <span className="text-sm font-bold" style={{ color: t.text }}>{stats.avg_contract.toLocaleString("ru-RU")} ₽</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Строка 3: графики ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── График 1: Заявки / Завершённые / Оба ── */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: lm.color }} />
              <span className="text-sm font-bold" style={{ color: t.text }}>
                {leadsMode === "both" ? "Заявки vs Завершённые" : lm.label}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                {(Object.entries(LEADS_MODES) as [keyof typeof LEADS_MODES, typeof LEADS_MODES[keyof typeof LEADS_MODES]][]).map(([k, v]) => (
                  <button key={k} onClick={() => setLeadsMode(k)}
                    className="px-2.5 py-1 text-[11px] font-semibold transition"
                    style={leadsMode === k ? { background: v.color, color: "#fff" } : { background: t.surface2, color: t.textMute }}>
                    {v.label}
                  </button>
                ))}
              </div>
              <input type="month" value={monthFrom} onChange={e => setMonthFrom(e.target.value)}
                className="rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                style={{ background: t.surface2, border: `1px solid ${monthFrom ? "#8b5cf660" : t.border}`, color: monthFrom ? t.text : t.textMute, width: 112 }} />
              <span className="text-[11px]" style={{ color: t.textMute }}>—</span>
              <input type="month" value={monthTo} onChange={e => setMonthTo(e.target.value)}
                className="rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                style={{ background: t.surface2, border: `1px solid ${monthTo ? "#8b5cf660" : t.border}`, color: monthTo ? t.text : t.textMute, width: 112 }} />
              {(monthFrom || monthTo) && (
                <button onClick={() => { setMonthFrom(""); setMonthTo(""); }}
                  className="text-[10px] px-1.5 py-1 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
                  <Icon name="X" size={10} />
                </button>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={leadsMode === "both" ? 185 : 160}>
            <BarChart data={merged} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} barCategoryGap="20%">
              <defs>
                <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#4f46e5" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: t.text }} cursor={false} />
              {leadsMode !== "done"  && <Bar dataKey="leads" fill="url(#gradLeads)" radius={[4,4,0,0]} name="Заявки"      activeBar={{ fill: "url(#gradLeads)", opacity: 0.85 }} />}
              {leadsMode !== "leads" && <Bar dataKey="done"  fill="url(#gradDone)"  radius={[4,4,0,0]} name="Завершённые" activeBar={{ fill: "url(#gradDone)",  opacity: 0.85 }} />}
              {leadsMode === "both" && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} formatter={v => <span style={{ color: t.textSub }}>{v}</span>} />}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── График 2: Выручка / Затраты / Прибыль / Все ── */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: REVENUE_MODES[revenueMode].color }} />
              <span className="text-sm font-bold" style={{ color: t.text }}>
                {revenueMode === "all" ? "Выручка / Затраты / Прибыль" : `${REVENUE_MODES[revenueMode].label} по месяцам`}
              </span>
            </div>
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
              {(Object.entries(REVENUE_MODES) as [keyof typeof REVENUE_MODES, typeof REVENUE_MODES[keyof typeof REVENUE_MODES]][]).map(([k, v]) => (
                <button key={k} onClick={() => setRevenueMode(k)}
                  className="px-2.5 py-1 text-[11px] font-semibold transition"
                  style={revenueMode === k ? { background: v.color, color: "#fff" } : { background: t.surface2, color: t.textMute }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          {merged.some(d => d.revenue > 0 || d.costs > 0 || d.profit !== 0) ? (
            <ResponsiveContainer width="100%" height={revenueMode === "all" ? 185 : 160}>
              <LineChart data={merged} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border2} />
                <XAxis dataKey="month" tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v/1000)}к`} />
                <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: t.text }}
                  formatter={(v: number) => v.toLocaleString("ru-RU") + " ₽"} cursor={{ stroke: t.border, strokeWidth: 1 }} />
                {(revenueMode === "revenue" || revenueMode === "all") && <Line key="rev" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={{ fill: "#10b981", r: 3, strokeWidth: 0 }} name="Выручка" />}
                {(revenueMode === "costs"   || revenueMode === "all") && <Line key="cos" type="monotone" dataKey="costs"   stroke="#ef4444" strokeWidth={2}   dot={{ fill: "#ef4444", r: 3, strokeWidth: 0 }} name="Затраты" strokeDasharray="4 2" />}
                {(revenueMode === "profit"  || revenueMode === "all") && <Line key="pro" type="monotone" dataKey="profit"  stroke="#f59e0b" strokeWidth={2}   dot={{ fill: "#f59e0b", r: 3, strokeWidth: 0 }} name="Прибыль" />}
                {revenueMode === "all" && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} formatter={v => <span style={{ color: t.textSub }}>{v}</span>} />}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: t.textMute }}>Нет данных — добавьте суммы договоров</div>
          )}
        </div>
      </div>

      {/* ── Строка 4: отказники + предстоящее ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Причины отказов */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-red-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Причины отказов</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-lg" style={{ color: t.textMute, background: t.surface2 }}>{stats.total_cancel} отказников</span>
          </div>
          {stats.cancel_reasons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8" style={{ color: t.textMute }}>
              <Icon name="ThumbsUp" size={28} className="mb-2 opacity-30" />
              <span className="text-sm">Отказов нет — отлично!</span>
              <span className="text-xs mt-1">Указывайте причину при смене статуса на «Отменён»</span>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.cancel_reasons.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-md bg-red-500/15 flex items-center justify-center text-[10px] font-bold text-red-400">{i+1}</div>
                  <span className="flex-1 text-sm" style={{ color: t.textSub }}>{r.reason}</span>
                  <span className="text-sm font-bold" style={{ color: t.text }}>{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Предстоящие события */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-amber-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Предстоящие события</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Замеров запланировано",  count: stats.upcoming_measures,  color: "#f59e0b", icon: "Ruler" },
              { label: "Монтажей запланировано", count: stats.upcoming_installs,  color: "#f97316", icon: "Wrench" },
            ].map(e => (
              <div key={e.label} className="rounded-xl p-4" style={{ background: e.color + "10" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: e.color + "20" }}>
                  <Icon name={e.icon} size={16} style={{ color: e.color }} />
                </div>
                <div className="text-2xl font-bold mb-0.5" style={{ color: t.text }}>{e.count}</div>
                <div className="text-xs" style={{ color: t.textMute }}>{e.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 grid grid-cols-2 gap-3 text-xs" style={{ borderTop: `1px solid ${t.border}` }}>
            <div>
              <div className="mb-0.5" style={{ color: t.textMute }}>Средняя площадь</div>
              <div className="font-bold" style={{ color: t.text }}>{stats.avg_area > 0 ? `${stats.avg_area} м²` : "—"}</div>
            </div>
            <div>
              <div className="mb-0.5" style={{ color: t.textMute }}>Средний договор</div>
              <div className="font-bold text-emerald-400">{stats.avg_contract > 0 ? `${stats.avg_contract.toLocaleString("ru-RU")} ₽` : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Последние заявки ── */}
      {recentClients.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-violet-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Последние заявки</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-lg" style={{ color: t.textMute, background: t.surface2 }}>нажми → открыть карточку</span>
          </div>
          <div className="divide-y" style={{ borderColor: t.border2 }}>
            {recentClients.map(c => (
              <button key={c.id} onClick={() => setDrawerClient(c)}
                className="w-full flex items-center gap-3 py-2.5 text-left transition hover:opacity-80 group">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: (STATUS_COLORS[c.status] || "#8b5cf6") + "25", color: STATUS_COLORS[c.status] || "#8b5cf6" }}>
                  {(c.client_name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                  <div className="text-xs truncate" style={{ color: t.textMute }}>{c.phone || "—"} · {c.address || "Адрес не указан"}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-lg flex-shrink-0"
                  style={{ background: (STATUS_COLORS[c.status] || "#8b5cf6") + "20", color: STATUS_COLORS[c.status] || "#8b5cf6" }}>
                  {STATUS_LABELS[c.status] || c.status}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: t.textMute }}>{c.created_at?.slice(0,10)}</span>
                <Icon name="ChevronRight" size={14} style={{ color: t.textMute }} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drawer клиента */}
      {drawerClient && (
        <ClientDrawer
          client={drawerClient}
          onClose={() => setDrawerClient(null)}
          onUpdated={() => {
            crmFetch("clients").then((d: Client[] | unknown) => {
              if (Array.isArray(d)) setRecentClients((d as Client[]).filter((c: Client) => c.status !== "deleted").slice(0, 8));
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