import { useState, useRef, useCallback } from "react";
import { Client, STATUS_COLORS, STATUS_LABELS } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import KanbanCard from "./KanbanCard";

interface ColDef {
  id: string;
  label: string;
  color: string;
  statuses: readonly string[];
}

interface Props {
  cols: ColDef[];
  clientsForCol: (col: ColDef) => Client[];
  onOpen: (c: Client) => void;
  onNextStep: (id: number, next: string) => void;
  onDrop: (colId: string) => void;
  onDragStart: (c: Client) => void;
  onDragEnd: () => void;
  dragging: Client | null;
}

export function KanbanMobileView({
  cols, clientsForCol, onOpen, onNextStep,
  onDrop, onDragStart, onDragEnd, dragging,
}: Props) {
  const t = useTheme();
  const [activeColIdx, setActiveColIdx] = useState(0);
  const activeCol = cols[activeColIdx] ?? cols[0];
  const clients = activeCol ? clientsForCol(activeCol) : [];

  // ── Touch свайп между колонками ──────────────────────────────────────────
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Горизонтальный свайп > 50px и не вертикальный
    if (Math.abs(dx) > 50 && dy < 80) {
      if (dx < 0 && activeColIdx < cols.length - 1) setActiveColIdx(i => i + 1);
      if (dx > 0 && activeColIdx > 0)               setActiveColIdx(i => i - 1);
    }
  };

  // ── Touch drag карточки ──────────────────────────────────────────────────
  const dragCardRef    = useRef<Client | null>(null);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [dragPos, setDragPos]               = useState({ x: 0, y: 0 });
  const [dragOverColId, setDragOverColId]   = useState<string | null>(null);

  const onCardTouchStart = useCallback((e: React.TouchEvent, c: Client) => {
    dragCardRef.current = c;
    onDragStart(c);
    setIsDraggingCard(true);
    setDragPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, [onDragStart]);

  const onCardTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragCardRef.current) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    setDragPos({ x, y });

    // Определяем над какой колонкой-индикатором
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const colId = (el as HTMLElement).dataset?.kanbanColId;
      if (colId) { setDragOverColId(colId); return; }
    }
    setDragOverColId(null);
  }, []);

  const onCardTouchEnd = useCallback(() => {
    if (dragCardRef.current && dragOverColId) {
      onDrop(dragOverColId);
    }
    dragCardRef.current = null;
    setIsDraggingCard(false);
    setDragOverColId(null);
    onDragEnd();
  }, [dragOverColId, onDrop, onDragEnd]);

  if (!activeCol) return null;

  return (
    <div className="flex flex-col" style={{ minHeight: 400 }}>

      {/* ── Переключатель колонок (таблетки) ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 px-1" style={{ scrollbarWidth: "none" }}>
        {cols.map((col, idx) => {
          const cnt    = clientsForCol(col).length;
          const active = idx === activeColIdx;
          return (
            <button
              key={col.id}
              onClick={() => setActiveColIdx(idx)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
              style={{
                background: active ? col.color + "25" : t.surface2,
                border:     `1.5px solid ${active ? col.color + "70" : t.border}`,
                color:      active ? col.color : t.textMute,
              }}>
              <span>{col.label}</span>
              <span className="font-bold px-1.5 py-0.5 rounded-md text-[10px]"
                style={{ background: col.color + "20", color: col.color }}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* ── Подсказка свайп ── */}
      <div className="flex items-center justify-between px-1 mb-2">
        <button
          onClick={() => setActiveColIdx(i => Math.max(0, i - 1))}
          disabled={activeColIdx === 0}
          className="p-1.5 rounded-lg transition disabled:opacity-20"
          style={{ color: activeCol.color, background: activeCol.color + "15" }}>
          <Icon name="ChevronLeft" size={16} />
        </button>

        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: activeCol.color }} />
          <span className="text-sm font-bold" style={{ color: activeCol.color }}>{activeCol.label}</span>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: activeCol.color + "20", color: activeCol.color }}>
            {clients.length}
          </span>
        </div>

        <button
          onClick={() => setActiveColIdx(i => Math.min(cols.length - 1, i + 1))}
          disabled={activeColIdx === cols.length - 1}
          className="p-1.5 rounded-lg transition disabled:opacity-20"
          style={{ color: activeCol.color, background: activeCol.color + "15" }}>
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>

      {/* ── Зоны сброса (drop targets) — горизонтальная полоса ── */}
      {isDraggingCard && (
        <div className="fixed inset-x-0 z-50 flex gap-1 px-2"
          style={{ bottom: 24, pointerEvents: "none" }}>
          {cols.map(col => (
            <div
              key={col.id}
              data-kanban-col-id={col.id}
              className="flex-1 flex items-center justify-center rounded-xl py-3 text-xs font-bold transition"
              style={{
                background:  dragOverColId === col.id ? col.color + "40" : col.color + "18",
                border:      `2px dashed ${dragOverColId === col.id ? col.color : col.color + "50"}`,
                color:       col.color,
                pointerEvents: "all",
                transform:   dragOverColId === col.id ? "scale(1.05)" : "scale(1)",
                transition:  "all 0.15s",
              }}>
              {col.label}
            </div>
          ))}
        </div>
      )}

      {/* ── Призрак перетаскиваемой карточки ── */}
      {isDraggingCard && dragging && (
        <div
          className="fixed z-[60] pointer-events-none rounded-xl px-3 py-2 text-xs font-bold shadow-2xl"
          style={{
            left: dragPos.x - 60,
            top:  dragPos.y - 20,
            background: activeCol.color + "30",
            border:     `1px solid ${activeCol.color}`,
            color:      "#fff",
            opacity:    0.9,
          }}>
          {dragging.client_name || `Заявка №${dragging.id}`}
        </div>
      )}

      {/* ── Карточки активной колонки ── */}
      <div
        className="flex-1 rounded-2xl p-2 space-y-2"
        style={{
          background:  t.surface2,
          border:      `2px solid ${activeCol.color}30`,
          minHeight:   320,
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}>

        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: t.textMute }}>
            <Icon name="Inbox" size={28} className="opacity-20" />
            <span className="text-sm">Нет карточек</span>
          </div>
        ) : (
          clients.map(c => (
            <div
              key={c.id}
              onTouchStart={e => onCardTouchStart(e, c)}
              onTouchMove={onCardTouchMove}
              onTouchEnd={onCardTouchEnd}
              style={{ touchAction: "none" }}>
              <KanbanCard
                client={c}
                color={activeCol.color}
                onOpen={() => onOpen(c)}
                onNextStep={onNextStep}
                isDragging={dragging?.id === c.id}
              />
            </div>
          ))
        )}
      </div>

      {/* ── Точки-индикаторы колонок ── */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {cols.map((col, idx) => (
          <button
            key={col.id}
            onClick={() => setActiveColIdx(idx)}
            className="rounded-full transition-all"
            style={{
              width:      idx === activeColIdx ? 20 : 6,
              height:     6,
              background: idx === activeColIdx ? activeCol.color : t.border,
            }}
          />
        ))}
      </div>
    </div>
  );
}
