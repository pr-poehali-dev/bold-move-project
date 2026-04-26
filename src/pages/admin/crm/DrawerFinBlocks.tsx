import Icon from "@/components/ui/icon";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId, CustomFinRow } from "./drawerTypes";
import { AddFinRowInline, RowWithToggle, HiddenRowToggle } from "./DrawerFinRowHelpers";

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
}

export function DrawerIncomeBlock({
  data, editingBlock, hiddenBlocks, rowVisibility, customFinRows,
  toggleHidden, setEditingBlock, saveWithLog, logAction,
  toggleRowVisibility, addCustomFinRow, deleteCustomFinRow,
}: FinBlockProps) {
  const id: BlockId = "income";
  const isHidden = hiddenBlocks.has(id);
  const incomeEdit = editingBlock === id;

  return (
    <Section icon="Banknote" title="Доходы" color="#10b981"
      hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(incomeEdit ? null : id) : undefined}>

      <RowWithToggle rowKey="contract_sum" visible={rowVisibility["contract_sum"] !== false} onToggle={toggleRowVisibility} editMode={incomeEdit}>
        <InlineField label="Сумма договора" value={data.contract_sum} onSave={v => saveWithLog({ contract_sum: +v || null } as Partial<Client>, `Договор: ${(+v).toLocaleString("ru-RU")} ₽`, "FileText", "#10b981")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["contract_sum"] === false && <HiddenRowToggle rowKey="contract_sum" label="Сумма договора" onToggle={toggleRowVisibility} />}

      <RowWithToggle rowKey="prepayment" visible={rowVisibility["prepayment"] !== false} onToggle={toggleRowVisibility} editMode={incomeEdit}>
        <InlineField label="Предоплата" value={data.prepayment} onSave={v => saveWithLog({ prepayment: +v || null } as Partial<Client>, `Предоплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet", "#10b981")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["prepayment"] === false && <HiddenRowToggle rowKey="prepayment" label="Предоплата" onToggle={toggleRowVisibility} />}

      <RowWithToggle rowKey="extra_payment" visible={rowVisibility["extra_payment"] !== false} onToggle={toggleRowVisibility} editMode={incomeEdit}>
        <InlineField label="Доплата" value={data.extra_payment} onSave={v => saveWithLog({ extra_payment: +v || null } as Partial<Client>, `Доплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet", "#10b981")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["extra_payment"] === false && <HiddenRowToggle rowKey="extra_payment" label="Доплата" onToggle={toggleRowVisibility} />}

      <RowWithToggle rowKey="extra_agreement_sum" visible={rowVisibility["extra_agreement_sum"] !== false} onToggle={toggleRowVisibility} editMode={incomeEdit}>
        <InlineField label="Доп. соглашение" value={data.extra_agreement_sum} onSave={v => saveWithLog({ extra_agreement_sum: +v || null } as Partial<Client>, `Доп. согл: ${(+v).toLocaleString("ru-RU")} ₽`, "FileText", "#06b6d4")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["extra_agreement_sum"] === false && <HiddenRowToggle rowKey="extra_agreement_sum" label="Доп. соглашение" onToggle={toggleRowVisibility} />}

      {customFinRows.filter(r => r.block === "income").map(r => {
        const lsKey = `fin_row_${data.id}_${r.key}`;
        const val = localStorage.getItem(lsKey) || "";
        return rowVisibility[r.key] !== false ? (
          <div key={r.key} className={`flex items-center gap-1 ${incomeEdit ? "" : "group/rowtoggle"}`}>
            <div className="flex-1 min-w-0">
              <InlineField label={r.label} value={val} type="number" placeholder="—"
                onSave={v => { localStorage.setItem(lsKey, v); logAction("Plus", "#10b981", `${r.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
            </div>
            <button onClick={() => toggleRowVisibility(r.key)}
              title="Скрыть строку"
              className={`${incomeEdit ? "opacity-100" : "opacity-0 group-hover/rowtoggle:opacity-100"} flex-shrink-0 rounded-full transition-all duration-200`}
              style={{ width: 28, height: 16, background: "#8b5cf6", position: "relative", display: "inline-flex", alignItems: "center" }}>
              <span style={{ width: 12, height: 12, background: "#fff", borderRadius: "50%", position: "absolute", left: 14, transition: "left 0.2s" }} />
            </button>
            <button onClick={() => deleteCustomFinRow(r.key)} title="Удалить строку"
              className={`${incomeEdit ? "opacity-100" : "opacity-0 group-hover/rowtoggle:opacity-100"} flex-shrink-0 text-red-400/60 hover:text-red-400 transition-all ml-0.5`}>
              <Icon name="X" size={11} />
            </button>
          </div>
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
  toggleRowVisibility, addCustomFinRow, deleteCustomFinRow,
}: FinBlockProps) {
  const id: BlockId = "costs";
  const isHidden = hiddenBlocks.has(id);
  const costsEdit = editingBlock === id;

  return (
    <Section icon="Receipt" title="Затраты" color="#ef4444"
      hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(costsEdit ? null : id) : undefined}>

      <RowWithToggle rowKey="material_cost" visible={rowVisibility["material_cost"] !== false} onToggle={toggleRowVisibility} editMode={costsEdit}>
        <InlineField label="Материалы" value={data.material_cost} onSave={v => saveWithLog({ material_cost: +v || null } as Partial<Client>, `Материалы: ${(+v).toLocaleString("ru-RU")} ₽`, "Package", "#ef4444")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["material_cost"] === false && <HiddenRowToggle rowKey="material_cost" label="Материалы" onToggle={toggleRowVisibility} />}

      <RowWithToggle rowKey="measure_cost" visible={rowVisibility["measure_cost"] !== false} onToggle={toggleRowVisibility} editMode={costsEdit}>
        <InlineField label="Замер" value={data.measure_cost} onSave={v => saveWithLog({ measure_cost: +v || null } as Partial<Client>, `Замер стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Ruler", "#ef4444")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["measure_cost"] === false && <HiddenRowToggle rowKey="measure_cost" label="Замер" onToggle={toggleRowVisibility} />}

      <RowWithToggle rowKey="install_cost" visible={rowVisibility["install_cost"] !== false} onToggle={toggleRowVisibility} editMode={costsEdit}>
        <InlineField label="Монтаж" value={data.install_cost} onSave={v => saveWithLog({ install_cost: +v || null } as Partial<Client>, `Монтаж стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Wrench", "#ef4444")} type="number" placeholder="—" />
      </RowWithToggle>
      {rowVisibility["install_cost"] === false && <HiddenRowToggle rowKey="install_cost" label="Монтаж" onToggle={toggleRowVisibility} />}

      {customFinRows.filter(r => r.block === "costs").map(r => {
        const lsKey = `fin_row_${data.id}_${r.key}`;
        const val = localStorage.getItem(lsKey) || "";
        return rowVisibility[r.key] !== false ? (
          <div key={r.key} className={`flex items-center gap-1 ${costsEdit ? "" : "group/rowtoggle"}`}>
            <div className="flex-1 min-w-0">
              <InlineField label={r.label} value={val} type="number" placeholder="—"
                onSave={v => { localStorage.setItem(lsKey, v); logAction("Minus", "#ef4444", `${r.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
            </div>
            <button onClick={() => toggleRowVisibility(r.key)}
              title="Скрыть строку"
              className={`${costsEdit ? "opacity-100" : "opacity-0 group-hover/rowtoggle:opacity-100"} flex-shrink-0 rounded-full transition-all duration-200`}
              style={{ width: 28, height: 16, background: "#8b5cf6", position: "relative", display: "inline-flex", alignItems: "center" }}>
              <span style={{ width: 12, height: 12, background: "#fff", borderRadius: "50%", position: "absolute", left: 14, transition: "left 0.2s" }} />
            </button>
            <button onClick={() => deleteCustomFinRow(r.key)} title="Удалить строку"
              className={`${costsEdit ? "opacity-100" : "opacity-0 group-hover/rowtoggle:opacity-100"} flex-shrink-0 text-red-400/60 hover:text-red-400 transition-all ml-0.5`}>
              <Icon name="X" size={11} />
            </button>
          </div>
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
