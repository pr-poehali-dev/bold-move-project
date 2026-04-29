import { useState, useRef, useCallback } from "react";
import { Client } from "./crmApi";
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
  cols, clientsForCol, onOpen, onNextStep, onDrop, onDragStart, onDragEnd,
}: Props) {
  const t = useTheme();
  const [activeColIdx, setActiveColIdx] = useState(0);

  // ── Modal переноса карточки ──────────────────────────────────────────────
  const [moveTarget, setMoveTarget] = useState<Client | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPress = useCallback((c: Client) => {
    setMoveTarget(c);
    onDragStart(c);
    // лёгкая вибрация
    navigator.vibrate?.(30);
  }, [onDragStart]);

  const handleTouchStart = useCallback((c: Client) => {
    longPressTimer.current = setTimeout(() => handleLongPress(c), 400);
  }, [handleLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleMoveTo = useCallback((colId: string) => {
    onDrop(colId);
    onDragEnd();
    setMoveTarget(null);
    // переходим на целевую колонку
    const idx = cols.findIndex(c => c.id === colId);
    if (idx >= 0) setActiveColIdx(idx);
  }, [onDrop, onDragEnd, cols]);

  const cancelMove = useCallback(() => {
    onDragEnd();
    setMoveTarget(null);
  }, [onDragEnd]);

  // ── Свайп между колонками ────────────────────────────────────────────────
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (moveTarget) return; // не свайпаем если открыт modal
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 50 && dy < 80) {
      if (dx < 0 && activeColIdx < cols.length - 1) setActiveColIdx(i => i + 1);
      if (dx > 0 && activeColIdx > 0)               setActiveColIdx(i => i - 1);
    }
  };

  const activeCol = cols[activeColIdx] ?? cols[0];
  const clients   = activeCol ? clientsForCol(activeCol) : [];

  if (!activeCol) return null;

  return (
    <div className="flex flex-col" style={{ minHeight: 400 }}>

      {/* ── Переключатель колонок (таблетки) ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 px-1" style={{ scrollbarWidth: "none" }}>
        {cols.map((col, idx) => {
          const cnt    = clientsForCol(col).length;
          const active = idx === activeColIdx;
          return (
            <button key={col.id} onClick={() => setActiveColIdx(idx)}
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

      {/* ── Навигация: ‹ Название › ── */}
      <div className="flex items-center justify-between px-1 mb-2">
        <button onClick={() => setActiveColIdx(i => Math.max(0, i - 1))}
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

        <button onClick={() => setActiveColIdx(i => Math.min(cols.length - 1, i + 1))}
          disabled={activeColIdx === cols.length - 1}
          className="p-1.5 rounded-lg transition disabled:opacity-20"
          style={{ color: activeCol.color, background: activeCol.color + "15" }}>
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>

      {/* ── Карточки активной колонки ── */}
      <div className="flex-1 rounded-2xl p-2 space-y-2"
        style={{ background: t.surface2, border: `2px solid ${activeCol.color}30`, minHeight: 320 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}>

        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: t.textMute }}>
            <Icon name="Inbox" size={28} className="opacity-20" />
            <span className="text-sm">Нет карточек</span>
          </div>
        ) : (
          clients.map(c => (
            <div key={c.id}
              onTouchStart={() => handleTouchStart(c)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}>
              <KanbanCard
                client={c}
                color={activeCol.color}
                onOpen={() => onOpen(c)}
                onNextStep={onNextStep}
                isDragging={false}
              />
            </div>
          ))
        )}
      </div>

      {/* ── Подсказка ── */}
      <div className="flex items-center justify-center gap-1 mt-2 text-[10px]" style={{ color: t.textMute }}>
        <Icon name="Hand" size={11} />
        <span>Зажми карточку для переноса в другую колонку</span>
      </div>

      {/* ── Точки-индикаторы ── */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        {cols.map((col, idx) => (
          <button key={col.id} onClick={() => setActiveColIdx(idx)}
            className="rounded-full transition-all duration-300"
            style={{
              width:      idx === activeColIdx ? 20 : 6,
              height:     6,
              background: idx === activeColIdx ? activeCol.color : t.border,
            }} />
        ))}
      </div>

      {/* ── Modal экран переноса карточки ── */}
      {moveTarget && (
        <div className="fixed inset-0 z-[60] flex flex-col"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>

          {/* Шапка */}
          <div className="px-4 pt-8 pb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-bold text-base">Перенести карточку</span>
              <button onClick={cancelMove} className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
                <Icon name="X" size={16} />
              </button>
            </div>
            <div className="text-sm font-semibold px-3 py-2 rounded-xl truncate"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
              {moveTarget.client_name || `Заявка №${moveTarget.id}`}
            </div>
          </div>

          {/* Выбор колонки */}
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>Выберите колонку назначения:</p>
            <div className="flex flex-col gap-3">
              {cols.map(col => {
                const isCurrentCol = clientsForCol(col).some(c => c.id === moveTarget.id);
                return (
                  <button key={col.id}
                    onClick={() => !isCurrentCol && handleMoveTo(col.id)}
                    disabled={isCurrentCol}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl transition active:scale-[0.98] disabled:opacity-40"
                    style={{
                      background: isCurrentCol ? col.color + "15" : col.color + "20",
                      border:     `2px solid ${isCurrentCol ? col.color + "40" : col.color + "70"}`,
                    }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: col.color }}>
                      <Icon name="Layers" size={18} style={{ color: "#fff" }} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-bold" style={{ color: col.color }}>{col.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {clientsForCol(col).length} карточек
                      </div>
                    </div>
                    {isCurrentCol
                      ? <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: col.color + "30", color: col.color }}>Здесь</span>
                      : <Icon name="ArrowRight" size={18} style={{ color: col.color }} />
                    }
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
