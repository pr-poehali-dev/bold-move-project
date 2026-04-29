import { useEffect, useState } from "react";
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

export default function WhiteLabel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<Record<string, CheckResult | null>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState("");

  // Доступ только мастеру
  useEffect(() => {
    if (!loading && user && !user.is_master) navigate("/");
  }, [user, loading, navigate]);

  if (loading) {
    return <Center><Spin /> <span className="ml-2 text-white/40 text-sm">Загрузка...</span></Center>;
  }
  if (!user) {
    return (
      <Center>
        <div className="text-center space-y-3">
          <div className="text-white/40 text-sm">Нужно войти как мастер</div>
          <button onClick={() => navigate("/")}
            className="px-4 py-2 rounded-xl text-xs font-bold"
            style={{ background: "#7c3aed", color: "#fff" }}>
            На главную
          </button>
        </div>
      </Center>
    );
  }
  if (!user.is_master) {
    return <Center><span className="text-white/40 text-sm">Доступ только для мастера</span></Center>;
  }

  const setResult = (key: string, r: CheckResult | null) => {
    setResults(prev => ({ ...prev, [key]: r }));
  };

  /* ============ ПРОВЕРКИ ============ */

  const check_brandApi = async () => {
    setRunning("brand-api"); setResult("brand-api", null);
    try {
      const r = await fetch(`${AUTH_URL}?action=get-brand&company_id=${DEMO_ID}`);
      const d = await r.json();
      if (d.brand && d.brand.bot_name) {
        setResult("brand-api", { ok: true, label: `Бренд получен: бот «${d.brand.bot_name}», цвет ${d.brand.brand_color}, телефон ${d.brand.support_phone}` });
      } else {
        setResult("brand-api", { ok: false, label: "Бренд не вернулся (компания не активна?)" });
      }
    } catch (e) {
      setResult("brand-api", { ok: false, label: String(e) });
    } finally { setRunning(null); }
  };

  const check_aiChat = async () => {
    setRunning("ai-chat"); setResult("ai-chat", null);
    try {
      const r = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": "wl-test" },
        body: JSON.stringify({
          messages: [{ role: "user", text: "телефон" }],
          fast: true,
          company_id: DEMO_ID,
        }),
      });
      const d = await r.json();
      const ans = String(d.answer || "");
      const hasNewPhone = ans.includes("812") || ans.includes("555-12-34");
      const hasOldPhone = ans.includes("977 606-89-01") || ans.includes("977) 606-89-01");
      if (hasNewPhone && !hasOldPhone) {
        setResult("ai-chat", { ok: true, label: `Бот ответил с брендированным телефоном (812)555-12-34`, data: ans.slice(0, 200) });
      } else if (hasOldPhone) {
        setResult("ai-chat", { ok: false, label: `Бот вернул дефолтный телефон вместо бренда`, data: ans.slice(0, 200) });
      } else {
        setResult("ai-chat", { ok: true, label: `Ответ получен (телефон не упомянут)`, data: ans.slice(0, 200) });
      }
    } catch (e) {
      setResult("ai-chat", { ok: false, label: String(e) });
    } finally { setRunning(null); }
  };

  const check_pdf = async () => {
    setRunning("pdf"); setResult("pdf", null);
    try {
      const r = await fetch(PDF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [{ title: "Тест", numbered: false, items: [{ name: "Демо позиция", value: "1 шт × 1000 ₽ = 1000 ₽" }] }],
          totals: ["Standard: 1000 ₽"],
          finalPhrase: "",
          company_id: DEMO_ID,
        }),
      });
      const d = await r.json();
      if (d.pdf && d.pdf.length > 1000) {
        // Скачаем PDF чтобы проверить вживую
        const bytes = Uint8Array.from(atob(d.pdf), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setResult("pdf", { ok: true, label: `PDF сгенерирован (${Math.round(d.pdf.length / 1024)} KB) — открыт в новой вкладке`, data: url });
        window.open(url, "_blank");
      } else {
        setResult("pdf", { ok: false, label: "PDF не сгенерирован" });
      }
    } catch (e) {
      setResult("pdf", { ok: false, label: String(e) });
    } finally { setRunning(null); }
  };

  const check_runAll = async () => {
    await check_brandApi();
    await check_aiChat();
    await check_pdf();
  };

  /* ============ UI ============ */

  return (
    <div className="min-h-screen text-white" style={{ background: "#06060c" }}>

      {/* Шапка */}
      <header className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
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
            <Field label="Email"    value={DEMO_EMAIL} />
            <Field label="Пароль"   value={DEMO_PASSWORD} />
            <Field label="ID"       value={`#${DEMO_ID}`} />
            <Field label="Цвет"     value="#06b6d4 · циан" />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <LinkBtn icon="ExternalLink" label="Открыть бренд (?c=14)"
              href={`/?c=${DEMO_ID}`} target="_blank" color="#06b6d4" />
            <LinkBtn icon="LogIn" label="Войти как демо-компания"
              onClick={async () => {
                try {
                  const r = await fetch(`${AUTH_URL}?action=login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
                  });
                  const d = await r.json();
                  if (d.token) {
                    // Сохраняем мастер-токен чтобы вернуться обратно
                    const masterToken = localStorage.getItem("mp_user_token");
                    if (masterToken) {
                      localStorage.setItem("mp_master_token", masterToken);
                      localStorage.setItem("mp_master_name", user?.name || "Мастер");
                    }
                    localStorage.setItem("mp_user_token", d.token);
                    window.location.href = "/company";
                  } else {
                    alert("Ошибка входа: " + (d.error || "?"));
                  }
                } catch (e) { alert(String(e)); }
              }}
              color="#10b981" />
          </div>
        </Section>

        {/* Просмотр клиента по ID */}
        <Section title="Просмотр клиента по ID" icon="Search" color="#f59e0b">
          <p className="text-[11px] text-white/40 mb-2">Введи company_id — откроется главная страница с брендом этой компании</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={previewId}
              onChange={e => setPreviewId(e.target.value)}
              placeholder="Например: 42"
              className="flex-1 rounded-xl px-3 py-2 text-xs font-mono bg-white/[0.05] border border-white/10 text-white placeholder-white/25 outline-none focus:border-amber-500/50 transition"
            />
            <LinkBtn
              icon="ExternalLink"
              label="Открыть"
              href={previewId ? `/?c=${previewId}` : undefined}
              target="_blank"
              color="#f59e0b"
              onClick={previewId ? undefined : () => {}}
            />
          </div>
        </Section>

        {/* Чек-лист этапов */}
        <Section title="Что сделано" icon="ListChecks" color="#10b981">
          {[
            { id: "Б0", t: "Флаг has_own_agent + продажа на /pricing 80 000 ₽" },
            { id: "Б1+Б2", t: "Поля бренда в БД + редактор «Свой агент» в /company" },
            { id: "Б3", t: "Подмена бренда на главной по ?c=ID + контекст" },
            { id: "Б4", t: "PDF-сметы по бренду + кеш в localStorage (TTL 6 ч.)" },
            { id: "Б5", t: "AI-чат и FAQ подменяют контакты по бренду" },
          ].map(s => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
              style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.20)" }}>
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black"
                style={{ background: "#10b981", color: "#0a0a14" }}>
                {s.id}
              </div>
              <span className="text-[12px] text-white/75 flex-1">{s.t}</span>
              <Icon name="Check" size={14} style={{ color: "#10b981" }} />
            </div>
          ))}
        </Section>

        {/* Автотесты API */}
        <Section title="Тесты API (живые)" icon="Beaker" color="#fbbf24">
          <div className="space-y-2.5">
            <TestRow id="brand-api" name="Эндпоинт get-brand отдаёт бренд для ?c=14"
              onRun={check_brandApi} running={running} result={results["brand-api"]} />
            <TestRow id="ai-chat" name="AI-чат подменяет телефон в FAQ при company_id=14"
              onRun={check_aiChat} running={running} result={results["ai-chat"]} />
            <TestRow id="pdf" name="generate-pdf подставляет бренд при company_id=14"
              onRun={check_pdf} running={running} result={results["pdf"]} />
          </div>
          <button onClick={check_runAll}
            disabled={!!running}
            className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#fbbf24", color: "#0a0a14" }}>
            <Icon name="Play" size={13} /> Прогнать все три
          </button>
        </Section>

        {/* Ручной тест-кейс */}
        <Section title="Ручной тест-сценарий" icon="UserCheck" color="#06b6d4">
          <Step n={1} title="Заходим как мастер">
            Откройте <a className="text-cyan-400 underline" href="/master" target="_blank" rel="noreferrer">/master</a>.
            В списке найдите компанию <code className="bg-white/5 px-1.5 py-0.5 rounded">whitelabel-test@demo.local</code> — у неё блок «Свой агент» зелёный, кнопка «Отключить».
          </Step>
          <Step n={2} title="Заходим как клиент компании">
            Нажмите выше «Войти как демо-компания» — попадёте в <code>/company</code>. Должна быть вкладка «Свой агент» с активным редактором (не тизер).
          </Step>
          <Step n={3} title="Меняем имя бота → проверяем превью">
            Во вкладке «Свой агент» в поле «Имя бота» напишите своё имя — справа в превью оно появится мгновенно.
          </Step>
          <Step n={4} title="Меняем цвет бренда → проверяем PDF">
            В разделе «Визуал» поменяйте цвет на красный, нажмите «Сохранить настройки бренда».
            Теперь нажмите выше тест «generate-pdf …» — должен открыться PDF с красной кнопкой «Записаться» и контактами +7 (812) 555-12-34.
          </Step>
          <Step n={5} title="Открываем сайт глазами клиента">
            Откройте <a className="text-cyan-400 underline" href={`/?c=${DEMO_ID}`} target="_blank" rel="noreferrer">/?c={DEMO_ID}</a>.
            Должны увидеть: название компании, ваш цвет в кнопках Telegram/MAX, имя бота в чате, изменённое приветствие.
            Спросите бота «телефон?» — ответ +7 (812) 555-12-34.
          </Step>
        </Section>

        {/* Что НЕ покрыто */}
        <Section title="Что НЕ подменяется" icon="AlertTriangle" color="#ef4444">
          <Note>
            Цветовые акценты <code>orange-400/500</code> в Tailwind-классах остаются оранжевыми по всему сайту —
            подменяются только специально пробрасываемые места (шапка, кнопки контактов, чат-бот, PDF).
            Если нужна полная перекраска — это отдельная задача.
          </Note>
          <Note>
            Бэкенд CRM (<code>crm-manager</code>) не проверяет права <code>permissions</code> на эндпоинтах —
            фронт скрывает разделы, но прямой запрос к API менеджера с <code>finance:false</code> вернёт данные.
          </Note>
          <Note>
            FAQ-кэш в БД (если заполнен) не проходит через <code>apply_brand_to_text</code> — только встроенный fallback FAQ.
            Если заводить кастомные FAQ через админку «База знаний», они не подменятся брендом.
          </Note>
        </Section>
      </div>
    </div>
  );
}

/* ───────── helpers ───────── */

function Section({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}1f` }}>
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
  onClick?: () => void; color: string;
}) {
  const cls = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition";
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
          style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.32)" }}>
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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
        style={{ background: "#06b6d4", color: "#0a0a14" }}>
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold text-white mb-0.5">{title}</div>
        <div className="text-[11px] text-white/55 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2 text-[11px] text-white/55 leading-relaxed"
      style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)" }}>
      <Icon name="AlertCircle" size={11} className="inline mr-1.5" style={{ color: "#ef4444" }} />
      {children}
    </div>
  );
}

function Spin() {
  return <div className="w-3 h-3 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center" style={{ background: "#06060c" }}>{children}</div>;
}