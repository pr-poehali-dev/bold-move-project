import { useState } from "react";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId, CustomFinRow } from "./drawerTypes";
import { AddFinRowInline, RowWithToggle, HiddenRowToggle } from "./DrawerFinRowHelpers";

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

      <RowWithToggle rowKey="contract_sum" visible={rowVisibility["contract_sum"] !== false} onToggle={toggleRowVisibility} editMode={incomeEdit}
        editableLabel={getLabel("contract_sum", "Сумма договора")} onLabelChange={l => renameLabel("contract_sum", l)}
        onDelete={() => { saveWithLog({ contract_sum: null } as Partial<Client>, "Сумма договора удалена", "Trash2", "#ef4444"); toggleRowVisibility("contract_sum"); }}>
        <InlineField label={getLabel("contract_sum", "Сумма договора")} value={data.contract_sum} onSave={v => saveWithLog({ contract_sum: +v || null } as Partial<Client>, `Договор: ${(+v).toLocaleString("ru-RU")} ₽`, "FileText", "#10b981")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["contract_sum"] === false && <HiddenRowToggle rowKey="contract_sum" label={getLabel("contract_sum", "Сумма договора")} onToggle={toggleRowVisibility} />}

      <RowWithToggle rowKey="prepayment" visible={rowVisibility["prepayment"] !== false} onToggle={toggleRowVisibility} editMode={incomeEdit}
        editableLabel={getLabel("prepayment", "Предоплата")} onLabelChange={l => renameLabel("prepayment", l)}
        onDelete={() => { saveWithLog({ prepayment: null } as Partial<Client>, "Предоплата удалена", "Trash2", "#ef4444"); toggleRowVisibility("prepayment"); }}>
        <InlineField label={getLabel("prepayment", "Предоплата")} value={data.prepayment} onSave={v => saveWithLog({ prepayment: +v || null } as Partial<Client>, `Предоплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet", "#10b981")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["prepayment"] === false && <HiddenRowToggle rowKey="prepayment" label={getLabel("prepayment", "Предоплата")} onToggle={toggleRowVisibility} />}

      <RowWithToggle rowKey="extra_payment" visible={rowVisibility["extra_payment"] !== false} onToggle={toggleRowVisibility} editMode={incomeEdit}
        editableLabel={getLabel("extra_payment", "Доплата")} onLabelChange={l => renameLabel("extra_payment", l)}
        onDelete={() => { saveWithLog({ extra_payment: null } as Partial<Client>, "Доплата удалена", "Trash2", "#ef4444"); toggleRowVisibility("extra_payment"); }}>
        <InlineField label={getLabel("extra_payment", "Доплата")} value={data.extra_payment} onSave={v => saveWithLog({ extra_payment: +v || null } as Partial<Client>, `Доплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet", "#10b981")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["extra_payment"] === false && <HiddenRowToggle rowKey="extra_payment" label={getLabel("extra_payment", "Доплата")} onToggle={toggleRowVisibility} />}

      {customFinRows.filter(r => r.block === "income").map(r => {
        const lsKey = `fin_row_${data.id}_${r.key}`;
        const val = localStorage.getItem(lsKey) || "";
        return rowVisibility[r.key] !== false ? (
          <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={toggleRowVisibility} editMode={incomeEdit} onDelete={() => deleteCustomFinRow(r.key)}
            editableLabel={r.label} onLabelChange={label => updateCustomFinRow(r.key, label)}>
            <InlineField label={r.label} value={val} type="number" placeholder="—"
              onSave={v => { localStorage.setItem(lsKey, v); logAction("Plus", "#10b981", `${r.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
          </RowWithToggle>
        ) : (
          <HiddenRowToggle key={r.key} rowKey={r.key} label={r.label} onToggle={toggleRowVisibility} />
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

      <RowWithToggle rowKey="material_cost" visible={rowVisibility["material_cost"] !== false} onToggle={toggleRowVisibility} editMode={costsEdit}
        editableLabel={getLabel("material_cost", "Материалы")} onLabelChange={l => renameLabel("material_cost", l)}
        onDelete={() => { saveWithLog({ material_cost: null } as Partial<Client>, "Материалы удалены", "Trash2", "#ef4444"); toggleRowVisibility("material_cost"); }}>
        <InlineField label={getLabel("material_cost", "Материалы")} value={data.material_cost} onSave={v => saveWithLog({ material_cost: +v || null } as Partial<Client>, `Материалы: ${(+v).toLocaleString("ru-RU")} ₽`, "Package", "#ef4444")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["material_cost"] === false && <HiddenRowToggle rowKey="material_cost" label={getLabel("material_cost", "Материалы")} onToggle={toggleRowVisibility} />}

      <RowWithToggle rowKey="measure_cost" visible={rowVisibility["measure_cost"] !== false} onToggle={toggleRowVisibility} editMode={costsEdit}
        editableLabel={getLabel("measure_cost", "Замер")} onLabelChange={l => renameLabel("measure_cost", l)}
        onDelete={() => { saveWithLog({ measure_cost: null } as Partial<Client>, "Замер удалён", "Trash2", "#ef4444"); toggleRowVisibility("measure_cost"); }}>
        <InlineField label={getLabel("measure_cost", "Замер")} value={data.measure_cost} onSave={v => saveWithLog({ measure_cost: +v || null } as Partial<Client>, `Замер стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Ruler", "#ef4444")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["measure_cost"] === false && <HiddenRowToggle rowKey="measure_cost" label={getLabel("measure_cost", "Замер")} onToggle={toggleRowVisibility} />}

      <RowWithToggle rowKey="install_cost" visible={rowVisibility["install_cost"] !== false} onToggle={toggleRowVisibility} editMode={costsEdit}
        editableLabel={getLabel("install_cost", "Монтаж")} onLabelChange={l => renameLabel("install_cost", l)}
        onDelete={() => { saveWithLog({ install_cost: null } as Partial<Client>, "Монтаж удалён", "Trash2", "#ef4444"); toggleRowVisibility("install_cost"); }}>
        <InlineField label={getLabel("install_cost", "Монтаж")} value={data.install_cost} onSave={v => saveWithLog({ install_cost: +v || null } as Partial<Client>, `Монтаж стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Wrench", "#ef4444")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["install_cost"] === false && <HiddenRowToggle rowKey="install_cost" label={getLabel("install_cost", "Монтаж")} onToggle={toggleRowVisibility} />}

      {customFinRows.filter(r => r.block === "costs").map(r => {
        const lsKey = `fin_row_${data.id}_${r.key}`;
        const val = localStorage.getItem(lsKey) || "";
        return rowVisibility[r.key] !== false ? (
          <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={toggleRowVisibility} editMode={costsEdit} onDelete={() => deleteCustomFinRow(r.key)}
            editableLabel={r.label} onLabelChange={label => updateCustomFinRow(r.key, label)}>
            <InlineField label={r.label} value={val} type="number" placeholder="—"
              onSave={v => { localStorage.setItem(lsKey, v); logAction("Minus", "#ef4444", `${r.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
          </RowWithToggle>
        ) : (
          <HiddenRowToggle key={r.key} rowKey={r.key} label={r.label} onToggle={toggleRowVisibility} />
        );
      })}

      <AddFinRowInline block="costs" onAdd={addCustomFinRow}
        forceOpen={costsEdit}
        onClose={() => setEditingBlock(null)} />
    </Section>
  );
}