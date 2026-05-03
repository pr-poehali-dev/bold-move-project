import Icon from "@/components/ui/icon";
import { MobileTabMenu, TabConfig, MainTab } from "./AdminPanelDropdowns";

interface User {
  id?: number;
  name?: string | null;
  email?: string | null;
  role?: string;
  is_master?: boolean;
  has_own_agent?: boolean;
  company_id?: number | null;
}

interface Props {
  user: User | null;
  isDark: boolean;
  mainTab: MainTab;
  mainTabs: TabConfig[];
  headerBg: string;
  headerBorder: string;
  headerText: string;
  toggleTheme: () => void;
  safeSetMainTab: (t: MainTab) => void;
  logout: () => void;
}

export function AdminPanelHeader({
  user, isDark, mainTab, mainTabs,
  headerBg, headerBorder, headerText,
  toggleTheme, safeSetMainTab, logout,
}: Props) {
  const masterToken = localStorage.getItem("mp_master_token");
  const masterName  = localStorage.getItem("mp_master_name") || "Мастер";

  const exitImpersonate = () => {
    localStorage.setItem("mp_user_token", masterToken!);
    localStorage.removeItem("mp_master_token");
    localStorage.removeItem("mp_master_name");
    window.location.href = "/whitelabel";
  };

  return (
    <>
      {/* Баннер режима просмотра (мастер смотрит чужой аккаунт) */}
      {masterToken && (
        <div className="flex items-center justify-between px-3 py-2 text-xs gap-2"
          style={{ background: "#92400e", borderBottom: "1px solid #b45309" }}>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon name="Eye" size={13} style={{ color: "#fde68a", flexShrink: 0 }} />
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                style={{ background: "#d97706", color: "#0a0a14" }}>
                {(user?.name || user?.email || "?")[0].toUpperCase()}
              </div>
              <span className="font-black truncate" style={{ color: "#fff" }}>
                {user?.name || user?.email?.split("@")[0]}
              </span>
              {user?.email && user?.name && (
                <span className="hidden sm:inline" style={{ color: "#fbbf24" }}>{user.email}</span>
              )}
            </div>
            <span className="hidden sm:inline px-2 py-0.5 rounded text-[9px] font-black uppercase flex-shrink-0"
              style={{ background: "rgba(0,0,0,0.25)", color: "#fde68a" }}>
              ID #{user?.id}
            </span>
            <span className="hidden sm:inline px-2 py-0.5 rounded text-[9px] font-black uppercase flex-shrink-0"
              style={{ background: "rgba(0,0,0,0.25)", color: "#fde68a" }}>
              {user?.role === "company" ? "Компания" : user?.role === "manager" ? "Менеджер" : user?.role || "—"}
            </span>
          </div>

          <button onClick={exitImpersonate}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition hover:opacity-80 whitespace-nowrap flex-shrink-0"
            style={{ background: "rgba(0,0,0,0.30)", color: "#fde68a", border: "1px solid rgba(253,230,138,0.25)" }}>
            <Icon name="LogOut" size={11} />
            <span className="hidden sm:inline">Выйти из аккаунта</span>
            <span className="sm:hidden">Выйти</span>
            <span className="hidden sm:inline font-bold">({masterName})</span>
          </button>
        </div>
      )}

      {/* Строка 1: логотип + юзер + выход */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 flex-shrink-0 transition-colors duration-300"
        style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}` }}>

        <a href={(() => { const ownerId = user?.has_own_agent ? user.id : user?.company_id; return ownerId ? `/?c=${ownerId}` : "/"; })()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition hover:opacity-80 flex-shrink-0"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", color: isDark ? "rgba(255,255,255,0.45)" : "#374151", border: `1px solid ${headerBorder}` }}>
          <Icon name="ArrowLeft" size={12} />
          <span className="hidden sm:inline">В бот</span>
        </a>
        <Icon name="BrainCircuit" size={18} className="text-violet-400 flex-shrink-0" />

        <MobileTabMenu
          mainTab={mainTab}
          isDark={isDark}
          tabs={mainTabs}
          onSelect={safeSetMainTab}
        />

        <span className="font-semibold hidden sm:block flex-1" style={{ color: headerText }}>Панель управления</span>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <button onClick={toggleTheme}
            className="p-1.5 rounded-xl transition"
            style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", border: `1px solid ${headerBorder}`, color: isDark ? "rgba(255,255,255,0.5)" : "#374151" }}>
            <Icon name={isDark ? "Sun" : "Moon"} size={13} />
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: user?.is_master ? "rgba(239,68,68,0.12)" : "rgba(124,58,237,0.12)", border: `1px solid ${user?.is_master ? "rgba(239,68,68,0.25)" : "rgba(124,58,237,0.25)"}` }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: user?.is_master ? "#ef4444" : "#7c3aed" }}>
              {(user?.name || user?.email || "?")[0].toUpperCase()}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-semibold" style={{ color: user?.is_master ? "#fca5a5" : "#c4b5fd" }}>
                {user?.name || user?.email?.split("@")[0] || "—"}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: user?.is_master ? "#ef4444" : "#7c3aed" }}>
                {user?.is_master ? "Мастер" : user?.role === "company" ? "Компания" : user?.role === "manager" ? "Менеджер" : user?.role === "installer" ? "Монтажник" : user?.role || "—"}
              </span>
            </div>
          </div>
          <button onClick={logout} className="p-1.5 transition"
            style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#374151" }}>
            <Icon name="LogOut" size={15} />
          </button>
        </div>
      </div>

      {/* Строка 2: главные табы — только на десктопе */}
      <div className="hidden sm:flex items-end gap-1 pt-2 flex-shrink-0 overflow-x-auto transition-colors duration-300 px-4"
        style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}`, scrollbarWidth: "none" }}>
        {mainTabs.map(tb => (
          <button key={tb.id} onClick={() => safeSetMainTab(tb.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition whitespace-nowrap flex-shrink-0 ${
              mainTab === tb.id
                ? isDark ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500" : "bg-violet-600/10 text-violet-700 border-b-2 border-violet-600"
                : isDark ? "text-white/50 hover:text-white/80" : "text-gray-500 hover:text-gray-800"
            }`}>
            <Icon name={tb.icon} size={14} />
            {tb.label}
          </button>
        ))}
      </div>
    </>
  );
}
