import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { AppUser } from "./masterAdminTypes";
import { fmtDate, subStatus, daysLeft, ROLE_LABELS } from "./masterAdminTypes";

interface SubBadge {
  label: string;
  color: string;
  bg:    string;
}

function getSubBadge(u: AppUser): SubBadge | null {
  const ss = subStatus(u);
  if (ss === "active")   return { label: `${daysLeft(u.subscription_end)} дн.`, color: "#10b981", bg: "#10b98118" };
  if (ss === "expiring") return { label: `⚠ ${daysLeft(u.subscription_end)} дн.`, color: "#f59e0b", bg: "#f59e0b18" };
  if (ss === "expired")  return { label: "Истекла", color: "#ef4444", bg: "#ef444418" };
  return null;
}

interface Props {
  users:        AppUser[];
  loading:      boolean;
  selectedUser: AppUser | null;
  onSelectUser: (u: AppUser) => void;
}

const GRID = "minmax(0,2fr) 130px 110px 140px 70px 36px";

export default function AllUsersTable({ users, loading, selectedUser, onSelectUser }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.12)" }}>
        <Icon name="SearchX" size={36} />
        <span className="text-sm">Никого не найдено</span>
      </div>
    );
  }

  return (
    <>
      {/* ── ДЕСКТОП: таблица ── */}
      <div className="hidden sm:block">
        <div className="grid px-5 py-2 border-b border-white/[0.05] sticky top-0 z-10"
          style={{ gridTemplateColumns: GRID, background: "#07070f" }}>
          {["Пользователь", "Роль", "Зарегистрирован", "Подписка до", "Смет", ""].map(h => (
            <div key={h} className="text-[10px] font-bold text-white/22 uppercase tracking-wider">{h}</div>
          ))}
        </div>
        <div className="divide-y divide-white/[0.04]">
          {users.map(u => {
            const badge      = getSubBadge(u);
            const isSelected = selectedUser?.id === u.id;
            const roleColor  = ROLE_LABELS[u.role]?.color ?? "#94a3b8";
            const hasSubRole = ["installer","company"].includes(u.role);
            return (
              <div key={u.id}
                onClick={() => onSelectUser(u)}
                className="grid items-center px-5 py-3 cursor-pointer transition hover:bg-white/[0.025]"
                style={{
                  gridTemplateColumns: GRID,
                  background:  isSelected ? "rgba(255,255,255,0.04)" : undefined,
                  borderLeft:  isSelected ? "3px solid rgba(255,255,255,0.3)" : "3px solid transparent",
                }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: roleColor + "18", color: roleColor }}>
                    {(u.name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white/90 truncate">{u.name || "—"}</div>
                    <div className="text-[10px] text-white/30 truncate">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <RoleBadge role={u.role} />
                  {u.rejected && <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: "#ef444415", color: "#ef4444" }}>откл.</span>}
                  {!u.approved && !u.rejected && ["installer","company"].includes(u.role) && <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: "#f59e0b15", color: "#f59e0b" }}>ожидает</span>}
                </div>
                <div className="text-[10px] text-white/35">{fmtDate(u.created_at)}</div>
                <div>
                  {hasSubRole ? (badge ? (
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                      {u.subscription_end && <div className="text-[9px] text-white/25 mt-0.5">{fmtDate(u.subscription_end)}</div>}
                    </div>
                  ) : <span className="text-[10px] text-white/20">нет подписки</span>) : <span className="text-[10px] text-white/15">—</span>}
                </div>
                <div>
                  {u.estimates_count > 0 ? <span className="text-xs font-bold" style={{ color: "#10b981" }}>{u.estimates_count}</span> : <span className="text-[10px] text-white/20">0</span>}
                </div>
                <div className="flex justify-end">
                  <Icon name="ChevronRight" size={13} style={{ color: isSelected ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── МОБИЛЕ: карточки ── */}
      <div className="sm:hidden divide-y divide-white/[0.04]">
        {users.map(u => {
          const badge      = getSubBadge(u);
          const isSelected = selectedUser?.id === u.id;
          const roleColor  = ROLE_LABELS[u.role]?.color ?? "#94a3b8";
          const hasSubRole = ["installer","company"].includes(u.role);
          return (
            <div key={u.id}
              onClick={() => onSelectUser(u)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition active:opacity-70"
              style={{
                background: isSelected ? "rgba(255,255,255,0.04)" : undefined,
                borderLeft: isSelected ? "3px solid rgba(255,255,255,0.3)" : "3px solid transparent",
              }}>
              {/* Аватар */}
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: roleColor + "18", color: roleColor }}>
                {(u.name || u.email || "?")[0].toUpperCase()}
              </div>
              {/* Основная инфо */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-semibold text-white/90 truncate">{u.name || u.email?.split("@")[0] || "—"}</span>
                  <RoleBadge role={u.role} />
                  {u.rejected && <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: "#ef444415", color: "#ef4444" }}>откл.</span>}
                  {!u.approved && !u.rejected && hasSubRole && <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: "#f59e0b15", color: "#f59e0b" }}>ожид.</span>}
                </div>
                <div className="text-[10px] text-white/30 truncate">{u.email}</div>
              </div>
              {/* Правая часть: подписка + смет */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {hasSubRole && badge ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                ) : null}
                {u.estimates_count > 0 && (
                  <span className="text-[10px] font-bold" style={{ color: "#10b981" }}>{u.estimates_count} смет</span>
                )}
              </div>
              <Icon name="ChevronRight" size={13} style={{ color: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </>
  );
}