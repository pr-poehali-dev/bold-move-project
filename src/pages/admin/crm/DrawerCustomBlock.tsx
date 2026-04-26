import { useState } from "react";
import { useTheme } from "./themeContext";
import { Section, FileField } from "./drawerComponents";
import { BlockId, CustomBlockData } from "./drawerTypes";
import { RowWithToggle } from "./DrawerFinRowHelpers";

const LS_CUSTOM_VIS = "crm_custom_row_visibility";
function loadCustomVis(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM_VIS) || "{}"); } catch { return {}; }
}
function saveCustomVis(v: Record<string, boolean>) {
  localStorage.setItem(LS_CUSTOM_VIS, JSON.stringify(v));
}

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
  const t = useTheme();
  const isHidden = hiddenBlocks.has(cb.id);
  const editMode = editingBlock === cb.id;
  const vals = customRowVals[cb.id] || {};
  const [vis, setVis] = useState<Record<string, boolean>>(loadCustomVis);

  const toggleVis = (key: string) => {
    setVis(p => { const n = { ...p, [key]: !p[key] }; saveCustomVis(n); return n; });
  };
  const isVisible = (key: string) => vis[key] !== false;

  const renameRow = (i: number, label: string) => {
    updateCustomBlock(cb.id, { ...cb, rows: cb.rows.map((r, j) => j === i ? { ...r, label } : r) });
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

      {cb.rows.map((row, i) => {
        const rowKey = `${cb.id}_row_${i}`;
        const visible = isVisible(rowKey);
        return (
          <div key={i} style={{ opacity: !visible && editMode ? 0.35 : 1 }}>
            <RowWithToggle rowKey={rowKey} visible={visible || editMode} onToggle={toggleVis} editMode={editMode}
              editableLabel={row.label} onLabelChange={l => renameRow(i, l)}>
              {row.type === "file" ? (
                <FileField label={row.label} url={vals[i] || null}
                  onUploaded={(url, name) => {
                    setValue(i, url);
                    logAction("Upload", cb.color, `${cb.title} / ${row.label}: ${name}`);
                  }} />
              ) : (
                <div className="flex items-center justify-between py-2"
                  style={{ borderBottom: `1px solid ${t.border2}` }}>
                  <span className="text-xs w-36 flex-shrink-0" style={{ color: "#d4d4d4" }}>{row.label}</span>
                  <input
                    value={vals[i] || ""}
                    onChange={e => setValue(i, e.target.value)}
                    onBlur={e => { if (e.target.value) logAction("Edit3", cb.color, `${cb.title} / ${row.label}: ${e.target.value}`); }}
                    placeholder="—"
                    className="flex-1 text-right text-sm bg-transparent focus:outline-none rounded-lg px-2 py-0.5 transition"
                    style={{ color: "#fff" }}
                    onFocus={e => { e.target.style.background = t.surface2; }}
                    onBlurCapture={e => { e.target.style.background = "transparent"; }}
                  />
                </div>
              )}
            </RowWithToggle>
          </div>
        );
      })}

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
