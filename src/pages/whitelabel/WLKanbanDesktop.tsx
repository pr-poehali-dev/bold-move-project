import { useRef } from "react";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";
import { KanbanCard } from "./WLKanbanCard";

interface Props {
  filtered:   DemoPipelineCompany[];
  dateRange:  [Date, Date] | null;
  colWidth:   number;
  onSelect:   (c: DemoPipelineCompany) => void;
  onMove:     (demoId: number, status: DemoStatus) => void;
  onLpr:      (c: DemoPipelineCompany) => void;
}

export function WLKanbanDesktop({ filtered, dateRange, colWidth, onSelect, onMove, onLpr }: Props) {
  const dragId = useRef<number | null>(null);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, status: DemoStatus) => {
    e.preventDefault();
    if (dragId.current !== null) onMove(dragId.current, status);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ alignItems: "flex-start" }}>
      {DEMO_STATUSES.map(col => {
        const allCards = filtered.filter(c => c.status === col.id);
        const visibleCount = dateRange
          ? allCards.filter(c => {
              if (!c.next_action_date) return false;
              const d = new Date(c.next_action_date);
              return d >= dateRange[0] && d <= dateRange[1];
            }).length
          : allCards.length;

        return (
          <div key={col.id}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, col.id)}
            className="rounded-2xl flex-shrink-0 flex flex-col"
            style={{ width: colWidth, background: col.bg, border: `1px solid ${col.color}25`, minHeight: 120 }}
          >
            {/* Заголовок колонки */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
              <span className="text-[11px] font-black uppercase tracking-wider flex-1 truncate" style={{ color: col.color }}>
                {col.label}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: col.color + "20", color: col.color }}>
                {visibleCount}
              </span>
            </div>
            {/* Карточки */}
            <div className="flex-1 px-2 pb-3 space-y-2">
              {allCards.length === 0 ? (
                <div className="text-[10px] text-white/15 text-center py-6 px-2">Перетащи сюда</div>
              ) : (
                allCards.map(c => (
                  <KanbanCard key={c.demo_id} c={c}
                    dateRange={dateRange}
                    colWidth={colWidth}
                    onSelect={() => onSelect(c)}
                    onLpr={() => onLpr(c)}
                    onDragStart={e => { dragId.current = c.demo_id; e.dataTransfer.effectAllowed = "move"; }}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}