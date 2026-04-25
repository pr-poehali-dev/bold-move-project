import { useEffect, useState, useRef, useCallback } from "react";
import { crmFetch, Client } from "./crmApi";
import { useTheme } from "./themeContext";
import ClientDrawer from "./ClientDrawer";
import KanbanColSettings from "./KanbanColSettings";
import { KanbanHeader } from "./KanbanHeader";
import { KanbanColumn } from "./KanbanColumn";
import {
  KANBAN_COLS, ColId, DROP_STATUS,
  DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH,
  LS_KEY, LS_HIDDEN, LS_LABELS,
  loadWidths, saveWidths, loadHidden, loadLabels,
} from "./kanbanTypes";

export default function CrmKanban() {
  const t = useTheme();
  const [clients, setClients]         = useState<Client[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<Client | null>(null);
  const [dragging, setDragging]       = useState<Client | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColId | null>(null);
  const [search, setSearch]           = useState("");
  const dragRef = useRef<Client | null>(null);

  const [colWidths, setColWidths]     = useState<Record<string, number>>(loadWidths);
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);

  const [hiddenCols,   setHiddenCols]   = useState<Set<string>>(loadHidden);
  const [colLabels,    setColLabels]    = useState<Record<string, string>>(loadLabels);
  const [showSettings, setShowSettings] = useState(false);

  const getWidth = (colId: string) => colWidths[colId] ?? DEFAULT_WIDTH;

  const startResize = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault(); e.stopPropagation();
    resizeRef.current = { colId, startX: e.clientX, startW: getWidth(colId) };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeRef.current.startW + delta));
      setColWidths(prev => ({ ...prev, [resizeRef.current!.colId]: newW }));
    };
    const onUp = () => {
      if (resizeRef.current) { setColWidths(prev => { saveWidths(prev); return prev; }); resizeRef.current = null; }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]); // eslint-disable-line

  const toggleHide = (colId: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId); else next.add(colId);
      localStorage.setItem(LS_HIDDEN, JSON.stringify([...next]));
      return next;
    });
  };

  const saveLabel = (colId: string, val: string) => {
    setColLabels(prev => {
      const next = { ...prev, [colId]: val.trim() };
      localStorage.setItem(LS_LABELS, JSON.stringify(next));
      return next;
    });
  };

  const resetLabel = (colId: string) => {
    setColLabels(prev => {
      const next = { ...prev }; delete next[colId];
      localStorage.setItem(LS_LABELS, JSON.stringify(next));
      return next;
    });
  };

  const load = () => {
    crmFetch("clients").then(d => {
      setClients((Array.isArray(d) ? d : []).filter((c: Client) => c.status !== "deleted"));
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const clientsForCol = (col: typeof KANBAN_COLS[number]) =>
    clients.filter(c => {
      if (!col.statuses.includes(c.status as never)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.client_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
    });

  const onDragStart = (client: Client) => { dragRef.current = client; setDragging(client); };
  const onDragOver  = (e: React.DragEvent, colId: ColId) => { e.preventDefault(); setDragOverCol(colId); };
  const onDrop = async (colId: ColId) => {
    const client = dragRef.current;
    setDragging(null); setDragOverCol(null);
    if (!client) return;
    const newStatus = DROP_STATUS[colId];
    if (client.status === newStatus) return;
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: newStatus } : c));
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: newStatus }) }, { id: String(client.id) });
  };

  const handleNextStep = async (id: number, nextStatus: string) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, status: nextStatus } : c));
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: nextStatus }) }, { id: String(id) });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const visibleCols = KANBAN_COLS.filter(col => !hiddenCols.has(col.id));

  return (
    <div className="space-y-4">

      <KanbanHeader
        clientCount={clients.length}
        colWidths={colWidths}
        search={search}
        onSearch={setSearch}
        onResetWidths={() => setColWidths({})}
        onSettings={() => setShowSettings(true)}
      />

      <div className="flex overflow-x-auto pb-4 select-none" style={{ minHeight: 520, gap: 0 }}>
        {visibleCols.map((col, colIdx) => (
          <KanbanColumn
            key={col.id}
            col={col}
            label={colLabels[col.id] || col.label}
            colClients={clientsForCol(col)}
            width={getWidth(col.id)}
            isLast={colIdx === visibleCols.length - 1}
            isOver={dragOverCol === col.id}
            dragging={dragging}
            onDragStart={onDragStart}
            onDragEnd={() => { setDragging(null); setDragOverCol(null); }}
            onDragOver={onDragOver}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={onDrop}
            onOpen={setSelected}
            onNextStep={handleNextStep}
            onStartResize={startResize}
            resizeBorderColor={t.border}
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
          onUpdated={() => { load(); setSelected(null); }}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}

      {showSettings && (
        <KanbanColSettings
          hiddenCols={hiddenCols}
          colLabels={colLabels}
          onToggleHide={toggleHide}
          onSaveLabel={saveLabel}
          onResetLabel={resetLabel}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
