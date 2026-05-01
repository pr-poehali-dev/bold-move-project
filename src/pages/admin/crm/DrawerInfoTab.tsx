import { useState, useRef, type Dispatch, type SetStateAction } from "react";
import { Client, STATUS_LABELS } from "./crmApi";
import { useTheme } from "./themeContext";
import { Section } from "./drawerComponents";
import { StatusSelector } from "./StatusSelector";
import { DrawerPLBlock } from "./DrawerPLBlock";
import { DrawerDiscountBlock } from "./DrawerDiscountBlock";
import { ActivityFeed, ActivityEvent, appendActivityLog } from "./ActivityFeed";
import { AddBlockModal } from "./DrawerBlockEditor";
import { DrawerColumns } from "./DrawerColumns";
import {
  BlockId, BlockDef, CustomBlockData, CustomFinRow,
  DEFAULT_BLOCKS, LS_BLOCKS, LS_HIDDEN,
  loadBlocks, loadHidden, loadCustomBlocks, saveCustomBlocks,
  loadRowVisibility, saveRowVisibility,
  loadCustomFinRows, saveCustomFinRows,
} from "./drawerTypes";

interface Props {
  data: Client;
  client: Client;
  setData: (c: Client) => void;
  save: (patch: Partial<Client>) => void;
  setComments: Dispatch<SetStateAction<{ text: string; date: string }[]>>;
  hideHidden?: boolean;
  canEdit?:          boolean;
  canOrdersEdit?:    boolean;
  canFinance?:       boolean;
  canFiles?:         boolean;
  canFieldContacts?: boolean;
  canFieldAddress?:  boolean;
  canFieldDates?:    boolean;
  canFieldFinance?:  boolean;
  canFieldFiles?:    boolean;
  canFieldCancel?:   boolean;
}

export default function DrawerInfoTab({ data, client, setData, save, setComments, hideHidden, canEdit = true, canOrdersEdit = true, canFinance = true, canFiles = true, canFieldContacts = true, canFieldAddress = true, canFieldDates = true, canFieldFinance = true, canFieldFiles = true, canFieldCancel = true }: Props) {
  const t = useTheme();

  // ── state ────────────────────────────────────────────────────────────────────
  const [blocks, setBlocks]               = useState<BlockDef[]>(loadBlocks);
  const [hiddenBlocks, setHiddenBlocks]   = useState<Set<BlockId>>(loadHidden);
  const [editingBlock, setEditingBlock]   = useState<BlockId | null>(null);
  const [activityLog, setActivityLog]     = useState<ActivityEvent[]>([]);
  const [customBlocks, setCustomBlocks]   = useState<CustomBlockData[]>(loadCustomBlocks);
  const [showAddBlock, setShowAddBlock]   = useState<0 | 1 | "wide" | null>(null);
  const [rowVisibility, setRowVisibility] = useState<Record<string, boolean>>(loadRowVisibility);
  const [customFinRows, setCustomFinRows] = useState<CustomFinRow[]>(loadCustomFinRows);

  const toggleRowVisibility = (key: string) => {
    setRowVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveRowVisibility(next);
      return next;
    });
  };

  const addCustomFinRow = (label: string, block: "income" | "costs") => {
    const key = `custom_row_${Date.now()}`;
    const newRow: CustomFinRow = { key, label, block };
    const updated = [...customFinRows, newRow];
    setCustomFinRows(updated);
    saveCustomFinRows(updated);
    setRowVisibility(prev => {
      const next = { ...prev, [key]: true };
      saveRowVisibility(next);
      return next;
    });
  };

  const deleteCustomFinRow = (key: string) => {
    const updated = customFinRows.filter(r => r.key !== key);
    setCustomFinRows(updated);
    saveCustomFinRows(updated);
  };

  const updateCustomFinRow = (key: string, label: string) => {
    const updated = customFinRows.map(r => r.key === key ? { ...r, label } : r);
    setCustomFinRows(updated);
    saveCustomFinRows(updated);
  };
  const [customRowVals, setCustomRowVals] = useState<Record<string, Record<number, string>>>(() => {
    try { return JSON.parse(localStorage.getItem(`custom_block_vals_${data.id}`) || "{}"); } catch { return {}; }
  });
  const dragId = useRef<BlockId | null>(null);

  // (финансовые расчёты перенесены в DrawerPLBlock)

  // ── логирование ──────────────────────────────────────────────────────────────
  const now = () => new Date().toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const logAction = (icon: string, color: string, text: string) => {
    const event: ActivityEvent = { icon, color, text, date: now() };
    setActivityLog(prev => [...prev, event]);
    appendActivityLog(data.id, event); // сохраняем в localStorage
  };

  const saveWithLog = (patch: Partial<Client>, logText: string, icon = "Edit3", color = "#8b5cf6") => {
    save(patch);
    logAction(icon, color, logText);
  };

  // ── видимость блоков ─────────────────────────────────────────────────────────
  const toggleHidden = (id: BlockId) => {
    setHiddenBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(LS_HIDDEN, JSON.stringify([...next]));
      return next;
    });
  };

  // ── кастомные блоки ──────────────────────────────────────────────────────────
  const addCustomBlock = (block: CustomBlockData, target: 0 | 1 | "wide") => {
    const isWide = target === "wide" || block.wide;
    const col: 0 | 1 = target === "wide" ? 0 : target;
    const updated = [...customBlocks, { ...block, wide: isWide }];
    setCustomBlocks(updated);
    saveCustomBlocks(updated);
    const newBlocks = [...blocks, { id: block.id, col, order: 999, wide: isWide }];
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

  const updateCustomBlock = (id: string, updatedBlock: CustomBlockData) => {
    const updated = customBlocks.map(b => b.id === id ? updatedBlock : b);
    setCustomBlocks(updated);
    saveCustomBlocks(updated);
  };

  // ── drag & drop (в т.ч. на пустое место — drop zone внизу колонки) ──────────
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

  // Drop на пустую зону внизу колонки
  const onDropToCol = (col: 0 | 1) => {
    const from = dragId.current; dragId.current = null;
    if (!from) return;
    setBlocks(prev => {
      const colBlocks = prev.filter(b => b.col === col).sort((a, b) => a.order - b.order);
      const maxOrder = colBlocks.length > 0 ? colBlocks[colBlocks.length - 1].order + 1 : 0;
      const updated = prev.map(b => b.id === from ? { ...b, col, order: maxOrder } : b);
      const result: BlockDef[] = [];
      for (const c of [0, 1] as const) {
        updated.filter(b => b.col === c).sort((a, b) => a.order - b.order).forEach((b, i) => result.push({ ...b, order: i }));
      }
      localStorage.setItem(LS_BLOCKS, JSON.stringify(result));
      return result;
    });
  };

  const handleReset = () => {
    setBlocks(DEFAULT_BLOCKS);
    setHiddenBlocks(new Set());
    localStorage.removeItem(LS_BLOCKS);
    localStorage.removeItem(LS_HIDDEN);
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="px-3 sm:px-6 py-4 space-y-3">

      {/* Статус воронки — на всю ширину */}
      {(!hideHidden || !hiddenBlocks.has("status")) && (
        <Section icon="GitBranch" title="Статус воронки" color="#8b5cf6"
          onToggleHidden={canEdit ? () => toggleHidden("status") : undefined}
          hidden={hiddenBlocks.has("status")}>
          <StatusSelector
            status={data.status}
            readOnly={!canOrdersEdit}
            onSave={s => {
              saveWithLog({ status: s }, `Статус → ${STATUS_LABELS[s] || s}`, "GitBranch", "#8b5cf6");
            }}
          />
        </Section>
      )}

      {/* P&L — на всю ширину под воронкой (только с правом finance) */}
      {canFinance && (!hideHidden || !hiddenBlocks.has("pl")) && (
        <DrawerPLBlock
          data={data}
          isHidden={hiddenBlocks.has("pl")}
          toggleHidden={toggleHidden}
          customFinRows={customFinRows}
        />
      )}

      {/* Оценка риска скидки — только если есть финансовые данные */}
      {canFinance && !hiddenBlocks.has("pl") && (
        <DrawerDiscountBlock
          data={data}
          customFinRows={customFinRows}
          onContractSumUpdated={newSum => save({ contract_sum: newSum })}
        />
      )}

      {/* Основной контент — всегда на всю ширину */}
      <DrawerColumns
        data={data}
        client={client}
        setData={setData}
        save={save}
        blocks={blocks}
        hiddenBlocks={hiddenBlocks}
        hideHidden={hideHidden}
        editingBlock={editingBlock}
        customBlocks={customBlocks}
        customRowVals={customRowVals}
        toggleHidden={toggleHidden}
        setEditingBlock={setEditingBlock}
        saveWithLog={saveWithLog}
        logAction={logAction}
        setCustomRowVals={setCustomRowVals}
        deleteCustomBlock={deleteCustomBlock}
        updateCustomBlock={updateCustomBlock}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDropToCol={onDropToCol}
        onAddBlock={(col) => setShowAddBlock(col)}
        onReset={handleReset}
        rowVisibility={rowVisibility}
        toggleRowVisibility={toggleRowVisibility}
        customFinRows={customFinRows}
        addCustomFinRow={addCustomFinRow}
        deleteCustomFinRow={deleteCustomFinRow}
        updateCustomFinRow={updateCustomFinRow}
        canFinance={canFinance}
        canFiles={canFiles}
        canFieldContacts={canFieldContacts}
        canFieldAddress={canFieldAddress}
        canFieldDates={canFieldDates}
        canFieldFinance={canFieldFinance}
        canFieldFiles={canFieldFiles}
        canFieldCancel={canFieldCancel}
      />

      {/* Активность — под блоками, всегда видна */}
      <ActivityFeed
        client={data}
        extraEvents={activityLog}
        onAddComment={text => {
          const ts = now();
          setComments(prev => [...prev, { text, date: ts }]);
          logAction("MessageSquare", "#7c3aed", `Комментарий: ${text}`);
        }}
      />

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