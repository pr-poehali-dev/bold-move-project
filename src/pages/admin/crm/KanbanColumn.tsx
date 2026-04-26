import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import KanbanCard from "./KanbanCard";
import { ColId } from "./kanbanTypes";

interface KanbanColumnProps {
  col: { id: ColId; label: string; color: string; statuses: readonly string[] };
  label: string;
  colClients: Client[];
  width: number;
  isLast: boolean;
  isOver: boolean;
  dragging: Client | null;
  onDragStart: (c: Client) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, colId: ColId) => void;
  onDragLeave: () => void;
  onDrop: (colId: ColId) => void;
  onOpen: (c: Client) => void;
  onNextStep: (id: number, next: string) => void;
  onStartResize: (e: React.MouseEvent, colId: string) => void;
  resizeBorderColor: string;
}

export function KanbanColumn({
  col, label, colClients, width, isLast, isOver,
  dragging, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  onOpen, onNextStep, onStartResize, resizeBorderColor,
}: KanbanColumnProps) {
  const t = useTheme();
  const revenue = colClients.reduce((s, c) => s + (Number(c.contract_sum) || 0), 0);

  return (
    <div className="flex flex-shrink-0" style={{ width }}>
      <div
        className="flex flex-col rounded-2xl transition-all"
        style={{ width: "100%", margin: "0 6px" }}
        onDragOver={e => onDragOver(e, col.id)}
        onDragLeave={onDragLeave}
        onDrop={() => onDrop(col.id)}>

        {/* Заголовок */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-t-2xl"
          style={{ background: col.color + "18", borderBottom: `2px solid ${col.color}` }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
            <span className="text-xs font-bold truncate" style={{ color: t.text }}>{label}</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: col.color + "25", color: col.color }}>{colClients.length}</span>
          </div>
          {revenue > 0 && width > 180 && (
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
              onDragEnd={onDragEnd}>
              <KanbanCard
                client={c}
                dragging={dragging?.id === c.id}
                onOpen={() => onOpen(c)}
                onNextStep={onNextStep}
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

      {/* Ручка resize */}
      {!isLast && (
        <div
          className="flex-shrink-0 flex items-center justify-center group"
          style={{ width: 8, cursor: "col-resize", zIndex: 10 }}
          onMouseDown={e => onStartResize(e, col.id)}>
          <div
            className="rounded-full transition-all group-hover:opacity-100 opacity-0"
            style={{ width: 3, height: 40, background: resizeBorderColor, transition: "opacity 0.15s, background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#7c3aed")}
            onMouseLeave={e => (e.currentTarget.style.background = resizeBorderColor)}
          />
        </div>
      )}
    </div>
  );
}