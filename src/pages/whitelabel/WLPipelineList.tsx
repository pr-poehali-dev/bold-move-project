import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";

interface Props {
  companies:     DemoPipelineCompany[];
  filterStatus:  DemoStatus | "all";
  onFilterChange:(s: DemoStatus | "all") => void;
  onSelect:      (c: DemoPipelineCompany) => void;
}

export function WLPipelineList({ companies, filterStatus, onFilterChange, onSelect }: Props) {
  const filtered = filterStatus === "all"
    ? companies
    : companies.filter(c => c.status === filterStatus);

  return (
    <div className="mt-4 space-y-3">
      {/* Фильтр по статусу */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => onFilterChange("all")}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition"
          style={{
            background: filterStatus === "all" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
            color:      filterStatus === "all" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
            border:     `1px solid ${filterStatus === "all" ? "rgba(255,255,255,0.25)" : "transparent"}`,
          }}>
          Все ({companies.length})
        </button>
        {DEMO_STATUSES.map(s => {
          const count = companies.filter(c => c.status === s.id).length;
          const active = filterStatus === s.id;
          return (
            <button key={s.id} onClick={() => onFilterChange(s.id)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition"
              style={{
                background: active ? s.bg : "rgba(255,255,255,0.04)",
                color:      active ? s.color : "rgba(255,255,255,0.3)",
                border:     `1px solid ${active ? s.color + "50" : "transparent"}`,
              }}>
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Список */}
      <div className="space-y-1.5">
        {filtered.map(c => {
          const color  = c.brand_color || "#8b5cf6";
          const domain = c.site_url.replace(/https?:\/\//, "").split("/")[0];
          const st     = DEMO_STATUSES.find(s => s.id === c.status) || DEMO_STATUSES[0];

          return (
            <div key={c.demo_id}
              onClick={() => onSelect(c)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition hover:brightness-110"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.06)`, borderLeft: `3px solid ${color}` }}
            >
              {/* Аватар */}
              <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black overflow-hidden"
                style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
                {c.brand_logo_url
                  ? <img src={c.brand_logo_url} className="w-full h-full object-contain" alt="" />
                  : c.company_name[0]?.toUpperCase()
                }
              </div>

              {/* Основная инфо */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/90 truncate">{c.company_name}</span>
                  {c.has_own_agent && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                      style={{ background: "#10b98120", color: "#10b981" }}>WL</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/30">
                  <span>{domain}</span>
                  {c.contact_name && <><span>·</span><Icon name="User" size={9} /><span>{c.contact_name}</span></>}
                </div>
                {c.next_action && (
                  <div className="text-[9px] mt-0.5 flex items-center gap-1" style={{ color: "#fbbf24" }}>
                    <Icon name="Target" size={9} /> {c.next_action}
                    {c.next_action_date && <span className="opacity-60">— {c.next_action_date}</span>}
                  </div>
                )}
              </div>

              {/* Статус бейдж */}
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
                style={{ background: st.bg, color: st.color }}>
                {st.label}
              </span>

              <Icon name="ChevronRight" size={13} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-white/20 text-sm">
            Нет компаний в этом статусе
          </div>
        )}
      </div>
    </div>
  );
}
