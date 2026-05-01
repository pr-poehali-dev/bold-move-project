import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";
import { DEMO_STATUSES } from "./wlTypes";
import { WLLprModal } from "./WLLprModal";
import { WLKanbanMobile } from "./WLKanbanMobile";
import { WLKanbanDesktop } from "./WLKanbanDesktop";

const LS_WIDTH    = "wl_kanban_width";
const MIN_WIDTH   = 200;
const MAX_WIDTH   = 480;
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

export function WLPipelineKanban({ companies, onSelect, onMove, onUpdate }: Props) {
  const [range,    setRange]    = useState<Range>(0);
  const [lprFor,   setLprFor]   = useState<DemoPipelineCompany | null>(null);
  const [colWidth, setColWidth] = useState<number>(loadWidth);
  const [search,   setSearch]   = useState("");
  const [useMobile, setUseMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Динамически переключаем вид по реальной ширине контейнера
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      const gap = 12; // gap-3
      const needed = DEMO_STATUSES.length * (colWidth + gap);
      setUseMobile(el.offsetWidth < needed);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [colWidth]);

  const dateRange = getRangeDates(range);

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
    <div className="mt-4" ref={containerRef}>
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

        {/* Слайдер ширины — только когда показан десктопный вид */}
        <div className={`${useMobile ? "hidden" : "flex"} items-center gap-2 px-3 py-1.5 rounded-xl`}
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

      {/* Переключаем вид по реальной ширине контейнера */}
      {useMobile ? (
        <WLKanbanMobile
          filtered={filtered}
          dateRange={dateRange}
          onSelect={onSelect}
          onMove={onMove}
          onLpr={c => setLprFor(c)}
        />
      ) : (
        <WLKanbanDesktop
          filtered={filtered}
          dateRange={dateRange}
          colWidth={colWidth}
          onSelect={onSelect}
          onMove={onMove}
          onLpr={c => setLprFor(c)}
        />
      )}

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