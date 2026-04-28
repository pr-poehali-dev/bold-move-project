import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { AppUser, UserEstimate } from "./masterAdminTypes";
import { fmtDate, subStatus, daysLeft, ROLE_LABELS } from "./masterAdminTypes";

const EXTEND_OPTIONS = [
  { label: "7 дн.",   days: 7   },
  { label: "30 дн.",  days: 30  },
  { label: "90 дн.",  days: 90  },
  { label: "365 дн.", days: 365 },
];

interface Props {
  selectedUser:  AppUser | null;
  userEstimates: UserEstimate[];
  estLoading:    boolean;
  approvingId:   number | null;
  subUserId:     number | null;
  subLoading:    boolean;
  onApprove:     (id: number) => void;
  onConfirmDel:  (u: AppUser) => void;
  onExtend:      (userId: number, days: number) => void;
  onSubUserId:   (id: number | null) => void;
}

export default function AllUsersPanel({
  selectedUser, userEstimates, estLoading, approvingId,
  subUserId, subLoading, onApprove, onConfirmDel, onExtend, onSubUserId,
}: Props) {
  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8"
        style={{ color: "rgba(255,255,255,0.12)" }}>
        <Icon name="MousePointerClick" size={28} />
        <span className="text-xs text-center">Нажмите на строку чтобы открыть детали</span>
      </div>
    );
  }

  const roleColor = ROLE_LABELS[selectedUser.role]?.color ?? "#94a3b8";

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">

      {/* Шапка */}
      <div className="p-5 border-b border-white/[0.05]">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ background: roleColor + "18", color: roleColor }}>
            {(selectedUser.name || selectedUser.email || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white mb-1 truncate">{selectedUser.name || "—"}</div>
            <div className="flex items-center gap-1 flex-wrap mb-1">
              <RoleBadge role={selectedUser.role} />
              {selectedUser.rejected && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#ef444415", color: "#ef4444" }}>✗ откл.</span>
              )}
              {!selectedUser.approved && !selectedUser.rejected && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#f59e0b15", color: "#f59e0b" }}>ожидает</span>
              )}
              {selectedUser.approved && !selectedUser.rejected && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#10b98115", color: "#10b981" }}>✓ одобрен</span>
              )}
            </div>
            <div className="text-[10px] text-white/30 truncate">{selectedUser.email}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xl font-black" style={{ color: "#10b981" }}>{selectedUser.estimates_count}</div>
            <div className="text-[9px] text-white/25">смет</div>
          </div>
        </div>
      </div>

      {/* Поля */}
      <div className="px-5 py-3 space-y-0 border-b border-white/[0.05]">
        {[
          { label: "ID",      value: `#${selectedUser.id}` },
          { label: "Зарег.",  value: fmtDate(selectedUser.created_at) },
          { label: "Телефон", value: selectedUser.phone || "—" },
          ...(selectedUser.discount > 0 ? [{ label: "Скидка", value: `${selectedUser.discount}%` }] : []),
        ].map(row => (
          <div key={row.label} className="flex justify-between text-xs py-1.5 border-b border-white/[0.03] last:border-0">
            <span className="text-white/28">{row.label}</span>
            <span className="text-white/60">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Подписка (для монтажников/компаний) */}
      {["installer","company"].includes(selectedUser.role) && (
        <div className="px-5 py-3 border-b border-white/[0.05]">
          <div className="text-[9px] font-bold text-white/25 uppercase tracking-wider mb-2">Подписка</div>
          {(() => {
            const ss = subStatus(selectedUser);
            const c = ss === "active" ? "#10b981" : ss === "expiring" ? "#f59e0b" : ss === "expired" ? "#ef4444" : "#64748b";
            return (
              <div className="space-y-1">
                <div className="flex justify-between text-xs py-1 border-b border-white/[0.03]">
                  <span className="text-white/28">Начало</span>
                  <span className="text-white/55">{fmtDate(selectedUser.subscription_start)}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-white/[0.03]">
                  <span className="text-white/28">Истекает</span>
                  <span style={{ color: c }}>{fmtDate(selectedUser.subscription_end)}</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-white/28">Статус</span>
                  <span className="font-semibold" style={{ color: c }}>
                    {ss === "active"   ? `✓ ${daysLeft(selectedUser.subscription_end)} дн.`
                     : ss === "expiring" ? `⚠ ${daysLeft(selectedUser.subscription_end)} дн.`
                     : ss === "expired"  ? "✗ истекла"
                     : "нет"}
                  </span>
                </div>
              </div>
            );
          })()}
          {subUserId === selectedUser.id ? (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              {EXTEND_OPTIONS.map(opt => (
                <button key={opt.days} onClick={() => onExtend(selectedUser.id, opt.days)} disabled={subLoading}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white disabled:opacity-50"
                  style={{ background: "#7c3aed" }}>
                  {subLoading ? "..." : opt.label}
                </button>
              ))}
              <button onClick={() => onSubUserId(null)} className="text-white/25 hover:text-white/50 ml-1">
                <Icon name="X" size={11} />
              </button>
            </div>
          ) : (
            <button onClick={() => onSubUserId(selectedUser.id)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition"
              style={{ background: "#7c3aed15", color: "#a78bfa", border: "1px solid #7c3aed28" }}>
              <Icon name="RefreshCw" size={11} /> Продлить
            </button>
          )}
        </div>
      )}

      {/* Одобрить */}
      {!selectedUser.approved && !selectedUser.rejected && (
        <div className="px-5 py-3 border-b border-white/[0.05]">
          <button onClick={() => onApprove(selectedUser.id)} disabled={approvingId === selectedUser.id}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            style={{ background: "#10b981" }}>
            {approvingId === selectedUser.id
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Icon name="Check" size={13} /> Одобрить</>}
          </button>
        </div>
      )}

      {/* Сметы */}
      {estLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : userEstimates.length > 0 && (
        <div className="px-5 py-3 flex-1">
          <div className="text-[9px] font-bold text-white/25 uppercase tracking-wider mb-2">Сметы</div>
          <div className="space-y-1.5">
            {userEstimates.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/65 truncate">{e.title}</div>
                  <div className="text-[9px] text-white/25">{fmtDate(e.created_at)}</div>
                </div>
                {e.total_standard != null && (
                  <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#10b981" }}>
                    {e.total_standard.toLocaleString("ru-RU")} ₽
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Удалить */}
      <div className="p-4 mt-auto border-t border-white/[0.05]">
        <button onClick={() => onConfirmDel(selectedUser)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition"
          style={{ background: "#ef444410", color: "#ef4444", border: "1px solid #ef444420" }}>
          <Icon name="Trash2" size={12} /> Удалить пользователя
        </button>
      </div>
    </div>
  );
}
