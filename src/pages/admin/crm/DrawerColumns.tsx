import { useState } from "react";
import type React from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { ActivityEvent } from "./DrawerStatusActivity";
import { BlockId, BlockDef, CustomBlockData, CustomFinRow } from "./drawerTypes";
import { DraggableBlock } from "./DrawerBlockEditor";
import { DrawerTagsBlock } from "./DrawerTagsBlock";
import { DrawerCustomBlock } from "./DrawerCustomBlock";
import { DrawerIncomeBlock, DrawerCostsBlock } from "./DrawerFinBlocks";
import {
  DrawerContactsBlock, DrawerObjectBlock, DrawerDatesBlock,
  DrawerNotesBlock, DrawerFilesBlock, DrawerCancelBlock,
} from "./DrawerInfoBlocks";

interface ColumnsProps {
  data: Client;
  client: Client;
  setData: (c: Client) => void;
  save: (patch: Partial<Client>) => void;
  blocks: BlockDef[];
  hiddenBlocks: Set<BlockId>;
  hideHidden?: boolean;
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
  updateCustomBlock: (id: string, updated: import("./drawerTypes").CustomBlockData) => void;
  onDragStart: (id: BlockId) => void;
  onDragOver: (e: React.DragEvent, id: BlockId) => void;
  onDrop: (targetId: BlockId) => void;
  onDropToCol: (col: 0 | 1) => void;
  onAddBlock: (col: 0 | 1 | "wide") => void;
  onReset: () => void;
  rowVisibility: Record<string, boolean>;
  toggleRowVisibility: (key: string) => void;
  customFinRows: CustomFinRow[];
  addCustomFinRow: (label: string, block: "income" | "costs") => void;
  deleteCustomFinRow: (key: string) => void;
  updateCustomFinRow: (key: string, label: string) => void;
}

export function DrawerColumns(props: ColumnsProps) {
  const {
    data, setData, client, save, blocks, hiddenBlocks, hideHidden, editingBlock, customBlocks,
    customRowVals, toggleHidden, setEditingBlock, saveWithLog, logAction, setCustomRowVals,
    deleteCustomBlock, updateCustomBlock, onDragStart, onDragOver, onDrop, onDropToCol, onAddBlock,
    rowVisibility, toggleRowVisibility, customFinRows, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
  } = props;
  const t = useTheme();

  const infoProps = {
    data, client, setData, save, hiddenBlocks, editingBlock,
    toggleHidden, setEditingBlock, saveWithLog, logAction,
  };

  const finProps = {
    data, editingBlock, hiddenBlocks, rowVisibility, customFinRows,
    toggleHidden, setEditingBlock, saveWithLog, logAction,
    toggleRowVisibility, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
  };

  // ── renderBlock ──────────────────────────────────────────────────────────────
  const renderBlock = (id: BlockId): React.ReactNode => {
    switch (id) {
      case "status":   return null;
      case "pl":       return null;

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

      case "contacts": return <DrawerContactsBlock {...infoProps} />;
      case "object":   return <DrawerObjectBlock   {...infoProps} />;
      case "dates":    return <DrawerDatesBlock     {...infoProps} />;
      case "notes":    return <DrawerNotesBlock     {...infoProps} />;
      case "files":    return <DrawerFilesBlock clientId={data.id} hiddenBlocks={hiddenBlocks} toggleHidden={toggleHidden} logAction={logAction} />;
      case "cancel":   return <DrawerCancelBlock    {...infoProps} />;
      case "income":   return <DrawerIncomeBlock    {...finProps}  />;
      case "costs":    return <DrawerCostsBlock     {...finProps}  />;

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
          editingBlock={editingBlock}
          setEditingBlock={setEditingBlock}
          toggleHidden={toggleHidden}
          deleteCustomBlock={deleteCustomBlock}
          updateCustomBlock={updateCustomBlock}
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

  const isVisible = (b: BlockDef) => !hideHidden || !hiddenBlocks.has(b.id as BlockId);
  const col0Narrow = col0.filter(b => b.id !== "status" && !b.wide).filter(isVisible);
  const col1Narrow = col1.filter(b => !b.wide).filter(isVisible);
  const wideBlocks = [...col0, ...col1].filter(b => b.wide && b.id !== "status")
    .filter(isVisible)
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