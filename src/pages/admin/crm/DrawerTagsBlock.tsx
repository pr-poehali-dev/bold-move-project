import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { DEFAULT_TAGS } from "./crmApi";
import { Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";
import {
  CustomTag, PRESET_TAG_COLORS,
  loadCustomTags, saveCustomTags,
  loadHiddenBuiltinTags, saveHiddenBuiltinTags,
} from "./clientFieldsStore";

// ── TagsManageEditor ─────────────────────────────────────────────────────────
// Открывается по карандашику: скрыть/показать встроенные метки (Недозвон,
// Перезвонить) и добавить/переименовать/удалить свои. Все действия применяются
// сразу (без отдельной кнопки «Сохранить»), список меток общий на всю CRM.
function TagsManageEditor({ customTags, setCustomTags, hiddenBuiltin, setHiddenBuiltin, onClose }: {
  customTags: CustomTag[];
  setCustomTags: (t: CustomTag[]) => void;
  hiddenBuiltin: Set<string>;
  setHiddenBuiltin: (s: Set<string>) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [newTag, setNewTag] = useState("");

  const toggleBuiltin = (label: string) => {
    const next = new Set(hiddenBuiltin);
    if (next.has(label)) next.delete(label); else next.add(label);
    setHiddenBuiltin(next);
    saveHiddenBuiltinTags(next);
  };

  const renameCustom = (id: string, label: string) => {
    const updated = customTags.map(tg => tg.id === id ? { ...tg, label } : tg);
    setCustomTags(updated);
    saveCustomTags(updated);
  };

  const deleteCustom = (id: string) => {
    const updated = customTags.filter(tg => tg.id !== id);
    setCustomTags(updated);
    saveCustomTags(updated);
  };

  const addCustom = () => {
    const label = newTag.trim();
    if (!label) return;
    const usedColors = new Set([...DEFAULT_TAGS.map(d => d.color), ...customTags.map(c => c.color)]);
    const color = PRESET_TAG_COLORS.find(c => !usedColors.has(c)) || PRESET_TAG_COLORS[customTags.length % PRESET_TAG_COLORS.length];
    const updated = [...customTags, { id: `tag_${Date.now()}`, label, color }];
    setCustomTags(updated);
    saveCustomTags(updated);
    setNewTag("");
  };

  return (
    <div className="mt-2 mb-1 rounded-xl overflow-hidden" style={{ border: `1px solid #06b6d440`, background: "#06b6d408" }}>
      {/* Встроенные метки — можно скрыть/показать, но не удалить и не переименовать */}
      <div className="px-3 py-2">
        <span className="block text-[9px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: "#a3a3a3" }}>Встроенные метки:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DEFAULT_TAGS.map(tg => {
            const hidden = hiddenBuiltin.has(tg.label);
            return (
              <button key={tg.label} onClick={() => toggleBuiltin(tg.label)}
                title={hidden ? "Показать метку" : "Скрыть метку"}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition"
                style={hidden
                  ? { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }
                  : { background: tg.color + "20", color: "#fff", border: `1px solid ${tg.color}40` }}>
                <Icon name={hidden ? "EyeOff" : "Eye"} size={10} />
                {tg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Свои метки — переименование и удаление */}
      {customTags.length > 0 && (
        <div className="divide-y" style={{ borderColor: "#06b6d420", borderTop: `1px solid #06b6d420` }}>
          {customTags.map(tg => (
            <div key={tg.id} className="flex items-center gap-2 px-3 py-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tg.color }} />
              <input value={tg.label} onChange={e => renameCustom(tg.id, e.target.value)}
                className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
                style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
              <button onClick={() => deleteCustom(tg.id)} className="text-red-400 hover:text-red-300 transition flex-shrink-0">
                <Icon name="Trash2" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Добавить новую */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: `1px solid #06b6d420` }}>
        <input value={newTag} onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addCustom()} placeholder="Новая метка..."
          className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
        <button onClick={addCustom} className="px-2 py-1 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-600/20 hover:bg-cyan-600/30 transition flex-shrink-0">
          <Icon name="Plus" size={12} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button onClick={onClose} className="w-full py-1 rounded-lg text-xs transition"
          style={{ background: t.surface2, color: t.textMute }}>
          Готово
        </button>
      </div>
    </div>
  );
}

// ── DrawerTagsBlock ────────────────────────────────────────────────────────────
// У клиента может стоять только одна метка одновременно. Пока метка не выбрана —
// показываются все доступные варианты для выбора. Как только метка выбрана —
// остальные скрываются, видна только активная (плюс кнопка снять). Список меток
// = встроенные (Недозвон/Перезвонить, можно скрыть) + свои (управляются карандашиком).
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
  const t = useTheme();
  const isHiddenTags = hiddenBlocks.has(id);
  const showEditor = editingBlock === id;
  const current = (tags || [])[0] || null;

  const [customTags, setCustomTags] = useState<CustomTag[]>(loadCustomTags);
  const [hiddenBuiltin, setHiddenBuiltin] = useState<Set<string>>(loadHiddenBuiltinTags);

  const allTags: { label: string; color: string }[] = [
    ...DEFAULT_TAGS.filter(tg => !hiddenBuiltin.has(tg.label)),
    ...customTags.map(tg => ({ label: tg.label, color: tg.color })),
  ];
  // Если выбрана метка, которую потом скрыли/удалили — всё равно показываем её
  // активной (просто цвет по умолчанию), чтобы не терять текущее состояние.
  const currentDef = allTags.find(tg => tg.label === current)
    || (current ? { label: current, color: "#8b5cf6" } : null);

  const selectTag = (label: string) => {
    if (current === label) return;
    save({ tags: [label] });
    logAction("Tag", "#06b6d4", `Метка: ${label}`);
  };

  const clearTag = () => {
    if (!current) return;
    save({ tags: [] });
    logAction("Tag", "#ef4444", `Метка снята: ${current}`);
  };

  return (
    <Section icon="Tag" title="Метки" color="#06b6d4"
      hidden={isHiddenTags}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHiddenTags ? () => setEditingBlock(showEditor ? null : id) : undefined}>
      <div className="flex items-center gap-1.5 flex-wrap py-2">
        {currentDef ? (
          <div className="flex items-center gap-1">
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: currentDef.color + "30", color: currentDef.color, border: `1px solid ${currentDef.color}60` }}>
              {currentDef.label}
            </span>
            <button onClick={clearTag}
              title="Снять метку"
              className="p-1 rounded-md transition hover:bg-white/10" style={{ color: currentDef.color }}>
              <Icon name="X" size={11} />
            </button>
          </div>
        ) : allTags.length === 0 ? (
          <span className="text-xs" style={{ color: t.textMute }}>Нет доступных меток — добавьте через карандашик</span>
        ) : (
          allTags.map(tg => (
            <button key={tg.label}
              onClick={() => selectTag(tg.label)}
              title={`Поставить метку «${tg.label}»`}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition"
              style={{ background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
              {tg.label}
            </button>
          ))
        )}
      </div>

      {showEditor && (
        <TagsManageEditor
          customTags={customTags}
          setCustomTags={setCustomTags}
          hiddenBuiltin={hiddenBuiltin}
          setHiddenBuiltin={setHiddenBuiltin}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </Section>
  );
}
