import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { BlockId } from "./drawerTypes";

export function DrawerPLBlock({ data, isHidden, toggleHidden }: {
  data: Client;
  isHidden: boolean;
  toggleHidden: (id: BlockId) => void;
}) {
  const t = useTheme();
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  // ── ДОХОДЫ ──────────────────────────────────────────────────────────────────
  const incomeRows: { label: string; value: number }[] = [
    { label: "Договор",         value: Number(data.contract_sum)        || 0 },
    { label: "Предоплата",      value: Number(data.prepayment)          || 0 },
    { label: "Доплата",         value: Number(data.extra_payment)       || 0 },
    { label: "Доп. соглашение", value: Number(data.extra_agreement_sum) || 0 },
  ].filter(r => r.value > 0);

  const plIncome = incomeRows.reduce((s, r) => s + r.value, 0);

  // ── ЗАТРАТЫ ──────────────────────────────────────────────────────────────────
  const costRows: { label: string; value: number }[] = [
    { label: "Материалы", value: Number(data.material_cost) || 0 },
    { label: "Замер",     value: Number(data.measure_cost)  || 0 },
    { label: "Монтаж",    value: Number(data.install_cost)  || 0 },
  ].filter(r => r.value > 0);

  const plCosts  = costRows.reduce((s, r) => s + r.value, 0);
  const plProfit = plIncome - plCosts;

  return (
    <div key="pl" className="rounded-2xl overflow-hidden group/section" style={{ opacity: isHidden ? 0.45 : 1, border: `1px solid ${t.border}` }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "linear-gradient(135deg,#7c3aed15,#10b98112)", borderBottom: isHidden ? "none" : `1px solid #7c3aed30` }}>
        <Icon name="TrendingUp" size={13} style={{ color: "#10b981" }} />
        <span className="text-xs font-bold uppercase tracking-wider text-white flex-1">P&L по заказу</span>
        <button onClick={() => toggleHidden("pl")} className="p-1 rounded-md opacity-0 group-hover/section:opacity-100 transition hover:bg-white/10" style={{ color: isHidden ? "#10b981" : "#a3a3a3" }}>
          <Icon name={isHidden ? "EyeOff" : "Eye"} size={12} />
        </button>
      </div>
      {!isHidden && (
        <div className="px-4 py-3 text-sm" style={{ background: "linear-gradient(135deg,#7c3aed08,#10b98108)" }}>

          {/* Доходы */}
          <div className="text-[9px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: "#a3a3a3" }}>Доходы</div>
          <div className="space-y-1.5 mb-3">
            {incomeRows.length === 0
              ? <div className="flex justify-between"><span style={{ color: "#a3a3a3" }}>Договор</span><span style={{ color: "#a3a3a3" }} className="text-xs">не указан</span></div>
              : incomeRows.map(r => (
                <div key={r.label} className="flex justify-between">
                  <span style={{ color: "#a3a3a3" }}>{r.label}</span>
                  <span className="font-semibold text-emerald-400">+{fmt(r.value)} ₽</span>
                </div>
              ))}
            {incomeRows.length > 1 && (
              <div className="flex justify-between pt-1" style={{ borderTop: `1px solid ${t.border2}` }}>
                <span className="font-semibold text-white">Итого доходы</span>
                <span className="font-bold text-white">+{fmt(plIncome)} ₽</span>
              </div>
            )}
          </div>

          {/* Затраты */}
          {plCosts > 0 && (
            <>
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: "#a3a3a3" }}>Затраты</div>
              <div className="space-y-1.5 mb-3">
                {costRows.map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span style={{ color: "#a3a3a3" }}>{r.label}</span>
                    <span className="font-semibold text-red-400">−{fmt(r.value)} ₽</span>
                  </div>
                ))}
                {costRows.length > 1 && (
                  <div className="flex justify-between pt-1" style={{ borderTop: `1px solid ${t.border2}` }}>
                    <span className="font-semibold text-white">Итого затраты</span>
                    <span className="font-bold text-red-400">−{fmt(plCosts)} ₽</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Прибыль */}
          <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${t.border}` }}>
            <span className="font-bold text-white">Прибыль</span>
            <span className={`text-lg font-black ${plProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {plProfit >= 0 ? "+" : ""}{fmt(plProfit)} ₽
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
