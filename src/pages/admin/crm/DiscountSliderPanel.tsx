import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { AiRisk, RiskSettings } from "./discountBlockTypes";
import { DiscountEntry } from "@/hooks/useDiscountHistory";

interface Props {
  discount: number;
  setDiscount: (v: number) => void;
  applying: boolean;
  applied: boolean;
  analysisLoading: boolean;
  baseIncome: number;
  discountedIncome: number;
  discountedProfit: number;
  discountedMargin: number;
  isNegative: boolean;
  isWarning: boolean;
  isOverMax: boolean;
  currentZone: "none" | "low" | "mid" | "high";
  accentColor: string;
  borderColor: string;
  effectiveMax: number;
  sliderMax: number;
  zoneLow: number;
  zoneMid: number;
  risk: RiskSettings;
  aiRisk: AiRisk | null;
  aiError: string | null;
  fmt: (n: number) => string;
  onAnalysisClick: () => void;
  onApplyDiscount: () => void;
  onResetDiscount: () => void;
  hasAppliedDiscount: boolean;
  appliedDiscountPct: number;
  discountHistory: DiscountEntry[];
  totalDiscountAmount: number;
  setApplied: (v: boolean) => void;
}

export function DiscountSliderPanel({
  discount, setDiscount,
  applying, applied, analysisLoading,
  baseIncome, discountedIncome, discountedProfit, discountedMargin,
  isNegative, isWarning, isOverMax,
  currentZone, accentColor, borderColor,
  effectiveMax, sliderMax, zoneLow, zoneMid,
  risk, aiRisk, aiError,
  fmt, onAnalysisClick, onApplyDiscount, onResetDiscount,
  hasAppliedDiscount, appliedDiscountPct,
  discountHistory, totalDiscountAmount, setApplied,
}: Props) {
  const t = useTheme();

  const aiLevelColor = aiRisk?.level === "low" ? "#10b981" : aiRisk?.level === "mid" ? "#f59e0b" : "#ef4444";
  const aiLevelLabel = aiRisk?.level === "low" ? "Низкая сложность" : aiRisk?.level === "mid" ? "Средняя сложность" : "Высокая сложность";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${borderColor}`, background: "#f59e0b08" }}>

      {/* Шапка */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <Icon name="Tag" size={13} style={{ color: "#f59e0b" }} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-yellow-400">
          Оценка риска скидки
        </span>
        {/* Кнопка 3-этапного анализа */}
        <button onClick={onAnalysisClick} disabled={analysisLoading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition disabled:opacity-50 hover:opacity-80"
          style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
          {analysisLoading
            ? <><div className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Анализ...</>
            : <><Icon name="BarChart2" size={11} /> Анализ объекта</>
          }
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* 4 плитки */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "#ffffff08", border: `1px solid ${t.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1 text-white/40">Скидка</div>
            <div className="text-base font-black" style={{ color: accentColor }}>{discount}%</div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "#ffffff08", border: `1px solid ${t.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1 text-white/40">Сумма скидки</div>
            <div className="text-sm font-black text-white/70">−{fmt(baseIncome * discount / 100)} ₽</div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: isNegative ? "#ef444412" : "#10b98112", border: `1px solid ${isNegative ? "#ef444430" : "#10b98125"}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
              {isNegative ? "Убыток" : "Прибыль"}
            </div>
            <div className="text-sm font-black" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
              {isNegative ? "" : "+"}{fmt(discountedProfit)} ₽
            </div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: isNegative ? "#ef444412" : "#10b98112", border: `1px solid ${isNegative ? "#ef444430" : "#10b98125"}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: isNegative ? "#ef4444" : "#10b981" }}>Маржа</div>
            <div className="text-sm font-black" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
              {isNegative ? "—" : `${discountedMargin}%`}
            </div>
          </div>
        </div>

        {/* Предупреждения */}
        {(isNegative || isOverMax) && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl animate-pulse"
            style={{ background: "#ef444415", border: "1px solid #ef444435" }}>
            <Icon name="AlertTriangle" size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-red-400">Нельзя давать такую скидку</div>
              <div className="text-[10px] text-red-300/70">
                {isOverMax ? `Превышен максимум ${effectiveMax}% для этого заказа` : "Объект становится убыточным"}
              </div>
            </div>
          </div>
        )}
        {isWarning && !isNegative && !isOverMax && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
            <Icon name="AlertCircle" size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <div className="text-[10px] text-yellow-300/80">
              Маржа ниже {risk.warn_margin}% — скидка рискованная
              {currentZone === "high" && " (высокий риск по правилам)"}
            </div>
          </div>
        )}
        {applied && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#10b98115", border: "1px solid #10b98130" }}>
            <Icon name="CheckCircle2" size={14} style={{ color: "#10b981", flexShrink: 0 }} />
            <div className="text-[10px] text-emerald-300">Скидка применена — смета и P&L обновлены</div>
          </div>
        )}
        {hasAppliedDiscount && !applied && discountHistory.length > 0 && (
          <div className="rounded-xl overflow-hidden"
            style={{ border: "1px solid #f59e0b30", background: "#f59e0b08" }}>
            {/* Шапка */}
            <div className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: "1px solid #f59e0b20" }}>
              <div className="flex items-center gap-2">
                <Icon name="History" size={12} style={{ color: "#f59e0b" }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                  История скидок ({discountHistory.length})
                </span>
              </div>
              <span className="text-[10px] font-bold text-yellow-300">
                −{fmt(totalDiscountAmount)} ₽ итого
              </span>
            </div>
            {/* Строки */}
            <div className="divide-y" style={{ borderColor: "#f59e0b15" }}>
              {discountHistory.map((entry, i) => {
                const isLast = i === discountHistory.length - 1;
                const date = new Date(entry.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: "#f59e0b20", color: "#f59e0b" }}>
                        −{entry.discount_pct}%
                      </span>
                      <span className="text-[10px] text-white/40 truncate">{date}</span>
                      <span className="text-[10px] font-semibold text-yellow-300/70 whitespace-nowrap">
                        −{fmt(entry.discount_amount)} ₽
                      </span>
                    </div>
                    {isLast && (
                      <button onClick={onResetDiscount} disabled={applying}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition hover:opacity-80 flex-shrink-0 disabled:opacity-40"
                        style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
                        <Icon name="RotateCcw" size={9} />
                        Откатить
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Шкала + слайдер */}
        <div className="space-y-1">
          {/* Цветная шкала */}
          {(() => {
            const max    = sliderMax || 1;
            const lowPct = Math.min(100, (zoneLow / max) * 100);
            const midPct = Math.min(100, (zoneMid / max) * 100);
            return (
              <div className="relative h-7 rounded-lg overflow-hidden"
                style={{ background: `linear-gradient(90deg, #16a34a 0%, #84cc16 ${lowPct * 0.6}%, #f59e0b ${lowPct}%, #f97316 ${midPct * 0.7}%, #ef4444 ${midPct}%, #dc2626 100%)` }}>
                <div className="absolute inset-0 flex">
                  <div style={{ width: `${lowPct}%` }} className="flex items-center justify-center">
                    {lowPct > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Безопасно</span>}
                  </div>
                  <div style={{ width: `${midPct - lowPct}%` }} className="flex items-center justify-center">
                    {(midPct - lowPct) > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Умеренно</span>}
                  </div>
                  <div style={{ width: `${100 - midPct}%` }} className="flex items-center justify-center">
                    {(100 - midPct) > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Осторожно</span>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Метки */}
          <div className="relative h-4 overflow-hidden">
            <span className="absolute left-0 text-[9px] text-white/30">0%</span>
            {sliderMax > 0 && (() => {
              const rawLow = (zoneLow / sliderMax) * 100;
              const rawMid = (zoneMid / sliderMax) * 100;
              // Зажимаем позиции чтобы не вылезали за края и не перекрывались
              const lowPct = Math.min(Math.max(rawLow, 5), 90);
              const midPct = Math.min(Math.max(rawMid, lowPct + 8), 92);
              const showLow = Math.abs(rawLow - rawMid) > 7;
              return (
                <>
                  {showLow && (
                    <span className="absolute text-[9px] font-bold whitespace-nowrap"
                      style={{ left: `${lowPct}%`, color: "#f59e0b", transform: "translateX(-50%)" }}>↑ {zoneLow}%</span>
                  )}
                  <span className="absolute text-[9px] font-bold whitespace-nowrap"
                    style={{ left: `${midPct}%`, color: "#ef4444", transform: "translateX(-50%)" }}>↑ {zoneMid}%</span>
                </>
              );
            })()}
            <span className="absolute right-0 text-[9px] text-white/30">{sliderMax}%</span>
          </div>

          {/* Слайдер */}
          <input
            type="range" min={0} max={sliderMax || 1} step={0.5} value={discount}
            onChange={e => { setDiscount(Number(e.target.value)); setApplied(false); }}
            className="w-full cursor-pointer"
            style={{
              accentColor: isNegative || isOverMax ? "#ef4444"
                : currentZone === "low" ? "#10b981"
                : currentZone === "mid" ? "#f59e0b"
                : "#ef4444",
              height: 4,
            }}
          />

          {/* Легенда */}
          <div className="flex flex-wrap gap-3 pt-1">
            {[
              { color: "#10b981", label: "Низкий риск",    hint: "маржа в безопасной зоне", range: `0–${zoneLow}%` },
              { color: "#f59e0b", label: "Средний риск",   hint: "стоит взвесить",           range: `${zoneLow}–${zoneMid}%` },
              { color: "#ef4444", label: "Высокий риск",   hint: "маржа под угрозой",        range: `${zoneMid}–${sliderMax}%` },
            ].map(z => (
              <div key={z.color} className="flex items-center gap-1.5" title={z.hint}>
                <div className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                <span className="text-[10px] font-semibold" style={{ color: z.color }}>{z.label}</span>
                <span className="text-[9px] text-white/25">{z.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Компактный результат AI */}
        {aiError && (
          <div className="text-[10px] text-red-400 px-1">{aiError}</div>
        )}
        {aiRisk && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: aiLevelColor + "12", border: `1px solid ${aiLevelColor}25` }}>
            <div className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0" style={{ background: aiLevelColor }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-bold" style={{ color: aiLevelColor }}>{aiLevelLabel}</span>
                <span className="text-[9px] text-white/30">→ скидка {aiRisk.recommended_discount}% выставлена</span>
              </div>
              <p className="text-[10px] text-white/55">{aiRisk.reason}</p>
              {aiRisk.items.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {aiRisk.items.map((item, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: aiLevelColor + "18", color: aiLevelColor }}>{item}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Футер: итог + кнопка */}
        <div className="flex items-center gap-3">
          {discount > 0 && (
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: "#ffffff06", border: `1px solid ${t.border}` }}>
                <span className="text-[10px] text-white/40">Выручка со скидкой</span>
                <span className="text-[11px] font-bold text-white/70">{fmt(discountedIncome)} ₽</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: isNegative ? "#ef444410" : "#10b98110", border: `1px solid ${isNegative ? "#ef444430" : "#10b98130"}` }}>
                <span className="text-[10px]" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
                  {isNegative ? "Убыток" : "Заработаете"}
                </span>
                <span className="text-[11px] font-bold" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
                  {isNegative ? "" : "+"}{fmt(discountedProfit)} ₽
                </span>
              </div>
            </div>
          )}
          <button
            onClick={onApplyDiscount}
            disabled={discount === 0 || isNegative || isOverMax || applying}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 flex-shrink-0"
            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
            {applying
              ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Применяем...</>
              : <><Icon name="Percent" size={12} /> Применить скидку</>
            }
          </button>
        </div>

      </div>
    </div>
  );
}