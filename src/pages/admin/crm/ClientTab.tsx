import { useState, useRef } from "react";
import { Client, DEFAULT_TAGS } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import {
  CustomTag, CustomClientField,
  loadCustomTags, saveCustomTags,
  loadClientFields, saveClientFields,
  loadClientExtraValues, saveClientExtraValues,
  PRESET_TAG_COLORS,
} from "./clientFieldsStore";

interface Props {
  data: Client;
  save: (patch: Partial<Client>) => void;
}

// Все доступные метки = дефолтные + кастомные
function getAllTags(customTags: CustomTag[]) {
  const base = DEFAULT_TAGS.map(t => ({ id: t.label, label: t.label, color: t.color, builtin: true }));
  const custom = customTags.map(t => ({ ...t, builtin: false }));
  return [...base, ...custom];
}

export default function ClientTab({ data, save }: Props) {
  const t = useTheme();

  // ── Кастомные метки ────────────────────────────────────────────────────
  const [customTags, setCustomTags]   = useState<CustomTag[]>(loadCustomTags);
  const [editTagsMode, setEditTagsMode] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_TAG_COLORS[0]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const editTagRef = useRef<string>("");

  const allTags = getAllTags(customTags);

  const toggleTag = (label: string) => {
    const cur = data.tags || [];
    const next = cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label];
    save({ tags: next });
  };

  const addCustomTag = () => {
    const label = newTagLabel.trim();
    if (!label) return;
    const newTag: CustomTag = { id: `tag_${Date.now()}`, label, color: newTagColor };
    const updated = [...customTags, newTag];
    setCustomTags(updated);
    saveCustomTags(updated);
    setNewTagLabel("");
  };

  const deleteCustomTag = (id: string) => {
    const tag = customTags.find(t => t.id === id);
    const updated = customTags.filter(t => t.id !== id);
    setCustomTags(updated);
    saveCustomTags(updated);
    if (tag && (data.tags || []).includes(tag.label)) {
      save({ tags: (data.tags || []).filter(l => l !== tag.label) });
    }
  };

  const renameCustomTag = (id: string, newLabel: string) => {
    const tag = customTags.find(t => t.id === id);
    const updated = customTags.map(t => t.id === id ? { ...t, label: newLabel } : t);
    setCustomTags(updated);
    saveCustomTags(updated);
    if (tag && (data.tags || []).includes(tag.label)) {
      save({ tags: (data.tags || []).map(l => l === tag.label ? newLabel : l) });
    }
  };

  const changeTagColor = (id: string, color: string) => {
    const updated = customTags.map(t => t.id === id ? { ...t, color } : t);
    setCustomTags(updated);
    saveCustomTags(updated);
  };

  // ── Кастомные поля ─────────────────────────────────────────────────────
  const [clientFields, setClientFields] = useState<CustomClientField[]>(loadClientFields);
  const [extraValues, setExtraValues]   = useState<Record<string, string>>(
    () => loadClientExtraValues(data.id)
  );
  const [editFieldsMode, setEditFieldsMode] = useState(false);
  const [newFieldLabel, setNewFieldLabel]   = useState("");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const editFieldRef = useRef<string>("");

  const setExtraValue = (fieldId: string, value: string) => {
    const updated = { ...extraValues, [fieldId]: value };
    setExtraValues(updated);
    saveClientExtraValues(data.id, updated);
  };

  const addField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    const field: CustomClientField = { id: `field_${Date.now()}`, label };
    const updated = [...clientFields, field];
    setClientFields(updated);
    saveClientFields(updated);
    setNewFieldLabel("");
  };

  const deleteField = (id: string) => {
    const updated = clientFields.filter(f => f.id !== id);
    setClientFields(updated);
    saveClientFields(updated);
    const { [id]: _, ...rest } = extraValues;
    setExtraValues(rest);
    saveClientExtraValues(data.id, rest);
  };

  const renameField = (id: string, newLabel: string) => {
    const updated = clientFields.map(f => f.id === id ? { ...f, label: newLabel } : f);
    setClientFields(updated);
    saveClientFields(updated);
  };

  return (
    <div className="px-6 py-5 space-y-5 max-w-xl">

      {/* ── Имя ─────────────────────────────────────────────────────── */}
      <Field label="Имя клиента" t={t}>
        <input
          key={data.client_name}
          defaultValue={data.client_name || ""}
          onBlur={e => { if (e.target.value !== data.client_name) save({ client_name: e.target.value }); }}
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
          placeholder="Введите имя"
        />
      </Field>

      {/* ── Телефон ──────────────────────────────────────────────────── */}
      <Field label="Телефон" t={t}>
        <input
          key={data.phone}
          defaultValue={data.phone || ""}
          onBlur={e => { if (e.target.value !== data.phone) save({ phone: e.target.value }); }}
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
          placeholder="+7 (___) ___-__-__"
        />
      </Field>

      {/* ── Ответственный ────────────────────────────────────────────── */}
      <Field label="Ответственный (прораб / дизайнер)" t={t}>
        <input
          key={data.responsible_phone ?? ""}
          defaultValue={data.responsible_phone || ""}
          onBlur={e => { if (e.target.value !== (data.responsible_phone || "")) save({ responsible_phone: e.target.value }); }}
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
          placeholder="Имя или телефон"
        />
      </Field>

      {/* ── Заметка ──────────────────────────────────────────────────── */}
      <Field label="Заметка о клиенте" t={t}>
        <textarea
          key={data.notes ?? ""}
          defaultValue={data.notes || ""}
          onBlur={e => { if (e.target.value !== (data.notes || "")) save({ notes: e.target.value }); }}
          rows={3}
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition resize-none"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
          placeholder="Комментарий..."
        />
      </Field>

      {/* ── Кастомные поля ───────────────────────────────────────────── */}
      {clientFields.map(field => (
        <div key={field.id} className="relative group">
          {editFieldsMode && editingFieldId === field.id ? (
            <div className="flex gap-2 mb-1.5 items-center">
              <input
                autoFocus
                defaultValue={field.label}
                onChange={e => { editFieldRef.current = e.target.value; }}
                onBlur={() => { renameField(field.id, editFieldRef.current || field.label); setEditingFieldId(null); }}
                onKeyDown={e => { if (e.key === "Enter") { renameField(field.id, editFieldRef.current || field.label); setEditingFieldId(null); } }}
                className="flex-1 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
                style={{ background: t.surface2, border: `1px solid #7c3aed`, color: t.text }}
              />
            </div>
          ) : (
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: t.textMute }}>
              {field.label}
              {editFieldsMode && (
                <>
                  <button onClick={() => { editFieldRef.current = field.label; setEditingFieldId(field.id); }}
                    className="p-0.5 rounded hover:bg-white/5" style={{ color: "#7c3aed" }}>
                    <Icon name="Pencil" size={11} />
                  </button>
                  <button onClick={() => deleteField(field.id)}
                    className="p-0.5 rounded hover:bg-red-500/10" style={{ color: "#ef4444" }}>
                    <Icon name="Trash2" size={11} />
                  </button>
                </>
              )}
            </label>
          )}
          <input
            value={extraValues[field.id] || ""}
            onChange={e => setExtraValue(field.id, e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
            placeholder={`Значение: ${field.label}`}
          />
        </div>
      ))}

      {/* ── Управление полями ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {editFieldsMode && (
          <div className="flex gap-2 flex-1">
            <input
              value={newFieldLabel}
              onChange={e => setNewFieldLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addField(); }}
              className="flex-1 rounded-xl px-3 py-2 text-xs focus:outline-none"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
              placeholder="Название поля..."
            />
            <button onClick={addField} disabled={!newFieldLabel.trim()}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-40"
              style={{ background: "#7c3aed20", color: "#a78bfa", border: "1px solid #7c3aed40" }}>
              + Добавить
            </button>
          </div>
        )}
        <button
          onClick={() => setEditFieldsMode(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition"
          style={{
            background: editFieldsMode ? "#7c3aed20" : t.surface2,
            color: editFieldsMode ? "#a78bfa" : t.textMute,
            border: `1px solid ${editFieldsMode ? "#7c3aed40" : t.border}`,
          }}>
          <Icon name={editFieldsMode ? "Check" : "Plus"} size={12} />
          {editFieldsMode ? "Готово" : "Добавить поле"}
        </button>
      </div>

      {/* ── Разделитель ──────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${t.border2}` }} />

      {/* ── Метки ────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium" style={{ color: t.textMute }}>Метки</label>
          <button
            onClick={() => setEditTagsMode(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition"
            style={{
              background: editTagsMode ? "#7c3aed20" : "transparent",
              color: editTagsMode ? "#a78bfa" : t.textMute,
            }}>
            <Icon name={editTagsMode ? "Check" : "Settings2"} size={11} />
            {editTagsMode ? "Готово" : "Настроить"}
          </button>
        </div>

        {/* Список меток */}
        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => {
            const active = (data.tags || []).includes(tag.label);
            return (
              <div key={tag.id} className="relative flex items-center gap-1">
                <button
                  onClick={() => !editTagsMode && toggleTag(tag.label)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: active ? tag.color + "30" : t.surface2,
                    color: active ? tag.color : t.textMute,
                    border: `1px solid ${active ? tag.color + "60" : t.border}`,
                    cursor: editTagsMode ? "default" : "pointer",
                  }}>
                  {editTagsMode && !tag.builtin && editingTagId === tag.id ? (
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
                    {/* Цвет — только для кастомных */}
                    {!tag.builtin && (
                      <>
                        <button
                          onClick={() => { editTagRef.current = tag.label; setEditingTagId(tag.id); }}
                          className="p-0.5 rounded hover:bg-white/5" style={{ color: "#a78bfa" }}>
                          <Icon name="Pencil" size={10} />
                        </button>
                        <div className="relative">
                          <input type="color" value={tag.color}
                            onChange={e => changeTagColor(tag.id, e.target.value)}
                            className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                            title="Цвет метки"
                          />
                        </div>
                        <button onClick={() => deleteCustomTag(tag.id)}
                          className="p-0.5 rounded hover:bg-red-500/10" style={{ color: "#ef4444" }}>
                          <Icon name="X" size={10} />
                        </button>
                      </>
                    )}
                    {tag.builtin && (
                      <div className="relative">
                        <input type="color" value={tag.color}
                          onChange={e => {
                            // Нельзя менять встроенные — подсказка
                          }}
                          className="w-4 h-4 rounded cursor-not-allowed border-0 bg-transparent p-0 opacity-30"
                          title="Встроенная метка (нельзя удалить)"
                          disabled
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Добавить новую метку */}
          {editTagsMode && (
            <div className="flex items-center gap-1.5 mt-1 w-full">
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
                    className="w-4 h-4 rounded-full transition ring-offset-1"
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
        </div>

        {/* Кликни для переключения метки (подсказка) */}
        {!editTagsMode && allTags.length > 0 && (
          <div className="mt-2 text-[10px]" style={{ color: t.textMute }}>
            Нажмите на метку чтобы включить / выключить
          </div>
        )}
      </div>
    </div>
  );
}

// ── Вспомогательный компонент поля ────────────────────────────────────────

function Field({ label, t, children }: { label: string; t: ReturnType<typeof useTheme>; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1.5 block" style={{ color: t.textMute }}>{label}</label>
      {children}
    </div>
  );
}
