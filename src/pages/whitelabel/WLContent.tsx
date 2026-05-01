import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import type { CheckResult, PanelView } from "./wlTypes";
import { WLApiTestsModal, useApiChecks } from "./WLApiTests";
import { WLPanelView } from "./WLPanelView";
import { WLSiteParser } from "./WLSiteParser";
import { WLPipeline } from "./WLPipeline";
import { WLStaff } from "./WLStaff";
import { useAuth } from "@/context/AuthContext";
import { useWLManager } from "./WLManagerContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type ContentTab = "pipeline" | "staff";

export function WLContent() {
  const navigate  = useNavigate();
  const { updateUser, user } = useAuth();
  const { manager, logout, isMaster } = useWLManager();

  const [tab,           setTab]           = useState<ContentTab>("pipeline");
  const [results,       setResults]       = useState<Record<string, CheckResult | null>>({});
  const [running,       setRunning]       = useState<string | null>(null);
  const [panel,         setPanel]         = useState<PanelView>(null);
  const [iframeToken,   setIframeToken]   = useState<string | null>(null);
  const [apiTestId,     setApiTestId]     = useState<number>(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const setResult = (key: string, r: CheckResult | null) =>
    setResults(prev => ({ ...prev, [key]: r }));

  const { check_brandApi, check_aiChat, check_pdf } = useApiChecks(setResult, setRunning);

  const check_runAll = async (cid: number) => {
    setApiTestId(cid);
    setResults({ "brand-api": null, "ai-chat": null, "pdf": null });
    await check_brandApi(cid);
    await check_aiChat(cid);
    await check_pdf(cid);
  };

  const masterTokenRef = useState<string | null>(
    () => localStorage.getItem("mp_user_token")
  )[0];

  const handleOpenPanel = (p: PanelView, token?: string) => {
    if (token) setIframeToken(token);
    setPanel(p);
  };

  const handleClosePanel = () => {
    if (masterTokenRef) {
      localStorage.setItem("mp_user_token", masterTokenRef);
      fetch(`${AUTH_URL}?action=me`, { headers: { "X-Authorization": `Bearer ${masterTokenRef}` } })
        .then(r => r.json())
        .then(d => { if (d.user) updateUser(d.user); })
        .catch(() => {});
    }
    setPanel(null);
    setIframeToken(null);
  };

  if (panel) {
    return (
      <WLPanelView
        panel={panel}
        iframeToken={iframeToken}
        onClose={handleClosePanel}
      />
    );
  }

  // Кто залогинен
  const displayName = isMaster
    ? (user?.name || "Мастер")
    : (manager?.name || "Менеджер");
  const displayRole = isMaster
    ? "Мастер"
    : manager?.wl_role === "master_manager" ? "Мастер-менеджер" : "Менеджер";

  return (
    <>
      <div className="min-h-screen text-white" style={{ background: "#06060c" }}>
        <header className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
          {isMaster && (
            <>
              <a href="/"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Icon name="ArrowLeft" size={12} /> В бот
              </a>
              <button onClick={() => navigate("/master")}
                className="text-xs text-white/40 hover:text-white/80 flex items-center gap-1">
                <Icon name="ArrowLeft" size={13} /> Мастер
              </button>
              <span className="text-white/20">/</span>
            </>
          )}
          <h1 className="text-sm font-bold">White-Label</h1>

          {/* Вкладки (только мастер и мастер-менеджер видят Сотрудников) */}
          {(isMaster || manager?.wl_role === "master_manager") && (
            <div className="flex items-center gap-1 ml-4"
              style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "3px" }}>
              {([
                { id: "pipeline", label: "Компании", icon: "Building2" },
                { id: "staff",    label: "Сотрудники", icon: "Users" },
              ] as { id: ContentTab; label: string; icon: string }[]).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition"
                  style={{
                    background: tab === t.id ? "rgba(139,92,246,0.2)" : "transparent",
                    color: tab === t.id ? "#a78bfa" : "rgba(255,255,255,0.35)",
                  }}>
                  <Icon name={t.icon} size={11} /> {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Кто вошёл */}
          <div className="ml-auto flex items-center gap-2">
            <div className="text-right">
              <div className="text-[11px] font-bold text-white/70">{displayName}</div>
              <div className="text-[9px] text-white/30">{displayRole}</div>
            </div>
            {!isMaster && (
              <button onClick={logout}
                className="p-1.5 rounded-lg transition hover:bg-white/[0.06]"
                style={{ color: "rgba(255,255,255,0.25)" }}
                title="Выйти">
                <Icon name="LogOut" size={14} />
              </button>
            )}
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-5 py-8 space-y-8">
          {tab === "pipeline" && (
            <>
              {isMaster && (
                <WLSiteParser onCreated={() => setRefreshTrigger(t => t + 1)} />
              )}
              <WLPipeline
                refreshTrigger={refreshTrigger}
                onOpenPanel={handleOpenPanel}
                onRunApiTests={check_runAll}
              />
            </>
          )}
          {tab === "staff" && <WLStaff />}
        </div>
      </div>

      <WLApiTestsModal
        results={results}
        running={running}
        apiTestId={apiTestId}
        onClose={() => setResults({})}
        onSetResult={setResult}
        onSetRunning={setRunning}
        onSetResults={setResults}
        onSetApiTestId={setApiTestId}
      />
    </>
  );
}
