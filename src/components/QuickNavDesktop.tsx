import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";

const ITEMS = [
  { id: "agent",   label: "Агент",       icon: "Bot",     path: "/"     },
  { id: "crm",     label: "CRM",         icon: "Layers",  path: "/crm"  },
  { id: "plan",    label: "Построитель", icon: "PenTool", path: "/plan" },
  { id: "bug",     label: "Баг-репорт",  icon: "Bug",     path: "/bug-report" },
];

export default function QuickNavDesktop() {
  const navigate  = useNavigate();
  const location  = useLocation();

  return (
    <div className="hidden sm:flex items-center gap-1 px-1 py-1 rounded-xl shrink-0"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {ITEMS.map(item => {
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
      })}
    </div>
  );
}