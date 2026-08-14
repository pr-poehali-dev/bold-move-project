import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Icon from "@/components/ui/icon";
import { crmFetch } from "@/pages/admin/crm/crmApi";

type QrStatus = "pending" | "qr_ready" | "password_needed" | "connected" | "error" | "expired" | "not_connected";

interface StatusResp {
  status: QrStatus;
  qr_url?: string | null;
  account_name?: string | null;
  error?: string | null;
}

// ── Модалка подключения личного аккаунта по QR ──────────────────────────────
// Пока идёт ожидание — опрашиваем backend раз в 2 сек (он сам синхронизируется
// с воркером на VPS, который реально общается с Telegram). Компонент не знает
// про воркер напрямую, только про статус в нашей БД — простая и надёжная связка.
// Если у аккаунта включён облачный пароль (2FA) — backend вернёт статус
// password_needed, и вместо QR показываем поле для ввода пароля.
export default function ChannelQrModal({
  channel, channelLabel, onClose, onConnected,
}: {
  channel: string;
  channelLabel: string;
  onClose: () => void;
  onConnected: (accountName: string | null) => void;
}) {
  const [status, setStatus] = useState<QrStatus>("pending");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [sendingPassword, setSendingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const poll = async () => {
    try {
      const res = await crmFetch("channel-qr-status", {}, { channel }) as StatusResp;
      setStatus(res.status);
      if (res.qr_url) setQrUrl(res.qr_url);
      if (res.status === "connected") {
        stopPolling();
        onConnected(res.account_name ?? null);
      } else if (res.status === "error" || res.status === "expired") {
        setErrorMsg(res.error || (res.status === "expired" ? "QR-код устарел, попробуйте ещё раз" : "Не удалось подключиться"));
        stopPolling();
      }
    } catch {
      // тихий сбой опроса — не прерываем цикл, попробуем на следующем тике
    }
  };

  const start = async () => {
    setStatus("pending");
    setQrUrl(null);
    setErrorMsg(null);
    setPassword("");
    setPasswordError(null);
    try {
      await crmFetch("channel-qr-start", { method: "POST", body: JSON.stringify({ channel }) });
      stopPolling();
      pollRef.current = setInterval(poll, 2000);
      poll();
    } catch {
      setErrorMsg("Не удалось начать подключение — проверьте связь с сервером");
    }
  };

  const submitPassword = async () => {
    if (!password.trim()) return;
    setSendingPassword(true);
    setPasswordError(null);
    try {
      await crmFetch("channel-qr-password", {
        method: "POST",
        body: JSON.stringify({ channel, password: password.trim() }),
      });
      setPassword("");
    } catch {
      setPasswordError("Не удалось отправить пароль — попробуйте ещё раз");
    } finally {
      setSendingPassword(false);
    }
  };

  useEffect(() => {
    start();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col items-center gap-4"
        style={{ background: "#13131f", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between w-full">
          <div className="text-sm font-bold text-white">Подключение {channelLabel}</div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition">
            <Icon name="X" size={18} />
          </button>
        </div>

        {status === "connected" ? (
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
        ) : status === "password_needed" ? (
          <div className="w-full flex flex-col items-center gap-3 py-2">
            <Icon name="Lock" size={32} style={{ color: "#f59e0b" }} />
            <div className="text-xs text-center text-white/60 leading-relaxed">
              На аккаунте включён облачный пароль (2FA) — введите его, чтобы завершить вход
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitPassword()}
              placeholder="Облачный пароль Telegram"
              autoFocus
              className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none text-white"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
            />
            {passwordError && <div className="text-[11px] text-red-400">{passwordError}</div>}
            <button
              onClick={submitPassword}
              disabled={sendingPassword || !password.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
              style={{ background: "#7c3aed", color: "#fff" }}>
              {sendingPassword
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Icon name="Check" size={13} />}
              Подтвердить
            </button>
          </div>
        ) : (
          <>
            <div className="w-72 h-72 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: "#fff" }}>
              {qrUrl ? (
                qrUrl.startsWith("data:image") ? (
                  // Воркер прислал готовую картинку QR (PNG в base64) — показываем как есть.
                  <img src={qrUrl} alt="QR-код для входа" className="w-full h-full object-contain" />
                ) : (
                  <QRCodeSVG value={qrUrl} size={264} marginSize={2} level="M" />
                )
              ) : (
                <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <div className="text-[11px] text-center text-white/50 leading-relaxed">
              Откройте {channelLabel} на телефоне → Настройки → Устройства →<br />
              «Подключить устройство» и отсканируйте код
            </div>
          </>
        )}
      </div>
    </div>
  );
}