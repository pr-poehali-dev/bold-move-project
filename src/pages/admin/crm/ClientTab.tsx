import { useState, useRef } from "react";
import { Client, DEFAULT_TAGS } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import {
  CustomClientField,
  loadClientFields, saveClientFields,
  loadClientExtraValues, saveClientExtraValues,
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

  // ── Метки: ровно 2 варианта (Недозвон / Перезвонить), максимум одна активна.
  // Клик по неактивной — ставит её (снимая прошлую). Клик по активной — снимает.
  const toggleTag = (label: string) => {
    const cur = (data.tags || [])[0];
    save({ tags: cur === label ? [] : [label] });
  };

  return (
    <div className="px-6 py-5 space-y-5" style={{ maxWidth: 900 }}>

      {/* ── Поля (встроенные + кастомные) ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      {visibleFields.map(field => {
        const isEditing  = editMode && editingFieldId === field.id;
        const isBuiltin  = !!field.builtin;
        const isDragOver = dragOver === field.id;

        const isWide = isBuiltin && field.clientKey === "notes";

        return (
          <div
            key={field.id}
            draggable={editMode}
            onDragStart={() => onDragStart(field.id)}
            onDragOver={e => onDragOver(e, field.id)}
            onDrop={() => onDrop(field.id)}
            onDragEnd={onDragEnd}
            className={isWide ? "md:col-span-2" : ""}
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
      </div>{/* end fields grid */}

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

      {/* ── Метки: только 2 варианта, максимум одна активна одновременно.
           Метка сбрасывается автоматически при смене этапа заказа. ── */}
      <div>
        <label className="text-xs font-medium mb-2 block" style={{ color: t.textMute }}>Метки</label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_TAGS.map(tag => {
            const active = (data.tags || [])[0] === tag.label;
            return (
              <div key={tag.label} className="flex items-center gap-1">
                <button
                  onClick={() => toggleTag(tag.label)}
                  title={active ? "Нажмите, чтобы снять метку" : `Поставить метку «${tag.label}»`}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: active ? tag.color + "30" : t.surface2,
                    color: active ? tag.color : t.textMute,
                    border: `1px solid ${active ? tag.color + "60" : t.border}`,
                  }}>
                  {tag.label}
                </button>
                {active && (
                  <button onClick={() => toggleTag(tag.label === "Недозвон" ? "Перезвонить" : "Недозвон")}
                    title="Сменить метку"
                    className="p-1 rounded-md transition hover:bg-white/10" style={{ color: tag.color }}>
                    <Icon name="RefreshCw" size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}