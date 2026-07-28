import { useState, useEffect, useRef } from "react";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";
import { AddFinRowInline, RowWithToggle } from "./DrawerFinRowHelpers";
import { CostsSortableRow } from "./DrawerCostsSortableRow";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useTheme } from "./themeContext";
import { AutoRulesModal, type CostRowDef } from "./DrawerAutoRulesModal";
import { PaymentStatusBadge, CustomPaymentBadge } from "./PaymentConfirmModal";
import { useAutoRules, RuleEntry } from "@/hooks/useAutoRules";
import { useDiscountHistory } from "@/hooks/useDiscountHistory";
import { useCustomFinValues } from "@/hooks/useCustomFinValues";
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

  // Разовая помощь в заполнении: если есть сумма договора и предоплата, а доплата ещё пустая —
  // один раз подставляем "Доплата = Сумма договора − Предоплата" (скидка уже учтена в сумме
  // договора). После заполнения поле больше не трогаем — все ручные правки остаются навсегда.
  const extraAutoFilledRef = useRef(false);
  useEffect(() => { extraAutoFilledRef.current = false; }, [data.id]);
  useEffect(() => {
    if (extraAutoFilledRef.current) return;
    const prepayment = Number(data.prepayment) || 0;
    const extraPayment = Number(data.extra_payment) || 0;
    if (contractSum > 0 && prepayment > 0 && extraPayment === 0) {
      const rest = contractSum - prepayment;
      if (rest > 0) {
        extraAutoFilledRef.current = true;
        saveWithLog(
          { extra_payment: rest } as Partial<Client>,
          `Доплата рассчитана: ${rest.toLocaleString("ru-RU")} ₽`,
          "Wallet", "#10b981",
        );
      }
    }
  }, [data.id, data.contract_sum, data.prepayment, data.extra_payment]); // eslint-disable-line react-hooks/exhaustive-deps

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

// Статьи затрат, у которых есть собственная колонка в live_chats — их значения
// хранятся напрямую в заказе (через saveWithLog), а не в общей таблице кастомных сумм.
const BUILTIN_COST_KEYS = ["material_cost", "measure_cost", "install_cost"] as const;

export function DrawerCostsBlock({
  data, editingBlock, hiddenBlocks,
  toggleHidden, setEditingBlock, saveWithLog, logAction,
}: FinBlockProps) {
  const t = useTheme();
  const id: BlockId = "costs";
  const isHidden = hiddenBlocks.has(id);
  const costsEdit = editingBlock === id;
  const { rules: autoRules, auto_mode: autoMode, loading: autoLoading, save: saveRules } = useAutoRules();
  const { history: discountHistory, totalDiscountAmount } = useDiscountHistory(data.id);
  const { values: customValues, loading: customLoading, saveValue: saveCustomValue } = useCustomFinValues(data.id);
  const [showRules, setShowRules] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Статьи затрат — общий шаблон компании (правила авто-расчёта), отсортированный по sort_order.
  // Показываются только включённые через ползунок "в карточке" (visible !== false).
  const costRules = autoRules
    .filter(r => r.row_type === "cost")
    .sort((a, b) => a.sort_order - b.sort_order);

  const visibleCostRules = costRules.filter(r => r.visible !== false);

  const costRows: CostRowDef[] = visibleCostRules.map(r => ({ key: r.key, label: r.label }));

  const contractSum = Number(data.contract_sum) || 0;

  const hasRules = costRows.some(row => {
    const e = costRules.find(r => r.key === row.key);
    return e && e.enabled && e.pct != null && e.pct > 0;
  });

  const isBuiltin = (key: string): key is typeof BUILTIN_COST_KEYS[number] =>
    (BUILTIN_COST_KEYS as readonly string[]).includes(key);

  // Переименовать статью или переключить видимость — обновляем общий шаблон компании
  const renameRule = (key: string, label: string) => {
    const next = autoRules.map(r => r.key === key ? { ...r, label } : r);
    saveRules(next, autoMode);
  };
  const toggleRuleVisible = (key: string) => {
    const next = autoRules.map(r => r.key === key ? { ...r, visible: r.visible === false } : r);
    saveRules(next, autoMode);
  };
  // Полное удаление — только для нестандартных статей (у встроенных нет смысла удалять правило, только скрыть)
  const removeRule = (key: string) => {
    const next = autoRules.filter(r => r.key !== key);
    saveRules(next, autoMode);
  };
  const addRow = (label: string) => {
    const key = `custom_cost_${Date.now()}`;
    const newRule: RuleEntry = {
      key, label, pct: null, enabled: true, visible: true,
      row_type: "cost", sort_order: costRules.length + 1, is_default: false,
    };
    saveRules([...autoRules, newRule], autoMode);
  };

  // Перетаскивание строк затрат для ручной сортировки (только в режиме редактирования).
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = costRules.findIndex(r => r.key === active.id);
    const newIndex = costRules.findIndex(r => r.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(costRules, oldIndex, newIndex);
    // Пересчитываем sort_order по новому порядку. Остальные правила (доходы) не трогаем.
    const orderMap = new Map(reordered.map((r, i) => [r.key, i]));
    const next = autoRules.map(r =>
      orderMap.has(r.key) ? { ...r, sort_order: orderMap.get(r.key)! } : r
    );
    saveRules(next, autoMode);
  };

  // В режиме редактирования показываем все строки (включая скрытые — их можно вернуть слайдером),
  // вне редактирования — только видимые.
  const rowsToRender = costsEdit ? costRules : visibleCostRules;

  const applyAutoWithSum = async (sum: number) => {
    if (!sum) return;
    const patch: Partial<Client> = {};
    let hasCustom = false;

    for (const row of costRows) {
      const e = costRules.find(r => r.key === row.key);
      if (!e || !e.enabled || !e.pct) continue;
      const val = Math.round(sum * e.pct / 100);
      if (isBuiltin(row.key)) {
        (patch as Record<string, unknown>)[row.key] = val;
      } else {
        await saveCustomValue(row.key, String(val));
        hasCustom = true;
      }
    }

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
    if (autoLoading || customLoading || !contractSum || !hasRules || !autoMode || hasDiscount) {
      if (!autoLoading) prevContractSumRef.current = contractSum;
      return;
    }
    const isFirstRender = prevContractSumRef.current === -1 || !costsAppliedRef.current;
    const sumChanged = contractSum !== prevContractSumRef.current;
    prevContractSumRef.current = contractSum;

    if (isFirstRender) {
      costsAppliedRef.current = true;
      const rowsWithRules = costRows.filter(row => {
        const e = costRules.find(r => r.key === row.key);
        return e && e.enabled && e.pct != null && e.pct > 0;
      });
      const targetRowsEmpty = rowsWithRules.every(row => {
        if (isBuiltin(row.key)) return !data[row.key];
        return customValues[row.key] == null;
      });
      if (rowsWithRules.length > 0 && targetRowsEmpty) applyAutoWithSum(contractSum);
    } else if (sumChanged) {
      applyAutoWithSum(contractSum);
    }
  }, [data.id, contractSum, autoMode, autoRules, autoLoading, customLoading, discountHistory.length, data.discount_pct]); // eslint-disable-line react-hooks/exhaustive-deps

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

        {autoLoading && rowsToRender.length === 0 && (
          <div className="flex flex-col gap-1.5 py-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="h-3 rounded animate-pulse" style={{ width: 90 + i * 20, background: t.surface2 }} />
                <div className="h-3 w-14 rounded animate-pulse" style={{ background: t.surface2 }} />
              </div>
            ))}
          </div>
        )}

        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rowsToRender.map(r => r.key)} strategy={verticalListSortingStrategy}>
            {rowsToRender.map(rule => {
              const key = rule.key;
              const isVisible = rule.visible !== false;
              if (isBuiltin(key)) {
                const icons: Record<string, string> = { material_cost: "Package", measure_cost: "Ruler", install_cost: "Wrench" };
                const save = (v: string) => {
                  saveWithLog({ [key]: +v || null } as Partial<Client>, `${rule.label}: ${(+v).toLocaleString("ru-RU")} ₽`, icons[key], "#ef4444");
                  setAutoFilled(false);
                };
                return (
                  <CostsSortableRow key={key} rowKey={key} visible={isVisible} editMode={costsEdit}
                    editableLabel={rule.label} onToggle={() => toggleRuleVisible(key)}
                    onLabelChange={l => renameRule(key, l)}
                    onDelete={() => toggleRuleVisible(key)}>
                    <InlineField label={rule.label} value={data[key]} onSave={save} type="number" placeholder="—" />
                  </CostsSortableRow>
                );
              }
              const val = customValues[key] != null ? String(customValues[key]) : "";
              return (
                <CostsSortableRow key={key} rowKey={key} visible={isVisible} editMode={costsEdit}
                  editableLabel={rule.label} onToggle={() => toggleRuleVisible(key)}
                  onLabelChange={l => renameRule(key, l)}
                  onDelete={() => removeRule(key)}>
                  <InlineField label={rule.label} value={val} type="number" placeholder="—"
                    onSave={v => { saveCustomValue(key, v); logAction("Minus", "#ef4444", `${rule.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
                </CostsSortableRow>
              );
            })}
          </SortableContext>
        </DndContext>

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

        <AddFinRowInline block="costs" onAdd={label => addRow(label)}
          forceOpen={costsEdit}
          onClose={() => setEditingBlock(null)} />
      </Section>
    </>
  );
}