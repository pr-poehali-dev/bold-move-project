import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Icon from "@/components/ui/icon";
import { crmFetch } from "@/pages/admin/crm/crmApi";

export type AuthStatus =
  | "none" | "requested" | "connecting" | "qr_ready"
  | "code_requested" | "code_submitted"
  | "password_requested" | "password_submitted"
  | "authorized" | "error";

interface AccountRow {
  id: number;
  channel: string;
  title: string;
  auth_status: AuthStatus;
  auth_payload?: string | null;
  account_name?: string | null;
}

// ── Модалка авторизации линии (Telegram — QR, MAX — номер уже задан + SMS-код) ──
// Опрашиваем список линий раз в 2.5 сек, ищем свою по id — статус хранится
// в messenger_accounts.
//
// initialStatus — статус линии на момент открытия. Если он уже "занят"
// (например password_requested после случайного закрытия окна кликом мимо) —
// НЕ запускаем авторизацию заново (это сбросило бы прогресс воркера), а просто
// продолжаем опрос с того места, где пользователь ушёл.
export default function LineAuthModal({
  accountId, channel, title, initialStatus, onClose, onAuthorized,
}: {
  accountId: number;
  channel: string;
  title: string;
  initialStatus?: AuthStatus;
  onClose: () => void;
  onAuthorized: (accountName: string | null) => void;
}) {
  const [status, setStatus] = useState<AuthStatus>(initialStatus ?? "requested");
  const [payload, setPayload] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const poll = async () => {
    if (document.hidden) return; // вкладка браузера свёрнута/неактивна — не дёргаем сервер впустую
    try {
      const res = await crmFetch("messenger-accounts-list") as { accounts?: AccountRow[] };
      const acc = res.accounts?.find(a => a.id === accountId);
      if (!acc) return;
      // При смене статуса (например qr_ready → password_requested) старый payload
      // от прошлого шага (base64-картинка QR) не должен "залипать" и попадать в
      // текст пояснения — обновляем его строго вместе со статусом, без if-заглушки.
      setStatus(prevStatus => {
        if (prevStatus !== acc.auth_status) setPayload(acc.auth_payload ?? null);
        else if (acc.auth_payload) setPayload(acc.auth_payload);
        return acc.auth_status;
      });
      if (acc.auth_status === "authorized") {
        stopPolling();
        onAuthorized(acc.account_name ?? null);
      } else if (acc.auth_status === "error") {
        setErrorMsg(acc.auth_payload || "Не удалось подключиться");
        stopPolling();
      }
    } catch {
      // тихий сбой опроса — попробуем на следующем тике
    }
  };

  const start = async () => {
    setStatus("requested");
    setPayload(null);
    setErrorMsg(null);
    setCode("");
    setSubmitError(null);
    try {
      await crmFetch("messenger-account-auth-start", { method: "POST", body: JSON.stringify({ id: accountId }) });
      stopPolling();
      pollRef.current = setInterval(poll, 2500);
      poll();
    } catch {
      setErrorMsg("Не удалось начать подключение — проверьте связь с сервером");
    }
  };

  const submitValue = async () => {
    if (!code.trim()) return;
    setSending(true);
    setSubmitError(null);
    try {
      await crmFetch("messenger-account-auth-submit", {
        method: "POST",
        body: JSON.stringify({ id: accountId, value: code.trim() }),
      });
      setCode("");
    } catch {
      setSubmitError("Не удалось отправить — попробуйте ещё раз");
    } finally {
      setSending(false);
    }
  };

  // Просто продолжаем опрос без повторного auth-start, чтобы не сбросить прогресс,
  // если линия уже что-то ждёт (например password_requested).
  const resume = () => {
    stopPolling();
    pollRef.current = setInterval(poll, 2500);
    poll();
  };

  useEffect(() => {
    const busy = initialStatus && !["none", "authorized", "error"].includes(initialStatus);
    if (busy) resume(); else start();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waitingCode = status === "code_requested";
  const waitingPassword = status === "password_requested";
  const waitingQr = channel === "telegram" && (status === "requested" || status === "connecting" || status === "qr_ready");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col items-center gap-4"
        style={{ background: "#13131f", border: "1px solid rgba(255,255,255,0.1)" }}>

        <div className="flex items-center justify-between w-full">
          <div className="text-sm font-bold text-white">Подключение «{title}»</div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition">
            <Icon name="X" size={18} />
          </button>
        </div>

        {status === "authorized" ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <Icon name="CheckCircle2" size={40} style={{ color: "#10b981" }} />
            <div className="text-sm font-bold text-white">Подключено!</div>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Icon name="AlertTriangle" size={36} style={{ color: "#ef4444" }} />
            <div className="text-xs text-center text-white/60">{errorMsg}</div>
            <button
              onClick={start}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition"
              style={{ background: "#7c3aed", color: "#fff" }}>
              <Icon name="RotateCw" size={13} /> Попробовать снова
            </button>
          </div>
        ) : waitingPassword ? (
          <div className="w-full flex flex-col items-center gap-3 py-2">
            <Icon name="Lock" size={32} style={{ color: "#f59e0b" }} />
            <div className="text-xs text-center text-white/60 leading-relaxed">
              {payload && !payload.startsWith("data:image")
                ? payload
                : "На аккаунте включён облачный пароль (2FA) — введите его в поле ниже"}
            </div>
            <input
              type="password"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitValue()}
              placeholder="Пароль"
              autoFocus
              className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none text-white"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
            />
            {submitError && <div className="text-[11px] text-red-400">{submitError}</div>}
            <button
              onClick={submitValue}
              disabled={sending || !code.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
              style={{ background: "#7c3aed", color: "#fff" }}>
              {sending
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Icon name="Check" size={13} />}
              Подтвердить
            </button>
          </div>
        ) : waitingCode ? (
          <div className="w-full flex flex-col items-center gap-3 py-2">
            <Icon name="MessageSquareText" size={32} style={{ color: "#a78bfa" }} />
            <div className="text-xs text-center text-white/60 leading-relaxed">
              На номер отправлен код подтверждения — введите его
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitValue()}
              placeholder="Код из SMS"
              autoFocus
              className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none text-white text-center tracking-widest font-mono"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
            />
            {submitError && <div className="text-[11px] text-red-400">{submitError}</div>}
            <button
              onClick={submitValue}
              disabled={sending || !code.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
              style={{ background: "#7c3aed", color: "#fff" }}>
              {sending
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Icon name="Check" size={13} />}
              Подтвердить
            </button>
          </div>
        ) : waitingQr ? (
          <>
            <div className="w-72 h-72 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: "#fff" }}>
              {payload ? (
                payload.startsWith("data:image") ? (
                  // Воркер уже прислал готовую картинку QR (PNG в base64) — показываем как есть,
                  // повторное кодирование строки в QRCodeSVG дало бы нечитаемый "QR внутри QR".
                  <img src={payload} alt="QR-код для входа" className="w-full h-full object-contain" />
                ) : (
                  <QRCodeSVG value={payload} size={264} marginSize={2} level="M" />
                )
              ) : (
                <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <div className="text-[11px] text-center text-white/50 leading-relaxed">
              Откройте Telegram на телефоне → Настройки → Устройства →<br />
              «Подключить устройство» и отсканируйте код
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-xs text-white/50">Ожидаем воркер на VPS...</div>
          </div>
        )}
      </div>
    </div>
  );
}