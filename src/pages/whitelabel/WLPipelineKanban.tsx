import { useRef } from "react";
import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";

interface Props {
  companies: DemoPipelineCompany[];
  onSelect:  (c: DemoPipelineCompany) => void;
  onMove:    (demoId: number, status: DemoStatus) => void;
}

function KanbanCard({ c, onSelect, onDragStart }: {
  c: DemoPipelineCompany;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const color  = c.brand_color || "#8b5cf6";
  const domain = c.site_url.replace(/https?:\/\//, "").split("/")[0];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      className="rounded-xl p-3 cursor-pointer transition hover:brightness-110 active:scale-[0.98]"
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${color}` }}
    >
      {/* Шапка карточки */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black overflow-hidden"
          style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
          {c.brand_logo_url
            ? <img src={c.brand_logo_url} className="w-full h-full object-contain" alt="" />
            : c.company_name[0]?.toUpperCase()
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-white/90 truncate">{c.company_name}</div>
          <div className="text-[9px] text-white/30 truncate">{domain}</div>
        </div>
        {c.has_own_agent && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
            style={{ background: "#10b98120", color: "#10b981" }}>WL</span>
        )}
      </div>

      {/* Контакт если есть */}
      {c.contact_name && (
        <div className="flex items-center gap-1 text-[10px] text-white/40 mb-1.5">
          <Icon name="User" size={9} />
          <span className="truncate">{c.contact_name}</span>
          {c.contact_position && <span className="text-white/25">· {c.contact_position}</span>}
        </div>
      )}

      {/* Следующий шаг */}
      {c.next_action && (
        <div className="flex items-center gap-1 text-[9px] mt-1.5 px-2 py-1 rounded-lg"
          style={{ background: "rgba(245,158,11,0.08)", color: "#fbbf24" }}>
          <Icon name="Target" size={9} />
          <span className="truncate">{c.next_action}</span>
          {c.next_action_date && <span className="ml-auto flex-shrink-0 opacity-60">{c.next_action_date}</span>}
        </div>
      )}

      {/* Заметка (первые 60 символов) */}
      {c.notes && !c.next_action && (
        <div className="text-[9px] text-white/25 mt-1.5 line-clamp-2">{c.notes}</div>
      )}
    </div>
  );
}

export function WLPipelineKanban({ companies, onSelect, onMove }: Props) {
  const dragId = useRef<number | null>(null);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = (e: React.DragEvent, status: DemoStatus) => {
    e.preventDefault();
    if (dragId.current !== null) onMove(dragId.current, status);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      {DEMO_STATUSES.map(col => {
        const cards = companies.filter(c => c.status === col.id);
        return (
          <div key={col.id}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, col.id)}
            className="rounded-2xl min-h-[200px] flex flex-col"
            style={{ background: col.bg, border: `1px solid ${col.color}25` }}
          >
            {/* Заголовок колонки */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
              <span className="text-[11px] font-black uppercase tracking-wider flex-1" style={{ color: col.color }}>
                {col.label}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: col.color + "20", color: col.color }}>
                {cards.length}
              </span>
            </div>

            {/* Карточки */}
            <div className="flex-1 px-2 pb-3 space-y-2">
              {cards.map(c => (
                <KanbanCard key={c.demo_id} c={c}
                  onSelect={() => onSelect(c)}
                  onDragStart={e => { dragId.current = c.demo_id; e.dataTransfer.effectAllowed = "move"; }}
                />
              ))}
              {cards.length === 0 && (
                <div className="text-center py-6 text-[10px] text-white/15">
                  Перетащи сюда
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
