import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";
import { WLPipelineActionButtons } from "./WLPipelineActionButtons";
import { WLAssignManager } from "./WLAssignManager";
import { useWLManager } from "./WLManagerContext";

const DEMO_DAYS = 10;

interface Props {
  c:        DemoPipelineCompany;
  isOpen:   boolean;
  onToggle: (id: number, e: React.MouseEvent) => void;
  onSelect: (c: DemoPipelineCompany) => void;
  onMove:   (c: DemoPipelineCompany, status: DemoStatus) => void;
  onBrand:  (companyId: number) => void;
  onLpr:    (c: DemoPipelineCompany) => void;
  onHistory:(company: DemoPipelineCompany, mode: "demo" | "est" | "info") => void;
  onUpdate: (demoId: number, patch: Partial<DemoPipelineCompany>) => void;
}

export function WLPipelineCard({ c, isOpen, onToggle, onSelect, onMove, onBrand, onLpr, onHistory, onUpdate }: Props) {
  const { isMaster, manager } = useWLManager();
  const canAssign = isMaster || manager?.wl_role === "master_manager";
  const color  = c.brand_color || "#8b5cf6";
  const domain = c.site_url.replace(/https?:\/\//, "").split("/")[0];
  const st     = DEMO_STATUSES.find(s => s.id === c.status) || DEMO_STATUSES[0];

  return (
    <div
      className="rounded-xl overflow-hidden transition"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.06)`, borderLeft: `3px solid ${color}` }}
    >
      {/* Шапка строки */}
      <div className="flex items-center gap-3 px-4 py-3 transition">
        {/* Аватар — кликабелен */}
        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black overflow-hidden cursor-pointer hover:opacity-80 transition"
          style={{ background: color + "25", color, border: `1px solid ${color}40` }}
          onClick={() => onSelect(c)}>
          {c.brand_logo_url
            ? <img src={c.brand_logo_url} className="w-full h-full object-contain" alt="" />
            : c.company_name[0]?.toUpperCase()
          }
        </div>

        {/* Инфо — кликабелен */}
        <div className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition" onClick={() => onSelect(c)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white/90 truncate">{c.company_name}</span>
            {(!c.contact_name || !c.contact_phone || !c.contact_position) && (
              <button
                onClick={e => { e.stopPropagation(); onLpr(c); }}
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
              const trialColor = daysLeft <= 3 ? "#ef4444" : daysLeft <= 7 ? "#f59e0b" : "#06b6d4";
              const trialBg    = daysLeft <= 3 ? "rgba(239,68,68,0.12)" : daysLeft <= 7 ? "rgba(245,158,11,0.12)" : "rgba(6,182,212,0.12)";
              return (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                  style={{ background: trialBg, color: trialColor }}>Демо · {daysLeft} дн.</span>
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
          if (missing.length === 0 && !noLpr) return (
            <div className="flex-1 min-w-0 max-w-[180px] cursor-pointer self-stretch"
              onClick={e => { e.stopPropagation(); onToggle(c.demo_id, e); }} />
          );
          return (
            <div className="flex-1 flex flex-col gap-1 min-w-0 max-w-[180px] cursor-pointer"
              onClick={e => { e.stopPropagation(); onToggle(c.demo_id, e); }}>
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
                    onClick={e => { e.stopPropagation(); onLpr(c); }}
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
          onClick={e => { e.stopPropagation(); onHistory(c, "info"); }}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-white/[0.08]"
          style={{ color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
          title="Полная информация">
          <Icon name="Info" size={13} />
        </button>

        {/* Демо: дней осталось (10 дней с создания) — кликабельный */}
        {(() => {
          const daysPassed = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
          const daysLeft   = Math.max(0, DEMO_DAYS - daysPassed);
          const expired    = daysLeft === 0;
          const warn       = daysLeft <= 3;
          const demoColor  = expired ? "#ef4444" : warn ? "#f59e0b" : "#06b6d4";
          const demoBg     = expired ? "rgba(239,68,68,0.08)" : warn ? "rgba(245,158,11,0.08)" : "rgba(6,182,212,0.08)";
          return (
            <button className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg transition hover:brightness-125"
              style={{ background: demoBg, border: `1px solid ${demoColor}30` }}
              onClick={e => { e.stopPropagation(); onHistory(c, "demo"); }}
              title="История демо-периода">
              <div className="text-[9px]" style={{ color: demoColor + "99" }}>Демо</div>
              <div className="text-xs font-bold" style={{ color: demoColor }}>
                {expired ? "Истёк" : `${daysLeft} дн.`}
              </div>
            </button>
          );
        })()}

        {/* Смет осталось — кликабельный */}
        {(() => {
          const bal      = c.estimates_balance;
          const estColor = bal > 5 ? "#10b981" : bal > 0 ? "#f59e0b" : "#ef4444";
          const estBg    = bal > 5 ? "rgba(16,185,129,0.08)" : bal > 0 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.06)";
          return (
            <button className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg transition hover:brightness-125"
              style={{ background: estBg, border: `1px solid ${estColor}30` }}
              onClick={e => { e.stopPropagation(); onHistory(c, "est"); }}
              title="История баланса смет">
              <div className="text-[9px]" style={{ color: estColor + "99" }}>Смет</div>
              <div className="text-xs font-bold" style={{ color: estColor }}>{bal}</div>
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

        {/* Назначение менеджера — только для мастера и мастер-менеджера */}
        {canAssign && (
          <div onClick={e => e.stopPropagation()}>
            <WLAssignManager
              demoId={c.demo_id}
              managerId={c.manager_id}
              managerName={c.manager_name}
              onAssigned={(mid, mname) => onUpdate(c.demo_id, { manager_id: mid, manager_name: mname })}
            />
          </div>
        )}

        {/* Кнопка раскрытия действий */}
        <button
          onClick={e => onToggle(c.demo_id, e)}
          className="p-1.5 rounded-lg transition hover:bg-white/[0.06] flex-shrink-0"
          style={{ color: isOpen ? "#a78bfa" : "rgba(255,255,255,0.2)" }}
          title="Действия">
          <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={13} />
        </button>
      </div>

      {/* Раскрытые действия — этапы воронки */}
      {isOpen && (
        <div className="px-4 pb-3">
          <WLPipelineActionButtons c={c} onMove={status => onMove(c, status)} />
        </div>
      )}
    </div>
  );
}