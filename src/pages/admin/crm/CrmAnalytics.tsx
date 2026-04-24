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
  monthly_leads: { month: string; count: number }[];
  monthly_done: { month: string; count: number }[];
  monthly_revenue: { month: string; revenue: number }[];
}

const COST_COLORS = ["#ef4444", "#f59e0b", "#f97316"];

export default function CrmAnalytics() {
  const t = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { crmFetch("stats").then(d => { setStats(d); setLoading(false); }); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  const convMeasure  = stats.total_all > 0      ? Math.round((stats.went_measure  / stats.total_all)      * 100) : 0;
  const convContract = stats.went_measure > 0   ? Math.round((stats.went_contract / stats.went_measure)   * 100) : 0;
  const convDone     = stats.went_contract > 0  ? Math.round((stats.total_done    / stats.went_contract)  * 100) : 0;
  const cancelRate   = stats.total_all > 0      ? Math.round((stats.total_cancel  / stats.total_all)      * 100) : 0;

  const statusPie = stats.status_dist
    .filter(s => s.status !== "deleted")
    .map(s => ({ name: STATUS_LABELS[s.status] || s.status, value: s.count, color: STATUS_COLORS[s.status] || "#666" }));

  const costPie = [
    { name: "Материалы",  value: stats.total_material,     color: "#ef4444" },
    { name: "Замеры",     value: stats.total_measure_cost, color: "#f59e0b" },
    { name: "Монтажи",    value: stats.total_install_cost, color: "#f97316" },
  ].filter(c => c.value > 0);

  const combined = stats.monthly_leads.map(m => {
    const d = stats.monthly_done.find(x => x.month === m.month);
    return { month: m.month, "Заявки": m.count, "Завершённые": d?.count || 0 };
  });

  const marginData = stats.monthly_revenue.map(m => {
    const totalCosts = stats.total_costs;
    const perMonth = stats.monthly_revenue.length > 0 ? totalCosts / stats.monthly_revenue.length : 0;
    return { month: m.month, "Выручка": m.revenue, "Затраты": Math.round(perMonth), "Прибыль": Math.max(0, m.revenue - perMonth) };
  });

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
        {/* Заявки vs завершённые */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-violet-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Заявки vs Завершённые</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={combined} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border2} />
              <XAxis dataKey="month" tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: t.text }} />
              <Legend wrapperStyle={{ fontSize: 11, color: t.textSub, paddingTop: 6 }} />
              <Bar dataKey="Заявки"      fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Завершённые" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Выручка и затраты */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Выручка / Затраты / Прибыль</span>
          </div>
          {marginData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={marginData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border2} />
                <XAxis dataKey="month" tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: t.textMute, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v/1000)}к`} />
                <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: t.text }} formatter={(v: number) => v.toLocaleString("ru-RU") + " ₽"} />
                <Legend wrapperStyle={{ fontSize: 11, color: t.textSub, paddingTop: 6 }} />
                <Line type="monotone" dataKey="Выручка"  stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }} />
                <Line type="monotone" dataKey="Затраты"  stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="Прибыль"  stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: "#06b6d4", strokeWidth: 0 }} />
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
