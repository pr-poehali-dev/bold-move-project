import { useState, useRef } from "react";
import { Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { InlineField, Section, FileField, TagsField } from "./drawerComponents";
import { StatusSelector, ActivityFeed } from "./DrawerStatusActivity";

interface Props {
  data: Client;
  client: Client;
  setData: (c: Client) => void;
  save: (patch: Partial<Client>) => void;
  setComments: React.Dispatch<React.SetStateAction<{ text: string; date: string }[]>>;
}

// ── Типы блоков ───────────────────────────────────────────────────────────────
type BlockId =
  | "status" | "tags" | "contacts" | "object" | "dates" | "notes"
  | "pl" | "income" | "costs" | "files" | "cancel";

interface BlockDef { id: BlockId; col: 0 | 1; order: number; }

const DEFAULT_BLOCKS: BlockDef[] = [
  { id: "status",   col: 0, order: 0 },
  { id: "tags",     col: 0, order: 1 },
  { id: "contacts", col: 0, order: 2 },
  { id: "object",   col: 0, order: 3 },
  { id: "dates",    col: 0, order: 4 },
  { id: "notes",    col: 0, order: 5 },
  { id: "pl",       col: 1, order: 0 },
  { id: "income",   col: 1, order: 1 },
  { id: "costs",    col: 1, order: 2 },
  { id: "files",    col: 1, order: 3 },
  { id: "cancel",   col: 1, order: 4 },
];

const LS_BLOCKS = "drawer_blocks_order";

function loadBlocks(): BlockDef[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_BLOCKS) || "null");
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch { /* ignore */ }
  return DEFAULT_BLOCKS;
}

// ── EditableRows — секция с добавляемыми/удаляемыми строками ─────────────────
function EditableRows({ rows, onUpdate, type = "text" }: {
  rows: { label: string; value: string }[];
  onUpdate: (rows: { label: string; value: string }[]) => void;
  type?: string;
}) {
  const t = useTheme();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  return (
    <div>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center justify-between py-2 group"
          style={{ borderBottom: `1px solid ${t.border2}` }}>
          <span className="text-xs flex-shrink-0 w-36" style={{ color: t.textMute }}>{row.label}</span>
          <div className="flex items-center gap-1 flex-1 justify-end">
            <span className="text-sm text-white">{row.value || <span className="text-violet-400/50 text-xs">—</span>}</span>
            <button onClick={() => onUpdate(rows.filter((_, j) => j !== i))}
              className="opacity-0 group-hover:opacity-100 transition ml-1 text-red-400 hover:text-red-300">
              <Icon name="X" size={11} />
            </button>
          </div>
        </div>
      ))}
      {adding ? (
        <div className="flex gap-1.5 pt-2 pb-1">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="Название"
            className="w-28 rounded-lg px-2 py-1 text-xs focus:outline-none"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
          <input value={newValue} onChange={e => setNewValue(e.target.value)}
            placeholder="Значение"
            type={type}
            className="flex-1 rounded-lg px-2 py-1 text-xs focus:outline-none"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }}
            onKeyDown={e => {
              if (e.key === "Enter" && newLabel.trim()) {
                onUpdate([...rows, { label: newLabel.trim(), value: newValue }]);
                setNewLabel(""); setNewValue(""); setAdding(false);
              }
              if (e.key === "Escape") { setAdding(false); setNewLabel(""); setNewValue(""); }
            }} />
          <button onClick={() => {
            if (newLabel.trim()) {
              onUpdate([...rows, { label: newLabel.trim(), value: newValue }]);
              setNewLabel(""); setNewValue(""); setAdding(false);
            }
          }} className="px-2 py-1 rounded-lg text-xs text-violet-300 bg-violet-600/20 transition hover:bg-violet-600/30">+</button>
          <button onClick={() => { setAdding(false); setNewLabel(""); setNewValue(""); }}
            className="px-2 py-1 text-xs rounded-lg transition" style={{ color: t.textMute }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-[11px] py-1.5 transition hover:opacity-70"
          style={{ color: t.textMute }}>
          <Icon name="Plus" size={11} /> Добавить строку
        </button>
      )}
    </div>
  );
}

// ── DraggableBlock ─────────────────────────────────────────────────────────────
function DraggableBlock({ blockId, onDragStart, onDragOver, onDrop, children }: {
  blockId: BlockId;
  onDragStart: (id: BlockId) => void;
  onDragOver: (e: React.DragEvent, id: BlockId) => void;
  onDrop: (targetId: BlockId) => void;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(blockId)}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); onDragOver(e, blockId); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => { setIsDragOver(false); onDrop(blockId); }}
      style={{
        outline: isDragOver ? `2px dashed #7c3aed60` : undefined,
        borderRadius: 16,
        transition: "outline 0.1s",
      }}>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DrawerInfoTab({ data, client, setData, save, setComments }: Props) {
  const t = useTheme();
  const [blocks, setBlocks] = useState<BlockDef[]>(loadBlocks);
  const dragId = useRef<BlockId | null>(null);

  const profit    = (data.contract_sum||0) - (data.material_cost||0) - (data.measure_cost||0) - (data.install_cost||0);
  const received  = (data.prepayment||0) + (data.extra_payment||0);
  const remaining = (data.contract_sum||0) - received;

  // Drag handlers
  const onDragStart = (id: BlockId) => { dragId.current = id; };
  const onDragOver  = (_e: React.DragEvent, _id: BlockId) => {};
  const onDrop = (targetId: BlockId) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    setBlocks(prev => {
      const fromBlock  = prev.find(b => b.id === from)!;
      const toBlock    = prev.find(b => b.id === targetId)!;
      const updated = prev.map(b => {
        if (b.id === from)   return { ...b, col: toBlock.col, order: toBlock.order - 0.5 };
        return b;
      });
      // Re-sort orders within each col
      const result: BlockDef[] = [];
      for (const col of [0, 1] as const) {
        const colBlocks = updated.filter(b => b.col === col).sort((a, b) => a.order - b.order);
        colBlocks.forEach((b, i) => result.push({ ...b, order: i }));
      }
      localStorage.setItem(LS_BLOCKS, JSON.stringify(result));
      return result;
    });
  };

  // Рендер одного блока
  const renderBlock = (id: BlockId) => {
    switch (id) {
      case "status":
        return (
          <Section key="status" icon="GitBranch" title="Статус воронки" color="#8b5cf6">
            <StatusSelector status={data.status} onSave={s => save({ status: s })} />
          </Section>
        );
      case "tags":
        return (
          <Section key="tags" icon="Tag" title="Метки" color="#06b6d4">
            <TagsField tags={data.tags} onSave={tags => save({ tags })} />
          </Section>
        );
      case "contacts":
        return (
          <Section key="contacts" icon="Phone" title="Контакты" color="#10b981">
            <InlineField label="Имя клиента"    value={data.client_name}       onSave={v => save({ client_name: v })}       placeholder="Добавить имя" />
            <InlineField label="Телефон"         value={data.phone}             onSave={v => save({ phone: v })}             placeholder="Добавить телефон" />
            <InlineField label="Ответственный"   value={data.responsible_phone} onSave={v => save({ responsible_phone: v })} placeholder="Прораб / дизайнер" />
          </Section>
        );
      case "object":
        return (
          <Section key="object" icon="MapPin" title="Объект" color="#f59e0b">
            <InlineField label="Адрес"           value={data.address}  onSave={v => save({ address: v })}  placeholder="Добавить адрес" />
            <InlineField label="Ссылка на карту" value={data.map_link} onSave={v => save({ map_link: v })} placeholder="Добавить ссылку" />
            <InlineField label="Площадь (м²)"    value={data.area}     onSave={v => save({ area: +v || null } as Partial<Client>)} type="number" placeholder="—" />
          </Section>
        );
      case "dates":
        return (
          <Section key="dates" icon="Calendar" title="Даты" color="#f97316">
            <InlineField label="Дата замера"  value={data.measure_date ? data.measure_date.slice(0, 16) : ""} onSave={v => save({ measure_date: v || null })} type="datetime-local" placeholder="Добавить дату" />
            <InlineField label="Дата монтажа" value={data.install_date ? data.install_date.slice(0, 16) : ""} onSave={v => save({ install_date: v || null })} type="datetime-local" placeholder="Добавить дату" />
          </Section>
        );
      case "notes":
        return (
          <Section key="notes" icon="StickyNote" title="Заметки" color="#8b5cf6">
            <textarea
              value={(() => {
                const notes = data.notes || "";
                const lines = notes.split("\n").filter(l =>
                  !l.includes("Смета сохранена") && !l.includes("Email:") && !l.includes("Estimate ID:")
                );
                return lines.join("\n").trim();
              })()}
              onChange={e => setData({ ...data, notes: e.target.value })}
              onBlur={e => { if (e.target.value !== (client.notes || "")) save({ notes: e.target.value }); }}
              placeholder="Добавить заметку..."
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none transition mt-2 mb-1"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }}
            />
          </Section>
        );
      case "pl":
        return (data.contract_sum || data.material_cost || data.install_cost) ? (
          <div key="pl" className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #7c3aed15, #10b98112)", border: `1px solid #7c3aed30` }}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="TrendingUp" size={14} style={{ color: "#10b981" }} />
              <span className="text-xs font-bold uppercase tracking-wider text-white">P&L по заказу</span>
            </div>
            <div className="space-y-2 text-sm">
              {data.contract_sum ? <div className="flex justify-between"><span style={{ color: t.textMute }}>Договор</span><span className="font-bold text-white">{data.contract_sum.toLocaleString("ru-RU")} ₽</span></div> : null}
              {received > 0 && <div className="flex justify-between"><span style={{ color: t.textMute }}>Получено</span><span className="font-semibold text-emerald-400">+{received.toLocaleString("ru-RU")} ₽</span></div>}
              {remaining > 0 && data.contract_sum ? <div className="flex justify-between"><span style={{ color: t.textMute }}>Остаток</span><span className="font-semibold text-amber-400">{remaining.toLocaleString("ru-RU")} ₽</span></div> : null}
              {(data.material_cost || data.measure_cost || data.install_cost) ? <div className="flex justify-between"><span style={{ color: t.textMute }}>Затраты</span><span className="font-semibold text-red-400">−{((data.material_cost||0)+(data.measure_cost||0)+(data.install_cost||0)).toLocaleString("ru-RU")} ₽</span></div> : null}
              <div className="flex justify-between pt-2 mt-1" style={{ borderTop: `1px solid ${t.border}` }}>
                <span className="font-bold text-white">Прибыль</span>
                <span className={`text-lg font-black ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{profit >= 0 ? "+" : ""}{profit.toLocaleString("ru-RU")} ₽</span>
              </div>
            </div>
          </div>
        ) : null;
      case "income":
        return (
          <Section key="income" icon="Banknote" title="Доходы" color="#10b981">
            <InlineField label="Сумма договора" value={data.contract_sum}        onSave={v => save({ contract_sum: +v || null } as Partial<Client>)}        type="number" placeholder="—" />
            <InlineField label="Предоплата"      value={data.prepayment}          onSave={v => save({ prepayment: +v || null } as Partial<Client>)}          type="number" placeholder="—" />
            <InlineField label="Доплата"         value={data.extra_payment}       onSave={v => save({ extra_payment: +v || null } as Partial<Client>)}       type="number" placeholder="—" />
            <InlineField label="Доп. соглашение" value={data.extra_agreement_sum} onSave={v => save({ extra_agreement_sum: +v || null } as Partial<Client>)} type="number" placeholder="—" />
          </Section>
        );
      case "costs":
        return (
          <Section key="costs" icon="Receipt" title="Затраты" color="#ef4444">
            <InlineField label="Материалы" value={data.material_cost} onSave={v => save({ material_cost: +v || null } as Partial<Client>)} type="number" placeholder="—" />
            <InlineField label="Замер"      value={data.measure_cost}  onSave={v => save({ measure_cost: +v || null } as Partial<Client>)}  type="number" placeholder="—" />
            <InlineField label="Монтаж"     value={data.install_cost}  onSave={v => save({ install_cost: +v || null } as Partial<Client>)}  type="number" placeholder="—" />
          </Section>
        );
      case "files":
        return (
          <Section key="files" icon="Paperclip" title="Файлы" color="#06b6d4">
            <FileField label="Фото до"         url={data.photo_before_url} accept="image/*"                    onUploaded={url => save({ photo_before_url: url })} />
            <FileField label="Фото после"      url={data.photo_after_url}  accept="image/*"                    onUploaded={url => save({ photo_after_url: url })} />
            <FileField label="Договор / Смета" url={data.document_url}     accept=".pdf,.doc,.docx,.xls,.xlsx" onUploaded={url => save({ document_url: url })} />
          </Section>
        );
      case "cancel":
        return data.status === "cancelled" ? (
          <Section key="cancel" icon="XCircle" title="Причина отказа" color="#ef4444">
            <InlineField label="Причина" value={data.cancel_reason} onSave={v => save({ cancel_reason: v })} placeholder="Укажите причину" />
          </Section>
        ) : null;
      default:
        return null;
    }
  };

  const col0 = blocks.filter(b => b.col === 0).sort((a, b) => a.order - b.order);
  const col1 = blocks.filter(b => b.col === 1).sort((a, b) => a.order - b.order);

  return (
    <div className="grid grid-cols-[1fr_1fr_320px] gap-4 px-6 py-4">

      {/* ── Левый столбец ── */}
      <div className="space-y-3">
        {col0.map(b => (
          <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
            <div className="relative group/drag">
              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/drag:opacity-40 cursor-grab transition"
                style={{ color: t.textMute }}>
                <Icon name="GripVertical" size={13} />
              </div>
              {renderBlock(b.id)}
            </div>
          </DraggableBlock>
        ))}
      </div>

      {/* ── Центральный столбец ── */}
      <div className="space-y-3">
        {col1.map(b => (
          <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
            <div className="relative group/drag">
              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/drag:opacity-40 cursor-grab transition"
                style={{ color: t.textMute }}>
                <Icon name="GripVertical" size={13} />
              </div>
              {renderBlock(b.id)}
            </div>
          </DraggableBlock>
        ))}

        {/* Кнопка сброса порядка */}
        <button
          onClick={() => { setBlocks(DEFAULT_BLOCKS); localStorage.removeItem(LS_BLOCKS); }}
          className="text-[10px] opacity-30 hover:opacity-60 transition flex items-center gap-1 px-1"
          style={{ color: t.textMute }}>
          <Icon name="RotateCcw" size={10} /> сбросить порядок
        </button>
      </div>

      {/* ── Правая колонка — Активность (на всю высоту) ── */}
      <div className="flex flex-col">
        <ActivityFeed client={data} onAddComment={text => {
          const entry = { text, date: new Date().toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) };
          setComments(prev => [...prev, entry]);
          const newNotes = (data.notes ? data.notes + "\n" : "") + `[${entry.date}] ${text}`;
          save({ notes: newNotes });
        }} />

        {/* Метаданные */}
        <div className="text-[10px] opacity-25 px-1 mt-2" style={{ color: t.textMute }}>
          ID #{data.id} · {data.source || "chat"}
        </div>
      </div>
    </div>
  );
}
