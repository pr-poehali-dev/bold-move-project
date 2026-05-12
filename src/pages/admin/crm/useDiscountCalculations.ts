import { useMemo } from "react";
import { Client } from "./crmApi";
import { CustomFinRow } from "./drawerTypes";
import { RiskSettings } from "./discountBlockTypes";
import { DiscountEntry } from "@/hooks/useDiscountHistory";

interface Params {
  data: Client;
  customFinRows: CustomFinRow[];
  discount: number;
  discountHistory: DiscountEntry[];
  risk: RiskSettings;
  reserve: number;
  customMax: number | null;
}

export function useDiscountCalculations({
  data, customFinRows, discount, discountHistory, risk, reserve, customMax,
}: Params) {
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

  // baseIncome — всегда оригинальная сумма договора ДО скидок.
  const rawContractSum = Number(data.contract_sum) || 0;
  const baseContractSum = discountHistory.length > 0
    ? Number(discountHistory[0].contract_sum_before) || rawContractSum
    : rawContractSum;
  const baseIncome = baseContractSum + customIncomeRows.reduce((s, r) => s + r.value, 0);

  const breakEvenDiscount = useMemo(() => {
    if (baseIncome <= 0) return 0;
    const d = (1 - plCosts / baseIncome) * 100;
    return Math.max(0, Math.floor(d * 10) / 10);
  }, [baseIncome, plCosts]);

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

  const isRealLoss      = discountedProfit < 0;
  const isOverMinMargin = !isRealLoss && !risk.allow_zero_margin && discountedMargin < risk.min_margin;
  const isNegative      = isRealLoss || isOverMinMargin;
  const isWarning       = !isNegative && discountedMargin < risk.warn_margin;
  const isOverMax       = discount > effectiveMax && effectiveMax > 0;

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

  return {
    plCosts, baseIncome,
    discountedIncome, discountedProfit, discountedMargin,
    isRealLoss, isOverMinMargin, isNegative, isWarning, isOverMax,
    currentZone, accentColor, borderColor,
    effectiveMax, sliderMax, zoneLow, zoneMid,
  };
}
