import { useState, useRef } from "react";
import type React from "react";
import { crmFetch, Client } from "./crmApi";
import { useTheme } from "./themeContext";
import ClientDrawer from "./ClientDrawer";
import { KanbanHeader } from "./KanbanHeader";
import { KanbanColumn } from "./KanbanColumn";
import {
  KANBAN_COLS, DROP_STATUS, CustomKanbanCol,
  LS_HIDDEN, LS_LABELS, LS_COLORS,
  loadHidden, loadLabels, loadColors, saveColors,
  loadCustomCols, saveCustomCols,
  loadGlobalWidth, saveGlobalWidth,
} from "./kanbanTypes";

interface Props {
  clients: Client[];
  loading: boolean;
  onStatusChange: (id: number, status: string) => void;
  onClientRemoved: (id: number) => void;
  onReload: () => void;
}

export default function CrmKanban({ clients, loading, onStatusChange, onClientRemoved, onReload }: Props) {
  const t = useTheme();
  const [selected, setSelected]       = useState<Client | null>(null);
  const [dragging, setDragging]       = useState<Client | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const dragRef = useRef<Client | null>(null);

  const [globalWidth, setGlobalWidth] = useState<number>(loadGlobalWidth);
  const [hiddenCols,  setHiddenCols]  = useState<Set<string>>(loadHidden);
  const [colLabels,   setColLabels]   = useState<Record<string, string>>(loadLabels);
  const [colColors,   setColColors]   = useState<Record<string, string>>(loadColors);
  const [customCols,  setCustomCols]  = useState<CustomKanbanCol[]>(loadCustomCols);

  const handleWidthChange = (w: number) => { setGlobalWidth(w); saveGlobalWidth(w); };

  const saveLabel = (colId: string, val: string) => {
    setColLabels(prev => {
      const next = { ...prev, [colId]: val.trim() };
      localStorage.setItem(LS_LABELS, JSON.stringify(next));
      return next;
    });
  };

  const saveColor = (colId: string, color: string) => {
    setColColors(prev => {
      const next = { ...prev, [colId]: color };
      saveColors(next);
      return next;
    });
  };

  // Удаление колонки (дефолтная → скрываем; кастомная → удаляем)
  const deleteCol = (colId: string) => {
    const isDefault = KANBAN_COLS.some(c => c.id === colId);
    if (isDefault) {
      setHiddenCols(prev => {
        const next = new Set(prev); next.add(colId);
        localStorage.setItem(LS_HIDDEN, JSON.stringify([...next]));
        return next;
      });
    } else {
      const updated = customCols.filter(c => c.id !== colId);
      setCustomCols(updated);
      saveCustomCols(updated);
    }
  };

  // Добавление новой кастомной колонки
  const addCol = () => {
    const id = `custom_col_${Date.now()}`;
    const newCol: CustomKanbanCol = { id, label: "Новая колонка", color: "#8b5cf6", statuses: [] };
    const updated = [...customCols, newCol];
    setCustomCols(updated);
    saveCustomCols(updated);
  };

  const getColColor = (colId: string, defaultColor: string) => colColors[colId] || defaultColor;
  const getColLabel = (colId: string, defaultLabel: string) => colLabels[colId] || defaultLabel;



  // Все видимые колонки: дефолтные (не скрытые) + кастомные
  const defaultCols = KANBAN_COLS
    .filter(col => !hiddenCols.has(col.id))
    .map(col => ({
      id: col.id,
      label: getColLabel(col.id, col.label),
      color: getColColor(col.id, col.color),
      statuses: col.statuses as readonly string[],
      isDefault: true,
    }));

  const customColsMapped = customCols.map(col => ({
    id: col.id,
    label: getColLabel(col.id, col.label),
    color: getColColor(col.id, col.color),
    statuses: [] as readonly string[],
    isDefault: false,
  }));

  const allCols = [...defaultCols, ...customColsMapped];

  const clientsForCol = (col: { statuses: readonly string[] }) =>
    clients.filter(c => {
      if (!col.statuses.includes(c.status)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.client_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
    });

  const onDragStart = (client: Client) => { dragRef.current = client; setDragging(client); };
  const onDragOver  = (e: React.DragEvent, colId: string) => { e.preventDefault(); setDragOverCol(colId); };
  const onDrop = async (colId: string) => {
    const client = dragRef.current;
    setDragging(null); setDragOverCol(null);
    if (!client) return;
    const newStatus = DROP_STATUS[colId];
    if (!newStatus || client.status === newStatus) return;
    onStatusChange(client.id, newStatus);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: newStatus }) }, { id: String(client.id) });
  };

  const handleNextStep = async (id: number, nextStatus: string) => {
    onStatusChange(id, nextStatus);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: nextStatus }) }, { id: String(id) });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">

      <KanbanHeader
        clientCount={clients.length}
        globalWidth={globalWidth}
        search={search}
        onSearch={setSearch}
        onWidthChange={handleWidthChange}
        onAddCol={addCol}
      />

      <div className="flex overflow-x-auto pb-4 select-none" style={{ minHeight: 520, gap: 0 }}>
        {allCols.map((col, colIdx) => (
          <KanbanColumn
            key={col.id}
            col={col}
            label={col.label}
            colClients={clientsForCol(col)}
            width={globalWidth}
            isLast={colIdx === allCols.length - 1}
            isOver={dragOverCol === col.id}
            dragging={dragging}
            canDelete={true}
            onDragStart={onDragStart}
            onDragEnd={() => { setDragging(null); setDragOverCol(null); }}
            onDragOver={onDragOver}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={onDrop}
            onOpen={setSelected}
            onNextStep={handleNextStep}
            onStartResize={() => {}}
            resizeBorderColor={t.border}
            onSaveLabel={saveLabel}
            onSaveColor={saveColor}
            onDelete={deleteCol}
          />
        ))}
      </div>

      {selected && (
        <ClientDrawer
          client={selected}
          allClientOrders={(() => {
            const phone = (selected.phone || "").trim().replace(/\D/g, "");
            return phone ? clients.filter(c => (c.phone || "").trim().replace(/\D/g, "") === phone) : [selected];
          })()}
          onClose={() => setSelected(null)}
          onUpdated={() => { onReload(); }}
          onDeleted={() => { setSelected(null); onClientRemoved(selected.id); }}
        />
      )}
    </div>
  );
}