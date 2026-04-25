import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { BlockId, CustomBlockData, CustomBlockRow, EditRow, ICON_OPTIONS, COLOR_OPTIONS } from "./drawerTypes";

// ── BlockEditor ────────────────────────────────────────────────────────────────
export function BlockEditor({ rows, onSave, onClose }: {
  rows: EditRow[];
  onSave: (rows: EditRow[]) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [local, setLocal] = useState<EditRow[]>(rows);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const updateRow = (i: number, field: "label" | "value", v: string) =>
    setLocal(prev => prev.map((r, j) => j === i ? { ...r, [field]: v } : r));
  const deleteRow = (i: number) => setLocal(prev => prev.filter((_, j) => j !== i));
  const addRow = () => {
    if (!newLabel.trim()) return;
    setLocal(prev => [...prev, { label: newLabel.trim(), value: newValue, key: `custom_${Date.now()}` }]);
    setNewLabel(""); setNewValue("");
  };

  return (
    <div className="mt-2 mb-1 rounded-xl overflow-hidden" style={{ border: `1px solid #7c3aed40`, background: "#7c3aed08" }}>
      <div className="divide-y" style={{ borderColor: "#7c3aed20" }}>
        {local.map((row, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5">
            <input value={row.label} onChange={e => updateRow(i, "label", e.target.value)}
              className="w-28 text-xs rounded-lg px-2 py-1 focus:outline-none"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
            <input value={row.value} onChange={e => updateRow(i, "value", e.target.value)}
              className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
            <button onClick={() => deleteRow(i)} className="text-red-400 hover:text-red-300 transition flex-shrink-0">
              <Icon name="Trash2" size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: `1px solid #7c3aed20` }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addRow()} placeholder="Название..."
          className="w-28 text-xs rounded-lg px-2 py-1 focus:outline-none"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
        <input value={newValue} onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addRow()} placeholder="Значение..."
          className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
        <button onClick={addRow} className="px-2 py-1 rounded-lg text-xs font-semibold text-violet-300 bg-violet-600/20 hover:bg-violet-600/30 transition flex-shrink-0">
          <Icon name="Plus" size={12} />
        </button>
      </div>
      <div className="flex gap-2 px-3 pb-2">
        <button onClick={() => onSave(local)} className="flex-1 py-1 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 transition">Сохранить</button>
        <button onClick={onClose} className="px-3 py-1 rounded-lg text-xs transition" style={{ background: t.surface2, color: t.textMute }}>Отмена</button>
      </div>
    </div>
  );
}

// ── AddBlockModal ─────────────────────────────────────────────────────────────
export function AddBlockModal({ onSave, onClose }: {
  onSave: (block: CustomBlockData) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [title, setTitle] = useState("");
  const [icon, setIcon]   = useState("Star");
  const [color, setColor] = useState("#8b5cf6");
  const [rows, setRows]   = useState<CustomBlockRow[]>([{ label: "", type: "text", value: "" }]);

  const addRow    = () => setRows(prev => [...prev, { label: "", type: "text", value: "" }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, j) => j !== i));
  const updateRow = (i: number, field: keyof CustomBlockRow, v: string) =>
    setRows(prev => prev.map((r, j) => j === i ? { ...r, [field]: v } : r));

  const handleSave = () => {
    if (!title.trim()) return;
    const validRows = rows.filter(r => r.label.trim());
    onSave({ id: `custom_${Date.now()}`, title: title.trim(), icon, color, rows: validRows });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <span className="text-sm font-bold text-white">Новый блок</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: t.textMute }}>Название блока</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Например: Дополнительно"
              className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: t.textMute }}>Иконка</label>
              <select value={icon} onChange={e => setIcon(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }}>
                {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: t.textMute }}>Цвет</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-lg transition"
                    style={{ background: c, border: `2px solid ${color === c ? "#fff" : "transparent"}` }} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs" style={{ color: t.textMute }}>Строки блока</label>
              <button onClick={addRow} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition">
                <Icon name="Plus" size={11} /> Добавить строку
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={row.label} onChange={e => updateRow(i, "label", e.target.value)}
                    placeholder="Название строки"
                    className="flex-1 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }} />
                  <select value={row.type} onChange={e => updateRow(i, "type", e.target.value)}
                    className="rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }}>
                    <option value="text">Текст</option>
                    <option value="file">Файл</option>
                  </select>
                  <button onClick={() => removeRow(i)} disabled={rows.length === 1}
                    className="flex-shrink-0 text-red-400 hover:text-red-300 transition disabled:opacity-30">
                    <Icon name="X" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={handleSave} disabled={!title.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: "#7c3aed" }}>
            <div className="flex items-center justify-center gap-2">
              <Icon name={icon} size={14} style={{ color: color }} /> Создать блок
            </div>
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm transition"
            style={{ background: t.surface2, color: t.textMute }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DraggableBlock ─────────────────────────────────────────────────────────────
export function DraggableBlock({ blockId, onDragStart, onDragOver, onDrop, children }: {
  blockId: BlockId;
  onDragStart: (id: BlockId) => void;
  onDragOver: (e: React.DragEvent, id: BlockId) => void;
  onDrop: (targetId: BlockId) => void;
  children: React.ReactNode;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <div draggable
      onDragStart={() => onDragStart(blockId)}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); onDragOver(e, blockId); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => { setIsDragOver(false); onDrop(blockId); }}
      style={{ outline: isDragOver ? `2px dashed #7c3aed60` : undefined, borderRadius: 16, transition: "outline 0.1s" }}>
      {children}
    </div>
  );
}
