import { useState, useMemo, useEffect } from "react";
import { Client, crmFetch } from "./crmApi";
import { CustomFinRow } from "./drawerTypes";
import { AUTH_URL, EstimateBlock, parseValue, fmt as fmtEst, pricingRules } from "./estimateTypes";
import func2url from "@/../backend/func2url.json";
import {
  RISK_LS_KEY, COMPLEXITY_LS_KEY, COMPLEXITY_PROMPTS_KEY, COMPLEXITY_FORMULA_KEY,
  ComplexityAnalysis, RiskSettings, AiRisk,
  RISK_DEFAULTS, loadRiskSettings,
} from "./discountBlockTypes";
import { DiscountSliderPanel } from "./DiscountSliderPanel";
import { DiscountAnalysisModal } from "./DiscountAnalysisModal";
import { useDiscountHistory } from "@/hooks/useDiscountHistory";

const GET_PRICES_URL = (func2url as Record<string, string>)["get-prices"];

interface Props {
  data: Client;
  customFinRows: CustomFinRow[];
  onContractSumUpdated?: (newSum: number) => void;
}

export function DrawerDiscountBlock({ data, customFinRows, onContractSumUpdated }: Props) {
  const [discount,  setDiscount]  = useState(0);
  const [applying,  setApplying]  = useState(false);
  const [applied,   setApplied]   = useState(false);
  const [reserve,   setReserve]   = useState(0);
  const [customMax, setCustomMax] = useState<number | null>(null);
  const [aiRisk,    setAiRisk]    = useState<AiRisk | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState<string | null>(null);

  // 3-этапный анализ
  const [analysisOpen,    setAnalysisOpen]    = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStep,    setAnalysisStep]    = useState<0 | 1 | 2 | 3>(0);
  const [analysisError,   setAnalysisError]   = useState<string | null>(null);
  const [analysis,        setAnalysis]        = useState<ComplexityAnalysis | null>(null);

  const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

  // История скидок
  const { history: discountHistory, addEntry, deactivateLast, totalDiscountAmount, lastEntry } = useDiscountHistory(data.id);

  // Настройки управления риском — реактивно обновляются при изменении localStorage
  const [risk, setRisk] = useState<RiskSettings>(loadRiskSettings);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RISK_LS_KEY) setRisk(loadRiskSettings());
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => setRisk(loadRiskSettings());
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("focus", onFocus); };
  }, []);

  // Подавляем lint-предупреждения для неиспользуемых переменных состояния
  void reserve; void setReserve; void customMax; void setCustomMax;
  void aiLoading; void setAiLoading; void aiError; void setAiError; void setAiRisk;
  void RISK_DEFAULTS;

  const customCostRows = customFinRows
    .filter(r => r.block === "costs")
    .map(r => ({ value: Number(localStorage.getItem(`fin_row_${data.id}_${r.key}`)) || 0 }));
  const customIncomeRows = customFinRows
    .filter(r => r.block === "income")
    .map(r => ({ value: Number(localStorage.getItem(`fin_row_${data.id}_${r.key}`)) || 0 }));

  const plCosts = (Number(data.material_cost) || 0)
    + (Number(data.measure_cost) || 0)
    + (Number(data.install_cost) || 0)
    + customCostRows.reduce((s, r) => s + r.value, 0);

  const baseIncome = (Number(data.contract_sum) || 0)
    + customIncomeRows.reduce((s, r) => s + r.value, 0);

  // Точка безубыточности
  const breakEvenDiscount = useMemo(() => {
    if (baseIncome <= 0) return 0;
    const d = (1 - plCosts / baseIncome) * 100;
    return Math.max(0, Math.floor(d * 10) / 10);
  }, [baseIncome, plCosts]);

  // Эффективный максимум = min(правила, заказ, кастом) - резерв
  const effectiveMax = useMemo(() => {
    const base = Math.min(
      customMax ?? risk.max_discount,
      breakEvenDiscount > 0 ? breakEvenDiscount : risk.max_discount
    );
    return Math.max(0, Math.round((base - reserve) * 10) / 10);
  }, [risk.max_discount, customMax, breakEvenDiscount, reserve]);

  const zoneLow   = risk.low_risk_threshold;
  const zoneMid   = risk.mid_risk_threshold;
  const sliderMax = effectiveMax;

  const discountedIncome = baseIncome * (1 - discount / 100);
  const discountedProfit = discountedIncome - plCosts;
  const discountedMargin = baseIncome > 0
    ? Math.round((discountedProfit / baseIncome) * 100)
    : 0;

  // isNegative = только реальный убыток (прибыль < 0)
  // isOverMinMargin = нарушение минимальной маржи (но прибыль ещё положительная)
  const isRealLoss     = discountedProfit < 0;
  const isOverMinMargin = !isRealLoss && !risk.allow_zero_margin && discountedMargin < risk.min_margin;
  const isNegative     = isRealLoss || isOverMinMargin;
  const isWarning      = !isNegative && discountedMargin < risk.warn_margin;
  const isOverMax  = discount > effectiveMax && effectiveMax > 0;

  const currentZone: "none" | "low" | "mid" | "high" = discount === 0 ? "none"
    : discount <= zoneLow ? "low"
    : discount <= zoneMid ? "mid"
    : "high";

  const accentColor = isNegative || isOverMax ? "#ef4444"
    : currentZone === "low"  ? "#10b981"
    : currentZone === "mid"  ? "#f59e0b"
    : currentZone === "high" ? "#ef4444"
    : "#f59e0b";

  const borderColor = isNegative ? "#ef444430" : "#f59e0b25";

  // AI оценка сложности монтажа
  const runAiRisk = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiRisk(null);
    try {
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${data.id}`).then(r => r.json());
      const blocks: EstimateBlock[] = d.estimate?.blocks || [];
      const items: string[] = [];
      for (const block of blocks) {
        for (const item of block.items) {
          if (item.name) items.push(item.name);
        }
      }
      if (items.length === 0) { setAiError("Смета пустая — нечего анализировать"); setAiLoading(false); return; }

      const maxDiscount = effectiveMax || risk.max_discount;
      const customPrompt = localStorage.getItem("discount_risk_ai_prompt") || undefined;

      const aiRes = await fetch(`${AUTH_URL}?action=crm-risk-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, max_discount: maxDiscount, custom_prompt: customPrompt }),
      }).then(r => r.json());

      if (aiRes.error) throw new Error(aiRes.error);
      const parsed: AiRisk = aiRes;
      setAiRisk(parsed);
      const rec = Math.min(parsed.recommended_discount ?? 0, effectiveMax || risk.max_discount);
      setDiscount(rec);
      setApplied(false);
    } catch {
      setAiError("Ошибка AI оценки — попробуй ещё раз");
    } finally {
      setAiLoading(false);
    }
  };
  void runAiRisk;

  // 3-этапный анализ сложности
  const runComplexityAnalysis = async () => {
    setAnalysisLoading(true);
    setAnalysisStep(0);
    setAnalysisError(null);
    setAnalysis(null);
    setAnalysisOpen(true);
    try {
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${data.id}`).then(r => r.json());
      const blocks: EstimateBlock[] = d.estimate?.blocks || [];
      const itemNames: Array<{ name: string; qty: number }> = [];
      for (const block of blocks) {
        for (const item of block.items) {
          if (!item.name) continue;
          const p = parseValue(item.value);
          itemNames.push({ name: item.name, qty: p?.qty || 1 });
        }
      }
      if (itemNames.length === 0) { setAnalysisError("Смета пустая — нечего анализировать"); setAnalysisLoading(false); return; }

      const complexityMap: Record<number, { complexity: number; weight: number }> = (() => {
        try { return JSON.parse(localStorage.getItem(COMPLEXITY_LS_KEY) || "{}"); } catch { return {}; }
      })();
      const prompts = (() => {
        try {
          const p = JSON.parse(localStorage.getItem(COMPLEXITY_PROMPTS_KEY) || "{}");
          return { math: p.math || "", semantic: p.semantic || "", combine: p.combine || "" };
        } catch { return { math: "", semantic: "", combine: "" }; }
      })();
      const formula = localStorage.getItem(COMPLEXITY_FORMULA_KEY) || "Σ(сложность × вес × кол-во) / Σ(вес × кол-во)";
      const maxDiscount = effectiveMax || risk.max_discount;

      const pricesRes = await fetch(GET_PRICES_URL).then(r => r.json());
      const prices: Array<{ id: number; name: string; unit: string }> = pricesRes.prices || [];

      const matchedItems = itemNames.map(({ name, qty }) => {
        const match = prices.find(p =>
          name.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(name.toLowerCase())
        );
        const cfg = match ? (complexityMap[match.id] || { complexity: 5, weight: 5 }) : { complexity: 5, weight: 5 };
        return { name, qty, complexity: cfg.complexity, weight: cfg.weight, unitScore: Math.round(cfg.complexity * cfg.weight / 10 * 10) / 10 };
      });

      // ЭТАП 1 — Математика
      setAnalysisStep(1);
      const totalWeightQty = matchedItems.reduce((s, i) => s + i.weight * i.qty, 0);
      const mathScore = totalWeightQty > 0
        ? Math.round(matchedItems.reduce((s, i) => s + i.complexity * i.weight * i.qty, 0) / totalWeightQty * 10) / 10
        : 5;

      const mathPromptText = (prompts.math || `Математическая оценка сложности объекта: {math_score}/10. Формула: ${formula}. Позиции: {items_breakdown}. Дай краткий вывод.`)
        .replace("{math_score}", String(mathScore))
        .replace("{items_breakdown}", matchedItems.map(i => `${i.name} (сл:${i.complexity}, вес:${i.weight}, кол:${i.qty}) → ${i.unitScore}`).join("; "));

      const mathRes = await fetch(`${AUTH_URL}?action=crm-risk-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [mathPromptText], max_discount: maxDiscount, custom_prompt: mathPromptText, raw_mode: true }),
      }).then(r => r.json());
      const mathResult = mathRes.reason || mathRes.summary || "Математический анализ завершён";

      // ЭТАП 2 — Семантика
      setAnalysisStep(2);
      const semanticPromptText = (prompts.semantic || `Ты эксперт по монтажу натяжных потолков. Список позиций сметы: {items}. Оцени семантически сложность объекта от 1 до 10 и объясни риски.`)
        .replace("{items}", matchedItems.map(i => `${i.name} (${i.qty} шт/м)`).join(", "));

      const semanticRes = await fetch(`${AUTH_URL}?action=crm-risk-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: matchedItems.map(i => i.name), max_discount: maxDiscount, custom_prompt: semanticPromptText, raw_mode: true }),
      }).then(r => r.json());
      const semanticResult = semanticRes.reason || semanticRes.summary || "Семантический анализ завершён";

      // ЭТАП 3 — Объединение
      setAnalysisStep(3);
      const combinePromptText = (prompts.combine || `Два анализа объекта:\nМАТЕМАТИКА: {math_result}\nСЕМАНТИКА: {semantic_result}\nДай итог в JSON: {"score":7,"recommended_discount":5,"level":"high","summary":"текст"}`)
        .replace("{math_result}", mathResult)
        .replace("{semantic_result}", semanticResult)
        .replace("{max_discount}", String(maxDiscount));

      const combineRes = await fetch(`${AUTH_URL}?action=crm-risk-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: matchedItems.map(i => i.name), max_discount: maxDiscount, custom_prompt: combinePromptText }),
      }).then(r => r.json());

      let combineResult = null;
      try {
        const raw = combineRes.reason || combineRes.summary || "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) combineResult = JSON.parse(jsonMatch[0]);
      } catch { /* не страшно */ }

      if (!combineResult) {
        combineResult = {
          score: mathScore,
          recommended_discount: combineRes.recommended_discount ?? Math.round(maxDiscount * (1 - mathScore / 10)),
          level: combineRes.level ?? (mathScore <= 3 ? "low" : mathScore <= 6 ? "mid" : "high"),
          summary: combineRes.reason || combineRes.summary || "Анализ завершён",
        };
      }

      setAnalysis({ mathScore, mathResult, semanticResult, combineResult, items: matchedItems });

      const rec = Math.min(combineResult.recommended_discount ?? 0, maxDiscount);
      setDiscount(rec);
      setApplied(false);

    } catch {
      setAnalysisError("Ошибка анализа — попробуй ещё раз");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Сбросить последнюю скидку из истории
  const resetDiscount = async () => {
    if (!lastEntry) return;
    setApplying(true);
    try {
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${data.id}`).then(r => r.json());
      if (!d.estimate) return;
      // Восстанавливаем сумму до последней скидки напрямую (не пересчёт позиций)
      const targetSum = lastEntry.contract_sum_before;
      const currentSum = Number(data.contract_sum) || 0;
      const mult = currentSum > 0 ? targetSum / currentSum : 1;
      const newBlocks: EstimateBlock[] = d.estimate.blocks.map((block: EstimateBlock) => ({
        ...block,
        items: block.items.map(item => {
          const p = parseValue(item.value);
          if (!p) return item;
          const newPrice = Math.round(p.price * mult);
          const newTotal = Math.round(p.qty * newPrice);
          return { ...item, value: `${p.qty} ${p.unit} × ${newPrice} ₽ = ${fmtEst(newTotal)} ₽` };
        }),
      }));
      let standard = 0;
      for (const block of newBlocks)
        for (const item of block.items) { const p = parseValue(item.value); if (p) standard += p.total; }
      const econom  = Math.round(standard * pricingRules.econom_mult);
      const premium = Math.round(standard * pricingRules.premium_mult);
      const newTotals = [
        `${pricingRules.econom_label}: ${fmtEst(econom)} ₽`,
        `${pricingRules.standard_label}: ${fmtEst(standard)} ₽`,
        `${pricingRules.premium_label}: ${fmtEst(premium)} ₽`,
      ];
      await fetch(`${AUTH_URL}?action=update-estimate&id=${d.estimate.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: newBlocks, totals: newTotals }),
      });
      // Вычисляем суммарную скидку без последней записи
      const remainingHistory = discountHistory.slice(0, -1);
      const remainingPct = remainingHistory.length > 0
        ? remainingHistory[remainingHistory.length - 1].discount_pct : null;
      const remainingAmt = remainingHistory.reduce((s, e) => s + Number(e.discount_amount), 0);
      await crmFetch("clients", { method: "PUT", body: JSON.stringify({
        contract_sum: standard,
        discount_pct: remainingPct,
        discount_amount: remainingAmt > 0 ? remainingAmt : null,
      }) }, { id: String(data.id) });
      await deactivateLast();
      onContractSumUpdated?.(standard);
      setApplied(false);
    } finally { setApplying(false); }
  };

  // Обновить существующую скидку (изменить %)
  const updateDiscount = async (newPct: number) => {
    if (!lastEntry || newPct <= 0) return;
    setApplying(true);
    try {
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${data.id}`).then(r => r.json());
      if (!d.estimate) return;
      // Сначала откатываем к оригинальной сумме, потом применяем новый %
      const originalSum = lastEntry.contract_sum_before;
      const currentSum  = Number(data.contract_sum) || 0;
      const restoreMult = currentSum > 0 ? originalSum / currentSum : 1;
      const applyMult   = (1 - newPct / 100);
      const totalMult   = restoreMult * applyMult;
      const newBlocks: EstimateBlock[] = d.estimate.blocks.map((block: EstimateBlock) => ({
        ...block,
        items: block.items.map(item => {
          const p = parseValue(item.value);
          if (!p) return item;
          const newPrice = Math.round(p.price * totalMult);
          const newTotal = Math.round(p.qty * newPrice);
          return { ...item, value: `${p.qty} ${p.unit} × ${newPrice} ₽ = ${fmtEst(newTotal)} ₽` };
        }),
      }));
      let standard = 0;
      for (const block of newBlocks)
        for (const item of block.items) { const p = parseValue(item.value); if (p) standard += p.total; }
      const econom  = Math.round(standard * pricingRules.econom_mult);
      const premium = Math.round(standard * pricingRules.premium_mult);
      const newTotals = [
        `${pricingRules.econom_label}: ${fmtEst(econom)} ₽`,
        `${pricingRules.standard_label}: ${fmtEst(standard)} ₽`,
        `${pricingRules.premium_label}: ${fmtEst(premium)} ₽`,
      ];
      await fetch(`${AUTH_URL}?action=update-estimate&id=${d.estimate.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: newBlocks, totals: newTotals }),
      });
      const newAmount = Math.round(originalSum * newPct / 100);
      // Деактивируем старую запись и добавляем новую
      await deactivateLast();
      await addEntry({
        discount_pct: newPct,
        discount_amount: newAmount,
        contract_sum_before: originalSum,
        contract_sum_after: standard,
      });
      await crmFetch("clients", { method: "PUT", body: JSON.stringify({
        contract_sum: standard,
        discount_pct: newPct,
        discount_amount: newAmount,
      }) }, { id: String(data.id) });
      onContractSumUpdated?.(standard);
    } finally { setApplying(false); }
  };

  // Применить скидку к позициям сметы
  const applyDiscount = async () => {
    if (discount === 0 || isNegative || isOverMax) return;
    setApplying(true);
    setApplied(false);
    try {
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${data.id}`).then(r => r.json());
      if (!d.estimate) return;
      const mult = 1 - discount / 100;
      const newBlocks: EstimateBlock[] = d.estimate.blocks.map((block: EstimateBlock) => ({
        ...block,
        items: block.items.map(item => {
          const p = parseValue(item.value);
          if (!p) return item;
          const newPrice = Math.round(p.price * mult);
          const newTotal = Math.round(p.qty * newPrice);
          return { ...item, value: `${p.qty} ${p.unit} × ${newPrice} ₽ = ${fmtEst(newTotal)} ₽` };
        }),
      }));
      let standard = 0;
      for (const block of newBlocks)
        for (const item of block.items) { const p = parseValue(item.value); if (p) standard += p.total; }
      const econom  = Math.round(standard * pricingRules.econom_mult);
      const premium = Math.round(standard * pricingRules.premium_mult);
      const newTotals = [
        `${pricingRules.econom_label}: ${fmtEst(econom)} ₽`,
        `${pricingRules.standard_label}: ${fmtEst(standard)} ₽`,
        `${pricingRules.premium_label}: ${fmtEst(premium)} ₽`,
      ];
      await fetch(`${AUTH_URL}?action=update-estimate&id=${d.estimate.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: newBlocks, totals: newTotals }),
      });
      const discountAmt = Math.round(baseIncome * discount / 100);
      const contractBefore = Number(data.contract_sum) || 0;
      await crmFetch("clients", { method: "PUT", body: JSON.stringify({
        contract_sum: standard,
        discount_pct: discount,
        discount_amount: discountAmt,
      }) }, { id: String(data.id) });
      await addEntry({
        discount_pct: discount,
        discount_amount: discountAmt,
        contract_sum_before: contractBefore,
        contract_sum_after: standard,
      });
      onContractSumUpdated?.(standard);
      setApplied(true);
      setDiscount(0);
    } finally { setApplying(false); }
  };

  if (baseIncome <= 0 && plCosts <= 0) return null;

  return (
    <>
      <DiscountSliderPanel
        discount={discount}
        setDiscount={setDiscount}
        applying={applying}
        applied={applied}
        analysisLoading={analysisLoading}
        baseIncome={baseIncome}
        discountedIncome={discountedIncome}
        discountedProfit={discountedProfit}
        discountedMargin={discountedMargin}
        isNegative={isNegative}
        isRealLoss={isRealLoss}
        isOverMinMargin={isOverMinMargin}
        isWarning={isWarning}
        isOverMax={isOverMax}
        currentZone={currentZone}
        accentColor={accentColor}
        borderColor={borderColor}
        effectiveMax={effectiveMax}
        sliderMax={sliderMax}
        zoneLow={zoneLow}
        zoneMid={zoneMid}
        risk={risk}
        aiRisk={aiRisk}
        aiError={aiError}
        fmt={fmt}
        onAnalysisClick={runComplexityAnalysis}
        onApplyDiscount={applyDiscount}
        onResetDiscount={resetDiscount}
        onUpdateDiscount={updateDiscount}
        hasAppliedDiscount={discountHistory.length > 0}
        appliedDiscountPct={lastEntry?.discount_pct ?? 0}
        discountHistory={discountHistory}
        totalDiscountAmount={totalDiscountAmount}
        applying={applying}
        setApplied={setApplied}
      />

      {analysisOpen && (
        <DiscountAnalysisModal
          analysisLoading={analysisLoading}
          analysisStep={analysisStep}
          analysisError={analysisError}
          analysis={analysis}
          onClose={() => setAnalysisOpen(false)}
        />
      )}
    </>
  );
}