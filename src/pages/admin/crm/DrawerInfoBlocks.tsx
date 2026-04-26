import { useState } from "react";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";
import { RowWithToggle } from "./DrawerFinRowHelpers";

interface ExtraRow { label: string; value: string; }

const LS_INFO_LABELS = "crm_info_row_labels";
function loadInfoLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_INFO_LABELS) || "{}"); } catch { return {}; }
}
function saveInfoLabel(key: string, label: string) {
  const curr = loadInfoLabels(); curr[key] = label;
  localStorage.setItem(LS_INFO_LABELS, JSON.stringify(curr));
}

const LS_INFO_HIDDEN = "crm_info_row_hidden";
function loadInfoHidden(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_INFO_HIDDEN) || "{}"); } catch { return {}; }
}
function saveInfoHidden(v: Record<string, boolean>) {
  localStorage.setItem(LS_INFO_HIDDEN, JSON.stringify(v));
}

interface InfoBlocksProps {
  data: Client;
  client: Client;
  setData: (c: Client) => void;
  save: (patch: Partial<Client>) => void;
  hiddenBlocks: Set<BlockId>;
  editingBlock: BlockId | null;
  toggleHidden: (id: BlockId) => void;
  setEditingBlock: (id: BlockId | null) => void;
  saveWithLog: (patch: Partial<Client>, logText: string, icon?: string, color?: string) => void;
  logAction: (icon: string, color: string, text: string) => void;
}

function loadExtraRows(blockId: string): ExtraRow[] {
  try { return JSON.parse(localStorage.getItem(`info_extra_rows_${blockId}`) || "[]"); } catch { return []; }
}
function saveExtraRows(blockId: string, rows: ExtraRow[]) {
  localStorage.setItem(`info_extra_rows_${blockId}`, JSON.stringify(rows));
}

// Хук единой логики для инфо-блоков
function useInfoBlock(id: BlockId, hiddenBlocks: Set<BlockId>, editingBlock: BlockId | null, toggleHidden: (id: BlockId) => void, setEditingBlock: (id: BlockId | null) => void) {
  const isHidden = hiddenBlocks.has(id);
  const editMode = editingBlock === id;
  const [labels, setLabels] = useState<Record<string, string>>(loadInfoLabels);
  const [hidden, setHidden] = useState<Record<string, boolean>>(loadInfoHidden);
  const [extraRows, setExtraRows] = useState<ExtraRow[]>(() => loadExtraRows(id));

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => { setLabels(p => ({ ...p, [key]: label })); saveInfoLabel(key, label); };
  const hideRow = (key: string) => { setHidden(p => { const n = { ...p, [key]: true }; saveInfoHidden(n); return n; }); };
  const isVisible = (key: string) => !hidden[key];

  const addExtraRow = (label: string) => {
    setExtraRows(prev => { const next = [...prev, { label, value: "" }]; saveExtraRows(id, next); return next; });
  };
  const updateExtraRow = (i: number, value: string) => {
    setExtraRows(prev => { const next = prev.map((r, j) => j === i ? { ...r, value } : r); saveExtraRows(id, next); return next; });
  };
  const renameExtraRow = (i: number, label: string) => {
    setExtraRows(prev => { const next = prev.map((r, j) => j === i ? { ...r, label } : r); saveExtraRows(id, next); return next; });
  };
  const deleteExtraRow = (i: number) => {
    setExtraRows(prev => { const next = prev.filter((_, j) => j !== i); saveExtraRows(id, next); return next; });
  };

  return { isHidden, editMode, getLabel, renameLabel, hideRow, isVisible, extraRows, addExtraRow, updateExtraRow, renameExtraRow, deleteExtraRow, toggleHidden, setEditingBlock };
}

// Компонент добавления строки
function AddRowInline({ color, onAdd }: { color: string; onAdd: (label: string) => void }) {
  const [val, setVal] = useState("");
  const commit = () => { if (val.trim()) { onAdd(val.trim()); setVal(""); } };
  return (
    <div className="flex items-center gap-1.5 mt-1 mb-1">
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); }}
        placeholder="Новая строка..."
        className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
        style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${color}40`, color: "#fff" }} />
      <button onClick={commit} className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
        style={{ background: `${color}20`, color }}>OK</button>
    </div>
  );
}

// ── Contacts ─────────────────────────────────────────────────────────────────
export function DrawerContactsBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog }: InfoBlocksProps) {
  const id: BlockId = "contacts";
  const { isHidden, editMode, getLabel, renameLabel, hideRow, isVisible, extraRows, addExtraRow, updateExtraRow, renameExtraRow, deleteExtraRow } = useInfoBlock(id, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock);

  const rows: { key: keyof Client; def: string; ph: string; save: (v: string) => void }[] = [
    { key: "client_name",       def: "Имя клиента",   ph: "Добавить имя",      save: v => saveWithLog({ client_name: v },       `Имя: ${v}`,           "User",  "#10b981") },
    { key: "phone",             def: "Телефон",        ph: "Добавить телефон",  save: v => saveWithLog({ phone: v },             `Телефон: ${v}`,       "Phone", "#10b981") },
    { key: "responsible_phone", def: "Ответственный",  ph: "Прораб / дизайнер", save: v => saveWithLog({ responsible_phone: v }, `Ответственный: ${v}`, "User",  "#10b981") },
  ];

  return (
    <Section icon="Phone" title="Контакты" color="#10b981" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      {rows.filter(r => isVisible(r.key)).map(r => (
        <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={() => {}} editMode={editMode}
          editableLabel={getLabel(r.key, r.def)} onLabelChange={l => renameLabel(r.key, l)}
          onDelete={() => hideRow(r.key)}>
          <InlineField label={getLabel(r.key, r.def)} value={data[r.key] as string} onSave={r.save} placeholder={r.ph} />
        </RowWithToggle>
      ))}
      {extraRows.map((row, i) => (
        <RowWithToggle key={`extra_${i}`} rowKey={`extra_${i}`} visible onToggle={() => {}} editMode={editMode}
          editableLabel={row.label} onLabelChange={l => renameExtraRow(i, l)}
          onDelete={() => deleteExtraRow(i)}>
          <InlineField label={row.label} value={row.value} onSave={v => updateExtraRow(i, v)} placeholder="Добавить значение" />
        </RowWithToggle>
      ))}
      {editMode && <AddRowInline color="#10b981" onAdd={addExtraRow} />}
    </Section>
  );
}

// ── Object ────────────────────────────────────────────────────────────────────
export function DrawerObjectBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog }: InfoBlocksProps) {
  const id: BlockId = "object";
  const { isHidden, editMode, getLabel, renameLabel, hideRow, isVisible, extraRows, addExtraRow, updateExtraRow, renameExtraRow, deleteExtraRow } = useInfoBlock(id, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock);

  const rows: { key: keyof Client; def: string; ph: string; type?: string; save: (v: string) => void }[] = [
    { key: "address",  def: "Адрес",           ph: "Добавить адрес",  save: v => saveWithLog({ address: v },                           `Адрес: ${v}`,      "MapPin",    "#f59e0b") },
    { key: "map_link", def: "Ссылка на карту",  ph: "Добавить ссылку", save: v => saveWithLog({ map_link: v },                          "Карта обновлена",  "Link",      "#f59e0b") },
    { key: "area",     def: "Площадь (м²)",    ph: "—", type: "number", save: v => saveWithLog({ area: +v || null } as Partial<Client>, `Площадь: ${v} м²`, "Maximize2", "#f59e0b") },
  ];

  return (
    <Section icon="MapPin" title="Объект" color="#f59e0b" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      {rows.filter(r => isVisible(r.key)).map(r => (
        <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={() => {}} editMode={editMode}
          editableLabel={getLabel(r.key, r.def)} onLabelChange={l => renameLabel(r.key, l)}
          onDelete={() => hideRow(r.key)}>
          <InlineField label={getLabel(r.key, r.def)} value={data[r.key] as string | number} onSave={r.save} type={r.type} placeholder={r.ph} />
        </RowWithToggle>
      ))}
      {extraRows.map((row, i) => (
        <RowWithToggle key={`extra_${i}`} rowKey={`extra_${i}`} visible onToggle={() => {}} editMode={editMode}
          editableLabel={row.label} onLabelChange={l => renameExtraRow(i, l)}
          onDelete={() => deleteExtraRow(i)}>
          <InlineField label={row.label} value={row.value} onSave={v => updateExtraRow(i, v)} placeholder="Добавить значение" />
        </RowWithToggle>
      ))}
      {editMode && <AddRowInline color="#f59e0b" onAdd={addExtraRow} />}
    </Section>
  );
}

// ── Dates ─────────────────────────────────────────────────────────────────────
export function DrawerDatesBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog }: InfoBlocksProps) {
  const id: BlockId = "dates";
  const { isHidden, editMode, getLabel, renameLabel, hideRow, isVisible, extraRows, addExtraRow, updateExtraRow, renameExtraRow, deleteExtraRow } = useInfoBlock(id, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock);

  const rows: { key: keyof Client; def: string; valFn: () => string; save: (v: string) => void }[] = [
    { key: "measure_date", def: "Дата замера",  valFn: () => data.measure_date ? data.measure_date.slice(0, 16) : "", save: v => saveWithLog({ measure_date: v || null }, v ? `Замер: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата замера удалена",  "Ruler",  "#f97316") },
    { key: "install_date", def: "Дата монтажа", valFn: () => data.install_date ? data.install_date.slice(0, 16) : "", save: v => saveWithLog({ install_date: v || null }, v ? `Монтаж: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата монтажа удалена", "Wrench", "#f97316") },
  ];

  return (
    <Section icon="Calendar" title="Даты" color="#f97316" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      {rows.filter(r => isVisible(r.key)).map(r => (
        <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={() => {}} editMode={editMode}
          editableLabel={getLabel(r.key, r.def)} onLabelChange={l => renameLabel(r.key, l)}
          onDelete={() => hideRow(r.key)}>
          <InlineField label={getLabel(r.key, r.def)} value={r.valFn()} onSave={r.save} type="datetime-local" placeholder="Добавить дату" />
        </RowWithToggle>
      ))}
      {extraRows.map((row, i) => (
        <RowWithToggle key={`extra_${i}`} rowKey={`extra_${i}`} visible onToggle={() => {}} editMode={editMode}
          editableLabel={row.label} onLabelChange={l => renameExtraRow(i, l)}
          onDelete={() => deleteExtraRow(i)}>
          <InlineField label={row.label} value={row.value} onSave={v => updateExtraRow(i, v)} placeholder="Добавить значение" />
        </RowWithToggle>
      ))}
      {editMode && <AddRowInline color="#f97316" onAdd={addExtraRow} />}
    </Section>
  );
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export function DrawerNotesBlock({ data, client, setData, save, hiddenBlocks, toggleHidden, logAction }: InfoBlocksProps) {
  const t = useTheme();
  const isHidden = hiddenBlocks.has("notes");
  return (
    <Section icon="StickyNote" title="Заметки" color="#8b5cf6" hidden={isHidden}
      onToggleHidden={() => toggleHidden("notes")}>
      <textarea
        value={(() => {
          const notes = data.notes || "";
          return notes.split("\n").filter(l => !l.includes("Смета сохранена") && !l.includes("Email:") && !l.includes("Estimate ID:")).join("\n").trim();
        })()}
        onChange={e => setData({ ...data, notes: e.target.value })}
        onBlur={e => { if (e.target.value !== (client.notes || "")) { save({ notes: e.target.value }); logAction("StickyNote", "#8b5cf6", "Заметки обновлены"); } }}
        placeholder="Добавить заметку..." rows={3}
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none transition mt-2 mb-1"
        style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }}
      />
    </Section>
  );
}

export { DrawerFilesBlock } from "./DrawerFilesBlock";

// ── Cancel ────────────────────────────────────────────────────────────────────
export function DrawerCancelBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog }: InfoBlocksProps) {
  const id: BlockId = "cancel";
  const isHidden = hiddenBlocks.has(id);
  const editMode = editingBlock === id;
  if (data.status !== "cancelled") return null;
  return (
    <Section icon="XCircle" title="Причина отказа" color="#ef4444" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      <InlineField label="Причина" value={data.cancel_reason} onSave={v => saveWithLog({ cancel_reason: v }, `Причина отказа: ${v}`, "XCircle", "#ef4444")} placeholder="Укажите причину" />
    </Section>
  );
}