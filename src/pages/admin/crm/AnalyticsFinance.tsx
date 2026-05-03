import { PieChart, Pie, Cell } from "recharts";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
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
  costPie: { name: string; value: number; color: string }[];
}

export default function AnalyticsFinance({ s, costPie }: Props) {
  const t = useTheme();

  return (
    <div className="space-y-5">

      {/* Финансовые KPI */}
      {(() => {
        const income = s.total_contract; // доход = сумма договоров
        const margin = income > 0 ? Math.round((s.total_profit / income) * 100) : 0;
        return (
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <KpiCard icon="Banknote"   label="Сумма договоров" value={s.total_contract > 0 ? s.total_contract.toLocaleString("ru-RU") + " ₽" : "—"} color="#10b981" />
            <KpiCard icon="Wallet"     label="Получено"        value={s.total_received > 0 ? s.total_received.toLocaleString("ru-RU") + " ₽" : "—"} sub="все платежи" color="#06b6d4" />
            <KpiCard icon="Receipt"    label="Все затраты"     value={s.total_costs > 0 ? s.total_costs.toLocaleString("ru-RU") + " ₽" : "—"} color="#ef4444" />
            <KpiCard icon="TrendingUp" label="Прибыль"         value={s.total_profit !== 0 ? (s.total_profit > 0 ? "+" : "") + s.total_profit.toLocaleString("ru-RU") + " ₽" : "—"} color={s.total_profit >= 0 ? "#10b981" : "#ef4444"} />
            <KpiCard icon="Percent"    label="Маржа"           value={income > 0 ? `${margin}%` : "—"} sub="прибыль / доходы" color={margin >= 30 ? "#a78bfa" : margin >= 0 ? "#f59e0b" : "#ef4444"} />
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* P&L */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>P&L (доходы / расходы)</span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Сумма договоров",    val: s.total_contract,     cls: "font-semibold text-white",        neg: false },
              { label: "Получено",           val: s.total_received,     cls: "font-semibold text-emerald-400",  neg: false },
              { label: "Материалы (расход)", val: s.total_material,     cls: "font-semibold text-red-400",      neg: true },
              { label: "Замеры (расход)",    val: s.total_measure_cost, cls: "font-semibold text-red-400/70",   neg: true },
              { label: "Монтажи (расход)",   val: s.total_install_cost, cls: "font-semibold text-red-400/70",   neg: true },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center text-sm pb-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
                <span style={{ color: t.textMute }}>{r.label}</span>
                <span className={r.cls}>
                  {r.val > 0 ? `${r.neg ? "−" : "+"}${r.val.toLocaleString("ru-RU")} ₽` : "—"}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-1">
              <span className="text-sm font-bold" style={{ color: t.text }}>Прибыль</span>
              <span className={`text-xl font-bold ${s.total_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {s.total_profit >= 0 ? "+" : ""}{s.total_profit.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        </div>

        {/* Структура затрат — donut */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-red-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Структура затрат</span>
          </div>
          {costPie.length > 0 ? (
            <>
              <div className="flex justify-center mb-3">
                <PieChart width={150} height={150}>
                  <Pie data={costPie} cx={70} cy={70} innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={2} stroke={t.surface}>
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
                <div className="flex justify-between text-xs pt-2 border-t font-bold" style={{ borderColor: t.border2 }}>
                  <span style={{ color: t.textSub }}>Итого затраты</span>
                  <span style={{ color: t.text }}>{s.total_costs.toLocaleString("ru-RU")} ₽</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8" style={{ color: t.textMute }}>
              <Icon name="PieChart" size={28} className="mb-2 opacity-30" />
              <span className="text-sm">Нет данных о затратах</span>
            </div>
          )}
        </div>

        {/* Средние показатели + предстоящее */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full bg-cyan-500" />
              <span className="text-sm font-bold" style={{ color: t.text }}>Средние показатели</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Средняя площадь",  val: s.avg_area > 0     ? `${s.avg_area.toFixed(1)} м²`                             : "—" },
                { label: "Средний договор",   val: s.avg_contract > 0 ? `${Math.round(s.avg_contract).toLocaleString("ru-RU")} ₽` : "—" },
                { label: "Предоплата",        val: s.total_prepayment > 0 ? `${s.total_prepayment.toLocaleString("ru-RU")} ₽`     : "—" },
                { label: "Доплата",           val: s.total_extra > 0  ? `${s.total_extra.toLocaleString("ru-RU")} ₽`             : "—" },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-xs py-1.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
                  <span style={{ color: t.textMute }}>{r.label}</span>
                  <span className="font-semibold" style={{ color: t.text }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full bg-amber-500" />
              <span className="text-sm font-bold" style={{ color: t.text }}>Предстоящие события</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Замеров запланировано",  val: s.upcoming_measures, color: "#f59e0b", icon: "Ruler" },
                { label: "Монтажей запланировано", val: s.upcoming_installs,  color: "#f97316", icon: "Wrench" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: r.color + "10", border: `1px solid ${r.color}25` }}>
                  <div className="flex items-center gap-2 text-xs" style={{ color: r.color }}>
                    <Icon name={r.icon} size={12} /> {r.label}
                  </div>
                  <span className="font-bold text-sm" style={{ color: r.color }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}