import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";
import { WLLprModal } from "./WLLprModal";

interface Props {
  companies: DemoPipelineCompany[];
  onSelect:  (c: DemoPipelineCompany) => void;
  onMove:    (demoId: number, status: DemoStatus) => void;
}

type Range = 1 | 2 | 3 | 7 | 0; // 0 = все

/** Возвращает [startDate, endDate] для диапазона. range=0 → без ограничений (null) */
export function getRangeDates(range: number): [Date, Date] | null {
  if (range === 0) return null;
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  // range=2 (Завтра) → начало завтра
  if (range === 2) start.setDate(start.getDate() + 1);
  const end = new Date(start);
  // range=1 → конец сегодня, range=2 → конец завтра, range=3/7 → +N-1 дней от сегодня
  if (range === 1) { /* end = конец сегодня */ }
  else if (range === 2) { /* end = конец завтра */ }
  else { end.setDate(new Date().getDate() + range - 1); }
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function KanbanCard({ c, onSelect, onDragStart, onLpr, dateRange }: {
  c: DemoPipelineCompany;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onLpr: () => void;
  dateRange: [Date, Date] | null;
}) {
  const color  = c.brand_color || "#8b5cf6";
  const domain = c.site_url.replace(/https?:\/\//, "").split("/")[0];

  // Подсветка даты в карточке
  const now = new Date();
  let dateColor = "#fbbf24";
  if (c.next_action_date) {
    const d = new Date(c.next_action_date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tom = new Date(today); tom.setDate(today.getDate() + 1);
    const dDay = new Date(d); dDay.setHours(0, 0, 0, 0);
    if (d < now) dateColor = "#ef4444";
    else if (dDay.getTime() === today.getTime()) dateColor = "#f59e0b";
    else if (dDay.getTime() === tom.getTime()) dateColor = "#06b6d4";
  }

  // Фильтр: если задан диапазон и у карточки нет даты или дата вне диапазона — не показываем
  if (dateRange && c.next_action_date) {
    const [start, end] = dateRange;
    const d = new Date(c.next_action_date);
    if (d < start || d > end) return null;
  } else if (dateRange && !c.next_action_date) {
    return null;
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      className="rounded-xl p-3 cursor-pointer transition hover:brightness-110 active:scale-[0.98]"
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black overflow-hidden"
          style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
          {c.brand_logo_url
            ? <img src={c.brand_logo_url} className="w-full h-full object-contain" alt="" />
            : c.company_name[0]?.toUpperCase()
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-white/90 truncate">{c.company_name}</span>
            {!c.contact_name && !c.contact_phone && (
              <button
                onClick={e => { e.stopPropagation(); onLpr(); }}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition hover:scale-110"
                style={{ background: "#ef4444", boxShadow: "0 0 5px rgba(239,68,68,0.6)" }}
                title="Не заполнен ЛПР">
                <span className="text-[8px] font-black text-white leading-none">!</span>
              </button>
            )}
          </div>
          <div className="text-[9px] text-white/30 truncate">{domain}</div>
        </div>
        {c.has_own_agent && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
            style={{ background: "#10b98120", color: "#10b981" }}>WL</span>
        )}
      </div>

      {c.contact_name && (
        <div className="flex items-center gap-1 text-[10px] text-white/40 mb-1.5">
          <Icon name="User" size={9} />
          <span className="truncate">{c.contact_name}</span>
          {c.contact_position && <span className="text-white/25">· {c.contact_position}</span>}
        </div>
      )}

      {c.next_action && (
        <div className="flex items-center gap-1 text-[9px] mt-1.5 px-2 py-1 rounded-lg"
          style={{ background: dateColor + "15", color: dateColor }}>
          <Icon name="Target" size={9} />
          <span className="truncate">{c.next_action}</span>
          {c.next_action_date && <span className="ml-auto flex-shrink-0 opacity-70">{c.next_action_date}</span>}
        </div>
      )}

      {c.notes && !c.next_action && (
        <div className="text-[9px] text-white/25 mt-1.5 line-clamp-2">{c.notes}</div>
      )}
    </div>
  );
}

export function WLPipelineKanban({ companies, onSelect, onMove, onUpdate }: Props & { onUpdate?: (demoId: number, patch: Partial<DemoPipelineCompany>) => void }) {
  const dragId = useRef<number | null>(null);
  const [range,  setRange]  = useState<Range>(0);
  const [lprFor, setLprFor] = useState<DemoPipelineCompany | null>(null);

  const dateRange = getRangeDates(range);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, status: DemoStatus) => {
    e.preventDefault();
    if (dragId.current !== null) onMove(dragId.current, status);
  };

  return (
    <div className="mt-4">
      {/* Фильтр по дате */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[10px] text-white/30 mr-1">Шаги:</span>
        {([
          { val: 0, label: "Все"  },
          { val: 1, label: "Сег"  },
          { val: 2, label: "Зав"  },
          { val: 3, label: "3д"   },
          { val: 7, label: "7д"   },
        ] as { val: Range; label: string }[]).map(({ val, label }) => (
          <button key={val} onClick={() => setRange(val)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
            style={{
              background: range === val ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)",
              color:      range === val ? "#a78bfa" : "rgba(255,255,255,0.3)",
              border:     `1px solid ${range === val ? "rgba(139,92,246,0.4)" : "transparent"}`,
            }}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {DEMO_STATUSES.map(col => {
          const allCards = companies.filter(c => c.status === col.id);
          // Считаем видимые с учётом фильтра
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
              className="rounded-2xl min-h-[200px] flex flex-col"
              style={{ background: col.bg, border: `1px solid ${col.color}25` }}
            >
              <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                <span className="text-[11px] font-black uppercase tracking-wider flex-1" style={{ color: col.color }}>
                  {col.label}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: col.color + "20", color: col.color }}>
                  {visibleCount}
                </span>
              </div>

              <div className="flex-1 px-2 pb-3 space-y-2">
                {allCards.map(c => (
                  <KanbanCard key={c.demo_id} c={c}
                    dateRange={dateRange}
                    onSelect={() => onSelect(c)}
                    onLpr={() => setLprFor(c)}
                    onDragStart={e => { dragId.current = c.demo_id; e.dataTransfer.effectAllowed = "move"; }}
                  />
                ))}
                {visibleCount === 0 && (
                  <div className="text-center py-6 text-[10px] text-white/15">
                    {dateRange ? "Нет шагов в этот период" : "Перетащи сюда"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lprFor && (
        <WLLprModal
          company={lprFor}
          onSuccess={patch => {
            onUpdate?.(lprFor.demo_id, patch);
            setLprFor(null);
          }}
          onClose={() => setLprFor(null)}
        />
      )}
    </div>
  );
}