import { useState, useEffect, useRef } from "react";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId, CustomFinRow } from "./drawerTypes";
import { AddFinRowInline, RowWithToggle } from "./DrawerFinRowHelpers";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { AutoRulesModal, type CostRowDef } from "./DrawerAutoRulesModal";
import { PaymentStatusBadge, CustomPaymentBadge } from "./PaymentConfirmModal";
import { useAutoRules, RuleEntry } from "@/hooks/useAutoRules";

const LS_FIN_LABELS = "crm_fin_row_labels";

function loadFinLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_FIN_LABELS) || "{}"); } catch { return {}; }
}
function saveFinLabel(key: string, label: string) {
  const curr = loadFinLabels();
  curr[key] = label;
  localStorage.setItem(LS_FIN_LABELS, JSON.stringify(curr));
}

interface FinBlockProps {
  data: Client;
  editingBlock: BlockId | null;
  hiddenBlocks: Set<BlockId>;
  rowVisibility: Record<string, boolean>;
  customFinRows: CustomFinRow[];
  toggleHidden: (id: BlockId) => void;
  setEditingBlock: (id: BlockId | null) => void;
  saveWithLog: (patch: Partial<Client>, logText: string, icon?: string, color?: string) => void;
  logAction: (icon: string, color: string, text: string) => void;
  toggleRowVisibility: (key: string) => void;
  addCustomFinRow: (label: string, block: "income" | "costs") => void;
  deleteCustomFinRow: (key: string) => void;
  updateCustomFinRow: (key: string, label: string) => void;
  onReload?: () => void;
}

export function DrawerIncomeBlock({
  data, editingBlock, hiddenBlocks, rowVisibility, customFinRows,
  toggleHidden, setEditingBlock, saveWithLog, logAction,
  toggleRowVisibility, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
  onReload,
}: FinBlockProps) {
  const id: BlockId = "income";
  const isHidden = hiddenBlocks.has(id);
  const incomeEdit = editingBlock === id;
  const { rules: autoRules, auto_mode: autoMode } = useAutoRules();
  const [labels,     setLabels]     = useState<Record<string, string>>(loadFinLabels);
  const [showRules,  setShowRules]  = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => {
    setLabels(prev => ({ ...prev, [key]: label }));
    saveFinLabel(key, label);
  };

  // Строки доходов для модалки
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

  // Видимость строки по полю visible из правил
  const isIncomeVisible = (key: string) => {
    const e = incomeRulesMap[key];
    return !e || e.visible !== false;
  };

  // Есть ли включённые правила доходов
  const hasIncomeRules = incomeRows.some(row => {
    const e = incomeRulesMap[row.key];
    return e && e.enabled && e.pct != null && e.pct > 0;
  });

  // Применить авто-расчёт доходов
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

  // Авто-применение при изменении суммы
  const prevSumRef = useRef<number>(-1);
  useEffect(() => {
    if (!contractSum || !hasIncomeRules || !autoMode) {
      prevSumRef.current = contractSum;
      return;
    }
    const isFirstRender = prevSumRef.current === -1;
    const sumChanged = contractSum !== prevSumRef.current;
    prevSumRef.current = contractSum;

    if (isFirstRender) {
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
  }, [data.id, contractSum, autoMode, autoRules]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {showRules && <AutoRulesModal onClose={() => setShowRules(false)} costRows={incomeRows} defaultTab="income" />}

      <Section icon="Banknote" title="Доходы" color="#10b981"
        hidden={isHidden}
        onToggleHidden={() => toggleHidden(id)}
        onEdit={!isHidden ? () => setEditingBlock(incomeEdit ? null : id) : undefined}>

        {/* Кнопки авто-расчёта доходов */}
        {!isHidden && (
          <div className="flex items-center gap-1.5 pt-2 pb-1 w-full">
            <button
              onClick={applyIncomeAuto}
              disabled={!hasIncomeRules || !contractSum}
              title={!contractSum ? "Сначала укажите сумму договора" : !hasIncomeRules ? "Настройте правило (шестерёнка)" : "Авто-расчёт по правилу"}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-30"
              style={{ background: "#10b98115", color: "#10b981", border: "1px solid #10b98130" }}>
              <Icon name="Zap" size={11} />
              Авто
            </button>
            <button
              onClick={() => setShowRules(true)}
              title="Настроить правила авто-расчёта доходов"
              className="p-1 rounded-lg transition hover:bg-white/5"
              style={{ color: "#6b7280" }}>
              <Icon name="Settings2" size={13} />
            </button>
            {!hasIncomeRules && (
              <span className="text-[10px]" style={{ color: "#6b7280" }}>Настройте правило →</span>
            )}
            {hasIncomeRules && autoMode && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full ml-auto"
                style={{ background: "#10b98118", border: "1px solid #10b98135" }}
                title="Авто-режим включён — доходы пересчитываются при изменении суммы">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
                <span className="text-[10px] font-medium" style={{ color: "#10b981" }}>авто</span>
              </div>
            )}
          </div>
        )}

        {/* Предупреждение об авто-заполнении */}
        {autoFilled && !isHidden && (
          <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 mb-1"
            style={{ background: "#10b98112", border: "1px solid #10b98130" }}>
            <Icon name="Zap" size={12} style={{ color: "#10b981", flexShrink: 0, marginTop: 1 }} />
            <div className="flex-1">
              <span className="text-[11px] leading-relaxed" style={{ color: "#6ee7b7" }}>
                Доходы заполнены автоматически по правилу. Можно изменить вручную.
              </span>
            </div>
            <button onClick={() => setAutoFilled(false)} style={{ color: "#10b98160" }}>
              <Icon name="X" size={11} />
            </button>
          </div>
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
  const { rules: autoRules, auto_mode: autoMode } = useAutoRules();
  const [labels, setLabels] = useState<Record<string, string>>(loadFinLabels);
  const [showRules, setShowRules] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => {
    setLabels(prev => ({ ...prev, [key]: label }));
    saveFinLabel(key, label);
  };

  // Метки встроенных строк затрат
  const BUILTIN_COST_DEFS: Record<string, string> = {
    material_cost: "Материалы",
    measure_cost:  "Замер",
    install_cost:  "Монтаж",
  };

  // Список всех видимых строк затрат для модалки правил
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

  // Видимость строки затрат по полю visible из правил
  const isCostVisible = (key: string) => {
    const e = rulesMap[key];
    return !e || e.visible !== false;
  };

  // Есть ли хоть одно включённое правило с процентом для видимых строк
  const hasRules = costRows.some(row => {
    const e = rulesMap[row.key];
    return e && e.enabled && e.pct != null && e.pct > 0;
  });

  // Применить авто-расчёт
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

  // Авто-применение правил при изменении суммы
  const prevContractSumRef = useRef<number>(-1);
  useEffect(() => {
    if (!contractSum || !hasRules || !autoMode) {
      prevContractSumRef.current = contractSum;
      return;
    }
    const isFirstRender = prevContractSumRef.current === -1;
    const sumChanged = contractSum !== prevContractSumRef.current;
    prevContractSumRef.current = contractSum;

    if (isFirstRender) {
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
  }, [data.id, contractSum, autoMode, autoRules]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {showRules && <AutoRulesModal onClose={() => setShowRules(false)} costRows={costRows} />}

      <Section icon="Receipt" title="Затраты" color="#ef4444"
        hidden={isHidden}
        onToggleHidden={() => toggleHidden(id)}
        onEdit={!isHidden ? () => setEditingBlock(costsEdit ? null : id) : undefined}>

        {/* Кнопки авто-расчёта */}
        {!isHidden && (
          <div className="flex items-center gap-1.5 pt-2 pb-1 w-full">
            <button
              onClick={applyAuto}
              disabled={!hasRules || !contractSum}
              title={!contractSum ? "Сначала укажите сумму договора" : !hasRules ? "Настройте правило (шестерёнка)" : "Авто-расчёт по правилу"}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-30"
              style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
              <Icon name="Zap" size={11} />
              Авто
            </button>
            <button
              onClick={() => setShowRules(true)}
              title="Настроить правила авто-расчёта"
              className="p-1 rounded-lg transition hover:bg-white/5"
              style={{ color: "#6b7280" }}>
              <Icon name="Settings2" size={13} />
            </button>
            {!hasRules && (
              <span className="text-[10px]" style={{ color: "#6b7280" }}>Настройте правило →</span>
            )}
            {/* Индикатор авто-режима — правый край */}
            {hasRules && autoMode && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full ml-auto"
                style={{ background: "#ef444418", border: "1px solid #ef444435" }}
                title="Авто-режим включён — затраты пересчитываются при изменении суммы">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#ef4444" }} />
                <span className="text-[10px] font-medium" style={{ color: "#ef4444" }}>авто</span>
              </div>
            )}
          </div>
        )}

        {/* Предупреждение об авто-заполнении */}
        {autoFilled && !isHidden && (
          <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 mb-1"
            style={{ background: "#ef444412", border: "1px solid #ef444430" }}>
            <Icon name="Zap" size={12} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
            <div className="flex-1">
              <span className="text-[11px] leading-relaxed" style={{ color: "#fca5a5" }}>
                Затраты заполнены автоматически по правилу. Можно изменить вручную.
              </span>
            </div>
            <button onClick={() => setAutoFilled(false)} style={{ color: "#ef444460" }}>
              <Icon name="X" size={11} />
            </button>
          </div>
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

        <AddFinRowInline block="costs" onAdd={addCustomFinRow}
          forceOpen={costsEdit}
          onClose={() => setEditingBlock(null)} />
      </Section>
    </>
  );
}