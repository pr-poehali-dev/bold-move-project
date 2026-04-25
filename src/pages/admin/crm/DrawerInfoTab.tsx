import { useState, useRef } from "react";
import { Client, STATUS_LABELS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { InlineField, Section, FileField, TagsField } from "./drawerComponents";
import { StatusSelector, ActivityFeed, ActivityEvent } from "./DrawerStatusActivity";

interface Props {
  data: Client;
  client: Client;
  setData: (c: Client) => void;
  save: (patch: Partial<Client>) => void;
  setComments: React.Dispatch<React.SetStateAction<{ text: string; date: string }[]>>;
}

type BuiltinBlockId =
  | "status" | "tags" | "contacts" | "object" | "dates" | "notes"
  | "pl" | "income" | "costs" | "files" | "cancel";

type BlockId = BuiltinBlockId | string; // строки вида "custom_TIMESTAMP"

interface BlockDef { id: BlockId; col: 0 | 1; order: number; }

// Кастомный блок — данные хранятся в localStorage
interface CustomBlockRow { label: string; type: "text" | "file"; value: string; }
interface CustomBlockData { id: string; title: string; icon: string; color: string; rows: CustomBlockRow[]; }

const LS_CUSTOM = "drawer_custom_blocks";
const ICON_OPTIONS = ["Star","Briefcase","Building","Car","Clock","CreditCard","Globe","Heart","Home","Info","Key","Layers","List","Lock","Mail","Map","Monitor","Music","Package","Palette","PenTool","Phone","Printer","Shield","ShoppingCart","Truck","Users","Zap"];
const COLOR_OPTIONS = ["#8b5cf6","#06b6d4","#10b981","#f59e0b","#f97316","#ef4444","#ec4899","#3b82f6","#a78bfa"];

function loadCustomBlocks(): CustomBlockData[] {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM) || "[]"); } catch { return []; }
}
function saveCustomBlocks(blocks: CustomBlockData[]) {
  localStorage.setItem(LS_CUSTOM, JSON.stringify(blocks));
}

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
const LS_HIDDEN = "drawer_blocks_hidden";

function loadBlocks(): BlockDef[] {
  try { const s = JSON.parse(localStorage.getItem(LS_BLOCKS) || "null"); if (Array.isArray(s) && s.length) return s; } catch { /**/ }
  return DEFAULT_BLOCKS;
}
function loadHidden(): Set<BlockId> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_HIDDEN) || "[]") as BlockId[]); } catch { return new Set(); }
}

// ── BlockEditor ────────────────────────────────────────────────────────────────
interface EditRow { label: string; value: string; key: string; }

function BlockEditor({ rows, onSave, onClose }: {
  rows: EditRow[];
  onSave: (rows: EditRow[]) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [local, setLocal] = useState<EditRow[]>(rows);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const updateRow = (i: number, field: "label" | "value", v: string) =>
    setLocal(prev => prev.map((r, j) => j === i ? { ...r, [field]: v } : r));
  const deleteRow = (i: number) => setLocal(prev => prev.filter((_, j) => j !== i));
  const addRow = () => {
    if (!newLabel.trim()) return;
    setLocal(prev => [...prev, { label: newLabel.trim(), value: newValue, key: `custom_${Date.now()}` }]);
    setNewLabel(""); setNewValue("");
  };

  return (
    <div className="mt-2 mb-1 rounded-xl overflow-hidden" style={{ border: `1px solid #7c3aed40`, background: "#7c3aed08" }}>
      <div className="divide-y" style={{ borderColor: "#7c3aed20" }}>
        {local.map((row, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5">
            <input value={row.label} onChange={e => updateRow(i, "label", e.target.value)}
              className="w-28 text-xs rounded-lg px-2 py-1 focus:outline-none"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
            <input value={row.value} onChange={e => updateRow(i, "value", e.target.value)}
              className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
            <button onClick={() => deleteRow(i)} className="text-red-400 hover:text-red-300 transition flex-shrink-0">
              <Icon name="Trash2" size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: `1px solid #7c3aed20` }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addRow()} placeholder="Название..."
          className="w-28 text-xs rounded-lg px-2 py-1 focus:outline-none"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
        <input value={newValue} onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addRow()} placeholder="Значение..."
          className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
        <button onClick={addRow} className="px-2 py-1 rounded-lg text-xs font-semibold text-violet-300 bg-violet-600/20 hover:bg-violet-600/30 transition flex-shrink-0">
          <Icon name="Plus" size={12} />
        </button>
      </div>
      <div className="flex gap-2 px-3 pb-2">
        <button onClick={() => onSave(local)} className="flex-1 py-1 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 transition">Сохранить</button>
        <button onClick={onClose} className="px-3 py-1 rounded-lg text-xs transition" style={{ background: t.surface2, color: t.textMute }}>Отмена</button>
      </div>
    </div>
  );
}

// ── AddBlockModal ─────────────────────────────────────────────────────────────
function AddBlockModal({ onSave, onClose }: {
  onSave: (block: CustomBlockData) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [title, setTitle]   = useState("");
  const [icon, setIcon]     = useState("Star");
  const [color, setColor]   = useState("#8b5cf6");
  const [rows, setRows]     = useState<CustomBlockRow[]>([{ label: "", type: "text", value: "" }]);

  const addRow = () => setRows(prev => [...prev, { label: "", type: "text", value: "" }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, j) => j !== i));
  const updateRow = (i: number, field: keyof CustomBlockRow, v: string) =>
    setRows(prev => prev.map((r, j) => j === i ? { ...r, [field]: v } : r));

  const handleSave = () => {
    if (!title.trim()) return;
    const validRows = rows.filter(r => r.label.trim());
    onSave({ id: `custom_${Date.now()}`, title: title.trim(), icon, color, rows: validRows });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <span className="text-sm font-bold text-white">Новый блок</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Название */}
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: t.textMute }}>Название блока</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Например: Дополнительно"
              className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }} />
          </div>

          {/* Иконка + цвет */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: t.textMute }}>Иконка</label>
              <select value={icon} onChange={e => setIcon(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }}>
                {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: t.textMute }}>Цвет</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-lg transition"
                    style={{ background: c, border: `2px solid ${color === c ? "#fff" : "transparent"}` }} />
                ))}
              </div>
            </div>
          </div>

          {/* Строки */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs" style={{ color: t.textMute }}>Строки блока</label>
              <button onClick={addRow} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition">
                <Icon name="Plus" size={11} /> Добавить строку
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={row.label} onChange={e => updateRow(i, "label", e.target.value)}
                    placeholder="Название строки"
                    className="flex-1 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }} />
                  <select value={row.type} onChange={e => updateRow(i, "type", e.target.value)}
                    className="rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }}>
                    <option value="text">Текст</option>
                    <option value="file">Файл</option>
                  </select>
                  <button onClick={() => removeRow(i)} disabled={rows.length === 1}
                    className="flex-shrink-0 text-red-400 hover:text-red-300 transition disabled:opacity-30">
                    <Icon name="X" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Футер */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={handleSave} disabled={!title.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: "#7c3aed" }}>
            <div className="flex items-center justify-center gap-2">
              <Icon name={icon} size={14} style={{ color: color }} /> Создать блок
            </div>
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm transition"
            style={{ background: t.surface2, color: t.textMute }}>
            Отмена
          </button>
        </div>
      </div>
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
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <div draggable
      onDragStart={() => onDragStart(blockId)}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); onDragOver(e, blockId); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => { setIsDragOver(false); onDrop(blockId); }}
      style={{ outline: isDragOver ? `2px dashed #7c3aed60` : undefined, borderRadius: 16, transition: "outline 0.1s" }}>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DrawerInfoTab({ data, client, setData, save, setComments }: Props) {
  const t = useTheme();
  const [blocks, setBlocks]             = useState<BlockDef[]>(loadBlocks);
  const [hiddenBlocks, setHiddenBlocks] = useState<Set<BlockId>>(loadHidden);
  const [editingBlock, setEditingBlock] = useState<BlockId | null>(null);
  const [activityLog, setActivityLog]   = useState<ActivityEvent[]>([]);
  const [customBlocks, setCustomBlocks] = useState<CustomBlockData[]>(loadCustomBlocks);
  const [showAddBlock, setShowAddBlock] = useState<0 | 1 | null>(null); // колонка куда добавляем
  const [customRowVals, setCustomRowVals] = useState<Record<string, Record<number, string>>>({}); // id блока -> index -> value
  const dragId = useRef<BlockId | null>(null);

  const profit    = (data.contract_sum||0) - (data.material_cost||0) - (data.measure_cost||0) - (data.install_cost||0);
  const received  = (data.prepayment||0) + (data.extra_payment||0);
  const remaining = (data.contract_sum||0) - received;

  const now = () => new Date().toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const logAction = (icon: string, color: string, text: string) => {
    setActivityLog(prev => [...prev, { icon, color, text, date: now() }]);
  };

  // save с логированием
  const saveWithLog = (patch: Partial<Client>, logText: string, icon = "Edit3", color = "#8b5cf6") => {
    save(patch);
    logAction(icon, color, logText);
  };

  const toggleHidden = (id: BlockId) => {
    setHiddenBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(LS_HIDDEN, JSON.stringify([...next]));
      return next;
    });
  };

  const addCustomBlock = (block: CustomBlockData, col: 0 | 1) => {
    const updated = [...customBlocks, block];
    setCustomBlocks(updated);
    saveCustomBlocks(updated);
    const newBlockDef: BlockDef = { id: block.id, col, order: 999 };
    const newBlocks = [...blocks, newBlockDef];
    setBlocks(newBlocks);
    localStorage.setItem(LS_BLOCKS, JSON.stringify(newBlocks));
    logAction("Plus", "#8b5cf6", `Блок создан: ${block.title}`);
    setShowAddBlock(null);
  };

  const deleteCustomBlock = (id: string) => {
    const updated = customBlocks.filter(b => b.id !== id);
    setCustomBlocks(updated);
    saveCustomBlocks(updated);
    const newBlocks = blocks.filter(b => b.id !== id);
    setBlocks(newBlocks);
    localStorage.setItem(LS_BLOCKS, JSON.stringify(newBlocks));
  };

  const renderCustomBlock = (cb: CustomBlockData) => {
    const isHidden = hiddenBlocks.has(cb.id);
    const vals = customRowVals[cb.id] || {};
    return (
      <Section key={cb.id} icon={cb.icon} title={cb.title} color={cb.color}
        hidden={isHidden}
        onToggleHidden={() => toggleHidden(cb.id)}
        onEdit={() => { if (confirm(`Удалить блок «${cb.title}»?`)) deleteCustomBlock(cb.id); }}>
        {cb.rows.map((row, i) => (
          row.type === "file" ? (
            <FileField key={i} label={row.label} url={vals[i] || null}
              onUploaded={url => {
                setCustomRowVals(prev => ({ ...prev, [cb.id]: { ...(prev[cb.id] || {}), [i]: url } }));
                logAction("Upload", cb.color, `${cb.title} / ${row.label}: файл загружен`);
              }} />
          ) : (
            <div key={i} className="flex items-center justify-between py-2 group"
              style={{ borderBottom: `1px solid ${t.border2}` }}>
              <span className="text-xs w-36 flex-shrink-0" style={{ color: t.textMute }}>{row.label}</span>
              <input
                value={vals[i] || ""}
                onChange={e => setCustomRowVals(prev => ({ ...prev, [cb.id]: { ...(prev[cb.id] || {}), [i]: e.target.value } }))}
                onBlur={e => { if (e.target.value) logAction("Edit3", cb.color, `${cb.title} / ${row.label}: ${e.target.value}`); }}
                placeholder="—"
                className="flex-1 text-right text-sm bg-transparent focus:outline-none rounded-lg px-2 py-0.5 transition"
                style={{ color: "#fff" }}
                onFocus={e => { e.target.style.background = t.surface2; }}
                onBlurCapture={e => { e.target.style.background = "transparent"; }}
              />
            </div>
          )
        ))}
      </Section>
    );
  };

  const onDragStart = (id: BlockId) => { dragId.current = id; };
  const onDragOver  = (_e: React.DragEvent, _id: BlockId) => {};
  const onDrop = (targetId: BlockId) => {
    const from = dragId.current; dragId.current = null;
    if (!from || from === targetId) return;
    setBlocks(prev => {
      const toBlock = prev.find(b => b.id === targetId)!;
      const updated = prev.map(b => b.id === from ? { ...b, col: toBlock.col, order: toBlock.order - 0.5 } : b);
      const result: BlockDef[] = [];
      for (const col of [0, 1] as const) {
        updated.filter(b => b.col === col).sort((a, b) => a.order - b.order).forEach((b, i) => result.push({ ...b, order: i }));
      }
      localStorage.setItem(LS_BLOCKS, JSON.stringify(result));
      return result;
    });
  };

  const getEditRows = (id: BlockId): EditRow[] => {
    switch (id) {
      case "contacts": return [
        { label: "Имя", value: data.client_name || "", key: "client_name" },
        { label: "Телефон", value: data.phone || "", key: "phone" },
        { label: "Ответственный", value: data.responsible_phone || "", key: "responsible_phone" },
      ];
      case "object": return [
        { label: "Адрес", value: data.address || "", key: "address" },
        { label: "Карта", value: data.map_link || "", key: "map_link" },
        { label: "Площадь", value: data.area ? String(data.area) : "", key: "area" },
      ];
      case "dates": return [
        { label: "Замер", value: data.measure_date ? data.measure_date.slice(0, 16) : "", key: "measure_date" },
        { label: "Монтаж", value: data.install_date ? data.install_date.slice(0, 16) : "", key: "install_date" },
      ];
      case "income": return [
        { label: "Договор", value: data.contract_sum ? String(data.contract_sum) : "", key: "contract_sum" },
        { label: "Предоплата", value: data.prepayment ? String(data.prepayment) : "", key: "prepayment" },
        { label: "Доплата", value: data.extra_payment ? String(data.extra_payment) : "", key: "extra_payment" },
        { label: "Доп. согл.", value: data.extra_agreement_sum ? String(data.extra_agreement_sum) : "", key: "extra_agreement_sum" },
      ];
      case "costs": return [
        { label: "Материалы", value: data.material_cost ? String(data.material_cost) : "", key: "material_cost" },
        { label: "Замер", value: data.measure_cost ? String(data.measure_cost) : "", key: "measure_cost" },
        { label: "Монтаж", value: data.install_cost ? String(data.install_cost) : "", key: "install_cost" },
      ];
      default: return [];
    }
  };

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

  const wrap = (id: BlockId, content: React.ReactNode, icon: string, title: string, color: string, hasEdit: boolean) => {
    const isHidden = hiddenBlocks.has(id);
    const showEditor = editingBlock === id;
    const editRows = getEditRows(id);
    return (
      <Section icon={icon} title={title} color={color}
        hidden={isHidden}
        onToggleHidden={() => toggleHidden(id)}
        onEdit={hasEdit && !isHidden ? () => setEditingBlock(showEditor ? null : id) : undefined}>
        {content}
        {showEditor && editRows.length > 0 && (
          <BlockEditor rows={editRows} onSave={rows => saveEditRows(id, rows)} onClose={() => setEditingBlock(null)} />
        )}
      </Section>
    );
  };

  const renderBlock = (id: BlockId): React.ReactNode => {
    const isHidden = hiddenBlocks.has(id);
    switch (id) {
      // "status" рендерится отдельно вверху — пропускаем
      case "status": return null;
      case "tags":
        return wrap(id,
          <TagsField tags={data.tags} onSave={tags => {
            const added   = tags.filter(tg => !(data.tags || []).includes(tg));
            const removed = (data.tags || []).filter(tg => !tags.includes(tg));
            if (added.length)   logAction("Tag", "#06b6d4", `Метка добавлена: ${added.join(", ")}`);
            if (removed.length) logAction("Tag", "#ef4444", `Метка удалена: ${removed.join(", ")}`);
            save({ tags });
          }} />,
          "Tag", "Метки", "#06b6d4", false);
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
        if (!data.contract_sum && !data.material_cost && !data.install_cost) return null;
        return (
          <div key="pl" className="rounded-2xl overflow-hidden group/section" style={{ opacity: isHidden ? 0.45 : 1, border: `1px solid ${t.border}` }}>
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "linear-gradient(135deg,#7c3aed15,#10b98112)", borderBottom: isHidden ? "none" : `1px solid #7c3aed30` }}>
              <Icon name="TrendingUp" size={13} style={{ color: "#10b981" }} />
              <span className="text-xs font-bold uppercase tracking-wider text-white flex-1">P&L по заказу</span>
              <button onClick={() => toggleHidden(id)} className="p-1 rounded-md opacity-0 group-hover/section:opacity-100 transition hover:bg-white/10" style={{ color: isHidden ? "#10b981" : t.textMute }}>
                <Icon name={isHidden ? "EyeOff" : "Eye"} size={12} />
              </button>
            </div>
            {!isHidden && (
              <div className="px-4 py-3 space-y-2 text-sm" style={{ background: "linear-gradient(135deg,#7c3aed08,#10b98108)" }}>
                {data.contract_sum ? <div className="flex justify-between"><span style={{ color: t.textMute }}>Договор</span><span className="font-bold text-white">{data.contract_sum.toLocaleString("ru-RU")} ₽</span></div> : null}
                {received > 0 && <div className="flex justify-between"><span style={{ color: t.textMute }}>Получено</span><span className="font-semibold text-emerald-400">+{received.toLocaleString("ru-RU")} ₽</span></div>}
                {remaining > 0 && data.contract_sum ? <div className="flex justify-between"><span style={{ color: t.textMute }}>Остаток</span><span className="font-semibold text-amber-400">{remaining.toLocaleString("ru-RU")} ₽</span></div> : null}
                {(data.material_cost||data.measure_cost||data.install_cost) ? <div className="flex justify-between"><span style={{ color: t.textMute }}>Затраты</span><span className="font-semibold text-red-400">−{((data.material_cost||0)+(data.measure_cost||0)+(data.install_cost||0)).toLocaleString("ru-RU")} ₽</span></div> : null}
                <div className="flex justify-between pt-2 mt-1" style={{ borderTop: `1px solid ${t.border}` }}>
                  <span className="font-bold text-white">Прибыль</span>
                  <span className={`text-lg font-black ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{profit >= 0 ? "+" : ""}{profit.toLocaleString("ru-RU")} ₽</span>
                </div>
              </div>
            )}
          </div>
        );
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
          <FileField label="Фото до"         url={data.photo_before_url} accept="image/*"                    onUploaded={url => { save({ photo_before_url: url }); logAction("Image", "#06b6d4", "Фото до загружено"); }} />
          <FileField label="Фото после"      url={data.photo_after_url}  accept="image/*"                    onUploaded={url => { save({ photo_after_url: url }); logAction("Image", "#06b6d4", "Фото после загружено"); }} />
          <FileField label="Договор / Смета" url={data.document_url}     accept=".pdf,.doc,.docx,.xls,.xlsx" onUploaded={url => { save({ document_url: url }); logAction("FileText", "#06b6d4", "Документ загружен"); }} />
        </>, "Paperclip", "Файлы", "#06b6d4", false);
      case "cancel":
        return data.status !== "cancelled" ? null : wrap(id,
          <InlineField label="Причина" value={data.cancel_reason} onSave={v => saveWithLog({ cancel_reason: v }, `Причина отказа: ${v}`, "XCircle", "#ef4444")} placeholder="Укажите причину" />,
          "XCircle", "Причина отказа", "#ef4444", true);
      default: return null;
    }
  };

  const col0 = blocks.filter(b => b.col === 0).sort((a, b) => a.order - b.order);
  const col1 = blocks.filter(b => b.col === 1).sort((a, b) => a.order - b.order);

  return (
    <div className="px-6 py-4 space-y-3">

      {/* ── Статус воронки — на всю ширину ── */}
      <Section icon="GitBranch" title="Статус воронки" color="#8b5cf6"
        onToggleHidden={() => toggleHidden("status")}
        hidden={hiddenBlocks.has("status")}>
        <StatusSelector status={data.status} onSave={s => {
          saveWithLog({ status: s }, `Статус → ${STATUS_LABELS[s] || s}`, "GitBranch", "#8b5cf6");
        }} />
      </Section>

      {/* ── Три колонки ── */}
      <div className="grid grid-cols-[1fr_1fr_320px] gap-3">

        {/* Левый столбец */}
        <div className="space-y-3">
          {col0.filter(b => b.id !== "status").map(b => (
            <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
              {b.id.startsWith("custom_")
                ? renderCustomBlock(customBlocks.find(cb => cb.id === b.id)!)
                : renderBlock(b.id)}
            </DraggableBlock>
          ))}
          <button onClick={() => setShowAddBlock(0)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition border-2 border-dashed hover:border-violet-500/40 hover:text-violet-400"
            style={{ borderColor: t.border, color: t.textMute }}>
            <Icon name="Plus" size={13} /> Добавить блок
          </button>
        </div>

        {/* Центральный столбец */}
        <div className="space-y-3">
          {col1.map(b => (
            <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
              {b.id.startsWith("custom_")
                ? renderCustomBlock(customBlocks.find(cb => cb.id === b.id)!)
                : renderBlock(b.id)}
            </DraggableBlock>
          ))}
          <button onClick={() => setShowAddBlock(1)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition border-2 border-dashed hover:border-violet-500/40 hover:text-violet-400"
            style={{ borderColor: t.border, color: t.textMute }}>
            <Icon name="Plus" size={13} /> Добавить блок
          </button>
          <button
            onClick={() => { setBlocks(DEFAULT_BLOCKS); setHiddenBlocks(new Set()); localStorage.removeItem(LS_BLOCKS); localStorage.removeItem(LS_HIDDEN); }}
            className="text-[10px] opacity-25 hover:opacity-50 transition flex items-center gap-1 px-1"
            style={{ color: t.textMute }}>
            <Icon name="RotateCcw" size={10} /> сбросить
          </button>
        </div>

        {/* Правая колонка — Активность */}
        <div className="flex flex-col">
          <ActivityFeed client={data} extraEvents={activityLog} onAddComment={text => {
            const ts = now();
            setComments(prev => [...prev, { text, date: ts }]);
            logAction("MessageSquare", "#7c3aed", text);
            const newNotes = (data.notes ? data.notes + "\n" : "") + `[${ts}] ${text}`;
            save({ notes: newNotes });
          }} />
          <div className="text-[10px] opacity-20 px-1 mt-2" style={{ color: t.textMute }}>
            ID #{data.id} · {data.source || "chat"}
          </div>
        </div>
      </div>

      {/* Модалка добавления блока */}
      {showAddBlock !== null && (
        <AddBlockModal
          onSave={block => addCustomBlock(block, showAddBlock)}
          onClose={() => setShowAddBlock(null)}
        />
      )}
    </div>
  );
}