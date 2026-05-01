import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL, DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus, PanelView } from "./wlTypes";

interface Props {
  companies:      DemoPipelineCompany[];
  filterStatus:   DemoStatus | "all";
  onFilterChange: (s: DemoStatus | "all") => void;
  onSelect:       (c: DemoPipelineCompany) => void;
  onOpenPanel:    (p: PanelView, token?: string) => void;
  onRunApiTests:  (cid: number) => void;
}

const masterToken = () => localStorage.getItem("mp_user_token") || "";

async function loginAs(companyId: number): Promise<string | null> {
  const r = await fetch(`${AUTH_URL}?action=admin-login-as`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
    body: JSON.stringify({ user_id: companyId }),
  });
  const d = await r.json();
  return d.token || null;
}

function ActionButtons({ c, onOpenPanel, onRunApiTests }: {
  c: DemoPipelineCompany;
  onOpenPanel: (p: PanelView, token?: string) => void;
  onRunApiTests: (cid: number) => void;
}) {
  const btn = "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80";
  return (
    <div className="flex flex-wrap gap-1.5 pt-2.5 mt-2.5 border-t border-white/[0.06]"
      onClick={e => e.stopPropagation()}>
      <button onClick={async () => {
          const tok = await loginAs(c.company_id);
          if (tok) onOpenPanel({ type: "site-authed", url: `/?c=${c.company_id}`, token: tok });
          else onOpenPanel({ type: "site", url: `/?c=${c.company_id}` });
        }} className={btn} style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.25)" }}>
        <Icon name="Globe" size={10} /> Борд
      </button>
      <button onClick={async () => {
          const tok = await loginAs(c.company_id);
          if (tok) onOpenPanel({ type: "admin", companyId: c.company_id }, tok);
        }} className={btn} style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
        <Icon name="LayoutDashboard" size={10} /> Панель
      </button>
      <button onClick={() => onRunApiTests(c.company_id)}
        className={btn} style={{ background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.22)" }}>
        <Icon name="Zap" size={10} /> Живые API
      </button>
      <button onClick={async () => {
          const tok = await loginAs(c.company_id);
          if (tok) onOpenPanel({ type: "agent", companyId: c.company_id }, tok);
        }} className={btn} style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
        <Icon name="Pencil" size={10} /> Бренд
      </button>
    </div>
  );
}

export function WLPipelineList({ companies, filterStatus, onFilterChange, onSelect, onOpenPanel, onRunApiTests }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const filtered = filterStatus === "all"
    ? companies
    : companies.filter(c => c.status === filterStatus);

  const toggle = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <div className="mt-4 space-y-3">
      {/* Фильтр по статусу */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => onFilterChange("all")}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition"
          style={{
            background: filterStatus === "all" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
            color:      filterStatus === "all" ? "rgba(255,255,255,0.9)"  : "rgba(255,255,255,0.3)",
            border:     `1px solid ${filterStatus === "all" ? "rgba(255,255,255,0.25)" : "transparent"}`,
          }}>
          Все ({companies.length})
        </button>
        {DEMO_STATUSES.map(s => {
          const count  = companies.filter(c => c.status === s.id).length;
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
          const color   = c.brand_color || "#8b5cf6";
          const domain  = c.site_url.replace(/https?:\/\//, "").split("/")[0];
          const st      = DEMO_STATUSES.find(s => s.id === c.status) || DEMO_STATUSES[0];
          const isOpen  = expanded.has(c.demo_id);

          return (
            <div key={c.demo_id}
              className="rounded-xl overflow-hidden transition"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.06)`, borderLeft: `3px solid ${color}` }}
            >
              {/* Шапка строки */}
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition"
                onClick={() => onSelect(c)}>
                {/* Аватар */}
                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black overflow-hidden"
                  style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
                  {c.brand_logo_url
                    ? <img src={c.brand_logo_url} className="w-full h-full object-contain" alt="" />
                    : c.company_name[0]?.toUpperCase()
                  }
                </div>

                {/* Инфо */}
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

                {/* Статус */}
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
                  style={{ background: st.bg, color: st.color }}>
                  {st.label}
                </span>

                {/* Кнопка раскрытия действий */}
                <button
                  onClick={e => toggle(c.demo_id, e)}
                  className="p-1.5 rounded-lg transition hover:bg-white/[0.06] flex-shrink-0"
                  style={{ color: isOpen ? "#a78bfa" : "rgba(255,255,255,0.2)" }}
                  title="Действия">
                  <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={13} />
                </button>
              </div>

              {/* Раскрытые действия */}
              {isOpen && (
                <div className="px-4 pb-3">
                  <ActionButtons c={c} onOpenPanel={onOpenPanel} onRunApiTests={onRunApiTests} />
                </div>
              )}
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