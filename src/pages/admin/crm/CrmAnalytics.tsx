import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from "recharts";

interface Stats {
  total_clients: number;
  done: number;
  upcoming_measures: number;
  new_leads: number;
  total_budget: number;
  status_dist: { status: string; count: number }[];
  monthly_leads: { month: string; count: number }[];
  monthly_done: { month: string; count: number }[];
}

export default function CrmAnalytics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { crmFetch("stats").then(d => { setStats(d); setLoading(false); }); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  const convRate = stats.total_clients > 0 ? Math.round((stats.done / stats.total_clients) * 100) : 0;
  const measureRate = stats.total_clients > 0 ? Math.round(((stats.total_clients - stats.new_leads) / stats.total_clients) * 100) : 0;
  const avgBudget = stats.total_budget > 0 ? Math.round(stats.total_budget / Math.max(stats.total_clients, 1)) : 0;

  const pieData = stats.status_dist.map(s => ({ name: STATUS_LABELS[s.status] || s.status, value: s.count, color: STATUS_COLORS[s.status] || "#555" }));

  const combined = stats.monthly_leads.map(m => {
    const done = stats.monthly_done.find(d => d.month === m.month);
    return { month: m.month, "Заявки": m.count, "Завершённые": done?.count || 0 };
  });

  const metricCards = [
    { label: "Всего выручка", val: stats.total_budget > 0 ? `${stats.total_budget.toLocaleString("ru-RU")} ₽` : "—", icon: "DollarSign", color: "#10b981", change: "+12.5%" },
    { label: "Средний чек", val: avgBudget > 0 ? `${avgBudget.toLocaleString("ru-RU")} ₽` : "—", icon: "ShoppingBag", color: "#3b82f6", change: "+8.2%" },
    { label: "Всего клиентов", val: stats.total_clients, icon: "Users", color: "#8b5cf6", change: "+5.7%" },
    { label: "VIP (> 50к ₽)", val: 0, icon: "Star", color: "#f59e0b", change: "+3.1%" },
  ];

  return (
    <div className="space-y-5">
      {/* 4 карточки */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metricCards.map(c => (
          <div key={c.label} className="bg-[#0e0e1c] border border-white/8 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.color + "20" }}>
                <span style={{ color: c.color }}>
                  {c.icon === "DollarSign" && "$"}
                  {c.icon === "ShoppingBag" && "🛍"}
                  {c.icon === "Users" && "👥"}
                  {c.icon === "Star" && "⭐"}
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">↑ {c.change}</span>
            </div>
            <div className="text-white/40 text-xs mb-0.5">{c.label}</div>
            <div className="text-2xl font-bold text-white">{typeof c.val === "number" ? c.val.toLocaleString("ru-RU") : c.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut */}
        <div className="bg-[#0e0e1c] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-4 rounded-full bg-violet-500" />
            <span className="text-sm font-bold text-white">Статусы клиентов</span>
          </div>
          <div className="flex justify-center mb-4">
            <PieChart width={150} height={150}>
              <Pie data={pieData} cx={70} cy={70} innerRadius={42} outerRadius={68} dataKey="value" strokeWidth={2} stroke="#0e0e1c">
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm" style={{ background: d.color }} />
                  <span className="text-white/50">{d.name}</span>
                </div>
                <span className="text-white/70 font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar сравнение */}
        <div className="lg:col-span-2 bg-[#0e0e1c] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-4 rounded-full bg-cyan-500" />
            <span className="text-sm font-bold text-white">Заявки vs Завершённые</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={combined} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
              <XAxis dataKey="month" tick={{ fill: "#ffffff25", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff25", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#15152a", border: "1px solid #ffffff10", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#fff" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#ffffff60", paddingTop: 8 }} />
              <Bar dataKey="Заявки" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Завершённые" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Метрики роста + тренд */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Рост */}
        <div className="bg-[#0e0e1c] border border-white/8 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full bg-amber-500" />
            <span className="text-sm font-bold text-white">Метрики роста</span>
          </div>
          {[
            { label: "VIP конверсия",  val: `${convRate}%`,    color: "#f59e0b", change: "+5.7%", bg: "bg-amber-500/10" },
            { label: "Успешность",     val: `${measureRate}%`, color: "#10b981", change: "+11%",  bg: "bg-emerald-500/10" },
            { label: "Средний чек",    val: avgBudget > 0 ? `${avgBudget.toLocaleString("ru-RU")} ₽` : "—", color: "#8b5cf6", change: "+18%", bg: "bg-violet-500/10" },
          ].map(m => (
            <div key={m.label} className={`${m.bg} rounded-xl px-4 py-3 flex justify-between items-center`}>
              <div>
                <div className="text-[10px] text-white/35 mb-0.5">{m.label}</div>
                <div className="text-xl font-bold" style={{ color: m.color }}>{m.val}</div>
              </div>
              <span className="text-xs font-semibold text-emerald-400">{m.change}</span>
            </div>
          ))}
        </div>

        {/* Активные / VIP / Не активные */}
        <div className="bg-[#0e0e1c] border border-white/8 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full bg-blue-500" />
            <span className="text-sm font-bold text-white">Сегменты клиентов</span>
          </div>
          {[
            { label: "Активные клиенты", val: stats.total_clients - stats.new_leads - stats.done, color: "#10b981", icon: "👤" },
            { label: "Новые заявки",     val: stats.new_leads,   color: "#f59e0b", icon: "⭐" },
            { label: "Завершённые",      val: stats.done,        color: "#6b7280", icon: "👤" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg">{s.icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-white/50">{s.label}</span>
                  <span className="text-sm font-bold text-white">{Math.max(s.val, 0)}</span>
                </div>
                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ background: s.color, width: `${stats.total_clients > 0 ? (Math.max(s.val, 0) / stats.total_clients) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Линейный тренд */}
        <div className="bg-[#0e0e1c] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-white">Динамика выручки</span>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={stats.monthly_leads} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
              <XAxis dataKey="month" tick={{ fill: "#ffffff25", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff25", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#15152a", border: "1px solid #ffffff10", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#fff" }} />
              <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: "#06b6d4", r: 3, strokeWidth: 0 }} name="Заявок" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
