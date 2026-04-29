import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";
import type { MasterTab, BusinessUser, ProUser, AppUser, UserEstimate, AdminStats } from "./masterAdminTypes";
import MasterTabProfessionals from "./MasterTabProfessionals";
import MasterTabAllUsers      from "./MasterTabAllUsers";
import MasterTabDashboard     from "./MasterTabDashboard";

const AUTH_URL = (func2url as Record<string, string>)["auth"];
const MASTER_PASSWORD = "Sdauxbasstre228";

export default function MasterAdmin() {
  const [authed,  setAuthed]  = useState(() => sessionStorage.getItem("master_token") === MASTER_PASSWORD);
  const [pass,    setPass]    = useState("");
  const [passErr, setPassErr] = useState("");
  const [tab,     setTab]     = useState<MasterTab>("dashboard");

  // Stats
  const [stats,        setStats]        = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Business
  const [bizUsers,   setBizUsers]   = useState<BusinessUser[]>([]);
  const [bizLoading, setBizLoading] = useState(false);

  // Pro
  const [proUsers,       setProUsers]       = useState<ProUser[]>([]);
  const [proLoading,     setProLoading]     = useState(false);
  const [editDiscount,   setEditDiscount]   = useState<{ id: number; value: string } | null>(null);
  const [savingDiscount, setSavingDiscount] = useState(false);

  // All users
  const [users,         setUsers]         = useState<AppUser[]>([]);
  const [allLoading,    setAllLoading]    = useState(false);
  const [selectedUser,  setSelectedUser]  = useState<AppUser | null>(null);
  const [userEstimates, setUserEstimates] = useState<UserEstimate[]>([]);
  const [estLoading,    setEstLoading]    = useState(false);
  const [search,        setSearch]        = useState("");
  const [approvingId,   setApprovingId]   = useState<number | null>(null);

  const login = () => {
    if (pass === MASTER_PASSWORD) {
      sessionStorage.setItem("master_token", pass);
      setAuthed(true);
    } else {
      setPassErr("Неверный пароль");
    }
  };

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const r = await fetch(`${AUTH_URL}?action=admin-stats`);
    const d = await r.json();
    setStats(d);
    setStatsLoading(false);
  }, []);

  const loadBiz = useCallback(async () => {
    setBizLoading(true);
    const r = await fetch(`${AUTH_URL}?action=business-users&status=all`);
    const d = await r.json();
    setBizUsers(d.users || []);
    setBizLoading(false);
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
    loadStats();
    loadBiz();
  }, [authed, loadStats, loadBiz]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "dashboard")     loadStats();
    else if (tab === "professionals") { loadBiz(); loadPro(); }
    else if (tab === "all")      loadAll();
  }, [tab, authed, loadStats, loadBiz, loadPro, loadAll]);

  const approveUser = async (id: number) => {
    setApprovingId(id);
    await fetch(`${AUTH_URL}?action=approve-user`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });
    setApprovingId(null);
    loadAll();
  };

  const saveDiscount = async () => {
    if (!editDiscount) return;
    setSavingDiscount(true);
    await fetch(`${AUTH_URL}?action=set-discount`, {
      method: "POST", headers: { "Content-Type": "application/json" },
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

  const pendingCount = bizUsers.filter(u => !u.approved && !u.rejected).length;

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
            onKeyDown={e => e.key === "Enter" && login()} placeholder="Пароль"
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
    { id: "dashboard",     label: "Дашборд",         icon: "LayoutDashboard" },
    { id: "professionals", label: "Одобрение",        icon: "Users2", badge: pendingCount },
    { id: "all",           label: "Все пользователи", icon: "Users" },
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
        <div className="flex items-center gap-2">
          <a href="/"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Icon name="ArrowLeft" size={12} />
            В бот
          </a>
          <button onClick={() => { sessionStorage.removeItem("master_token"); setAuthed(false); }}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
            <Icon name="LogOut" size={14} /> Выйти
          </button>
        </div>
      </div>

      {/* Табы */}
      <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-white/[0.06] overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition whitespace-nowrap"
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

      {/* Контент */}
      {tab === "dashboard" && (
        <MasterTabDashboard stats={stats} loading={statsLoading} />
      )}

      {tab === "professionals" && (
        <MasterTabProfessionals
          bizUsers={bizUsers}   bizLoading={bizLoading}
          proUsers={proUsers}   proLoading={proLoading}
          editDiscount={editDiscount} savingDiscount={savingDiscount}
          pendingCount={pendingCount}
          onEditDiscount={setEditDiscount} onSaveDiscount={saveDiscount}
          onReloadBiz={loadBiz} onReloadPro={loadPro}
        />
      )}

      {tab === "all" && (
        <MasterTabAllUsers
          users={users} loading={allLoading} search={search}
          selectedUser={selectedUser} userEstimates={userEstimates}
          estLoading={estLoading} approvingId={approvingId}
          onSearch={setSearch} onSelectUser={openUser}
          onApprove={approveUser} onReload={loadAll}
        />
      )}
    </div>
  );
}