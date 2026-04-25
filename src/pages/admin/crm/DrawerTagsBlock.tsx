import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { DEFAULT_TAGS } from "./crmApi";
import { Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";

// ── TagsBlockEditor ────────────────────────────────────────────────────────────
export function TagsBlockEditor({ tags, onSave, onClose }: {
  tags: string[];
  onSave: (tags: string[]) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [local, setLocal] = useState<string[]>(tags);
  const [newTag, setNewTag] = useState("");

  const deleteTag = (i: number) => setLocal(prev => prev.filter((_, j) => j !== i));
  const renameTag = (i: number, v: string) => setLocal(prev => prev.map((tag, j) => j === i ? v : tag));
  const addTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed || local.includes(trimmed)) return;
    setLocal(prev => [...prev, trimmed]);
    setNewTag("");
  };

  const inactiveDefs = DEFAULT_TAGS.filter(d => !local.includes(d.label));

  return (
    <div className="mt-2 mb-1 rounded-xl overflow-hidden" style={{ border: `1px solid #06b6d440`, background: "#06b6d408" }}>
      <div className="divide-y" style={{ borderColor: "#06b6d420" }}>
        {local.map((tag, i) => {
          const def = DEFAULT_TAGS.find(d => d.label === tag);
          const color = def?.color || "#8b5cf6";
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <input value={tag} onChange={e => renameTag(i, e.target.value)}
                className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
                style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
              <button onClick={() => deleteTag(i)} className="text-red-400 hover:text-red-300 transition flex-shrink-0">
                <Icon name="Trash2" size={12} />
              </button>
            </div>
          );
        })}
      </div>
      {inactiveDefs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2" style={{ borderTop: `1px solid #06b6d420` }}>
          <span className="w-full text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#a3a3a3" }}>Быстро добавить:</span>
          {inactiveDefs.map(tg => (
            <button key={tg.label} onClick={() => setLocal(prev => [...prev, tg.label])}
              className="px-2 py-0.5 rounded-lg text-xs font-semibold transition"
              style={{ background: tg.color + "20", color: "#fff", border: `1px solid ${tg.color}40` }}>
              + {tg.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: `1px solid #06b6d420` }}>
        <input value={newTag} onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTag()} placeholder="Новая метка..."
          className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
        <button onClick={addTag} className="px-2 py-1 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-600/20 hover:bg-cyan-600/30 transition flex-shrink-0">
          <Icon name="Plus" size={12} />
        </button>
      </div>
      <div className="flex gap-2 px-3 pb-2">
        <button onClick={() => onSave(local.filter(tag => tag.trim()))}
          className="flex-1 py-1 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 transition">
          Сохранить
        </button>
        <button onClick={onClose} className="px-3 py-1 rounded-lg text-xs transition"
          style={{ background: t.surface2, color: t.textMute }}>
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── DrawerTagsBlock ────────────────────────────────────────────────────────────
export function DrawerTagsBlock({ id, tags, editingBlock, hiddenBlocks, toggleHidden, setEditingBlock, save, logAction }: {
  id: BlockId;
  tags: string[] | null;
  editingBlock: BlockId | null;
  hiddenBlocks: Set<BlockId>;
  toggleHidden: (id: BlockId) => void;
  setEditingBlock: (id: BlockId | null) => void;
  save: (patch: { tags: string[] }) => void;
  logAction: (icon: string, color: string, text: string) => void;
}) {
  const isHiddenTags = hiddenBlocks.has(id);
  const showTagEditor = editingBlock === id;
  const currentTags = tags || [];

  return (
    <Section icon="Tag" title="Метки" color="#06b6d4"
      hidden={isHiddenTags}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHiddenTags ? () => setEditingBlock(showTagEditor ? null : id) : undefined}>
      <div className="flex flex-wrap gap-1.5 py-2">
        {currentTags.length === 0 && !showTagEditor && (
          <span className="text-xs" style={{ color: "#a3a3a3" }}>Нет меток — нажмите карандаш</span>
        )}
        {currentTags.map(tg => {
          const def = DEFAULT_TAGS.find(d => d.label === tg);
          const c = def?.color || "#8b5cf6";
          return (
            <span key={tg} className="px-2 py-0.5 rounded-lg text-xs font-semibold"
              style={{ background: c + "30", color: "#fff", border: `1px solid ${c}60` }}>
              {tg}
            </span>
          );
        })}
      </div>
      {showTagEditor && (
        <TagsBlockEditor
          tags={currentTags}
          onSave={newTags => {
            const added   = newTags.filter(tg => !currentTags.includes(tg));
            const removed = currentTags.filter(tg => !newTags.includes(tg));
            if (added.length)   logAction("Tag", "#06b6d4", `Метка добавлена: ${added.join(", ")}`);
            if (removed.length) logAction("Tag", "#ef4444", `Метка удалена: ${removed.join(", ")}`);
            save({ tags: newTags });
            setEditingBlock(null);
          }}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </Section>
  );
}
