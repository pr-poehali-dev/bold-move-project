import { Client, crmFetch } from "./crmApi";
import { AUTH_URL, EstimateBlock, parseValue, fmt as fmtEst, pricingRules } from "./estimateTypes";
import { DiscountEntry } from "@/hooks/useDiscountHistory";

interface Params {
  data: Client;
  discount: number;
  baseIncome: number;
  isOverMax: boolean;
  discountHistory: DiscountEntry[];
  lastEntry: DiscountEntry | null;
  addEntry: (entry: Omit<DiscountEntry, "id" | "is_active" | "created_at">) => Promise<unknown>;
  deactivateLast: () => Promise<DiscountEntry | null>;
  setDiscount: (v: number) => void;
  setApplying: (v: boolean) => void;
  setApplied: (v: boolean) => void;
  onContractSumUpdated?: (newSum: number, discountPct: number | null) => void;
}

export function useDiscountActions({
  data, discount, baseIncome, isOverMax,
  discountHistory, lastEntry,
  addEntry, deactivateLast,
  setDiscount, setApplying, setApplied,
  onContractSumUpdated,
}: Params) {

  // Применить скидку к позициям сметы
  const applyDiscount = async (pct?: number, exactAmt?: number) => {
    // Защита от передачи SyntheticEvent вместо числа
    const safePct = typeof pct === "number" && isFinite(pct) ? pct : undefined;
    const safeAmt = typeof exactAmt === "number" && isFinite(exactAmt) ? exactAmt : undefined;
    const effectiveDiscount = safePct ?? discount;
    if (effectiveDiscount === 0 || isOverMax) return;
    if (pct !== undefined) setDiscount(pct);
    setApplying(true);
    setApplied(false);
    try {
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${data.id}`).then(r => r.json());
      if (!d.estimate) return;
      const mult = 1 - effectiveDiscount / 100;
      const newBlocks: EstimateBlock[] = d.estimate.blocks.map((block: EstimateBlock) => ({
        ...block,
        items: block.items.map((item: EstimateBlock["items"][0]) => {
          const p = parseValue(item.value);
          if (!p) return item;
          const newTotal = Math.round(p.qty * p.price * mult);
          const newPrice = p.qty > 0 ? Math.round(newTotal / p.qty) : Math.round(p.price * mult);
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
      const discountAmt = safeAmt ?? Math.round(baseIncome * effectiveDiscount / 100);
      const contractBefore = Number(data.contract_sum) || 0;
      await crmFetch("clients", { method: "PUT", body: JSON.stringify({
        contract_sum: standard,
        discount_pct: effectiveDiscount,
        discount_amount: discountAmt,
      }) }, { id: String(data.id) });
      await addEntry({
        discount_pct: effectiveDiscount,
        discount_amount: discountAmt,
        contract_sum_before: contractBefore,
        contract_sum_after: standard,
      });
      onContractSumUpdated?.(standard, effectiveDiscount);
      setApplied(true);
      setDiscount(0);
    } finally { setApplying(false); }
  };

  // Сбросить последнюю скидку из истории
  const resetDiscount = async () => {
    if (!lastEntry) return;
    setApplying(true);
    try {
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${data.id}`).then(r => r.json());
      if (!d.estimate) return;
      const targetSum = lastEntry.contract_sum_before;
      const currentSum = Number(data.contract_sum) || 0;
      const mult = currentSum > 0 ? targetSum / currentSum : 1;
      const newBlocks: EstimateBlock[] = d.estimate.blocks.map((block: EstimateBlock) => ({
        ...block,
        items: block.items.map((item: EstimateBlock["items"][0]) => {
          const p = parseValue(item.value);
          if (!p) return item;
          const newPrice = Math.round(p.price * mult);
          const newTotal = Math.round(p.qty * newPrice);
          return { ...item, value: `${p.qty} ${p.unit} × ${newPrice} ₽ = ${fmtEst(newTotal)} ₽` };
        }),
      }));
      const standard = targetSum;
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
      onContractSumUpdated?.(standard, remainingPct);
      setApplied(false);
    } finally { setApplying(false); }
  };

  // Обновить существующую скидку (изменить % или сумму)
  const updateDiscount = async (newPct: number, exactAmt?: number) => {
    if (!lastEntry || newPct <= 0) return;
    setApplying(true);
    try {
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${data.id}`).then(r => r.json());
      if (!d.estimate) return;
      const originalSum = lastEntry.contract_sum_before;
      const currentSum  = Number(data.contract_sum) || 0;
      const restoreMult = currentSum > 0 ? originalSum / currentSum : 1;
      const applyMult   = (1 - newPct / 100);
      const totalMult   = restoreMult * applyMult;
      const newBlocks: EstimateBlock[] = d.estimate.blocks.map((block: EstimateBlock) => ({
        ...block,
        items: block.items.map((item: EstimateBlock["items"][0]) => {
          const p = parseValue(item.value);
          if (!p) return item;
          const newTotal = Math.round(p.qty * p.price * totalMult);
          const newPrice = p.qty > 0 ? Math.round(newTotal / p.qty) : Math.round(p.price * totalMult);
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
      const newAmount = exactAmt ?? Math.round(originalSum * newPct / 100);
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
      onContractSumUpdated?.(standard, newPct);
    } finally { setApplying(false); }
  };

  return { applyDiscount, resetDiscount, updateDiscount };
}