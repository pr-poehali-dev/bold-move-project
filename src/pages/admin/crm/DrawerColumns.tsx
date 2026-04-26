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

function RowWithToggle({ rowKey, visible, onToggle, children }: {
  rowKey: string;
  visible: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <div className="flex items-center gap-1 group/rowtoggle">
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={() => onToggle(rowKey)}
        title="Скрыть строку на всех карточках"
        className="opacity-0 group-hover/rowtoggle:opacity-100 flex-shrink-0 rounded-full transition-all duration-200"
        style={{
          width: 28, height: 16,
          background: "#8b5cf6",
          position: "relative", display: "inline-flex", alignItems: "center",
        }}>
        <span style={{
          width: 12, height: 12,
          background: "#fff",
          borderRadius: "50%",
          position: "absolute",
          left: 14,
          transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}

function HiddenRowToggle({ rowKey, label, onToggle }: {
  rowKey: string;
  label: string;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 opacity-40 hover:opacity-70 transition-opacity"
      style={{ borderBottom: "1px solid #2a2a2a" }}>
      <span className="text-xs w-36" style={{ color: "#a3a3a3" }}>{label}</span>
      <button
        onClick={() => onToggle(rowKey)}
        title="Показывать на всех карточках"
        className="flex-shrink-0 rounded-full transition-all duration-200"
        style={{
          width: 28, height: 16,
          background: "#404040",
          position: "relative", display: "inline-flex", alignItems: "center",
        }}>
        <span style={{
          width: 12, height: 12,
          background: "#fff",
          borderRadius: "50%",
          position: "absolute",
          left: 2,
          transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}

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
  onAddBlock: (col: 0 | 1 | "wide") => void;
  onReset: () => void;
  rowVisibility: Record<string, boolean>;
  toggleRowVisibility: (key: string) => void;
}

export function DrawerColumns(props: ColumnsProps) {
  const {
    data, setData, client, save, blocks, hiddenBlocks, editingBlock, customBlocks,
    customRowVals, toggleHidden, setEditingBlock, saveWithLog, logAction, setCustomRowVals,
    deleteCustomBlock, onDragStart, onDragOver, onDrop, onDropToCol, onAddBlock,
    rowVisibility, toggleRowVisibility,
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
          <RowWithToggle rowKey="contract_sum" visible={rowVisibility["contract_sum"] !== false} onToggle={toggleRowVisibility}>
            <InlineField label="Сумма договора" value={data.contract_sum} onSave={v => saveWithLog({ contract_sum: +v || null } as Partial<Client>, `Договор: ${(+v).toLocaleString("ru-RU")} ₽`, "FileText", "#10b981")} type="number" placeholder="—" />
          </RowWithToggle>
          {rowVisibility["contract_sum"] === false && <HiddenRowToggle rowKey="contract_sum" label="Сумма договора" onToggle={toggleRowVisibility} />}
          <RowWithToggle rowKey="prepayment" visible={rowVisibility["prepayment"] !== false} onToggle={toggleRowVisibility}>
            <InlineField label="Предоплата" value={data.prepayment} onSave={v => saveWithLog({ prepayment: +v || null } as Partial<Client>, `Предоплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet", "#10b981")} type="number" placeholder="—" />
          </RowWithToggle>
          {rowVisibility["prepayment"] === false && <HiddenRowToggle rowKey="prepayment" label="Предоплата" onToggle={toggleRowVisibility} />}
          <RowWithToggle rowKey="extra_payment" visible={rowVisibility["extra_payment"] !== false} onToggle={toggleRowVisibility}>
            <InlineField label="Доплата" value={data.extra_payment} onSave={v => saveWithLog({ extra_payment: +v || null } as Partial<Client>, `Доплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet", "#10b981")} type="number" placeholder="—" />
          </RowWithToggle>
          {rowVisibility["extra_payment"] === false && <HiddenRowToggle rowKey="extra_payment" label="Доплата" onToggle={toggleRowVisibility} />}
          <RowWithToggle rowKey="extra_agreement_sum" visible={rowVisibility["extra_agreement_sum"] !== false} onToggle={toggleRowVisibility}>
            <InlineField label="Доп. соглашение" value={data.extra_agreement_sum} onSave={v => saveWithLog({ extra_agreement_sum: +v || null } as Partial<Client>, `Доп. согл: ${(+v).toLocaleString("ru-RU")} ₽`, "FileText", "#06b6d4")} type="number" placeholder="—" />
          </RowWithToggle>
          {rowVisibility["extra_agreement_sum"] === false && <HiddenRowToggle rowKey="extra_agreement_sum" label="Доп. соглашение" onToggle={toggleRowVisibility} />}
        </>, "Banknote", "Доходы", "#10b981", true);

      case "costs":
        return wrap(id, <>
          <RowWithToggle rowKey="material_cost" visible={rowVisibility["material_cost"] !== false} onToggle={toggleRowVisibility}>
            <InlineField label="Материалы" value={data.material_cost} onSave={v => saveWithLog({ material_cost: +v || null } as Partial<Client>, `Материалы: ${(+v).toLocaleString("ru-RU")} ₽`, "Package", "#ef4444")} type="number" placeholder="—" />
          </RowWithToggle>
          {rowVisibility["material_cost"] === false && <HiddenRowToggle rowKey="material_cost" label="Материалы" onToggle={toggleRowVisibility} />}
          <RowWithToggle rowKey="measure_cost" visible={rowVisibility["measure_cost"] !== false} onToggle={toggleRowVisibility}>
            <InlineField label="Замер" value={data.measure_cost} onSave={v => saveWithLog({ measure_cost: +v || null } as Partial<Client>, `Замер стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Ruler", "#ef4444")} type="number" placeholder="—" />
          </RowWithToggle>
          {rowVisibility["measure_cost"] === false && <HiddenRowToggle rowKey="measure_cost" label="Замер" onToggle={toggleRowVisibility} />}
          <RowWithToggle rowKey="install_cost" visible={rowVisibility["install_cost"] !== false} onToggle={toggleRowVisibility}>
            <InlineField label="Монтаж" value={data.install_cost} onSave={v => saveWithLog({ install_cost: +v || null } as Partial<Client>, `Монтаж стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Wrench", "#ef4444")} type="number" placeholder="—" />
          </RowWithToggle>
          {rowVisibility["install_cost"] === false && <HiddenRowToggle rowKey="install_cost" label="Монтаж" onToggle={toggleRowVisibility} />}
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

      {/* Двухколоночная сетка — выровненные блоки */}
      <div className="grid grid-cols-[1fr_1fr] gap-3 items-start">
        {/* Левый столбец */}
        <div className="flex flex-col gap-3">
          {col0Narrow.map(b => (
            <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
              {renderColBlock(b)}
            </DraggableBlock>
          ))}
          {dropOverCol === 0 && (
            <div className="rounded-xl flex items-center justify-center py-3"
              style={{ border: `2px dashed #7c3aed80`, background: "#7c3aed08" }}
              {...makeColDropZone(0)}>
              <span className="text-xs text-violet-400">Перетащи сюда</span>
            </div>
          )}
          {dropOverCol !== 0 && <div style={{ height: 0 }} {...makeColDropZone(0)} />}
        </div>

        {/* Правый столбец */}
        <div className="flex flex-col gap-3">
          {col1Narrow.map(b => (
            <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
              {renderColBlock(b)}
            </DraggableBlock>
          ))}
          {dropOverCol === 1 && (
            <div className="rounded-xl flex items-center justify-center py-3"
              style={{ border: `2px dashed #7c3aed80`, background: "#7c3aed08" }}
              {...makeColDropZone(1)}>
              <span className="text-xs text-violet-400">Перетащи сюда</span>
            </div>
          )}
          {dropOverCol !== 1 && <div style={{ height: 0 }} {...makeColDropZone(1)} />}
        </div>
      </div>

      {/* Wide-блоки — на всю ширину, над кнопками добавления */}
      {wideBlocks.map(b => (
        <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
          {renderColBlock(b)}
        </DraggableBlock>
      ))}

      {/* Кнопки добавления в колонки */}
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <button onClick={() => onAddBlock(0)}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition border-2 border-dashed hover:border-violet-500/40 hover:text-violet-400"
          style={{ borderColor: t.border, color: "#a3a3a3" }}>
          <Icon name="Plus" size={12} /> Блок в левую
        </button>
        <button onClick={() => onAddBlock(1)}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition border-2 border-dashed hover:border-violet-500/40 hover:text-violet-400"
          style={{ borderColor: t.border, color: "#a3a3a3" }}>
          <Icon name="Plus" size={12} /> Блок в правую
        </button>
      </div>

      {/* Кнопка добавить широкий блок — самая последняя */}
      <button onClick={() => onAddBlock("wide")}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition border-2 border-dashed hover:border-violet-500/40 hover:text-violet-400"
        style={{ borderColor: t.border, color: "#a3a3a3" }}>
        <Icon name="Plus" size={13} />
        <Icon name="LayoutTemplate" size={13} />
        Добавить широкий блок
      </button>
    </div>
  );
}