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

  useEffect(() => {
    crmFetch("stats").then(d => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-white/40">Загрузка...</div>;
  if (!stats) return null;

  const conversionRate = stats.total_clients > 0 ? Math.round((stats.done / stats.total_clients) * 100) : 0;
  const measureRate = stats.total_clients > 0
    ? Math.round(((stats.total_clients - stats.new_leads) / stats.total_clients) * 100) : 0;

  const pieData = stats.status_dist.map(s => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || "#666",
  }));

  const combined = stats.monthly_leads.map(m => {
    const done = stats.monthly_done.find(d => d.month === m.month);
    return { month: m.month, заявки: m.count, завершённые: done?.count || 0 };
  });

  const metricCards = [
    { label: "Конверсия в завершённые", value: `${conversionRate}%`, sub: "от общего числа заявок", color: "#10b981" },
    { label: "Дошли до замера", value: `${measureRate}%`, sub: "перешли дальше 'нового'", color: "#8b5cf6" },
    { label: "Предстоящих замеров", value: stats.upcoming_measures, sub: "запланировано", color: "#f59e0b" },
    { label: "Бюджет клиентов", value: stats.total_budget > 0 ? `${Math.round(stats.total_budget / 1000)}к ₽` : "—", sub: "суммарный", color: "#06b6d4" },
  ];

  return (
    <div className="space-y-6">
      {/* Метрики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(c => (
          <div key={c.label} className="bg-[#13131f] border border-white/10 rounded-xl p-5">
            <div className="text-2xl font-bold mb-1" style={{ color: c.color }}>{c.value}</div>
            <div className="text-sm font-medium text-white mb-0.5">{c.label}</div>
            <div className="text-xs text-white/40">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Распределение статусов */}
        <div className="bg-[#13131f] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-violet-500 rounded-full" />
            <span className="text-sm font-semibold text-white">Статусы клиентов</span>
          </div>
          <PieChart width={160} height={160}>
            <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
              {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
          </PieChart>
          <div className="mt-3 space-y-1.5">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-white/60">{d.name}</span>
                </div>
                <span className="text-white/80 font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="lg:col-span-2 bg-[#13131f] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-cyan-500 rounded-full" />
            <span className="text-sm font-semibold text-white">Заявки vs Завершённые</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={combined} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="month" tick={{ fill: "#ffffff44", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff44", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#fff" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#ffffff80" }} />
              <Bar dataKey="заявки" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="завершённые" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Линейный график */}
      <div className="bg-[#13131f] border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-emerald-500 rounded-full" />
          <span className="text-sm font-semibold text-white">Тенденция заявок (последние 6 мес.)</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={stats.monthly_leads} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="month" tick={{ fill: "#ffffff44", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#ffffff44", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#fff" }} />
            <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: "#06b6d4", r: 4 }} name="Заявок" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
