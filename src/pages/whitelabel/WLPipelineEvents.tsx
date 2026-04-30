import { useState } from "react";
import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany } from "./wlTypes";

interface Props {
  companies: DemoPipelineCompany[];
  onSelect:  (c: DemoPipelineCompany) => void;
}

type Range = 1 | 2 | 3 | 7;

function fmtDate(iso: string): { label: string; isToday: boolean; isOverdue: boolean } {
  const d   = new Date(iso);
  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tom   = new Date(today); tom.setDate(today.getDate() + 1);
  const dd    = new Date(d); dd.setHours(0, 0, 0, 0);
  const isOverdue = d < now;
  const isToday   = dd.getTime() === today.getTime();
  let label = "";
  if (isOverdue) {
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    label = diff === 0 ? "Сегодня (просрочено)" : diff === 1 ? "Вчера" : `${diff} дн. назад`;
  } else if (isToday) {
    label = "Сегодня";
  } else if (dd.getTime() === tom.getTime()) {
    label = "Завтра";
  } else {
    label = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }
  return { label, isToday, isOverdue };
}

export function WLPipelineEvents({ companies, onSelect }: Props) {
  const [range,     setRange]     = useState<Range>(7);
  const [collapsed, setCollapsed] = useState(true);

  const now     = new Date();
  const endDate = new Date(now);
  endDate.setDate(now.getDate() + range);
  endDate.setHours(23, 59, 59, 999);

  // Компании с next_action_date в диапазоне (не в отказе)
  const upcoming = companies
    .filter(c => c.next_action_date && c.status !== "rejected")
    .filter(c => {
      const d = new Date(c.next_action_date);
      return d <= endDate;
    })
    .sort((a, b) => new Date(a.next_action_date).getTime() - new Date(b.next_action_date).getTime());

  // Просроченные (дата прошла, не отказ)
  const overdue = upcoming.filter(c => new Date(c.next_action_date) < now);
  const future  = upcoming.filter(c => new Date(c.next_action_date) >= now);

  const total = upcoming.length;

  // Нет действий 7+ дней: статус не rejected, и либо дата не заполнена,
  // либо дата прошла 7+ дней назад
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const noAction = companies.filter(c => {
    if (c.status === "rejected") return false;
    if (!c.next_action_date) return true;
    return new Date(c.next_action_date) < sevenDaysAgo;
  });

  return (
    <div className="space-y-2">

    {/* ── Нет действий 7+ дней ─────────────────────────────────────────────── */}
    {noAction.length > 0 && (
      <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.22)" }}>
        <div className="flex items-center gap-2 mb-2.5">
          <Icon name="AlertTriangle" size={13} style={{ color: "#f59e0b" }} />
          <span className="text-[11px] font-bold" style={{ color: "#f59e0b" }}>Нет действий 7+ дней</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
            {noAction.length}
          </span>
          <span className="text-[10px] text-white/30 ml-1">— запланируй следующий шаг</span>
        </div>
        <div className="space-y-1.5">
          {noAction.map(c => {
            const color  = c.brand_color || "#8b5cf6";
            const domain = c.site_url.replace(/https?:\/\//, "").split("/")[0];
            const st     = DEMO_STATUSES.find(s => s.id === c.status) || DEMO_STATUSES[0];
            const daysIdle = c.next_action_date
              ? Math.floor((now.getTime() - new Date(c.next_action_date).getTime()) / 86400000)
              : null;
            return (
              <div key={c.demo_id} onClick={() => onSelect(c)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition hover:bg-white/[0.03]"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.12)", borderLeft: `3px solid ${color}` }}>
                <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black overflow-hidden"
                  style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
                  {c.brand_logo_url
                    ? <img src={c.brand_logo_url} className="w-full h-full object-contain" alt="" />
                    : c.company_name[0]?.toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-white/80 truncate">{c.company_name}</div>
                  <div className="text-[9px] text-white/30">{domain}</div>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: st.bg, color: st.color }}>{st.label}</span>
                <span className="text-[9px] text-white/25 flex-shrink-0">
                  {daysIdle !== null ? `${daysIdle} дн. без обновления` : "Шаг не задан"}
                </span>
                <Icon name="ChevronRight" size={11} style={{ color: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* ── Ближайшие шаги ───────────────────────────────────────────────────── */}
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>

      {/* Шапка */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition"
        onClick={() => setCollapsed(v => !v)}
      >
        <Icon name="CalendarClock" size={14} style={{ color: "#a78bfa", flexShrink: 0 }} />
        <span className="text-sm font-bold text-white/80 flex-1">Ближайшие шаги</span>

        {/* Счётчик */}
        {total > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: overdue.length > 0 ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.15)",
                     color: overdue.length > 0 ? "#ef4444" : "#a78bfa" }}>
            {total}
          </span>
        )}
        {overdue.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
            {overdue.length} просрочено
          </span>
        )}

        {/* Фильтр диапазона */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          onClick={e => e.stopPropagation()}>
          {([
            { val: 1, label: "Сег" },
            { val: 2, label: "Зав" },
            { val: 3, label: "3д"  },
            { val: 7, label: "7д"  },
          ] as { val: Range; label: string }[]).map(({ val, label }) => (
            <button key={val}
              onClick={e => { e.stopPropagation(); setRange(val); if (collapsed) setCollapsed(false); }}
              className="rounded-lg text-[10px] font-bold transition px-2 py-1"
              style={range === val
                ? { background: "#7c3aed", color: "#fff" }
                : { color: "rgba(255,255,255,0.3)", background: "transparent" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ transform: collapsed ? "none" : "rotate(180deg)", transition: "transform 0.2s" }}>
          <Icon name="ChevronDown" size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
        </div>
      </div>

      {/* Контент */}
      {!collapsed && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.05] space-y-2">
          {total === 0 ? (
            <div className="text-center py-5 text-white/20 text-xs">
              Нет запланированных шагов в этом диапазоне
            </div>
          ) : (
            <>
              {/* Просроченные */}
              {overdue.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  <div className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 mb-1"
                    style={{ color: "#ef4444" }}>
                    <Icon name="AlertTriangle" size={10} /> Просрочено ({overdue.length})
                  </div>
                  {overdue.map(c => <EventRow key={c.demo_id} c={c} onSelect={onSelect} />)}
                </div>
              )}

              {/* Предстоящие */}
              {future.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {overdue.length > 0 && (
                    <div className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 mb-1"
                      style={{ color: "#a78bfa" }}>
                      <Icon name="CalendarCheck" size={10} /> Предстоящие ({future.length})
                    </div>
                  )}
                  {future.map(c => <EventRow key={c.demo_id} c={c} onSelect={onSelect} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

function EventRow({ c, onSelect }: { c: DemoPipelineCompany; onSelect: (c: DemoPipelineCompany) => void }) {
  const color   = c.brand_color || "#8b5cf6";
  const domain  = c.site_url.replace(/https?:\/\//, "").split("/")[0];
  const st      = DEMO_STATUSES.find(s => s.id === c.status) || DEMO_STATUSES[0];
  const { label, isToday, isOverdue } = fmtDate(c.next_action_date);

  return (
    <div
      onClick={() => onSelect(c)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition hover:brightness-110"
      style={{
        background: isOverdue ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isOverdue ? "rgba(239,68,68,0.20)" : "rgba(255,255,255,0.06)"}`,
        borderLeft: `3px solid ${isOverdue ? "#ef4444" : isToday ? "#f59e0b" : color}`,
      }}
    >
      {/* Аватар */}
      <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black overflow-hidden"
        style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
        {c.brand_logo_url
          ? <img src={c.brand_logo_url} className="w-full h-full object-contain" alt="" />
          : c.company_name[0]?.toUpperCase()
        }
      </div>

      {/* Инфо */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-white/90 truncate">{c.company_name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
            style={{ background: st.bg, color: st.color }}>{st.label}</span>
        </div>
        <div className="text-[10px] text-white/35 truncate">{domain}</div>
        {c.next_action && (
          <div className="flex items-center gap-1 text-[10px] mt-0.5"
            style={{ color: isOverdue ? "#ef4444" : "#fbbf24" }}>
            <Icon name="Target" size={9} />
            <span className="truncate">{c.next_action}</span>
          </div>
        )}
      </div>

      {/* Дата */}
      <div className="text-right flex-shrink-0">
        <div className="text-[10px] font-bold"
          style={{ color: isOverdue ? "#ef4444" : isToday ? "#f59e0b" : "rgba(255,255,255,0.5)" }}>
          {label}
        </div>
        {c.contact_name && (
          <div className="text-[9px] text-white/25 mt-0.5">{c.contact_name}</div>
        )}
      </div>

      <Icon name="ChevronRight" size={12} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
    </div>
  );
}