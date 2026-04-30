import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { AUTH_URL, DEMO_ID, DEMO_EMAIL, DEMO_PASSWORD } from "./whitelabel/wlTypes";
import type { CheckResult, PanelView } from "./whitelabel/wlTypes";
import { Section, Field, LinkBtn, Spin, Center } from "./whitelabel/WLHelpers";
import { WLApiTestsModal, useApiChecks } from "./whitelabel/WLApiTests";
import { WLPanelView } from "./whitelabel/WLPanelView";
import { WLSiteParser } from "./whitelabel/WLSiteParser";

export default function WhiteLabel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [results, setResults]           = useState<Record<string, CheckResult | null>>({});
  const [running, setRunning]           = useState<string | null>(null);
  const [panel, setPanel]               = useState<PanelView>(null);
  const [iframeToken, setIframeToken]   = useState<string | null>(null);
  const [apiTestId, setApiTestId]       = useState(DEMO_ID);
  const [parsedDomain, setParsedDomain] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && !user.is_master) navigate("/");
  }, [user, loading, navigate]);

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

  const openSite = async (companyId: number) => {
    const url = `/?c=${companyId}`;
    try {
      const masterToken = localStorage.getItem("mp_user_token");
      // Поднимаем баланс до 10 и синхронизируем имя аккаунта
      await fetch(`${AUTH_URL}?action=admin-ensure-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken || "" },
        body: JSON.stringify({ user_id: companyId, min_balance: 10, sync_name: true }),
      });
      // Получаем токен демо-компании
      const r = await fetch(`${AUTH_URL}?action=admin-login-as`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken || "" },
        body: JSON.stringify({ user_id: companyId }),
      });
      const d = await r.json();
      if (d.token) {
        setPanel({ type: "site-authed", url, token: d.token });
        return;
      }
    } catch { /* ignore, fallback to simple open */ }
    setPanel({ type: "site", url });
  };

  const editBrand = async (companyId: number) => {
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
        setPanel({ type: "agent", companyId });
      } else {
        alert("Ошибка: " + (d.error || "не удалось получить токен"));
      }
    } catch (e) { alert(String(e)); }
  };

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
          <WLSiteParser companyId={DEMO_ID} onParsed={setParsedDomain} />

          {/* Демо-компания */}
          <Section title="Демо-компания" icon="Building2" color="#a78bfa">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Email"      value={DEMO_EMAIL} />
              <Field label="Пароль"     value={DEMO_PASSWORD} />
              <Field label="ID"         value={`#${DEMO_ID}`} />
              <Field
                label="Демо-сайт"
                value={parsedDomain ? `${parsedDomain}/?c=${DEMO_ID}` : `${window.location.origin}/?c=${DEMO_ID}`}
                href={`/?c=${DEMO_ID}`}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <LinkBtn icon="Globe" label="Открыть их сайт"
                onClick={() => openSite(DEMO_ID)} color="#06b6d4" />
              <LinkBtn icon="LayoutDashboard" label="Войти в их панель"
                onClick={() => loginAsCompany(DEMO_ID)} color="#a78bfa" />
              <LinkBtn icon="Zap" label="Живые API"
                onClick={() => check_runAll(DEMO_ID)} color="#10b981" />
              <LinkBtn icon="Pencil" label="Редактировать бренд"
                onClick={() => editBrand(DEMO_ID)} color="#f59e0b" />
            </div>
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