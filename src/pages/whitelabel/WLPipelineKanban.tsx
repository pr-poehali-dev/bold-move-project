import { useRef, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";
import { WLLprModal } from "./WLLprModal";

const LS_WIDTH = "wl_kanban_width";
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 260;

function loadWidth(): number {
  const v = localStorage.getItem(LS_WIDTH);
  return v ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(v))) : DEFAULT_WIDTH;
}

interface Props {
  companies: DemoPipelineCompany[];
  onSelect:  (c: DemoPipelineCompany) => void;
  onMove:    (demoId: number, status: DemoStatus) => void;
  onUpdate?: (demoId: number, patch: Partial<DemoPipelineCompany>) => void;
}

type Range = 1 | 2 | 3 | 7 | 0;

export function getRangeDates(range: number): [Date, Date] | null {
  if (range === 0) return null;
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (range === 2) start.setDate(start.getDate() + 1);
  const end = new Date(start);
  if (range === 1) { /* end = конец сегодня */ }
  else if (range === 2) { /* end = конец завтра */ }
  else { end.setDate(new Date().getDate() + range - 1); }
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function fmt(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function KanbanCard({ c, onSelect, onDragStart, onLpr, dateRange, colWidth }: {
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
    const d    = new Date(c.next_action_date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tom   = new Date(today); tom.setDate(today.getDate() + 1);
    const dDay  = new Date(d); dDay.setHours(0, 0, 0, 0);
    if (d < now)                                dateColor = "#ef4444";
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
          <div className="flex items-center gap-2 mt-1.5 mb-1.5">
            <div className="flex items-center gap-1 text-[9px]" style={{ color: balance > 0 ? "#a78bfa" : "rgba(255,255,255,0.2)" }}>
              <Icon name="Sparkles" size={8} />
              <span className="font-medium">{balance} смет</span>
              {used > 0 && <span className="opacity-50">({used} исп.)</span>}
            </div>
            {c.trial_until && hasTrial && (
              <div className="flex items-center gap-1 text-[9px]" style={{ color: "#f59e0b" }}>
                <Icon name="Clock" size={8} /><span>до {fmt(c.trial_until)}</span>
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
      {(c.presentation_at || c.agent_purchased_at) && !compact && (
        <div className="px-3 pb-2 flex items-center gap-2">
          {c.presentation_at && (
            <div className="flex items-center gap-1 text-[9px]" style={{ color: "#8b5cf6" }}>
              <Icon name="Presentation" size={8} /><span>{fmt(c.presentation_at)}</span>
            </div>
          )}
          {c.agent_purchased_at && (
            <div className="flex items-center gap-1 text-[9px]" style={{ color: "#10b981" }}>
              <Icon name="CheckCircle2" size={8} /><span>оплачен {fmt(c.agent_purchased_at)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Мобильный вид: 1 колонка + свайп ────────────────────────────────────────

function MobileKanban({ filtered, dateRange, onSelect, onMove, onLpr }: {
  filtered: DemoPipelineCompany[];
  dateRange: [Date, Date] | null;
  onSelect: (c: DemoPipelineCompany) => void;
  onMove: (demoId: number, status: DemoStatus) => void;
  onLpr: (c: DemoPipelineCompany) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [moveTarget, setMoveTarget] = useState<DemoPipelineCompany | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCol = DEMO_STATUSES[activeIdx];
  const cards = filtered.filter(c => c.status === activeCol.id);

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
      if (dx > 0 && activeIdx > 0) setActiveIdx(i => i - 1);
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
          const cnt = filtered.filter(c => c.status === col.id).length;
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

// ── Основной компонент ───────────────────────────────────────────────────────

export function WLPipelineKanban({ companies, onSelect, onMove, onUpdate }: Props) {
  const dragId  = useRef<number | null>(null);
  const [range,    setRange]    = useState<Range>(0);
  const [lprFor,   setLprFor]   = useState<DemoPipelineCompany | null>(null);
  const [colWidth, setColWidth] = useState<number>(loadWidth);
  const [search,   setSearch]   = useState("");

  const dateRange = getRangeDates(range);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, status: DemoStatus) => {
    e.preventDefault();
    if (dragId.current !== null) onMove(dragId.current, status);
  };
  const handleWidthChange = (w: number) => {
    setColWidth(w);
    localStorage.setItem(LS_WIDTH, String(w));
  };

  const q = search.toLowerCase().trim();
  const filtered = q
    ? companies.filter(c =>
        c.company_name.toLowerCase().includes(q) ||
        (c.contact_name  || "").toLowerCase().includes(q) ||
        (c.contact_phone || "").includes(q) ||
        c.site_url.toLowerCase().includes(q)
      )
    : companies;

  return (
    <div className="mt-4">
      {/* Панель управления */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        {/* Фильтр по дате */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30 hidden sm:inline">Шаги:</span>
          {([
            { val: 0, label: "Все" },
            { val: 1, label: "Сег" },
            { val: 2, label: "Зав" },
            { val: 3, label: "3д"  },
            { val: 7, label: "7д"  },
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

        {/* Слайдер ширины — только на десктопе */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon name="Columns" size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          <span className="text-[10px] text-white/30">Ширина</span>
          <input type="range" min={MIN_WIDTH} max={MAX_WIDTH} step={10} value={colWidth}
            onChange={e => handleWidthChange(Number(e.target.value))}
            className="w-24 accent-violet-500 cursor-pointer" style={{ height: 3 }} />
          <span className="text-[10px] font-mono w-9 text-right text-white/30">{colWidth}px</span>
        </div>

        {/* Поиск */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Icon name="Search" size={12} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "rgba(255,255,255,0.25)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full rounded-xl pl-8 pr-3 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-violet-500/30"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }} />
        </div>

        <span className="text-[10px] text-white/25 ml-auto">{filtered.length}</span>
      </div>

      {/* Мобильный вид */}
      <div className="sm:hidden">
        <MobileKanban
          filtered={filtered}
          dateRange={dateRange}
          onSelect={onSelect}
          onMove={onMove}
          onLpr={c => setLprFor(c)}
        />
      </div>

      {/* Десктоп: горизонтальный скролл */}
      <div className="hidden sm:flex gap-3 overflow-x-auto pb-4" style={{ alignItems: "flex-start" }}>
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
              <div className="flex-1 px-2 pb-3 space-y-2">
                {allCards.length === 0 ? (
                  <div className="text-[10px] text-white/15 text-center py-6 px-2">Перетащи сюда</div>
                ) : (
                  allCards.map(c => (
                    <KanbanCard key={c.demo_id} c={c}
                      dateRange={dateRange}
                      colWidth={colWidth}
                      onSelect={() => onSelect(c)}
                      onLpr={() => setLprFor(c)}
                      onDragStart={e => { dragId.current = c.demo_id; e.dataTransfer.effectAllowed = "move"; }}
                    />
                  ))
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