import Icon from "@/components/ui/icon";
import { PriceItem, ComplexityItem, ThemeClasses } from "./discountRiskTypes";

interface Props {
  isDark: boolean;
  theme: ThemeClasses;
  readOnly: boolean;
  prices: PriceItem[];
  pricesLoading: boolean;
  complexityItems: Record<number, ComplexityItem>;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  savedItems: boolean;
  aiLoading: boolean;
  aiProgress: number;
  aiTotal: number;
  aiError: string | null;
  aiDone: boolean;
  avgScore: number;
  totalWeightedScore: number;
  formula: string;
  setFormula: (v: string) => void;
  onAiEvaluate: () => void;
  onAiErrorClose: () => void;
  onSaveItems: () => void;
  onResetAll: () => void;
  onUpdateItem: (id: number, patch: Partial<ComplexityItem>) => void;
}

export default function ComplexityPriceTable({
  isDark, theme, readOnly,
  prices, pricesLoading, complexityItems,
  categoryFilter, setCategoryFilter,
  savedItems, aiLoading, aiProgress, aiTotal, aiError, aiDone,
  avgScore, totalWeightedScore, formula, setFormula,
  onAiEvaluate, onAiErrorClose, onSaveItems, onResetAll, onUpdateItem,
}: Props) {
  const border2 = isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6";

  const getItem = (id: number): ComplexityItem =>
    complexityItems[id] || { priceId: id, complexity: 5, weight: 5 };

  const categories = Array.from(new Set(prices.map(p => p.category).filter(Boolean)));
  const filteredPrices = categoryFilter === "all" ? prices : prices.filter(p => p.category === categoryFilter);
  const byCategory: Record<string, PriceItem[]> = {};
  filteredPrices.forEach(p => {
    const cat = p.category || "Без категории";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });

  const numInputCls = (color: string, borderColor: string) =>
    `w-10 text-center text-sm font-black rounded-md px-1 py-0.5 outline-none border transition
    ${isDark
      ? "bg-white/[0.06] border-white/10 focus:border-violet-500/50 text-white"
      : "bg-gray-50 border-gray-200 focus:border-violet-400 text-gray-900"}`;

  void numInputCls; // used below with inline style override

  return (
    <div className={`rounded-2xl overflow-hidden ${theme.bg} border ${theme.border}`}>

      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${border2}` }}>
        <Icon name="Table2" size={14} style={{ color: "#a78bfa" }} />
        <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"} flex-1`}>
          Позиции прайса
        </span>

        {/* AI кнопка */}
        {prices.length > 0 && !readOnly && (
          <button
            onClick={onAiEvaluate}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80 disabled:opacity-60"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}
            title="AI автоматически оценит сложность и влияние каждой позиции">
            {aiLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                {aiTotal > 0 ? `${aiProgress}/${aiTotal} батчей` : "Оцениваю..."}
              </>
            ) : aiDone ? (
              <><Icon name="CheckCircle2" size={12} /> Готово!</>
            ) : (
              <><Icon name="Sparkles" size={12} /> AI оценить</>
            )}
          </button>
        )}

        {prices.length > 0 && (
          <span className={`text-[10px] ${theme.sub}`}>{prices.length} позиций</span>
        )}
      </div>

      {/* Прогресс AI */}
      {aiLoading && aiTotal > 0 && (
        <div className="px-4 py-2" style={{ borderBottom: `1px solid ${border2}` }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px]" style={{ color: "#a78bfa" }}>
              AI анализирует позиции... {aiProgress * 10}/{prices.length}
            </span>
            <span className="text-[10px]" style={{ color: "#a78bfa" }}>
              {Math.round(aiProgress / aiTotal * 100)}%
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.1)" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.round(aiProgress / aiTotal * 100)}%`, background: "linear-gradient(90deg, #8b5cf6, #a78bfa)" }} />
          </div>
        </div>
      )}

      {/* Ошибка AI */}
      {aiError && (
        <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${border2}` }}>
          <Icon name="AlertCircle" size={12} style={{ color: "#ef4444" }} />
          <span className="text-[10px]" style={{ color: "#ef4444" }}>{aiError}</span>
          <button onClick={onAiErrorClose} className="ml-auto" style={{ color: "rgba(239,68,68,0.5)" }}>
            <Icon name="X" size={10} />
          </button>
        </div>
      )}

      {/* Успех AI */}
      {aiDone && (
        <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${border2}` }}>
          <Icon name="Sparkles" size={12} style={{ color: "#a78bfa" }} />
          <span className="text-[10px]" style={{ color: "#a78bfa" }}>
            AI оценил {prices.length} позиций — проверь результаты и сохрани
          </span>
        </div>
      )}

      {/* Фильтр категорий */}
      {categories.length > 1 && (
        <div className="px-4 pt-2 pb-2 flex gap-1.5 overflow-x-auto" style={{ borderBottom: `1px solid ${border2}` }}>
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
          {/* Строка формулы */}
          <div className="px-4 py-2 flex items-center gap-3" style={{ borderBottom: `1px solid ${border2}` }}>
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
              <thead className="sticky top-0 z-10"
                style={{ background: isDark ? "#0f0f1a" : "#f9fafb" }}>
                <tr style={{
                  borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}`,
                }}>
                  <th className="text-left px-4 py-0" style={{ minWidth: 160, verticalAlign: "top" }}>
                    <div className="py-3">
                      <div className={`font-semibold ${theme.sub}`}>Название позиции</div>
                      <div className="text-[9px] font-normal mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.2)" : "#c4c4c4" }}>
                        из прайса компании
                      </div>
                    </div>
                  </th>
                  <th className="text-left px-4 py-0" style={{ width: "35%", verticalAlign: "top" }}>
                    <div className="py-3">
                      <div className="font-bold" style={{ color: "#f59e0b" }}>
                        Сложность монтажа <span className="font-normal text-[10px]">1–10</span>
                      </div>
                      <div className="text-[9px] font-normal mt-0.5 leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
                        Насколько трудно выполнить физически.<br />
                        <span style={{ color: "#10b981" }}>1–3</span> = просто (профиль, полотно ПВХ)&nbsp;
                        <span style={{ color: "#f59e0b" }}>4–6</span> = средне (ниши, парящий)&nbsp;
                        <span style={{ color: "#ef4444" }}>7–10</span> = сложно (многоуровневый, высота)
                      </div>
                    </div>
                  </th>
                  <th className="text-left px-4 py-0" style={{ width: "35%", verticalAlign: "top" }}>
                    <div className="py-3">
                      <div className="font-bold" style={{ color: "#8b5cf6" }}>
                        Влияние на скидку <span className="font-normal text-[10px]">1–10</span>
                      </div>
                      <div className="text-[9px] font-normal mt-0.5 leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
                        Насколько эта позиция увеличивает риск при скидке.<br />
                        <span style={{ color: "#10b981" }}>1–3</span> = почти не влияет (лента, разводка)&nbsp;
                        <span style={{ color: "#f59e0b" }}>4–6</span> = умеренно (закладная, блок питания)&nbsp;
                        <span style={{ color: "#ef4444" }}>7–10</span> = критично (сложный монтаж, высота)
                      </div>
                    </div>
                  </th>
                  <th className="text-center px-4 py-0" style={{ width: 100, verticalAlign: "top" }}>
                    <div className="py-3">
                      <div className="font-bold" style={{ color: "#a78bfa" }}>Итог</div>
                      <div className="text-[9px] font-normal mt-0.5 font-mono" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
                        сл × вес / 10
                      </div>
                      <div className="text-[9px] font-normal mt-0.5 leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.2)" : "#c4c4c4" }}>
                        чем выше — тем<br />меньше скидки
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
                      const inputCls   = `w-10 text-center text-sm font-black rounded-md px-1 py-0.5 outline-none border transition ${isDark ? "bg-white/[0.06] border-white/10 focus:border-violet-500/50 text-white" : "bg-gray-50 border-gray-200 focus:border-violet-400 text-gray-900"}`;
                      return (
                        <tr key={price.id} style={{ borderTop: `1px solid ${border2}` }} className="transition hover:bg-white/[0.015]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: scoreColor }} />
                              <span className={`font-medium ${theme.text} leading-snug`}>{price.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <input type="range" min={1} max={10} step={1}
                                value={item.complexity} disabled={readOnly}
                                onChange={e => onUpdateItem(price.id, { complexity: Number(e.target.value) })}
                                className="flex-1 cursor-pointer" style={{ accentColor: "#f59e0b", height: 4 }} />
                              <input type="number" min={1} max={10} value={item.complexity} disabled={readOnly}
                                onChange={e => onUpdateItem(price.id, { complexity: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                                className={inputCls} style={{ color: "#f59e0b", borderColor: "#f59e0b30" }} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <input type="range" min={1} max={10} step={1}
                                value={item.weight} disabled={readOnly}
                                onChange={e => onUpdateItem(price.id, { weight: Number(e.target.value) })}
                                className="flex-1 cursor-pointer" style={{ accentColor: "#8b5cf6", height: 4 }} />
                              <input type="number" min={1} max={10} value={item.weight} disabled={readOnly}
                                onChange={e => onUpdateItem(price.id, { weight: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                                className={inputCls} style={{ color: "#8b5cf6", borderColor: "#8b5cf630" }} />
                            </div>
                          </td>
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
              <button onClick={onSaveItems}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                <Icon name={savedItems ? "Check" : "Save"} size={12} />
                {savedItems ? "Сохранено" : "Сохранить"}
              </button>
              <button onClick={onResetAll}
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
  );
}