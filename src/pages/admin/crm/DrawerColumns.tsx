import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { InlineField, Section, FileField } from "./drawerComponents";
import { ActivityEvent } from "./DrawerStatusActivity";
import { BlockId, BlockDef, CustomBlockData, EditRow } from "./drawerTypes";
import { BlockEditor, DraggableBlock } from "./DrawerBlockEditor";
import { DrawerTagsBlock } from "./DrawerTagsBlock";
import { DrawerCustomBlock } from "./DrawerCustomBlock";

interface ColumnsProps {
  data: Client;
  client: Client;
  setData: (c: Client) => void;
  save: (patch: Partial<Client>) => void;
  blocks: BlockDef[];
  hiddenBlocks: Set<BlockId>;
  editingBlock: BlockId | null;
  customBlocks: CustomBlockData[];
  customRowVals: Record<string, Record<number, string>>;
  activityLog: ActivityEvent[];
  profit: number;
  received: number;
  remaining: number;
  toggleHidden: (id: BlockId) => void;
  setEditingBlock: (id: BlockId | null) => void;
  saveWithLog: (patch: Partial<Client>, logText: string, icon?: string, color?: string) => void;
  logAction: (icon: string, color: string, text: string) => void;
  setCustomRowVals: React.Dispatch<React.SetStateAction<Record<string, Record<number, string>>>>;
  deleteCustomBlock: (id: string) => void;
  onDragStart: (id: BlockId) => void;
  onDragOver: (e: React.DragEvent, id: BlockId) => void;
  onDrop: (targetId: BlockId) => void;
  onDropToCol: (col: 0 | 1) => void;
  onAddBlockLeft: () => void;
  onAddBlockRight: () => void;
  onReset: () => void;
}

export function DrawerColumns(props: ColumnsProps) {
  const {
    data, setData, client, save, blocks, hiddenBlocks, editingBlock, customBlocks,
    customRowVals, toggleHidden, setEditingBlock, saveWithLog, logAction, setCustomRowVals,
    deleteCustomBlock, onDragStart, onDragOver, onDrop, onDropToCol, onAddBlockLeft, onAddBlockRight,
  } = props;
  const t = useTheme();

  // ── getEditRows ──────────────────────────────────────────────────────────────
  const getEditRows = (id: BlockId): EditRow[] => {
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
  };

  // ── saveEditRows ─────────────────────────────────────────────────────────────
  const saveEditRows = (id: BlockId, rows: EditRow[]) => {
    const patch: Partial<Client> = {};
    const numFields = ["contract_sum","prepayment","extra_payment","extra_agreement_sum","material_cost","measure_cost","install_cost","area"];
    rows.forEach(r => {
      if (r.key && !r.key.startsWith("custom")) {
        (patch as Record<string, unknown>)[r.key] = numFields.includes(r.key) ? (+r.value || null) : (r.value || null);
      }
    });
    save(patch);
    logAction("Edit3", "#8b5cf6", `Блок отредактирован`);
    setEditingBlock(null);
  };

  // ── wrap ─────────────────────────────────────────────────────────────────────
  // Блоки с фиксированными полями — нельзя добавлять новые строки через BlockEditor
  const FIXED_BLOCKS = new Set(["income", "costs", "contacts", "object", "dates"]);

  const wrap = (id: BlockId, content: React.ReactNode, icon: string, title: string, color: string, hasEdit: boolean) => {
    const isHidden   = hiddenBlocks.has(id);
    const showEditor = editingBlock === id;
    const editRows   = getEditRows(id);
    return (
      <Section icon={icon} title={title} color={color}
        hidden={isHidden}
        onToggleHidden={() => toggleHidden(id)}
        onEdit={hasEdit && !isHidden ? () => setEditingBlock(showEditor ? null : id) : undefined}>
        {content}
        {showEditor && editRows.length > 0 && (
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

  // ── renderBlock ──────────────────────────────────────────────────────────────
  const renderBlock = (id: BlockId): React.ReactNode => {
    const isHidden = hiddenBlocks.has(id);
    switch (id) {
      case "status": return null;

      case "tags":
        return (
          <DrawerTagsBlock
            id={id}
            tags={data.tags}
            editingBlock={editingBlock}
            hiddenBlocks={hiddenBlocks}
            toggleHidden={toggleHidden}
            setEditingBlock={setEditingBlock}
            save={save}
            logAction={logAction}
          />
        );

      case "contacts":
        return wrap(id, <>
          <InlineField label="Имя клиента"  value={data.client_name}       onSave={v => saveWithLog({ client_name: v }, `Имя: ${v}`, "User", "#10b981")}       placeholder="Добавить имя" />
          <InlineField label="Телефон"       value={data.phone}             onSave={v => saveWithLog({ phone: v }, `Телефон: ${v}`, "Phone", "#10b981")}       placeholder="Добавить телефон" />
          <InlineField label="Ответственный" value={data.responsible_phone} onSave={v => saveWithLog({ responsible_phone: v }, `Ответственный: ${v}`, "User", "#10b981")} placeholder="Прораб / дизайнер" />
        </>, "Phone", "Контакты", "#10b981", true);

      case "object":
        return wrap(id, <>
          <InlineField label="Адрес"           value={data.address}  onSave={v => saveWithLog({ address: v }, `Адрес: ${v}`, "MapPin", "#f59e0b")} placeholder="Добавить адрес" />
          <InlineField label="Ссылка на карту" value={data.map_link} onSave={v => saveWithLog({ map_link: v }, "Карта обновлена", "Link", "#f59e0b")} placeholder="Добавить ссылку" />
          <InlineField label="Площадь (м²)"   value={data.area}     onSave={v => saveWithLog({ area: +v || null } as Partial<Client>, `Площадь: ${v} м²`, "Maximize2", "#f59e0b")} type="number" placeholder="—" />
        </>, "MapPin", "Объект", "#f59e0b", true);

      case "dates":
        return wrap(id, <>
          <InlineField label="Дата замера"  value={data.measure_date ? data.measure_date.slice(0, 16) : ""} onSave={v => saveWithLog({ measure_date: v || null }, v ? `Замер: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата замера удалена", "Ruler", "#f97316")} type="datetime-local" placeholder="Добавить дату" />
          <InlineField label="Дата монтажа" value={data.install_date ? data.install_date.slice(0, 16) : ""} onSave={v => saveWithLog({ install_date: v || null }, v ? `Монтаж: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата монтажа удалена", "Wrench", "#f97316")} type="datetime-local" placeholder="Добавить дату" />
        </>, "Calendar", "Даты", "#f97316", true);

      case "notes":
        return wrap(id, <textarea
          value={(() => {
            const notes = data.notes || "";
            return notes.split("\n").filter(l => !l.includes("Смета сохранена") && !l.includes("Email:") && !l.includes("Estimate ID:")).join("\n").trim();
          })()}
          onChange={e => setData({ ...data, notes: e.target.value })}
          onBlur={e => { if (e.target.value !== (client.notes || "")) { save({ notes: e.target.value }); logAction("StickyNote", "#8b5cf6", "Заметки обновлены"); } }}
          placeholder="Добавить заметку..." rows={3}
          className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none transition mt-2 mb-1"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }}
        />, "StickyNote", "Заметки", "#8b5cf6", false);

      case "pl":
        return null; // P&L вынесен на уровень выше — под Статус воронки

      case "income":
        return wrap(id, <>
          <InlineField label="Сумма договора" value={data.contract_sum}        onSave={v => saveWithLog({ contract_sum: +v || null } as Partial<Client>, `Договор: ${(+v).toLocaleString("ru-RU")} ₽`, "FileText", "#10b981")} type="number" placeholder="—" />
          <InlineField label="Предоплата"      value={data.prepayment}          onSave={v => saveWithLog({ prepayment: +v || null } as Partial<Client>, `Предоплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet", "#10b981")} type="number" placeholder="—" />
          <InlineField label="Доплата"         value={data.extra_payment}       onSave={v => saveWithLog({ extra_payment: +v || null } as Partial<Client>, `Доплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet", "#10b981")} type="number" placeholder="—" />
          <InlineField label="Доп. соглашение" value={data.extra_agreement_sum} onSave={v => saveWithLog({ extra_agreement_sum: +v || null } as Partial<Client>, `Доп. согл: ${(+v).toLocaleString("ru-RU")} ₽`, "FileText", "#06b6d4")} type="number" placeholder="—" />
        </>, "Banknote", "Доходы", "#10b981", true);

      case "costs":
        return wrap(id, <>
          <InlineField label="Материалы" value={data.material_cost} onSave={v => saveWithLog({ material_cost: +v || null } as Partial<Client>, `Материалы: ${(+v).toLocaleString("ru-RU")} ₽`, "Package", "#ef4444")} type="number" placeholder="—" />
          <InlineField label="Замер"      value={data.measure_cost}  onSave={v => saveWithLog({ measure_cost: +v || null } as Partial<Client>, `Замер стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Ruler", "#ef4444")} type="number" placeholder="—" />
          <InlineField label="Монтаж"     value={data.install_cost}  onSave={v => saveWithLog({ install_cost: +v || null } as Partial<Client>, `Монтаж стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Wrench", "#ef4444")} type="number" placeholder="—" />
        </>, "Receipt", "Затраты", "#ef4444", true);

      case "files":
        return wrap(id, <>
          <FileField label="Фото до"         url={data.photo_before_url} accept="image/*"                    onUploaded={(url, name) => { save({ photo_before_url: url }); logAction("Image", "#06b6d4", `Фото до: ${name}`); }} />
          <FileField label="Фото после"      url={data.photo_after_url}  accept="image/*"                    onUploaded={(url, name) => { save({ photo_after_url: url }); logAction("Image", "#06b6d4", `Фото после: ${name}`); }} />
          <FileField label="Договор / Смета" url={data.document_url}     accept=".pdf,.doc,.docx,.xls,.xlsx" onUploaded={(url, name) => { save({ document_url: url }); logAction("FileText", "#06b6d4", `Документ: ${name}`); }} />
        </>, "Paperclip", "Файлы", "#06b6d4", false);

      case "cancel":
        return data.status !== "cancelled" ? null : wrap(id,
          <InlineField label="Причина" value={data.cancel_reason} onSave={v => saveWithLog({ cancel_reason: v }, `Причина отказа: ${v}`, "XCircle", "#ef4444")} placeholder="Укажите причину" />,
          "XCircle", "Причина отказа", "#ef4444", true);

      default: return null;
    }
  };

  // ── layout ───────────────────────────────────────────────────────────────────
  const col0 = blocks.filter(b => b.col === 0).sort((a, b) => a.order - b.order);
  const col1 = blocks.filter(b => b.col === 1).sort((a, b) => a.order - b.order);

  const renderColBlock = (b: BlockDef) => {
    if (b.id.startsWith("custom_")) {
      const cb = customBlocks.find(c => c.id === b.id);
      return cb ? (
        <DrawerCustomBlock
          cb={cb}
          data_id={data.id}
          hiddenBlocks={hiddenBlocks}
          customRowVals={customRowVals}
          toggleHidden={toggleHidden}
          deleteCustomBlock={deleteCustomBlock}
          setCustomRowVals={setCustomRowVals}
          logAction={logAction}
        />
      ) : null;
    }
    return renderBlock(b.id);
  };

  const [dropOverCol, setDropOverCol] = useState<0 | 1 | null>(null);

  const makeColDropZone = (col: 0 | 1) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDropOverCol(col); },
    onDragLeave: () => setDropOverCol(null),
    onDrop: () => { setDropOverCol(null); onDropToCol(col); },
  });

  // Разделяем wide-блоки (на всю ширину) от обычных
  const col0Narrow = col0.filter(b => b.id !== "status" && !b.wide);
  const col1Narrow = col1.filter(b => !b.wide);
  const wideBlocks = [...col0, ...col1].filter(b => b.wide && b.id !== "status")
    .sort((a, b) => (a.col * 100 + a.order) - (b.col * 100 + b.order));

  return (
    <div className="flex flex-col gap-3">
      {/* Двухколоночная сетка для обычных блоков */}
      <div className="grid grid-cols-[1fr_1fr] gap-3 items-start">
        {/* Левый столбец */}
        <div className="flex flex-col gap-3">
          {col0Narrow.map(b => (
            <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
              {renderColBlock(b)}
            </DraggableBlock>
          ))}
          {dropOverCol === 0 && (
            <div className="rounded-xl flex items-center justify-center py-3 transition-all"
              style={{ border: `2px dashed #7c3aed80`, background: "#7c3aed08" }}
              {...makeColDropZone(0)}>
              <span className="text-xs text-violet-400">Перетащи сюда</span>
            </div>
          )}
          {dropOverCol !== 0 && <div style={{ height: 0 }} {...makeColDropZone(0)} />}
          <button onClick={onAddBlockLeft}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition border-2 border-dashed hover:border-violet-500/40 hover:text-violet-400"
            style={{ borderColor: t.border, color: "#a3a3a3" }}>
            <Icon name="Plus" size={13} /> Добавить блок
          </button>
        </div>

        {/* Правый столбец */}
        <div className="flex flex-col gap-3">
          {col1Narrow.map(b => (
            <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
              {renderColBlock(b)}
            </DraggableBlock>
          ))}
          {dropOverCol === 1 && (
            <div className="rounded-xl flex items-center justify-center py-3 transition-all"
              style={{ border: `2px dashed #7c3aed80`, background: "#7c3aed08" }}
              {...makeColDropZone(1)}>
              <span className="text-xs text-violet-400">Перетащи сюда</span>
            </div>
          )}
          {dropOverCol !== 1 && <div style={{ height: 0 }} {...makeColDropZone(1)} />}
          <button onClick={onAddBlockRight}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition border-2 border-dashed hover:border-violet-500/40 hover:text-violet-400"
            style={{ borderColor: t.border, color: "#a3a3a3" }}>
            <Icon name="Plus" size={13} /> Добавить блок
          </button>
        </div>
      </div>

      {/* Wide-блоки — на всю ширину */}
      {wideBlocks.map(b => (
        <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
          {renderColBlock(b)}
        </DraggableBlock>
      ))}
    </div>
  );
}