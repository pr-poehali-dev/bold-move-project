import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import {
  PriceItem, ComplexityItem, ComplexityPrompts, ThemeClasses,
  COMPLEXITY_LS_KEY, COMPLEXITY_PROMPTS_KEY, COMPLEXITY_FORMULA_KEY,
  DEFAULT_COMPLEXITY_PROMPTS, DEFAULT_FORMULA,
  loadComplexityItems, saveComplexityItems,
  loadComplexityPrompts, loadFormula,
} from "./discountRiskTypes";

interface Props {
  isDark: boolean;
  theme: ThemeClasses;
  readOnly: boolean;
}

export default function DiscountRiskComplexity({ isDark, theme, readOnly }: Props) {
  const [complexityOpen,    setComplexityOpen]    = useState(false);
  const [prices,            setPrices]            = useState<PriceItem[]>([]);
  const [pricesLoading,     setPricesLoading]     = useState(false);
  const [complexityItems,   setComplexityItems]   = useState<Record<number, ComplexityItem>>(loadComplexityItems);
  const [complexityPrompts, setComplexityPrompts] = useState<ComplexityPrompts>(loadComplexityPrompts);
  const [formula,           setFormula]           = useState(loadFormula);
  const [complexitySaved,   setComplexitySaved]   = useState(false);
  const [activePromptTab,   setActivePromptTab]   = useState<"math" | "semantic" | "combine">("math");
  const [categoryFilter,    setCategoryFilter]    = useState<string>("all");

  const loadPrices = useCallback(async () => {
    if (prices.length > 0) return;
    setPricesLoading(true);
    try {
      const func2url = await import("@/../backend/func2url.json");
      const url = (func2url as unknown as Record<string, string>)["get-prices"];
      const res = await fetch(url).then(r => r.json());
      setPrices(res.prices || []);
    } catch {
      setPrices([]);
    } finally {
      setPricesLoading(false);
    }
  }, [prices.length]);

  useEffect(() => {
    if (complexityOpen) loadPrices();
  }, [complexityOpen, loadPrices]);

  const getItem = (id: number): ComplexityItem =>
    complexityItems[id] || { priceId: id, complexity: 5, weight: 5 };

  const updateItem = (id: number, patch: Partial<ComplexityItem>) => {
    setComplexityItems(prev => {
      const next = { ...prev, [id]: { ...getItem(id), ...patch } };
      saveComplexityItems(next);
      return next;
    });
  };

  const saveComplexity = () => {
    localStorage.setItem(COMPLEXITY_PROMPTS_KEY, JSON.stringify(complexityPrompts));
    localStorage.setItem(COMPLEXITY_FORMULA_KEY, formula);
    window.dispatchEvent(new StorageEvent("storage", { key: COMPLEXITY_LS_KEY }));
    setComplexitySaved(true);
    setTimeout(() => setComplexitySaved(false), 2000);
  };

  const categories = ["all", ...Array.from(new Set(prices.map(p => p.category).filter(Boolean)))];
  const filteredPrices = categoryFilter === "all" ? prices : prices.filter(p => p.category === categoryFilter);

  return (
    <div className={`rounded-2xl overflow-hidden ${theme.bg} border ${theme.border}`}>
      <button
        onClick={() => setComplexityOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition hover:bg-white/[0.02]">
        <Icon name="Layers" size={14} style={{ color: "#a78bfa" }} />
        <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"} flex-1`}>
          Сложность позиций прайса
        </span>
        <span className={`text-[9px] ${theme.sub} mr-2`}>Вес и сложность для AI-анализа</span>
        <Icon name={complexityOpen ? "ChevronUp" : "ChevronDown"} size={13} style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }} />
      </button>

      {complexityOpen && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>

          {/* Формула */}
          <div className="pt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#a78bfa" }}>
              Формула расчёта удельного веса
            </label>
            <input
              type="text"
              value={formula}
              onChange={e => setFormula(e.target.value)}
              disabled={readOnly}
              className={`w-full rounded-lg px-3 py-2 text-xs font-mono outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`}
              placeholder={DEFAULT_FORMULA}
            />
            <p className={`text-[10px] mt-1 ${theme.sub}`}>Описание формулы — передаётся в AI как контекст расчёта</p>
          </div>

          {/* Фильтр по категории */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition"
                  style={{
                    background: categoryFilter === cat ? "rgba(139,92,246,0.2)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    color: categoryFilter === cat ? "#a78bfa" : isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
                    border: `1px solid ${categoryFilter === cat ? "rgba(139,92,246,0.4)" : "transparent"}`,
                  }}>
                  {cat === "all" ? "Все категории" : cat}
                </button>
              ))}
            </div>
          )}

          {/* Таблица позиций */}
          {pricesLoading ? (
            <div className="flex items-center gap-2 py-6 justify-center">
              <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              <span className={`text-xs ${theme.sub}`}>Загрузка прайса...</span>
            </div>
          ) : filteredPrices.length === 0 ? (
            <p className={`text-xs ${theme.sub} py-4 text-center`}>Позиции прайса не найдены</p>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb" }}>
                    <th className={`text-left px-3 py-2.5 font-semibold ${theme.sub} w-1/2`}>Позиция</th>
                    <th className="text-center px-3 py-2.5 font-semibold w-28" style={{ color: "#f59e0b" }}>Сложность</th>
                    <th className="text-center px-3 py-2.5 font-semibold w-28" style={{ color: "#8b5cf6" }}>Вес</th>
                    <th className={`text-center px-3 py-2.5 font-semibold w-20 ${theme.sub}`}>Итог</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrices.map((price, idx) => {
                    const item = getItem(price.id);
                    const score = Math.round((item.complexity * item.weight) / 10 * 10) / 10;
                    const scoreColor = score <= 3 ? "#10b981" : score <= 6 ? "#f59e0b" : "#ef4444";
                    return (
                      <tr key={price.id}
                        style={{ borderTop: idx === 0 ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6"}` }}>
                        <td className="px-3 py-2">
                          <div className={`font-medium ${theme.text}`}>{price.name}</div>
                          {price.unit && <div className={`text-[10px] ${theme.sub}`}>{price.unit}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[11px] font-bold" style={{ color: "#f59e0b" }}>{item.complexity}</span>
                            <input type="range" min={1} max={10} step={1}
                              value={item.complexity}
                              disabled={readOnly}
                              onChange={e => updateItem(price.id, { complexity: Number(e.target.value) })}
                              className="w-20 accent-amber-400 cursor-pointer"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[11px] font-bold" style={{ color: "#8b5cf6" }}>{item.weight}</span>
                            <input type="range" min={1} max={10} step={1}
                              value={item.weight}
                              disabled={readOnly}
                              onChange={e => updateItem(price.id, { weight: Number(e.target.value) })}
                              className="w-20 accent-violet-500 cursor-pointer"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs font-bold" style={{ color: scoreColor }}>{score}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Три промпта AI */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <Icon name="Sparkles" size={13} style={{ color: "#a78bfa" }} />
              <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
                AI промпты анализа
              </span>
            </div>

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

            <textarea
              disabled={readOnly}
              rows={8}
              value={complexityPrompts[activePromptTab]}
              onChange={e => setComplexityPrompts(prev => ({ ...prev, [activePromptTab]: e.target.value }))}
              className={`w-full rounded-xl px-3 py-2.5 text-xs font-mono outline-none transition resize-none ${
                isDark
                  ? "bg-white/[0.04] border border-white/10 text-white/75 focus:border-violet-500/50"
                  : "bg-gray-50 border border-gray-200 text-gray-700 focus:border-violet-400"
              }`}
            />

            <div className={`text-[10px] p-2.5 rounded-lg ${isDark ? "bg-white/[0.03]" : "bg-gray-50"}`} style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb"}` }}>
              <span className={`font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Доступные переменные: </span>
              <span className={theme.sub}>
                {activePromptTab === "math" && "{math_score} — итоговый балл, {items_breakdown} — таблица позиций с баллами"}
                {activePromptTab === "semantic" && "{items} — список позиций сметы"}
                {activePromptTab === "combine" && "{math_result} — вывод этапа 1, {semantic_result} — вывод этапа 2, {max_discount} — макс. скидка"}
              </span>
            </div>
          </div>

          {/* Кнопки сохранения */}
          {!readOnly && (
            <div className="flex items-center gap-2 pt-1">
              <button onClick={saveComplexity}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                <Icon name={complexitySaved ? "Check" : "Save"} size={12} />
                {complexitySaved ? "Сохранено" : "Сохранить промпты и формулу"}
              </button>
              <button onClick={() => setComplexityPrompts(DEFAULT_COMPLEXITY_PROMPTS)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80 ${theme.sub}`}
                style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}` }}>
                <Icon name="RotateCcw" size={12} />
                Сбросить промпты
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
