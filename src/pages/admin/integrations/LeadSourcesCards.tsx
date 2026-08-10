import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { crmFetch } from "../crm/crmApi";
import EnabledToggle from "./EnabledToggle";

interface Stat { count: number; last_at: string | null }

interface Info {
  webhook_url?: string | null;
  webhook_enabled?: boolean;
  email_configured?: boolean;
  email_address?: string | null;
  email_sender?: string | null;
  email_has_password?: boolean;
  email_enabled?: boolean;
  stats?: Record<string, Stat>;
}

interface Props {
  cardBg: string; cardBrd: string; inputBg: string; inputBrd: string;
  txt: string; txtSub: string;
  isDark: boolean;
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

/** Общая обёртка-карточка источника заявок */
function SourceCard({
  cardBg, cardBrd, txt, txtSub, icon, title, desc, connected, stat, children,
  enabled, onToggleEnabled, toggling,
}: {
  cardBg: string; cardBrd: string; txt: string; txtSub: string;
  icon: string; title: string; desc: string;
  connected: boolean; stat?: Stat; children?: React.ReactNode;
  enabled: boolean; onToggleEnabled: (next: boolean) => void; toggling?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBrd}`, opacity: enabled ? 1 : 0.65 }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(124,58,237,0.12)" }}>
          <Icon name={icon} size={17} style={{ color: "#a78bfa" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-bold" style={{ color: txt }}>{title}</div>
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{
                background: !enabled ? "rgba(148,163,184,0.12)" : connected ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.12)",
                color: !enabled ? txtSub : connected ? "#10b981" : txtSub,
              }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: !enabled ? "#94a3b8" : connected ? "#10b981" : "#94a3b8" }} />
              {!enabled ? "Отключено" : connected ? "Работает" : "Не настроено"}
            </span>
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: txtSub }}>{desc}</div>
        </div>
        <EnabledToggle enabled={enabled} onChange={onToggleEnabled} disabled={toggling} />
      </div>

      {children}

      {stat && (
        <div className="text-[10px] mt-3 pt-2.5" style={{ color: txtSub, borderTop: `1px solid ${cardBrd}` }}>
          Принято заявок: <b style={{ color: txt }}>{stat.count}</b>
          {stat.last_at && ` · Последняя: ${fmtDate(stat.last_at)}`}
        </div>
      )}
    </div>
  );
}

export default function LeadSourcesCards({
  cardBg, cardBrd, inputBg, inputBrd, txt, txtSub, isDark,
}: Props) {
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [revealUrl, setRevealUrl] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  // Редактирование ящика/отправителя/пароля почты для заявок
  const [editingMail, setEditingMail] = useState(false);
  const [mailbox, setMailbox] = useState("");
  const [sender, setSender] = useState("");
  const [password, setPassword] = useState("");
  const [savingMail, setSavingMail] = useState(false);
  const [mailSaved, setMailSaved] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    try {
      const d = await crmFetch("leads-sources-info") as Info;
      setInfo(d ?? null);
      setMailbox(d?.email_address || "");
      setSender(d?.email_sender || "");
    } catch { /* тихо */ }
    setLoading(false);
  };

  const toggleSource = async (source: string, next: boolean) => {
    setToggling(source);
    // Оптимистичное обновление — тумблер сразу отражает выбор пользователя
    setInfo(i => i ? {
      ...i,
      ...(source === "leakad_webhook" ? { webhook_enabled: next } : {}),
      ...(source === "email_leads" ? { email_enabled: next } : {}),
    } : i);
    try {
      await crmFetch("source-toggle", {
        method: "POST",
        body: JSON.stringify({ source, enabled: next }),
      });
    } catch { /* тихо */ }
    setToggling(null);
  };

  useEffect(() => { load(); }, []);

  const saveMailConfig = async () => {
    setSavingMail(true);
    try {
      await crmFetch("email-leads-config", {
        method: "POST",
        body: JSON.stringify({ mailbox, sender, password }),
      });
      setPassword("");
      setEditingMail(false);
      setMailSaved(true);
      setTimeout(() => setMailSaved(false), 1500);
      load();
    } catch { /* тихо */ }
    setSavingMail(false);
  };

  const copyUrl = () => {
    if (!info?.webhook_url) return;
    navigator.clipboard.writeText(info.webhook_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Ручная проверка почты — дёргаем ту же проверку, что делает «будильник» раз в минуту
  const checkMailNow = async () => {
    setChecking(true); setCheckResult(null);
    try {
      const d = await crmFetch("email-leads-check-now", { method: "POST" }) as
        { created?: number; skipped?: number; error?: string };
      if (d?.error) setCheckResult(`Ошибка: ${d.error}`);
      else if (d?.created) setCheckResult(`Найдено новых заявок: ${d.created}`);
      else setCheckResult("Новых писем нет");
      load();
    } catch {
      setCheckResult("Не удалось связаться с сервером");
    }
    setChecking(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-6 flex items-center justify-center" style={{ background: cardBg, border: `1px solid ${cardBrd}` }}>
        <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maskedUrl = info?.webhook_url
    ? info.webhook_url.replace(/key=[^&]+/, "key=••••••••••••")
    : null;

  return (
    <>
      {/* ── Вебхук leakad.ru ── */}
      <SourceCard
        cardBg={cardBg} cardBrd={cardBrd} txt={txt} txtSub={txtSub}
        icon="Webhook"
        title="Вебхук leakad.ru"
        desc="Заявки приходят напрямую в CRM за секунду. Самый быстрый и надёжный способ."
        connected={!!info?.webhook_url}
        stat={info?.stats?.leakad_webhook}
        enabled={info?.webhook_enabled !== false}
        onToggleEnabled={next => toggleSource("leakad_webhook", next)}
        toggling={toggling === "leakad_webhook"}>

        <div className="text-[11px] font-semibold mb-1.5" style={{ color: txtSub }}>
          Передайте этот адрес в поддержку leakad.ru (метод POST)
        </div>
        {info?.webhook_url ? (
          <>
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex-1 min-w-0 text-[11px] px-3 py-2 rounded-xl truncate font-mono"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }}>
                {revealUrl ? info.webhook_url : maskedUrl}
              </div>
              <button onClick={() => setRevealUrl(r => !r)}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", color: txtSub }}>
                <Icon name={revealUrl ? "EyeOff" : "Eye"} size={12} />
              </button>
              <button onClick={copyUrl}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0"
                style={{ background: copied ? "rgba(16,185,129,0.15)" : "rgba(124,58,237,0.14)", color: copied ? "#10b981" : "#a78bfa" }}>
                <Icon name={copied ? "Check" : "Copy"} size={12} /> {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
            <div className="text-[10px] mt-2" style={{ color: txtSub }}>
              Адрес содержит секретный ключ — не публикуйте его, передавайте только напрямую в leakad.ru.
            </div>
          </>
        ) : (
          <div className="text-[11px] px-3 py-2 rounded-xl"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            Ключ вебхука не настроен на сервере.
          </div>
        )}
      </SourceCard>

      {/* ── Заявки с почты ── */}
      <SourceCard
        cardBg={cardBg} cardBrd={cardBrd} txt={txt} txtSub={txtSub}
        icon="Mail"
        title="Заявки с почты"
        desc="Запасной канал: система сама заходит в почту раз в минуту и заводит карточки по письмам."
        connected={!!info?.email_configured}
        stat={info?.stats?.email_leads}
        enabled={info?.email_enabled !== false}
        onToggleEnabled={next => toggleSource("email_leads", next)}
        toggling={toggling === "email_leads"}>

        {!editingMail ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-xl"
              style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }}>
              <Icon name="Inbox" size={13} style={{ color: txtSub, flexShrink: 0 }} />
              <span className="truncate">Ящик: <b>{info?.email_address || "не настроен"}</b></span>
            </div>
            <div className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-xl"
              style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }}>
              <Icon name="AtSign" size={13} style={{ color: txtSub, flexShrink: 0 }} />
              <span className="truncate">Ждём письма от: <b>{info?.email_sender}</b></span>
            </div>
            {!info?.email_has_password && (
              <div className="text-[11px] px-3 py-2 rounded-xl"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                Пароль приложения не задан — почта не проверяется.
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={checkMailNow} disabled={checking}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-60"
                style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>
                <Icon name={checking ? "Loader2" : "RefreshCw"} size={11} className={checking ? "animate-spin" : ""} />
                {checking ? "Проверяю..." : "Проверить почту сейчас"}
              </button>
              <button onClick={() => setEditingMail(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", color: txtSub }}>
                <Icon name="Settings" size={11} /> Изменить
              </button>
              {checkResult && (
                <span className="text-[11px] font-semibold" style={{ color: txtSub }}>{checkResult}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div>
              <div className="text-[11px] font-semibold mb-1" style={{ color: txtSub }}>Ящик (IMAP Gmail)</div>
              <input value={mailbox} onChange={e => setMailbox(e.target.value)}
                placeholder="mospotolkipro@gmail.com"
                className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition placeholder:font-semibold"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-semibold" style={{ color: txtSub }}>Пароль приложения Gmail</span>
                <button type="button" onClick={() => setShowHelp(h => !h)}
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa" }}>
                  <Icon name="HelpCircle" size={11} />
                </button>
              </div>
              {showHelp && (
                <div className="text-[10px] mb-1.5 px-3 py-2 rounded-xl leading-relaxed"
                  style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txtSub }}>
                  Это не обычный пароль от аккаунта Google — нужен «пароль приложения»:<br/>
                  1. Зайдите в аккаунт нужной почты<br/>
                  2. Включите двухэтапную аутентификацию (myaccount.google.com/security)<br/>
                  3. Откройте myaccount.google.com/apppasswords<br/>
                  4. Введите название (например «CRM») и нажмите «Создать»<br/>
                  5. Скопируйте показанный 16-значный пароль и вставьте сюда
                </div>
              )}
              <input value={password} onChange={e => setPassword(e.target.value)}
                type="password"
                placeholder={info?.email_has_password ? "•••••••••••••••• (оставьте пустым, если не меняете)" : "abcd efgh ijkl mnop"}
                className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition placeholder:font-semibold"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }} />
            </div>
            <div>
              <div className="text-[11px] font-semibold mb-1" style={{ color: txtSub }}>Ждём письма от (отправитель)</div>
              <input value={sender} onChange={e => setSender(e.target.value)}
                placeholder="noreply@egokad.ru"
                className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition placeholder:font-semibold"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={saveMailConfig} disabled={savingMail}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-60"
                style={{ background: mailSaved ? "rgba(16,185,129,0.15)" : "#7c3aed", color: mailSaved ? "#10b981" : "#fff" }}>
                <Icon name={savingMail ? "Loader2" : mailSaved ? "Check" : "Save"} size={11} className={savingMail ? "animate-spin" : ""} />
                {mailSaved ? "Сохранено" : "Сохранить"}
              </button>
              <button onClick={() => { setEditingMail(false); setPassword(""); }}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", color: txtSub }}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </SourceCard>
    </>
  );
}