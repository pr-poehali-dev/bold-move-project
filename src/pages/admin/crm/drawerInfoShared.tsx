import { useState } from "react";
import { Client } from "./crmApi";
import { BlockId } from "./drawerTypes";
import Icon from "@/components/ui/icon";

// ── Общие типы/утилиты для инфо-блоков карточки клиента (DrawerContactsBlock,
// DrawerAssignedRolesBlock, DrawerObjectBlock, DrawerDatesBlock, DrawerCallDatesBlock,
// DrawerNotesBlock, DrawerCancelBlock) — вынесены сюда, чтобы не дублировать в каждом файле.

export interface ExtraRow { label: string; value: string; }

export interface InfoBlocksProps {
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

function loadExtraRows(blockId: string): ExtraRow[] {
  try { return JSON.parse(localStorage.getItem(`info_extra_rows_${blockId}`) || "[]"); } catch { return []; }
}
function saveExtraRows(blockId: string, rows: ExtraRow[]) {
  localStorage.setItem(`info_extra_rows_${blockId}`, JSON.stringify(rows));
}

// Хук единой логики для инфо-блоков
export function useInfoBlock(id: BlockId, hiddenBlocks: Set<BlockId>, editingBlock: BlockId | null, toggleHidden: (id: BlockId) => void, setEditingBlock: (id: BlockId | null) => void) {
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

export function AddRowInline({ color, onAdd, onDone }: { color: string; onAdd: (label: string) => void; onDone?: () => void }) {
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
