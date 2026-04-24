import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];
const MASTER_PASSWORD = "MasterYura2024!";

interface AppUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
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

export default function MasterAdmin() {
  const [authed,  setAuthed]  = useState(() => sessionStorage.getItem("master_token") === MASTER_PASSWORD);
  const [pass,    setPass]    = useState("");
  const [passErr, setPassErr] = useState("");

  const [users,       setUsers]       = useState<AppUser[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [userEstimates, setUserEstimates] = useState<UserEstimate[]>([]);
  const [estLoading,  setEstLoading]  = useState(false);
  const [search,      setSearch]      = useState("");

  const login = () => {
    if (pass === MASTER_PASSWORD) {
      sessionStorage.setItem("master_token", pass);
      setAuthed(true);
    } else {
      setPassErr("Неверный пароль");
    }
  };

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetch(`${AUTH_URL}?action=admin-users`)
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [authed]);

  const openUser = async (user: AppUser) => {
    setSelectedUser(user);
    setEstLoading(true);
    const res  = await fetch(`${AUTH_URL}?action=admin-user-estimates&user_id=${user.id}`);
    const data = await res.json();
    setUserEstimates(data.estimates || []);
    setEstLoading(false);
  };

  const filtered = users.filter(u =>
    !search ||
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.name  || "").toLowerCase().includes(search.toLowerCase())
  );

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
          <button onClick={login}
            className="w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: "#10b981" }}>
            Войти
          </button>
        </div>
      </div>
    );
  }

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

      <div className="flex h-[calc(100vh-65px)]">

        {/* Левая: список пользователей */}
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
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-xs text-white/20">Пользователей нет</div>
            ) : filtered.map(u => (
              <button key={u.id} onClick={() => openUser(u)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left transition border-b border-white/[0.04] hover:bg-white/[0.03]"
                style={selectedUser?.id === u.id ? { background: "rgba(16,185,129,0.08)" } : {}}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "#10b98120", color: "#10b981" }}>
                  {(u.name || u.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate text-white/90">{u.name || "—"}</div>
                  <div className="text-xs truncate text-white/30">{u.email}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-white/20">{new Date(u.created_at).toLocaleDateString("ru-RU")}</span>
                    {u.estimates_count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                        style={{ background: "#7c3aed18", color: "#a78bfa" }}>
                        {u.estimates_count} смет{u.estimates_count > 4 ? "" : u.estimates_count > 1 ? "ы" : "а"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Правая: детали пользователя */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedUser ? (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
              <Icon name="Users" size={40} className="opacity-30" />
              <span className="text-sm">Выберите пользователя</span>
            </div>
          ) : (
            <div className="max-w-2xl">
              {/* Профиль */}
              <div className="flex items-center gap-4 mb-6 p-5 rounded-2xl"
                style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                  style={{ background: "#10b98120", color: "#10b981" }}>
                  {(selectedUser.name || selectedUser.email || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold text-white">{selectedUser.name || "—"}</div>
                  <div className="text-sm text-white/40">{selectedUser.email}</div>
                  {selectedUser.phone && <div className="text-sm text-white/40">{selectedUser.phone}</div>}
                  <div className="text-xs text-white/20 mt-1">
                    Зарегистрирован: {new Date(selectedUser.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black" style={{ color: "#10b981" }}>{selectedUser.estimates_count}</div>
                  <div className="text-xs text-white/30">смет сохранено</div>
                </div>
              </div>

              {/* Сметы пользователя */}
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
    </div>
  );
}
