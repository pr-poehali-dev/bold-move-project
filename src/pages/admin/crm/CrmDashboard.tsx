import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, fmt } from "./crmApi";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
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

export default function CrmDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmFetch("stats").then(d => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-white/40">Загрузка...</div>;
  if (!stats) return null;

  const statCards = [
    { label: "Всего клиентов", value: stats.total_clients, icon: "Users", color: "#8b5cf6", change: "+5.7%" },
    { label: "Новые заявки", value: stats.new_leads, icon: "UserPlus", color: "#3b82f6", change: "+12.5%" },
    { label: "Замеры предстоят", value: stats.upcoming_measures, icon: "Calendar", color: "#f59e0b", change: "+8.2%" },
    { label: "Завершённые", value: stats.done, icon: "CheckCircle", color: "#10b981", change: "+3.1%" },
  ];

  const pieData = stats.status_dist.map(s => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || "#666",
  }));

  return (
    <div className="space-y-6">
      {/* Карточки */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => (
          <div key={c.label} className="bg-[#13131f] border border-white/10 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.color + "33" }}>
                <Icon name={c.icon} size={20} style={{ color: c.color }} />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">{c.change}</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{c.value}</div>
            <div className="text-xs text-white/40">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Распределение по статусам */}
        <div className="bg-[#13131f] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-violet-500 rounded-full" />
            <span className="text-sm font-semibold text-white">Распределение по статусам</span>
          </div>
          <div className="flex items-center gap-6">
            <PieChart width={130} height={130}>
              <Pie data={pieData} cx={60} cy={60} innerRadius={38} outerRadius={60} dataKey="value" strokeWidth={0}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <div className="flex-1 space-y-2">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs text-white/60">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ background: d.color, width: `${(d.value / Math.max(stats.total_clients, 1)) * 100}%` }} />
                    </div>
                    <span className="text-xs text-white/40 w-6 text-right">{d.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Динамика заявок */}
        <div className="bg-[#13131f] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-cyan-500 rounded-full" />
            <span className="text-sm font-semibold text-white">Новые клиенты по месяцам</span>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={stats.monthly_leads} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: "#ffffff44", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff44", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#a78bfa" }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Заявки" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* График по месяцам */}
      {stats.monthly_leads.length > 0 && (
        <div className="bg-[#13131f] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-emerald-500 rounded-full" />
            <span className="text-sm font-semibold text-white">Динамика (последние 6 месяцев)</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={stats.monthly_leads} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" tick={{ fill: "#ffffff44", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff44", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#fff" }}
              />
              <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 4 }} name="Заявок" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
