import { useState, useRef, useEffect } from "react";
import { useAuth, CLIENT_ROLES } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";

const ROLE_LABELS: Record<string, string> = {
  client:    "Клиент",
  designer:  "Дизайнер",
  foreman:   "Прораб",
  installer: "Монтажник",
  company:   "Компания",
  manager:   "Менеджер",
};

interface Props {
  onShowProfile: () => void;
  onShowPayment: () => void;
}

export default function UserDropdown({ onShowProfile, onShowPayment }: Props) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const initials = (user.name || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      {/* Кнопка — аватар + имя */}
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all hover:bg-white/[0.06]"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: "#f97316", color: "#fff" }}>
          {initials}
        </div>
        <span className="text-[11px] font-medium max-w-[70px] truncate text-white/70">
          {user.name || user.email}
        </span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={10} style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>

      {/* Дропдаун */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden shadow-2xl z-[200]"
          style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}>

          {/* Шапка */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "#f9731620", color: "#f97316" }}>
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{user.name || "—"}</div>
                <div className="text-[10px] text-white/30 truncate">{user.email}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="text-[10px] text-white/20">ID: {user.id}</div>
                  <div className="text-[9px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{ background: "#f9731620", color: "#f97316" }}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Пункты меню */}
          <div className="py-1.5">
            {user.role && CLIENT_ROLES.includes(user.role) ? (
              <MenuItem icon="ClipboardList" label="Мои заявки"
                onClick={() => { setOpen(false); window.location.href = "/my-orders"; }} />
            ) : (
              <MenuItem icon="LayoutDashboard" label="Панель управления"
                onClick={() => { setOpen(false); window.location.href = "/company"; }} />
            )}
            <MenuItem icon="User" label="Профиль"
              onClick={() => { setOpen(false); onShowProfile(); }} />
            <MenuItem icon="CreditCard" label="Оплата"
              onClick={() => { setOpen(false); onShowPayment(); }} />
            <a href="https://t.me/JoniKras" target="_blank" rel="noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition hover:bg-white/[0.04] text-white/60 hover:text-white/90">
              <Icon name="MessageCircle" size={13} style={{ color: "#29b6f6" }} />
              Поддержка
            </a>
          </div>

          {/* Выход */}
          <div className="border-t border-white/[0.05] py-1.5">
            <button onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition hover:bg-white/[0.04] text-red-400/80 hover:text-red-400">
              <Icon name="LogOut" size={13} />
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition hover:bg-white/[0.04] text-white/60 hover:text-white/90">
      <Icon name={icon} size={13} style={{ color: "#f97316" }} />
      {label}
    </button>
  );
}