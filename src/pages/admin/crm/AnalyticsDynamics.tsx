import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Stats, FunnelMonth } from "./analyticsTypes";

interface MoneyMonth {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
}

type FunnelStep = "leads" | "measures" | "montages" | "done";

interface Props {
  s: Stats;
  moneyMonths: MoneyMonth[];
  /** Воронка по месяцам — заявки → замеры → монтажи → завершено. Не зависит от
   *  фильтра стадии в шапке, поэтому «Заявки» тут всегда весь поток обращений. */
  funnelMonths: FunnelMonth[];
}

const FUNNEL_STEPS: { id: FunnelStep; label: string; color: string }[] = [
  { id: "leads",    label: "Заявки",    color: "#8b5cf6" },
  { id: "measures", label: "Замеры",    color: "#f59e0b" },
  { id: "montages", label: "Монтажи",   color: "#06b6d4" },
  { id: "done",     label: "Завершено", color: "#10b981" },
];

export default function AnalyticsDynamics({ s, moneyMonths, funnelMonths }: Props) {
  const t = useTheme();

  const [activeSteps, setActiveSteps] = useState<FunnelStep[]>(["leads", "measures", "montages", "done"]);
  const [revenueMode, setRevenueMode] = useState<"revenue" | "costs" | "profit" | "all">("all");
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo,   setMonthTo]   = useState("");

  const toggleStep = (id: FunnelStep) => {
    setActiveSteps(prev => prev.includes(id)
      ? (prev.length > 1 ? prev.filter(s2 => s2 !== id) : prev) // хотя бы один ряд должен остаться включённым
      : [...prev, id]);
  };

  const funnel = funnelMonths.filter(d =>
    (!monthFrom || d.month >= monthFrom) &&
    (!monthTo   || d.month <= monthTo)
  );
  const merged = moneyMonths.filter(d =>
    (!monthFrom || d.month >= monthFrom) &&
    (!monthTo   || d.month <= monthTo)
  );

  const tooltipStyle = { backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 12 };
  const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    const idx = Number(mo) - 1;
    return idx >= 0 && idx < 12 ? `${MONTH_NAMES[idx]} ${y}` : m;
  };
  // Подсветка под курсором на графике — по умолчанию recharts рисует светло-серую
  // плашку, которая на тёмной теме выглядит как белая подложка. Делаем её едва заметной.
  const tooltipCursor = { fill: t.theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" };
  // Нативные поля даты браузер красит белым — colorScheme заставляет его учитывать тему.
  const dateInputStyle = {
    background: t.surface2,
    border: `1px solid ${t.border}`,
    color: t.textSub,
    colorScheme: t.theme,
  } as React.CSSProperties;

  return (
    <div className="space-y-5">

      {/* Графики */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Воронка по месяцам: заявки → замеры → монтажи → завершено */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-violet-500" />
              <span className="text-sm font-bold" style={{ color: t.text }}>Воронка по месяцам</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {FUNNEL_STEPS.map(step => {
                const on = activeSteps.includes(step.id);
                return (
                  <button key={step.id} onClick={() => toggleStep(step.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                    style={on ? { background: step.color, color: "#fff" } : { background: t.surface2, color: t.textMute }}>
                    {step.label}
                  </button>
                );
              })}
              <input type="month" value={monthFrom} onChange={e => setMonthFrom(e.target.value)}
                className="rounded-lg px-2 py-1 text-xs ml-2 focus:outline-none"
                style={dateInputStyle} />
              <span className="text-xs" style={{ color: t.textMute }}>—</span>
              <input type="month" value={monthTo} onChange={e => setMonthTo(e.target.value)}
                className="rounded-lg px-2 py-1 text-xs focus:outline-none"
                style={dateInputStyle} />
              {(monthFrom || monthTo) && (
                <button onClick={() => { setMonthFrom(""); setMonthTo(""); }}
                  className="px-2 py-1 rounded-lg text-xs transition"
                  style={{ background: t.surface2, color: t.textMute }}>×</button>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: t.textMute }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: t.textMute }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursor} labelFormatter={monthLabel}
                formatter={(v: number, name: string) => [`${v} шт.`, name]} />
              {FUNNEL_STEPS.filter(s2 => activeSteps.includes(s2.id)).map(step => (
                <Bar key={step.id} dataKey={step.id} name={step.label} fill={step.color} radius={[4, 4, 0, 0]} />
              ))}
              {activeSteps.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: t.textMute }} />}
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
              <YAxis tick={{ fontSize: 10, fill: t.textMute }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}к` : v} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: t.border, strokeWidth: 1 }} labelFormatter={monthLabel}
                formatter={(v: number, name: string) => [v.toLocaleString("ru-RU") + " ₽", name]} />
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
                    <div className="w-5 h-5 rounded-md bg-red-500/15 flex items-center justify-center text-[10px] font-bold text-red-400">{i + 1}</div>
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
  );
}