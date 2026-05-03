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

      <textarea disabled={readOnly} rows={7}
        value={complexityPrompts[activePromptTab]}
        onChange={e => setComplexityPrompts({ ...complexityPrompts, [activePromptTab]: e.target.value })}
        className={`w-full rounded-xl px-3 py-2.5 text-xs font-mono outline-none transition resize-none ${
          isDark
            ? "bg-white/[0.04] border border-white/10 text-white/75 focus:border-violet-500/50"
            : "bg-gray-50 border border-gray-200 text-gray-700 focus:border-violet-400"
        }`}
      />

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