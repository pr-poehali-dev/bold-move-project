import { useState, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";
import { KanbanCard } from "./WLKanbanCard";

interface Props {
  filtered:  DemoPipelineCompany[];
  dateRange: [Date, Date] | null;
  onSelect:  (c: DemoPipelineCompany) => void;
  onMove:    (demoId: number, status: DemoStatus) => void;
  onLpr:     (c: DemoPipelineCompany) => void;
}

export function WLKanbanMobile({ filtered, dateRange, onSelect, onMove, onLpr }: Props) {
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [moveTarget, setMoveTarget] = useState<DemoPipelineCompany | null>(null);
  const touchStartX    = useRef(0);
  const touchStartY    = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCol = DEMO_STATUSES[activeIdx];
  const cards     = filtered.filter(c => c.status === activeCol.id);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (moveTarget) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 50 && dy < 80) {
      if (dx < 0 && activeIdx < DEMO_STATUSES.length - 1) setActiveIdx(i => i + 1);
      if (dx > 0 && activeIdx > 0)                        setActiveIdx(i => i - 1);
    }
  };

  const handleLongPress = useCallback((c: DemoPipelineCompany) => {
    setMoveTarget(c);
    navigator.vibrate?.(30);
  }, []);

  const handleCardTouchStart = (c: DemoPipelineCompany) => {
    longPressTimer.current = setTimeout(() => handleLongPress(c), 400);
  };
  const handleCardTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleMoveTo = (status: DemoStatus) => {
    if (!moveTarget) return;
    onMove(moveTarget.demo_id, status);
    const idx = DEMO_STATUSES.findIndex(s => s.id === status);
    if (idx >= 0) setActiveIdx(idx);
    setMoveTarget(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Таблетки переключения колонок */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {DEMO_STATUSES.map((col, idx) => {
          const cnt    = filtered.filter(c => c.status === col.id).length;
          const active = idx === activeIdx;
          return (
            <button key={col.id} onClick={() => setActiveIdx(idx)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition"
              style={{
                background: active ? col.color + "25" : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${active ? col.color + "70" : "rgba(255,255,255,0.08)"}`,
                color: active ? col.color : "rgba(255,255,255,0.3)",
              }}>
              {col.label}
              <span className="font-black px-1.5 py-0.5 rounded-md text-[9px]"
                style={{ background: col.color + "20", color: col.color }}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Навигация ‹ Название › */}
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
          disabled={activeIdx === 0}
          className="p-2 rounded-lg transition disabled:opacity-20"
          style={{ color: activeCol.color, background: activeCol.color + "15" }}>
          <Icon name="ChevronLeft" size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: activeCol.color }} />
          <span className="text-sm font-black uppercase tracking-wider" style={{ color: activeCol.color }}>{activeCol.label}</span>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: activeCol.color + "20", color: activeCol.color }}>{cards.length}</span>
        </div>
        <button onClick={() => setActiveIdx(i => Math.min(DEMO_STATUSES.length - 1, i + 1))}
          disabled={activeIdx === DEMO_STATUSES.length - 1}
          className="p-2 rounded-lg transition disabled:opacity-20"
          style={{ color: activeCol.color, background: activeCol.color + "15" }}>
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>

      {/* Карточки с поддержкой свайпа */}
      <div className="rounded-2xl p-2 space-y-2"
        style={{ background: activeCol.bg, border: `2px solid ${activeCol.color}30`, minHeight: 200 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}>
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            <Icon name="Inbox" size={28} className="opacity-30" />
            <span className="text-sm">Перетащи сюда</span>
          </div>
        ) : (
          cards.map(c => (
            <div key={c.demo_id}
              onTouchStart={() => handleCardTouchStart(c)}
              onTouchEnd={handleCardTouchEnd}
              onTouchMove={handleCardTouchEnd}>
              <KanbanCard c={c} dateRange={dateRange} colWidth={320}
                onSelect={() => onSelect(c)}
                onLpr={() => onLpr(c)}
              />
            </div>
          ))
        )}
      </div>

      {/* Модалка переноса (при долгом нажатии) */}
      {moveTarget && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center sm:justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setMoveTarget(null)}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ background: "#0e0e1a", border: "1px solid rgba(139,92,246,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
            </div>
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <div className="text-xs font-bold text-white/70">Перенести «{moveTarget.company_name}» в:</div>
            </div>
            <div className="p-3 space-y-1.5">
              {DEMO_STATUSES.filter(s => s.id !== moveTarget.status).map(s => (
                <button key={s.id} onClick={() => handleMoveTo(s.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold transition hover:opacity-80"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
            <div className="px-3 pb-3">
              <button onClick={() => setMoveTarget(null)}
                className="w-full py-2.5 rounded-xl text-[11px] font-bold transition"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
