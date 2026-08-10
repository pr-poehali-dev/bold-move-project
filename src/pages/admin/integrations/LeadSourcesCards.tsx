import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { crmFetch } from "../crm/crmApi";

interface Stat { count: number; last_at: string | null }

interface Info {
  webhook_url?: string | null;
  email_configured?: boolean;
  email_address?: string | null;
  email_sender?: string | null;
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
}: {
  cardBg: string; cardBrd: string; txt: string; txtSub: string;
  icon: string; title: string; desc: string;
  connected: boolean; stat?: Stat; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBrd}` }}>
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
                background: connected ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.12)",
                color: connected ? "#10b981" : txtSub,
              }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: connected ? "#10b981" : "#94a3b8" }} />
              {connected ? "Работает" : "Не настроено"}
            </span>
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: txtSub }}>{desc}</div>
        </div>
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

  const load = async () => {
    try {
      const d = await crmFetch("leads-sources-info") as Info;
      setInfo(d ?? null);
    } catch { /* тихо */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
        stat={info?.stats?.leakad_webhook}>

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
        stat={info?.stats?.email_leads}>

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

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={checkMailNow} disabled={checking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-60"
              style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>
              <Icon name={checking ? "Loader2" : "RefreshCw"} size={11} className={checking ? "animate-spin" : ""} />
              {checking ? "Проверяю..." : "Проверить почту сейчас"}
            </button>
            {checkResult && (
              <span className="text-[11px] font-semibold" style={{ color: txtSub }}>{checkResult}</span>
            )}
          </div>
        </div>
      </SourceCard>
    </>
  );
}
