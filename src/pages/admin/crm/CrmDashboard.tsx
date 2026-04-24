import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid,
} from "recharts";
import Icon from "@/components/ui/icon";

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

const STAT_CARDS = [
  { key: "total_clients",     label: "Всего клиентов", icon: "Users",        color: "#8b5cf6", grad: "from-violet-600/20 to-transparent" },
  { key: "new_leads",         label: "Новые заявки",   icon: "UserPlus",     color: "#3b82f6", grad: "from-blue-600/20 to-transparent" },
  { key: "upcoming_measures", label: "Замеры скоро",   icon: "CalendarDays", color: "#f59e0b", grad: "from-amber-600/20 to-transparent" },
  { key: "done",              label: "Завершены",      icon: "CheckCircle2", color: "#10b981", grad: "from-emerald-600/20 to-transparent" },
];

export default function CrmDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { crmFetch("stats").then(d => { setStats(d); setLoading(false); }); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  const pieData = stats.status_dist.map(s => ({ name: STATUS_LABELS[s.status] || s.status, value: s.count, color: STATUS_COLORS[s.status] || "#555" }));

  return (
    <div className="space-y-5">
      {/* 4 метрики */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map(c => {
          const val = (stats as unknown as Record<string, number>)[c.key] ?? 0;
          return (
            <div key={c.key} className={`relative overflow-hidden bg-gradient-to-br ${c.grad} border border-white/10 rounded-2xl p-5`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.color + "25" }}>
                  <Icon name={c.icon} size={20} style={{ color: c.color }} />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">↑ 5%</span>
              </div>
              <div className="text-white/40 text-xs mb-1">{c.label}</div>
              <div className="text-3xl font-bold text-white">{val.toLocaleString("ru-RU")}</div>
              <div className="absolute -bottom-5 -right-5 w-24 h-24 rounded-full opacity-[0.07]" style={{ background: c.color }} />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Donut */}
        <div className="lg:col-span-2 bg-[#0e0e1c] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-4 rounded-full bg-violet-500" />
            <span className="text-sm font-bold text-white">Статусы клиентов</span>
          </div>
          <div className="flex gap-4 items-center">
            <PieChart width={130} height={130}>
              <Pie data={pieData} cx={60} cy={60} innerRadius={38} outerRadius={60} dataKey="value" strokeWidth={2} stroke="#0e0e1c">
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            <div className="flex-1 space-y-2">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2 group">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-white/50 flex-1 truncate">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div className="h-full rounded-full" style={{ background: d.color, width: `${stats.total_clients > 0 ? (d.value / stats.total_clients) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-bold text-white/60 w-4 text-right">{d.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Бар */}
        <div className="lg:col-span-3 bg-[#0e0e1c] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-4 rounded-full bg-blue-500" />
            <span className="text-sm font-bold text-white">Заявки по месяцам</span>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={stats.monthly_leads} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="bgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: "#ffffff25", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff25", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#15152a", border: "1px solid #ffffff10", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#a78bfa" }} />
              <Bar dataKey="count" fill="url(#bgrad)" radius={[6, 6, 0, 0]} name="Заявки" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Линия + Метрики */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#0e0e1c] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-white">Динамика (6 мес.)</span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={stats.monthly_leads} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
              <XAxis dataKey="month" tick={{ fill: "#ffffff25", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff25", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#15152a", border: "1px solid #ffffff10", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#fff" }} />
              <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: "#06b6d4", r: 4, strokeWidth: 0 }} name="Заявок" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0e0e1c] border border-white/8 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full bg-amber-500" />
            <span className="text-sm font-bold text-white">Метрики роста</span>
          </div>
          {[
            { label: "Конверсия",    val: stats.total_clients > 0 ? `${Math.round((stats.done / stats.total_clients) * 100)}%` : "0%", color: "#10b981", change: "+5.7%" },
            { label: "До замера",    val: stats.total_clients > 0 ? `${Math.round(((stats.total_clients - stats.new_leads) / stats.total_clients) * 100)}%` : "0%", color: "#f59e0b", change: "+11%" },
            { label: "Сред. бюджет", val: stats.total_budget > 0 ? `${Math.round(stats.total_budget / Math.max(stats.total_clients, 1)).toLocaleString("ru-RU")} ₽` : "—", color: "#8b5cf6", change: "+18%" },
          ].map(m => (
            <div key={m.label} className="rounded-xl px-4 py-3 flex justify-between items-center" style={{ background: m.color + "12" }}>
              <div>
                <div className="text-[10px] text-white/40 mb-0.5">{m.label}</div>
                <div className="text-lg font-bold" style={{ color: m.color }}>{m.val}</div>
              </div>
              <span className="text-xs font-semibold text-emerald-400">{m.change}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
