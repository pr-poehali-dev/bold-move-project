import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";
import { RowWithToggle } from "./DrawerFinRowHelpers";
import { useAuth } from "@/context/AuthContext";
import { InfoBlocksProps, AddRowInline, useInfoBlock } from "./drawerInfoShared";

// ── Object + Dates: блоки с адресом/площадью объекта и датами (желаемыми и
// фактическими) этапов замера/монтажа.

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
// Блок разбит на 2 подгруппы: «Желаемые» (ставит 1 линия со слов клиента, ещё не
// согласовано со специалистом) и «Фактические» (measure_date/install_date — ставит
// 2 линия после согласования). Видимость/редактирование каждого поля — по правам
// dates_view_*/dates_edit_* (см. authTypes.ts), отсутствие ключа = разрешено
// (обратная совместимость с прежним общим полем field_dates).
const DATE_ROWS: { key: "desired_measure_date" | "desired_install_date" | "measure_date" | "install_date";
  def: string; icon: string; color: string; group: "desired" | "actual";
  viewPerm: keyof import("@/context/AuthContext").Permissions;
  editPerm: keyof import("@/context/AuthContext").Permissions }[] = [
  { key: "desired_measure_date", def: "Желаемый замер",  icon: "Ruler",  color: "#38bdf8", group: "desired",
    viewPerm: "dates_view_desired_measure", editPerm: "dates_edit_desired_measure_date" },
  { key: "desired_install_date", def: "Желаемый монтаж", icon: "Wrench", color: "#a78bfa", group: "desired",
    viewPerm: "dates_view_desired_install", editPerm: "dates_edit_desired_install_date" },
  { key: "measure_date", def: "Фактическая дата замера",  icon: "Ruler",  color: "#f59e0b", group: "actual",
    viewPerm: "dates_view_measure", editPerm: "dates_edit_measure_date" },
  { key: "install_date", def: "Фактическая дата монтажа", icon: "Wrench", color: "#f97316", group: "actual",
    viewPerm: "dates_view_install", editPerm: "dates_edit_install_date" },
];

function saveDateField(saveWithLog: InfoBlocksProps["saveWithLog"], key: string, label: string, icon: string, color: string) {
  return (v: string) => saveWithLog({ [key]: v || null }, v ? `${label}: ${new Date(v).toLocaleDateString("ru-RU")}` : `${label} удалена`, icon, color);
}

export function DrawerDatesBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog }: InfoBlocksProps) {
  const { user } = useAuth();
  const id: BlockId = "dates";
  const { isHidden, editMode, getLabel, renameLabel, hideRow, isVisible, extraRows, addExtraRow, updateExtraRow, renameExtraRow, deleteExtraRow } = useInfoBlock(id, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock);

  // Отсутствие ключа в permissions = разрешено (как было раньше с общим field_dates),
  // поэтому проверяем явное false, а не через hasPermission (у которой отсутствие = false).
  const permAllows = (permKey: keyof import("@/context/AuthContext").Permissions) => {
    if (!user) return false;
    if (user.is_master || user.role === "company" || user.role === "installer") return true;
    if (!user.permissions) return true;
    return user.permissions[permKey] !== false;
  };

  const renderGroup = (group: "desired" | "actual", title: string) => {
    const rows = DATE_ROWS.filter(r => r.group === group && isVisible(r.key) && permAllows(r.viewPerm));
    if (rows.length === 0) return null;
    return (
      <div className="mb-2 last:mb-0">
        <div className="text-[9px] uppercase tracking-wider font-bold mb-0.5 opacity-50">{title}</div>
        {rows.map(r => {
          const canEdit = permAllows(r.editPerm);
          const val = data[r.key] ? String(data[r.key]).slice(0, 16) : "";
          return (
            <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={() => {}} editMode={editMode}
              editableLabel={getLabel(r.key, r.def)} onLabelChange={l => renameLabel(r.key, l)}
              onDelete={() => hideRow(r.key)}>
              <InlineField label={getLabel(r.key, r.def)} value={val}
                onSave={saveDateField(saveWithLog, r.key, getLabel(r.key, r.def), r.icon, r.color)}
                type="datetime-local" placeholder={canEdit ? "Добавить дату" : "Не указана"} readOnly={!canEdit} />
            </RowWithToggle>
          );
        })}
      </div>
    );
  };

  return (
    <Section icon="Calendar" title="Даты" color="#f97316" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      {renderGroup("desired", "Желаемые")}
      {renderGroup("actual", "Фактические")}
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
