import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { AUTH_URL, DEMO_ID, DEMO_EMAIL, DEMO_PASSWORD } from "./whitelabel/wlTypes";
import type { CheckResult, WLCompany, PanelView } from "./whitelabel/wlTypes";
import { Section, Field, LinkBtn, Spin, Center } from "./whitelabel/WLHelpers";
import { WLApiTestsModal, useApiChecks } from "./whitelabel/WLApiTests";
import { WLPanelView } from "./whitelabel/WLPanelView";
import { WLSiteParser } from "./whitelabel/WLSiteParser";

export default function WhiteLabel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [results, setResults]         = useState<Record<string, CheckResult | null>>({});
  const [running, setRunning]         = useState<string | null>(null);
  const [previewId, setPreviewId]     = useState("");
  const [panel, setPanel]             = useState<PanelView>(null);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [wlCompanies, setWlCompanies] = useState<WLCompany[]>([]);
  const [wlLoading, setWlLoading]     = useState(false);
  const [apiTestId, setApiTestId]     = useState(DEMO_ID);

  useEffect(() => {
    if (!loading && user && !user.is_master) navigate("/");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user?.is_master) return;
    const token = localStorage.getItem("mp_user_token");
    setWlLoading(true);
    fetch(`${AUTH_URL}?action=admin-wl-companies`, {
      headers: { "X-Authorization": token || "" },
    })
      .then(r => r.json())
      .then(d => setWlCompanies(Array.isArray(d.companies) ? d.companies : []))
      .finally(() => setWlLoading(false));
  }, [user]);

  const setResult = (key: string, r: CheckResult | null) =>
    setResults(prev => ({ ...prev, [key]: r }));

  const { check_brandApi, check_aiChat, check_pdf } = useApiChecks(setResult, setRunning);

  if (loading) return <Center><Spin /><span className="ml-2 text-white/40 text-sm">Загрузка...</span></Center>;
  if (!user)   return <Center><span className="text-white/40 text-sm">Нужно войти как мастер</span></Center>;
  if (!user.is_master) return <Center><span className="text-white/40 text-sm">Доступ только для мастера</span></Center>;

  const check_runAll = async (cid: number) => {
    setApiTestId(cid);
    setResults({ "brand-api": null, "ai-chat": null, "pdf": null });
    await check_brandApi(cid);
    await check_aiChat(cid);
    await check_pdf(cid);
  };

  const loginAsCompany = async (companyId: number) => {
    try {
      const masterToken = localStorage.getItem("mp_user_token");
      await fetch(`${AUTH_URL}?action=admin-ensure-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken || "" },
        body: JSON.stringify({ user_id: companyId }),
      });
      const r = await fetch(`${AUTH_URL}?action=admin-login-as`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken || "" },
        body: JSON.stringify({ user_id: companyId }),
      });
      const d = await r.json();
      if (d.token) {
        setIframeToken(d.token);
        setPanel({ type: "admin", companyId });
      } else {
        alert("Ошибка: " + (d.error || "не удалось получить токен"));
      }
    } catch (e) { alert(String(e)); }
  };

  const openSite = (companyId: number) => setPanel({ type: "site", url: `/?c=${companyId}` });

  // Если открыта панель — показываем встроенный просмотр
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
    <>
      <div className="min-h-screen text-white" style={{ background: "#06060c" }}>

        {/* Шапка */}
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

          {/* Автозаполнение из сайта */}
          <WLSiteParser companyId={DEMO_ID} />

          {/* Демо-компания */}
          <Section title="Демо-компания" icon="Building2" color="#a78bfa">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Email"      value={DEMO_EMAIL} />
              <Field label="Пароль"     value={DEMO_PASSWORD} />
              <Field label="ID"         value={`#${DEMO_ID}`} />
              <Field label="Демо-сайт"  value={`/?c=${DEMO_ID}`} href={`/?c=${DEMO_ID}`} />
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <LinkBtn icon="Globe" label="Открыть их сайт"
                onClick={() => openSite(DEMO_ID)} color="#06b6d4" />
              <LinkBtn icon="LayoutDashboard" label="Войти в их панель"
                onClick={() => loginAsCompany(DEMO_ID)} color="#a78bfa" />
              <LinkBtn icon="Zap" label="Живые API"
                onClick={() => check_runAll(DEMO_ID)} color="#10b981" />
            </div>
          </Section>

          {/* Войти в компанию по ID */}
          <Section title="Войти в компанию по ID" icon="LogIn" color="#f59e0b">
            <p className="text-[11px] text-white/40 mb-3">
              Введи ID компании — открывай их сайт или входи в панель управления прямо здесь
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                min={1}
                value={previewId}
                onChange={e => setPreviewId(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && previewId) openSite(Number(previewId)); }}
                placeholder="ID компании, например: 42"
                className="flex-1 rounded-xl px-3 py-2 text-xs font-mono bg-white/[0.05] border border-white/10 text-white placeholder-white/25 outline-none focus:border-amber-500/50 transition"
              />
            </div>

            {/* Найденная WL-компания */}
            {foundCompany && (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-3"
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
                onClick={() => previewId ? openSite(Number(previewId)) : undefined}
                color="#f59e0b" />
              <LinkBtn icon="LayoutDashboard" label="Войти в их панель"
                onClick={() => previewId ? loginAsCompany(Number(previewId)) : undefined}
                color="#a78bfa" />
              <LinkBtn icon="Zap" label="Живые API"
                onClick={() => previewId ? check_runAll(Number(previewId)) : undefined}
                color="#10b981" />
            </div>
          </Section>

          {/* Список WL-компаний */}
          <Section title="White-Label компании" icon="Sparkles" color="#10b981">
            {wlLoading ? (
              <div className="flex items-center gap-2 py-2 text-white/40 text-xs">
                <Spin /> Загрузка...
              </div>
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
                        {c.support_phone && (
                          <span className="text-[10px] text-white/35 flex-shrink-0">{c.support_phone}</span>
                        )}
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

        </div>
      </div>

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
    </>
  );
}