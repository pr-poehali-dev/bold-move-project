import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];
const MASTER_PASSWORD = "Sdauxbasstre228";

type MasterTab = "pending" | "pro" | "all";

interface PendingUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  discount: number;
  created_at: string;
}

interface ProUser extends PendingUser {
  approved: boolean;
}

interface AppUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  approved: boolean;
  discount: number;
  created_at: string;
  estimates_count: number;
}

interface UserEstimate {
  id: number;
  title: string;
  total_standard: number | null;
  status: string;
  created_at: string;
  crm_status: string | null;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  client:    { label: "Клиент",    color: "#f97316" },
  designer:  { label: "Дизайнер",  color: "#a78bfa" },
  foreman:   { label: "Прораб",    color: "#34d399" },
  installer: { label: "Монтажник", color: "#60a5fa" },
  company:   { label: "Компания",  color: "#f59e0b" },
  manager:   { label: "Менеджер",  color: "#94a3b8" },
};

function RoleBadge({ role }: { role: string }) {
  const r = ROLE_LABELS[role] ?? { label: role, color: "#94a3b8" };
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold"
      style={{ background: r.color + "20", color: r.color }}>
      {r.label}
    </span>
  );
}

export default function MasterAdmin() {
  const [authed,  setAuthed]  = useState(() => sessionStorage.getItem("master_token") === MASTER_PASSWORD);
  const [pass,    setPass]    = useState("");
  const [passErr, setPassErr] = useState("");
  const [tab,     setTab]     = useState<MasterTab>("pending");

  // Pending (business)
  const [pendingBiz,    setPendingBiz]    = useState<PendingUser[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approvingId,   setApprovingId]   = useState<number | null>(null);

  // Pro users (designer/foreman)
  const [proUsers,    setProUsers]    = useState<ProUser[]>([]);
  const [proLoading,  setProLoading]  = useState(false);
  const [editDiscount, setEditDiscount] = useState<{ id: number; value: string } | null>(null);
  const [savingDiscount, setSavingDiscount] = useState(false);

  // All users
  const [users,         setUsers]         = useState<AppUser[]>([]);
  const [allLoading,    setAllLoading]    = useState(false);
  const [selectedUser,  setSelectedUser]  = useState<AppUser | null>(null);
  const [userEstimates, setUserEstimates] = useState<UserEstimate[]>([]);
  const [estLoading,    setEstLoading]    = useState(false);
  const [search,        setSearch]        = useState("");

  const login = () => {
    if (pass === MASTER_PASSWORD) {
      sessionStorage.setItem("master_token", pass);
      setAuthed(true);
    } else {
      setPassErr("Неверный пароль");
    }
  };

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    const r = await fetch(`${AUTH_URL}?action=pending-users&role_group=business`);
    const d = await r.json();
    setPendingBiz(d.users || []);
    setPendingLoading(false);
  }, []);

  const loadPro = useCallback(async () => {
    setProLoading(true);
    const r = await fetch(`${AUTH_URL}?action=pro-users`);
    const d = await r.json();
    setProUsers(d.users || []);
    setProLoading(false);
  }, []);

  const loadAll = useCallback(async () => {
    setAllLoading(true);
    const r = await fetch(`${AUTH_URL}?action=admin-users`);
    const d = await r.json();
    setUsers(d.users || []);
    setAllLoading(false);
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadPending();
  }, [authed, loadPending]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "pending") loadPending();
    else if (tab === "pro") loadPro();
    else if (tab === "all") loadAll();
  }, [tab, authed, loadPending, loadPro, loadAll]);

  const approveUser = async (id: number) => {
    setApprovingId(id);
    await fetch(`${AUTH_URL}?action=approve-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });
    setApprovingId(null);
    loadPending();
  };

  const saveDiscount = async () => {
    if (!editDiscount) return;
    setSavingDiscount(true);
    await fetch(`${AUTH_URL}?action=set-discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: editDiscount.id, discount: parseInt(editDiscount.value) || 0 }),
    });
    setSavingDiscount(false);
    setEditDiscount(null);
    loadPro();
  };

  const openUser = async (user: AppUser) => {
    setSelectedUser(user);
    setEstLoading(true);
    const res  = await fetch(`${AUTH_URL}?action=admin-user-estimates&user_id=${user.id}`);
    const data = await res.json();
    setUserEstimates(data.estimates || []);
    setEstLoading(false);
  };

  const filteredAll = users.filter(u =>
    !search ||
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.name  || "").toLowerCase().includes(search.toLowerCase())
  );

  // ── Экран входа ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
        <div className="rounded-2xl p-8 w-full max-w-sm shadow-2xl"
          style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Icon name="ShieldCheck" size={20} style={{ color: "#10b981" }} />
            </div>
            <div>
              <div className="text-base font-bold text-white">Мастер-Админка</div>
              <div className="text-xs text-white/30">SaaS управление</div>
            </div>
          </div>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            placeholder="Пароль"
            className="w-full rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} />
          {passErr && <p className="text-red-400 text-xs mb-3">{passErr}</p>}
          <button onClick={login} className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "#10b981" }}>
            Войти
          </button>
        </div>
      </div>
    );
  }

  const TABS: { id: MasterTab; label: string; icon: string; badge?: number }[] = [
    { id: "pending",  label: "Ожидают одобрения", icon: "Clock",      badge: pendingBiz.length },
    { id: "pro",      label: "Дизайнеры / Прорабы", icon: "Star" },
    { id: "all",      label: "Все пользователи",  icon: "Users" },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] text-white">

      {/* Шапка */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Icon name="ShieldCheck" size={17} style={{ color: "#10b981" }} />
          </div>
          <div>
            <div className="font-bold text-sm">Мастер-Админка</div>
            <div className="text-[11px] text-white/30">SaaS — управление пользователями</div>
          </div>
        </div>
        <button onClick={() => { sessionStorage.removeItem("master_token"); setAuthed(false); }}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
          <Icon name="LogOut" size={14} /> Выйти
        </button>
      </div>

      {/* Табы */}
      <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-white/[0.06]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition"
            style={tab === t.id
              ? { background: "#10b98115", color: "#10b981", borderBottom: "2px solid #10b981" }
              : { color: "rgba(255,255,255,0.35)" }}>
            <Icon name={t.icon} size={13} />
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "#ef4444", color: "#fff" }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Вкладка: Ожидают одобрения ── */}
      {tab === "pending" && (
        <div className="p-6 max-w-3xl mx-auto">
          {pendingLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingBiz.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
              <Icon name="CheckCircle2" size={40} />
              <span className="text-sm">Нет заявок на одобрение</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-white/30 mb-4">
                {pendingBiz.length} {pendingBiz.length === 1 ? "заявка" : pendingBiz.length < 5 ? "заявки" : "заявок"} ожидают одобрения
              </div>
              {pendingBiz.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                  style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "#10b98120", color: "#10b981" }}>
                    {(u.name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{u.name || "—"}</span>
                      <RoleBadge role={u.role} />
                    </div>
                    <div className="text-xs text-white/35 mt-0.5">{u.email}</div>
                    {u.phone && <div className="text-xs text-white/25">{u.phone}</div>}
                    <div className="text-[10px] text-white/20 mt-1">
                      Зарегистрирован: {new Date(u.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                    </div>
                  </div>
                  <button onClick={() => approveUser(u.id)} disabled={approvingId === u.id}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
                    style={{ background: "#10b981" }}>
                    {approvingId === u.id
                      ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Icon name="CheckCircle2" size={14} />}
                    Одобрить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Вкладка: Дизайнеры / Прорабы ── */}
      {tab === "pro" && (
        <div className="p-6 max-w-3xl mx-auto">
          {proLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : proUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
              <Icon name="Star" size={40} />
              <span className="text-sm">Дизайнеров и прорабов пока нет</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-white/30 mb-4">{proUsers.length} профессиональных пользователей</div>
              {proUsers.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                  style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                    {(u.name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{u.name || "—"}</span>
                      <RoleBadge role={u.role} />
                      {!u.approved && (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-red-500/20 text-red-400">не одобрен</span>
                      )}
                    </div>
                    <div className="text-xs text-white/35 mt-0.5">{u.email}</div>
                    {u.phone && <div className="text-xs text-white/25">{u.phone}</div>}
                  </div>

                  {/* Скидка */}
                  <div className="flex items-center gap-2">
                    {editDiscount?.id === u.id ? (
                      <>
                        <input type="number" min={0} max={100}
                          value={editDiscount.value}
                          onChange={e => setEditDiscount({ id: u.id, value: e.target.value })}
                          className="w-16 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }} />
                        <span className="text-xs text-white/40">%</span>
                        <button onClick={saveDiscount} disabled={savingDiscount}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                          style={{ background: "#a78bfa" }}>
                          {savingDiscount ? "..." : "✓"}
                        </button>
                        <button onClick={() => setEditDiscount(null)}
                          className="px-2 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 transition">
                          ✕
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setEditDiscount({ id: u.id, value: String(u.discount) })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                        style={{ background: "#a78bfa20", color: "#a78bfa" }}>
                        <Icon name="Percent" size={12} />
                        {u.discount}% скидка
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Вкладка: Все пользователи ── */}
      {tab === "all" && (
        <div className="flex h-[calc(100vh-120px)]">
          {/* Левая: список */}
          <div className="w-80 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white">Пользователи</span>
                <span className="text-xs px-2 py-0.5 rounded-lg font-bold"
                  style={{ background: "#10b98120", color: "#10b981" }}>{users.length}</span>
              </div>
              <div className="relative">
                <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск..."
                  className="w-full rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {allLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredAll.map(u => (
                <button key={u.id} onClick={() => openUser(u)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition border-b border-white/[0.04] hover:bg-white/[0.03]"
                  style={selectedUser?.id === u.id ? { background: "rgba(16,185,129,0.08)" } : {}}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "#10b98120", color: "#10b981" }}>
                    {(u.name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold truncate text-white/90">{u.name || "—"}</span>
                      <RoleBadge role={u.role} />
                    </div>
                    <div className="text-xs truncate text-white/30">{u.email}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/20">{new Date(u.created_at).toLocaleDateString("ru-RU")}</span>
                      {!u.approved && (
                        <span className="text-[10px] text-red-400">ожидает</span>
                      )}
                      {u.estimates_count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                          style={{ background: "#7c3aed18", color: "#a78bfa" }}>
                          {u.estimates_count} смет
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
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
              <div className="max-w-2xl">
                <div className="flex items-center gap-4 mb-6 p-5 rounded-2xl"
                  style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                    style={{ background: "#10b98120", color: "#10b981" }}>
                    {(selectedUser.name || selectedUser.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-white">{selectedUser.name || "—"}</span>
                      <RoleBadge role={selectedUser.role} />
                      {!selectedUser.approved && (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-amber-500/20 text-amber-400">ожидает одобрения</span>
                      )}
                    </div>
                    <div className="text-sm text-white/40">{selectedUser.email}</div>
                    {selectedUser.phone && <div className="text-sm text-white/40">{selectedUser.phone}</div>}
                    {selectedUser.discount > 0 && (
                      <div className="text-xs text-violet-300 mt-1">Скидка: {selectedUser.discount}%</div>
                    )}
                    <div className="text-xs text-white/20 mt-1">
                      Зарегистрирован: {new Date(selectedUser.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black" style={{ color: "#10b981" }}>{selectedUser.estimates_count}</div>
                    <div className="text-xs text-white/30">смет сохранено</div>
                  </div>
                </div>

                {!selectedUser.approved && (
                  <button onClick={() => approveUser(selectedUser.id)} disabled={approvingId === selectedUser.id}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white mb-4 transition disabled:opacity-50"
                    style={{ background: "#10b981" }}>
                    {approvingId === selectedUser.id
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Icon name="CheckCircle2" size={16} />}
                    Одобрить доступ
                  </button>
                )}

                <div>
                  <div className="text-sm font-bold mb-3 text-white/70">Сметы и заявки</div>
                  {estLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : userEstimates.length === 0 ? (
                    <div className="text-center py-8 text-sm text-white/20">Смет нет</div>
                  ) : (
                    <div className="space-y-2">
                      {userEstimates.map(e => (
                        <div key={e.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                          style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: "#7c3aed18" }}>
                            <Icon name="FileSpreadsheet" size={14} style={{ color: "#a78bfa" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{e.title}</div>
                            <div className="text-xs text-white/30 mt-0.5">
                              {new Date(e.created_at).toLocaleDateString("ru-RU")}
                              {e.crm_status && <span className="ml-2 text-violet-300">· {e.crm_status}</span>}
                            </div>
                          </div>
                          {e.total_standard && (
                            <div className="text-sm font-bold text-emerald-400 flex-shrink-0">
                              {Math.round(e.total_standard).toLocaleString("ru-RU")} ₽
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
