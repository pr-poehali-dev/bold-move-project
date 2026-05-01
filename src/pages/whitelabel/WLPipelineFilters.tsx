import Icon from "@/components/ui/icon";
import { useState } from "react";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoStatus } from "./wlTypes";

export type DemoFilter  = "all" | "active" | "expiring" | "expired";
export type EstFilter   = "all" | "redflag" | "used" | "bought";
export type AgentFilter = "all" | "demo" | "bought" | "none";

interface Props {
  companies:      { status: DemoStatus }[];
  filterStatus:   DemoStatus | "all";
  onFilterChange: (s: DemoStatus | "all") => void;
  demoFilter:     DemoFilter;
  estFilter:      EstFilter;
  agentFilter:    AgentFilter;
  onDemoFilter:   (v: DemoFilter) => void;
  onEstFilter:    (v: EstFilter) => void;
  onAgentFilter:  (v: AgentFilter) => void;
  search:         string;
  onSearch:       (v: string) => void;
}

export function WLPipelineFilters({
  companies, filterStatus, onFilterChange,
  demoFilter, estFilter, agentFilter,
  onDemoFilter, onEstFilter, onAgentFilter,
  search, onSearch,
}: Props) {
  const [filtersOpen,  setFiltersOpen]  = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);

  return (
    <>
      {/* Поиск — сворачиваемый */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.02]"
          onClick={() => setSearchOpen(v => !v)}>
          <Icon name="Search" size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex-1">Поиск</span>
          {!searchOpen && search && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full truncate max-w-[120px]"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa" }}>
              {search}
            </span>
          )}
          <Icon name={searchOpen ? "ChevronUp" : "ChevronDown"} size={12} style={{ color: "rgba(255,255,255,0.2)" }} />
        </button>
        {searchOpen && (
          <div className="px-3 pb-3 border-t border-white/[0.05]" style={{ paddingTop: 10 }}>
            <div className="relative">
              <Icon name="Search" size={12} style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                color: "rgba(255,255,255,0.25)", pointerEvents: "none",
              }} />
              <input
                autoFocus
                value={search}
                onChange={e => onSearch(e.target.value)}
                placeholder="Название компании или сайт..."
                className="w-full rounded-lg text-xs text-white/80 placeholder-white/20 outline-none transition"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  padding: "7px 10px 7px 30px",
                }}
              />
              {search && (
                <button onClick={() => onSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 transition hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.3)" }}>
                  <Icon name="X" size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Доп-фильтры — сворачиваемый блок */}
      <div className="rounded-xl overflow-hidden transition-all"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.02]"
          onClick={() => setFiltersOpen(v => !v)}>
          <Icon name="SlidersHorizontal" size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex-1">Фильтры</span>
          {!filtersOpen && (demoFilter !== "all" || estFilter !== "all" || agentFilter !== "all") && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa" }}>
              активны
            </span>
          )}
          <Icon name={filtersOpen ? "ChevronUp" : "ChevronDown"} size={12} style={{ color: "rgba(255,255,255,0.2)" }} />
        </button>

        {filtersOpen && (
          <div className="px-3 pb-3 flex flex-wrap gap-2 items-center border-t border-white/[0.05]" style={{ paddingTop: 10 }}>
            {/* Демо */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-white/25 uppercase tracking-wider">Демо:</span>
              {([
                { id: "all",      label: "Все"     },
                { id: "active",   label: "Идёт",   color: "#06b6d4" },
                { id: "expiring", label: "≤3 дн.", color: "#f59e0b" },
                { id: "expired",  label: "Истёк",  color: "#ef4444" },
              ] as { id: DemoFilter; label: string; color?: string }[]).map(f => {
                const active = demoFilter === f.id;
                return (
                  <button key={f.id} onClick={() => onDemoFilter(f.id)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold transition"
                    style={{
                      background: active ? (f.color ? f.color + "20" : "rgba(255,255,255,0.12)") : "rgba(255,255,255,0.04)",
                      color:      active ? (f.color || "rgba(255,255,255,0.9)") : "rgba(255,255,255,0.3)",
                      border:     `1px solid ${active ? (f.color ? f.color + "50" : "rgba(255,255,255,0.25)") : "transparent"}`,
                    }}>
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="w-px h-4 bg-white/[0.08]" />

            {/* Сметы */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-white/25 uppercase tracking-wider">Сметы:</span>
              {([
                { id: "all",     label: "Все"        },
                { id: "redflag", label: "🚩 0 исп.", color: "#ef4444" },
                { id: "used",    label: "Используют", color: "#10b981" },
                { id: "bought",  label: "Купили ещё", color: "#a78bfa" },
              ] as { id: EstFilter; label: string; color?: string }[]).map(f => {
                const active = estFilter === f.id;
                return (
                  <button key={f.id} onClick={() => onEstFilter(f.id)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold transition"
                    style={{
                      background: active ? (f.color ? f.color + "20" : "rgba(255,255,255,0.12)") : "rgba(255,255,255,0.04)",
                      color:      active ? (f.color || "rgba(255,255,255,0.9)") : "rgba(255,255,255,0.3)",
                      border:     `1px solid ${active ? (f.color ? f.color + "50" : "rgba(255,255,255,0.25)") : "transparent"}`,
                    }}>
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="w-px h-4 bg-white/[0.08]" />

            {/* Агент */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-white/25 uppercase tracking-wider">Агент:</span>
              {([
                { id: "all",    label: "Все"       },
                { id: "demo",   label: "На демо",  color: "#06b6d4" },
                { id: "bought", label: "Куплен",   color: "#10b981" },
              ] as { id: AgentFilter; label: string; color?: string }[]).map(f => {
                const active = agentFilter === f.id;
                return (
                  <button key={f.id} onClick={() => onAgentFilter(f.id)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold transition"
                    style={{
                      background: active ? (f.color ? f.color + "20" : "rgba(255,255,255,0.12)") : "rgba(255,255,255,0.04)",
                      color:      active ? (f.color || "rgba(255,255,255,0.9)") : "rgba(255,255,255,0.3)",
                      border:     `1px solid ${active ? (f.color ? f.color + "50" : "rgba(255,255,255,0.25)") : "transparent"}`,
                    }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Фильтр по статусу — скролл на мобиле, stretch на десктопе */}
      <div className="rounded-xl px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Мобиле: горизонтальный скролл */}
        <div className="flex sm:hidden gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide -mx-1 px-1">
          {[{ id: "all" as const, label: "Все", color: "rgba(255,255,255,0.9)", bg: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.25)" }, ...DEMO_STATUSES.map(s => ({ ...s, border: s.color + "50" }))].map(s => {
            const count = s.id === "all" ? companies.length : companies.filter(c => c.status === s.id).length;
            const active = filterStatus === s.id;
            return (
              <button key={s.id} onClick={() => onFilterChange(s.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition whitespace-nowrap flex items-center gap-1"
                style={{
                  background: active ? s.bg : "rgba(255,255,255,0.04)",
                  color:      active ? s.color : "rgba(255,255,255,0.3)",
                  border:     `1px solid ${active ? s.border : "transparent"}`,
                }}>
                {s.label}
                {count > 0 && (
                  <span className="text-[9px] font-black px-1 py-0.5 rounded"
                    style={{ background: (active ? s.color : "rgba(255,255,255,0.15)") + "40", color: active ? s.color : "rgba(255,255,255,0.5)" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Десктоп: flex-1 равные кнопки */}
        <div className="hidden sm:flex gap-1.5">
          <button onClick={() => onFilterChange("all")}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition text-center whitespace-nowrap flex items-center justify-center gap-1"
            style={{
              background: filterStatus === "all" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
              color:      filterStatus === "all" ? "rgba(255,255,255,0.9)"  : "rgba(255,255,255,0.3)",
              border:     `1px solid ${filterStatus === "all" ? "rgba(255,255,255,0.25)" : "transparent"}`,
            }}>
            Все
            <span className="text-[9px] font-black px-1 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
              {companies.length}
            </span>
          </button>
          {DEMO_STATUSES.map(s => {
            const count  = companies.filter(c => c.status === s.id).length;
            const active = filterStatus === s.id;
            return (
              <button key={s.id} onClick={() => onFilterChange(s.id)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition text-center whitespace-nowrap flex items-center justify-center gap-1"
                style={{
                  background: active ? s.bg : "rgba(255,255,255,0.04)",
                  color:      active ? s.color : "rgba(255,255,255,0.3)",
                  border:     `1px solid ${active ? s.color + "50" : "transparent"}`,
                }}>
                {s.label}
                {count > 0 && (
                  <span className="text-[9px] font-black px-1 py-0.5 rounded"
                    style={{ background: s.color + "25", color: s.color }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}