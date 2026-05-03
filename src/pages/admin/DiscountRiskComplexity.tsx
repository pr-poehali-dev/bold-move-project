import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "./api";
import func2url from "@/../backend/func2url.json";
import {
  PriceItem, ComplexityItem, ComplexityPrompts, ThemeClasses,
  COMPLEXITY_LS_KEY, COMPLEXITY_PROMPTS_KEY, COMPLEXITY_FORMULA_KEY,
  loadComplexityItems, saveComplexityItems,
  loadComplexityPrompts, loadFormula,
  getComplexityHint, getWeightHint,
} from "./discountRiskTypes";
import ComplexityKpiCards from "./ComplexityKpiCards";
import ComplexityPriceTable from "./ComplexityPriceTable";
import ComplexityAiPrompts from "./ComplexityAiPrompts";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

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
  const [improvedPrompts,   setImprovedPrompts]   = useState(false);

  // AI оценка
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiTotal,    setAiTotal]    = useState(0);
  const [aiError,    setAiError]    = useState<string | null>(null);
  const [aiDone,     setAiDone]     = useState(false);
  const [aiConfirm,  setAiConfirm]  = useState(false);

  const runAiEvaluation = async () => {
    if (!prices.length || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiDone(false);
    setAiProgress(0);

    const BATCH = 10;
    const batches: PriceItem[][] = [];
    for (let i = 0; i < prices.length; i += BATCH) {
      batches.push(prices.slice(i, i + BATCH));
    }
    setAiTotal(batches.length);

    const newItems: Record<number, ComplexityItem> = { ...complexityItems };

    try {
      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        const res = await fetch(`${AUTH_URL}?action=complexity-eval`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch.map(p => ({ id: p.id, name: p.name })) }),
        }).then(r => r.json());

        if (res.results && Array.isArray(res.results)) {
          res.results.forEach((item: { id: number; complexity: number; weight: number; reason?: string; weight_reason?: string }) => {
            const existing = newItems[item.id];
            // Сохраняем ручные настройки слайдеров если они уже есть,
            // AI обновляет только подсказки + ставит значения если позиция новая
            const aiComplexity = Math.min(10, Math.max(1, Math.round(item.complexity)));
            const aiWeight = Math.min(10, Math.max(1, Math.round(item.weight)));
            newItems[item.id] = {
              priceId: item.id,
              complexity: aiComplexity,   // AI оценить всегда перезаписывает слайдеры
              weight: aiWeight,
              reason: item.reason || "",
              weight_reason: item.weight_reason || "",
              ai_complexity: aiComplexity,
              ai_weight: aiWeight,
            } as ComplexityItem;
          });
        }
        setAiProgress(b + 1);
      }

      setComplexityItems(newItems);
      saveComplexityItems(newItems);
      window.dispatchEvent(new StorageEvent("storage", { key: COMPLEXITY_LS_KEY }));
      setAiDone(true);
      setTimeout(() => setAiDone(false), 4000);
    } catch {
      setAiError("Ошибка AI — попробуй ещё раз");
    } finally {
      setAiLoading(false);
      setAiProgress(0);
      setAiTotal(0);
    }
  };

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

  // Тихий автозапуск подсказок — только для позиций без reason/weight_reason
  useEffect(() => {
    if (prices.length === 0 || readOnly) return;

    // Находим позиции которым нужны подсказки
    const needHints = prices.filter(p => {
      const item = complexityItems[p.id];
      return !item?.reason?.trim() || !item?.weight_reason?.trim();
    });
    if (needHints.length === 0) return;

    const fetchHints = async () => {
      const BATCH = 10;
      // Собираем результаты отдельно, не трогаем complexityItems до конца
      const hintsResult: Record<number, Partial<ComplexityItem>> = {};
      for (let i = 0; i < needHints.length; i += BATCH) {
        const batch = needHints.slice(i, i + BATCH);
        try {
          const res = await fetch(`${AUTH_URL}?action=complexity-eval`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: batch.map(p => ({ id: p.id, name: p.name })) }),
          }).then(r => r.json());
          if (res.results && Array.isArray(res.results)) {
            res.results.forEach((item: { id: number; complexity: number; weight: number; reason?: string; weight_reason?: string }) => {
              const aiComplexity = Math.min(10, Math.max(1, Math.round(item.complexity)));
              const aiWeight = Math.min(10, Math.max(1, Math.round(item.weight)));
              hintsResult[item.id] = {
                reason: item.reason?.trim() || "",
                weight_reason: item.weight_reason?.trim() || "",
                ai_complexity: aiComplexity,
                ai_weight: aiWeight,
              };
            });
          }
        } catch { /* тихо */ }
      }
      // Применяем только подсказки поверх актуального state (не трогаем complexity/weight)
      setComplexityItems(prev => {
        const next = { ...prev };
        for (const [idStr, hints] of Object.entries(hintsResult)) {
          const id = Number(idStr);
          const existing = next[id] || Object.values(next).find(i => i.priceId === id);
          if (existing) {
            next[id] = { ...existing, ...hints };
          } else {
            next[id] = { priceId: id, complexity: 5, weight: 5, ...hints } as ComplexityItem;
          }
        }
        saveComplexityItems(next);
        return next;
      });
    };

    fetchHints();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices]);

  const getItem = (id: number): ComplexityItem =>
    complexityItems[id]
    || Object.values(complexityItems).find(i => i.priceId === id)
    || { priceId: id, complexity: 5, weight: 5 };

  const updateItem = (id: number, patch: Partial<ComplexityItem>) => {
    setComplexityItems(prev => {
      const current = prev[id] || getItem(id);
      const merged = { ...current, ...patch };
      // Если пользователь изменил complexity — обновляем reason под новое значение
      if ("complexity" in patch) {
        merged.reason = getComplexityHint(patch.complexity!);
        merged.ai_complexity = patch.complexity;
      }
      if ("weight" in patch) {
        merged.weight_reason = getWeightHint(patch.weight!);
        merged.ai_weight = patch.weight;
      }
      const next = { ...prev, [id]: merged };
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

  const handleImprovePrompts = () => {
    import("./discountRiskTypes").then(({ DEFAULT_COMPLEXITY_PROMPTS: improved }) => {
      setComplexityPrompts(improved);
      localStorage.setItem(COMPLEXITY_PROMPTS_KEY, JSON.stringify(improved));
      localStorage.setItem(COMPLEXITY_FORMULA_KEY, formula);
      window.dispatchEvent(new StorageEvent("storage", { key: COMPLEXITY_LS_KEY }));
      setImprovedPrompts(true);
      // Переключаем таб на «Объединение» чтобы сразу видеть ключевой промпт
      setActivePromptTab("combine");
      setTimeout(() => setImprovedPrompts(false), 3000);
    });
  };

  // Вычисления
  const totalWeightedScore = prices.length > 0
    ? Math.round(prices.reduce((s, p) => s + getItem(p.id).complexity * getItem(p.id).weight / 10, 0) * 10) / 10
    : 0;
  const avgScore = prices.length > 0
    ? Math.round(totalWeightedScore / prices.length * 10) / 10
    : 0;
  const maxPossibleScore = prices.length * 10;
  const complexityPct = maxPossibleScore > 0
    ? Math.round(totalWeightedScore / maxPossibleScore * 100)
    : 0;
  const riskMaxDiscount = (() => {
    try { return JSON.parse(localStorage.getItem("discount_risk_settings") || "{}").max_discount || 30; }
    catch { return 30; }
  })();
  const recommendedDiscount = Math.round(riskMaxDiscount * (1 - complexityPct / 100));
  const complexityColor = complexityPct <= 30 ? "#10b981" : complexityPct <= 60 ? "#f59e0b" : "#ef4444";
  const complexityLabel = complexityPct <= 30 ? "Простые объекты" : complexityPct <= 60 ? "Средняя сложность" : "Сложные объекты";

  return (
    <div className="space-y-5">

      {/* KPI блоки */}
      {prices.length > 0 && (
        <ComplexityKpiCards
          isDark={isDark}
          totalWeightedScore={totalWeightedScore}
          avgScore={avgScore}
          maxPossibleScore={maxPossibleScore}
          complexityPct={complexityPct}
          complexityColor={complexityColor}
          complexityLabel={complexityLabel}
          recommendedDiscount={recommendedDiscount}
          riskMaxDiscount={riskMaxDiscount}
          pricesCount={prices.length}
        />
      )}

      {/* Таблица позиций */}
      <ComplexityPriceTable
        isDark={isDark}
        theme={theme}
        readOnly={readOnly}
        prices={prices}
        pricesLoading={pricesLoading}
        complexityItems={complexityItems}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        savedItems={savedItems}
        aiLoading={aiLoading}
        aiProgress={aiProgress}
        aiTotal={aiTotal}
        aiError={aiError}
        aiDone={aiDone}
        avgScore={avgScore}
        totalWeightedScore={totalWeightedScore}
        formula={formula}
        setFormula={setFormula}
        onAiEvaluate={() => setAiConfirm(true)}
        onAiErrorClose={() => setAiError(null)}
        onSaveItems={handleSaveItems}
        onResetAll={resetAll}
        onUpdateItem={updateItem}
      />

      {/* Модальное предупреждение перед AI оценкой */}
      {aiConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{ background: isDark ? "#0f0f1a" : "#fff", border: "1px solid rgba(139,92,246,0.3)" }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <span style={{ color: "#ef4444", fontSize: 18 }}>⚠️</span>
              </div>
              <div>
                <div className="font-bold text-sm mb-1" style={{ color: isDark ? "#fff" : "#111" }}>
                  AI перезапишет все текущие оценки
                </div>
                <div className="text-xs leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "#6b7280" }}>
                  Все значения сложности и влияния на скидку, которые ты настроил вручную, будут заменены оценками AI.
                  <br /><br />
                  <span style={{ color: "#ef4444", fontWeight: 600 }}>Этот процесс невозможно отменить.</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setAiConfirm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", color: isDark ? "rgba(255,255,255,0.6)" : "#6b7280" }}>
                Отмена
              </button>
              <button onClick={() => { setAiConfirm(false); runAiEvaluation(); }}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition"
                style={{ background: "rgba(139,92,246,0.9)", color: "#fff" }}>
                Да, запустить AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI промпты */}
      <ComplexityAiPrompts
        isDark={isDark}
        theme={theme}
        readOnly={readOnly}
        formula={formula}
        setFormula={setFormula}
        complexityPrompts={complexityPrompts}
        setComplexityPrompts={setComplexityPrompts}
        activePromptTab={activePromptTab}
        setActivePromptTab={setActivePromptTab}
        savedPrompts={savedPrompts}
        onSavePrompts={handleSavePrompts}
        onImprovePrompts={handleImprovePrompts}
        improvedPrompts={improvedPrompts}
      />

    </div>
  );
}