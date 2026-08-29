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
import { InfoBlocksProps, AddRowInline, useInfoBlock } from "./drawerInfoShared";

// ── Contacts + Assigned roles: блоки, работающие с контактными данными клиента
// и списком ответственных сотрудников (менеджер, замерщик, технолог, монтажник).

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

// ── Contacts ─────────────────────────────────────────────────────────────────
export function DrawerContactsBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog, onGoToTouches }: InfoBlocksProps) {
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
      {editMode && <AddRowInline color="#10b981" onAdd={addCustomField} />}
    </Section>
  );
}

// ── Assigned roles (блок «Ответственные») ───────────────────────────────────────
// Все 5 ролей воронки, включая менеджера 1 линии (раньше он назывался «Ответственный»
// и жил отдельно в блоке «Контакты» — перенесён сюда и переименован для единообразия
// с остальными 4 ролями, чтобы все ответственные были в одном месте).
const ASSIGNED_ROLES: { field: "assigned_to" | "assigned_manager2" | "assigned_measurer" | "assigned_technologist" | "assigned_installer";
  nameField: "assigned_name" | "assigned_manager2_name" | "assigned_measurer_name" | "assigned_technologist_name" | "assigned_installer_name";
  label: string }[] = [
  { field: "assigned_to",           nameField: "assigned_name",              label: "Менеджер (1 линия)" },
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
