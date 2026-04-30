import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";
import { WLPanelView } from "./whitelabel/WLPanelView";
import { WLApiTestsModal, useApiChecks } from "./whitelabel/WLApiTests";
import type { WLCompany, PanelView, CheckResult } from "./whitelabel/wlTypes";
import { AUTH_URL } from "./whitelabel/wlTypes";

const PARSE_SITE_URL = (func2url as Record<string, string>)["parse-site"];

function Spin() {
  return <div className="w-3 h-3 border-2 border-white/15 border-t-emerald-400 rounded-full animate-spin" />;
}

function LinkBtn({ icon, label, onClick, color, disabled }: {
  icon: string; label: string; onClick: () => void; color: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition disabled:opacity-40"
      style={{ background: `${color}1f`, color, border: `1px solid ${color}40` }}>
      <Icon name={icon} size={12} />{label}
    </button>
  );
}

export default function MasterTabWhiteLabel() {
  const [panel, setPanel]             = useState<PanelView>(null);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [previewId, setPreviewId]     = useState("");
  const [wlCompanies, setWlCompanies] = useState<WLCompany[]>([]);
  const [wlLoading, setWlLoading]     = useState(false);
  const [results, setResults]         = useState<Record<string, CheckResult | null>>({});
  const [running, setRunning]         = useState<string | null>(null);
  const [apiTestId, setApiTestId]     = useState(0);

  const setResult = (key: string, r: CheckResult | null) =>
    setResults(prev => ({ ...prev, [key]: r }));
  const { check_brandApi, check_aiChat, check_pdf } = useApiChecks(setResult, setRunning);

  const masterToken = () => localStorage.getItem("mp_user_token") || "";

  const loadCompanies = async () => {
    setWlLoading(true);
    try {
      const r = await fetch(`${AUTH_URL}?action=admin-wl-companies`, {
        headers: { "X-Authorization": masterToken() },
      });
      const d = await r.json();
      setWlCompanies(Array.isArray(d.companies) ? d.companies : []);
    } finally { setWlLoading(false); }
  };

  useEffect(() => { loadCompanies(); }, []);

  const loginAsCompany = async (companyId: number) => {
    const tok = masterToken();
    await fetch(`${AUTH_URL}?action=admin-ensure-balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": tok },
      body: JSON.stringify({ user_id: companyId }),
    });
    const r = await fetch(`${AUTH_URL}?action=admin-login-as`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": tok },
      body: JSON.stringify({ user_id: companyId }),
    });
    const d = await r.json();
    if (d.token) { setIframeToken(d.token); setPanel({ type: "admin", companyId }); }
    else alert("Ошибка: " + (d.error || "?"));
  };

  const openSite = async (companyId: number) => {
    const tok = masterToken();
    await fetch(`${AUTH_URL}?action=admin-ensure-balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": tok },
      body: JSON.stringify({ user_id: companyId, min_balance: 10, sync_name: true }),
    });
    const r = await fetch(`${AUTH_URL}?action=admin-login-as`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": tok },
      body: JSON.stringify({ user_id: companyId }),
    });
    const d = await r.json();
    if (d.token) { setPanel({ type: "site-authed", url: `/?c=${companyId}`, token: d.token }); }
    else setPanel({ type: "site", url: `/?c=${companyId}` });
  };

  const runAll = async (cid: number) => {
    setApiTestId(cid);
    setResults({ "brand-api": null, "ai-chat": null, "pdf": null });
    await check_brandApi(cid);
    await check_aiChat(cid);
    await check_pdf(cid);
  };

  if (panel) {
    return (
      <WLPanelView
        panel={panel}
        iframeToken={iframeToken}
        onClose={() => { setPanel(null); setIframeToken(null); }}
      />
    );
  }

  const foundCompany = previewId ? wlCompanies.find(c => c.id === Number(previewId)) : null;

  return (
    <div className="px-6 py-6 space-y-6 max-w-4xl">

      {/* Войти в компанию по ID */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f59e0b1f" }}>
            <Icon name="LogIn" size={14} style={{ color: "#f59e0b" }} />
          </div>
          <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: "#f59e0b" }}>Войти в компанию по ID</h2>
        </div>
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[11px] text-white/40">
            Введи ID компании — открывай их сайт или входи в панель управления прямо здесь
          </p>
          <input
            type="number" min={1} value={previewId}
            onChange={e => setPreviewId(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && previewId) openSite(Number(previewId)); }}
            placeholder="ID компании, например: 42"
            className="w-full rounded-xl px-3 py-2 text-xs font-mono bg-white/[0.05] border border-white/10 text-white placeholder-white/25 outline-none focus:border-amber-500/50 transition"
          />

          {foundCompany && (
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: foundCompany.brand_color + "10", border: `1px solid ${foundCompany.brand_color}35` }}>
              <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black"
                style={{ background: foundCompany.brand_color + "25", color: foundCompany.brand_color }}>
                {(foundCompany.company_name || foundCompany.name || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate" style={{ color: foundCompany.brand_color }}>
                  {foundCompany.company_name || foundCompany.name}
                  {foundCompany.bot_name && <span className="ml-2 font-normal text-white/40">бот: {foundCompany.bot_name}</span>}
                </div>
                <div className="text-[10px] text-white/35 truncate">
                  {foundCompany.email}{foundCompany.support_phone ? ` · ${foundCompany.support_phone}` : ""}
                </div>
              </div>
              <div className="text-[10px] font-bold flex-shrink-0"
                style={{ color: foundCompany.estimates_balance > 0 ? "#10b981" : "#ef4444" }}>
                {foundCompany.estimates_balance} смет
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <LinkBtn icon="Globe" label="Открыть их сайт"
              onClick={() => previewId ? openSite(Number(previewId)) : undefined} color="#f59e0b" disabled={!previewId} />
            <LinkBtn icon="LayoutDashboard" label="Войти в их панель"
              onClick={() => previewId ? loginAsCompany(Number(previewId)) : undefined} color="#a78bfa" disabled={!previewId} />
            <LinkBtn icon="Zap" label="Живые API"
              onClick={() => previewId ? runAll(Number(previewId)) : undefined} color="#10b981" disabled={!previewId} />
          </div>
        </div>
      </section>

      {/* Список WL-компаний */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#10b9811f" }}>
              <Icon name="Sparkles" size={14} style={{ color: "#10b981" }} />
            </div>
            <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: "#10b981" }}>
              White-Label компании
            </h2>
          </div>
          <button onClick={loadCompanies} className="text-[10px] text-white/30 hover:text-white/60 transition flex items-center gap-1">
            <Icon name="RefreshCw" size={10} /> Обновить
          </button>
        </div>
        <div className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {wlLoading ? (
            <div className="flex items-center gap-2 py-2 text-white/40 text-xs"><Spin /> Загрузка...</div>
          ) : wlCompanies.length === 0 ? (
            <div className="text-white/30 text-xs py-2">Нет активных WL-компаний</div>
          ) : (
            <div className="space-y-2">
              {wlCompanies.map(c => (
                <div key={c.id} className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black"
                    style={{ background: c.brand_color + "25", color: c.brand_color, border: `1px solid ${c.brand_color}40` }}>
                    {(c.company_name || c.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white/90 truncate">
                        {c.company_name || c.name || c.email}
                      </span>
                      {c.bot_name && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                          style={{ background: c.brand_color + "20", color: c.brand_color }}>
                          бот: {c.bot_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-white/35 truncate">{c.email}</span>
                      {c.support_phone && <span className="text-[10px] text-white/35 flex-shrink-0">{c.support_phone}</span>}
                      <span className="text-[10px] text-white/25 flex-shrink-0">ID #{c.id}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-[10px] font-bold"
                      style={{ color: c.estimates_balance > 0 ? "#10b981" : "#ef4444" }}>
                      {c.estimates_balance} смет
                    </div>
                    <div className="text-[9px] text-white/25">{c.purchased_at || c.created_at}</div>
                  </div>
                  <div className="flex-shrink-0 flex gap-1.5">
                    <button onClick={() => openSite(c.id)}
                      className="p-1.5 rounded-lg transition hover:opacity-80"
                      style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.25)" }}
                      title="Открыть сайт">
                      <Icon name="Globe" size={12} />
                    </button>
                    <button onClick={() => loginAsCompany(c.id)}
                      className="p-1.5 rounded-lg transition hover:opacity-80"
                      style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}
                      title="Войти в панель">
                      <Icon name="LayoutDashboard" size={12} />
                    </button>
                    <button onClick={() => runAll(c.id)}
                      className="p-1.5 rounded-lg transition hover:opacity-80"
                      style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}
                      title="Живые API">
                      <Icon name="Zap" size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Модальное окно тестов API */}
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
    </div>
  );
}
