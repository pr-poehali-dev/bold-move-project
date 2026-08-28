import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { crmFetch } from "./crmApi";

// Номер, на который улетает тестовое сообщение при проверке каналов —
// один фиксированный на всех сотрудников, чтобы кнопка работала в один клик,
// без ввода номера. Изменить можно только здесь, одной строкой.
const SELFTEST_PHONE = "+79776060901";

type ChState = "idle" | "sending" | "ok" | "error";

// Кнопка «Проверить каналы» — доступна ВСЕМ сотрудникам (не только владельцу
// в настройках интеграций): один клик отправляет реальное сообщение в Telegram
// и MAX и показывает, дошло ли оно. Живая, сквозная проверка всей цепочки
// CRM → очередь → воркер на VPS → сам мессенджер — не просто «линия подключена».
export function ChannelsSelfTestButton() {
  const t = useTheme();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; right: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Record<string, { state: ChState; error?: string }> | null>(null);

  const run = async () => {
    // position: fixed, координаты — от кнопки. Кнопка живёт внутри строки с
    // overflow-x-auto (полоса вкладок воронки) — обычный position: absolute
    // обрезался бы этой прокруткой, и попап был бы невидим/срезан.
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(true);
    setTesting(true);
    setResult(null);
    try {
      const d = await crmFetch("channels-selftest", {
        method: "POST",
        body: JSON.stringify({ phone: SELFTEST_PHONE }),
      }) as { results?: Record<string, { ok: boolean; touch_id?: number; error?: string }>; error?: string };

      if (d?.error) {
        setResult({ telegram: { state: "error", error: d.error }, max: { state: "error", error: d.error } });
        return;
      }
      const res = d?.results || {};
      const idToChannel: Record<number, string> = {};
      const initial: Record<string, { state: ChState; error?: string }> = {};
      Object.entries(res).forEach(([ch, r]) => {
        if (r.ok && r.touch_id) { idToChannel[r.touch_id] = ch; initial[ch] = { state: "sending" }; }
        else initial[ch] = { state: "error", error: r.error };
      });
      setResult({ ...initial });

      const ids = Object.keys(idToChannel);
      if (!ids.length) return;

      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const st = await crmFetch("channels-selftest-status", undefined, { ids: ids.join(",") }) as
          { items?: { touch_id: number; channel: string; status: string }[] };
        const items = st?.items || [];
        const next = { ...initial };
        items.forEach(it => {
          next[it.channel] = it.status === "sent" || it.status === "received"
            ? { state: "ok" }
            : it.status === "error"
            ? { state: "error", error: "Не доставлено" }
            : { state: "sending" };
        });
        setResult({ ...next });
        if (items.every(it => it.status !== "pending" && it.status !== "sending")) break;
      }
    } catch {
      setResult({ telegram: { state: "error", error: "Ошибка связи" }, max: { state: "error", error: "Ошибка связи" } });
    } finally {
      setTesting(false);
    }
  };

  const anyError = result && Object.values(result).some(r => r.state === "error");
  const allOk = result && Object.values(result).every(r => r.state === "ok");

  return (
    <div className="flex-shrink-0">
      <button ref={btnRef} onClick={run} disabled={testing}
        title="Отправить тестовое сообщение в Telegram и MAX и проверить, что каналы реально работают"
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition flex-shrink-0 disabled:opacity-60"
        style={{
          background: allOk ? "#10b98115" : anyError ? "#ef444415" : t.surface,
          border: `1px solid ${allOk ? "#10b98145" : anyError ? "#ef444445" : t.border}`,
          color: allOk ? "#10b981" : anyError ? "#ef4444" : t.textSub,
        }}>
        <Icon name={testing ? "Loader2" : allOk ? "CheckCircle2" : anyError ? "AlertTriangle" : "Activity"}
          size={14} className={testing ? "animate-spin" : ""} />
        Проверить каналы
      </button>

      {open && popupPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 w-[240px] rounded-xl overflow-hidden shadow-2xl p-2.5"
            style={{ top: popupPos.top, right: popupPos.right, background: t.surface, border: `1px solid ${t.border}` }}>
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: t.textMute }}>
              Проверка каналов
            </div>
            {!result ? (
              <div className="text-[11px] py-2 text-center" style={{ color: t.textMute }}>Отправляем…</div>
            ) : (
              <div className="flex flex-col gap-1">
                {(["telegram", "max"] as const).map(ch => {
                  const r = result[ch];
                  if (!r) return null;
                  const label = ch === "telegram" ? "Telegram" : "MAX";
                  const view = r.state === "ok"
                    ? { text: "Работает", color: "#10b981", icon: "CheckCircle2" }
                    : r.state === "sending"
                    ? { text: "Отправляем…", color: "#f59e0b", icon: "Loader2" }
                    : { text: r.error || "Не работает", color: "#ef4444", icon: "AlertTriangle" };
                  return (
                    <div key={ch} className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg"
                      style={{ background: `${view.color}12`, border: `1px solid ${view.color}30` }}>
                      <Icon name={view.icon} size={12} style={{ color: view.color }}
                        className={r.state === "sending" ? "animate-spin" : ""} />
                      <span className="font-bold flex-shrink-0" style={{ color: t.text }}>{label}</span>
                      <span className="truncate" style={{ color: view.color }}>{view.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
