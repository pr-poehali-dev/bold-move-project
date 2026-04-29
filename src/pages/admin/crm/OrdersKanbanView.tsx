import type React from "react";
import { Client, crmFetch } from "./crmApi";
import { useTheme } from "./themeContext";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanHeader } from "./KanbanHeader";
import { CustomKanbanCol, DROP_STATUS, KANBAN_COLS, loadGlobalWidth, saveGlobalWidth } from "./kanbanTypes";
import {
  loadSyncedColors, loadSyncedCustomCols, loadSyncedHidden, loadSyncedLabels,
  saveSyncedColors, saveSyncedLabels, addSyncedCol, deleteSyncedCol,
} from "./syncedCols";
import { useRef, useState } from "react";

interface Props {
  allClients: Client[];
  search: string;
  onSearch: (v: string) => void;
  onStatusChange: (id: number, status: string) => void;
  onSelect: (c: Client) => void;
  onNextStep: (id: number, nextStatus: string) => void;
}

export function OrdersKanbanView({ allClients, search, onSearch, onStatusChange, onSelect, onNextStep }: Props) {
  const t = useTheme();

  const [colLabels, setColLabels] = useState<Record<string, string>>(loadSyncedLabels);
  const [colColors, setColColors] = useState<Record<string, string>>(loadSyncedColors);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(loadSyncedHidden);
  const [customCols, setCustomCols] = useState<CustomKanbanCol[]>(() =>
    loadSyncedCustomCols().map(c => ({ id: c.id, label: c.label, color: c.color, statuses: [] }))
  );
  const [globalWidth, setGlobalWidth] = useState<number>(loadGlobalWidth);
  const [dragging, setDragging] = useState<Client | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragRef = useRef<Client | null>(null);

  const getColColor = (colId: string, def: string) => colColors[colId] || def;
  const getColLabel = (colId: string, def: string) => colLabels[colId] || def;

  const allKanbanCols = [
    ...KANBAN_COLS.filter(col => !hiddenCols.has(col.id)).map(col => ({
      id: col.id, label: getColLabel(col.id, col.label), color: getColColor(col.id, col.color),
      statuses: col.statuses as readonly string[],
    })),
    ...customCols.map(col => ({
      id: col.id, label: getColLabel(col.id, col.label), color: getColColor(col.id, col.color),
      statuses: [] as readonly string[],
    })),
  ];

  const clientsForCol = (col: { statuses: readonly string[] }) =>
    allClients.filter(c => {
      if (!col.statuses.includes(c.status)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.client_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
    });

  const saveLabel = (colId: string, val: string) => {
    const next = { ...colLabels, [colId]: val.trim() };
    setColLabels(next); saveSyncedLabels(next);
  };
  const saveColor = (colId: string, color: string) => {
    const next = { ...colColors, [colId]: color };
    setColColors(next); saveSyncedColors(next);
  };
  const deleteCol = (colId: string) => {
    const isBuiltin = KANBAN_COLS.some(c => c.id === colId);
    const label = colLabels[colId] || colId;
    const msg = isBuiltin
      ? `Скрыть колонку «${label}»? Она исчезнет из канбана и из воронки.`
      : `Удалить колонку «${label}»? Она удалится из канбана и из воронки.`;
    if (!window.confirm(msg)) return;
    deleteSyncedCol(colId, isBuiltin);
    if (isBuiltin) {
      setHiddenCols(prev => { const next = new Set(prev); next.add(colId); return next; });
    } else {
      setCustomCols(prev => prev.filter(c => c.id !== colId));
    }
  };
  const addCol = () => {
    const col = addSyncedCol("Новая колонка", "#8b5cf6", "Layers");
    const kanbanCol: CustomKanbanCol = { id: col.id, label: col.label, color: col.color, statuses: [] };
    setCustomCols(prev => [...prev, kanbanCol]);
  };

  const onDragStart = (client: Client) => { dragRef.current = client; setDragging(client); };
  const onDragOver = (e: React.DragEvent, colId: string) => { e.preventDefault(); setDragOverCol(colId); };
  const onDrop = async (colId: string) => {
    const client = dragRef.current;
    setDragging(null); setDragOverCol(null);
    if (!client) return;
    const newStatus = DROP_STATUS[colId];
    if (!newStatus || client.status === newStatus) return;
    onStatusChange(client.id, newStatus);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: newStatus }) }, { id: String(client.id) });
  };

  return (
    <>
      <KanbanHeader
        clientCount={allClients.length}
        globalWidth={globalWidth}
        search={search}
        onSearch={onSearch}
        onWidthChange={w => { setGlobalWidth(w); saveGlobalWidth(w); }}
        onAddCol={addCol}
      />
      <div className="flex overflow-x-auto pb-4 select-none" style={{ minHeight: 520, gap: 0 }}>
        {allKanbanCols.map((col, colIdx) => (
          <KanbanColumn
            key={col.id}
            col={col}
            label={col.label}
            colClients={clientsForCol(col)}
            width={globalWidth}
            isLast={colIdx === allKanbanCols.length - 1}
            isOver={dragOverCol === col.id}
            dragging={dragging}
            canDelete={true}
            onDragStart={onDragStart}
            onDragEnd={() => { setDragging(null); setDragOverCol(null); }}
            onDragOver={onDragOver}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={onDrop}
            onOpen={onSelect}
            onNextStep={onNextStep}
            onStartResize={() => {}}
            resizeBorderColor={t.border}
            onSaveLabel={saveLabel}
            onSaveColor={saveColor}
            onDelete={deleteCol}
          />
        ))}
      </div>
    </>
  );
}