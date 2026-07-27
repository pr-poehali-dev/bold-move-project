import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth, hasPermission } from "@/context/AuthContext";

const ITEMS = [
  { id: "agent",   label: "Агент",       icon: "Bot",     path: "/",     perm: null as const },
  { id: "crm",     label: "CRM",         icon: "Layers",  path: "/crm",  perm: "crm_view" as const },
  { id: "plan",    label: "Построитель", icon: "PenTool", path: "/plan", perm: "plan_view" as const },
];

const BUG_ITEM = { id: "bug", label: "Баг-репорт", icon: "Bug", path: "/bug-report", perm: null as const };

export default function QuickNavDesktop() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  // Сотрудник без явного права не видит пункт меню; владельцу/мастеру/гостю — доступно всё
  const canSee = (perm: string | null) => {
    if (!perm) return true;
    if (!user || user.role !== "manager") return true;
    return hasPermission(user, perm);
  };

  const visibleItems = ITEMS.filter(item => canSee(item.perm));

  const renderButton = (item: typeof BUG_ITEM) => {
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

      {/* Баг-репорт — отдельно от модулей экосистемы */}
      <div className="flex items-center px-1 py-1 rounded-xl shrink-0"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {renderButton(BUG_ITEM)}
      </div>
    </div>
  );
}