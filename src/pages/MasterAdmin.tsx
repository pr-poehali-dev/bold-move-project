import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";
import { TOKEN_KEY } from "@/context/useAuthInit";
import { masterHeaders } from "./masterAuthFetch";
import type { MasterTab, BusinessUser, AppUser, UserEstimate, AdminStats } from "./masterAdminTypes";
import MasterTabAllUsers      from "./MasterTabAllUsers";
import MasterTabCompanies     from "./MasterTabCompanies";
import MasterTabDashboard     from "./MasterTabDashboard";
import MasterTabWhiteLabel    from "./MasterTabWhiteLabel";
import { WLStaff }            from "./whitelabel/WLStaff";
import TabDefaultAutoRules    from "./admin/TabDefaultAutoRules";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type AuthState = "checking" | "authed" | "denied";

export default function MasterAdmin() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [tab,     setTab]     = useState<MasterTab>("dashboard");

  // Stats
  const [stats,        setStats]        = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Business (компании и монтажники — используется во вкладке "Компании")
  const [bizUsers,   setBizUsers]   = useState<BusinessUser[]>([]);
  const [bizLoading, setBizLoading] = useState(false);

  // All users
  const [users,         setUsers]         = useState<AppUser[]>([]);
  const [allLoading,    setAllLoading]    = useState(false);
  const [selectedUser,  setSelectedUser]  = useState<AppUser | null>(null);
  const [userEstimates, setUserEstimates] = useState<UserEstimate[]>([]);
  const [estLoading,    setEstLoading]    = useState(false);
  const [search,        setSearch]        = useState("");
  const [approvingId,   setApprovingId]   = useState<number | null>(null);

  // Проверяем через backend, что текущий залогиненный пользователь — реальный мастер-аккаунт
  useEffect(() => {
    const checkMaster = async () => {
      const userToken = localStorage.getItem(TOKEN_KEY) || "";
      if (!userToken) { setAuthState("denied"); return; }
      try {
        const r = await fetch(`${AUTH_URL}?action=check-master`, {
          headers: { "X-Authorization": `Bearer ${userToken}` },
        });
        const d = await r.json();
        setAuthState(d.is_master ? "authed" : "denied");
      } catch {
        setAuthState("denied");
      }
    };
    checkMaster();
  }, []);

  const authed = authState === "authed";

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const r = await fetch(`${AUTH_URL}?action=admin-stats`, { headers: masterHeaders() });
    const d = await r.json();
    setStats(d);
    setStatsLoading(false);
  }, []);

  const loadBiz = useCallback(async () => {
    setBizLoading(true);
    const r = await fetch(`${AUTH_URL}?action=business-users&status=all`, { headers: masterHeaders() });
    const d = await r.json();
    setBizUsers(d.users || []);
    setBizLoading(false);
  }, []);

  const loadAll = useCallback(async () => {
    setAllLoading(true);
    const r = await fetch(`${AUTH_URL}?action=admin-users`, { headers: masterHeaders() });
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
    if (tab === "dashboard")  loadStats();
    else if (tab === "users") loadAll();
    else if (tab === "companies") loadBiz();
  }, [tab, authed, loadStats, loadBiz, loadAll]);

  const approveUser = async (id: number) => {
    setApprovingId(id);
    await fetch(`${AUTH_URL}?action=approve-user`, {
      method: "POST", headers: masterHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: id }),
    });
    setApprovingId(null);
    loadAll();
  };

  const openUser = async (user: AppUser) => {
    setSelectedUser(user);
    setEstLoading(true);
    const res  = await fetch(`${AUTH_URL}?action=admin-user-estimates&user_id=${user.id}`, { headers: masterHeaders() });
    const data = await res.json();
    setUserEstimates(data.estimates || []);
    setEstLoading(false);
  };

  const pendingCount = bizUsers.filter(u => !u.approved && !u.rejected).length;

  // ── Проверка доступа ──
  if (authState === "checking") {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authState === "denied") {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center px-4">
        <div className="rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center"
          style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <Icon name="ShieldAlert" size={20} style={{ color: "#ef4444" }} />
          </div>
          <div className="text-base font-bold text-white mb-1">Доступ закрыт</div>
          <p className="text-xs text-white/35 mb-5">
            Мастер-админка доступна только мастер-аккаунту. Войдите на сайте под своей учётной записью.
          </p>
          <a href="/" className="block w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: "#10b981" }}>
            На главную
          </a>
        </div>
      </div>
    );
  }

  const TABS: { id: MasterTab; label: string; icon: string; badge?: number }[] = [
    { id: "dashboard",  label: "Дашборд",  icon: "LayoutDashboard" },
    { id: "users",      label: "Пользователи", icon: "Users", badge: pendingCount },
    { id: "companies",  label: "Компании", icon: "Building2" },
    { id: "whitelabel", label: "White-Label", icon: "Sparkles" },
    { id: "settings",   label: "Настройки", icon: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] text-white">

      {/* Шапка */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <Icon name="ShieldCheck" size={17} style={{ color: "#10b981" }} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm">Мастер-Админка</div>
            <div className="text-[11px] text-white/30 hidden sm:block">SaaS — управление пользователями</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Icon name="ArrowLeft" size={12} />
            <span className="hidden sm:inline">В бот</span>
          </a>
          <button onClick={() => { localStorage.removeItem(TOKEN_KEY); window.location.href = "/"; }}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
            <Icon name="LogOut" size={14} />
            <span className="hidden sm:inline">Выйти</span>
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

      {tab === "users" && (
        <MasterTabAllUsers
          users={users} loading={allLoading} search={search}
          selectedUser={selectedUser} userEstimates={userEstimates}
          estLoading={estLoading} approvingId={approvingId}
          onSearch={setSearch} onSelectUser={openUser}
          onApprove={approveUser} onReload={loadAll}
        />
      )}

      {tab === "companies" && (
        <MasterTabCompanies
          companies={bizUsers} loading={bizLoading}
          onReload={loadBiz}
          masterToken={localStorage.getItem(TOKEN_KEY)}
        />
      )}

      {tab === "whitelabel" && (
        <div className="space-y-8">
          <MasterTabWhiteLabel />
          <div className="max-w-4xl mx-auto px-5 pb-8">
            <WLStaff />
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="max-w-2xl mx-auto px-5 py-8">
          <TabDefaultAutoRules isDark />
        </div>
      )}
    </div>
  );
}