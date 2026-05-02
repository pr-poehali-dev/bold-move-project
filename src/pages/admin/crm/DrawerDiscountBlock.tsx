import { useState, useMemo, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client, crmFetch } from "./crmApi";
import { CustomFinRow } from "./drawerTypes";
import { AUTH_URL, EstimateBlock, parseValue, fmt as fmtEst, pricingRules } from "./estimateTypes";
import func2url from "@/../backend/func2url.json";

const RISK_LS_KEY            = "discount_risk_settings";
const COMPLEXITY_LS_KEY      = "discount_complexity_settings";
const COMPLEXITY_PROMPTS_KEY = "discount_complexity_prompts";
const COMPLEXITY_FORMULA_KEY = "discount_complexity_formula";
const GET_PRICES_URL         = (func2url as Record<string, string>)["get-prices"];

interface ComplexityAnalysis {
  mathScore: number;
  mathResult: string;
  semanticResult: string;
  combineResult: {
    score: number;
    recommended_discount: number;
    level: "low" | "mid" | "high";
    summary: string;
  } | null;
  items: Array<{ name: string; complexity: number; weight: number; qty: number; unitScore: number }>;
}

interface RiskSettings {
  max_discount: number;
  low_risk_threshold: number;
  mid_risk_threshold: number;
  min_margin: number;
  warn_margin: number;
  allow_zero_margin: boolean;
}

const RISK_DEFAULTS: RiskSettings = {
  max_discount: 30,
  low_risk_threshold: 10,
  mid_risk_threshold: 20,
  min_margin: 5,
  warn_margin: 15,
  allow_zero_margin: false,
};

function loadRiskSettings(): RiskSettings {
  try {
    const s = localStorage.getItem(RISK_LS_KEY);
    return s ? { ...RISK_DEFAULTS, ...JSON.parse(s) } : RISK_DEFAULTS;
  } catch { return RISK_DEFAULTS; }
}

interface AiRisk {
  level: "low" | "mid" | "high";
  recommended_discount: number;
  reason: string;
  items: string[];
}

interface Props {
  data: Client;
  customFinRows: CustomFinRow[];
  onContractSumUpdated?: (newSum: number) => void;
}

export function DrawerDiscountBlock({ data, customFinRows, onContractSumUpdated }: Props) {
  const t = useTheme();
  const [discount,    setDiscount]    = useState(0);
  const [applying,    setApplying]    = useState(false);
  const [applied,     setApplied]     = useState(false);
  const [reserve,     setReserve]     = useState(0);       // % непредвиденных рисков
  const [customMax,   setCustomMax]   = useState<number | null>(null); // переопределение max для этого заказа
  const [aiRisk,        setAiRisk]        = useState<AiRisk | null>(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiError,       setAiError]       = useState<string | null>(null);

  // 3-этапный анализ
  const [analysisOpen,   setAnalysisOpen]   = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStep,   setAnalysisStep]   = useState<0 | 1 | 2 | 3>(0);
  const [analysisError,  setAnalysisError]  = useState<string | null>(null);
  const [analysis,       setAnalysis]       = useState<ComplexityAnalysis | null>(null);

  const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

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
  const discountedMargin = discountedIncome > 0
    ? Math.round((discountedProfit / discountedIncome) * 100)
    : 0;

  const isNegative = discountedProfit < 0 || (!risk.allow_zero_margin && discountedMargin < risk.min_margin);
  const isWarning  = !isNegative && discountedMargin < risk.warn_margin;
  const isOverMax  = discount > effectiveMax && effectiveMax > 0;

  const currentZone = discount === 0 ? "none"
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
      // AI сразу выставляет основной слайдер скидки
      const rec = Math.min(parsed.recommended_discount ?? 0, effectiveMax || risk.max_discount);
      setDiscount(rec);
      setApplied(false);
    } catch (e) {
      setAiError("Ошибка AI оценки — попробуй ещё раз");
    } finally {
      setAiLoading(false);
    }
  };

  // 3-этапный анализ сложности
  const runComplexityAnalysis = async () => {
    setAnalysisLoading(true);
    setAnalysisStep(0);
    setAnalysisError(null);
    setAnalysis(null);
    setAnalysisOpen(true);
    try {
      // Загружаем смету
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

      // Загружаем настройки сложности из localStorage
      const complexityMap: Record<number, { complexity: number; weight: number }> = (() => {
        try { return JSON.parse(localStorage.getItem(COMPLEXITY_LS_KEY) || "{}"); } catch { return {}; }
      })();
      const prompts = (() => {
        try {
          const p = JSON.parse(localStorage.getItem(COMPLEXITY_PROMPTS_KEY) || "{}");
          return {
            math: p.math || "",
            semantic: p.semantic || "",
            combine: p.combine || "",
          };
        } catch { return { math: "", semantic: "", combine: "" }; }
      })();
      const formula = localStorage.getItem(COMPLEXITY_FORMULA_KEY) || "Σ(сложность × вес × кол-во) / Σ(вес × кол-во)";
      const maxDiscount = effectiveMax || risk.max_discount;

      // Загружаем прайс чтобы смапить названия → id
      const pricesRes = await fetch(GET_PRICES_URL).then(r => r.json());
      const prices: Array<{ id: number; name: string; unit: string }> = pricesRes.prices || [];

      // Матчинг позиций сметы с прайсом (по вхождению названия)
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
        body: JSON.stringify({ items: [mathPromptText], max_discount: maxDiscount, custom_prompt: "Дай краткий аналитический вывод (2-3 предложения) без рекомендаций по скидке." }),
      }).then(r => r.json());
      const mathResult = mathRes.reason || mathRes.summary || "Математический анализ завершён";

      // ЭТАП 2 — Семантика
      setAnalysisStep(2);
      const semanticPromptText = (prompts.semantic || `Ты эксперт по монтажу натяжных потолков. Список позиций сметы: {items}. Оцени семантически сложность объекта от 1 до 10 и объясни риски.`)
        .replace("{items}", matchedItems.map(i => `${i.name} (${i.qty} шт/м)`).join(", "));

      const semanticRes = await fetch(`${AUTH_URL}?action=crm-risk-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: matchedItems.map(i => i.name), max_discount: maxDiscount, custom_prompt: semanticPromptText }),
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

      // Пробуем распарсить JSON из ответа
      let combineResult = null;
      try {
        const raw = combineRes.reason || combineRes.summary || "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) combineResult = JSON.parse(jsonMatch[0]);
      } catch { /* не страшно */ }

      // Если не удалось — формируем из полей ответа
      if (!combineResult) {
        combineResult = {
          score: mathScore,
          recommended_discount: combineRes.recommended_discount ?? Math.round(maxDiscount * (1 - mathScore / 10)),
          level: combineRes.level ?? (mathScore <= 3 ? "low" : mathScore <= 6 ? "mid" : "high"),
          summary: combineRes.reason || combineRes.summary || "Анализ завершён",
        };
      }

      setAnalysis({ mathScore, mathResult, semanticResult, combineResult, items: matchedItems });

      // Автоматически выставляем скидку в слайдер
      const rec = Math.min(combineResult.recommended_discount ?? 0, maxDiscount);
      setDiscount(rec);
      setApplied(false);

    } catch {
      setAnalysisError("Ошибка анализа — попробуй ещё раз");
    } finally {
      setAnalysisLoading(false);
    }
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
      await crmFetch("clients", { method: "PUT", body: JSON.stringify({ contract_sum: standard }) }, { id: String(data.id) });
      onContractSumUpdated?.(standard);
      setApplied(true);
      setDiscount(0);
    } finally { setApplying(false); }
  };

  if (baseIncome <= 0 && plCosts <= 0) return null;

  const aiLevelColor = aiRisk?.level === "low" ? "#10b981" : aiRisk?.level === "mid" ? "#f59e0b" : "#ef4444";
  const aiLevelLabel = aiRisk?.level === "low" ? "Низкая сложность" : aiRisk?.level === "mid" ? "Средняя сложность" : "Высокая сложность";

  return (
    <>
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${borderColor}`, background: "#f59e0b08" }}>

      {/* Шапка */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <Icon name="Tag" size={13} style={{ color: "#f59e0b" }} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-yellow-400">
          Оценка риска скидки
        </span>
        {/* Кнопка AI */}
        <button onClick={runAiRisk} disabled={aiLoading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition disabled:opacity-50 hover:opacity-80"
          style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
          {aiLoading
            ? <><div className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> AI...</>
            : <><Icon name="Sparkles" size={11} /> Оценить AI</>
          }
        </button>

        {/* Кнопка 3-этапного анализа */}
        <button onClick={runComplexityAnalysis} disabled={analysisLoading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition disabled:opacity-50 hover:opacity-80"
          style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
          {analysisLoading
            ? <><div className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Анализ...</>
            : <><Icon name="BarChart2" size={11} /> Анализ объекта</>
          }
        </button>

      </div>

      <div className="px-4 py-4 space-y-4">

        {/* 4 плитки */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "#ffffff08", border: `1px solid ${t.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1 text-white/40">Скидка</div>
            <div className="text-base font-black" style={{ color: accentColor }}>{discount}%</div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "#ffffff08", border: `1px solid ${t.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1 text-white/40">Сумма скидки</div>
            <div className="text-sm font-black text-white/70">−{fmt(baseIncome * discount / 100)} ₽</div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: isNegative ? "#ef444412" : "#10b98112", border: `1px solid ${isNegative ? "#ef444430" : "#10b98125"}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
              {isNegative ? "Убыток" : "Прибыль"}
            </div>
            <div className="text-sm font-black" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
              {isNegative ? "" : "+"}{fmt(discountedProfit)} ₽
            </div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: isNegative ? "#ef444412" : "#10b98112", border: `1px solid ${isNegative ? "#ef444430" : "#10b98125"}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: isNegative ? "#ef4444" : "#10b981" }}>Маржа</div>
            <div className="text-sm font-black" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
              {isNegative ? "—" : `${discountedMargin}%`}
            </div>
          </div>
        </div>

        {/* Предупреждения */}
        {(isNegative || isOverMax) && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl animate-pulse"
            style={{ background: "#ef444415", border: "1px solid #ef444435" }}>
            <Icon name="AlertTriangle" size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-red-400">Нельзя давать такую скидку</div>
              <div className="text-[10px] text-red-300/70">
                {isOverMax ? `Превышен максимум ${effectiveMax}% для этого заказа` : "Объект становится убыточным"}
              </div>
            </div>
          </div>
        )}
        {isWarning && !isNegative && !isOverMax && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
            <Icon name="AlertCircle" size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <div className="text-[10px] text-yellow-300/80">
              Маржа ниже {risk.warn_margin}% — скидка рискованная
              {currentZone === "high" && " (высокий риск по правилам)"}
            </div>
          </div>
        )}
        {applied && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#10b98115", border: "1px solid #10b98130" }}>
            <Icon name="CheckCircle2" size={14} style={{ color: "#10b981", flexShrink: 0 }} />
            <div className="text-[10px] text-emerald-300">Скидка применена — смета и P&L обновлены</div>
          </div>
        )}

        {/* Шкала + слайдер */}
        <div className="space-y-1">
          {/* Цветная шкала */}
          {(() => {
            const max    = sliderMax || 1;
            const lowPct = Math.min(100, (zoneLow / max) * 100);
            const midPct = Math.min(100, (zoneMid / max) * 100);
            return (
              <div className="relative h-7 rounded-lg overflow-hidden"
                style={{ background: `linear-gradient(90deg, #16a34a 0%, #84cc16 ${lowPct * 0.6}%, #f59e0b ${lowPct}%, #f97316 ${midPct * 0.7}%, #ef4444 ${midPct}%, #dc2626 100%)` }}>
                <div className="absolute inset-0 flex">
                  <div style={{ width: `${lowPct}%` }} className="flex items-center justify-center">
                    {lowPct > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Низкий</span>}
                  </div>
                  <div style={{ width: `${midPct - lowPct}%` }} className="flex items-center justify-center">
                    {(midPct - lowPct) > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Средний</span>}
                  </div>
                  <div style={{ width: `${100 - midPct}%` }} className="flex items-center justify-center">
                    {(100 - midPct) > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Высокий</span>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Метки */}
          <div className="relative h-4">
            <span className="absolute left-0 text-[9px] text-white/30">0%</span>
            {sliderMax > 0 && (() => {
              const lowPct = Math.min(96, (zoneLow / sliderMax) * 100);
              const midPct = Math.min(96, (zoneMid / sliderMax) * 100);
              return (
                <>
                  <span className="absolute text-[9px] font-bold"
                    style={{ left: `${lowPct}%`, color: "#f59e0b", transform: "translateX(-50%)" }}>↑ {zoneLow}%</span>
                  <span className="absolute text-[9px] font-bold"
                    style={{ left: `${midPct}%`, color: "#ef4444", transform: "translateX(-50%)" }}>↑ {zoneMid}%</span>
                </>
              );
            })()}
            <span className="absolute right-0 text-[9px] text-white/30">max {sliderMax}%</span>
          </div>

          {/* Слайдер */}
          <input
            type="range" min={0} max={sliderMax || 1} step={0.5} value={discount}
            onChange={e => { setDiscount(Number(e.target.value)); setApplied(false); }}
            className="w-full cursor-pointer"
            style={{
              accentColor: isNegative || isOverMax ? "#ef4444"
                : currentZone === "low" ? "#10b981"
                : currentZone === "mid" ? "#f59e0b"
                : "#ef4444",
              height: 4,
            }}
          />

          {/* Легенда */}
          <div className="flex flex-wrap gap-3 pt-1">
            {[
              { color: "#10b981", label: "Низкий риск",  range: `0–${zoneLow}%` },
              { color: "#f59e0b", label: "Средний риск", range: `${zoneLow}–${zoneMid}%` },
              { color: "#ef4444", label: "Высокий риск", range: `${zoneMid}–${sliderMax}%` },
            ].map(z => (
              <div key={z.color} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                <span className="text-[10px] font-semibold" style={{ color: z.color }}>{z.label}</span>
                <span className="text-[9px] text-white/25">{z.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Компактный результат AI */}
        {aiError && (
          <div className="text-[10px] text-red-400 px-1">{aiError}</div>
        )}
        {aiRisk && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: aiLevelColor + "12", border: `1px solid ${aiLevelColor}25` }}>
            <div className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0" style={{ background: aiLevelColor }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-bold" style={{ color: aiLevelColor }}>{aiLevelLabel}</span>
                <span className="text-[9px] text-white/30">→ скидка {aiRisk.recommended_discount}% выставлена</span>
              </div>
              <p className="text-[10px] text-white/55">{aiRisk.reason}</p>
              {aiRisk.items.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {aiRisk.items.map((item, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: aiLevelColor + "18", color: aiLevelColor }}>{item}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Футер: итог + кнопка */}
        <div className="flex items-center gap-3">
          {discount > 0 && (
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: "#ffffff06", border: `1px solid ${t.border}` }}>
                <span className="text-[10px] text-white/40">Выручка со скидкой</span>
                <span className="text-[11px] font-bold text-white/70">{fmt(discountedIncome)} ₽</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: isNegative ? "#ef444410" : "#10b98110", border: `1px solid ${isNegative ? "#ef444430" : "#10b98130"}` }}>
                <span className="text-[10px]" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
                  {isNegative ? "Убыток" : "Заработаете"}
                </span>
                <span className="text-[11px] font-bold" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
                  {isNegative ? "" : "+"}{fmt(discountedProfit)} ₽
                </span>
              </div>
            </div>
          )}
          <button
            onClick={applyDiscount}
            disabled={discount === 0 || isNegative || isOverMax || applying}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 flex-shrink-0"
            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
            {applying
              ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Применяем...</>
              : <><Icon name="Percent" size={12} /> Применить скидку</>
            }
          </button>
        </div>

      </div>
    </div>

    {/* Модальное окно — Анализ объекта */}
    {analysisOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={e => { if (e.target === e.currentTarget) setAnalysisOpen(false); }}>
        <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
          style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh" }}>

          {/* Шапка */}
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <Icon name="BarChart2" size={16} style={{ color: "#34d399" }} />
            <span className="text-sm font-bold text-white flex-1">Анализ объекта</span>
            {analysis?.combineResult && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                style={{
                  background: analysis.combineResult.level === "low" ? "#10b98120" : analysis.combineResult.level === "mid" ? "#f59e0b20" : "#ef444420",
                  color: analysis.combineResult.level === "low" ? "#10b981" : analysis.combineResult.level === "mid" ? "#f59e0b" : "#ef4444",
                }}>
                {analysis.combineResult.level === "low" ? "Низкая сложность" : analysis.combineResult.level === "mid" ? "Средняя сложность" : "Высокая сложность"}
              </span>
            )}
            <button onClick={() => setAnalysisOpen(false)} className="ml-1 p-1 rounded-lg hover:bg-white/10 transition">
              <Icon name="X" size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {/* Прогресс этапов */}
            <div className="flex items-center gap-2">
              {[
                { n: 1, label: "Математика",  color: "#10b981" },
                { n: 2, label: "Семантика",   color: "#f59e0b" },
                { n: 3, label: "Объединение", color: "#8b5cf6" },
              ].map((step, i) => {
                const done = analysisStep > step.n || (!analysisLoading && analysis);
                const active = analysisLoading && analysisStep === step.n;
                return (
                  <div key={step.n} className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-1.5 flex-1">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                        style={{
                          background: done || active ? `${step.color}25` : "rgba(255,255,255,0.05)",
                          border: `1px solid ${done || active ? step.color : "rgba(255,255,255,0.1)"}`,
                          color: done || active ? step.color : "rgba(255,255,255,0.3)",
                        }}>
                        {active ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : step.n}
                      </div>
                      <span className="text-[10px] font-semibold" style={{ color: done || active ? step.color : "rgba(255,255,255,0.3)" }}>
                        {step.label}
                      </span>
                    </div>
                    {i < 2 && <div className="w-4 h-px" style={{ background: analysisStep > step.n || (!analysisLoading && analysis) ? step.color : "rgba(255,255,255,0.1)" }} />}
                  </div>
                );
              })}
            </div>

            {/* Ошибка */}
            {analysisError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "#ef444415", border: "1px solid #ef444430" }}>
                <Icon name="AlertTriangle" size={13} style={{ color: "#ef4444" }} />
                <span className="text-xs text-red-400">{analysisError}</span>
              </div>
            )}

            {/* Загрузка */}
            {analysisLoading && !analysisError && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                <span className="text-xs text-white/50">
                  {analysisStep === 1 && "Считаю математику..."}
                  {analysisStep === 2 && "AI анализирует позиции..."}
                  {analysisStep === 3 && "Объединяю результаты..."}
                </span>
              </div>
            )}

            {analysis && (
              <>
                {/* Этап 1 — Математика */}
                <div className="rounded-xl p-4 space-y-2" style={{ background: "#10b98108", border: "1px solid #10b98120" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: "#10b98125", color: "#10b981" }}>1</div>
                    <span className="text-xs font-bold" style={{ color: "#10b981" }}>Математический анализ</span>
                    <span className="ml-auto text-lg font-black" style={{ color: "#10b981" }}>{analysis.mathScore}/10</span>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">{analysis.mathResult}</p>
                  {/* Топ-3 доминирующих позиции */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[...analysis.items].sort((a, b) => b.unitScore - a.unitScore).slice(0, 4).map((item, i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                        {item.name} · {item.unitScore}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Этап 2 — Семантика */}
                <div className="rounded-xl p-4 space-y-2" style={{ background: "#f59e0b08", border: "1px solid #f59e0b20" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: "#f59e0b25", color: "#f59e0b" }}>2</div>
                    <span className="text-xs font-bold" style={{ color: "#f59e0b" }}>Семантический анализ AI</span>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">{analysis.semanticResult}</p>
                </div>

                {/* Этап 3 — Итог */}
                {analysis.combineResult && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "#8b5cf608", border: "1px solid #8b5cf630" }}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: "#8b5cf625", color: "#8b5cf6" }}>3</div>
                      <span className="text-xs font-bold" style={{ color: "#8b5cf6" }}>Итоговая оценка</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Сложность</div>
                        <div className="text-2xl font-black" style={{ color: "#8b5cf6" }}>{analysis.combineResult.score}/10</div>
                      </div>
                      <div className="rounded-lg p-3 text-center" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                        <div className="text-[9px] text-yellow-400/60 uppercase tracking-wider mb-1">Рекомендованная скидка</div>
                        <div className="text-2xl font-black text-yellow-400">{analysis.combineResult.recommended_discount}%</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/65 leading-relaxed">{analysis.combineResult.summary}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Футер */}
          {analysis?.combineResult && (
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-xs text-white/40 flex-1">
                Скидка {analysis.combineResult.recommended_discount}% уже выставлена в слайдер
              </span>
              <button onClick={() => setAnalysisOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold transition hover:opacity-80"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                Применить и закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}