import { useState } from "react";
import { AUTH_URL, EstimateBlock, parseValue } from "./estimateTypes";
import { COMPLEXITY_LS_KEY, COMPLEXITY_PROMPTS_KEY, COMPLEXITY_FORMULA_KEY, ComplexityAnalysis, RiskSettings } from "./discountBlockTypes";
import func2url from "@/../backend/func2url.json";

const GET_PRICES_URL = (func2url as Record<string, string>)["get-prices"];

interface Params {
  chatId: number;
  effectiveMax: number;
  risk: RiskSettings;
  setDiscount: (v: number) => void;
  setApplied: (v: boolean) => void;
}

export function useComplexityAnalysis({ chatId, effectiveMax, risk, setDiscount, setApplied }: Params) {
  const [analysisOpen,    setAnalysisOpen]    = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStep,    setAnalysisStep]    = useState<0 | 1 | 2 | 3>(0);
  const [analysisError,   setAnalysisError]   = useState<string | null>(null);
  const [analysis,        setAnalysis]        = useState<ComplexityAnalysis | null>(null);

  const runComplexityAnalysis = async () => {
    setAnalysisLoading(true);
    setAnalysisStep(0);
    setAnalysisError(null);
    setAnalysis(null);
    setAnalysisOpen(true);
    try {
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${chatId}`).then(r => r.json());
      const blocks: EstimateBlock[] = d.estimate?.blocks || [];
      const itemNames: Array<{ name: string; qty: number }> = [];
      for (const block of blocks) {
        for (const item of block.items) {
          if (!item.name) continue;
          const p = parseValue(item.value);
          itemNames.push({ name: item.name, qty: p?.qty || 1 });
        }
      }
      if (itemNames.length === 0) {
        setAnalysisError("Смета пустая — нечего анализировать");
        setAnalysisLoading(false);
        return;
      }

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
          (p.name ?? "").toLowerCase() !== "" && (
            name.toLowerCase().includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(name.toLowerCase())
          )
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
      const semanticPromptText = (prompts.semantic || `Ты бригадир монтажников натяжных потолков с 15-летним опытом. Оцениваешь ТОЛЬКО то, что делает монтажник на объекте.\n\nСписок позиций сметы:\n{items}\n\nЧто монтажник НЕ делает — никогда не упоминай:\n- Раскрой полотна, огарпунивание ПВХ — это производство на заводе, монтажник получает готовое полотно\n- Качество материалов — не его зона\n- Согласование с клиентом, сроки, коммуникации — это менеджер\n- Электрическую и пожарную безопасность — это электрик\n\nЧто реально влияет на сложность монтажа: количество уровней, радиусы, закладные, парящий/теневой профиль, ниши для штор, большая площадь одного полотна, стыковка полотен.\n\nПро светильники GX53, GX70 и аналогичные: вставляются в готовое отверстие за секунды, сложность монтажа = 0. Не упоминай как фактор сложности.\n\nОцени от 1 до 10 (целое число). Напиши 1-2 предложения ТОЛЬКО про реальные монтажные нюансы из этого конкретного списка. Если объект простой — так и напиши.\n\nФормат: "Оценка: X/10. [Пояснение]"`)
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

  return {
    analysisOpen, setAnalysisOpen,
    analysisLoading,
    analysisStep,
    analysisError,
    analysis,
    runComplexityAnalysis,
  };
}