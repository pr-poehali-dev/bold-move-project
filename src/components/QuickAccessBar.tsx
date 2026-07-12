import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth, hasPermission } from "@/context/AuthContext";
import type { Permissions } from "@/context/AuthContext";

interface QuickItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  perm: keyof Permissions | null;
}

const ITEMS: QuickItem[] = [
  { id: "agent",   label: "Агент",       icon: "Bot",          path: "/",        perm: null },
  { id: "crm",     label: "CRM",         icon: "ClipboardList", path: "/crm",     perm: "crm_view" },
  { id: "plan",    label: "Построитель", icon: "PenTool",      path: "/plan",    perm: "plan_view" },
  { id: "settings", label: "Настройки",  icon: "Settings",     path: "/company", perm: "admin_panel_view" },
];

export default function QuickAccessBar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const startYRef = useRef<number | null>(null);

  // Сотрудник без явного права не видит пункт меню; владельцу/мастеру/гостю — доступно всё
  const visibleItems = ITEMS.filter(item => {
    if (!item.perm) return true;
    if (!user || user.role !== "manager") return true;
    return hasPermission(user, item.perm);
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const dy = startYRef.current - e.changedTouches[0].clientY;
    if (dy > 30) setOpen(true);
    if (dy < -30) setOpen(false);
    startYRef.current = null;
  };

  const handleItem = (item: QuickItem) => {
    setOpen(false);
    navigate(item.path);
  };

  const currentPath = location.pathname;

  return (
    <div
      className="sm:hidden shrink-0 select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", background: "rgba(10,10,18,0.95)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Ручка — всегда видна */}
      <div
        className="flex flex-col items-center justify-center py-1.5 cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-10 h-1.5 rounded-full" style={{ background: "color-mix(in srgb, var(--brand-color) 70%, transparent)" }} />
        <span className="text-[9px] mt-1 font-medium" style={{ color: "color-mix(in srgb, var(--brand-color) 60%, transparent)" }}>
          {open ? "скрыть" : "меню"}
        </span>
      </div>

      {/* Панель кнопок */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "80px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="flex items-center gap-2 px-3 pb-3">
          {visibleItems.map(item => {
            const isActive = item.path !== "#contacts" && currentPath === item.path;
            return (
              <button
                key={item.id}
                onClick={() => handleItem(item)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-medium active:scale-95 transition-transform"
                style={{
                  background: isActive ? "rgba(251,146,60,0.15)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${isActive ? "rgba(251,146,60,0.5)" : "rgba(255,255,255,0.1)"}`,
                  color: isActive ? "rgba(251,146,60,0.9)" : "rgba(255,255,255,0.6)",
                }}
              >
                <Icon name={item.icon} size={14} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}