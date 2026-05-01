import { useState } from "react";
import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";
import { WLNextStepModal }          from "./WLNextStepModal";
import { WLReceiptModal }           from "./WLReceiptModal";
import { WLLprModal }               from "./WLLprModal";
import { WLBalanceHistoryModal }    from "./WLBalanceHistoryModal";

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
      {DEMO_STATUSES.filter(s => s.id !== "presented").map(s => {
        const active   = c.status === s.id;
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
      {/* Показ проведён — только для информации, не кликабелен */}
      {c.status === "presented" && (() => {
        const s = DEMO_STATUSES.find(st => st.id === "presented")!;
        return (
          <div className={btn} style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}50` }}>
            <Icon name="Check" size={9} /> {s.label}
          </div>
        );
      })()}
    </div>
  );
}

type DemoFilter   = "all" | "active" | "expiring" | "expired";
type EstFilter    = "all" | "redflag" | "used" | "bought";
type AgentFilter  = "all" | "demo" | "bought" | "none";

const DEMO_DAYS = 10;
function demoDaysLeft(c: DemoPipelineCompany) {
  const passed = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
  return Math.max(0, DEMO_DAYS - passed);
}

export function WLPipelineList({ companies, filterStatus, onFilterChange, onSelect, onMove, onUpdate, onBrand }: Props) {
  const [expanded,    setExpanded]    = useState<Set<number>>(new Set());
  const [nextStepFor, setNextStepFor] = useState<{ company: DemoPipelineCompany; status: DemoStatus } | null>(null);
  const [receiptFor,  setReceiptFor]  = useState<DemoPipelineCompany | null>(null);
  const [lprFor,      setLprFor]      = useState<DemoPipelineCompany | null>(null);

  const [demoFilter,   setDemoFilter]   = useState<DemoFilter>("all");
  const [estFilter,    setEstFilter]    = useState<EstFilter>("all");
  const [agentFilter,  setAgentFilter]  = useState<AgentFilter>("all");
  const [filtersOpen,  setFiltersOpen]  = useState(false);
  const [historyFor,  setHistoryFor]  = useState<{ company: DemoPipelineCompany; mode: "demo" | "est" | "info" } | null>(null);

  const handleMove = (c: DemoPipelineCompany, status: DemoStatus) => {
    if (status === c.status) return;
    if (status === "paid") { setReceiptFor(c); return; }
    setNextStepFor({ company: c, status });
  };

  const byStatus = filterStatus === "all" ? companies : companies.filter(c => c.status === filterStatus);

  const filtered = byStatus.filter(c => {
    // Фильтр по дням демо
    const dl = demoDaysLeft(c);
    if (demoFilter === "active"   && dl === 0)            return false;
    if (demoFilter === "expiring" && (dl === 0 || dl > 3)) return false;
    if (demoFilter === "expired"  && dl > 0)              return false;

    // Фильтр по сметам
    const used     = c.estimates_used || 0;
    const boughtEst = c.estimates_balance > 10;
    if (estFilter === "redflag" && (used > 0 || boughtEst))  return false; // ред флаг = выдано, но 0 использовано и не купил
    if (estFilter === "used"    && used === 0)                return false;
    if (estFilter === "bought"  && !boughtEst)               return false;

    // Фильтр по агенту: куплен = status paid, триал = has_own_agent + not paid
    const agentPaid  = c.status === "paid";
    const agentTrial = c.has_own_agent && !agentPaid;
    if (agentFilter === "demo"   && !agentTrial)  return false;
    if (agentFilter === "bought" && !agentPaid)   return false;

    return true;
  });

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

      {/* Доп-фильтры — сворачиваемый блок */}
      <div className="rounded-xl overflow-hidden transition-all"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Заголовок-переключатель */}
        <button className="w-full flex items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.02]"
          onClick={() => setFiltersOpen(v => !v)}>
          <Icon name="SlidersHorizontal" size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex-1">Фильтры</span>
          {/* Показываем активные фильтры в свёрнутом виде */}
          {!filtersOpen && (demoFilter !== "all" || estFilter !== "all" || agentFilter !== "all") && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa" }}>
              активны
            </span>
          )}
          <Icon name={filtersOpen ? "ChevronUp" : "ChevronDown"} size={12} style={{ color: "rgba(255,255,255,0.2)" }} />
        </button>

        {/* Содержимое */}
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
              <button key={f.id} onClick={() => setDemoFilter(f.id)}
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

        {/* Сметы — по активности */}
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
              <button key={f.id} onClick={() => setEstFilter(f.id)}
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
              <button key={f.id} onClick={() => setAgentFilter(f.id)}
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
                    {(!c.contact_name || !c.contact_phone || !c.contact_position) && (
                      <button
                        onClick={e => { e.stopPropagation(); setLprFor(c); }}
                        className="flex-shrink-0 transition hover:scale-110"
                        style={{ filter: "drop-shadow(0 0 4px rgba(239,68,68,0.7))" }}
                        title="Не заполнен ЛПР">
                        <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
                          <path d="M7 1L13 12H1L7 1Z" fill="#ef4444"/>
                          <text x="7" y="10.5" textAnchor="middle" fontSize="7" fontWeight="900" fill="white">!</text>
                        </svg>
                      </button>
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
                    <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg text-[9px] font-medium"
                      style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                      <Icon name="Target" size={9} /> {c.next_action}
                    </div>
                  )}
                </div>

                {/* Незаполненные поля бренда — пилюли */}
                {(() => {
                  const missing: { key: string; label: string }[] = [];
                  if (!c.support_phone)  missing.push({ key: "phone", label: "Телефон" });
                  if (!c.brand_color)    missing.push({ key: "color", label: "Цвет" });
                  if (!c.brand_logo_url) missing.push({ key: "logo",  label: "Логотип" });
                  if (!c.bot_name)       missing.push({ key: "bot",   label: "Имя бота" });
                  const noLpr = !c.contact_name || !c.contact_phone || !c.contact_position;
                  if (missing.length === 0 && !noLpr) return null;
                  return (
                    <div className="flex-1 flex flex-col gap-1 min-w-0 max-w-[180px]"
                      onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <svg width="11" height="10" viewBox="0 0 11 10" fill="none" style={{ flexShrink: 0, filter: "drop-shadow(0 0 3px rgba(239,68,68,0.6))" }}>
                          <path d="M5.5 1L10.5 9.5H0.5L5.5 1Z" fill="#ef4444"/>
                          <text x="5.5" y="7.5" textAnchor="middle" fontSize="5" fontWeight="900" fill="white">!</text>
                        </svg>
                        <span className="text-[9px] text-white/30 leading-none">Нужно заполнить</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {missing.map(m => (
                          <button key={m.key}
                            onClick={e => { e.stopPropagation(); onBrand(c.company_id); }}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full transition hover:opacity-80"
                            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                            {m.label}
                          </button>
                        ))}
                        {noLpr && (
                          <button
                            onClick={e => { e.stopPropagation(); setLprFor(c); }}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full transition hover:opacity-80"
                            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                            ЛПР
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Кнопка инфо */}
                <button
                  onClick={e => { e.stopPropagation(); setHistoryFor({ company: c, mode: "info" }); }}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-white/[0.08]"
                  style={{ color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
                  title="Полная информация">
                  <Icon name="Info" size={13} />
                </button>

                {/* Демо: дней осталось (10 дней с создания) — кликабельный */}
                {(() => {
                  const daysPassed = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
                  const daysLeft = Math.max(0, DEMO_DAYS - daysPassed);
                  const expired = daysLeft === 0;
                  const warn = daysLeft <= 3;
                  const color = expired ? "#ef4444" : warn ? "#f59e0b" : "#06b6d4";
                  const bg    = expired ? "rgba(239,68,68,0.08)" : warn ? "rgba(245,158,11,0.08)" : "rgba(6,182,212,0.08)";
                  return (
                    <button className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg transition hover:brightness-125"
                      style={{ background: bg, border: `1px solid ${color}30` }}
                      onClick={e => { e.stopPropagation(); setHistoryFor({ company: c, mode: "demo" }); }}
                      title="История демо-периода">
                      <div className="text-[9px]" style={{ color: color + "99" }}>Демо</div>
                      <div className="text-xs font-bold" style={{ color }}>
                        {expired ? "Истёк" : `${daysLeft} дн.`}
                      </div>
                    </button>
                  );
                })()}

                {/* Смет осталось — кликабельный */}
                {(() => {
                  const bal = c.estimates_balance;
                  const color = bal > 5 ? "#10b981" : bal > 0 ? "#f59e0b" : "#ef4444";
                  const bg    = bal > 5 ? "rgba(16,185,129,0.08)" : bal > 0 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.06)";
                  return (
                    <button className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg transition hover:brightness-125"
                      style={{ background: bg, border: `1px solid ${color}30` }}
                      onClick={e => { e.stopPropagation(); setHistoryFor({ company: c, mode: "est" }); }}
                      title="История баланса смет">
                      <div className="text-[9px]" style={{ color: color + "99" }}>Смет</div>
                      <div className="text-xs font-bold" style={{ color }}>{bal}</div>
                    </button>
                  );
                })()}

                {/* Бренд */}
                <button onClick={e => { e.stopPropagation(); onBrand(c.company_id); }}
                  className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg transition hover:brightness-125"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <div className="text-[9px]" style={{ color: "rgba(245,158,11,0.6)" }}>Редакт.</div>
                  <div className="flex items-center justify-center" style={{ color: "#f59e0b" }}>
                    <Icon name="Pencil" size={12} />
                  </div>
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

      {/* Модалка истории демо/смет */}
      {historyFor && (
        <WLBalanceHistoryModal
          company={historyFor.company}
          mode={historyFor.mode}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}