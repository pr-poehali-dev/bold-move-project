import { useTheme } from "./themeContext";
import { Section, FileField } from "./drawerComponents";
import { BlockId, CustomBlockData } from "./drawerTypes";

export function DrawerCustomBlock({ cb, data_id, hiddenBlocks, customRowVals, toggleHidden, deleteCustomBlock, setCustomRowVals, logAction }: {
  cb: CustomBlockData;
  data_id: number;
  hiddenBlocks: Set<BlockId>;
  customRowVals: Record<string, Record<number, string>>;
  toggleHidden: (id: BlockId) => void;
  deleteCustomBlock: (id: string) => void;
  setCustomRowVals: React.Dispatch<React.SetStateAction<Record<string, Record<number, string>>>>;
  logAction: (icon: string, color: string, text: string) => void;
}) {
  const t = useTheme();
  const isHidden = hiddenBlocks.has(cb.id);
  const vals = customRowVals[cb.id] || {};

  return (
    <Section key={cb.id} icon={cb.icon} title={cb.title} color={cb.color}
      hidden={isHidden}
      onToggleHidden={() => toggleHidden(cb.id)}
      onEdit={() => { if (confirm(`Удалить блок «${cb.title}»?`)) deleteCustomBlock(cb.id); }}>
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
    </Section>
  );
}
