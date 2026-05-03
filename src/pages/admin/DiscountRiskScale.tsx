import Icon from "@/components/ui/icon";
import { RiskSettings, ThemeClasses } from "./discountRiskTypes";

interface Props {
  s: RiskSettings;
  isDark: boolean;
  theme: ThemeClasses;
}

export default function DiscountRiskScale({ s, isDark, theme }: Props) {
  const total = s.max_discount || 1;
  const greenPct  = Math.min(100, (s.low_risk_threshold / total) * 100);
  const yellowPct = Math.min(100 - greenPct, ((s.mid_risk_threshold - s.low_risk_threshold) / total) * 100);
  const redPct    = 100 - greenPct - yellowPct;

  return (
    <div className={`rounded-2xl p-4 ${theme.bg} border ${theme.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="BarChart3" size={14} style={{ color: "#8b5cf6" }} />
        <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
          Шкала риска скидки
        </span>
      </div>
      <div className="relative h-8 rounded-xl overflow-hidden flex mb-2">
        <div style={{ width: `${greenPct}%`, background: "linear-gradient(90deg,#10b981,#84cc16)" }}
          className="flex items-center justify-center">
          {greenPct > 12 && <span className="text-[10px] font-bold text-white/90">Безопасно</span>}
        </div>
        <div style={{ width: `${yellowPct}%`, background: "linear-gradient(90deg,#f59e0b,#f97316)" }}
          className="flex items-center justify-center">
          {yellowPct > 12 && <span className="text-[10px] font-bold text-white/90">Умеренно</span>}
        </div>
        <div style={{ width: `${redPct}%`, background: "linear-gradient(90deg,#ef4444,#dc2626)" }}
          className="flex items-center justify-center">
          {redPct > 12 && <span className="text-[10px] font-bold text-white/90">Осторожно</span>}
        </div>
      </div>
      <div className="flex justify-between text-[10px]" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
        <span>0%</span>
        <span style={{ color: "#10b981" }}>↑ {s.low_risk_threshold}%</span>
        <span style={{ color: "#f59e0b" }}>↑ {s.mid_risk_threshold}%</span>
        <span style={{ color: "#ef4444" }}>max {s.max_discount}%</span>
      </div>
      <div className="flex gap-4 mt-3">
        {[
          { color: "#10b981", label: "Низкий риск",  range: `0–${s.low_risk_threshold}%` },
          { color: "#f59e0b", label: "Средний риск", range: `${s.low_risk_threshold}–${s.mid_risk_threshold}%` },
          { color: "#ef4444", label: "Высокий риск", range: `${s.mid_risk_threshold}–${s.max_discount}%` },
        ].map(z => (
          <div key={z.color} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: z.color }} />
            <div>
              <div className="text-[10px] font-semibold" style={{ color: z.color }}>{z.label}</div>
              <div className="text-[9px]" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>{z.range}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}