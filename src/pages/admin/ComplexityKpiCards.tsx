import Icon from "@/components/ui/icon";

interface Props {
  isDark: boolean;
  totalWeightedScore: number;
  avgScore: number;
  maxPossibleScore: number;
  complexityPct: number;
  complexityColor: string;
  complexityLabel: string;
  recommendedDiscount: number;
  riskMaxDiscount: number;
  pricesCount: number;
}

export default function ComplexityKpiCards({
  isDark,
  totalWeightedScore,
  avgScore,
  maxPossibleScore,
  complexityPct,
  complexityColor,
  complexityLabel,
  recommendedDiscount,
  riskMaxDiscount,
  pricesCount,
}: Props) {
  const surf = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const brd  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const muted = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const sub   = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

      {/* Сложность прайса % */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: surf, border: `1px solid ${brd}` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
          style={{ background: complexityColor + "18" }}>
          <Icon name="BarChart3" size={17} style={{ color: complexityColor }} />
        </div>
        <div className="text-xs mb-0.5" style={{ color: muted }}>Сложность прайса</div>
        <div className="text-2xl font-bold" style={{ color: complexityColor }}>{complexityPct}%</div>
        <div className="text-xs mt-0.5" style={{ color: sub }}>{complexityLabel}</div>
        <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]"
          style={{ background: complexityColor }} />
      </div>

      {/* Рекомендованная скидка */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: surf, border: `1px solid ${brd}` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
          style={{ background: "#f59e0b18" }}>
          <Icon name="Percent" size={17} style={{ color: "#f59e0b" }} />
        </div>
        <div className="text-xs mb-0.5" style={{ color: muted }}>Рекомендованная скидка</div>
        <div className="text-2xl font-bold" style={{ color: "#f59e0b" }}>{recommendedDiscount}%</div>
        <div className="text-xs mt-0.5" style={{ color: sub }}>из макс. {riskMaxDiscount}% · по сложности</div>
        <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]"
          style={{ background: "#f59e0b" }} />
      </div>

      {/* Суммарный вес */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: surf, border: `1px solid ${brd}` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
          style={{ background: "#a78bfa18" }}>
          <Icon name="Sigma" size={17} style={{ color: "#a78bfa" }} />
        </div>
        <div className="text-xs mb-0.5" style={{ color: muted }}>Суммарный вес</div>
        <div className="text-2xl font-bold" style={{ color: "#a78bfa" }}>{totalWeightedScore}</div>
        <div className="text-xs mt-0.5" style={{ color: sub }}>из {maxPossibleScore} макс. · {pricesCount} позиций</div>
        <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]"
          style={{ background: "#a78bfa" }} />
      </div>

      {/* Средний балл */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: surf, border: `1px solid ${brd}` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
          style={{ background: "#8b5cf618" }}>
          <Icon name="Target" size={17} style={{ color: "#8b5cf6" }} />
        </div>
        <div className="text-xs mb-0.5" style={{ color: muted }}>Средний балл позиции</div>
        <div className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>{avgScore}/10</div>
        <div className="text-xs mt-0.5" style={{ color: sub }}>сл × вес / 10 на позицию</div>
        <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]"
          style={{ background: "#8b5cf6" }} />
      </div>

    </div>
  );
}
