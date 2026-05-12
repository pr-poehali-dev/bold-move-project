import { useState, useEffect, useRef } from "react";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId, CustomFinRow } from "./drawerTypes";
import { AddFinRowInline, RowWithToggle } from "./DrawerFinRowHelpers";
import { useTheme } from "./themeContext";
import { AutoRulesModal, type CostRowDef } from "./DrawerAutoRulesModal";
import { PaymentStatusBadge, CustomPaymentBadge } from "./PaymentConfirmModal";
import { useAutoRules, RuleEntry } from "@/hooks/useAutoRules";
import { useDiscountHistory } from "@/hooks/useDiscountHistory";
import { loadFinLabels, saveFinLabel, FinBlockProps } from "./DrawerFinLabels";
import { DrawerIncomeAutoSection } from "./DrawerIncomeAutoSection";
import { DrawerCostsAutoSection } from "./DrawerCostsAutoSection";

export type { FinBlockProps };

export function DrawerIncomeBlock({
  data, editingBlock, hiddenBlocks, rowVisibility, customFinRows,
  toggleHidden, setEditingBlock, saveWithLog, logAction,
  toggleRowVisibility, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
  onReload,
}: FinBlockProps) {
  const id: BlockId = "income";
  const isHidden = hiddenBlocks.has(id);
  const incomeEdit = editingBlock === id;
  const { rules: autoRules, auto_mode: autoMode, loading: autoLoading } = useAutoRules();
  const [labels,     setLabels]     = useState<Record<string, string>>(loadFinLabels);
  const [showRules,  setShowRules]  = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => {
    setLabels(prev => ({ ...prev, [key]: label }));
    saveFinLabel(key, label);
  };

  const BUILTIN_INCOME_DEFS: Record<string, string> = {
    contract_sum:  "Сумма договора",
    prepayment:    "Предоплата",
    extra_payment: "Доплата",
  };
  const incomeRows: CostRowDef[] = [
    ...(["contract_sum", "prepayment", "extra_payment"] as const)
      .filter(key => rowVisibility[key] !== false)
      .map(key => ({ key, label: getLabel(key, BUILTIN_INCOME_DEFS[key]) })),
    ...customFinRows
      .filter(r => r.block === "income" && rowVisibility[r.key] !== false)
      .map(r => ({ key: r.key, label: r.label })),
  ];

  const contractSum = Number(data.contract_sum) || 0;
  const incomeRulesMap: Record<string, RuleEntry> = Object.fromEntries(
    autoRules.filter(r => r.row_type === "income").map(r => [r.key, r])
  );

  const isIncomeVisible = (key: string) => {
    const e = incomeRulesMap[key];
    return !e || e.visible !== false;
  };

  const hasIncomeRules = incomeRows.some(row => {
    const e = incomeRulesMap[row.key];
    return e && e.enabled && e.pct != null && e.pct > 0;
  });

  const applyIncomeAutoWithSum = (sum: number) => {
    if (!sum) return;
    const patch: Partial<Client> = {};
    let hasCustom = false;

    incomeRows.forEach(row => {
      const e = incomeRulesMap[row.key];
      if (!e || !e.enabled || !e.pct) return;
      if (row.key === "contract_sum") return;
      const val = Math.round(sum * e.pct / 100);
      if (row.key === "prepayment" || row.key === "extra_payment") {
        (patch as Record<string, unknown>)[row.key] = val;
      } else {
        localStorage.setItem(`fin_row_${data.id}_${row.key}`, String(val));
        hasCustom = true;
      }
    });

    if (Object.keys(patch).length > 0) {
      saveWithLog(patch, "Авто-расчёт доходов по правилу", "Zap", "#10b981");
    } else if (hasCustom) {
      logAction("Zap", "#10b981", "Авто-расчёт доходов по правилу");
    }
    if (Object.keys(patch).length > 0 || hasCustom) setAutoFilled(true);
  };

  const applyIncomeAuto = () => applyIncomeAutoWithSum(contractSum);

  const prevSumRef = useRef<number>(-1);
  const rulesAppliedRef = useRef(false);
  useEffect(() => {
    if (data.id) { prevSumRef.current = -1; rulesAppliedRef.current = false; }
  }, [data.id]);  
  useEffect(() => {
    if (autoLoading || !contractSum || !hasIncomeRules || !autoMode) {
      if (!autoLoading) prevSumRef.current = contractSum;
      return;
    }
    const isFirstRender = prevSumRef.current === -1 || !rulesAppliedRef.current;
    const sumChanged = contractSum !== prevSumRef.current;
    prevSumRef.current = contractSum;

    if (isFirstRender) {
      rulesAppliedRef.current = true;
      const rowsWithRules = incomeRows.filter(row => {
        const e = incomeRulesMap[row.key];
        return e && e.enabled && e.pct != null && e.pct > 0;
      });
      const targetRowsEmpty = rowsWithRules
        .filter(row => row.key !== "contract_sum")
        .every(row => {
          if (row.key === "prepayment" || row.key === "extra_payment") {
            return !data[row.key as keyof Client];
          }
          return !localStorage.getItem(`fin_row_${data.id}_${row.key}`);
        });
      if (rowsWithRules.length > 0 && targetRowsEmpty) applyIncomeAutoWithSum(contractSum);
    } else if (sumChanged) {
      applyIncomeAutoWithSum(contractSum);
    }
  }, [data.id, contractSum, autoMode, autoRules, autoLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {showRules && <AutoRulesModal onClose={() => setShowRules(false)} costRows={incomeRows} defaultTab="income" />}

      <Section icon="Banknote" title="Доходы" color="#10b981"
        hidden={isHidden}
        onToggleHidden={() => toggleHidden(id)}
        onEdit={!isHidden ? () => setEditingBlock(incomeEdit ? null : id) : undefined}>

        {!isHidden && (
          <DrawerIncomeAutoSection
            hasIncomeRules={hasIncomeRules}
            contractSum={contractSum}
            autoMode={autoMode}
            autoFilled={autoFilled}
            onApplyAuto={applyIncomeAuto}
            onOpenRules={() => setShowRules(true)}
            onDismissAutoFilled={() => setAutoFilled(false)}
          />
        )}

        {(["contract_sum", "prepayment", "extra_payment"] as const)
          .filter(key => rowVisibility[key] !== false && isIncomeVisible(key))
          .map(key => {
            const defs: Record<string, { def: string; save: (v: string) => void }> = {
              contract_sum:  { def: "Сумма договора", save: v => saveWithLog({ contract_sum:  +v || null } as Partial<Client>, `Договор: ${(+v).toLocaleString("ru-RU")} ₽`,   "FileText", "#10b981") },
              prepayment:    { def: "Предоплата",     save: v => saveWithLog({ prepayment:    +v || null } as Partial<Client>, `Предоплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet",   "#10b981") },
              extra_payment: { def: "Доплата",        save: v => saveWithLog({ extra_payment: +v || null } as Partial<Client>, `Доплата: +${(+v).toLocaleString("ru-RU")} ₽`,   "Wallet",   "#10b981") },
            };
            const isPayment = key === "prepayment" || key === "extra_payment";
            const badge = isPayment ? (
              <PaymentStatusBadge
                client={data}
                field={key}
                plannedAmount={Number(data[key]) || null}
                label={getLabel(key, defs[key].def)}
                onConfirmed={() => onReload?.()}
              />
            ) : undefined;
            return (
              <RowWithToggle key={key} rowKey={key} visible onToggle={() => {}} editMode={incomeEdit}
                editableLabel={getLabel(key, defs[key].def)} onLabelChange={l => renameLabel(key, l)}
                onDelete={() => toggleRowVisibility(key)}>
                <InlineField label={getLabel(key, defs[key].def)} value={data[key]} onSave={defs[key].save} type="number" placeholder="—" labelExtra={badge} />
              </RowWithToggle>
            );
          })}

        {customFinRows
          .filter(r => r.block === "income" && rowVisibility[r.key] !== false && isIncomeVisible(r.key))
          .map(r => {
            const lsKey = `fin_row_${data.id}_${r.key}`;
            const val = localStorage.getItem(lsKey) || "";
            const customBadge = (
              <CustomPaymentBadge
                clientId={data.id}
                rowKey={r.key}
                plannedAmount={val ? +val : null}
                label={r.label}
              />
            );
            return (
              <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={() => {}} editMode={incomeEdit}
                editableLabel={r.label} onLabelChange={label => updateCustomFinRow(r.key, label)}
                onDelete={() => { deleteCustomFinRow(r.key); }}>
                <InlineField label={r.label} value={val} type="number" placeholder="—"
                  labelExtra={customBadge}
                  onSave={v => { localStorage.setItem(lsKey, v); logAction("Plus", "#10b981", `${r.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
              </RowWithToggle>
            );
          })}

        <AddFinRowInline block="income" onAdd={addCustomFinRow}
          forceOpen={incomeEdit}
          onClose={() => setEditingBlock(null)} />
      </Section>
    </>
  );
}

export function DrawerCostsBlock({
  data, editingBlock, hiddenBlocks, rowVisibility, customFinRows,
  toggleHidden, setEditingBlock, saveWithLog, logAction,
  toggleRowVisibility, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
}: FinBlockProps) {
  const t = useTheme();
  const id: BlockId = "costs";
  const isHidden = hiddenBlocks.has(id);
  const costsEdit = editingBlock === id;
  const { rules: autoRules, auto_mode: autoMode, loading: autoLoading } = useAutoRules();
  const { history: discountHistory, totalDiscountAmount } = useDiscountHistory(data.id);
  const [labels, setLabels] = useState<Record<string, string>>(loadFinLabels);
  const [showRules, setShowRules] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => {
    setLabels(prev => ({ ...prev, [key]: label }));
    saveFinLabel(key, label);
  };

  const BUILTIN_COST_DEFS: Record<string, string> = {
    material_cost: "Материалы",
    measure_cost:  "Замер",
    install_cost:  "Монтаж",
  };

  const costRows: CostRowDef[] = [
    ...(["material_cost", "measure_cost", "install_cost"] as const)
      .filter(key => rowVisibility[key] !== false)
      .map(key => ({ key, label: getLabel(key, BUILTIN_COST_DEFS[key]) })),
    ...customFinRows
      .filter(r => r.block === "costs" && rowVisibility[r.key] !== false)
      .map(r => ({ key: r.key, label: r.label })),
  ];

  const contractSum = Number(data.contract_sum) || 0;
  const rulesMap: Record<string, RuleEntry> = Object.fromEntries(
    autoRules.filter(r => r.row_type === "cost").map(r => [r.key, r])
  );

  const isCostVisible = (key: string) => {
    const e = rulesMap[key];
    return !e || e.visible !== false;
  };

  const hasRules = costRows.some(row => {
    const e = rulesMap[row.key];
    return e && e.enabled && e.pct != null && e.pct > 0;
  });

  const applyAutoWithSum = (sum: number) => {
    if (!sum) return;
    const patch: Partial<Client> = {};
    let hasCustom = false;

    costRows.forEach(row => {
      const e = rulesMap[row.key];
      if (!e || !e.enabled || !e.pct) return;
      const val = Math.round(sum * e.pct / 100);
      if (row.key === "material_cost" || row.key === "measure_cost" || row.key === "install_cost") {
        (patch as Record<string, unknown>)[row.key] = val;
      } else {
        localStorage.setItem(`fin_row_${data.id}_${row.key}`, String(val));
        hasCustom = true;
      }
    });

    if (Object.keys(patch).length > 0) {
      saveWithLog(patch, "Авто-расчёт затрат по правилу", "Zap", "#ef4444");
    } else if (hasCustom) {
      logAction("Zap", "#ef4444", "Авто-расчёт затрат по правилу");
    }
    if (Object.keys(patch).length > 0 || hasCustom) setAutoFilled(true);
  };

  const applyAuto = () => applyAutoWithSum(contractSum);

  const prevContractSumRef = useRef<number>(-1);
  const costsAppliedRef = useRef(false);
  useEffect(() => {
    if (data.id) { prevContractSumRef.current = -1; costsAppliedRef.current = false; }
  }, [data.id]);  
  useEffect(() => {
    // Блокируем авторасчёт затрат если применена скидка.
    // Используем data.discount_pct — оно обновляется в том же PUT что и contract_sum,
    // поэтому нет race condition в отличие от discountHistory (который загружается отдельным запросом)
    const hasDiscount = (Number(data.discount_pct) || 0) > 0 || discountHistory.length > 0;
    if (autoLoading || !contractSum || !hasRules || !autoMode || hasDiscount) {
      if (!autoLoading) prevContractSumRef.current = contractSum;
      return;
    }
    const isFirstRender = prevContractSumRef.current === -1 || !costsAppliedRef.current;
    const sumChanged = contractSum !== prevContractSumRef.current;
    prevContractSumRef.current = contractSum;

    if (isFirstRender) {
      costsAppliedRef.current = true;
      const rowsWithRules = costRows.filter(row => {
        const e = rulesMap[row.key];
        return e && e.enabled && e.pct != null && e.pct > 0;
      });
      const targetRowsEmpty = rowsWithRules.every(row => {
        if (row.key === "material_cost" || row.key === "measure_cost" || row.key === "install_cost") {
          return !data[row.key as keyof Client];
        }
        return !localStorage.getItem(`fin_row_${data.id}_${row.key}`);
      });
      if (rowsWithRules.length > 0 && targetRowsEmpty) applyAutoWithSum(contractSum);
    } else if (sumChanged) {
      applyAutoWithSum(contractSum);
    }
  }, [data.id, contractSum, autoMode, autoRules, autoLoading, discountHistory.length, data.discount_pct]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {showRules && <AutoRulesModal onClose={() => setShowRules(false)} costRows={costRows} />}

      <Section icon="Receipt" title="Затраты" color="#ef4444"
        hidden={isHidden}
        onToggleHidden={() => toggleHidden(id)}
        onEdit={!isHidden ? () => setEditingBlock(costsEdit ? null : id) : undefined}>

        {!isHidden && (
          <DrawerCostsAutoSection
            hasRules={hasRules}
            contractSum={contractSum}
            autoMode={autoMode}
            autoFilled={autoFilled}
            onApplyAuto={applyAuto}
            onOpenRules={() => setShowRules(true)}
            onDismissAutoFilled={() => setAutoFilled(false)}
          />
        )}

        {(["material_cost", "measure_cost", "install_cost"] as const).map(key => {
          const defs: Record<string, { def: string; save: (v: string) => void }> = {
            material_cost: { def: "Материалы", save: v => saveWithLog({ material_cost: +v || null } as Partial<Client>, `Материалы: ${(+v).toLocaleString("ru-RU")} ₽`,    "Package", "#ef4444") },
            measure_cost:  { def: "Замер",     save: v => { saveWithLog({ measure_cost:  +v || null } as Partial<Client>, `Замер: ${(+v).toLocaleString("ru-RU")} ₽`,  "Ruler",   "#ef4444"); setAutoFilled(false); } },
            install_cost:  { def: "Монтаж",    save: v => { saveWithLog({ install_cost:  +v || null } as Partial<Client>, `Монтаж: ${(+v).toLocaleString("ru-RU")} ₽`, "Wrench",  "#ef4444"); setAutoFilled(false); } },
          };
          return rowVisibility[key] === false || !isCostVisible(key) ? null : (
            <RowWithToggle key={key} rowKey={key} visible onToggle={() => {}} editMode={costsEdit}
              editableLabel={getLabel(key, defs[key].def)} onLabelChange={l => renameLabel(key, l)}
              onDelete={() => toggleRowVisibility(key)}>
              <InlineField label={getLabel(key, defs[key].def)} value={data[key]} onSave={defs[key].save} type="number" placeholder="—" />
            </RowWithToggle>
          );
        })}

        {customFinRows.filter(r => r.block === "costs" && rowVisibility[r.key] !== false && isCostVisible(r.key)).map(r => {
          const lsKey = `fin_row_${data.id}_${r.key}`;
          const val = localStorage.getItem(lsKey) || "";
          return (
            <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={() => {}} editMode={costsEdit}
              editableLabel={r.label} onLabelChange={label => updateCustomFinRow(r.key, label)}
              onDelete={() => { deleteCustomFinRow(r.key); }}>
              <InlineField label={r.label} value={val} type="number" placeholder="—"
                onSave={v => { localStorage.setItem(lsKey, v); logAction("Minus", "#ef4444", `${r.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
            </RowWithToggle>
          );
        })}

        {discountHistory.length > 0 && (
          <div style={{ borderBottom: `1px solid ${t.border2}`, minHeight: 36 }}>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-1.5 flex-shrink-0 w-36 py-2">
                <span className="text-xs" style={{ color: "#f59e0b" }}>
                  {discountHistory.length > 1
                    ? `Скидки (${discountHistory.map(e => e.discount_pct + "%").join(", ")})`
                    : `Скидка ${discountHistory[0].discount_pct}%`}
                </span>
              </div>
              <span className="text-xs font-semibold py-2" style={{ color: "#f59e0b" }}>
                −{Math.round(totalDiscountAmount).toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        )}

        <AddFinRowInline block="costs" onAdd={addCustomFinRow}
          forceOpen={costsEdit}
          onClose={() => setEditingBlock(null)} />
      </Section>
    </>
  );
}