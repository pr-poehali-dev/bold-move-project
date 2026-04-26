import { useState } from "react";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId, CustomFinRow } from "./drawerTypes";
import { AddFinRowInline, RowWithToggle } from "./DrawerFinRowHelpers";

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
}

export function DrawerIncomeBlock({
  data, editingBlock, hiddenBlocks, rowVisibility, customFinRows,
  toggleHidden, setEditingBlock, saveWithLog, logAction,
  toggleRowVisibility, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
}: FinBlockProps) {
  const id: BlockId = "income";
  const isHidden = hiddenBlocks.has(id);
  const incomeEdit = editingBlock === id;
  const [labels, setLabels] = useState<Record<string, string>>(loadFinLabels);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => {
    setLabels(prev => ({ ...prev, [key]: label }));
    saveFinLabel(key, label);
  };

  return (
    <Section icon="Banknote" title="Доходы" color="#10b981"
      hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(incomeEdit ? null : id) : undefined}>

      {(["contract_sum", "prepayment", "extra_payment"] as const).filter(key => rowVisibility[key] !== false).map(key => {
        const defs: Record<string, { def: string; save: (v: string) => void }> = {
          contract_sum:  { def: "Сумма договора", save: v => saveWithLog({ contract_sum:  +v || null } as Partial<Client>, `Договор: ${(+v).toLocaleString("ru-RU")} ₽`,   "FileText", "#10b981") },
          prepayment:    { def: "Предоплата",     save: v => saveWithLog({ prepayment:    +v || null } as Partial<Client>, `Предоплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet",   "#10b981") },
          extra_payment: { def: "Доплата",        save: v => saveWithLog({ extra_payment: +v || null } as Partial<Client>, `Доплата: +${(+v).toLocaleString("ru-RU")} ₽`,   "Wallet",   "#10b981") },
        };
        return (
          <RowWithToggle key={key} rowKey={key} visible onToggle={() => {}} editMode={incomeEdit}
            editableLabel={getLabel(key, defs[key].def)} onLabelChange={l => renameLabel(key, l)}
            onDelete={() => toggleRowVisibility(key)}>
            <InlineField label={getLabel(key, defs[key].def)} value={data[key]} onSave={defs[key].save} type="number" placeholder="—" />
          </RowWithToggle>
        );
      })}

      {customFinRows.filter(r => r.block === "income" && rowVisibility[r.key] !== false).map(r => {
        const lsKey = `fin_row_${data.id}_${r.key}`;
        const val = localStorage.getItem(lsKey) || "";
        return (
          <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={() => {}} editMode={incomeEdit}
            editableLabel={r.label} onLabelChange={label => updateCustomFinRow(r.key, label)}
            onDelete={() => { deleteCustomFinRow(r.key); }}>
            <InlineField label={r.label} value={val} type="number" placeholder="—"
              onSave={v => { localStorage.setItem(lsKey, v); logAction("Plus", "#10b981", `${r.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
          </RowWithToggle>
        );
      })}

      <AddFinRowInline block="income" onAdd={addCustomFinRow}
        forceOpen={incomeEdit}
        onClose={() => setEditingBlock(null)} />
    </Section>
  );
}

export function DrawerCostsBlock({
  data, editingBlock, hiddenBlocks, rowVisibility, customFinRows,
  toggleHidden, setEditingBlock, saveWithLog, logAction,
  toggleRowVisibility, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
}: FinBlockProps) {
  const id: BlockId = "costs";
  const isHidden = hiddenBlocks.has(id);
  const costsEdit = editingBlock === id;
  const [labels, setLabels] = useState<Record<string, string>>(loadFinLabels);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => {
    setLabels(prev => ({ ...prev, [key]: label }));
    saveFinLabel(key, label);
  };

  return (
    <Section icon="Receipt" title="Затраты" color="#ef4444"
      hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(costsEdit ? null : id) : undefined}>

      {(["material_cost", "measure_cost", "install_cost"] as const).map(key => {
        const defs: Record<string, { def: string; save: (v: string) => void }> = {
          material_cost: { def: "Материалы", save: v => saveWithLog({ material_cost: +v || null } as Partial<Client>, `Материалы: ${(+v).toLocaleString("ru-RU")} ₽`,   "Package", "#ef4444") },
          measure_cost:  { def: "Замер",     save: v => saveWithLog({ measure_cost:  +v || null } as Partial<Client>, `Замер стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Ruler",   "#ef4444") },
          install_cost:  { def: "Монтаж",    save: v => saveWithLog({ install_cost:  +v || null } as Partial<Client>, `Монтаж стоит: ${(+v).toLocaleString("ru-RU")} ₽`,"Wrench",  "#ef4444") },
        };
        return rowVisibility[key] === false ? null : (
          <RowWithToggle key={key} rowKey={key} visible onToggle={() => {}} editMode={costsEdit}
            editableLabel={getLabel(key, defs[key].def)} onLabelChange={l => renameLabel(key, l)}
            onDelete={() => toggleRowVisibility(key)}>
            <InlineField label={getLabel(key, defs[key].def)} value={data[key]} onSave={defs[key].save} type="number" placeholder="—" />
          </RowWithToggle>
        );
      })}

      {customFinRows.filter(r => r.block === "costs" && rowVisibility[r.key] !== false).map(r => {
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
  );
}