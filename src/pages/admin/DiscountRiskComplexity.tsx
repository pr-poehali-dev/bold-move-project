import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
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
  const [prices,          setPrices]          = useState<PriceItem[]>([]);
  const [pricesLoading,   setPricesLoading]   = useState(false);
  const [complexityItems, setComplexityItems] = useState<Record<number, ComplexityItem>>(loadComplexityItems);
  const [savedItems,      setSavedItems]      = useState(false);
  const [categoryFilter,  setCategoryFilter]  = useState<string>("all");
  const [complexityPrompts, setComplexityPrompts] = useState<ComplexityPrompts>(loadComplexityPrompts);
  const [formula,           setFormula]           = useState(loadFormula);
  const [activePromptTab,   setActivePromptTab]   = useState<"math" | "semantic" | "combine">("math");
  const [savedPrompts,      setSavedPrompts]      = useState(false);

  const loadPrices = useCallback(async () => {
    if (prices.length > 0) return;
    setPricesLoading(true);
    try {
      const r = await apiFetch("prices");
      if (r.ok) {
        const d = await r.json();
        setPrices((d.items || []).filter((p: PriceItem) => p.active !== false));
      } else {
        setPrices([]);
      }
    } catch {
      setPrices([]);
    } finally {
      setPricesLoading(false);
    }
  }, [prices.length]);

  useEffect(() => { loadPrices(); }, [loadPrices]);

  const getItem = (id: number): ComplexityItem =>
    complexityItems[id] || { priceId: id, complexity: 5, weight: 5 };

  const updateItem = (id: number, patch: Partial<ComplexityItem>) => {
    setComplexityItems(prev => {
      const next = { ...prev, [id]: { ...getItem(id), ...patch } };
      saveComplexityItems(next);
      return next;
    });
    setSavedItems(false);
  };

  const handleSaveItems = () => {
    saveComplexityItems(complexityItems);
    window.dispatchEvent(new StorageEvent("storage", { key: COMPLEXITY_LS_KEY }));
    setSavedItems(true);
    setTimeout(() => setSavedItems(false), 2000);
  };

  const resetAll = () => {
    const reset: Record<number, ComplexityItem> = {};
    prices.forEach(p => { reset[p.id] = { priceId: p.id, complexity: 5, weight: 5 }; });
    setComplexityItems(reset);
    saveComplexityItems(reset);
    window.dispatchEvent(new StorageEvent("storage", { key: COMPLEXITY_LS_KEY }));
  };

  const handleSavePrompts = () => {
    localStorage.setItem(COMPLEXITY_PROMPTS_KEY, JSON.stringify(complexityPrompts));
    localStorage.setItem(COMPLEXITY_FORMULA_KEY, formula);
    window.dispatchEvent(new StorageEvent("storage", { key: COMPLEXITY_LS_KEY }));
    setSavedPrompts(true);
    setTimeout(() => setSavedPrompts(false), 2000);
  };

  const categories = Array.from(new Set(prices.map(p => p.category).filter(Boolean)));
  const filteredPrices = categoryFilter === "all" ? prices : prices.filter(p => p.category === categoryFilter);
  const byCategory: Record<string, PriceItem[]> = {};
  filteredPrices.forEach(p => {
    const cat = p.category || "Без категории";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });

  const avgScore = prices.length > 0
    ? Math.round(prices.reduce((s, p) => s + getItem(p.id).complexity * getItem(p.id).weight / 10, 0) / prices.length * 10) / 10
    : 0;
  const totalWeightedScore = prices.length > 0
    ? Math.round(prices.reduce((s, p) => s + getItem(p.id).complexity * getItem(p.id).weight / 10, 0) * 10) / 10
    : 0;

  const border2 = isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6";

  return (
    <div className="space-y-5">

      {/* ── ТАБЛИЦА ПОЗИЦИЙ ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl overflow-hidden ${theme.bg} border ${theme.border}`}>

        {/* Шапка блока */}
        <div className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${border2}` }}>
          <Icon name="Table2" size={14} style={{ color: "#a78bfa" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"} flex-1`}>
            Позиции прайса
          </span>
          {prices.length > 0 && (
            <>
              <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>
                ср. {avgScore}/10
              </span>
              <span className={`text-[10px] ${theme.sub}`}>{prices.length} позиций</span>
            </>
          )}
        </div>

        {/* Фильтр категорий */}
        {categories.length > 1 && (
          <div className="px-4 pt-2 pb-2 flex flex-wrap gap-1.5"
            style={{ borderBottom: `1px solid ${border2}` }}>
            <button onClick={() => setCategoryFilter("all")}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition"
              style={{
                background: categoryFilter === "all" ? "rgba(139,92,246,0.2)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                color: categoryFilter === "all" ? "#a78bfa" : isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
                border: `1px solid ${categoryFilter === "all" ? "rgba(139,92,246,0.4)" : "transparent"}`,
              }}>
              Все
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition"
                style={{
                  background: categoryFilter === cat ? "rgba(139,92,246,0.2)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                  color: categoryFilter === cat ? "#a78bfa" : isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
                  border: `1px solid ${categoryFilter === cat ? "rgba(139,92,246,0.4)" : "transparent"}`,
                }}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Загрузка / пусто */}
        {pricesLoading ? (
          <div className="flex items-center gap-2 py-12 justify-center">
            <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <span className={`text-xs ${theme.sub}`}>Загрузка прайса...</span>
          </div>
        ) : filteredPrices.length === 0 ? (
          <p className={`text-xs ${theme.sub} py-10 text-center`}>Позиции прайса не найдены</p>
        ) : (
          <>
            {/* Формула */}
            <div className="px-4 py-2 flex items-center gap-3"
              style={{ borderBottom: `1px solid ${border2}` }}>
              <span className={`text-[10px] font-semibold flex-shrink-0 ${theme.sub}`}>Формула итога:</span>
              <input type="text" value={formula} onChange={e => setFormula(e.target.value)} disabled={readOnly}
                className={`flex-1 rounded-lg px-2.5 py-1 text-[10px] font-mono outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`}
                placeholder="сл × вес / 10" />
              <span className="text-[10px] px-2.5 py-1 rounded-md font-bold flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                Σ = {totalWeightedScore}
              </span>
            </div>

            {/* Таблица */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 640 }}>
                <thead>
                  <tr style={{
                    background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb",
                    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
                  }}>
                    {/* Название */}
                    <th className="text-left px-4 py-0" style={{ minWidth: 160, verticalAlign: "top" }}>
                      <div className="py-2.5">
                        <div className={`font-semibold ${theme.sub}`}>Название</div>
                      </div>
                    </th>

                    {/* Сложность */}
                    <th className="text-left px-4 py-0" style={{ width: "35%", verticalAlign: "top" }}>
                      <div className="py-2.5">
                        <div className="font-bold" style={{ color: "#f59e0b" }}>
                          Сложность монтажа <span className="font-normal text-[10px]">1–10</span>
                        </div>
                        <div className="text-[9px] font-normal mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
                          Насколько трудно выполнить — 1 просто, 10 очень сложно
                        </div>
                      </div>
                    </th>

                    {/* Вес */}
                    <th className="text-left px-4 py-0" style={{ width: "35%", verticalAlign: "top" }}>
                      <div className="py-2.5">
                        <div className="font-bold" style={{ color: "#8b5cf6" }}>
                          Влияние на скидку <span className="font-normal text-[10px]">1–10</span>
                        </div>
                        <div className="text-[9px] font-normal mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
                          Насколько эта позиция влияет на итоговый риск скидки
                        </div>
                      </div>
                    </th>

                    {/* Итог */}
                    <th className="text-center px-4 py-0" style={{ width: 100, verticalAlign: "top" }}>
                      <div className="py-2.5">
                        <div className="font-bold" style={{ color: "#a78bfa" }}>Итог</div>
                        <div className="text-[9px] font-normal mt-0.5 font-mono" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
                          сл × вес / 10
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>

                {Object.entries(byCategory).map(([cat, catPrices]) => {
                  const catAvg = Math.round(
                    catPrices.reduce((s, p) => s + getItem(p.id).complexity * getItem(p.id).weight / 10, 0)
                    / catPrices.length * 10
                  ) / 10;
                  return (
                    <tbody key={cat}>
                      <tr style={{ background: isDark ? "rgba(139,92,246,0.06)" : "rgba(139,92,246,0.04)" }}>
                        <td colSpan={4} className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#a78bfa" }}>{cat}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                              {catPrices.length} поз. · ср. {catAvg}/10
                            </span>
                          </div>
                        </td>
                      </tr>
                      {catPrices.map((price) => {
                        const item  = getItem(price.id);
                        const score = Math.round(item.complexity * item.weight / 10 * 10) / 10;
                        const scoreColor = score <= 3 ? "#10b981" : score <= 6 ? "#f59e0b" : "#ef4444";
                        const scoreBg    = score <= 3 ? "rgba(16,185,129,0.12)" : score <= 6 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)";

                        const numInputCls = `w-10 text-center text-sm font-black rounded-md px-1 py-0.5 outline-none border transition
                          ${isDark
                            ? "bg-white/[0.06] border-white/10 focus:border-violet-500/50 text-white"
                            : "bg-gray-50 border-gray-200 focus:border-violet-400 text-gray-900"}`;

                        return (
                          <tr key={price.id} style={{ borderTop: `1px solid ${border2}` }} className="transition hover:bg-white/[0.015]">

                            {/* 1. Название */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: scoreColor }} />
                                <span className={`font-medium ${theme.text} leading-snug`}>{price.name}</span>
                              </div>
                            </td>

                            {/* 2. Сложность: слайдер + редактируемое поле */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <input type="range" min={1} max={10} step={1}
                                  value={item.complexity} disabled={readOnly}
                                  onChange={e => updateItem(price.id, { complexity: Number(e.target.value) })}
                                  className="flex-1 cursor-pointer" style={{ accentColor: "#f59e0b", height: 4 }} />
                                <input
                                  type="number" min={1} max={10}
                                  value={item.complexity}
                                  disabled={readOnly}
                                  onChange={e => {
                                    const v = Math.min(10, Math.max(1, Number(e.target.value) || 1));
                                    updateItem(price.id, { complexity: v });
                                  }}
                                  className={numInputCls}
                                  style={{ color: "#f59e0b", borderColor: "#f59e0b30" }}
                                />
                              </div>
                            </td>

                            {/* 3. Влияние на скидку: слайдер + редактируемое поле */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <input type="range" min={1} max={10} step={1}
                                  value={item.weight} disabled={readOnly}
                                  onChange={e => updateItem(price.id, { weight: Number(e.target.value) })}
                                  className="flex-1 cursor-pointer" style={{ accentColor: "#8b5cf6", height: 4 }} />
                                <input
                                  type="number" min={1} max={10}
                                  value={item.weight}
                                  disabled={readOnly}
                                  onChange={e => {
                                    const v = Math.min(10, Math.max(1, Number(e.target.value) || 1));
                                    updateItem(price.id, { weight: v });
                                  }}
                                  className={numInputCls}
                                  style={{ color: "#8b5cf6", borderColor: "#8b5cf630" }}
                                />
                              </div>
                            </td>

                            {/* 4. Итог */}
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-sm font-black px-2 py-0.5 rounded-md"
                                  style={{ color: scoreColor, background: scoreBg }}>
                                  {score}
                                </span>
                                <span className="text-[9px] font-mono"
                                  style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#d1d5db" }}>
                                  {item.complexity}×{item.weight}/10
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  );
                })}

                <tfoot>
                  <tr style={{
                    borderTop: `2px solid ${isDark ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.15)"}`,
                    background: isDark ? "rgba(139,92,246,0.05)" : "rgba(139,92,246,0.03)",
                  }}>
                    <td colSpan={3} className="px-4 py-2.5">
                      <span className="text-[11px] font-bold" style={{ color: "#a78bfa" }}>Суммарный удельный вес</span>
                      <span className={`text-[10px] ml-2 ${theme.sub}`}>({filteredPrices.length} позиций)</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-base font-black" style={{ color: "#a78bfa" }}>{totalWeightedScore}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Кнопки */}
            {!readOnly && (
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${border2}` }}>
                <button onClick={handleSaveItems}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                  <Icon name={savedItems ? "Check" : "Save"} size={12} />
                  {savedItems ? "Сохранено" : "Сохранить"}
                </button>
                <button onClick={resetAll}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80 ${theme.sub}`}
                  style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}` }}>
                  <Icon name="RotateCcw" size={12} />
                  Сбросить (5/5)
                </button>
                <span className={`text-[10px] ml-auto ${theme.sub}`}>
                  Среднее: <span style={{ color: "#a78bfa" }}>{avgScore}/10</span>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── AI ПРОМПТЫ ──────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-4 space-y-3 ${theme.bg} border ${theme.border}`}>
        <div className="flex items-center gap-2">
          <Icon name="Sparkles" size={14} style={{ color: "#a78bfa" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
            AI промпты анализа
          </span>
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#a78bfa" }}>
            Формула для AI-контекста
          </label>
          <input type="text" value={formula} onChange={e => setFormula(e.target.value)} disabled={readOnly}
            className={`w-full rounded-lg px-3 py-2 text-xs font-mono outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`}
            placeholder={DEFAULT_FORMULA} />
          <p className={`text-[10px] mt-1 ${theme.sub}`}>Передаётся в AI как описание формулы расчёта</p>
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

        <textarea disabled={readOnly} rows={7}
          value={complexityPrompts[activePromptTab]}
          onChange={e => setComplexityPrompts(prev => ({ ...prev, [activePromptTab]: e.target.value }))}
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
            <button onClick={handleSavePrompts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
              style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
              <Icon name={savedPrompts ? "Check" : "Save"} size={12} />
              {savedPrompts ? "Сохранено" : "Сохранить промпты и формулу"}
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

    </div>
  );
}