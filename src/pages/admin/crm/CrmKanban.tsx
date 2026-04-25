import { useEffect, useState, useRef, useCallback } from "react";
import { crmFetch, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import ClientDrawer from "./ClientDrawer";
import KanbanCard from "./KanbanCard";
import KanbanColSettings from "./KanbanColSettings";
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

  // Ширины колонок
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadWidths);
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);

  // Видимость и переименование колонок
  const [hiddenCols,   setHiddenCols]   = useState<Set<string>>(loadHidden);
  const [colLabels,    setColLabels]    = useState<Record<string, string>>(loadLabels);
  const [showSettings, setShowSettings] = useState(false);

  const getWidth = (colId: string) => colWidths[colId] ?? DEFAULT_WIDTH;

  const startResize = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { colId, startX: e.clientX, startW: getWidth(colId) };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeRef.current.startW + delta));
      setColWidths(prev => ({ ...prev, [resizeRef.current!.colId]: newW }));
    };
    const onUp = () => {
      if (resizeRef.current) {
        setColWidths(prev => { saveWidths(prev); return prev; });
        resizeRef.current = null;
      }
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
      const next = { ...prev };
      delete next[colId];
      localStorage.setItem(LS_LABELS, JSON.stringify(next));
      return next;
    });
  };

  const getLabel = (col: typeof KANBAN_COLS[number]) => colLabels[col.id] || col.label;

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

  return (
    <div className="space-y-4">

      {/* Шапка */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" style={{ color: t.text }}>Канбан-доска</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>
            {clients.length} клиентов · перетащи карточку для смены этапа
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.keys(colWidths).length > 0 && (
            <button onClick={() => { setColWidths({}); localStorage.removeItem(LS_KEY); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textMute }}
              title="Сбросить ширины колонок">
              <Icon name="RotateCcw" size={12} /> Сбросить
            </button>
          )}
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textSub }}>
            <Icon name="Settings2" size={13} /> Колонки
          </button>
          <div className="relative w-64">
            <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону..."
              className="w-full rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
        </div>
      </div>

      {/* Колонки */}
      <div className="flex overflow-x-auto pb-4 select-none" style={{ minHeight: 520, gap: 0 }}>
        {KANBAN_COLS.filter(col => !hiddenCols.has(col.id)).map((col, colIdx, visibleCols) => {
          const colClients = clientsForCol(col);
          const revenue = colClients.reduce((s, c) => s + (c.contract_sum || 0), 0);
          const isOver = dragOverCol === col.id;
          const w = getWidth(col.id);

          return (
            <div key={col.id} className="flex flex-shrink-0" style={{ width: w }}>
              {/* Колонка */}
              <div
                className="flex flex-col rounded-2xl transition-all"
                style={{ width: "100%", margin: "0 6px" }}
                onDragOver={e => onDragOver(e, col.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => onDrop(col.id)}>

                {/* Заголовок */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-t-2xl"
                  style={{ background: col.color + "18", borderBottom: `2px solid ${col.color}` }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                    <span className="text-xs font-bold truncate" style={{ color: t.text }}>{getLabel(col)}</span>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: col.color + "25", color: col.color }}>{colClients.length}</span>
                  </div>
                  {revenue > 0 && w > 180 && (
                    <span className="text-[10px] font-semibold flex-shrink-0 ml-1" style={{ color: col.color + "bb" }}>
                      {revenue.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                </div>

                {/* Карточки */}
                <div
                  className="flex-1 p-2 space-y-2 rounded-b-2xl transition-all"
                  style={{
                    background: isOver ? col.color + "08" : t.surface2,
                    border: isOver ? `2px dashed ${col.color}60` : `2px solid transparent`,
                    borderTop: "none",
                  }}>
                  {colClients.map(c => (
                    <div key={c.id}
                      onDragStart={() => onDragStart(c)}
                      onDragEnd={() => { setDragging(null); setDragOverCol(null); }}>
                      <KanbanCard
                        client={c}
                        dragging={dragging?.id === c.id}
                        onOpen={() => setSelected(c)}
                        onNextStep={handleNextStep}
                      />
                    </div>
                  ))}

                  {colClients.length === 0 && !isOver && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-40">
                      <Icon name="Inbox" size={20} style={{ color: t.textMute }} />
                      <span className="text-xs" style={{ color: t.textMute }}>Нет клиентов</span>
                    </div>
                  )}

                  {isOver && (
                    <div className="rounded-xl border-2 border-dashed py-6 flex items-center justify-center"
                      style={{ borderColor: col.color, background: col.color + "08" }}>
                      <span className="text-xs font-semibold" style={{ color: col.color }}>Переместить сюда</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ручка resize — между колонками */}
              {colIdx < visibleCols.length - 1 && (
                <div
                  className="flex-shrink-0 flex items-center justify-center group"
                  style={{ width: 8, cursor: "col-resize", zIndex: 10 }}
                  onMouseDown={e => startResize(e, col.id)}>
                  <div
                    className="rounded-full transition-all group-hover:opacity-100 opacity-0"
                    style={{ width: 3, height: 40, background: t.border, transition: "opacity 0.15s, background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#7c3aed")}
                    onMouseLeave={e => (e.currentTarget.style.background = t.border)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Drawer */}
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

      {/* Настройки колонок */}
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
