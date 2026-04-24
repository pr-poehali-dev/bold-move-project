import { useEffect, useState } from "react";
import { crmFetch } from "./crmApi";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from "recharts";
import Icon from "@/components/ui/icon";

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
  monthly_leads: { month: string; count: number }[];
  monthly_done: { month: string; count: number }[];
  monthly_revenue: { month: string; revenue: number }[];
}

function Money({ val, color = "text-white" }: { val: number; color?: string }) {
  return <span className={color}>{val > 0 ? val.toLocaleString("ru-RU") + " ₽" : "—"}</span>;
}

function StatCard({ icon, label, value, sub, color, grad }: {
  icon: string; label: string; value: string | number; sub?: string; color: string; grad: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${grad} border border-white/[0.05] rounded-2xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + "20" }}>
          <Icon name={icon} size={19} style={{ color }} />
        </div>
      </div>
      <div className="text-white/35 text-xs mb-0.5">{label}</div>
      <div className="text-2xl font-bold text-white">{typeof value === "number" ? value.toLocaleString("ru-RU") : value}</div>
      {sub && <div className="text-xs text-white/25 mt-0.5">{sub}</div>}
      <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.07]" style={{ background: color }} />
    </div>
  );
}

export default function CrmDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { crmFetch("stats").then(d => { setStats(d); setLoading(false); }); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  const convMeasure = stats.total_all > 0 ? Math.round((stats.went_measure / stats.total_all) * 100) : 0;
  const convContract = stats.went_measure > 0 ? Math.round((stats.went_contract / stats.went_measure) * 100) : 0;
  const convDone = stats.went_contract > 0 ? Math.round((stats.total_done / stats.went_contract) * 100) : 0;

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
        <div className="bg-[#0a0a16] border border-white/[0.05] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-white">Финансовая сводка</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Сумма договоров",   val: stats.total_contract,   color: "text-white" },
              { label: "Получено (предоплата+доплата)", val: stats.total_received, color: "text-emerald-400" },
              { label: "Стоимость материалов", val: stats.total_material, color: "text-red-400" },
              { label: "Стоимость замеров",   val: stats.total_measure_cost, color: "text-red-400/70" },
              { label: "Стоимость монтажей",  val: stats.total_install_cost, color: "text-red-400/70" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                <span className="text-xs text-white/40">{r.label}</span>
                <Money val={r.val} color={r.color} />
              </div>
            ))}
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-bold text-white">Прибыль</span>
              <span className={`text-lg font-bold ${stats.total_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats.total_profit >= 0 ? "+" : ""}{stats.total_profit.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        </div>

        {/* Воронка */}
        <div className="bg-[#0a0a16] border border-white/[0.05] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-violet-500" />
            <span className="text-sm font-bold text-white">Воронка продаж</span>
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
                  <span className="text-white/50">{f.label}</span>
                  <span className="font-semibold text-white/80">{f.count} <span className="text-white/30">({f.pct}%)</span></span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${f.pct}%`, background: f.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Себестоимость pie-like */}
        <div className="bg-[#0a0a16] border border-white/[0.05] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-red-500" />
            <span className="text-sm font-bold text-white">Себестоимость</span>
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
                      <span className="text-white/50">{c.label}</span>
                      <span className="text-white/70">{c.val > 0 ? c.val.toLocaleString("ru-RU") + " ₽" : "—"}</span>
                    </div>
                    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-white/[0.05]">
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Итого затраты</span>
                <span className="text-sm font-bold text-red-400">{stats.total_costs > 0 ? stats.total_costs.toLocaleString("ru-RU") + " ₽" : "—"}</span>
              </div>
              {stats.avg_contract > 0 && (
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-white/40">Средний чек</span>
                  <span className="text-sm font-bold text-white">{stats.avg_contract.toLocaleString("ru-RU")} ₽</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Строка 3: графики ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Заявки по месяцам */}
        <div className="bg-[#0a0a16] border border-white/[0.05] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-violet-500" />
            <span className="text-sm font-bold text-white">Динамика заявок</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stats.monthly_leads} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#4f46e5" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: "#ffffff20", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff20", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0e0e1c", border: "1px solid #ffffff10", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#a78bfa" }} />
              <Bar dataKey="count" fill="url(#bg1)" radius={[5, 5, 0, 0]} name="Заявок" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Выручка по месяцам */}
        <div className="bg-[#0a0a16] border border-white/[0.05] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-white">Выручка по месяцам</span>
          </div>
          {stats.monthly_revenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={stats.monthly_revenue} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                <XAxis dataKey="month" tick={{ fill: "#ffffff20", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#ffffff20", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v/1000)}к`} />
                <Tooltip contentStyle={{ background: "#0e0e1c", border: "1px solid #ffffff10", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#fff" }} formatter={(v: number) => [v.toLocaleString("ru-RU") + " ₽", "Выручка"]} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={{ fill: "#10b981", r: 4, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-white/20 text-sm">Нет данных — добавьте суммы договоров</div>
          )}
        </div>
      </div>

      {/* ── Строка 4: отказники + предстоящее ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Причины отказов */}
        <div className="bg-[#0a0a16] border border-white/[0.05] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-red-500" />
            <span className="text-sm font-bold text-white">Причины отказов</span>
            <span className="ml-auto text-xs text-white/25 bg-white/[0.05] px-2 py-0.5 rounded-lg">{stats.total_cancel} отказников</span>
          </div>
          {stats.cancel_reasons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-white/20">
              <Icon name="ThumbsUp" size={28} className="mb-2 opacity-30" />
              <span className="text-sm">Отказов нет — отлично!</span>
              <span className="text-xs mt-1">Указывайте причину при смене статуса на «Отменён»</span>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.cancel_reasons.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-md bg-red-500/15 flex items-center justify-center text-[10px] font-bold text-red-400">{i+1}</div>
                  <span className="flex-1 text-sm text-white/60">{r.reason}</span>
                  <span className="text-sm font-bold text-white/80">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Предстоящие события */}
        <div className="bg-[#0a0a16] border border-white/[0.05] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-amber-500" />
            <span className="text-sm font-bold text-white">Предстоящие события</span>
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
                <div className="text-2xl font-bold text-white mb-0.5">{e.count}</div>
                <div className="text-xs text-white/40">{e.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-white/30 mb-0.5">Средняя площадь</div>
              <div className="font-bold text-white">{stats.avg_area > 0 ? `${stats.avg_area} м²` : "—"}</div>
            </div>
            <div>
              <div className="text-white/30 mb-0.5">Средний договор</div>
              <div className="font-bold text-emerald-400">{stats.avg_contract > 0 ? `${stats.avg_contract.toLocaleString("ru-RU")} ₽` : "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
