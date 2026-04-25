import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import { Stats } from "./analyticsTypes";

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

interface Props {
  s: Stats;
  convMeasure: number;
  convContract: number;
  convDone: number;
  cancelRate: number;
  funnelData: { label: string; count: number; color: string; pct: number }[];
  statusPie: { name: string; value: number; color: string }[];
  recentClients: Client[];
  onSelectClient: (c: Client) => void;
}

export default function AnalyticsOverview({ s, convMeasure, convContract, convDone, cancelRate, funnelData, statusPie, recentClients, onSelectClient }: Props) {
  const t = useTheme();
  const tooltipStyle = { backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 12 };

  return (
    <div className="space-y-5">

      {/* KPI — счётчики */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon="Users"        label="Всего заявок"      value={s.total_all}          sub={`${s.total_leads} лидов · ${s.total_orders} заказов`} color="#8b5cf6" />
        <KpiCard icon="CalendarDays" label="Замеров предстоит" value={s.upcoming_measures}  sub={`${s.upcoming_installs} монтажей скоро`} color="#f59e0b" />
        <KpiCard icon="FileText"     label="Договоров"         value={s.went_contract}      sub={`${convContract}% от замеров`} color="#06b6d4" />
        <KpiCard icon="CheckCircle2" label="Завершено"         value={s.total_done}         sub={`${s.total_cancel} отказов`} color="#10b981" />
      </div>

      {/* KPI — конверсии */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon="TrendingUp"    label="Конверсия в замер"  value={`${convMeasure}%`}  sub={`${s.went_measure} из ${s.total_all}`}    color="#f59e0b" />
        <KpiCard icon="FileSignature" label="Замер → договор"    value={`${convContract}%`} sub={`${s.went_contract} из ${s.went_measure}`} color="#06b6d4" />
        <KpiCard icon="CheckCircle2"  label="Договор → завершён" value={`${convDone}%`}     sub={`${s.total_done} завершено`}              color="#10b981" />
        <KpiCard icon="XCircle"       label="Процент отказов"    value={`${cancelRate}%`}   sub={`${s.total_cancel} отказников`}           color="#ef4444" />
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
                <button key={c.id} onClick={() => onSelectClient(c)}
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
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: t.textMute }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: t.textMute }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Клиентов"]} />
              <Bar dataKey="value" name="Клиентов" radius={[4, 4, 0, 0]}>
                {statusPie.map((sp, i) => <Cell key={i} fill={sp.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
