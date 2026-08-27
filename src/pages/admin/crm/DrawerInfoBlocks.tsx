import { useState, useEffect } from "react";
import { useTheme } from "./themeContext";
import { Client, crmFetch } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";
import { RowWithToggle } from "./DrawerFinRowHelpers";
import { loadClientFields, saveClientFields, loadClientExtraValues, saveClientExtraValues, type CustomClientField } from "./clientFieldsStore";
import { useOrderSources } from "@/hooks/useOrderSources";
import Icon from "@/components/ui/icon";
import { useCallClient } from "./useCallClient";
import { useAuth, hasPermission } from "@/context/AuthContext";

// Источник — маркетинговый канал (Авито/ВК/Сайт). Для заявок из интеграций (Avito, квиз)
// определяется автоматически и не редактируется руками — редактирование разрешено только
// для заявок, созданных вручную в CRM (created_via === "manual").
function SourceRow({ value, editable, onSave }: { value: string; editable: boolean; onSave: (v: string) => void }) {
  const t = useTheme();
  const { sources } = useOrderSources();
  const current = sources.find(s => s.name === value);

  if (!editable) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <span className="text-xs" style={{ color: "#d4d4d4" }}>Источник</span>
        <span className="flex items-center gap-1.5 text-xs font-medium" title="Определяется автоматически — не редактируется">
          {current && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: current.color }} />}
          <span style={{ color: current ? current.color : t.textMute }}>{value || "Не указано"}</span>
          <Icon name="Lock" size={10} style={{ color: t.textMute }} />
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-xs" style={{ color: "#d4d4d4" }}>Источник</span>
      <div className="flex items-center gap-1.5">
        {current && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: current.color }} />}
        <select
          value={value || ""}
          onChange={e => onSave(e.target.value)}
          className="text-xs font-medium rounded-md px-1.5 py-0.5 focus:outline-none cursor-pointer"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }}
        >
          <option value="">Не указано</option>
          {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          {value && !current && <option value={value}>{value}</option>}
        </select>
      </div>
    </div>
  );
}

// Ответственный — кто закреплён за заявкой. По умолчанию проставляется автоматически
// (кто первым тронул заявку), но при наличии права orders_reassign можно сменить вручную
// через выпадающий список коллег. Владельцу/мастеру право доступно всегда.
//
// Запрос на смену отправляется САМИМ компонентом (не через общий saveWithLog) —
// тот меняет значение на экране оптимистично и не проверяет ответ сервера, поэтому
// отказ backend'а (нет прав/сотрудник не найден) раньше был не виден: на экране
// новое имя появлялось, но в базе ничего не менялось, и после обновления страницы
// значение "откатывалось" — выглядело как "не сохраняется".
// field — какое поле заявки редактируем (assigned_to, assigned_manager2, assigned_measurer,
// assigned_technologist, assigned_installer) — так один компонент обслуживает все 5 ролей
// блока «Ответственные», а не только менеджера 1 линии.
function AssignedRow({ clientId, label, field, assignedTo, assignedName, canReassign, onSaved }: {
  clientId: number;
  label: string;
  field: string;
  assignedTo?: number | null;
  assignedName?: string | null;
  canReassign: boolean;
  onSaved: (userId: number | null, name: string | null) => void;
}) {
  const t = useTheme();
  const [members, setMembers] = useState<{ id: number; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!canReassign || loaded) return;
    crmFetch("team-members")
      .then(d => setMembers(((d as { members?: { id: number; name: string }[] })?.members) || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [canReassign, loaded]);

  if (!canReassign) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <span className="text-xs" style={{ color: "#d4d4d4" }}>{label}</span>
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <Icon name={assignedName ? "UserCheck" : "UserPlus"} size={11}
            style={{ color: assignedName ? "#34d399" : t.textMute }} />
          <span style={{ color: assignedName ? t.text : t.textMute }}>
            {assignedName || "Не назначен"}
          </span>
        </span>
      </div>
    );
  }

  // Технические тексты ошибки backend'а (например служебное "nothing to update" —
  // означает, что сохранять больше нечего, т.к. само поле уже применилось отдельным
  // запросом) заменяем на понятную формулировку, а не показываем как есть.
  const humanizeError = (raw: string) =>
    /nothing to update/i.test(raw) ? "" : raw;

  const handleChange = async (raw: string) => {
    setErr("");
    setJustSaved(false);
    setSaving(true);
    const newId = raw ? Number(raw) : null;
    const name = raw ? (members.find(m => m.id === newId)?.name || null) : null;
    try {
      const d = await crmFetch("clients", { method: "PUT", body: JSON.stringify({ [field]: newId }) }, { id: String(clientId) }) as { error?: string };
      const humanErr = d?.error ? humanizeError(d.error) : "";
      if (humanErr) {
        setErr(humanErr);
      } else {
        onSaved(newId, name);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      }
    } catch {
      setErr("Не удалось сохранить — проверьте связь");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs flex-shrink-0" style={{ color: "#d4d4d4" }}>{label}</span>
        {/* w-auto + text-right — иначе <select> растягивался на всю ширину контейнера
            и выглядел непропорционально большим и "съехавшим" влево */}
        <select
          value={assignedTo ?? ""}
          disabled={saving}
          onChange={e => handleChange(e.target.value)}
          className="max-w-[140px] text-right text-xs font-medium rounded-md pl-1.5 pr-1 py-0.5 focus:outline-none cursor-pointer disabled:opacity-50"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: assignedName ? "#34d399" : t.textMute }}
        >
          <option value="">Не назначен</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          {assignedTo && !members.find(m => m.id === assignedTo) && assignedName && (
            <option value={assignedTo}>{assignedName}</option>
          )}
        </select>
      </div>
      {err && <div className="text-[10px] mt-1 text-right" style={{ color: "#ef4444" }}>{err}</div>}
      {justSaved && !err && (
        <div className="text-[10px] mt-1 text-right flex items-center justify-end gap-1" style={{ color: "#34d399" }}>
          <Icon name="Check" size={10} /> Сохранено
        </div>
      )}
    </div>
  );
}

// Создано через — технический канал создания заявки. Проставляется автоматически, не редактируется.
const CREATED_VIA_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  chat:   { label: "Чат",        icon: "MessageCircle", color: "#8b5cf6" },
  plan:   { label: "Построитель", icon: "PenTool",       color: "#10b981" },
  manual: { label: "CRM",         icon: "LayoutGrid",    color: "#3b82f6" },
};

// Подвал карточки — компактный вариант той же строки, для низа карточки клиента.
export function DrawerFooterInfo({ createdVia, createdAt, source }: { createdVia: string | null | undefined; createdAt?: string | null; source?: string | null }) {
  const isAvito = (source || "").trim().toLowerCase() === "авито" || (source || "").trim().toLowerCase() === "avito";
  const info = isAvito
    ? { label: "Интеграция Avito", icon: "MessagesSquare", color: "#f97316" }
    : (createdVia ? CREATED_VIA_LABELS[createdVia] : undefined);
  if (!info) return null;
  const dateStr = (() => {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  })();
  return (
    <div className="flex items-center justify-center gap-1.5 py-2 text-[10px]" style={{ color: "#6b7280" }}
      title="Технический канал создания заявки — не редактируется">
      <Icon name={info.icon} size={10} style={{ opacity: 0.6 }} />
      <span>Создано через: {info.label}</span>
      {dateStr && <span style={{ opacity: 0.7 }}>· {dateStr}</span>}
    </div>
  );
}

function AddRowInline({ color, onAdd, onDone }: { color: string; onAdd: (label: string) => void; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const commit = () => {
    if (val.trim()) { onAdd(val.trim()); setVal(""); }
    setOpen(false);
    onDone?.();
  };
  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1 mt-1 text-xs transition-opacity opacity-40 hover:opacity-80"
      style={{ color }}>
      <Icon name="Plus" size={11} /> Добавить поле
    </button>
  );
  return (
    <div className="flex items-center gap-2 mt-1">
      <input autoFocus value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setOpen(false); setVal(""); } }}
        placeholder="Название поля"
        className="flex-1 rounded px-2 py-1 text-xs bg-white/5 border border-white/10 text-white focus:outline-none" />
      <button onClick={commit} className="text-xs px-2 py-1 rounded" style={{ background: color + "30", color }}>ОК</button>
      <button onClick={() => { setOpen(false); setVal(""); }} className="text-xs opacity-40 hover:opacity-70">✕</button>
    </div>
  );
}

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
  /** Перейти на вкладку «Касания» и поставить курсор в поле ввода (иконка «написать» у телефона) */
  onGoToTouches?: () => void;
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

// ── Contacts ─────────────────────────────────────────────────────────────────
export function DrawerContactsBlock({ data, setData, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog, logAction, onGoToTouches }: InfoBlocksProps) {
  const { user } = useAuth();
  const canReassign = hasPermission(user, "orders_reassign");
  const id: BlockId = "contacts";
  const { isHidden, editMode } = useInfoBlock(id, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock);
  const { call: callViaUis, calling } = useCallClient();

  // Читаем поля из единого хранилища (синхронизировано с ClientTab)
  const [fields, setFields]           = useState(loadClientFields);
  const [extraValues, setExtraValues] = useState<Record<string, string>>(
    () => loadClientExtraValues(data.id)
  );

  // «Комментарий» (builtin_notes) убран из блока «Контакты» — теперь это
  // «Summary по коммуникациям» в новом блоке «Комментарий» (DrawerCommentsBlock).
  const visibleFields = fields.filter(f => !f.hidden && f.id !== "builtin_notes");

  const saveExtraVal = (fieldId: string, value: string) => {
    const updated = { ...extraValues, [fieldId]: value };
    setExtraValues(updated);
    saveClientExtraValues(data.id, updated);
  };

  const addCustomField = (label: string) => {
    const newField: CustomClientField = { id: `field_${Date.now()}`, label };
    const updated = [...fields, newField];
    setFields(updated);
    saveClientFields(updated);
  };

  return (
    <Section icon="Phone" title="Контакты" color="#10b981" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      {visibleFields.map(field => {
        if (field.builtin && field.clientKey) {
          const val = (data[field.clientKey as keyof Client] as string) || "";
          const saveKey = field.clientKey;
          return (
            <RowWithToggle key={field.id} rowKey={field.id} visible onToggle={() => {}} editMode={editMode}
              editableLabel={field.label} onLabelChange={l => {
                const updated = fields.map(f => f.id === field.id ? { ...f, label: l } : f);
                setFields(updated);
                saveClientFields(updated);
              }}
              onDelete={() => {
                const updated = fields.map(f => f.id === field.id ? { ...f, hidden: true } : f);
                setFields(updated);
                saveClientFields(updated);
              }}>
              <InlineField
                label={field.label}
                value={val}
                onSave={v => saveWithLog({ [saveKey]: v } as Partial<Client>, `${field.label}: ${v}`, "User", "#10b981")}
                placeholder={field.label}
                multiline={field.id === "builtin_notes"}
                onCall={saveKey === "phone" ? () => callViaUis(val) : undefined}
                calling={saveKey === "phone" ? calling : undefined}
                onMessage={saveKey === "phone" && onGoToTouches ? onGoToTouches : undefined}
              />
            </RowWithToggle>
          );
        }
        return (
          <RowWithToggle key={field.id} rowKey={field.id} visible onToggle={() => {}} editMode={editMode}
            editableLabel={field.label} onLabelChange={l => {
              const updated = fields.map(f => f.id === field.id ? { ...f, label: l } : f);
              setFields(updated);
              saveClientFields(updated);
            }}
            onDelete={() => {
              const updated = fields.filter(f => f.id !== field.id);
              setFields(updated);
              saveClientFields(updated);
            }}>
            <InlineField
              label={field.label}
              value={extraValues[field.id] || ""}
              onSave={v => saveExtraVal(field.id, v)}
              placeholder={field.label}
            />
          </RowWithToggle>
        );
      })}
      <SourceRow
        value={data.source || ""}
        editable={data.created_via === "manual"}
        onSave={v => saveWithLog({ source: v } as Partial<Client>, `Источник: ${v}`, "Radio", "#10b981")}
      />
      <AssignedRow
        clientId={data.id}
        label="Ответственный"
        field="assigned_to"
        assignedTo={data.assigned_to}
        assignedName={data.assigned_name}
        canReassign={canReassign}
        onSaved={(userId, name) => {
          setData({ ...data, assigned_to: userId, assigned_name: name });
          logAction("UserCog", "#818cf8", userId ? `Назначен ответственный: ${name}` : "Ответственный снят");
        }}
      />
      {editMode && <AddRowInline color="#10b981" onAdd={addCustomField} />}
    </Section>
  );
}

// ── Assigned roles (блок «Ответственные») ───────────────────────────────────────
// 4 дополнительные роли, помимо менеджера 1 линии (тот остаётся в блоке «Контакты»
// как AssignedRow «Ответственный» — исторически он там, трогать не будем, чтобы
// не ломать привычный UX). Права те же — orders_reassign.
const ASSIGNED_ROLES: { field: "assigned_manager2" | "assigned_measurer" | "assigned_technologist" | "assigned_installer";
  nameField: "assigned_manager2_name" | "assigned_measurer_name" | "assigned_technologist_name" | "assigned_installer_name";
  label: string }[] = [
  { field: "assigned_manager2",     nameField: "assigned_manager2_name",     label: "Менеджер (2 линия)" },
  { field: "assigned_measurer",     nameField: "assigned_measurer_name",     label: "Замерщик" },
  { field: "assigned_technologist", nameField: "assigned_technologist_name", label: "Технолог" },
  { field: "assigned_installer",    nameField: "assigned_installer_name",    label: "Монтажник" },
];

export function DrawerAssignedRolesBlock({ data, setData, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, logAction }: InfoBlocksProps) {
  const { user } = useAuth();
  const canReassign = hasPermission(user, "orders_reassign");
  const id: BlockId = "assigned_roles";
  const { isHidden } = useInfoBlock(id, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock);

  return (
    <Section icon="UsersRound" title="Ответственные" color="#818cf8" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}>
      {ASSIGNED_ROLES.map(r => (
        <AssignedRow
          key={r.field}
          clientId={data.id}
          label={r.label}
          field={r.field}
          assignedTo={data[r.field]}
          assignedName={data[r.nameField]}
          canReassign={canReassign}
          onSaved={(userId, name) => {
            setData({ ...data, [r.field]: userId, [r.nameField]: name } as Client);
            logAction("UserCog", "#818cf8", userId ? `${r.label}: ${name}` : `${r.label} снят`);
          }}
        />
      ))}
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
          <InlineField label={row.label} value={row.value} onSave={v => updateExtraRow(i, v)} placeholder="Добавить значение" hideLabel={editMode} />
        </RowWithToggle>
      ))}
      {editMode && <AddRowInline color="#f59e0b" onAdd={addExtraRow} onDone={() => setEditingBlock(null)} />}
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
          <InlineField label={row.label} value={row.value} onSave={v => updateExtraRow(i, v)} placeholder="Добавить значение" hideLabel={editMode} />
        </RowWithToggle>
      ))}
      {editMode && <AddRowInline color="#f97316" onAdd={addExtraRow} onDone={() => setEditingBlock(null)} />}
    </Section>
  );
}

// ── Касания (даты звонков) ───────────────────────────────────────────────────
// Дефолтный блок, виден у всех по умолчанию. Два поля:
// - "Дата следующего звонка" — обычная дата, сотрудник выбирает вручную (напоминание).
// - "Дата последнего звонка" — только для чтения, подтягивается автоматически
//   из истории звонков телефонии (UIS), редактировать нельзя.
export function DrawerCallDatesBlock({ data, hiddenBlocks, toggleHidden, saveWithLog }: InfoBlocksProps) {
  const t = useTheme();
  const id: BlockId = "call_dates";
  const isHidden = hiddenBlocks.has(id);

  const nextCallVal = data.next_call_date ? data.next_call_date.slice(0, 16) : "";
  const lastCallVal = data.last_call_at
    ? new Date(data.last_call_at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  const saveNextCall = (v: string) => saveWithLog(
    { next_call_date: v || null },
    v ? `Следующий звонок: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата следующего звонка удалена",
    "PhoneOutgoing", "#3b82f6"
  );

  return (
    <Section icon="PhoneCall" title="Касания" color="#3b82f6" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}>
      <div style={{ borderBottom: `1px solid ${t.border2}`, minHeight: 36 }}>
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-1.5 flex-shrink-0 w-36 py-2">
            <span className="text-xs" style={{ color: "#d4d4d4" }}>Последний звонок</span>
          </div>
          <div className="flex-1 text-right text-sm py-2" title="Подтягивается автоматически из телефонии — не редактируется">
            {lastCallVal
              ? <span style={{ color: t.textSub }}>{lastCallVal}</span>
              : <span className="text-xs" style={{ color: t.textMute }}>Ещё не звонили</span>}
          </div>
        </div>
      </div>
      <InlineField label="Следующий звонок" value={nextCallVal} onSave={saveNextCall}
        type="datetime-local" placeholder="Выбрать дату" />
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