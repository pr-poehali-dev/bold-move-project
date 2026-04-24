import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface Stats {
  total_all: number; total_leads: number; total_orders: number;
  total_done: number; total_cancel: number;
  went_measure: number; went_contract: number;
  total_contract: number; total_received: number;
  total_material: number; total_measure_cost: number; total_install_cost: number;
  total_costs: number; total_profit: number;
  avg_area: number; avg_contract: number;
  cancel_reasons: { reason: string; count: number }[];
  status_dist: { status: string; count: number }[];
  monthly_leads:   { month: string; count: number }[];
  monthly_done:    { month: string; count: number }[];
  monthly_revenue: { month: string; revenue: number }[];
  monthly_costs:   { month: string; costs: number }[];
  monthly_profit:  { month: string; profit: number }[];
}

const COST_COLORS = ["#ef4444", "#f59e0b", "#f97316"];

export default function CrmAnalytics() {
  const t = useTheme();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Переключатели
  const [leadsMode,   setLeadsMode]   = useState<"leads" | "done" | "both">("both");
  const [revenueMode, setRevenueMode] = useState<"revenue" | "costs" | "profit" | "all">("all");

  // Фильтр месяцев
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo,   setMonthTo]   = useState("");

  useEffect(() => { crmFetch("stats").then(d => { setStats(d); setLoading(false); }); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  const convMeasure  = stats.total_all     > 0 ? Math.round((stats.went_measure  / stats.total_all)     * 100) : 0;
  const convContract = stats.went_measure  > 0 ? Math.round((stats.went_contract / stats.went_measure)  * 100) : 0;
  const convDone     = stats.went_contract > 0 ? Math.round((stats.total_done    / stats.went_contract) * 100) : 0;
  const cancelRate   = stats.total_all     > 0 ? Math.round((stats.total_cancel  / stats.total_all)     * 100) : 0;

  const statusPie = stats.status_dist
    .filter(s => s.status !== "deleted")
    .map(s => ({ name: STATUS_LABELS[s.status] || s.status, value: s.count, color: STATUS_COLORS[s.status] || "#666" }));

  const costPie = [
    { name: "Материалы", value: stats.total_material,     color: "#ef4444" },
    { name: "Замеры",    value: stats.total_measure_cost, color: "#f59e0b" },
    { name: "Монтажи",   value: stats.total_install_cost, color: "#f97316" },
  ].filter(c => c.value > 0);

  // Объединяем все месячные данные в один массив
  const allMonths = Array.from(new Set([
    ...stats.monthly_leads.map(d => d.month),
    ...stats.monthly_done.map(d => d.month),
    ...stats.monthly_revenue.map(d => d.month),
    ...(stats.monthly_costs  || []).map(d => d.month),
    ...(stats.monthly_profit || []).map(d => d.month),
  ])).sort();

  const allMerged = allMonths.map(m => ({
    month:   m,
    leads:   stats.monthly_leads.find(d => d.month === m)?.count ?? 0,
    done:    stats.monthly_done.find(d => d.month === m)?.count  ?? 0,
    revenue: stats.monthly_revenue.find(d => d.month === m)?.revenue ?? 0,
    costs:   (stats.monthly_costs  || []).find(d => d.month === m)?.costs  ?? 0,
    profit:  (stats.monthly_profit || []).find(d => d.month === m)?.profit ?? 0,
  }));

  const merged = allMerged.filter(d =>
    (!monthFrom || d.month >= monthFrom) &&
    (!monthTo   || d.month <= monthTo)
  );

  const LEADS_MODES   = {
    leads: { label: "Заявки",      color: "#8b5cf6" },
    done:  { label: "Завершённые", color: "#10b981" },
    both:  { label: "Оба",         color: "#8b5cf6" },
  } as const;
  const REVENUE_MODES = {
    revenue: { label: "Выручка",  color: "#10b981" },
    costs:   { label: "Затраты",  color: "#ef4444" },
    profit:  { label: "Прибыль",  color: "#f59e0b" },
    all:     { label: "Все",      color: "#10b981" },
  } as const;

  return (
    <div className="space-y-5">

      {/* ── KPI карточки ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Конверсия в замер",    val: `${convMeasure}%`,   sub: `${stats.went_measure} из ${stats.total_all}`,    color: "#f59e0b", icon: "TrendingUp" },
          { label: "Замер → договор",      val: `${convContract}%`,  sub: `${stats.went_contract} из ${stats.went_measure}`, color: "#06b6d4", icon: "FileSignature" },
          { label: "Договор → завершён",   val: `${convDone}%`,      sub: `${stats.total_done} завершено`,                   color: "#10b981", icon: "CheckCircle2" },
          { label: "Процент отказов",      val: `${cancelRate}%`,    sub: `${stats.total_cancel} отказников`,               color: "#ef4444", icon: "XCircle" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.color + "18" }}>
                <Icon name={c.icon} size={17} style={{ color: c.color }} />
              </div>
            </div>
            <div className="text-xs mb-0.5" style={{ color: t.textMute }}>{c.label}</div>
            <div className="text-2xl font-bold" style={{ color: c.color }}>{c.val}</div>
            <div className="text-xs mt-0.5" style={{ color: t.textMute }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Финансы ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* P&L */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>P&L (доходы / расходы)</span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Сумма договоров",     val: stats.total_contract,     color: "text-white",      sign: "" },
              { label: "Получено",            val: stats.total_received,     color: "text-emerald-400", sign: "+" },
              { label: "Материалы (расход)",  val: -stats.total_material,    color: "text-red-400",    sign: "−" },
              { label: "Замеры (расход)",     val: -stats.total_measure_cost,color: "text-red-400/70", sign: "−" },
              { label: "Монтажи (расход)",    val: -stats.total_install_cost,color: "text-red-400/70", sign: "−" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center text-sm pb-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
                <span style={{ color: t.textMute }}>{r.label}</span>
                <span className={`font-semibold ${r.color}`}>
                  {Math.abs(r.val) > 0 ? `${r.sign}${Math.abs(r.val).toLocaleString("ru-RU")} ₽` : "—"}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-1">
              <span className="text-sm font-bold" style={{ color: t.text }}>Прибыль</span>
              <span className={`text-xl font-bold ${stats.total_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats.total_profit >= 0 ? "+" : ""}{stats.total_profit.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        </div>

        {/* Donut себестоимость */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-red-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Структура затрат</span>
          </div>
          {costPie.length > 0 ? (
            <>
              <div className="flex justify-center mb-3">
                <PieChart width={140} height={140}>
                  <Pie data={costPie} cx={65} cy={65} innerRadius={38} outerRadius={62} dataKey="value" strokeWidth={2} stroke={t.surface}>
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
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm flex-col gap-2" style={{ color: t.textMute }}>
              <Icon name="PieChart" size={28} className="opacity-20" />
              <span>Нет данных по затратам</span>
              <span className="text-xs">Заполните стоимость материалов, замеров, монтажей в карточках</span>
            </div>
          )}
        </div>

        {/* Donut статусы */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-violet-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Статусы клиентов</span>
          </div>
          <div className="flex justify-center mb-3">
            <PieChart width={140} height={140}>
              <Pie data={statusPie} cx={65} cy={65} innerRadius={38} outerRadius={62} dataKey="value" strokeWidth={2} stroke={t.surface}>
                {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-1.5">
            {statusPie.map(s => (
              <div key={s.name} className="flex justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                  <span style={{ color: t.textSub }}>{s.name}</span>
                </div>
                <span className="font-semibold" style={{ color: t.text }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Динамика ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── График 1: Заявки / Завершённые / Оба ── */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: LEADS_MODES[leadsMode].color }} />
              <span className="text-sm font-bold" style={{ color: t.text }}>
                {leadsMode === "both" ? "Заявки vs Завершённые" : LEADS_MODES[leadsMode].label}
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
                  className="px-1.5 py-1 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
                  <Icon name="X" size={10} />
                </button>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={leadsMode === "both" ? 200 : 180}>
            <BarChart data={merged} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} barCategoryGap="20%">
              <defs>
                <linearGradient id="aGradLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#4f46e5" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="aGradDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border2} />
              <XAxis dataKey="month" tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: t.text }} cursor={false} />
              {leadsMode !== "done"  && <Bar dataKey="leads" fill="url(#aGradLeads)" radius={[4,4,0,0]} name="Заявки"      activeBar={{ fill: "url(#aGradLeads)", opacity: 0.85 }} />}
              {leadsMode !== "leads" && <Bar dataKey="done"  fill="url(#aGradDone)"  radius={[4,4,0,0]} name="Завершённые" activeBar={{ fill: "url(#aGradDone)",  opacity: 0.85 }} />}
              {leadsMode === "both"  && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} formatter={v => <span style={{ color: t.textSub }}>{v}</span>} />}
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
            <ResponsiveContainer width="100%" height={revenueMode === "all" ? 200 : 180}>
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
            <div className="flex items-center justify-center h-44 text-sm" style={{ color: t.textMute }}>Нет данных — добавьте суммы договоров и затраты</div>
          )}
        </div>
      </div>

      {/* ── Причины отказов ── */}
      <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full bg-red-500" />
          <span className="text-sm font-bold" style={{ color: t.text }}>Детализация отказов</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-lg" style={{ color: t.textMute, background: t.surface2 }}>
            {stats.total_cancel} отказников из {stats.total_all} заявок ({cancelRate}%)
          </span>
        </div>
        {stats.cancel_reasons.length === 0 ? (
          <div className="flex items-center justify-center py-6 gap-3" style={{ color: t.textMute }}>
            <Icon name="ThumbsUp" size={22} className="opacity-40" />
            <div>
              <div className="text-sm">Причин отказов нет</div>
              <div className="text-xs mt-0.5">При переводе клиента в статус «Отменён» — указывайте причину в карточке</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.cancel_reasons.map((r, i) => {
              const pct = stats.total_cancel > 0 ? Math.round((r.count / stats.total_cancel) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background: t.surface2 }}>
                  <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center text-[10px] font-bold text-red-400 flex-shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm truncate" style={{ color: t.textSub }}>{r.reason}</span>
                      <span className="text-xs font-bold ml-2" style={{ color: t.textSub }}>{r.count} ({pct}%)</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: t.border }}>
                      <div className="h-full rounded-full bg-red-500/60" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}