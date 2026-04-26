import { useState } from "react";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";
import { RowWithToggle } from "./DrawerFinRowHelpers";

const LS_INFO_LABELS = "crm_info_row_labels";
function loadInfoLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_INFO_LABELS) || "{}"); } catch { return {}; }
}
function saveInfoLabel(key: string, label: string) {
  const curr = loadInfoLabels();
  curr[key] = label;
  localStorage.setItem(LS_INFO_LABELS, JSON.stringify(curr));
}

const LS_INFO_VIS = "crm_info_row_visibility";
function loadInfoVis(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_INFO_VIS) || "{}"); } catch { return {}; }
}
function saveInfoVis(v: Record<string, boolean>) {
  localStorage.setItem(LS_INFO_VIS, JSON.stringify(v));
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

// ── Contacts ─────────────────────────────────────────────────────────────────
export function DrawerContactsBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog }: InfoBlocksProps) {
  const id: BlockId = "contacts";
  const isHidden = hiddenBlocks.has(id);
  const editMode = editingBlock === id;
  const [labels, setLabels] = useState<Record<string, string>>(loadInfoLabels);
  const [vis, setVis] = useState<Record<string, boolean>>(loadInfoVis);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => { setLabels(p => ({ ...p, [key]: label })); saveInfoLabel(key, label); };
  const toggleVis = (key: string) => { setVis(p => { const n = { ...p, [key]: !p[key] }; saveInfoVis(n); return n; }); };
  const isVisible = (key: string) => vis[key] !== false;

  const rows: { key: keyof Client; def: string; ph: string; save: (v: string) => void }[] = [
    { key: "client_name",       def: "Имя клиента",    ph: "Добавить имя",      save: v => saveWithLog({ client_name: v },       `Имя: ${v}`,           "User",  "#10b981") },
    { key: "phone",             def: "Телефон",         ph: "Добавить телефон",  save: v => saveWithLog({ phone: v },             `Телефон: ${v}`,       "Phone", "#10b981") },
    { key: "responsible_phone", def: "Ответственный",   ph: "Прораб / дизайнер", save: v => saveWithLog({ responsible_phone: v }, `Ответственный: ${v}`, "User",  "#10b981") },
  ];

  return (
    <Section icon="Phone" title="Контакты" color="#10b981" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      {rows.map(r => (
        // В режиме редактирования показываем все строки (даже скрытые — полупрозрачно)
        // Вне режима — скрытые не рендерятся (visible=false → RowWithToggle вернёт null)
        <div key={r.key} style={{ opacity: !isVisible(r.key) && editMode ? 0.35 : 1 }}>
          <RowWithToggle rowKey={r.key} visible={isVisible(r.key) || editMode} onToggle={toggleVis} editMode={editMode}
            editableLabel={getLabel(r.key, r.def)} onLabelChange={l => renameLabel(r.key, l)}
            onDelete={() => toggleVis(r.key)}>
            <InlineField label={getLabel(r.key, r.def)} value={data[r.key] as string} onSave={r.save} placeholder={r.ph} />
          </RowWithToggle>
        </div>
      ))}
    </Section>
  );
}

// ── Object ────────────────────────────────────────────────────────────────────
export function DrawerObjectBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog }: InfoBlocksProps) {
  const id: BlockId = "object";
  const isHidden = hiddenBlocks.has(id);
  const editMode = editingBlock === id;
  const [labels, setLabels] = useState<Record<string, string>>(loadInfoLabels);
  const [vis, setVis] = useState<Record<string, boolean>>(loadInfoVis);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => { setLabels(p => ({ ...p, [key]: label })); saveInfoLabel(key, label); };
  const toggleVis = (key: string) => { setVis(p => { const n = { ...p, [key]: !p[key] }; saveInfoVis(n); return n; }); };
  const isVisible = (key: string) => vis[key] !== false;

  const rows: { key: keyof Client; def: string; ph: string; type?: string; save: (v: string) => void }[] = [
    { key: "address",  def: "Адрес",          ph: "Добавить адрес",   save: v => saveWithLog({ address: v },                             `Адрес: ${v}`,      "MapPin",   "#f59e0b") },
    { key: "map_link", def: "Ссылка на карту", ph: "Добавить ссылку",  save: v => saveWithLog({ map_link: v },                           "Карта обновлена",  "Link",     "#f59e0b") },
    { key: "area",     def: "Площадь (м²)",   ph: "—", type: "number", save: v => saveWithLog({ area: +v || null } as Partial<Client>,   `Площадь: ${v} м²`, "Maximize2","#f59e0b") },
  ];

  return (
    <Section icon="MapPin" title="Объект" color="#f59e0b" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      {rows.map(r => (
        <div key={r.key} style={{ opacity: !isVisible(r.key) && editMode ? 0.35 : 1 }}>
          <RowWithToggle rowKey={r.key} visible={isVisible(r.key) || editMode} onToggle={toggleVis} editMode={editMode}
            editableLabel={getLabel(r.key, r.def)} onLabelChange={l => renameLabel(r.key, l)}
            onDelete={() => toggleVis(r.key)}>
            <InlineField label={getLabel(r.key, r.def)} value={data[r.key] as string | number} onSave={r.save} type={r.type} placeholder={r.ph} />
          </RowWithToggle>
        </div>
      ))}
    </Section>
  );
}

// ── Dates ─────────────────────────────────────────────────────────────────────
export function DrawerDatesBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog }: InfoBlocksProps) {
  const id: BlockId = "dates";
  const isHidden = hiddenBlocks.has(id);
  const editMode = editingBlock === id;
  const [labels, setLabels] = useState<Record<string, string>>(loadInfoLabels);
  const [vis, setVis] = useState<Record<string, boolean>>(loadInfoVis);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => { setLabels(p => ({ ...p, [key]: label })); saveInfoLabel(key, label); };
  const toggleVis = (key: string) => { setVis(p => { const n = { ...p, [key]: !p[key] }; saveInfoVis(n); return n; }); };
  const isVisible = (key: string) => vis[key] !== false;

  const rows: { key: keyof Client; def: string; valFn: () => string; save: (v: string) => void }[] = [
    { key: "measure_date", def: "Дата замера",  valFn: () => data.measure_date ? data.measure_date.slice(0, 16) : "", save: v => saveWithLog({ measure_date: v || null }, v ? `Замер: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата замера удалена",  "Ruler",  "#f97316") },
    { key: "install_date", def: "Дата монтажа", valFn: () => data.install_date ? data.install_date.slice(0, 16) : "", save: v => saveWithLog({ install_date: v || null }, v ? `Монтаж: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата монтажа удалена", "Wrench", "#f97316") },
  ];

  return (
    <Section icon="Calendar" title="Даты" color="#f97316" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      {rows.map(r => (
        <div key={r.key} style={{ opacity: !isVisible(r.key) && editMode ? 0.35 : 1 }}>
          <RowWithToggle rowKey={r.key} visible={isVisible(r.key) || editMode} onToggle={toggleVis} editMode={editMode}
            editableLabel={getLabel(r.key, r.def)} onLabelChange={l => renameLabel(r.key, l)}
            onDelete={() => toggleVis(r.key)}>
            <InlineField label={getLabel(r.key, r.def)} value={r.valFn()} onSave={r.save} type="datetime-local" placeholder="Добавить дату" />
          </RowWithToggle>
        </div>
      ))}
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
