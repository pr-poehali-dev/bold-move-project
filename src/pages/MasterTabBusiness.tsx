import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { BusinessUser } from "./masterAdminTypes";
import { subStatus, fmtDate, daysLeft } from "./masterAdminTypes";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type BizFilter = "pending" | "approved" | "rejected" | "all";

const FILTERS: { id: BizFilter; label: string; color: string }[] = [
  { id: "pending",  label: "Ожидают",   color: "#f59e0b" },
  { id: "approved", label: "Одобрены",  color: "#10b981" },
  { id: "rejected", label: "Отклонены", color: "#ef4444" },
  { id: "all",      label: "Все",       color: "#94a3b8" },
];

const EXTEND_OPTIONS = [
  { label: "7 дн.",   days: 7   },
  { label: "30 дн.",  days: 30  },
  { label: "90 дн.",  days: 90  },
  { label: "365 дн.", days: 365 },
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
  const [confirmDel, setConfirmDel] = useState<BusinessUser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const doDelete = async (u: BusinessUser) => {
    setDeletingId(u.id);
    await fetch(`${AUTH_URL}?action=delete-user`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id }),
    });
    setDeletingId(null);
    setConfirmDel(null);
    onReload();
  };

  return (
    <div className="p-5 max-w-5xl mx-auto">

      {/* Фильтры */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition"
            style={filter === f.id
              ? { background: f.color + "22", color: f.color, border: `1.5px solid ${f.color}55` }
              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1.5px solid rgba(255,255,255,0.07)" }}>
            {f.label}
            <span className="px-1.5 py-0.5 rounded-md text-[10px]"
              style={{ background: filter === f.id ? f.color + "35" : "rgba(255,255,255,0.08)" }}>
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
        <div className="flex flex-col items-center justify-center py-20 gap-3"
          style={{ color: "rgba(255,255,255,0.15)" }}>
          <Icon name="Building2" size={40} />
          <span className="text-sm">Нет пользователей в этой категории</span>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const ss = subStatus(u);
            const isLoading = actionId === u.id;

            const subColor = ss === "active" ? "#10b981"
              : ss === "expiring" ? "#f59e0b"
              : ss === "expired"  ? "#ef4444"
              : "#475569";

            const statusBorderColor = u.rejected ? "#ef4444"
              : u.approved ? "#10b981"
              : "#f59e0b";

            return (
              <div key={u.id} className="rounded-2xl overflow-hidden"
                style={{ background: "#0d0d1b", border: `1.5px solid ${statusBorderColor}30` }}>

                {/* Цветная полоска */}
                <div className="h-0.5" style={{ background: statusBorderColor }} />

                <div className="p-5">
                  {/* Строка 1: аватар + имя + бейджи + кнопки */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0"
                      style={{
                        background: u.role === "company" ? "#f59e0b20" : "#60a5fa20",
                        color: u.role === "company" ? "#f59e0b" : "#60a5fa",
                      }}>
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-white">{u.name || "—"}</span>
                        <RoleBadge role={u.role} />
                        {u.approved && !u.rejected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-emerald-500/15 text-emerald-400">✓ одобрен</span>
                        )}
                        {u.rejected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-red-500/15 text-red-400">✗ отклонён</span>
                        )}
                        {!u.approved && !u.rejected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-amber-500/15 text-amber-400">ожидает</span>
                        )}
                      </div>
                      <div className="text-xs text-white/35">{u.email}</div>
                      {u.phone && <div className="text-[10px] text-white/25">{u.phone}</div>}
                    </div>

                    {/* Кнопки справа */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {!u.approved && !u.rejected && (
                        <>
                          <button onClick={() => doApprove(u.id)} disabled={isLoading}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
                            style={{ background: "#10b981" }}>
                            {isLoading
                              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : <Icon name="Check" size={13} />}
                            Одобрить
                          </button>
                          <button onClick={() => doReject(u.id)} disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                            <Icon name="X" size={13} /> Отклонить
                          </button>
                        </>
                      )}
                      {u.approved && (
                        <button onClick={() => doReject(u.id)} disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition disabled:opacity-50"
                          style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                          <Icon name="UserX" size={11} /> Отозвать
                        </button>
                      )}
                      {u.rejected && (
                        <button onClick={() => doApprove(u.id)} disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition disabled:opacity-50"
                          style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                          <Icon name="UserCheck" size={11} /> Одобрить
                        </button>
                      )}
                      <button onClick={() => setConfirmDel(u)}
                        className="p-2 rounded-xl transition"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Строка 2: подписка (для одобренных) */}
                  {u.approved && (
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      <div className="flex items-center gap-6 flex-wrap">

                        {/* Статус подписки */}
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: subColor }} />
                          <span className="text-[10px] font-bold" style={{ color: subColor }}>
                            {ss === "active"   ? `Активна · ${daysLeft(u.subscription_end)} дн.`
                             : ss === "expiring" ? `Скоро истекает · ${daysLeft(u.subscription_end)} дн.`
                             : ss === "expired"  ? "Подписка истекла"
                             : "Нет подписки"}
                          </span>
                        </div>

                        {u.subscription_start && (
                          <div className="text-[10px] text-white/30">
                            С {fmtDate(u.subscription_start)}
                          </div>
                        )}
                        {u.subscription_end && (
                          <div className="text-[10px] text-white/30">
                            До <span className="text-white/50">{fmtDate(u.subscription_end)}</span>
                          </div>
                        )}

                        {/* Кнопка продлить */}
                        <div className="ml-auto">
                          {subUserId === u.id ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-white/30">+</span>
                              {EXTEND_OPTIONS.map(opt => (
                                <button key={opt.days} onClick={() => doExtend(u.id, opt.days)} disabled={subLoading}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition disabled:opacity-50"
                                  style={{ background: "#7c3aed" }}>
                                  {subLoading ? "..." : opt.label}
                                </button>
                              ))}
                              <button onClick={() => setSubUserId(null)} className="text-white/25 hover:text-white/50 transition ml-1">
                                <Icon name="X" size={12} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setSubUserId(u.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition"
                              style={{ background: "#7c3aed20", color: "#a78bfa", border: "1px solid #7c3aed35" }}>
                              <Icon name="RefreshCw" size={11} /> Продлить
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Дата регистрации */}
                  <div className="mt-2 text-[9px] text-white/15">
                    Зарег. {fmtDate(u.created_at)} · ID #{u.id}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Подтверждение удаления */}
      {confirmDel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: "#0e0e1c", border: "1.5px solid rgba(239,68,68,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(239,68,68,0.12)" }}>
              <Icon name="Trash2" size={22} style={{ color: "#ef4444" }} />
            </div>
            <div className="text-base font-bold text-white mb-1">Удалить пользователя?</div>
            <div className="text-sm text-white/40 mb-1">{confirmDel.name || "—"}</div>
            <div className="text-xs text-white/25 mb-4">{confirmDel.email}</div>
            <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-300/80 bg-red-500/10 border border-red-500/20 mb-5">
              Все сметы и сессии будут удалены. Действие необратимо.
            </div>
            <div className="flex gap-2">
              <button onClick={() => doDelete(confirmDel)} disabled={deletingId === confirmDel.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#ef4444" }}>
                {deletingId === confirmDel.id
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : "Удалить"}
              </button>
              <button onClick={() => setConfirmDel(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
