import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];
const AI_URL   = (func2url as Record<string, string>)["ai-chat"];
const PDF_URL  = (func2url as Record<string, string>)["generate-pdf"];

const DEMO_ID = 14;
const DEMO_EMAIL = "whitelabel-test@demo.local";
const DEMO_PASSWORD = "demo123";

interface CheckResult {
  ok:    boolean;
  label: string;
  data?: string;
}

interface WLCompany {
  id: number;
  email: string;
  name: string;
  company_name: string;
  bot_name: string;
  brand_color: string;
  support_phone: string;
  estimates_balance: number;
  created_at: string;
  purchased_at: string;
}

type PanelView = null | { type: "site"; url: string } | { type: "admin"; companyId: number };

export default function WhiteLabel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [results, setResults]     = useState<Record<string, CheckResult | null>>({});
  const [running, setRunning]     = useState<string | null>(null);
  const [previewId, setPreviewId] = useState("");
  const [panel, setPanel]         = useState<PanelView>(null);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [wlCompanies, setWlCompanies] = useState<WLCompany[]>([]);
  const [wlLoading, setWlLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  if (loading) return <Center><Spin /><span className="ml-2 text-white/40 text-sm">Загрузка...</span></Center>;
  if (!user)   return <Center><span className="text-white/40 text-sm">Нужно войти как мастер</span></Center>;
  if (!user.is_master) return <Center><span className="text-white/40 text-sm">Доступ только для мастера</span></Center>;

  const setResult = (key: string, r: CheckResult | null) =>
    setResults(prev => ({ ...prev, [key]: r }));

  /* ── ПРОВЕРКИ (принимают companyId) ── */

  const check_brandApi = async (cid: number) => {
    setRunning("brand-api"); setResult("brand-api", null);
    try {
      const r = await fetch(`${AUTH_URL}?action=get-brand&company_id=${cid}`);
      const d = await r.json();
      if (d.brand?.bot_name) {
        setResult("brand-api", { ok: true, label: `Бренд получен: бот «${d.brand.bot_name}», цвет ${d.brand.brand_color}, телефон ${d.brand.support_phone}` });
      } else {
        setResult("brand-api", { ok: false, label: "Бренд не вернулся (компания не активна?)" });
      }
    } catch (e) { setResult("brand-api", { ok: false, label: String(e) }); }
    finally { setRunning(null); }
  };

  const check_aiChat = async (cid: number) => {
    setRunning("ai-chat"); setResult("ai-chat", null);
    try {
      const r = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": "wl-test" },
        body: JSON.stringify({ messages: [{ role: "user", text: "телефон" }], fast: true, company_id: cid }),
      });
      const d = await r.json();
      const ans = String(d.answer || "");
      const hasOld = ans.includes("977 606-89-01") || ans.includes("977) 606-89-01");
      if (!hasOld && ans.length > 0) {
        setResult("ai-chat", { ok: true, label: "Бот ответил без дефолтного номера MosPotolki ✓", data: ans.slice(0, 200) });
      } else if (hasOld) {
        setResult("ai-chat", { ok: false, label: "Бот вернул дефолтный телефон вместо бренда", data: ans.slice(0, 200) });
      } else {
        setResult("ai-chat", { ok: true, label: "Ответ получен", data: ans.slice(0, 200) });
      }
    } catch (e) { setResult("ai-chat", { ok: false, label: String(e) }); }
    finally { setRunning(null); }
  };

  const check_pdf = async (cid: number) => {
    setRunning("pdf"); setResult("pdf", null);
    try {
      const r = await fetch(PDF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [{ title: "Тест", numbered: false, items: [{ name: "Демо позиция", value: "1 шт × 1000 ₽ = 1000 ₽" }] }],
          totals: ["Standard: 1000 ₽"],
          finalPhrase: "",
          company_id: cid,
        }),
      });
      const d = await r.json();
      if (d.pdf && d.pdf.length > 1000) {
        const bytes = Uint8Array.from(atob(d.pdf), c => c.charCodeAt(0));
        const blob  = new Blob([bytes], { type: "application/pdf" });
        const url   = URL.createObjectURL(blob);
        setResult("pdf", { ok: true, label: `PDF сгенерирован (${Math.round(d.pdf.length / 1024)} KB)`, data: url });
        window.open(url, "_blank");
      } else {
        setResult("pdf", { ok: false, label: "PDF не сгенерирован" });
      }
    } catch (e) { setResult("pdf", { ok: false, label: String(e) }); }
    finally { setRunning(null); }
  };

  const check_runAll = async (cid: number) => {
    await check_brandApi(cid);
    await check_aiChat(cid);
    await check_pdf(cid);
  };

  /* ── ВОЙТИ В ПАНЕЛЬ компании ── */
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

  const openSite = (companyId: number) => {
    setPanel({ type: "site", url: `/?c=${companyId}` });
  };

  /* ── Если открыта панель — показываем встроенный просмотр ── */
  if (panel) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: "#06060c", zIndex: 9999 }}>
        {/* Топбар */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.07] flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.025)" }}>
          <button onClick={() => { setPanel(null); setIframeToken(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Icon name="ArrowLeft" size={12} /> Назад
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono flex-1 min-w-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
            <Icon name={panel.type === "site" ? "Globe" : "LayoutDashboard"} size={11} />
            <span className="truncate">
              {panel.type === "site" ? panel.url : `/company (ID: ${panel.companyId})`}
            </span>
          </div>
          <button
            onClick={() => {
              const url = panel.type === "site" ? panel.url : "/company";
              window.open(url, "_blank");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-80 flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.35)" }}>
            <Icon name="ExternalLink" size={11} /> Открыть отдельно
          </button>
        </div>

        {/* iframe */}
        {panel.type === "site" ? (
          <iframe
            ref={iframeRef}
            src={panel.url}
            className="flex-1 w-full border-0"
            title="Сайт компании"
          />
        ) : (
          <IframeAdmin token={iframeToken} />
        )}
      </div>
    );
  }

  /* ── ОСНОВНАЯ СТРАНИЦА ── */
  return (
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

        {/* Демо-аккаунт */}
        <Section title="Демо-компания" icon="Building2" color="#a78bfa">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Email"  value={DEMO_EMAIL} />
            <Field label="Пароль" value={DEMO_PASSWORD} />
            <Field label="ID"     value={`#${DEMO_ID}`} />
            <Field label="Цвет"   value="#06b6d4 · циан" />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <LinkBtn icon="Globe" label="Открыть их сайт"
              onClick={() => openSite(DEMO_ID)} color="#06b6d4" />
            <LinkBtn icon="LayoutDashboard" label="Войти в их панель"
              onClick={() => loginAsCompany(DEMO_ID)} color="#a78bfa" />
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
                  {/* Цвет-аватар */}
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black"
                    style={{ background: c.brand_color + "25", color: c.brand_color, border: `1px solid ${c.brand_color}40` }}>
                    {(c.company_name || c.name || "?")[0].toUpperCase()}
                  </div>
                  {/* Инфо */}
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
                  {/* Баланс */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-[10px] font-bold" style={{ color: c.estimates_balance > 0 ? "#10b981" : "#ef4444" }}>
                      {c.estimates_balance} смет
                    </div>
                    <div className="text-[9px] text-white/25">{c.purchased_at || c.created_at}</div>
                  </div>
                  {/* Кнопки */}
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

        {/* Тесты API */}
        <Section title="Тесты API (живые)" icon="Beaker" color="#fbbf24">
          {Object.keys(results).length === 0 ? (
            <div className="text-[11px] text-white/30 py-1">
              Введи ID компании выше и нажми «Живые API» — результаты появятся здесь
            </div>
          ) : (
            <div className="space-y-2.5">
              <TestRow id="brand-api" name="get-brand: бренд компании"
                onRun={() => check_brandApi(Number(previewId) || DEMO_ID)} running={running} result={results["brand-api"]} />
              <TestRow id="ai-chat" name="AI-чат: подмена контактов на бренд"
                onRun={() => check_aiChat(Number(previewId) || DEMO_ID)} running={running} result={results["ai-chat"]} />
              <TestRow id="pdf" name="generate-pdf: PDF с брендом компании"
                onRun={() => check_pdf(Number(previewId) || DEMO_ID)} running={running} result={results["pdf"]} />
            </div>
          )}
          <button onClick={() => check_runAll(Number(previewId) || DEMO_ID)} disabled={!!running}
            className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#fbbf24", color: "#0a0a14" }}>
            <Icon name="Play" size={13} />
            {previewId ? `Прогнать все три для ID #${previewId}` : `Прогнать все три (демо #${DEMO_ID})`}
          </button>
        </Section>

      </div>
    </div>
  );
}

/* ── Iframe панель администратора ── */
function IframeAdmin({ token }: { token: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token || !iframeRef.current) return;
    const handler = (e: MessageEvent) => {
      if (e.data === "iframe-ready") {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "set-token", token },
          window.location.origin
        );
        setReady(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [token]);

  return (
    <div className="flex-1 relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#06060c" }}>
          <Spin /><span className="ml-2 text-white/40 text-sm">Загрузка панели...</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/company?iframe=1"
        className="w-full h-full border-0"
        title="Панель управления компании"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s" }}
      />
    </div>
  );
}

/* ───────── helpers ───────── */

function Section({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}1f` }}>
          <Icon name={icon} size={14} style={{ color }} />
        </div>
        <h2 className="text-sm font-black uppercase tracking-wider" style={{ color }}>{title}</h2>
      </div>
      <div className="rounded-2xl p-4 space-y-2.5"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* ignore */ }
  };
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-white/30">{label}</div>
        <div className="text-xs font-mono text-white/80 truncate">{value}</div>
      </div>
      <button onClick={copy} className="text-white/40 hover:text-white/80 transition flex-shrink-0">
        <Icon name={copied ? "Check" : "Copy"} size={11} />
      </button>
    </div>
  );
}

function LinkBtn({ icon, label, href, target, onClick, color }: {
  icon: string; label: string; href?: string; target?: string;
  onClick?: () => void | undefined; color: string;
}) {
  const cls = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition cursor-pointer";
  const style = { background: `${color}1f`, color, border: `1px solid ${color}40` };
  if (href) return <a href={href} target={target} rel="noreferrer" className={cls} style={style}>
    <Icon name={icon} size={12} />{label}
  </a>;
  return <button onClick={onClick} className={cls} style={style}>
    <Icon name={icon} size={12} />{label}
  </button>;
}

function TestRow({ id, name, onRun, running, result }: {
  id: string; name: string; onRun: () => void;
  running: string | null; result: CheckResult | null;
}) {
  const isRun = running === id;
  return (
    <div className="rounded-xl p-3"
      style={{
        background: result ? (result.ok ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)") : "rgba(255,255,255,0.025)",
        border: `1px solid ${result ? (result.ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)") : "rgba(255,255,255,0.06)"}`,
      }}>
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: result ? (result.ok ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)") : "rgba(255,255,255,0.05)" }}>
          {isRun
            ? <Spin />
            : <Icon name={result ? (result.ok ? "Check" : "X") : "Circle"} size={13}
                style={{ color: result ? (result.ok ? "#10b981" : "#ef4444") : "rgba(255,255,255,0.4)" }} />}
        </div>
        <div className="flex-1 text-[12px] text-white/80">{name}</div>
        <button onClick={onRun} disabled={!!running}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition disabled:opacity-50"
          style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.35)" }}>
          {isRun ? "..." : "Запустить"}
        </button>
      </div>
      {result && (
        <div className="mt-2 ml-10 text-[11px] leading-snug"
          style={{ color: result.ok ? "#86efac" : "#fca5a5" }}>
          {result.label}
        </div>
      )}
      {result?.data && (
        <pre className="mt-2 ml-10 text-[10px] text-white/40 bg-white/[0.03] rounded-lg px-2 py-1.5 overflow-x-auto whitespace-pre-wrap">
          {result.data}
        </pre>
      )}
    </div>
  );
}

function Spin() {
  return <div className="w-3 h-3 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center" style={{ background: "#06060c" }}>{children}</div>;
}