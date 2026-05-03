import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "./api";
import func2url from "@/../backend/func2url.json";
import {
  PriceItem, ComplexityItem, ComplexityPrompts, ThemeClasses,
  COMPLEXITY_LS_KEY, COMPLEXITY_PROMPTS_KEY, COMPLEXITY_FORMULA_KEY,
  loadComplexityItems, saveComplexityItems,
  loadComplexityPrompts, loadFormula,
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

  // AI оценка
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiTotal,    setAiTotal]    = useState(0);
  const [aiError,    setAiError]    = useState<string | null>(null);
  const [aiDone,     setAiDone]     = useState(false);

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
            newItems[item.id] = {
              priceId: item.id,
              complexity: Math.min(10, Math.max(1, Math.round(item.complexity))),
              weight: Math.min(10, Math.max(1, Math.round(item.weight))),
              reason: item.reason || "",
              weight_reason: item.weight_reason || "",
            };
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

  // Автозапуск AI если прайс загружен, но нет полных объяснений (reason + weight_reason)
  useEffect(() => {
    if (prices.length === 0 || aiLoading || readOnly) return;
    const hasFullReasons = Object.values(complexityItems).some(i => i.reason && i.weight_reason);
    if (!hasFullReasons) {
      runAiEvaluation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices]);

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
        onAiEvaluate={runAiEvaluation}
        onAiErrorClose={() => setAiError(null)}
        onSaveItems={handleSaveItems}
        onResetAll={resetAll}
        onUpdateItem={updateItem}
      />

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
      />

    </div>
  );
}