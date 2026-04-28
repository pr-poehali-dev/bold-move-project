import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { BusinessUser } from "./masterAdminTypes";
import { subStatus, fmtDate, daysLeft } from "./masterAdminTypes";
import MasterTabRemoved from "./MasterTabRemoved";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type BizView   = "active" | "removed";
type BizFilter = "all" | "approved" | "pending" | "rejected";

const FILTERS: { id: BizFilter; label: string }[] = [
  { id: "all",      label: "Все"       },
  { id: "approved", label: "Одобрены"  },
  { id: "pending",  label: "Ожидают"   },
  { id: "rejected", label: "Отклонены" },
];

const EXTEND_OPTIONS = [
  { label: "7 дн.",   days: 7   },
  { label: "30 дн.",  days: 30  },
  { label: "90 дн.",  days: 90  },
  { label: "365 дн.", days: 365 },
];

// Переиспользуемый компонент фильтр-таба
function FilterTabs<T extends string>({
  tabs, active, counts, onSelect,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  counts: Record<T, number>;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition border"
            style={isActive
              ? { background: "rgba(255,255,255,0.09)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }
              : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
            {t.label}
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{ background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", color: isActive ? "#fff" : "rgba(255,255,255,0.3)" }}>
              {counts[t.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  users: BusinessUser[];
  loading: boolean;
  onReload: () => void;
}

export default function MasterTabBusiness({ users, loading, onReload }: Props) {
  const [view,       setView]       = useState<BizView>("active");
  const [filter,     setFilter]     = useState<BizFilter>("all");
  const [actionId,   setActionId]   = useState<number | null>(null);
  const [subUserId,  setSubUserId]  = useState<number | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<BusinessUser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = users.filter(u => {
    if (filter === "pending")  return !u.approved && !u.rejected;
    if (filter === "approved") return u.approved && !u.rejected;
    if (filter === "rejected") return u.rejected;
    return true;
  });

  const counts: Record<BizFilter, number> = {
    all:      users.length,
    approved: users.filter(u => u.approved && !u.rejected).length,
    pending:  users.filter(u => !u.approved && !u.rejected).length,
    rejected: users.filter(u => u.rejected).length,
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
    <div className="p-5 max-w-4xl mx-auto">
      {/* Переключатель активные / удалённые */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setView("active")}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border"
          style={view === "active"
            ? { background: "rgba(255,255,255,0.09)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }
            : { background: "transparent", color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.07)" }}>
          <Icon name="Users" size={12} /> Активные
        </button>
        <button onClick={() => setView("removed")}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border"
          style={view === "removed"
            ? { background: "rgba(239,68,68,0.12)", color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }
            : { background: "transparent", color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.07)" }}>
          <Icon name="Trash2" size={12} /> Удалённые
        </button>
      </div>

      {view === "removed" ? (
        <MasterTabRemoved group="business" />
      ) : (<>
      {/* Фильтры */}
      <div className="flex items-center gap-4 mb-5">
        <FilterTabs tabs={FILTERS} active={filter} counts={counts} onSelect={setFilter} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.12)" }}>
          <Icon name="Building2" size={36} />
          <span className="text-sm">Нет пользователей</span>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const ss       = subStatus(u);
            const isLoading = actionId === u.id;
            const subColor  = ss === "active" ? "#10b981" : ss === "expiring" ? "#f59e0b" : ss === "expired" ? "#ef4444" : "#475569";
            const borderColor = u.rejected ? "#ef444430" : u.approved ? "#10b98130" : "#f59e0b30";

            return (
              <div key={u.id} className="rounded-2xl overflow-hidden"
                style={{ background: "#0d0d1b", border: `1.5px solid ${borderColor}` }}>

                <div className="p-5">
                  {/* Верхняя строка */}
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: u.role === "company" ? "#f59e0b18" : "#60a5fa18", color: u.role === "company" ? "#f59e0b" : "#60a5fa" }}>
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-white">{u.name || "—"}</span>
                        <RoleBadge role={u.role} />
                        {u.approved && !u.rejected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#10b98118", color: "#10b981" }}>✓ одобрен</span>
                        )}
                        {u.rejected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#ef444418", color: "#ef4444" }}>✗ отклонён</span>
                        )}
                        {!u.approved && !u.rejected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#f59e0b18", color: "#f59e0b" }}>ожидает</span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/35">{u.email}</div>
                      {u.phone && <div className="text-[10px] text-white/22">{u.phone}</div>}
                    </div>

                    {/* Кнопки */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!u.approved && !u.rejected && (
                        <>
                          <button onClick={() => doApprove(u.id)} disabled={isLoading}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:opacity-40"
                            style={{ background: "#10b981" }}>
                            {isLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="Check" size={12} />}
                            Одобрить
                          </button>
                          <button onClick={() => doReject(u.id)} disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40"
                            style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
                            <Icon name="X" size={12} /> Отклонить
                          </button>
                        </>
                      )}
                      {u.approved && !u.rejected && (
                        <button onClick={() => doReject(u.id)} disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition disabled:opacity-40"
                          style={{ background: "#ef444410", color: "#ef4444", border: "1px solid #ef444425" }}>
                          <Icon name="UserX" size={11} /> Отозвать
                        </button>
                      )}
                      {u.rejected && (
                        <button onClick={() => doApprove(u.id)} disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition disabled:opacity-40"
                          style={{ background: "#10b98110", color: "#10b981", border: "1px solid #10b98125" }}>
                          <Icon name="UserCheck" size={11} /> Одобрить
                        </button>
                      )}
                      <button onClick={() => setConfirmDel(u)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                        style={{ background: "#ef444410", color: "#ef4444" }}>
                        <Icon name="Trash2" size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Подписка (для одобренных) */}
                  {u.approved && !u.rejected && (
                    <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: subColor }} />
                        <span className="text-[11px] font-semibold" style={{ color: subColor }}>
                          {ss === "active"   ? `Активна · ${daysLeft(u.subscription_end)} дн.`
                           : ss === "expiring" ? `Скоро истекает · ${daysLeft(u.subscription_end)} дн.`
                           : ss === "expired"  ? "Подписка истекла"
                           : "Нет подписки"}
                        </span>
                      </div>
                      {u.subscription_start && (
                        <span className="text-[10px] text-white/30">С {fmtDate(u.subscription_start)}</span>
                      )}
                      {u.subscription_end && (
                        <span className="text-[10px] text-white/30">До <span className="text-white/50">{fmtDate(u.subscription_end)}</span></span>
                      )}
                      <div className="ml-auto">
                        {subUserId === u.id ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {EXTEND_OPTIONS.map(opt => (
                              <button key={opt.days} onClick={() => doExtend(u.id, opt.days)} disabled={subLoading}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white transition disabled:opacity-50"
                                style={{ background: "#7c3aed" }}>
                                {subLoading ? "..." : opt.label}
                              </button>
                            ))}
                            <button onClick={() => setSubUserId(null)} className="text-white/25 hover:text-white/50 ml-1">
                              <Icon name="X" size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setSubUserId(u.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
                            style={{ background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed30" }}>
                            <Icon name="RefreshCw" size={11} /> Продлить
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-[9px] text-white/15">
                    Зарег. {fmtDate(u.created_at)} · ID #{u.id}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модал удаления */}
      {confirmDel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }} onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#0e0e1c", border: "1.5px solid #ef444430" }}
            onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "#ef444415" }}>
              <Icon name="Trash2" size={20} style={{ color: "#ef4444" }} />
            </div>
            <div className="text-sm font-bold text-white mb-1">Удалить пользователя?</div>
            <div className="text-xs text-white/40 mb-4">{confirmDel.name || confirmDel.email}</div>
            <div className="text-xs text-red-300/70 bg-red-500/08 border border-red-500/15 rounded-xl px-3 py-2 mb-5">
              Все сметы и сессии будут удалены. Необратимо.
            </div>
            <div className="flex gap-2">
              <button onClick={() => doDelete(confirmDel)} disabled={deletingId === confirmDel.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center"
                style={{ background: "#ef4444" }}>
                {deletingId === confirmDel.id
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : "Удалить"}
              </button>
              <button onClick={() => setConfirmDel(null)}
                className="px-5 py-2.5 rounded-xl text-sm text-white/40 transition"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}

export { FilterTabs };