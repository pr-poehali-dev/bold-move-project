import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { BusinessUser } from "./masterAdminTypes";
import { subStatus, fmtDate } from "./masterAdminTypes";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type BizFilter = "pending" | "approved" | "rejected" | "all";

const FILTERS: { id: BizFilter; label: string; color: string }[] = [
  { id: "pending",  label: "Ожидают",  color: "#f59e0b" },
  { id: "approved", label: "Одобрены", color: "#10b981" },
  { id: "rejected", label: "Отклонены",color: "#ef4444" },
  { id: "all",      label: "Все",      color: "#94a3b8" },
];

const EXTEND_OPTIONS = [
  { label: "7 дней",   days: 7 },
  { label: "30 дней",  days: 30 },
  { label: "90 дней",  days: 90 },
  { label: "365 дней", days: 365 },
];

interface Props {
  users: BusinessUser[];
  loading: boolean;
  onReload: () => void;
}

export default function MasterTabBusiness({ users, loading, onReload }: Props) {
  const [filter,     setFilter]     = useState<BizFilter>("pending");
  const [actionId,   setActionId]   = useState<number | null>(null);
  const [subUserId,  setSubUserId]  = useState<number | null>(null);
  const [subLoading, setSubLoading] = useState(false);

  const filtered = users.filter(u => {
    if (filter === "pending")  return !u.approved && !u.rejected;
    if (filter === "approved") return u.approved;
    if (filter === "rejected") return u.rejected;
    return true;
  });

  const counts: Record<BizFilter, number> = {
    pending:  users.filter(u => !u.approved && !u.rejected).length,
    approved: users.filter(u => u.approved).length,
    rejected: users.filter(u => u.rejected).length,
    all:      users.length,
  };

  const doApprove = async (id: number) => {
    setActionId(id);
    await fetch(`${AUTH_URL}?action=approve-user`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });
    setActionId(null);
    onReload();
  };

  const doReject = async (id: number) => {
    setActionId(id);
    await fetch(`${AUTH_URL}?action=reject-user`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });
    setActionId(null);
    onReload();
  };

  const doExtend = async (id: number, days: number) => {
    setSubLoading(true);
    await fetch(`${AUTH_URL}?action=set-subscription`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id, days }),
    });
    setSubLoading(false);
    setSubUserId(null);
    onReload();
  };

  const subPanelUser = users.find(u => u.id === subUserId);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Фильтры */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition"
            style={filter === f.id
              ? { background: f.color + "25", color: f.color, border: `1.5px solid ${f.color}60` }
              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1.5px solid rgba(255,255,255,0.07)" }}>
            {f.label}
            <span className="px-1.5 py-0.5 rounded-md text-[10px]"
              style={{ background: filter === f.id ? f.color + "40" : "rgba(255,255,255,0.08)" }}>
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
          <Icon name="Building2" size={40} />
          <span className="text-sm">Нет пользователей в этой категории</span>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const ss = subStatus(u);
            const isLoading = actionId === u.id;
            return (
              <div key={u.id} className="rounded-2xl overflow-hidden"
                style={{ background: "#0e0e1c", border: `1px solid ${u.rejected ? "rgba(239,68,68,0.2)" : u.approved ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}` }}>

                {/* Цветная полоска */}
                <div className="h-1" style={{ background: u.rejected ? "#ef4444" : u.approved ? "#10b981" : "#f59e0b" }} />

                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    {/* Аватар */}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: u.role === "company" ? "#f59e0b20" : "#60a5fa20", color: u.role === "company" ? "#f59e0b" : "#60a5fa" }}>
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>

                    {/* Инфо */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-white">{u.name || "—"}</span>
                        <RoleBadge role={u.role} />
                        {u.approved && !u.rejected && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-emerald-500/15 text-emerald-400">✓ Одобрен</span>
                        )}
                        {u.rejected && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-red-500/15 text-red-400">✗ Отклонён</span>
                        )}
                      </div>
                      <div className="text-xs text-white/35">{u.email}</div>
                      {u.phone && <div className="text-xs text-white/25">{u.phone}</div>}
                      <div className="text-[10px] text-white/20 mt-0.5">
                        Зарегистрирован: {fmtDate(u.created_at)}
                      </div>
                    </div>

                    {/* Кнопки действий */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!u.approved && !u.rejected && (
                        <>
                          <button onClick={() => doApprove(u.id)} disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
                            style={{ background: "#10b981" }}>
                            {isLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="Check" size={13} />}
                            Одобрить
                          </button>
                          <button onClick={() => doReject(u.id)} disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                            <Icon name="X" size={13} />
                            Отклонить
                          </button>
                        </>
                      )}
                      {u.approved && (
                        <button onClick={() => doReject(u.id)} disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                          <Icon name="UserX" size={13} />
                          Заблокировать
                        </button>
                      )}
                      {u.rejected && (
                        <button onClick={() => doApprove(u.id)} disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
                          style={{ background: "#10b981" }}>
                          <Icon name="RotateCcw" size={13} />
                          Восстановить
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Блок подписки — только для одобренных */}
                  {u.approved && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-xs flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Icon name="CalendarDays" size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                            <span className="text-white/30">Начало:</span>
                            <span className="text-white/60">{fmtDate(u.subscription_start)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Icon name="CalendarX" size={12} style={{
                              color: ss === "active" ? "#10b981" : ss === "expired" ? "#ef4444" : "rgba(255,255,255,0.3)"
                            }} />
                            <span className="text-white/30">Истекает:</span>
                            <span style={{ color: ss === "active" ? "#10b981" : ss === "expired" ? "#ef4444" : "rgba(255,255,255,0.6)" }}>
                              {fmtDate(u.subscription_end)}
                            </span>
                            {ss === "expired" && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-red-500/20 text-red-400">Истекла</span>
                            )}
                            {ss === "active" && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/20 text-emerald-400">Активна</span>
                            )}
                          </div>
                        </div>

                        <button onClick={() => setSubUserId(subUserId === u.id ? null : u.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition flex-shrink-0"
                          style={{ background: "#7c3aed20", color: "#a78bfa", border: "1px solid #7c3aed40" }}>
                          <Icon name="RefreshCw" size={12} />
                          Продлить
                        </button>
                      </div>

                      {/* Панель продления подписки */}
                      {subUserId === u.id && (
                        <div className="mt-3 rounded-xl p-3 flex items-center gap-2 flex-wrap"
                          style={{ background: "#7c3aed12", border: "1px solid #7c3aed30" }}>
                          <span className="text-xs text-white/40 mr-1">Продлить на:</span>
                          {EXTEND_OPTIONS.map(opt => (
                            <button key={opt.days} onClick={() => doExtend(u.id, opt.days)} disabled={subLoading}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                              style={{ background: "#7c3aed", color: "#fff" }}>
                              {subLoading ? "..." : opt.label}
                            </button>
                          ))}
                          <button onClick={() => setSubUserId(null)} className="ml-auto text-white/25 hover:text-white/50 transition">
                            <Icon name="X" size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
