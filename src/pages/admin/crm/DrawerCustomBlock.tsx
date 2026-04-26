import { useState } from "react";
import { Section, FileField, InlineField } from "./drawerComponents";
import { BlockId, CustomBlockData } from "./drawerTypes";
import { RowWithToggle } from "./DrawerFinRowHelpers";

export function DrawerCustomBlock({ cb, data_id, hiddenBlocks, customRowVals, editingBlock, setEditingBlock, toggleHidden, deleteCustomBlock, updateCustomBlock, setCustomRowVals, logAction }: {
  cb: CustomBlockData;
  data_id: number;
  hiddenBlocks: Set<BlockId>;
  customRowVals: Record<string, Record<number, string>>;
  editingBlock: BlockId | null;
  setEditingBlock: (id: BlockId | null) => void;
  toggleHidden: (id: BlockId) => void;
  deleteCustomBlock: (id: string) => void;
  updateCustomBlock: (id: string, updated: CustomBlockData) => void;
  setCustomRowVals: React.Dispatch<React.SetStateAction<Record<string, Record<number, string>>>>;
  logAction: (icon: string, color: string, text: string) => void;
}) {
  const isHidden = hiddenBlocks.has(cb.id);
  const editMode = editingBlock === cb.id;
  const vals = customRowVals[cb.id] || {};


  const renameRow = (i: number, label: string) => {
    updateCustomBlock(cb.id, { ...cb, rows: cb.rows.map((r, j) => j === i ? { ...r, label } : r) });
  };

  const deleteRow = (i: number) => {
    const updatedRows = cb.rows.filter((_, j) => j !== i);
    updateCustomBlock(cb.id, { ...cb, rows: updatedRows });
    // сдвигаем значения
    setCustomRowVals(prev => {
      const old = prev[cb.id] || {};
      const next: Record<number, string> = {};
      let ni = 0;
      cb.rows.forEach((_, j) => { if (j !== i) { next[ni] = old[j] || ""; ni++; } });
      const newVals = { ...prev, [cb.id]: next };
      localStorage.setItem(`custom_block_vals_${data_id}`, JSON.stringify(newVals));
      return newVals;
    });
  };

  const setValue = (i: number, v: string) => {
    setCustomRowVals(prev => {
      const next = { ...prev, [cb.id]: { ...(prev[cb.id] || {}), [i]: v } };
      localStorage.setItem(`custom_block_vals_${data_id}`, JSON.stringify(next));
      return next;
    });
  };

  return (
    <Section icon={cb.icon} title={cb.title} color={cb.color}
      hidden={isHidden}
      onToggleHidden={() => toggleHidden(cb.id)}
      onEdit={() => setEditingBlock(editMode ? null : cb.id as BlockId)}
      onDelete={() => { if (confirm(`Удалить блок «${cb.title}»?`)) deleteCustomBlock(cb.id); }}>

      {cb.rows.map((row, i) => (
        <RowWithToggle key={i} rowKey={String(i)} visible onToggle={() => {}} editMode={editMode}
          editableLabel={row.label} onLabelChange={l => renameRow(i, l)}
          onDelete={() => deleteRow(i)}>
          {row.type === "file" ? (
            <FileField label={row.label} url={vals[i] || null}
              onUploaded={(url, name) => {
                setValue(i, url);
                logAction("Upload", cb.color, `${cb.title} / ${row.label}: ${name}`);
              }} />
          ) : (
            <InlineField label={row.label} value={vals[i] || ""} placeholder="Добавить значение"
              hideLabel={editMode}
              onSave={v => { setValue(i, v); if (v) logAction("Edit3", cb.color, `${cb.title} / ${row.label}: ${v}`); }} />
          )}
        </RowWithToggle>
      ))}

      {editMode && (
        <AddCustomRow color={cb.color} onAdd={label => {
          updateCustomBlock(cb.id, { ...cb, rows: [...cb.rows, { label, type: "text" as const, value: "" }] });
        }} />
      )}
    </Section>
  );
}

function AddCustomRow({ color, onAdd }: { color: string; onAdd: (label: string) => void }) {
  const [val, setVal] = useState("");
  const commit = () => { if (val.trim()) { onAdd(val.trim()); setVal(""); } };
  return (
    <div className="flex items-center gap-1.5 mt-1 mb-1">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); }}
        placeholder="Новая строка..."
        className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
        style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${color}40`, color: "#fff" }}
      />
      <button onClick={commit}
        className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
        style={{ background: `${color}20`, color }}>
        OK
      </button>
    </div>
  );
}