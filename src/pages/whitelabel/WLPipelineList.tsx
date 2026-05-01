import { useState } from "react";
import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";
import { WLNextStepModal } from "./WLNextStepModal";
import { WLReceiptModal }  from "./WLReceiptModal";
import { WLLprModal }      from "./WLLprModal";

interface Props {
  companies:      DemoPipelineCompany[];
  filterStatus:   DemoStatus | "all";
  onFilterChange: (s: DemoStatus | "all") => void;
  onSelect:       (c: DemoPipelineCompany) => void;

  onMove:         (demoId: number, status: DemoStatus) => void;
  onUpdate:       (demoId: number, patch: Partial<DemoPipelineCompany>) => void;
  onBrand:        (companyId: number) => void;
}


function ActionButtons({ c, onMove }: {
  c: DemoPipelineCompany;
  onMove: (status: DemoStatus) => void;
}) {
  const btn = "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition";
  return (
    <div className="flex gap-1.5 pt-2.5 mt-2.5 border-t border-white/[0.06]"
      onClick={e => e.stopPropagation()}>
      {DEMO_STATUSES.map(s => {
        const active = c.status === s.id;
        return (
          <button key={s.id} onClick={() => !active && onMove(s.id)}
            disabled={active}
            className={btn}
            style={{
              background: active ? s.bg : "rgba(255,255,255,0.04)",
              color:      active ? s.color : "rgba(255,255,255,0.3)",
              border:     `1px solid ${active ? s.color + "50" : "transparent"}`,
              cursor:     active ? "default" : "pointer",
            }}>
            {active && <Icon name="Check" size={9} />}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function WLPipelineList({ companies, filterStatus, onFilterChange, onSelect, onMove, onUpdate, onBrand }: Props) {
  const [expanded,    setExpanded]    = useState<Set<number>>(new Set());
  const [nextStepFor, setNextStepFor] = useState<{ company: DemoPipelineCompany; status: DemoStatus } | null>(null);
  const [receiptFor,  setReceiptFor]  = useState<DemoPipelineCompany | null>(null);
  const [lprFor,      setLprFor]      = useState<DemoPipelineCompany | null>(null);

  const handleMove = (c: DemoPipelineCompany, status: DemoStatus) => {
    if (status === c.status) return;
    if (status === "paid") { setReceiptFor(c); return; }
    setNextStepFor({ company: c, status });
  };

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white/90 truncate">{c.company_name}</span>
                    {c.has_own_agent && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                        style={{ background: "#10b98120", color: "#10b981" }}>WL</span>
                    )}
                    {/* Статус воронки */}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    {/* Демо-время */}
                    {(() => {
                      if (!c.trial_until) return null;
                      const daysLeft = Math.ceil((new Date(c.trial_until).getTime() - Date.now()) / 86400000);
                      if (daysLeft <= 0) return (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                          style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>Демо истёк</span>
                      );
                      const color = daysLeft <= 3 ? "#ef4444" : daysLeft <= 7 ? "#f59e0b" : "#06b6d4";
                      const bg    = daysLeft <= 3 ? "rgba(239,68,68,0.12)" : daysLeft <= 7 ? "rgba(245,158,11,0.12)" : "rgba(6,182,212,0.12)";
                      return (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                          style={{ background: bg, color }}>Демо · {daysLeft} дн.</span>
                      );
                    })()}
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

                {/* Демо: дней осталось (10 дней с создания) */}
                {(() => {
                  const DEMO_DAYS = 10;
                  const daysPassed = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
                  const daysLeft = Math.max(0, DEMO_DAYS - daysPassed);
                  const expired = daysLeft === 0;
                  const warn = daysLeft <= 3;
                  const color = expired ? "#ef4444" : warn ? "#f59e0b" : "#06b6d4";
                  const bg    = expired ? "rgba(239,68,68,0.08)" : warn ? "rgba(245,158,11,0.08)" : "rgba(6,182,212,0.08)";
                  return (
                    <div className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg"
                      style={{ background: bg, border: `1px solid ${color}30` }}>
                      <div className="text-[9px]" style={{ color: color + "99" }}>Демо</div>
                      <div className="text-xs font-bold" style={{ color }}>
                        {expired ? "Истёк" : `${daysLeft} дн.`}
                      </div>
                    </div>
                  );
                })()}

                {/* Смет осталось */}
                {(() => {
                  const bal = c.estimates_balance;
                  const color = bal > 5 ? "#10b981" : bal > 0 ? "#f59e0b" : "#ef4444";
                  const bg    = bal > 5 ? "rgba(16,185,129,0.08)" : bal > 0 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.06)";
                  return (
                    <div className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg"
                      style={{ background: bg, border: `1px solid ${color}30` }}>
                      <div className="text-[9px]" style={{ color: color + "99" }}>Смет</div>
                      <div className="text-xs font-bold" style={{ color }}>{bal}</div>
                    </div>
                  );
                })()}

                {/* Бейдж ЛПР — отдельная кнопка если не заполнен */}
                {!c.contact_name && !c.contact_phone && (
                  <button
                    onClick={e => { e.stopPropagation(); setLprFor(c); }}
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition hover:scale-110"
                    style={{ background: "#ef4444", border: "2px solid rgba(239,68,68,0.3)", boxShadow: "0 0 8px rgba(239,68,68,0.5)" }}
                    title="Не заполнен ЛПР — нажми чтобы добавить">
                    <span className="text-[11px] font-black text-white leading-none">!</span>
                  </button>
                )}

                {/* Бренд */}
                <button onClick={e => { e.stopPropagation(); onBrand(c.company_id); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80 flex-shrink-0"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <Icon name="Pencil" size={10} /> Бренд
                </button>

                {/* Кнопка раскрытия действий */}
                <button
                  onClick={e => toggle(c.demo_id, e)}
                  className="p-1.5 rounded-lg transition hover:bg-white/[0.06] flex-shrink-0"
                  style={{ color: isOpen ? "#a78bfa" : "rgba(255,255,255,0.2)" }}
                  title="Действия">
                  <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={13} />
                </button>
              </div>

              {/* Раскрытые действия — этапы воронки */}
              {isOpen && (
                <div className="px-4 pb-3">
                  <ActionButtons c={c} onMove={status => handleMove(c, status)} />
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

      {/* Модалка следующего шага */}
      {nextStepFor && (
        <WLNextStepModal
          company={nextStepFor.company}
          newStatus={nextStepFor.status}
          onSuccess={patch => {
            onMove(nextStepFor.company.demo_id, nextStepFor.status);
            onUpdate(nextStepFor.company.demo_id, patch);
            setNextStepFor(null);
          }}
          onCancel={() => setNextStepFor(null)}
        />
      )}

      {/* Модалка чека при оплате */}
      {receiptFor && (
        <WLReceiptModal
          company={receiptFor}
          onSuccess={(demoId) => {
            onMove(demoId, "paid");
            onUpdate(demoId, { status: "paid" });
            setReceiptFor(null);
          }}
          onCancel={() => setReceiptFor(null)}
        />
      )}

      {/* Модалка заполнения ЛПР */}
      {lprFor && (
        <WLLprModal
          company={lprFor}
          onSuccess={patch => {
            onUpdate(lprFor.demo_id, patch);
            setLprFor(null);
          }}
          onClose={() => setLprFor(null)}
        />
      )}
    </div>
  );
}