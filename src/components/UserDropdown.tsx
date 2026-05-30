import { useState, useRef, useEffect } from "react";
import { useAuth, CLIENT_ROLES, hasPermission } from "@/context/AuthContext";
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
}

export default function UserDropdown({ onShowProfile }: Props) {
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
            {/* Баланс смет для монтажников/компаний */}
            {["installer","company"].includes(user.role) && (() => {
              const trial      = user.trial_until ? new Date(user.trial_until) : null;
              const trialAlive = trial && trial > new Date();
              const hoursLeft  = trialAlive ? Math.floor((trial.getTime() - Date.now()) / 3600000) : 0;
              return (
                <>
                  <button
                    onClick={() => { setOpen(false); window.location.href = "/pricing"; }}
                    className="mt-2.5 w-full flex items-center justify-between px-3 py-2 rounded-xl transition hover:opacity-80"
                    style={{ background: (user.estimates_balance ?? 0) > 0 ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)" }}>
                    <span className="text-[10px] text-white/40">Смет на балансе</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-black"
                        style={{ color: (user.estimates_balance ?? 0) > 0 ? "#10b981" : "#ef4444" }}>
                        {user.estimates_balance ?? 0}
                      </span>
                      <Icon name="Plus" size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                    </span>
                  </button>
                  {trialAlive && (
                    <div className="mt-2 rounded-xl overflow-hidden relative"
                      style={{ background: "linear-gradient(135deg, #0d2b1f 0%, #0a1f2e 50%, #1a0d2e 100%)", border: "1px solid rgba(16,185,129,0.25)" }}>
                      {/* Светящийся акцент сверху */}
                      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #10b981, #6366f1, transparent)" }} />
                      <div className="px-3 py-2.5 flex items-center gap-2.5">
                        {/* Иконка с пульсацией */}
                        <div className="relative flex-shrink-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg, #10b981, #6366f1)" }}>
                            <Icon name="Gift" size={13} style={{ color: "#fff" }} />
                          </div>
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400"
                            style={{ boxShadow: "0 0 6px #10b981" }} />
                        </div>
                        {/* Текст */}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black tracking-wide"
                              style={{ background: "linear-gradient(90deg, #10b981, #6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                              FREE ТРИАЛ
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: "rgba(16,185,129,0.2)", color: "#10b981" }}>
                              АКТИВЕН
                            </span>
                          </div>
                          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                            Осталось{" "}
                            <span className="font-bold" style={{ color: hoursLeft < 48 ? "#f59e0b" : "#10b981" }}>
                              {hoursLeft >= 24 ? `${Math.floor(hoursLeft/24)} дн.` : `${hoursLeft} ч.`}
                            </span>
                          </span>
                        </div>
                      </div>
                      {/* Прогресс-бар */}
                      <div className="px-3 pb-2.5">
                        <div className="h-0.5 rounded-full w-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(5, (hoursLeft / (14 * 24)) * 100))}%`,
                              background: hoursLeft < 48
                                ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                                : "linear-gradient(90deg, #10b981, #6366f1)",
                            }} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Пункты меню */}
          <div className="py-1.5">
            {user.role && CLIENT_ROLES.includes(user.role) ? (
              <>
                <MenuItem icon="ClipboardList" label="Мои заявки"
                  onClick={() => { setOpen(false); window.location.href = "/my-orders"; }} />
                {hasPermission(user, "profile_view") && (
                  <MenuItem icon="User" label="Профиль"
                    onClick={() => { setOpen(false); onShowProfile(); }} />
                )}
              </>
            ) : (
              <>
                {hasPermission(user, "profile_view") && (
                  <MenuItem icon="User" label="Профиль"
                    onClick={() => { setOpen(false); onShowProfile(); }} />
                )}
                {["installer","company"].includes(user.role) && hasPermission(user, "tariffs_view") && (
                  <MenuItem icon="Sparkles" label="Купить сметы"
                    onClick={() => { setOpen(false); window.location.href = "/pricing"; }} />
                )}
                <MenuItem icon="Newspaper" label="Новости"
                  onClick={() => { setOpen(false); window.location.href = "/news"; }} />
              </>
            )}

            <MenuItem icon="Code2" label="Разработчик"
              onClick={() => { setOpen(false); window.location.href = "/LB"; }} />

            {hasPermission(user, "support_view") && (
              <a href="https://t.me/JoniKras" target="_blank" rel="noreferrer"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition hover:bg-white/[0.04] text-white/60 hover:text-white/90">
                <Icon name="MessageCircle" size={13} style={{ color: "#29b6f6" }} />
                Поддержка
              </a>
            )}
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