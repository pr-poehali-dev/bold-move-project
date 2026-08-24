import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth, hasPermission, type Permissions } from "@/context/AuthContext";
import { crmFetch } from "@/pages/admin/crm/crmApi";
import LeadsLogModal, { LeadLogEntry, isLostLead } from "@/components/LeadsLogModal";

interface NavItem {
  id: string; label: string; icon: string; path: string; perm: keyof Permissions;
}

// perm: null раньше означало "виден всем без проверки" — из-за этого "Агент",
// "Заявки" и "Баг-репорт" оставались видны даже тем сотрудникам, кому явно
// выключили доступ в настройках. Теперь у каждого пункта есть свой ключ прав.
const ITEMS: NavItem[] = [
  { id: "agent",   label: "Агент",       icon: "Bot",     path: "/",     perm: "agent_view" },
  { id: "crm",     label: "CRM",         icon: "Layers",  path: "/crm",  perm: "crm_view" },
  { id: "plan",    label: "Построитель", icon: "PenTool", path: "/plan", perm: "plan_view" },
];

const BUG_ITEM: NavItem = { id: "bug", label: "Баг-репорт", icon: "Bug", path: "/bug-report", perm: "bug_report_view" };
const LEADS_PERM: keyof Permissions = "leads_log_view";

export default function QuickNavDesktop() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const [logOpen, setLogOpen]   = useState(false);
  const [lostCnt, setLostCnt]   = useState(0);

  // Счётчик потерянных заявок (пришли по вебхуку, но карточка не создалась) —
  // подтягиваем один раз при загрузке и после закрытия журнала.
  useEffect(() => {
    if (logOpen) return;
    let alive = true;
    crmFetch("leads-log", undefined, { limit: "200" })
      .then(d => {
        if (!alive) return;
        const list = Array.isArray(d) ? d as LeadLogEntry[] : [];
        setLostCnt(list.filter(isLostLead).length);
      })
      .catch(() => { /* нет доступа/сети — просто не показываем счётчик */ });
    return () => { alive = false; };
  }, [logOpen]);

  // Сотрудник без явного права не видит пункт меню; владельцу/мастеру/гостю — доступно всё
  const canSee = (perm: keyof Permissions) => {
    if (!user || user.role !== "manager") return true;
    return hasPermission(user, perm);
  };

  const visibleItems = ITEMS.filter(item => canSee(item.perm));
  const canSeeLeads = canSee(LEADS_PERM);
  const canSeeBug = canSee(BUG_ITEM.perm);

  const renderButton = (item: NavItem) => {
    const active = item.path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(item.path);
    return (
      <button
        key={item.id}
        onClick={() => navigate(item.path)}
        className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-[11px] font-semibold transition-all shrink-0"
        style={active ? {
          background: "rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(255,255,255,0.15)",
        } : {
          color: "rgba(255,255,255,0.4)",
          border: "1px solid transparent",
        }}
      >
        <Icon name={item.icon} size={13} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="hidden sm:flex items-center justify-between w-full">
      <div className="flex items-center gap-1 px-1 py-1 rounded-xl shrink-0"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {visibleItems.map(renderButton)}
      </div>

      {/* Журнал заявок + баг-репорт — отдельно от модулей экосистемы.
          Скрываем блок целиком, если сотруднику не разрешён ни один из двух пунктов. */}
      {(canSeeLeads || canSeeBug) && (
        <div className="flex items-center gap-1 px-1 py-1 rounded-xl shrink-0"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {canSeeLeads && (
            <button
              onClick={() => setLogOpen(true)}
              title="Журнал входящих заявок — что пришло с сайта и квиза, включая потерянные"
              className="relative flex items-center gap-1.5 px-3 h-7 rounded-lg text-[11px] font-semibold transition-all shrink-0"
              style={{
                color: lostCnt > 0 ? "#fca5a5" : "rgba(255,255,255,0.4)",
                border: `1px solid ${lostCnt > 0 ? "rgba(239,68,68,0.35)" : "transparent"}`,
                background: lostCnt > 0 ? "rgba(239,68,68,0.12)" : "transparent",
              }}
            >
              <Icon name="Inbox" size={13} />
              <span>Заявки</span>
              {lostCnt > 0 && (
                <span className="ml-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: "#ef4444", color: "#fff" }}>
                  {lostCnt}
                </span>
              )}
            </button>
          )}
          {canSeeBug && renderButton(BUG_ITEM)}
        </div>
      )}

      {logOpen && <LeadsLogModal onClose={() => setLogOpen(false)} />}
    </div>
  );
}