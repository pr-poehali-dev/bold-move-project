import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import {
  PriceItem, ComplexityItem, ThemeClasses,
  COMPLEXITY_LS_KEY,
  loadComplexityItems, saveComplexityItems,
} from "./discountRiskTypes";

interface Props {
  isDark: boolean;
  theme: ThemeClasses;
  readOnly: boolean;
}

export default function DiscountRiskComplexity({ isDark, theme, readOnly }: Props) {
  const [open,            setOpen]            = useState(false);
  const [prices,          setPrices]          = useState<PriceItem[]>([]);
  const [pricesLoading,   setPricesLoading]   = useState(false);
  const [complexityItems, setComplexityItems] = useState<Record<number, ComplexityItem>>(loadComplexityItems);
  const [saved,           setSaved]           = useState(false);
  const [categoryFilter,  setCategoryFilter]  = useState<string>("all");

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
    setSaved(false);
  };

  const handleSave = () => {
    saveComplexityItems(complexityItems);
    window.dispatchEvent(new StorageEvent("storage", { key: COMPLEXITY_LS_KEY }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetAll = () => {
    const reset: Record<number, ComplexityItem> = {};
    prices.forEach(p => { reset[p.id] = { priceId: p.id, complexity: 5, weight: 5 }; });
    setComplexityItems(reset);
    saveComplexityItems(reset);
    window.dispatchEvent(new StorageEvent("storage", { key: COMPLEXITY_LS_KEY }));
  };

  const categories = ["all", ...Array.from(new Set(prices.map(p => p.category).filter(Boolean)))];
  const filteredPrices = categoryFilter === "all" ? prices : prices.filter(p => p.category === categoryFilter);

  // Средний удельный вес по всем позициям (для инфо-плашки)
  const avgScore = prices.length > 0
    ? Math.round(prices.reduce((s, p) => {
        const it = getItem(p.id);
        return s + (it.complexity * it.weight) / 10;
      }, 0) / prices.length * 10) / 10
    : 0;

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
          <span className="text-[9px] px-2 py-0.5 rounded-full mr-2"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}>
            ср. вес {avgScore}/10
          </span>
        )}
        <span className={`text-[9px] ${theme.sub} mr-2`}>{prices.length > 0 ? `${prices.length} позиций` : "Вес и сложность для AI"}</span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={13} style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }} />
      </button>

      {open && (
        <div className="pb-4 space-y-3" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>

          {/* Пояснение формулы */}
          <div className="px-4 pt-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] ${theme.sub}`}
              style={{ background: isDark ? "rgba(139,92,246,0.06)" : "rgba(139,92,246,0.04)", border: `1px solid ${isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.12)"}` }}>
              <Icon name="Info" size={11} style={{ color: "#a78bfa", flexShrink: 0 }} />
              <span>
                Удельный вес = <span style={{ color: "#a78bfa" }}>Сложность × Вес / 10</span>.
                Чем выше итог — тем меньше скидки AI рекомендует для этой позиции.
              </span>
            </div>
          </div>

          {/* Фильтр по категории */}
          {categories.length > 1 && (
            <div className="px-4 flex flex-wrap gap-1.5">
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

          {/* Таблица */}
          {pricesLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              <span className={`text-xs ${theme.sub}`}>Загрузка прайса...</span>
            </div>
          ) : filteredPrices.length === 0 ? (
            <p className={`text-xs ${theme.sub} py-6 text-center`}>Позиции прайса не найдены</p>
          ) : (
            <div className="overflow-x-auto" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6"}` }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb"}` }}>
                    <th className={`text-left px-4 py-2.5 font-semibold ${theme.sub}`}>Название</th>
                    <th className={`text-center px-3 py-2.5 font-semibold ${theme.sub}`} style={{ width: 60 }}>Ед.</th>
                    <th className="text-center px-3 py-2.5 font-semibold" style={{ color: "#f59e0b", width: 140 }}>
                      Сложность <span className={`font-normal ${theme.sub}`}>(1–10)</span>
                    </th>
                    <th className="text-center px-3 py-2.5 font-semibold" style={{ color: "#8b5cf6", width: 140 }}>
                      Вес <span className={`font-normal ${theme.sub}`}>(1–10)</span>
                    </th>
                    <th className="text-center px-3 py-2.5 font-semibold" style={{ color: "#a78bfa", width: 72 }}>
                      Итог
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrices.map((price, idx) => {
                    const item  = getItem(price.id);
                    const score = Math.round(item.complexity * item.weight / 10 * 10) / 10;
                    const scoreColor = score <= 3 ? "#10b981" : score <= 6 ? "#f59e0b" : "#ef4444";
                    const scoreBg    = score <= 3 ? "rgba(16,185,129,0.12)" : score <= 6 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)";
                    return (
                      <tr key={price.id}
                        style={{ borderTop: idx === 0 ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6"}` }}
                        className="group hover:bg-white/[0.015] transition">

                        {/* Название */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scoreColor }} />
                            <span className={`font-medium ${theme.text}`}>{price.name}</span>
                          </div>
                        </td>

                        {/* Единица */}
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[10px] ${theme.sub}`}>{price.unit || "—"}</span>
                        </td>

                        {/* Слайдер Сложность */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-2 w-full">
                              <input type="range" min={1} max={10} step={1}
                                value={item.complexity}
                                disabled={readOnly}
                                onChange={e => updateItem(price.id, { complexity: Number(e.target.value) })}
                                className="flex-1 accent-amber-400 cursor-pointer"
                                style={{ height: 3 }}
                              />
                              <span className="text-[11px] font-black w-4 text-right flex-shrink-0" style={{ color: "#f59e0b" }}>
                                {item.complexity}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Слайдер Вес */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2 w-full">
                            <input type="range" min={1} max={10} step={1}
                              value={item.weight}
                              disabled={readOnly}
                              onChange={e => updateItem(price.id, { weight: Number(e.target.value) })}
                              className="flex-1 accent-violet-500 cursor-pointer"
                              style={{ height: 3 }}
                            />
                            <span className="text-[11px] font-black w-4 text-right flex-shrink-0" style={{ color: "#8b5cf6" }}>
                              {item.weight}
                            </span>
                          </div>
                        </td>

                        {/* Удельный вес */}
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-xs font-black px-2 py-0.5 rounded-md"
                            style={{ color: scoreColor, background: scoreBg }}>
                            {score}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Кнопки */}
          {!readOnly && filteredPrices.length > 0 && (
            <div className="px-4 flex items-center gap-2 pt-1">
              <button onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                <Icon name={saved ? "Check" : "Save"} size={12} />
                {saved ? "Сохранено" : "Сохранить"}
              </button>
              <button onClick={resetAll}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80 ${theme.sub}`}
                style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}` }}>
                <Icon name="RotateCcw" size={12} />
                Сбросить всё (5/5)
              </button>
              <span className={`text-[10px] ml-auto ${theme.sub}`}>Среднее по прайсу: <span style={{ color: "#a78bfa" }}>{avgScore}/10</span></span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
