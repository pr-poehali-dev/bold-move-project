import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { BlockId, CustomFinRow } from "./drawerTypes";

export function DrawerPLBlock({ data, isHidden, toggleHidden, customFinRows }: {
  data: Client;
  isHidden: boolean;
  toggleHidden: (id: BlockId) => void;
  customFinRows: CustomFinRow[];
}) {
  const t = useTheme();
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  const customCostRows = customFinRows
    .filter(r => r.block === "costs")
    .map(r => ({ label: r.label, value: Number(localStorage.getItem(`fin_row_${data.id}_${r.key}`)) || 0 }))
    .filter(r => r.value > 0);

  const customIncomeRows = customFinRows
    .filter(r => r.block === "income")
    .map(r => ({ label: r.label, value: Number(localStorage.getItem(`fin_row_${data.id}_${r.key}`)) || 0 }))
    .filter(r => r.value > 0);

  const costRows: { label: string; value: number }[] = [
    { label: "Материалы", value: Number(data.material_cost) || 0 },
    { label: "Замер",     value: Number(data.measure_cost)  || 0 },
    { label: "Монтаж",    value: Number(data.install_cost)  || 0 },
    ...customCostRows,
  ].filter(r => r.value > 0);
  const plCosts = costRows.reduce((s, r) => s + r.value, 0);

  const contractSum = Number(data.contract_sum) || 0;
  const prepayment  = Number(data.prepayment)   || 0;
  const extraPay    = Number(data.extra_payment) || 0;
  const plIncome    = contractSum + (customIncomeRows.reduce((s, r) => s + r.value, 0));

  const incomeRows: { label: string; value: number }[] = [
    { label: "Договор",   value: contractSum },
    ...(prepayment ? [{ label: "Предоплата", value: prepayment }] : []),
    ...(extraPay   ? [{ label: "Доплата",    value: extraPay   }] : []),
    ...customIncomeRows,
  ].filter(r => r.value > 0);

  const plProfit = plIncome - plCosts;
  const margin   = plIncome > 0 ? Math.round((plProfit / plIncome) * 100) : null;
  const profitColor = plProfit >= 0 ? "#10b981" : "#ef4444";

  return (
    <div className="rounded-2xl overflow-hidden group/pl" style={{ border: `1px solid ${t.border}`, opacity: isHidden ? 0.45 : 1 }}>

      {/* Шапка */}
      <div className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: "linear-gradient(135deg,#7c3aed15,#10b98112)", borderBottom: isHidden ? "none" : `1px solid #7c3aed30` }}>
        <Icon name="TrendingUp" size={13} style={{ color: "#10b981" }} />
        <span className="text-xs font-bold uppercase tracking-wider text-white flex-1">P&L по заказу</span>
        <button onClick={() => toggleHidden("pl")}
          className={`p-1 rounded-md transition hover:bg-white/10 ${isHidden ? "opacity-100" : "opacity-0 group-hover/pl:opacity-100"}`}
          style={{ color: isHidden ? "#10b981" : "#a3a3a3" }}>
          <Icon name={isHidden ? "EyeOff" : "Eye"} size={12} />
        </button>
      </div>

      {!isHidden && (
        <div style={{ background: "linear-gradient(135deg,#7c3aed08,#10b98108)" }}>

          {/* ── МОБИЛЕ: вертикальный понятный вид ─────────────────── */}
          <div className="sm:hidden px-4 py-3 space-y-3">

            {/* Итог-сводка: 3 плитки */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "#ef444412", border: "1px solid #ef444425" }}>
                <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#ef4444" }}>Затраты</div>
                <div className="text-sm font-black text-red-400">−{fmt(plCosts)} ₽</div>
              </div>
              <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "#10b98112", border: "1px solid #10b98125" }}>
                <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#10b981" }}>Доходы</div>
                <div className="text-sm font-black text-emerald-400">+{fmt(plIncome)} ₽</div>
              </div>
              <div className="rounded-xl px-3 py-2.5 text-center"
                style={{ background: profitColor + "12", border: `1px solid ${profitColor}25` }}>
                <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: profitColor }}>
                  {plProfit >= 0 ? "Прибыль" : "Убыток"}
                </div>
                <div className="text-sm font-black" style={{ color: profitColor }}>
                  {plProfit >= 0 ? "+" : ""}{fmt(plProfit)} ₽
                </div>
              </div>
            </div>

            {/* Маржа */}
            {margin !== null && (
              <div className="flex items-center justify-center">
                <span className="text-[11px] font-bold px-3 py-1 rounded-full"
                  style={{ background: profitColor + "18", color: profitColor }}>
                  {margin}% маржа
                </span>
              </div>
            )}

            {/* Детализация затрат */}
            {costRows.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border2}` }}>
                <div className="px-3 py-2 flex items-center gap-1.5"
                  style={{ background: "#ef444410", borderBottom: `1px solid ${t.border2}` }}>
                  <Icon name="ArrowDownRight" size={11} style={{ color: "#ef4444" }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#ef4444" }}>Затраты</span>
                </div>
                <div className="divide-y" style={{ borderColor: t.border2 }}>
                  {costRows.map(r => (
                    <div key={r.label} className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs" style={{ color: t.textSub }}>{r.label}</span>
                      <span className="text-xs font-semibold text-red-400">−{fmt(r.value)} ₽</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Детализация доходов */}
            {incomeRows.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border2}` }}>
                <div className="px-3 py-2 flex items-center gap-1.5"
                  style={{ background: "#10b98110", borderBottom: `1px solid ${t.border2}` }}>
                  <Icon name="ArrowUpRight" size={11} style={{ color: "#10b981" }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#10b981" }}>Доходы</span>
                </div>
                <div className="divide-y" style={{ borderColor: t.border2 }}>
                  {incomeRows.map(r => (
                    <div key={r.label} className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs" style={{ color: t.textSub }}>{r.label}</span>
                      <span className="text-xs font-semibold text-emerald-400">{fmt(r.value)} ₽</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── ДЕСКТОП: три колонки как было ─────────────────────── */}
          <div className="hidden sm:grid grid-cols-3">

            {/* ЗАТРАТЫ */}
            <div className="px-4 py-3" style={{ borderRight: `1px solid ${t.border2}` }}>
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1"
                style={{ color: "#ef4444" }}>
                <Icon name="ArrowDownRight" size={10} style={{ color: "#ef4444" }} /> Затраты
              </div>
              {costRows.length === 0 ? (
                <div className="text-xs" style={{ color: "#a3a3a3" }}>Не указаны</div>
              ) : (
                <div className="space-y-1.5">
                  {costRows.map(r => (
                    <div key={r.label} className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate" style={{ color: "#a3a3a3" }}>{r.label}</span>
                      <span className="text-xs font-semibold text-red-400 whitespace-nowrap">−{fmt(r.value)} ₽</span>
                    </div>
                  ))}
                  {costRows.length > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-1.5" style={{ borderTop: `1px solid ${t.border2}` }}>
                      <span className="text-xs font-semibold text-white">Итого</span>
                      <span className="text-sm font-bold text-red-400">−{fmt(plCosts)} ₽</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ДОХОДЫ */}
            <div className="px-4 py-3" style={{ borderRight: `1px solid ${t.border2}` }}>
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1 justify-end"
                style={{ color: "#10b981" }}>
                Доходы <Icon name="ArrowUpRight" size={10} style={{ color: "#10b981" }} />
              </div>
              {incomeRows.length === 0 ? (
                <div className="text-xs text-right" style={{ color: "#a3a3a3" }}>Не указаны</div>
              ) : (
                <div className="space-y-1.5">
                  {incomeRows.map(r => (
                    <div key={r.label} className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate" style={{ color: "#a3a3a3" }}>{r.label}</span>
                      <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap">{fmt(r.value)} ₽</span>
                    </div>
                  ))}
                  {incomeRows.length > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-1.5" style={{ borderTop: `1px solid ${t.border2}` }}>
                      <span className="text-xs font-semibold text-white">Итого</span>
                      <span className="text-sm font-bold text-emerald-400">+{fmt(plIncome)} ₽</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ПРИБЫЛЬ */}
            <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#a3a3a3" }}>Прибыль</div>
              <div className={`text-xl font-black ${plProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {plProfit >= 0 ? "+" : ""}{fmt(plProfit)} ₽
              </div>
              {margin !== null && (
                <div className="text-[10px] mt-1 px-2 py-0.5 rounded-md"
                  style={{ background: profitColor + "20", color: profitColor }}>
                  {margin}% маржа
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}