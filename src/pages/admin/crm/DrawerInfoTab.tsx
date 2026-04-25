import { useState, useRef } from "react";
import { Client, STATUS_LABELS } from "./crmApi";
import { useTheme } from "./themeContext";
import { Section } from "./drawerComponents";
import { StatusSelector, ActivityFeed, ActivityEvent } from "./DrawerStatusActivity";
import { AddBlockModal } from "./DrawerBlockEditor";
import { DrawerColumns } from "./DrawerColumns";
import {
  BlockId, BlockDef, CustomBlockData,
  DEFAULT_BLOCKS, LS_BLOCKS, LS_HIDDEN,
  loadBlocks, loadHidden, loadCustomBlocks, saveCustomBlocks,
} from "./drawerTypes";

interface Props {
  data: Client;
  client: Client;
  setData: (c: Client) => void;
  save: (patch: Partial<Client>) => void;
  setComments: React.Dispatch<React.SetStateAction<{ text: string; date: string }[]>>;
}

export default function DrawerInfoTab({ data, client, setData, save, setComments }: Props) {
  const t = useTheme();

  // ── state ────────────────────────────────────────────────────────────────────
  const [blocks, setBlocks]               = useState<BlockDef[]>(loadBlocks);
  const [hiddenBlocks, setHiddenBlocks]   = useState<Set<BlockId>>(loadHidden);
  const [editingBlock, setEditingBlock]   = useState<BlockId | null>(null);
  const [activityLog, setActivityLog]     = useState<ActivityEvent[]>([]);
  const [customBlocks, setCustomBlocks]   = useState<CustomBlockData[]>(loadCustomBlocks);
  const [showAddBlock, setShowAddBlock]   = useState<0 | 1 | null>(null);
  const [customRowVals, setCustomRowVals] = useState<Record<string, Record<number, string>>>({});
  const dragId = useRef<BlockId | null>(null);

  // ── финансы ──────────────────────────────────────────────────────────────────
  const profit    = (data.contract_sum||0) - (data.material_cost||0) - (data.measure_cost||0) - (data.install_cost||0);
  const received  = (data.prepayment||0) + (data.extra_payment||0);
  const remaining = (data.contract_sum||0) - received;

  // ── логирование ──────────────────────────────────────────────────────────────
  const now = () => new Date().toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const logAction = (icon: string, color: string, text: string) =>
    setActivityLog(prev => [...prev, { icon, color, text, date: now() }]);

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
  const addCustomBlock = (block: CustomBlockData, col: 0 | 1) => {
    const updated = [...customBlocks, block];
    setCustomBlocks(updated);
    saveCustomBlocks(updated);
    const newBlocks = [...blocks, { id: block.id, col, order: 999 }];
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

  // ── drag & drop ──────────────────────────────────────────────────────────────
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

  const handleReset = () => {
    setBlocks(DEFAULT_BLOCKS);
    setHiddenBlocks(new Set());
    localStorage.removeItem(LS_BLOCKS);
    localStorage.removeItem(LS_HIDDEN);
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-4 space-y-3">

      {/* Статус воронки — на всю ширину */}
      <Section icon="GitBranch" title="Статус воронки" color="#8b5cf6"
        onToggleHidden={() => toggleHidden("status")}
        hidden={hiddenBlocks.has("status")}>
        <StatusSelector status={data.status} onSave={s => {
          saveWithLog({ status: s }, `Статус → ${STATUS_LABELS[s] || s}`, "GitBranch", "#8b5cf6");
        }} />
      </Section>

      {/* Три колонки */}
      <div className="grid grid-cols-[1fr_1fr_320px] gap-3">

        {/* Левая + центральная колонки */}
        <div className="col-span-2">
          <DrawerColumns
            data={data}
            client={client}
            setData={setData}
            save={save}
            blocks={blocks}
            hiddenBlocks={hiddenBlocks}
            editingBlock={editingBlock}
            customBlocks={customBlocks}
            customRowVals={customRowVals}
            activityLog={activityLog}
            profit={profit}
            received={received}
            remaining={remaining}
            toggleHidden={toggleHidden}
            setEditingBlock={setEditingBlock}
            saveWithLog={saveWithLog}
            logAction={logAction}
            setCustomRowVals={setCustomRowVals}
            deleteCustomBlock={deleteCustomBlock}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onAddBlockLeft={() => setShowAddBlock(0)}
            onAddBlockRight={() => setShowAddBlock(1)}
            onReset={handleReset}
          />
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
