import { useState, useRef } from "react";
import { Client, DEFAULT_TAGS } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import {
  CustomTag, CustomClientField,
  loadCustomTags, saveCustomTags,
  loadClientFields, saveClientFields,
  loadClientExtraValues, saveClientExtraValues,
  loadHiddenBuiltinTags, saveHiddenBuiltinTags,
  PRESET_TAG_COLORS,
} from "./clientFieldsStore";

interface Props {
  data: Client;
  save: (patch: Partial<Client>) => void;
}

export default function ClientTab({ data, save }: Props) {
  const t = useTheme();

  // ── Поля ───────────────────────────────────────────────────────────────
  const [fields, setFields]           = useState<CustomClientField[]>(loadClientFields);
  const [extraValues, setExtraValues] = useState<Record<string, string>>(
    () => loadClientExtraValues(data.id)
  );
  const [editMode, setEditMode]       = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const editFieldRef = useRef<string>("");

  // ── Drag state ──────────────────────────────────────────────────────────
  const dragId   = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const visibleFields = fields.filter(f => !f.hidden);
  const hiddenFields  = fields.filter(f => f.hidden);

  // ── Drag handlers ───────────────────────────────────────────────────────
  const onDragStart = (id: string) => { dragId.current = id; };

  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragId.current !== id) setDragOver(id);
  };

  const onDrop = (targetId: string) => {
    const fromId = dragId.current;
    if (!fromId || fromId === targetId) { setDragOver(null); return; }

    const fromIdx  = fields.findIndex(f => f.id === fromId);
    const toIdx    = fields.findIndex(f => f.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDragOver(null); return; }

    const next = [...fields];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setFields(next);
    saveClientFields(next);
    dragId.current = null;
    setDragOver(null);
  };

  const onDragEnd = () => { dragId.current = null; setDragOver(null); };

  // ── Field ops ───────────────────────────────────────────────────────────
  const setExtraValue = (fieldId: string, value: string) => {
    const updated = { ...extraValues, [fieldId]: value };
    setExtraValues(updated);
    saveClientExtraValues(data.id, updated);
  };

  const addField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    const field: CustomClientField = { id: `field_${Date.now()}`, label };
    const updated = [...fields, field];
    setFields(updated);
    saveClientFields(updated);
    setNewFieldLabel("");
  };

  const hideField = (id: string) => {
    const updated = fields.map(f => f.id === id ? { ...f, hidden: true } : f);
    setFields(updated);
    saveClientFields(updated);
  };

  const showField = (id: string) => {
    const updated = fields.map(f => f.id === id ? { ...f, hidden: false } : f);
    setFields(updated);
    saveClientFields(updated);
  };

  const renameField = (id: string, newLabel: string) => {
    const updated = fields.map(f => f.id === id ? { ...f, label: newLabel } : f);
    setFields(updated);
    saveClientFields(updated);
  };

  const saveBuiltin = (clientKey: string, value: string) => {
    save({ [clientKey]: value } as Partial<Client>);
  };

  const getBuiltinValue = (clientKey: string): string =>
    (data[clientKey as keyof Client] as string) || "";

  // ── Метки ───────────────────────────────────────────────────────────────
  const [customTags, setCustomTags]       = useState<CustomTag[]>(loadCustomTags);
  const [hiddenBuiltin, setHiddenBuiltin] = useState<Set<string>>(loadHiddenBuiltinTags);
  const [editTagsMode, setEditTagsMode]   = useState(false);
  const [newTagLabel, setNewTagLabel]     = useState("");
  const [newTagColor, setNewTagColor]     = useState(PRESET_TAG_COLORS[0]);
  const [editingTagId, setEditingTagId]   = useState<string | null>(null);
  const editTagRef = useRef<string>("");

  const builtinTags = DEFAULT_TAGS.filter(tg => !hiddenBuiltin.has(tg.label))
    .map(tg => ({ id: tg.label, label: tg.label, color: tg.color, builtin: true as const }));
  const customTagsMapped = customTags.map(tg => ({ ...tg, builtin: false as const }));
  const allVisibleTags = [...builtinTags, ...customTagsMapped];

  const toggleTag = (label: string) => {
    if (editTagsMode) return;
    const cur = data.tags || [];
    save({ tags: cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label] });
  };

  const hideBuiltinTag = (label: string) => {
    const next = new Set(hiddenBuiltin).add(label);
    setHiddenBuiltin(next);
    saveHiddenBuiltinTags(next);
    if ((data.tags || []).includes(label))
      save({ tags: (data.tags || []).filter(l => l !== label) });
  };

  const addCustomTag = () => {
    const label = newTagLabel.trim();
    if (!label) return;
    const tag: CustomTag = { id: `tag_${Date.now()}`, label, color: newTagColor };
    const updated = [...customTags, tag];
    setCustomTags(updated);
    saveCustomTags(updated);
    setNewTagLabel("");
  };

  const deleteCustomTag = (id: string) => {
    const tag = customTags.find(tg => tg.id === id);
    const updated = customTags.filter(tg => tg.id !== id);
    setCustomTags(updated);
    saveCustomTags(updated);
    if (tag && (data.tags || []).includes(tag.label))
      save({ tags: (data.tags || []).filter(l => l !== tag.label) });
  };

  const renameCustomTag = (id: string, newLabel: string) => {
    const tag = customTags.find(tg => tg.id === id);
    const updated = customTags.map(tg => tg.id === id ? { ...tg, label: newLabel } : tg);
    setCustomTags(updated);
    saveCustomTags(updated);
    if (tag && (data.tags || []).includes(tag.label))
      save({ tags: (data.tags || []).map(l => l === tag.label ? newLabel : l) });
  };

  const changeTagColor = (id: string, color: string) => {
    const updated = customTags.map(tg => tg.id === id ? { ...tg, color } : tg);
    setCustomTags(updated);
    saveCustomTags(updated);
  };

  return (
    <div className="px-6 py-5 space-y-4 max-w-xl">

      {/* ── Поля (встроенные + кастомные) ─────────────────────────────── */}
      {visibleFields.map(field => {
        const isEditing  = editMode && editingFieldId === field.id;
        const isBuiltin  = !!field.builtin;
        const isDragOver = dragOver === field.id;

        return (
          <div
            key={field.id}
            draggable={editMode}
            onDragStart={() => onDragStart(field.id)}
            onDragOver={e => onDragOver(e, field.id)}
            onDrop={() => onDrop(field.id)}
            onDragEnd={onDragEnd}
            style={{
              borderRadius: 12,
              transition: "box-shadow 0.15s, transform 0.15s",
              boxShadow: isDragOver ? `0 0 0 2px #7c3aed` : "none",
              transform: isDragOver ? "scale(1.01)" : "scale(1)",
              cursor: editMode ? "grab" : "default",
              padding: editMode ? "6px 8px" : "0",
              background: editMode ? `${t.surface2}88` : "transparent",
            }}>

            {/* Лейбл */}
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: t.textMute }}>
              {editMode && (
                <span style={{ color: "#4b5563", cursor: "grab", lineHeight: 1 }}>
                  <Icon name="GripVertical" size={13} />
                </span>
              )}

              {isEditing ? (
                <input
                  autoFocus
                  defaultValue={field.label}
                  onChange={e => { editFieldRef.current = e.target.value; }}
                  onBlur={() => { renameField(field.id, editFieldRef.current || field.label); setEditingFieldId(null); }}
                  onKeyDown={e => { if (e.key === "Enter") { renameField(field.id, editFieldRef.current || field.label); setEditingFieldId(null); } }}
                  className="flex-1 rounded-lg px-2.5 py-0.5 text-xs focus:outline-none"
                  style={{ background: t.surface2, border: `1px solid #7c3aed`, color: t.text }}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1">{field.label}</span>
              )}

              {editMode && !isEditing && (
                <>
                  <button onClick={() => { editFieldRef.current = field.label; setEditingFieldId(field.id); }}
                    className="p-0.5 rounded hover:bg-white/5 transition" style={{ color: "#7c3aed" }}>
                    <Icon name="Pencil" size={11} />
                  </button>
                  <button onClick={() => hideField(field.id)}
                    className="p-0.5 rounded hover:bg-red-500/10 transition" style={{ color: "#ef4444" }}>
                    <Icon name="Trash2" size={11} />
                  </button>
                </>
              )}
            </label>

            {/* Инпут */}
            {isBuiltin && field.clientKey === "notes" ? (
              <textarea
                key={data.id + field.clientKey}
                defaultValue={getBuiltinValue(field.clientKey)}
                onBlur={e => { const v = e.target.value; if (v !== getBuiltinValue(field.clientKey!)) saveBuiltin(field.clientKey!, v); }}
                rows={3}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition resize-none"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
                placeholder="Комментарий..."
                onMouseDown={e => e.stopPropagation()}
              />
            ) : isBuiltin && field.clientKey ? (
              <input
                key={data.id + field.clientKey + getBuiltinValue(field.clientKey)}
                defaultValue={getBuiltinValue(field.clientKey)}
                onBlur={e => { const v = e.target.value; if (v !== getBuiltinValue(field.clientKey!)) saveBuiltin(field.clientKey!, v); }}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
                placeholder={field.label}
                onMouseDown={e => e.stopPropagation()}
              />
            ) : (
              <input
                value={extraValues[field.id] || ""}
                onChange={e => setExtraValue(field.id, e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
                placeholder={field.label}
                onMouseDown={e => e.stopPropagation()}
              />
            )}
          </div>
        );
      })}

      {/* ── Скрытые поля (режим редактирования) ───────────────────────── */}
      {editMode && hiddenFields.length > 0 && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
          <div className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: t.textMute }}>Скрытые поля</div>
          {hiddenFields.map(field => (
            <div key={field.id} className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: t.textMute }}>{field.label}</span>
              <button onClick={() => showField(field.id)}
                className="text-[10px] px-2 py-0.5 rounded-lg transition"
                style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                Восстановить
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Кнопки управления полями ───────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {editMode && (
          <div className="flex gap-2 flex-1">
            <input
              value={newFieldLabel}
              onChange={e => setNewFieldLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addField(); }}
              className="flex-1 rounded-xl px-3 py-2 text-xs focus:outline-none"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
              placeholder="Название нового поля..."
            />
            <button onClick={addField} disabled={!newFieldLabel.trim()}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-40"
              style={{ background: "#7c3aed20", color: "#a78bfa", border: "1px solid #7c3aed40" }}>
              + Добавить
            </button>
          </div>
        )}
        <button
          onClick={() => { setEditMode(v => !v); setEditingFieldId(null); setDragOver(null); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition"
          style={{
            background: editMode ? "#7c3aed20" : t.surface2,
            color: editMode ? "#a78bfa" : t.textMute,
            border: `1px solid ${editMode ? "#7c3aed40" : t.border}`,
          }}>
          <Icon name={editMode ? "Check" : "Settings2"} size={12} />
          {editMode ? "Готово" : "Редактировать поля"}
        </button>
      </div>

      {/* ── Разделитель ───────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${t.border2}` }} />

      {/* ── Метки ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium" style={{ color: t.textMute }}>Метки</label>
          <button
            onClick={() => { setEditTagsMode(v => !v); setEditingTagId(null); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition"
            style={{
              background: editTagsMode ? "#7c3aed20" : "transparent",
              color: editTagsMode ? "#a78bfa" : t.textMute,
            }}>
            <Icon name={editTagsMode ? "Check" : "Settings2"} size={11} />
            {editTagsMode ? "Готово" : "Настроить"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {allVisibleTags.map(tag => {
            const active       = (data.tags || []).includes(tag.label);
            const isEditingThis = editTagsMode && !tag.builtin && editingTagId === tag.id;

            return (
              <div key={tag.id} className="flex items-center gap-1">
                <button
                  onClick={() => toggleTag(tag.label)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: active ? tag.color + "30" : t.surface2,
                    color: active ? tag.color : t.textMute,
                    border: `1px solid ${active ? tag.color + "60" : t.border}`,
                    cursor: editTagsMode ? "default" : "pointer",
                    opacity: editTagsMode ? 0.7 : 1,
                  }}>
                  {isEditingThis ? (
                    <input
                      autoFocus
                      defaultValue={tag.label}
                      onChange={e => { editTagRef.current = e.target.value; }}
                      onBlur={() => { renameCustomTag(tag.id, editTagRef.current || tag.label); setEditingTagId(null); }}
                      onKeyDown={e => { if (e.key === "Enter") { renameCustomTag(tag.id, editTagRef.current || tag.label); setEditingTagId(null); } }}
                      className="bg-transparent focus:outline-none w-16 text-xs"
                      style={{ color: tag.color }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : tag.label}
                </button>

                {editTagsMode && (
                  <div className="flex items-center gap-0.5">
                    {!tag.builtin && (
                      <>
                        <button onClick={() => { editTagRef.current = tag.label; setEditingTagId(tag.id); }}
                          className="p-0.5 rounded hover:bg-white/5" style={{ color: "#a78bfa" }}>
                          <Icon name="Pencil" size={10} />
                        </button>
                        <input type="color" value={tag.color}
                          onChange={e => changeTagColor(tag.id, e.target.value)}
                          className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <button onClick={() => deleteCustomTag(tag.id)}
                          className="p-0.5 rounded hover:bg-red-500/10" style={{ color: "#ef4444" }}>
                          <Icon name="X" size={10} />
                        </button>
                      </>
                    )}
                    {tag.builtin && (
                      <button onClick={() => hideBuiltinTag(tag.label)}
                        className="p-0.5 rounded hover:bg-red-500/10" style={{ color: "#ef4444" }}>
                        <Icon name="X" size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {editTagsMode && hiddenBuiltin.size > 0 && (
            <div className="w-full mt-2 flex flex-wrap gap-2">
              <span className="text-[10px] w-full" style={{ color: t.textMute }}>Скрытые встроенные:</span>
              {DEFAULT_TAGS.filter(tg => hiddenBuiltin.has(tg.label)).map(tag => (
                <button key={tag.label}
                  onClick={() => { const next = new Set(hiddenBuiltin); next.delete(tag.label); setHiddenBuiltin(next); saveHiddenBuiltinTags(next); }}
                  className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold transition opacity-50 hover:opacity-100"
                  style={{ background: tag.color + "20", color: tag.color, border: `1px solid ${tag.color}40` }}>
                  + {tag.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {editTagsMode && (
          <div className="flex items-center gap-1.5 mt-3 w-full">
            <input
              value={newTagLabel}
              onChange={e => setNewTagLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addCustomTag(); }}
              className="rounded-lg px-2.5 py-1 text-xs focus:outline-none w-32"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
              placeholder="Новая метка..."
            />
            <div className="flex gap-1">
              {PRESET_TAG_COLORS.map(c => (
                <button key={c} onClick={() => setNewTagColor(c)}
                  className="w-4 h-4 rounded-full transition"
                  style={{
                    background: c,
                    outline: newTagColor === c ? `2px solid ${c}` : "none",
                    outlineOffset: 2,
                  }} />
              ))}
            </div>
            <button onClick={addCustomTag} disabled={!newTagLabel.trim()}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-40"
              style={{ background: newTagColor + "25", color: newTagColor, border: `1px solid ${newTagColor}50` }}>
              + Добавить
            </button>
          </div>
        )}

        {!editTagsMode && allVisibleTags.length > 0 && (
          <div className="mt-2 text-[10px]" style={{ color: t.textMute }}>
            Нажмите на метку чтобы включить / выключить
          </div>
        )}
      </div>
    </div>
  );
}
