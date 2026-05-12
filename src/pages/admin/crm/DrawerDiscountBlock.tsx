import { useState, useEffect } from "react";
import { Client } from "./crmApi";
import { CustomFinRow } from "./drawerTypes";
import { RISK_LS_KEY, RISK_DEFAULTS, loadRiskSettings } from "./discountBlockTypes";
import { DiscountSliderPanel } from "./DiscountSliderPanel";
import { DiscountAnalysisModal } from "./DiscountAnalysisModal";
import { useDiscountHistory } from "@/hooks/useDiscountHistory";
import { useDiscountCalculations } from "./useDiscountCalculations";
import { useDiscountActions } from "./useDiscountActions";
import { useComplexityAnalysis } from "./useComplexityAnalysis";

void RISK_DEFAULTS;

interface Props {
  data: Client;
  customFinRows: CustomFinRow[];
  onContractSumUpdated?: (newSum: number, discountPct: number | null) => void;
  discountHistoryHook?: ReturnType<typeof useDiscountHistory>;
}

export function DrawerDiscountBlock({ data, customFinRows, onContractSumUpdated, discountHistoryHook }: Props) {
  const [discount,  setDiscount]  = useState(0);
  const [applying,  setApplying]  = useState(false);
  const [applied,   setApplied]   = useState(false);
  const [reserve]                 = useState(0);
  const [customMax]               = useState<number | null>(null);

  // История скидок — используем общий хук из родителя если передан
  const ownHook = useDiscountHistory(data.id);
  const { history: discountHistory, addEntry, deactivateLast, totalDiscountAmount, lastEntry } = discountHistoryHook ?? ownHook;

  // Настройки управления риском — реактивно обновляются при изменении localStorage
  const [risk, setRisk] = useState(loadRiskSettings);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === RISK_LS_KEY) setRisk(loadRiskSettings()); };
    const onFocus   = () => setRisk(loadRiskSettings());
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("focus", onFocus); };
  }, []);

  const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

  // Вычисления
  const calc = useDiscountCalculations({
    data, customFinRows, discount, discountHistory, risk, reserve, customMax,
  });

  // Действия со скидкой
  const { applyDiscount, resetDiscount, updateDiscount } = useDiscountActions({
    data,
    discount,
    baseIncome: calc.baseIncome,
    isOverMax: calc.isOverMax,
    discountHistory,
    lastEntry,
    addEntry,
    deactivateLast,
    setDiscount,
    setApplying,
    setApplied,
    onContractSumUpdated,
  });

  // 3-этапный анализ сложности
  const {
    analysisOpen, setAnalysisOpen,
    analysisLoading, analysisStep, analysisError, analysis,
    runComplexityAnalysis,
  } = useComplexityAnalysis({
    chatId: data.id,
    effectiveMax: calc.effectiveMax,
    risk,
    setDiscount,
    setApplied,
  });

  if (calc.baseIncome <= 0 && calc.plCosts <= 0) return null;

  return (
    <>
      <DiscountSliderPanel
        discount={discount}
        setDiscount={setDiscount}
        applying={applying}
        applied={applied}
        analysisLoading={analysisLoading}
        baseIncome={calc.baseIncome}
        discountedIncome={calc.discountedIncome}
        discountedProfit={calc.discountedProfit}
        discountedMargin={calc.discountedMargin}
        isNegative={calc.isNegative}
        isRealLoss={calc.isRealLoss}
        isOverMinMargin={calc.isOverMinMargin}
        isWarning={calc.isWarning}
        isOverMax={calc.isOverMax}
        currentZone={calc.currentZone}
        accentColor={calc.accentColor}
        borderColor={calc.borderColor}
        effectiveMax={calc.effectiveMax}
        sliderMax={calc.sliderMax}
        zoneLow={calc.zoneLow}
        zoneMid={calc.zoneMid}
        risk={risk}
        aiRisk={null}
        aiError={null}
        fmt={fmt}
        onAnalysisClick={runComplexityAnalysis}
        onApplyDiscount={applyDiscount}
        onResetDiscount={resetDiscount}
        onUpdateDiscount={updateDiscount}
        hasAppliedDiscount={discountHistory.length > 0}
        appliedDiscountPct={lastEntry?.discount_pct ?? 0}
        discountHistory={discountHistory}
        totalDiscountAmount={totalDiscountAmount}
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
