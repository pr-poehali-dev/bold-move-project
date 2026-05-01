import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import type { CheckResult, PanelView } from "./wlTypes";
import { WLApiTestsModal, useApiChecks } from "./WLApiTests";
import { WLPanelView } from "./WLPanelView";
import { WLSiteParser } from "./WLSiteParser";
import { WLPipeline } from "./WLPipeline";
import { useAuth } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

export function WLContent() {
  const navigate  = useNavigate();
  const { updateUser } = useAuth();
  const [results, setResults]           = useState<Record<string, CheckResult | null>>({});
  const [running, setRunning]           = useState<string | null>(null);
  const [panel, setPanel]               = useState<PanelView>(null);
  const [iframeToken, setIframeToken]   = useState<string | null>(null);
  const [apiTestId, setApiTestId]       = useState<number>(0);
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

  // Мастер-токен сохраняем ОДИН РАЗ при монтировании страницы
  // и больше не меняем — он всегда доступен для восстановления
  const masterTokenRef = useState<string | null>(
    () => localStorage.getItem("mp_user_token")
  )[0];

  const handleOpenPanel = (p: PanelView, token?: string) => {
    if (token) setIframeToken(token);
    setPanel(p);
  };

  const handleClosePanel = () => {
    // Восстанавливаем мастер-токен — берём из ref (он не менялся с момента открытия страницы)
    if (masterTokenRef) {
      localStorage.setItem("mp_user_token", masterTokenRef);
      // Перечитываем профиль мастера чтобы AuthContext обновился
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

  return (
    <>
      <div className="min-h-screen text-white" style={{ background: "#06060c" }}>
        <header className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
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
          <h1 className="text-sm font-bold">Стенд White-Label</h1>
          <span className="ml-auto px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
            style={{ background: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)" }}>
            ТОЛЬКО МАСТЕР
          </span>
        </header>

        <div className="max-w-4xl mx-auto px-5 py-8 space-y-8">
          <WLSiteParser
            onCreated={(_companyId, _token) => setRefreshTrigger(t => t + 1)}
          />

          <WLPipeline
            refreshTrigger={refreshTrigger}
            onOpenPanel={handleOpenPanel}
            onRunApiTests={check_runAll}
          />
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