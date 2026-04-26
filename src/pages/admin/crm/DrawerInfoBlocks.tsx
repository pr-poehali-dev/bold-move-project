import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { InlineField, Section, FileField } from "./drawerComponents";
import { BlockId, EditRow } from "./drawerTypes";
import { BlockEditor } from "./DrawerBlockEditor";

const FIXED_BLOCKS = new Set(["income", "costs", "contacts", "object", "dates"]);
const FIN_BLOCKS = new Set<BlockId>(["income", "costs"]);
const NUM_FIELDS = ["contract_sum","prepayment","extra_payment","extra_agreement_sum","material_cost","measure_cost","install_cost","area"];

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

function getEditRows(id: BlockId, data: Client): EditRow[] {
  switch (id) {
    case "contacts": return [
      { label: "Имя",           value: data.client_name      || "", key: "client_name" },
      { label: "Телефон",       value: data.phone             || "", key: "phone" },
      { label: "Ответственный", value: data.responsible_phone || "", key: "responsible_phone" },
    ];
    case "object": return [
      { label: "Адрес",        value: data.address  || "", key: "address" },
      { label: "Карта",        value: data.map_link || "", key: "map_link" },
      { label: "Площадь (м²)", value: data.area ? String(data.area) : "", key: "area" },
    ];
    case "dates": return [
      { label: "Замер",  value: data.measure_date ? data.measure_date.slice(0, 16) : "", key: "measure_date" },
      { label: "Монтаж", value: data.install_date ? data.install_date.slice(0, 16) : "", key: "install_date" },
    ];
    case "income": return [
      { label: "Договор",    value: data.contract_sum        ? String(data.contract_sum)        : "", key: "contract_sum" },
      { label: "Предоплата", value: data.prepayment          ? String(data.prepayment)          : "", key: "prepayment" },
      { label: "Доплата",    value: data.extra_payment       ? String(data.extra_payment)       : "", key: "extra_payment" },
      { label: "Доп. согл.", value: data.extra_agreement_sum ? String(data.extra_agreement_sum) : "", key: "extra_agreement_sum" },
    ];
    case "costs": return [
      { label: "Материалы", value: data.material_cost ? String(data.material_cost) : "", key: "material_cost" },
      { label: "Замер",     value: data.measure_cost  ? String(data.measure_cost)  : "", key: "measure_cost" },
      { label: "Монтаж",    value: data.install_cost  ? String(data.install_cost)  : "", key: "install_cost" },
    ];
    default: return [];
  }
}

export function useInfoBlockWrap(props: InfoBlocksProps) {
  const { hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, save, logAction } = props;

  const saveEditRows = (id: BlockId, rows: EditRow[]) => {
    const patch: Partial<Client> = {};
    rows.forEach(r => {
      if (r.key && !r.key.startsWith("custom")) {
        (patch as Record<string, unknown>)[r.key] = NUM_FIELDS.includes(r.key) ? (+r.value || null) : (r.value || null);
      }
    });
    save(patch);
    logAction("Edit3", "#8b5cf6", `Блок отредактирован`);
    setEditingBlock(null);
  };

  const wrap = (id: BlockId, content: React.ReactNode, icon: string, title: string, color: string, hasEdit: boolean, data: Client) => {
    const isHidden   = hiddenBlocks.has(id);
    const showEditor = editingBlock === id;
    const editRows   = getEditRows(id, data);
    const isFinBlock = FIN_BLOCKS.has(id);
    return (
      <Section icon={icon} title={title} color={color}
        hidden={isHidden}
        onToggleHidden={() => toggleHidden(id)}
        onEdit={hasEdit && !isHidden ? () => setEditingBlock(showEditor ? null : id) : undefined}>
        {content}
        {showEditor && editRows.length > 0 && !isFinBlock && (
          <BlockEditor
            rows={editRows}
            allowAdd={!FIXED_BLOCKS.has(id)}
            onSave={rows => saveEditRows(id, rows)}
            onClose={() => setEditingBlock(null)}
          />
        )}
      </Section>
    );
  };

  return { wrap };
}

export function DrawerContactsBlock(props: InfoBlocksProps) {
  const { data, saveWithLog } = props;
  const { wrap } = useInfoBlockWrap(props);
  return wrap("contacts", <>
    <InlineField label="Имя клиента"  value={data.client_name}       onSave={v => saveWithLog({ client_name: v }, `Имя: ${v}`, "User", "#10b981")}       placeholder="Добавить имя" />
    <InlineField label="Телефон"       value={data.phone}             onSave={v => saveWithLog({ phone: v }, `Телефон: ${v}`, "Phone", "#10b981")}       placeholder="Добавить телефон" />
    <InlineField label="Ответственный" value={data.responsible_phone} onSave={v => saveWithLog({ responsible_phone: v }, `Ответственный: ${v}`, "User", "#10b981")} placeholder="Прораб / дизайнер" />
  </>, "Phone", "Контакты", "#10b981", true, data);
}

export function DrawerObjectBlock(props: InfoBlocksProps) {
  const { data, saveWithLog } = props;
  const { wrap } = useInfoBlockWrap(props);
  return wrap("object", <>
    <InlineField label="Адрес"           value={data.address}  onSave={v => saveWithLog({ address: v }, `Адрес: ${v}`, "MapPin", "#f59e0b")} placeholder="Добавить адрес" />
    <InlineField label="Ссылка на карту" value={data.map_link} onSave={v => saveWithLog({ map_link: v }, "Карта обновлена", "Link", "#f59e0b")} placeholder="Добавить ссылку" />
    <InlineField label="Площадь (м²)"   value={data.area}     onSave={v => saveWithLog({ area: +v || null } as Partial<Client>, `Площадь: ${v} м²`, "Maximize2", "#f59e0b")} type="number" placeholder="—" />
  </>, "MapPin", "Объект", "#f59e0b", true, data);
}

export function DrawerDatesBlock(props: InfoBlocksProps) {
  const { data, saveWithLog } = props;
  const { wrap } = useInfoBlockWrap(props);
  return wrap("dates", <>
    <InlineField label="Дата замера"  value={data.measure_date ? data.measure_date.slice(0, 16) : ""} onSave={v => saveWithLog({ measure_date: v || null }, v ? `Замер: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата замера удалена", "Ruler", "#f97316")} type="datetime-local" placeholder="Добавить дату" />
    <InlineField label="Дата монтажа" value={data.install_date ? data.install_date.slice(0, 16) : ""} onSave={v => saveWithLog({ install_date: v || null }, v ? `Монтаж: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата монтажа удалена", "Wrench", "#f97316")} type="datetime-local" placeholder="Добавить дату" />
  </>, "Calendar", "Даты", "#f97316", true, data);
}

export function DrawerNotesBlock(props: InfoBlocksProps) {
  const { data, client, setData, save, logAction } = props;
  const { wrap } = useInfoBlockWrap(props);
  const t = useTheme();
  return wrap("notes", <textarea
    value={(() => {
      const notes = data.notes || "";
      return notes.split("\n").filter(l => !l.includes("Смета сохранена") && !l.includes("Email:") && !l.includes("Estimate ID:")).join("\n").trim();
    })()}
    onChange={e => setData({ ...data, notes: e.target.value })}
    onBlur={e => { if (e.target.value !== (client.notes || "")) { save({ notes: e.target.value }); logAction("StickyNote", "#8b5cf6", "Заметки обновлены"); } }}
    placeholder="Добавить заметку..." rows={3}
    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none transition mt-2 mb-1"
    style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }}
  />, "StickyNote", "Заметки", "#8b5cf6", false, data);
}

export function DrawerFilesBlock(props: InfoBlocksProps) {
  const { data, save, logAction } = props;
  const { wrap } = useInfoBlockWrap(props);
  return wrap("files", <>
    <FileField label="Фото до"         url={data.photo_before_url} accept="image/*"                    onUploaded={(url, name) => { save({ photo_before_url: url }); logAction("Image", "#06b6d4", `Фото до: ${name}`); }} />
    <FileField label="Фото после"      url={data.photo_after_url}  accept="image/*"                    onUploaded={(url, name) => { save({ photo_after_url: url }); logAction("Image", "#06b6d4", `Фото после: ${name}`); }} />
    <FileField label="Договор / Смета" url={data.document_url}     accept=".pdf,.doc,.docx,.xls,.xlsx" onUploaded={(url, name) => { save({ document_url: url }); logAction("FileText", "#06b6d4", `Документ: ${name}`); }} />
  </>, "Paperclip", "Файлы", "#06b6d4", false, data);
}

export function DrawerCancelBlock(props: InfoBlocksProps) {
  const { data, saveWithLog } = props;
  const { wrap } = useInfoBlockWrap(props);
  if (data.status !== "cancelled") return null;
  return wrap("cancel",
    <InlineField label="Причина" value={data.cancel_reason} onSave={v => saveWithLog({ cancel_reason: v }, `Причина отказа: ${v}`, "XCircle", "#ef4444")} placeholder="Укажите причину" />,
    "XCircle", "Причина отказа", "#ef4444", true, data);
}
