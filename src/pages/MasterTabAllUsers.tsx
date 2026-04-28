import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { AppUser, UserEstimate } from "./masterAdminTypes";
import { fmtDate, subStatus, daysLeft, ROLE_LABELS } from "./masterAdminTypes";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type SubFilter = "all" | "active" | "expiring" | "expired" | "none";

const SUB_FILTERS: { id: SubFilter; label: string; color: string }[] = [
  { id: "all",      label: "Все",           color: "#94a3b8" },
  { id: "active",   label: "Активна",       color: "#10b981" },
  { id: "expiring", label: "Скоро кончится", color: "#f59e0b" },
  { id: "expired",  label: "Истекла",       color: "#ef4444" },
  { id: "none",     label: "Нет подписки",  color: "#64748b" },
];

const EXTEND_OPTIONS = [
  { label: "7 дн.",   days: 7   },
  { label: "30 дн.",  days: 30  },
  { label: "90 дн.",  days: 90  },
  { label: "365 дн.", days: 365 },
];

interface Props {
  users:        AppUser[];
  loading:      boolean;
  search:       string;
  selectedUser: AppUser | null;
  userEstimates: UserEstimate[];
  estLoading:   boolean;
  approvingId:  number | null;
  onSearch:     (v: string) => void;
  onSelectUser: (u: AppUser) => void;
  onApprove:    (id: number) => void;
  onReload:     () => void;
}

export default function MasterTabAllUsers({
  users, loading, search, selectedUser, userEstimates,
  estLoading, approvingId, onSearch, onSelectUser, onApprove, onReload,
}: Props) {
  // Мультиселект ролей
  const [roleFilters, setRoleFilters] = useState<Set<string>>(new Set());
  const [subFilter,   setSubFilter]   = useState<SubFilter>("all");
  const [sortBy,      setSortBy]      = useState<"created" | "sub_end">("created");
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const [confirmDel,  setConfirmDel]  = useState<AppUser | null>(null);
  const [subUserId,   setSubUserId]   = useState<number | null>(null);
  const [subLoading,  setSubLoading]  = useState(false);

  const toggleRole = (role: string) => {
    setRoleFilters(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const filtered = users
    .filter(u => {
      const matchSearch = !search ||
        (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.name  || "").toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilters.size === 0 || roleFilters.has(u.role);
      const ss = subStatus(u);
      const matchSub = subFilter === "all" || ss === subFilter;
      return matchSearch && matchRole && matchSub;
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id }),
    });
    setDeletingId(null);
    setConfirmDel(null);
    onReload();
  };

  const doExtend = async (userId: number, days: number) => {
    setSubLoading(true);
    await fetch(`${AUTH_URL}?action=extend-subscription`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, days }),
    });
    setSubLoading(false);
    setSubUserId(null);
    onReload();
  };

  const subBadge = (u: AppUser) => {
    const ss = subStatus(u);
    if (ss === "active")   return { label: `${daysLeft(u.subscription_end)} дн.`, color: "#10b981", bg: "#10b98118" };
    if (ss === "expiring") return { label: `⚠ ${daysLeft(u.subscription_end)} дн.`, color: "#f59e0b", bg: "#f59e0b18" };
    if (ss === "expired")  return { label: "Истекла", color: "#ef4444", bg: "#ef444418" };
    return null;
  };

  return (
    <div className="flex h-[calc(100vh-112px)]">

      {/* ─── Основная часть ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Панель фильтров */}
        <div className="px-5 py-3 border-b border-white/[0.06] flex-shrink-0" style={{ background: "#07070f" }}>

          {/* Строка 1: поиск + сортировка */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input value={search} onChange={e => onSearch(e.target.value)}
                placeholder="Поиск по имени или email..."
                className="w-full rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
            </div>
            <button onClick={() => setSortBy(s => s === "created" ? "sub_end" : "created")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold flex-shrink-0 transition"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Icon name="ArrowUpDown" size={11} />
              {sortBy === "created" ? "по дате" : "по подписке"}
            </button>
          </div>

          {/* Строка 2: фильтры ролей + подписка */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Кнопка «Все» */}
            <button onClick={() => setRoleFilters(new Set())}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border"
              style={roleFilters.size === 0
                ? { background: "#fff", color: "#07070f", borderColor: "#fff" }
                : { background: "transparent", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
              Все
            </button>

            <div className="w-px h-4 bg-white/[0.08] flex-shrink-0" />

            {/* Группа «без подписки»: Клиент / Дизайнер / Прораб */}
            <span className="text-[9px] text-white/20 uppercase tracking-wider">без подписки</span>
            {(["client","designer","foreman"] as const).map(role => {
              const r = ROLE_LABELS[role];
              const active = roleFilters.has(role);
              return (
                <button key={role} onClick={() => toggleRole(role)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border"
                  style={active
                    ? { background: r.color + "25", color: r.color, borderColor: r.color + "50" }
                    : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
                  {r.label}
                </button>
              );
            })}

            <div className="w-px h-4 bg-white/[0.08] flex-shrink-0" />

            {/* Группа «с подпиской»: Монтажник / Компания */}
            <span className="text-[9px] text-white/20 uppercase tracking-wider">с подпиской</span>
            {(["installer","company"] as const).map(role => {
              const r = ROLE_LABELS[role];
              const active = roleFilters.has(role);
              return (
                <button key={role} onClick={() => toggleRole(role)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border"
                  style={active
                    ? { background: r.color + "25", color: r.color, borderColor: r.color + "50" }
                    : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
                  {r.label}
                </button>
              );
            })}

            <div className="w-px h-4 bg-white/[0.08] flex-shrink-0" />

            {/* Фильтр подписки */}
            {SUB_FILTERS.slice(1).map(f => (
              <button key={f.id} onClick={() => setSubFilter(s => s === f.id ? "all" : f.id)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border"
                style={subFilter === f.id
                  ? { background: f.color + "25", color: f.color, borderColor: f.color + "50" }
                  : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
                {f.label}
              </button>
            ))}

            <span className="ml-auto text-[10px] text-white/25">{filtered.length} польз.</span>
          </div>
        </div>

        {/* Таблица */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.12)" }}>
              <Icon name="SearchX" size={36} />
              <span className="text-sm">Никого не найдено</span>
            </div>
          ) : (
            <>
              {/* Шапка таблицы */}
              <div className="grid px-5 py-2 border-b border-white/[0.05] sticky top-0 z-10"
                style={{ gridTemplateColumns: "minmax(0,2fr) 140px 130px 80px 40px", background: "#07070f" }}>
                {["Пользователь", "Роль", "Подписка", "Смет", ""].map(h => (
                  <div key={h} className="text-[10px] font-bold text-white/22 uppercase tracking-wider">{h}</div>
                ))}
              </div>

              <div className="divide-y divide-white/[0.04]">
                {filtered.map(u => {
                  const badge = subBadge(u);
                  const isSelected = selectedUser?.id === u.id;
                  const roleColor = ROLE_LABELS[u.role]?.color ?? "#94a3b8";
                  return (
                    <div key={u.id}
                      onClick={() => onSelectUser(u)}
                      className="grid items-center px-5 py-3.5 cursor-pointer transition hover:bg-white/[0.025]"
                      style={{
                        gridTemplateColumns: "minmax(0,2fr) 140px 130px 80px 40px",
                        background: isSelected ? "rgba(255,255,255,0.04)" : undefined,
                        borderLeft: isSelected ? "3px solid rgba(255,255,255,0.3)" : "3px solid transparent",
                      }}>

                      {/* Пользователь */}
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

                      {/* Роль */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <RoleBadge role={u.role} />
                        {u.rejected && (
                          <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: "#ef444415", color: "#ef4444" }}>откл.</span>
                        )}
                        {!u.approved && !u.rejected && ["installer","company"].includes(u.role) && (
                          <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: "#f59e0b15", color: "#f59e0b" }}>ожидает</span>
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
                        {u.estimates_count > 0
                          ? <span className="text-xs font-bold" style={{ color: "#10b981" }}>{u.estimates_count}</span>
                          : <span className="text-[10px] text-white/20">0</span>}
                      </div>

                      {/* Шеврон */}
                      <div className="flex justify-end">
                        <Icon name="ChevronRight" size={13}
                          style={{ color: isSelected ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Правая панель ─── */}
      <div className="w-[320px] flex-shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden"
        style={{ background: "#08080f" }}>
        {!selectedUser ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8"
            style={{ color: "rgba(255,255,255,0.12)" }}>
            <Icon name="MousePointerClick" size={28} />
            <span className="text-xs text-center">Нажмите на строку чтобы открыть детали</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">

            {/* Шапка */}
            <div className="p-5 border-b border-white/[0.05]">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
                  style={{
                    background: (ROLE_LABELS[selectedUser.role]?.color ?? "#94a3b8") + "18",
                    color: ROLE_LABELS[selectedUser.role]?.color ?? "#94a3b8",
                  }}>
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
                { label: "ID",             value: `#${selectedUser.id}` },
                { label: "Зарег.",         value: fmtDate(selectedUser.created_at) },
                { label: "Телефон",        value: selectedUser.phone || "—" },
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
                      <button key={opt.days} onClick={() => doExtend(selectedUser.id, opt.days)} disabled={subLoading}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white disabled:opacity-50"
                        style={{ background: "#7c3aed" }}>
                        {subLoading ? "..." : opt.label}
                      </button>
                    ))}
                    <button onClick={() => setSubUserId(null)} className="text-white/25 hover:text-white/50 ml-1">
                      <Icon name="X" size={11} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setSubUserId(selectedUser.id)}
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
              <button onClick={() => setConfirmDel(selectedUser)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition"
                style={{ background: "#ef444410", color: "#ef4444", border: "1px solid #ef444420" }}>
                <Icon name="Trash2" size={12} /> Удалить пользователя
              </button>
            </div>
          </div>
        )}
      </div>

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
            <div className="text-xs text-white/35 mb-4">{confirmDel.name || confirmDel.email}</div>
            <div className="text-xs text-red-300/65 bg-red-500/08 border border-red-500/15 rounded-xl px-3 py-2 mb-5">
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
    </div>
  );
}