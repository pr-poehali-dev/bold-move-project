import Icon from "@/components/ui/icon";
import { ComplexityAnalysis } from "./discountBlockTypes";

interface Props {
  analysisLoading: boolean;
  analysisStep: 0 | 1 | 2 | 3;
  analysisError: string | null;
  analysis: ComplexityAnalysis | null;
  onClose: () => void;
}

export function DiscountAnalysisModal({
  analysisLoading, analysisStep, analysisError, analysis, onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh" }}>

        {/* Шапка */}
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon name="BarChart2" size={16} style={{ color: "#34d399" }} />
          <span className="text-sm font-bold text-white flex-1">Анализ объекта</span>
          {analysis?.combineResult && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
              style={{
                background: analysis.combineResult.level === "low" ? "#10b98120" : analysis.combineResult.level === "mid" ? "#f59e0b20" : "#ef444420",
                color: analysis.combineResult.level === "low" ? "#10b981" : analysis.combineResult.level === "mid" ? "#f59e0b" : "#ef4444",
              }}>
              {analysis.combineResult.level === "low" ? "Низкая сложность" : analysis.combineResult.level === "mid" ? "Средняя сложность" : "Высокая сложность"}
            </span>
          )}
          <button onClick={onClose} className="ml-1 p-1 rounded-lg hover:bg-white/10 transition">
            <Icon name="X" size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Прогресс этапов */}
          <div className="flex items-center gap-2">
            {[
              { n: 1, label: "Математика",  color: "#10b981" },
              { n: 2, label: "Семантика",   color: "#f59e0b" },
              { n: 3, label: "Объединение", color: "#8b5cf6" },
            ].map((step, i) => {
              const done   = analysisStep > step.n || (!analysisLoading && analysis);
              const active = analysisLoading && analysisStep === step.n;
              return (
                <div key={step.n} className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{
                        background: done || active ? `${step.color}25` : "rgba(255,255,255,0.05)",
                        border: `1px solid ${done || active ? step.color : "rgba(255,255,255,0.1)"}`,
                        color: done || active ? step.color : "rgba(255,255,255,0.3)",
                      }}>
                      {active ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : step.n}
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: done || active ? step.color : "rgba(255,255,255,0.3)" }}>
                      {step.label}
                    </span>
                  </div>
                  {i < 2 && <div className="w-4 h-px" style={{ background: analysisStep > step.n || (!analysisLoading && analysis) ? step.color : "rgba(255,255,255,0.1)" }} />}
                </div>
              );
            })}
          </div>

          {/* Ошибка */}
          {analysisError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "#ef444415", border: "1px solid #ef444430" }}>
              <Icon name="AlertTriangle" size={13} style={{ color: "#ef4444" }} />
              <span className="text-xs text-red-400">{analysisError}</span>
            </div>
          )}

          {/* Загрузка */}
          {analysisLoading && !analysisError && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-xs text-white/50">
                {analysisStep === 1 && "Считаю математику..."}
                {analysisStep === 2 && "AI анализирует позиции..."}
                {analysisStep === 3 && "Объединяю результаты..."}
              </span>
            </div>
          )}

          {analysis && (
            <>
              {/* Этап 1 — Математика */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: "#10b98108", border: "1px solid #10b98120" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: "#10b98125", color: "#10b981" }}>1</div>
                  <span className="text-xs font-bold" style={{ color: "#10b981" }}>Математический анализ</span>
                  <span className="ml-auto text-lg font-black" style={{ color: "#10b981" }}>{analysis.mathScore}/10</span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">{analysis.mathResult}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {[...analysis.items].sort((a, b) => b.unitScore - a.unitScore).slice(0, 4).map((item, i) => (
                    <span key={i} className="text-[9px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                      {item.name} · {item.unitScore}
                    </span>
                  ))}
                </div>
              </div>

              {/* Этап 2 — Семантика */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: "#f59e0b08", border: "1px solid #f59e0b20" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: "#f59e0b25", color: "#f59e0b" }}>2</div>
                  <span className="text-xs font-bold" style={{ color: "#f59e0b" }}>Семантический анализ AI</span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">{analysis.semanticResult}</p>
              </div>

              {/* Этап 3 — Итог */}
              {analysis.combineResult && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: "#8b5cf608", border: "1px solid #8b5cf630" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: "#8b5cf625", color: "#8b5cf6" }}>3</div>
                    <span className="text-xs font-bold" style={{ color: "#8b5cf6" }}>Итоговая оценка</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Сложность</div>
                      <div className="text-2xl font-black" style={{ color: "#8b5cf6" }}>{analysis.combineResult.score}/10</div>
                    </div>
                    <div className="rounded-lg p-3 text-center" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <div className="text-[9px] text-yellow-400/60 uppercase tracking-wider mb-1">Рекомендованная скидка</div>
                      <div className="text-2xl font-black text-yellow-400">{analysis.combineResult.recommended_discount}%</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/65 leading-relaxed">{analysis.combineResult.summary}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Футер */}
        {analysis?.combineResult && (
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-xs text-white/40 flex-1">
              Скидка {analysis.combineResult.recommended_discount}% уже выставлена в слайдер
            </span>
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold transition hover:opacity-80"
              style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
              Применить и закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
