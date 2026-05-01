import Icon from "@/components/ui/icon";
import type { DemoPipelineCompany } from "./wlTypes";

export function fmt(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function KanbanCard({ c, onSelect, onDragStart, onLpr, dateRange, colWidth }: {
  c: DemoPipelineCompany;
  onSelect: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onLpr: () => void;
  dateRange: [Date, Date] | null;
  colWidth: number;
}) {
  const color  = c.brand_color || "#8b5cf6";
  const domain = c.site_url.replace(/https?:\/\//, "").split("/")[0];
  const now    = new Date();

  let dateColor = "#fbbf24";
  if (c.next_action_date) {
    const d     = new Date(c.next_action_date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tom   = new Date(today); tom.setDate(today.getDate() + 1);
    const dDay  = new Date(d); dDay.setHours(0, 0, 0, 0);
    if (d < now)                                 dateColor = "#ef4444";
    else if (dDay.getTime() === today.getTime()) dateColor = "#f59e0b";
    else if (dDay.getTime() === tom.getTime())   dateColor = "#06b6d4";
  }

  if (dateRange && c.next_action_date) {
    const [start, end] = dateRange;
    const d = new Date(c.next_action_date);
    if (d < start || d > end) return null;
  } else if (dateRange && !c.next_action_date) {
    return null;
  }

  const hasTrial  = c.trial_until && new Date(c.trial_until) > now;
  const hasPaid   = !!c.agent_purchased_at;
  const isOverdue = c.next_action_date && new Date(c.next_action_date) < now;
  const compact   = colWidth < 240;
  const balance   = Number(c.estimates_balance) || 0;
  const used      = Number(c.estimates_used)    || 0;

  const trialDaysLeft = c.trial_until && hasTrial
    ? Math.ceil((new Date(c.trial_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const trialColor = trialDaysLeft <= 3 ? "#ef4444" : trialDaysLeft <= 7 ? "#f59e0b" : "#10b981";

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onSelect}
      className="rounded-xl overflow-hidden cursor-pointer transition hover:brightness-110 active:scale-[0.98]"
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${color}` }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-black overflow-hidden"
            style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
            {c.brand_logo_url
              ? <img src={c.brand_logo_url} className="w-full h-full object-contain" alt="" />
              : c.company_name[0]?.toUpperCase()
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[11px] font-bold text-white/90 truncate leading-tight">{c.company_name}</span>
              {(!c.contact_name || !c.contact_phone || !c.contact_position) && (
                <button onClick={e => { e.stopPropagation(); onLpr(); }}
                  className="flex-shrink-0 transition hover:scale-110"
                  style={{ filter: "drop-shadow(0 0 4px rgba(239,68,68,0.7))" }}
                  title="Не заполнен ЛПР">
                  <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
                    <path d="M6.5 1L12 11H1L6.5 1Z" fill="#ef4444"/>
                    <text x="6.5" y="9.5" textAnchor="middle" fontSize="6" fontWeight="900" fill="white">!</text>
                  </svg>
                </button>
              )}
            </div>
            <div className="text-[9px] text-white/30 truncate">{domain}</div>
          </div>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            {hasPaid && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#10b98120", color: "#10b981" }}>WL</span>}
            {hasTrial && !hasPaid && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#f59e0b20", color: "#f59e0b" }}>Trial</span>}
          </div>
        </div>

        {c.contact_name && (
          <div className="flex items-center gap-1 text-[10px] text-white/50 mb-1">
            <Icon name="User" size={9} className="flex-shrink-0" />
            <span className="truncate font-medium">{c.contact_name}</span>
            {c.contact_position && !compact && <span className="text-white/25 truncate">· {c.contact_position}</span>}
          </div>
        )}
        {c.contact_phone && (
          <div className="flex items-center gap-1 text-[10px] text-white/40 mb-1">
            <Icon name="Phone" size={9} className="flex-shrink-0" />
            <span className="truncate font-mono">{c.contact_phone}</span>
          </div>
        )}
        {c.manager_name && (
          <div className="flex items-center gap-1 text-[10px] text-white/35 mb-1">
            <Icon name="UserCheck" size={9} className="flex-shrink-0" />
            <span className="truncate">{c.manager_name}</span>
          </div>
        )}
        {!compact && (
          <div className="flex items-center gap-2 mt-1.5 mb-1.5 flex-wrap">
            {/* Остаток смет */}
            <div className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md"
              style={{ background: balance > 0 ? "#a78bfa15" : "rgba(255,255,255,0.04)", color: balance > 0 ? "#a78bfa" : "rgba(255,255,255,0.2)" }}>
              <Icon name="Sparkles" size={8} />
              <span className="font-bold">{balance}</span>
              <span className="opacity-60">смет</span>
            </div>
            {/* Счётчик триала */}
            {hasTrial && trialDaysLeft > 0 && (
              <div className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                style={{ background: trialColor + "15", color: trialColor }}>
                <Icon name="Clock" size={8} />
                <span>{trialDaysLeft}д триал</span>
              </div>
            )}
            {/* Оплачен */}
            {hasPaid && (
              <div className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md"
                style={{ background: "#10b98115", color: "#10b981" }}>
                <Icon name="CheckCircle2" size={8} />
                <span className="font-bold">Оплачен</span>
              </div>
            )}
          </div>
        )}
        {colWidth >= 320 && c.created_at && (
          <div className="flex items-center gap-1 text-[9px] text-white/20 mb-1.5">
            <Icon name="Calendar" size={8} /><span>добавлен {fmt(c.created_at)}</span>
          </div>
        )}
        {c.next_action && (
          <div className={`flex items-center gap-1 text-[9px] mt-1.5 px-2 py-1.5 rounded-lg ${isOverdue ? "animate-pulse" : ""}`}
            style={{ background: dateColor + "15", color: dateColor, border: `1px solid ${dateColor}25` }}>
            <Icon name="Target" size={9} className="flex-shrink-0" />
            <span className="truncate flex-1">{c.next_action}</span>
            {c.next_action_date && <span className="ml-auto flex-shrink-0 font-mono opacity-80">{fmt(c.next_action_date)}</span>}
          </div>
        )}
        {c.notes && !c.next_action && (
          <div className="text-[9px] text-white/25 mt-1.5 line-clamp-2 px-1">{c.notes}</div>
        )}
      </div>
      {c.presentation_at && !compact && (
        <div className="px-3 pb-2 flex items-center gap-2">
          {c.presentation_at && (
            <div className="flex items-center gap-1 text-[9px]" style={{ color: "#8b5cf6" }}>
              <Icon name="Presentation" size={8} /><span>{fmt(c.presentation_at)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}