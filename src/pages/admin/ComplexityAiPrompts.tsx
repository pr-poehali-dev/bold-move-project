import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { ComplexityPrompts, ThemeClasses, DEFAULT_FORMULA } from "./discountRiskTypes";

interface Props {
  isDark: boolean;
  theme: ThemeClasses;
  readOnly: boolean;
  formula: string;
  setFormula: (v: string) => void;
  complexityPrompts: ComplexityPrompts;
  setComplexityPrompts: (p: ComplexityPrompts) => void;
  activePromptTab: "math" | "semantic" | "combine";
  setActivePromptTab: (t: "math" | "semantic" | "combine") => void;
  savedPrompts: boolean;
  improvedPrompts?: boolean;
  onSavePrompts: () => void;
  onImprovePrompts: () => void;
}

export default function ComplexityAiPrompts({
  isDark, theme, readOnly,
  formula, setFormula,
  complexityPrompts, setComplexityPrompts,
  activePromptTab, setActivePromptTab,
  savedPrompts, improvedPrompts, onSavePrompts, onImprovePrompts,
}: Props) {
  const [animating, setAnimating] = useState(false);
  const [animStep,  setAnimStep]  = useState(0); // 0=idle 1=улучшаю 2=готово

  useEffect(() => {
    if (!improvedPrompts) return;
    // Запускаем анимацию
    setAnimating(true);
    setAnimStep(1);
    const t1 = setTimeout(() => setAnimStep(2), 1200);
    const t2 = setTimeout(() => { setAnimating(false); setAnimStep(0); }, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [improvedPrompts]);

  return (
    <div className={`rounded-2xl p-4 space-y-3 ${theme.bg} border ${theme.border}`}>

      <div className="flex items-center gap-2">
        <Icon name="Sparkles" size={14} style={{ color: "#a78bfa" }} />
        <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
          AI промпты анализа
        </span>
      </div>

      {/* Формула */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#a78bfa" }}>
          Формула для AI-контекста
        </label>
        <input type="text" value={formula} onChange={e => setFormula(e.target.value)} disabled={readOnly}
          className={`w-full rounded-lg px-3 py-2 text-xs font-mono outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`}
          placeholder={DEFAULT_FORMULA} />
        <p className={`text-[10px] mt-1 ${theme.sub}`}>Передаётся в AI как описание формулы расчёта</p>
      </div>

      {/* Табы промптов */}
      <div className="flex gap-1">
        {([
          { key: "math",     label: "1. Математика",  color: "#10b981" },
          { key: "semantic", label: "2. Семантика",   color: "#f59e0b" },
          { key: "combine",  label: "3. Объединение", color: "#8b5cf6" },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActivePromptTab(tab.key)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
            style={{
              background: activePromptTab === tab.key ? `${tab.color}20` : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
              color: activePromptTab === tab.key ? tab.color : isDark ? "rgba(255,255,255,0.4)" : "#9ca3af",
              border: `1px solid ${activePromptTab === tab.key ? `${tab.color}40` : "transparent"}`,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      <p className={`text-[10px] ${theme.sub}`}>
        {activePromptTab === "math" && "Получает математическую оценку (число). Объясняет что означает итоговый балл по формуле."}
        {activePromptTab === "semantic" && "Получает список позиций сметы. Оценивает объект семантически — риски, комбинации, нестандартные ситуации."}
        {activePromptTab === "combine" && "Получает результаты этапов 1 и 2. Выдаёт итоговую оценку, рекомендуемую скидку и вывод для менеджера в JSON."}
      </p>

      <div className="relative">
        <textarea disabled={readOnly || animating} rows={7}
          value={complexityPrompts[activePromptTab]}
          onChange={e => setComplexityPrompts({ ...complexityPrompts, [activePromptTab]: e.target.value })}
          className={`w-full rounded-xl px-3 py-2.5 text-xs font-mono outline-none transition resize-none ${
            isDark
              ? "bg-white/[0.04] border border-white/10 text-white/75 focus:border-violet-500/50"
              : "bg-gray-50 border border-gray-200 text-gray-700 focus:border-violet-400"
          }`}
          style={{ transition: "opacity 0.3s", opacity: animating ? 0.15 : 1 }}
        />

        {/* Анимация улучшения */}
        {animating && (
          <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.4)" }}>

            {animStep === 1 ? (
              <>
                {/* Бегущие строки — имитация печатания */}
                <div className="w-full px-5 space-y-1.5">
                  {["Анализирую структуру промптов...", "Оптимизирую логику расчёта скидки...", "Добавляю правила стабилизации..."].map((line, i) => (
                    <div key={i} className="flex items-center gap-2"
                      style={{ animationDelay: `${i * 0.2}s`, opacity: 0, animation: "fadeInLine 0.4s ease forwards", animationDelay: `${i * 350}ms` }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: "#a78bfa" }} />
                      <span className="text-[11px] font-mono" style={{ color: "#c4b5fd" }}>{line}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                  <span className="text-xs font-bold" style={{ color: "#a78bfa" }}>Улучшаю промпты...</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(16,185,129,0.2)", border: "2px solid rgba(16,185,129,0.5)" }}>
                  <Icon name="CheckCircle2" size={24} style={{ color: "#10b981" }} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-emerald-400">Промпты улучшены!</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Скидка теперь считается стабильнее</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInLine {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className={`text-[10px] p-2.5 rounded-lg ${isDark ? "bg-white/[0.03]" : "bg-gray-50"}`}
        style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb"}` }}>
        <span className={`font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Переменные: </span>
        <span className={theme.sub}>
          {activePromptTab === "math" && "{math_score} — итоговый балл, {items_breakdown} — таблица позиций с баллами"}
          {activePromptTab === "semantic" && "{items} — список позиций сметы"}
          {activePromptTab === "combine" && "{math_result} — вывод этапа 1, {semantic_result} — вывод этапа 2, {max_discount} — макс. скидка"}
        </span>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <button onClick={onSavePrompts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
            <Icon name={savedPrompts ? "Check" : "Save"} size={12} />
            {savedPrompts ? "Сохранено" : "Сохранить промпты и формулу"}
          </button>
          <button onClick={onImprovePrompts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
            style={{
              background: improvedPrompts ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.12)",
              color:      improvedPrompts ? "#10b981" : "#f59e0b",
              border:     `1px solid ${improvedPrompts ? "rgba(16,185,129,0.4)" : "rgba(245,158,11,0.3)"}`,
            }}>
            <Icon name={improvedPrompts ? "CheckCircle2" : "Wand2"} size={12} />
            {improvedPrompts ? "✓ Промпты улучшены и сохранены!" : "Улучшить промпты"}
          </button>
        </div>
      )}
    </div>
  );
}