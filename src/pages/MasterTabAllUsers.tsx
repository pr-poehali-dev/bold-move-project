import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { AppUser, UserEstimate } from "./masterAdminTypes";
import { fmtDate, subStatus, daysLeft, ROLE_LABELS } from "./masterAdminTypes";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type RoleFilter = "all" | "client" | "designer" | "foreman" | "installer" | "company";
type SubFilter  = "all" | "active" | "expiring" | "expired" | "none";

interface Props {
  users: AppUser[];
  loading: boolean;
  search: string;
  selectedUser: AppUser | null;
  userEstimates: UserEstimate[];
  estLoading: boolean;
  approvingId: number | null;
  onSearch: (v: string) => void;
  onSelectUser: (u: AppUser) => void;
  onApprove: (id: number) => void;
  onReload: () => void;
}

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: "all",       label: "Все" },
  { id: "client",    label: "Клиенты" },
  { id: "designer",  label: "Дизайнеры" },
  { id: "foreman",   label: "Прорабы" },
  { id: "installer", label: "Монтажники" },
  { id: "company",   label: "Компании" },
];

const SUB_FILTERS: { id: SubFilter; label: string; color: string }[] = [
  { id: "all",      label: "Все",          color: "#94a3b8" },
  { id: "active",   label: "Активна",      color: "#10b981" },
  { id: "expiring", label: "Скоро кончится", color: "#f59e0b" },
  { id: "expired",  label: "Истекла",      color: "#ef4444" },
  { id: "none",     label: "Нет подписки", color: "#64748b" },
];

export default function MasterTabAllUsers({
  users, loading, search, selectedUser, userEstimates,
  estLoading, approvingId, onSearch, onSelectUser, onApprove, onReload,
}: Props) {
  const [roleFilter,  setRoleFilter]  = useState<RoleFilter>("all");
  const [subFilter,   setSubFilter]   = useState<SubFilter>("all");
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const [confirmDel,  setConfirmDel]  = useState<AppUser | null>(null);
  const [sortBy,      setSortBy]      = useState<"created" | "sub_end">("created");

  const filtered = users
    .filter(u => {
      const matchRole   = roleFilter === "all" || u.role === roleFilter;
      const matchSearch = !search ||
        (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.name  || "").toLowerCase().includes(search.toLowerCase());
      const ss = subStatus(u);
      const matchSub = subFilter === "all" || ss === subFilter;
      return matchRole && matchSearch && matchSub;
    })
    .sort((a, b) => {
      if (sortBy === "sub_end") {
        if (!a.subscription_end && !b.subscription_end) return 0;
        if (!a.subscription_end) return 1;
        if (!b.subscription_end) return -1;
        return new Date(a.subscription_end).getTime() - new Date(b.subscription_end).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const doDelete = async (u: AppUser) => {
    setDeletingId(u.id);
    await fetch(`${AUTH_URL}?action=delete-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id }),
    });
    setDeletingId(null);
    setConfirmDel(null);
    onReload();
  };

  return (
    <div className="flex h-[calc(100vh-120px)]">

      {/* Левая панель */}
      <div className="w-80 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Пользователи</span>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-lg font-bold"
                style={{ background: "#10b98120", color: "#10b981" }}>{filtered.length}</span>
              <button onClick={() => setSortBy(s => s === "created" ? "sub_end" : "created")}
                className="text-[10px] px-2 py-1 rounded-lg transition flex items-center gap-1"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                <Icon name="ArrowUpDown" size={10} />
                {sortBy === "created" ? "по дате" : "по подписке"}
              </button>
            </div>
          </div>

          {/* Поиск */}
          <div className="relative">
            <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input value={search} onChange={e => onSearch(e.target.value)}
              placeholder="Поиск по имени / email..."
              className="w-full rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
          </div>

          {/* Фильтр по роли */}
          <div className="flex flex-wrap gap-1">
            {ROLE_FILTERS.map(f => (
              <button key={f.id} onClick={() => setRoleFilter(f.id)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold transition"
                style={roleFilter === f.id
                  ? { background: "#10b981", color: "#fff" }
                  : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Фильтр по подписке */}
          <div className="flex flex-wrap gap-1">
            {SUB_FILTERS.map(f => (
              <button key={f.id} onClick={() => setSubFilter(f.id)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold transition"
                style={subFilter === f.id
                  ? { background: f.color + "30", color: f.color, border: `1px solid ${f.color}60` }
                  : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: "rgba(255,255,255,0.15)" }}>
              <Icon name="SearchX" size={28} />
              <span className="text-xs">Никого не найдено</span>
            </div>
          ) : filtered.map(u => {
            const ss = subStatus(u);
            const subColor = ss === "active" ? "#10b981" : ss === "expiring" ? "#f59e0b" : ss === "expired" ? "#ef4444" : undefined;
            return (
              <button key={u.id} onClick={() => onSelectUser(u)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left transition border-b border-white/[0.04] hover:bg-white/[0.03]"
                style={selectedUser?.id === u.id ? { background: "rgba(16,185,129,0.08)" } : {}}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "#10b98120", color: "#10b981" }}>
                  {(u.name || u.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold truncate text-white/90">{u.name || "—"}</span>
                    <RoleBadge role={u.role} />
                  </div>
                  <div className="text-[10px] truncate text-white/30">{u.email}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {subColor && (
                      <span className="text-[9px] font-bold" style={{ color: subColor }}>
                        {ss === "active" ? "✓ подписка" : ss === "expiring" ? `⚠ ${daysLeft(u.subscription_end)}д` : "✗ истекла"}
                      </span>
                    )}
                    {u.rejected && <span className="text-[9px] text-red-400">отклонён</span>}
                    {!u.approved && !u.rejected && ["installer","company"].includes(u.role) && (
                      <span className="text-[9px] text-amber-400">ожидает</span>
                    )}
                    {u.estimates_count > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded font-semibold"
                        style={{ background: "#7c3aed18", color: "#a78bfa" }}>
                        {u.estimates_count} смет
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Правая: детали */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedUser ? (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
            <Icon name="Users" size={40} className="opacity-30" />
            <span className="text-sm">Выберите пользователя</span>
          </div>
        ) : (
          <div className="max-w-2xl space-y-4">

            {/* Профиль */}
            <div className="p-5 rounded-2xl" style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                  style={{ background: "#10b98120", color: "#10b981" }}>
                  {(selectedUser.name || selectedUser.email || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-base font-bold text-white">{selectedUser.name || "—"}</span>
                    <RoleBadge role={selectedUser.role} />
                    {selectedUser.rejected && (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-red-500/20 text-red-400">✗ отклонён</span>
                    )}
                    {!selectedUser.approved && !selectedUser.rejected && (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-amber-500/20 text-amber-400">ожидает</span>
                    )}
                    {selectedUser.approved && !selectedUser.rejected && (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-emerald-500/20 text-emerald-400">✓ одобрен</span>
                    )}
                  </div>
                  <div className="text-xs text-white/40">{selectedUser.email}</div>
                  {selectedUser.phone && <div className="text-xs text-white/30">{selectedUser.phone}</div>}
                  {selectedUser.discount > 0 && (
                    <div className="text-xs text-violet-300 mt-1">Скидка: {selectedUser.discount}%</div>
                  )}
                  <div className="text-[10px] text-white/20 mt-1">
                    ID #{selectedUser.id} · Зарег. {fmtDate(selectedUser.created_at)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-black" style={{ color: "#10b981" }}>{selectedUser.estimates_count}</div>
                  <div className="text-xs text-white/30">смет</div>
                </div>
              </div>

              {/* Действия */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {!selectedUser.approved && !selectedUser.rejected && (
                  <button onClick={() => onApprove(selectedUser.id)}
                    disabled={approvingId === selectedUser.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
                    style={{ background: "#10b981" }}>
                    {approvingId === selectedUser.id
                      ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Icon name="Check" size={13} />}
                    Одобрить
                  </button>
                )}
                <button onClick={() => setConfirmDel(selectedUser)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ml-auto"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <Icon name="Trash2" size={13} /> Удалить
                </button>
              </div>
            </div>

            {/* Подписка */}
            {["installer","company"].includes(selectedUser.role) && (
              <div className="p-4 rounded-2xl" style={{ background: "#0e0e1c", border: "1px solid rgba(124,58,237,0.2)" }}>
                <div className="text-xs font-bold text-white/50 mb-3 flex items-center gap-1.5">
                  <Icon name="CreditCard" size={13} style={{ color: "#a78bfa" }} /> Подписка
                </div>
                {(() => {
                  const ss = subStatus(selectedUser);
                  const subColor = ss === "active" ? "#10b981" : ss === "expiring" ? "#f59e0b" : ss === "expired" ? "#ef4444" : "#64748b";
                  return (
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div><div className="text-white/30 mb-0.5">Начало</div><div className="text-white/70">{fmtDate(selectedUser.subscription_start)}</div></div>
                      <div><div className="text-white/30 mb-0.5">Конец</div><div className="text-white/70">{fmtDate(selectedUser.subscription_end)}</div></div>
                      <div>
                        <div className="text-white/30 mb-0.5">Статус</div>
                        <div className="font-bold" style={{ color: subColor }}>
                          {ss === "active" ? `✓ ${daysLeft(selectedUser.subscription_end)} дн.`
                           : ss === "expiring" ? `⚠ ${daysLeft(selectedUser.subscription_end)} дн.`
                           : ss === "expired" ? "✗ истекла"
                           : "—"}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Сметы */}
            {estLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : userEstimates.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="px-4 py-3 border-b border-white/[0.06] text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                  <Icon name="FileText" size={13} style={{ color: "#a78bfa" }} /> Сметы
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {userEstimates.map(e => (
                    <div key={e.id} className="flex items-center px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white/70 truncate">{e.title}</div>
                        <div className="text-[10px] text-white/30">{fmtDate(e.created_at)}</div>
                      </div>
                      {e.total_standard && (
                        <span className="text-xs font-bold text-emerald-400 flex-shrink-0">
                          {e.total_standard.toLocaleString("ru-RU")} ₽
                        </span>
                      )}
                      {e.crm_status && (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg flex-shrink-0"
                          style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                          {e.crm_status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модалка подтверждения удаления */}
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
            <div className="text-xs text-white/30 mb-4">{confirmDel.email}</div>
            <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-300/80 bg-red-500/10 border border-red-500/20 mb-5">
              Будут удалены все сметы и сессии. Это действие необратимо.
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
