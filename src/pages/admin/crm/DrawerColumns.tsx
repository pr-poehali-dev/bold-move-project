import { useState } from "react";
import type React from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { BlockId, BlockDef, CustomBlockData, CustomFinRow } from "./drawerTypes";
import { DraggableBlock } from "./DrawerBlockEditor";
import { DrawerTagsBlock } from "./DrawerTagsBlock";
import { DrawerCustomBlock } from "./DrawerCustomBlock";
import { DrawerIncomeBlock, DrawerCostsBlock } from "./DrawerFinBlocks";
import {
  DrawerContactsBlock, DrawerObjectBlock, DrawerDatesBlock,
  DrawerFilesBlock, DrawerCancelBlock,
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
  canFinance?:       boolean;
  canFiles?:         boolean;
  canFieldContacts?: boolean;
  canFieldAddress?:  boolean;
  canFieldDates?:    boolean;
  canFieldFinance?:  boolean;
  canFieldFiles?:    boolean;
  canFieldCancel?:   boolean;
}

export function DrawerColumns(props: ColumnsProps) {
  const {
    data, setData, client, save, blocks, hiddenBlocks, hideHidden, editingBlock, customBlocks,
    customRowVals, toggleHidden, setEditingBlock, saveWithLog, logAction, setCustomRowVals,
    deleteCustomBlock, updateCustomBlock, onDragStart, onDragOver, onDrop, onDropToCol, onAddBlock,
    rowVisibility, toggleRowVisibility, customFinRows, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
    canFinance = true, canFiles = true,
    canFieldContacts = true, canFieldAddress = true, canFieldDates = true,
    canFieldFinance = true, canFieldFiles = true, canFieldCancel = true,
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

      case "contacts": return canFieldContacts ? <DrawerContactsBlock {...infoProps} /> : null;
      case "object":   return canFieldAddress  ? <DrawerObjectBlock   {...infoProps} /> : null;
      case "dates":    return canFieldDates     ? <DrawerDatesBlock    {...infoProps} /> : null;
      case "notes":    return null; // notes рендерится отдельно
      case "files":    return (canFiles && canFieldFiles)    ? <DrawerFilesBlock clientId={data.id} hiddenBlocks={hiddenBlocks} toggleHidden={toggleHidden} logAction={logAction} editingBlock={editingBlock} setEditingBlock={setEditingBlock} /> : null;
      case "cancel":   return canFieldCancel   ? <DrawerCancelBlock   {...infoProps} /> : null;
      case "income":   return (canFinance && canFieldFinance) ? <DrawerIncomeBlock {...finProps} /> : null;
      case "costs":    return (canFinance && canFieldFinance) ? <DrawerCostsBlock  {...finProps} /> : null;

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignItems: "stretch" }}>
        {/* Левый столбец */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {col0Narrow.map(b => (
            <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
              {renderColBlock(b)}
            </DraggableBlock>
          ))}
          {/* Пустой блок */}
          <div
            className="rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all"
            style={{
              flex: 1,
              minHeight: 48,
              border: `2px dashed ${dropOverCol === 0 ? "#7c3aed" : "#ffffff18"}`,
              background: dropOverCol === 0 ? "#7c3aed08" : "transparent",
            }}
            onClick={() => onAddBlock(0)}
            {...makeColDropZone(0)}
          >
            {dropOverCol === 0 ? (
              <span className="text-xs text-violet-400">Перетащи сюда</span>
            ) : (
              <span className="text-[11px]" style={{ color: "#ffffff30" }}>
                + Добавить блок
              </span>
            )}
          </div>
        </div>

        {/* Правый столбец */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {col1Narrow.map(b => (
            <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
              {renderColBlock(b)}
            </DraggableBlock>
          ))}
          {/* Drop-зона для перетаскивания в правую колонку */}
          <div
            className="rounded-xl flex flex-col items-center justify-center transition-all"
            style={{
              flex: 1,
              minHeight: 4,
              border: `2px dashed ${dropOverCol === 1 ? "#7c3aed" : "transparent"}`,
              background: dropOverCol === 1 ? "#7c3aed08" : "transparent",
            }}
            {...makeColDropZone(1)}
          >
            {dropOverCol === 1 && (
              <span className="text-xs text-violet-400">Перетащи сюда</span>
            )}
          </div>
        </div>
      </div>

      {/* Wide-блоки — на всю ширину, над кнопками добавления */}
      {wideBlocks.map(b => (
        <DraggableBlock key={b.id} blockId={b.id} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
          {renderColBlock(b)}
        </DraggableBlock>
      ))}


    </div>
  );
}