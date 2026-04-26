import { useTheme } from "./themeContext";
import { Section, FileField } from "./drawerComponents";
import { BlockId, CustomBlockData, EditRow } from "./drawerTypes";
import { BlockEditor } from "./DrawerBlockEditor";

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
  const isEditing = editingBlock === cb.id;
  const vals = customRowVals[cb.id] || {};

  // Строим EditRow из текущих строк блока + их значений из localStorage
  const editRows: EditRow[] = cb.rows
    .filter(r => r.type !== "file")
    .map((row, i) => ({ label: row.label, value: vals[i] || "", key: String(i) }));

  const handleSave = (rows: EditRow[]) => {
    // Обновляем названия строк в метаданных блока
    const updatedRows = rows.map((r, i) => ({
      ...( cb.rows[i] || { type: "text" as const, value: "" }),
      label: r.label,
      type: "text" as const,
    }));
    updateCustomBlock(cb.id, { ...cb, rows: updatedRows });

    // Сохраняем значения в localStorage
    const newVals: Record<number, string> = {};
    rows.forEach((r, i) => { newVals[i] = r.value; });
    setCustomRowVals(prev => {
      const next = { ...prev, [cb.id]: newVals };
      localStorage.setItem(`custom_block_vals_${data_id}`, JSON.stringify(next));
      return next;
    });

    logAction("Edit3", cb.color, `${cb.title}: сохранено`);
    setEditingBlock(null);
  };

  return (
    <Section key={cb.id} icon={cb.icon} title={cb.title} color={cb.color}
      hidden={isHidden}
      onToggleHidden={() => toggleHidden(cb.id)}
      onEdit={() => setEditingBlock(isEditing ? null : cb.id as BlockId)}
      onDelete={() => { if (confirm(`Удалить блок «${cb.title}»?`)) deleteCustomBlock(cb.id); }}>
      {cb.rows.map((row, i) => (
        row.type === "file" ? (
          <FileField key={i} label={row.label} url={vals[i] || null}
            onUploaded={(url, name) => {
              setCustomRowVals(prev => {
                const next = { ...prev, [cb.id]: { ...(prev[cb.id] || {}), [i]: url } };
                localStorage.setItem(`custom_block_vals_${data_id}`, JSON.stringify(next));
                return next;
              });
              logAction("Upload", cb.color, `${cb.title} / ${row.label}: ${name}`);
            }} />
        ) : (
          <div key={i} className="flex items-center justify-between py-2 group"
            style={{ borderBottom: `1px solid ${t.border2}` }}>
            <span className="text-xs w-36 flex-shrink-0" style={{ color: "#d4d4d4" }}>{row.label}</span>
            <input
              value={vals[i] || ""}
              onChange={e => {
                const v = e.target.value;
                setCustomRowVals(prev => {
                  const next = { ...prev, [cb.id]: { ...(prev[cb.id] || {}), [i]: v } };
                  localStorage.setItem(`custom_block_vals_${data_id}`, JSON.stringify(next));
                  return next;
                });
              }}
              onBlur={e => { if (e.target.value) logAction("Edit3", cb.color, `${cb.title} / ${row.label}: ${e.target.value}`); }}
              placeholder="—"
              className="flex-1 text-right text-sm bg-transparent focus:outline-none rounded-lg px-2 py-0.5 transition"
              style={{ color: "#fff" }}
              onFocus={e => { e.target.style.background = t.surface2; }}
              onBlurCapture={e => { e.target.style.background = "transparent"; }}
            />
          </div>
        )
      ))}
      {isEditing && (
        <BlockEditor
          rows={editRows}
          allowAdd={true}
          onSave={handleSave}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </Section>
  );
}
