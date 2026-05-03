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

const fmt = (n: number | undefined) =>
  n != null ? n.toLocaleString("ru-RU") : "—";

export default function DiscountRiskComplexity({ isDark, theme, readOnly }: Props) {
  const [open,          setOpen]          = useState(false);
  const [innerTab,      setInnerTab]      = useState<"items" | "prompts">("items");

  // Вкладка «Позиции»
  const [prices,          setPrices]          = useState<PriceItem[]>([]);
  const [pricesLoading,   setPricesLoading]   = useState(false);
  const [complexityItems, setComplexityItems] = useState<Record<number, ComplexityItem>>(loadComplexityItems);
  const [savedItems,      setSavedItems]      = useState(false);
  const [categoryFilter,  setCategoryFilter]  = useState<string>("all");

  // Вкладка «AI промпты»
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
        const items: PriceItem[] = (d.items || []).filter((p: PriceItem) => p.active !== false);
        setPrices(items);
      } else {
        setPrices([]);
      }
    } catch {
      setPrices([]);
    } finally {
      setPricesLoading(false);
    }
  }, [prices.length]);

  useEffect(() => {
    if (open) loadPrices();
  }, [open, loadPrices]);

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

  // Группировка по категориям
  const categories = Array.from(new Set(prices.map(p => p.category).filter(Boolean)));
  const filteredPrices = categoryFilter === "all" ? prices : prices.filter(p => p.category === categoryFilter);
  const byCategory: Record<string, PriceItem[]> = {};
  filteredPrices.forEach(p => {
    const cat = p.category || "Без категории";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });

  // Средний удельный вес
  const avgScore = prices.length > 0
    ? Math.round(prices.reduce((s, p) => {
        const it = getItem(p.id);
        return s + (it.complexity * it.weight) / 10;
      }, 0) / prices.length * 10) / 10
    : 0;

  // Итоговый суммарный вес по всем позициям
  const totalWeightedScore = prices.length > 0
    ? Math.round(prices.reduce((s, p) => {
        const it = getItem(p.id);
        return s + (it.complexity * it.weight) / 10;
      }, 0) * 10) / 10
    : 0;

  const border2 = isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6";

  return (
    <div className={`rounded-2xl overflow-hidden ${theme.bg} border ${theme.border}`}>

      {/* Заголовок-аккордеон */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition hover:bg-white/[0.02]">
        <Icon name="Layers" size={14} style={{ color: "#a78bfa" }} />
        <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"} flex-1`}>
          Сложность позиций прайса
        </span>
        {prices.length > 0 && (
          <span className="text-[9px] px-2 py-0.5 rounded-full mr-1"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}>
            ср. {avgScore}/10
          </span>
        )}
        <span className={`text-[9px] ${theme.sub} mr-2`}>
          {prices.length > 0 ? `${prices.length} позиций` : "Вес и сложность для AI"}
        </span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={13}
          style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }} />
      </button>

      {open && (
        <div className="pb-4" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>

          {/* Внутренние вкладки */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex gap-1 p-1 rounded-xl"
              style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
              {([
                { key: "items",   label: "Позиции",    icon: "Table2" },
                { key: "prompts", label: "AI промпты", icon: "Sparkles" },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setInnerTab(tab.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                  style={{
                    background: innerTab === tab.key
                      ? isDark ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.12)"
                      : "transparent",
                    color: innerTab === tab.key ? "#a78bfa" : isDark ? "rgba(255,255,255,0.4)" : "#9ca3af",
                    border: innerTab === tab.key ? "1px solid rgba(139,92,246,0.35)" : "1px solid transparent",
                  }}>
                  <Icon name={tab.icon} size={12} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Вкладка ПОЗИЦИИ ────────────────────────────────────────────── */}
          {innerTab === "items" && (
            <div>
              {/* Фильтр по категории */}
              {categories.length > 1 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
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
                <div className="flex items-center gap-2 py-10 justify-center">
                  <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  <span className={`text-xs ${theme.sub}`}>Загрузка прайса...</span>
                </div>
              ) : filteredPrices.length === 0 ? (
                <p className={`text-xs ${theme.sub} py-8 text-center`}>Позиции прайса не найдены</p>
              ) : (
                <div>
                  {/* Заголовок таблицы */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" style={{ minWidth: 680 }}>
                      <thead>
                        <tr style={{
                          background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb",
                          borderTop: `1px solid ${border2}`,
                          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
                        }}>
                          <th className={`text-left px-4 py-2.5 font-semibold ${theme.sub}`} style={{ width: "35%" }}>
                            Название
                          </th>
                          <th className={`text-right px-3 py-2.5 font-semibold ${theme.sub}`} style={{ width: 80 }}>
                            Продажа ₽
                          </th>
                          <th className={`text-right px-3 py-2.5 font-semibold ${theme.sub}`} style={{ width: 80 }}>
                            Закупка ₽
                          </th>
                          <th className={`text-center px-2 py-2.5 font-semibold ${theme.sub}`} style={{ width: 40 }}>
                            Ед.
                          </th>
                          <th className="text-center px-3 py-2.5 font-semibold" style={{ color: "#f59e0b", width: 130 }}>
                            Сложность <span className={`font-normal ${theme.sub}`}>1–10</span>
                          </th>
                          <th className="text-center px-3 py-2.5 font-semibold" style={{ color: "#8b5cf6", width: 130 }}>
                            Вес <span className={`font-normal ${theme.sub}`}>1–10</span>
                          </th>
                          <th className="text-center px-3 py-2.5 font-semibold" style={{ color: "#a78bfa", width: 60 }}>
                            Итог
                          </th>
                        </tr>
                      </thead>

                      {/* По категориям */}
                      {Object.entries(byCategory).map(([cat, catPrices]) => {
                        const catAvg = Math.round(
                          catPrices.reduce((s, p) => { const it = getItem(p.id); return s + it.complexity * it.weight / 10; }, 0)
                          / catPrices.length * 10
                        ) / 10;

                        return (
                          <tbody key={cat}>
                            {/* Заголовок категории */}
                            <tr style={{ background: isDark ? "rgba(139,92,246,0.06)" : "rgba(139,92,246,0.04)" }}>
                              <td colSpan={7} className="px-4 py-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#a78bfa" }}>
                                    {cat}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                                    style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                                    {catPrices.length} поз. · ср. {catAvg}/10
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Строки позиций */}
                            {catPrices.map((price, idx) => {
                              const item  = getItem(price.id);
                              const score = Math.round(item.complexity * item.weight / 10 * 10) / 10;
                              const scoreColor = score <= 3 ? "#10b981" : score <= 6 ? "#f59e0b" : "#ef4444";
                              const scoreBg    = score <= 3 ? "rgba(16,185,129,0.12)" : score <= 6 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)";

                              return (
                                <tr key={price.id}
                                  style={{ borderTop: idx === 0 ? `1px solid ${border2}` : `1px solid ${border2}` }}
                                  className="transition hover:bg-white/[0.015]">

                                  {/* Название */}
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor }} />
                                      <span className={`font-medium ${theme.text} leading-tight`}>{price.name}</span>
                                    </div>
                                  </td>

                                  {/* Продажа */}
                                  <td className="px-3 py-2 text-right">
                                    <span className="font-semibold" style={{ color: "#10b981" }}>
                                      {price.price != null ? price.price.toLocaleString("ru-RU") : <span className={theme.sub}>—</span>}
                                    </span>
                                  </td>

                                  {/* Закупка */}
                                  <td className="px-3 py-2 text-right">
                                    <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#6b7280" }}>
                                      {fmt(price.purchase_price)}
                                    </span>
                                  </td>

                                  {/* Единица */}
                                  <td className="px-2 py-2 text-center">
                                    <span className={`text-[10px] ${theme.sub}`}>{price.unit || "—"}</span>
                                  </td>

                                  {/* Слайдер Сложность */}
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <input type="range" min={1} max={10} step={1}
                                        value={item.complexity} disabled={readOnly}
                                        onChange={e => updateItem(price.id, { complexity: Number(e.target.value) })}
                                        className="flex-1 cursor-pointer"
                                        style={{ accentColor: "#f59e0b", height: 3 }} />
                                      <span className="text-[11px] font-black w-5 text-right flex-shrink-0"
                                        style={{ color: "#f59e0b" }}>
                                        {item.complexity}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Слайдер Вес */}
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <input type="range" min={1} max={10} step={1}
                                        value={item.weight} disabled={readOnly}
                                        onChange={e => updateItem(price.id, { weight: Number(e.target.value) })}
                                        className="flex-1 cursor-pointer"
                                        style={{ accentColor: "#8b5cf6", height: 3 }} />
                                      <span className="text-[11px] font-black w-5 text-right flex-shrink-0"
                                        style={{ color: "#8b5cf6" }}>
                                        {item.weight}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Итог */}
                                  <td className="px-3 py-2 text-center">
                                    <span className="text-xs font-black px-2 py-0.5 rounded-md"
                                      style={{ color: scoreColor, background: scoreBg }}>
                                      {score}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        );
                      })}

                      {/* Итоговая строка */}
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${isDark ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.15)"}`, background: isDark ? "rgba(139,92,246,0.05)" : "rgba(139,92,246,0.03)" }}>
                          <td colSpan={6} className="px-4 py-2.5">
                            <span className="text-[11px] font-bold" style={{ color: "#a78bfa" }}>
                              Суммарный удельный вес по прайсу
                            </span>
                            <span className={`text-[10px] ml-2 ${theme.sub}`}>
                              Σ(сл × вес / 10) по {prices.length} позициям
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-sm font-black" style={{ color: "#a78bfa" }}>
                              {totalWeightedScore}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Кнопки */}
                  {!readOnly && (
                    <div className="px-4 pt-3 flex items-center gap-2">
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
                </div>
              )}
            </div>
          )}

          {/* ── Вкладка AI ПРОМПТЫ ───────────────────────────────────────── */}
          {innerTab === "prompts" && (
            <div className="px-4 space-y-3 pt-1">

              {/* Формула */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#a78bfa" }}>
                  Формула расчёта удельного веса
                </label>
                <input type="text" value={formula} onChange={e => setFormula(e.target.value)} disabled={readOnly}
                  className={`w-full rounded-lg px-3 py-2 text-xs font-mono outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`}
                  placeholder={DEFAULT_FORMULA} />
                <p className={`text-[10px] mt-1 ${theme.sub}`}>Передаётся в AI как контекст расчёта</p>
              </div>

              {/* Табы промптов */}
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

              <textarea disabled={readOnly} rows={8}
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
                <span className={`font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Доступные переменные: </span>
                <span className={theme.sub}>
                  {activePromptTab === "math" && "{math_score} — итоговый балл, {items_breakdown} — таблица позиций с баллами"}
                  {activePromptTab === "semantic" && "{items} — список позиций сметы"}
                  {activePromptTab === "combine" && "{math_result} — вывод этапа 1, {semantic_result} — вывод этапа 2, {max_discount} — макс. скидка"}
                </span>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-2 pb-1">
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
          )}

        </div>
      )}
    </div>
  );
}