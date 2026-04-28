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
  { id: "all",      label: "Все",           color: "#94a3b8" },
  { id: "active",   label: "Активна",       color: "#10b981" },
  { id: "expiring", label: "Скоро кончится", color: "#f59e0b" },
  { id: "expired",  label: "Истекла",       color: "#ef4444" },
  { id: "none",     label: "Нет подписки",  color: "#64748b" },
];

const EXTEND_OPTIONS = [
  { label: "7 дн.",    days: 7   },
  { label: "30 дн.",   days: 30  },
  { label: "90 дн.",   days: 90  },
  { label: "365 дн.",  days: 365 },
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
  const [subUserId,   setSubUserId]   = useState<number | null>(null);
  const [subLoading,  setSubLoading]  = useState(false);

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

  const doExtend = async (userId: number, days: number) => {
    setSubLoading(true);
    await fetch(`${AUTH_URL}?action=extend-subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, days }),
    });
    setSubLoading(false);
    setSubUserId(null);
    onReload();
  };

  const subBadge = (u: AppUser) => {
    const ss = subStatus(u);
    if (ss === "active")    return { label: `${daysLeft(u.subscription_end)} дн.`, bg: "#10b98120", color: "#10b981" };
    if (ss === "expiring")  return { label: `⚠ ${daysLeft(u.subscription_end)} дн.`, bg: "#f59e0b20", color: "#f59e0b" };
    if (ss === "expired")   return { label: "Истекла", bg: "#ef444420", color: "#ef4444" };
    return null;
  };

  return (
    <div className="flex h-[calc(100vh-112px)]">

      {/* ─── Левая колонка: фильтры + таблица ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Панель фильтров */}
        <div className="px-5 py-3 border-b border-white/[0.06] space-y-2.5 flex-shrink-0"
          style={{ background: "#07070f" }}>

          {/* Поиск + сортировка */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input value={search} onChange={e => onSearch(e.target.value)}
                placeholder="Поиск по имени или email..."
                className="w-full rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
            </div>
            <button onClick={() => setSortBy(s => s === "created" ? "sub_end" : "created")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold transition flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Icon name="ArrowUpDown" size={11} />
              {sortBy === "created" ? "по дате" : "по подписке"}
            </button>
          </div>

          {/* Роль + подписка в одну строку */}
          <div className="flex gap-4 flex-wrap items-center">
            <div className="flex gap-1 flex-wrap">
              {ROLE_FILTERS.map(f => (
                <button key={f.id} onClick={() => setRoleFilter(f.id)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition"
                  style={roleFilter === f.id
                    ? { background: "#10b981", color: "#fff" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-white/10 flex-shrink-0" />
            <div className="flex gap-1 flex-wrap">
              {SUB_FILTERS.map(f => (
                <button key={f.id} onClick={() => setSubFilter(f.id)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition"
                  style={subFilter === f.id
                    ? { background: f.color + "30", color: f.color, border: `1px solid ${f.color}50` }
                    : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-white/25 ml-auto">{filtered.length} польз.</span>
          </div>
        </div>

        {/* Таблица */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
              <Icon name="SearchX" size={36} />
              <span className="text-sm">Никого не найдено</span>
            </div>
          ) : (
            <>
              {/* Шапка таблицы */}
              <div className="grid items-center px-5 py-2 border-b border-white/[0.05] sticky top-0 z-10"
                style={{ gridTemplateColumns: "2fr 1fr 1fr 80px 90px", background: "#07070f" }}>
                {["Пользователь", "Роль", "Подписка", "Смет", ""].map(h => (
                  <div key={h} className="text-[10px] font-bold text-white/25 uppercase tracking-wider">{h}</div>
                ))}
              </div>

              {/* Строки */}
              <div className="divide-y divide-white/[0.04]">
                {filtered.map(u => {
                  const badge = subBadge(u);
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <div key={u.id}
                      onClick={() => onSelectUser(u)}
                      className="grid items-center px-5 py-3.5 cursor-pointer transition hover:bg-white/[0.03]"
                      style={{
                        gridTemplateColumns: "2fr 1fr 1fr 80px 90px",
                        background: isSelected ? "rgba(16,185,129,0.07)" : undefined,
                        borderLeft: isSelected ? "3px solid #10b981" : "3px solid transparent",
                      }}>

                      {/* Пользователь */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            background: (ROLE_LABELS[u.role]?.color ?? "#94a3b8") + "20",
                            color: ROLE_LABELS[u.role]?.color ?? "#94a3b8",
                          }}>
                          {(u.name || u.email || "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white/90 truncate">{u.name || "—"}</div>
                          <div className="text-[10px] text-white/30 truncate">{u.email}</div>
                        </div>
                      </div>

                      {/* Роль */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <RoleBadge role={u.role} />
                        {u.rejected && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400">откл.</span>}
                        {!u.approved && !u.rejected && ["installer","company"].includes(u.role) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/15 text-amber-400">ожидает</span>
                        )}
                      </div>

                      {/* Подписка */}
                      <div>
                        {badge ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold"
                            style={{ background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/20">—</span>
                        )}
                      </div>

                      {/* Смет */}
                      <div>
                        {u.estimates_count > 0 ? (
                          <span className="text-xs font-bold" style={{ color: "#10b981" }}>{u.estimates_count}</span>
                        ) : (
                          <span className="text-[10px] text-white/20">0</span>
                        )}
                      </div>

                      {/* Стрелка */}
                      <div className="flex justify-end">
                        <Icon name="ChevronRight" size={14}
                          style={{ color: isSelected ? "#10b981" : "rgba(255,255,255,0.15)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Правая панель: профиль ─── */}
      <div className="w-[340px] flex-shrink-0 border-l border-white/[0.07] flex flex-col overflow-hidden"
        style={{ background: "#080810" }}>
        {!selectedUser ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8"
            style={{ color: "rgba(255,255,255,0.15)" }}>
            <Icon name="MousePointerClick" size={32} />
            <span className="text-xs text-center">Нажмите на пользователя чтобы увидеть детали</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* Шапка профиля */}
            <div className="p-5 border-b border-white/[0.06]">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0"
                  style={{
                    background: (ROLE_LABELS[selectedUser.role]?.color ?? "#94a3b8") + "20",
                    color: ROLE_LABELS[selectedUser.role]?.color ?? "#94a3b8",
                  }}>
                  {(selectedUser.name || selectedUser.email || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white mb-1">{selectedUser.name || "—"}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <RoleBadge role={selectedUser.role} />
                    {selectedUser.rejected && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-red-500/20 text-red-400">✗ отклонён</span>
                    )}
                    {!selectedUser.approved && !selectedUser.rejected && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-amber-500/15 text-amber-400">ожидает</span>
                    )}
                    {selectedUser.approved && !selectedUser.rejected && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-emerald-500/15 text-emerald-400">✓ одобрен</span>
                    )}
                  </div>
                  <div className="text-[10px] text-white/35 truncate">{selectedUser.email}</div>
                  {selectedUser.phone && <div className="text-[10px] text-white/25">{selectedUser.phone}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-black" style={{ color: "#10b981" }}>{selectedUser.estimates_count}</div>
                  <div className="text-[9px] text-white/30">смет</div>
                </div>
              </div>
            </div>

            {/* Инфо поля */}
            <div className="px-5 py-3 space-y-1.5 border-b border-white/[0.05]">
              {[
                { label: "ID",            value: `#${selectedUser.id}` },
                { label: "Зарегистрирован", value: fmtDate(selectedUser.created_at) },
                ...(selectedUser.discount > 0 ? [{ label: "Скидка", value: `${selectedUser.discount}%` }] : []),
              ].map(row => (
                <div key={row.label} className="flex justify-between text-xs py-1 border-b border-white/[0.04]">
                  <span className="text-white/30">{row.label}</span>
                  <span className="text-white/65">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Подписка */}
            {["installer","company"].includes(selectedUser.role) && (
              <div className="px-5 py-3 border-b border-white/[0.05]">
                <div className="text-[10px] font-bold text-white/35 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Icon name="CreditCard" size={11} style={{ color: "#a78bfa" }} /> Подписка
                </div>
                {(() => {
                  const ss = subStatus(selectedUser);
                  const subColor = ss === "active" ? "#10b981" : ss === "expiring" ? "#f59e0b" : ss === "expired" ? "#ef4444" : "#64748b";
                  return (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs py-1 border-b border-white/[0.04]">
                        <span className="text-white/30">Начало</span>
                        <span className="text-white/65">{fmtDate(selectedUser.subscription_start)}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-white/[0.04]">
                        <span className="text-white/30">Истекает</span>
                        <span className="font-semibold" style={{ color: subColor }}>
                          {fmtDate(selectedUser.subscription_end)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-white/30">Статус</span>
                        <span className="font-bold text-[11px]" style={{ color: subColor }}>
                          {ss === "active"   ? `✓ ${daysLeft(selectedUser.subscription_end)} дн. осталось`
                           : ss === "expiring" ? `⚠ ${daysLeft(selectedUser.subscription_end)} дн.`
                           : ss === "expired"  ? "✗ Истекла"
                           : "Нет подписки"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Продлить */}
                {subUserId === selectedUser.id ? (
                  <div className="mt-3 rounded-xl p-3 flex items-center gap-1.5 flex-wrap"
                    style={{ background: "#7c3aed12", border: "1px solid #7c3aed30" }}>
                    <span className="text-[10px] text-white/40 w-full mb-1">Продлить на:</span>
                    {EXTEND_OPTIONS.map(opt => (
                      <button key={opt.days} onClick={() => doExtend(selectedUser.id, opt.days)} disabled={subLoading}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition disabled:opacity-50"
                        style={{ background: "#7c3aed" }}>
                        {subLoading ? "..." : opt.label}
                      </button>
                    ))}
                    <button onClick={() => setSubUserId(null)} className="ml-auto text-white/25 hover:text-white/50">
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setSubUserId(selectedUser.id)}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition"
                    style={{ background: "#7c3aed20", color: "#a78bfa", border: "1px solid #7c3aed40" }}>
                    <Icon name="RefreshCw" size={11} /> Продлить подписку
                  </button>
                )}
              </div>
            )}

            {/* Одобрить (если ожидает) */}
            {!selectedUser.approved && !selectedUser.rejected && (
              <div className="px-5 py-3 border-b border-white/[0.05]">
                <button onClick={() => onApprove(selectedUser.id)}
                  disabled={approvingId === selectedUser.id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
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
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : userEstimates.length > 0 && (
              <div className="px-5 py-3">
                <div className="text-[10px] font-bold text-white/35 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Icon name="FileText" size={11} style={{ color: "#a78bfa" }} /> Сметы
                </div>
                <div className="space-y-1.5">
                  {userEstimates.map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-white/70 truncate">{e.title}</div>
                        <div className="text-[9px] text-white/25">{fmtDate(e.created_at)}</div>
                      </div>
                      {e.total_standard != null && (
                        <span className="text-[11px] font-bold flex-shrink-0"
                          style={{ color: "#10b981" }}>
                          {e.total_standard.toLocaleString("ru-RU")} ₽
                        </span>
                      )}
                      {e.status && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                          style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
                          {e.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Удалить */}
            <div className="p-5 mt-auto">
              <button onClick={() => setConfirmDel(selectedUser)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition"
                style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Icon name="Trash2" size={13} /> Удалить пользователя
              </button>
            </div>
          </div>
        )}
      </div>

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
