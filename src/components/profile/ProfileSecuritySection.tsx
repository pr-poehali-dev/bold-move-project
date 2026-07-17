import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { startSocialLogin } from "@/components/SocialLoginButtons";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import func2url from "@/../backend/func2url.json";
import { Section } from "./ProfileFieldControls";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

const LOGIN_METHOD_META: Record<string, { label: string; color: string; icon: string }> = {
  password: { label: "Пароль",  color: "#a78bfa", icon: "KeyRound" },
  google:   { label: "Google",  color: "#ffffff", icon: "Chrome" },
  yandex:   { label: "Яндекс",  color: "#FC3F1D", icon: "CircleDot" },
  vk:       { label: "VK",      color: "#0077FF", icon: "MessageCircle" },
  telegram: { label: "Telegram",color: "#229ED9", icon: "Send" },
};

function LoginMethodsRow({ methods }: { methods: string[] }) {
  const { token, updateUser } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [err,  setErr]  = useState("");

  if (methods.length === 0) return null;

  const unlink = async (provider: string) => {
    if (provider === "password") return; // пароль отвязывается отдельно, не через эту кнопку
    setErr(""); setBusy(provider);
    try {
      const res = await fetch(`${AUTH_URL}?action=unlink-provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({ provider }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Ошибка");
      updateUser({ login_methods: methods.filter(m => m !== provider) });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-white/[0.04]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/75">Способы входа</span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {methods.map(m => {
            const meta = LOGIN_METHOD_META[m];
            if (!meta) return null;
            const canUnlink = m !== "password";
            return (
              <span key={m}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-[10px] font-medium"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
                <Icon name={meta.icon} size={11} style={{ color: meta.color }} />
                {meta.label}
                {canUnlink && (
                  <button onClick={() => unlink(m)} disabled={busy === m}
                    className="ml-0.5 w-4 h-4 rounded flex items-center justify-center transition hover:bg-red-500/20 disabled:opacity-40"
                    title="Отключить">
                    <Icon name={busy === m ? "Loader2" : "X"} size={10} className={busy === m ? "animate-spin" : ""} style={{ color: "rgba(255,255,255,0.4)" }} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>
      {err && (
        <div className="mt-2 rounded-lg px-3 py-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20">
          {err}
        </div>
      )}
    </div>
  );
}

const LINKABLE_PROVIDERS: { key: "google" | "yandex" | "telegram"; label: string; color: string; icon: string }[] = [
  { key: "google",   label: "Google",   color: "#ffffff", icon: "Chrome" },
  { key: "yandex",   label: "Яндекс",   color: "#FC3F1D", icon: "CircleDot" },
  { key: "telegram", label: "Telegram", color: "#229ED9", icon: "Send" },
];

function LinkMethodsRow({ methods }: { methods: string[] }) {
  const { token } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const missing = LINKABLE_PROVIDERS.filter(p => !methods.includes(p.key));
  if (missing.length === 0 || !token) return null;

  return (
    <div className="px-4 py-3 border-b border-white/[0.04]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-white/75">Привязать ещё</span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {missing.map(p => {
            if (p.key === "telegram") {
              return (
                <TelegramLoginButton key="telegram" linkToken={token} variant="badge"
                  label="Telegram"
                  onLinked={() => { window.location.href = "/?profile=1&linked=telegram"; }} />
              );
            }
            return (
              <button key={p.key}
                onClick={() => startSocialLogin(p.key as "google" | "yandex", v => setLoadingProvider(v ? p.key : null), m => setErr(m || ""), token)}
                disabled={loadingProvider !== null}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition hover:bg-white/[0.08] disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}>
                <Icon name={loadingProvider === p.key ? "Loader2" : p.icon} size={12}
                  className={loadingProvider === p.key ? "animate-spin" : ""} style={{ color: p.color }} />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      {err && (
        <div className="mt-2 rounded-lg px-3 py-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20">
          {err}
        </div>
      )}
    </div>
  );
}

function PwdField({ label, value, onChange, show, autoComplete = "new-password" }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; autoComplete?: string;
}) {
  return (
    <div className="flex items-center px-3 py-2 rounded-lg"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="text-[10px] text-white/35 w-24 flex-shrink-0">{label}</span>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="••••••••"
        autoComplete={autoComplete}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        className="flex-1 text-xs bg-transparent placeholder-white/15 focus:outline-none transition text-right text-white/80"
      />
    </div>
  );
}

function ChangePasswordBlock({ hasPassword }: { hasPassword: boolean }) {
  const { token } = useAuth();
  const [open,     setOpen]     = useState(false);
  const [forgot,   setForgot]   = useState(false); // режим "забыли пароль" — код с почты вместо текущего пароля
  const [oldPwd,   setOldPwd]   = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPwd,   setNewPwd]   = useState("");
  const [repPwd,   setRepPwd]   = useState("");
  const [show,     setShow]     = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);
  const [err,      setErr]      = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailMasked, setEmailMasked] = useState("");
  const [sendingCode, setSendingCode] = useState(false);

  const reset = () => {
    setOldPwd(""); setResetCode(""); setNewPwd(""); setRepPwd(""); setErr(""); setDone(false);
    setForgot(false); setCodeSent(false); setEmailMasked("");
  };

  const sendCode = async () => {
    setErr(""); setSendingCode(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=request-password-reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Не удалось отправить код");
      setCodeSent(true);
      setEmailMasked(d.email_masked || "");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSendingCode(false);
    }
  };

  const submit = async () => {
    setErr(""); setDone(false);
    if (hasPassword && forgot && !resetCode)  { setErr("Введите код из письма"); return; }
    if (hasPassword && !forgot && !oldPwd)    { setErr("Заполните все поля"); return; }
    if (!newPwd || !repPwd)                    { setErr("Заполните все поля"); return; }
    if (newPwd.length < 6)              { setErr("Новый пароль минимум 6 символов"); return; }
    if (newPwd !== repPwd)              { setErr("Новые пароли не совпадают"); return; }

    setBusy(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          old_password: hasPassword && !forgot ? oldPwd : undefined,
          reset_code: hasPassword && forgot ? resetCode : undefined,
          new_password: newPwd,
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Ошибка");
      setDone(true);
      setTimeout(() => { reset(); setOpen(false); }, 1800);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3 transition hover:bg-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <Icon name="KeyRound" size={13} style={{ color: "#a78bfa" }} />
          <span className="text-xs font-semibold text-white/75">{hasPassword ? "Сменить пароль" : "Установить пароль"}</span>
        </div>
        <Icon name="ChevronRight" size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="KeyRound" size={13} style={{ color: "#a78bfa" }} />
          <span className="text-xs font-bold text-white">{hasPassword ? "Смена пароля" : "Установка пароля"}</span>
        </div>
        <button onClick={() => setShow(s => !s)}
          className="text-[10px] text-white/40 hover:text-white/70 flex items-center gap-1 transition">
          <Icon name={show ? "EyeOff" : "Eye"} size={11} />
          {show ? "Скрыть" : "Показать"}
        </button>
      </div>

      {!hasPassword && (
        <div className="rounded-lg px-3 py-2 text-[11px] text-white/40 bg-white/[0.03] border border-white/[0.06]">
          Вы вошли через соцсеть, пароль ещё не задан. Придумайте пароль, чтобы также входить по email.
        </div>
      )}

      {hasPassword && !forgot && (
        <>
          <PwdField label="Текущий пароль" value={oldPwd} onChange={setOldPwd} show={show} />
          <button onClick={() => { setForgot(true); setErr(""); }}
            className="text-[10px] text-violet-300/70 hover:text-violet-300 transition">
            Забыли пароль?
          </button>
        </>
      )}

      {hasPassword && forgot && (
        <div className="space-y-2">
          {!codeSent ? (
            <div className="rounded-lg px-3 py-2.5 text-[11px] text-white/50 bg-white/[0.03] border border-white/[0.06] space-y-2">
              <p>Пришлём код подтверждения на вашу почту вместо текущего пароля.</p>
              <button onClick={sendCode} disabled={sendingCode}
                className="w-full py-1.5 rounded-lg text-[11px] font-bold text-white transition disabled:opacity-50"
                style={{ background: "#a78bfa" }}>
                {sendingCode ? "Отправка..." : "Отправить код на почту"}
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-lg px-3 py-2 text-[11px] text-green-300 bg-green-500/10 border border-green-500/20 flex items-center gap-1.5">
                <Icon name="Mail" size={12} /> Код отправлен на {emailMasked}
              </div>
              <PwdField label="Код с почты" value={resetCode} onChange={setResetCode} show={true} autoComplete="one-time-code" />
              <button onClick={sendCode} disabled={sendingCode}
                className="text-[10px] text-white/40 hover:text-white/60 transition">
                {sendingCode ? "Отправка..." : "Отправить код ещё раз"}
              </button>
            </>
          )}
          <button onClick={() => { setForgot(false); setResetCode(""); setCodeSent(false); setErr(""); }}
            className="block text-[10px] text-white/40 hover:text-white/60 transition">
            ← Ввести текущий пароль
          </button>
        </div>
      )}

      {(!hasPassword || !forgot || codeSent) && (
        <>
          <PwdField label="Новый пароль" value={newPwd} onChange={setNewPwd} show={show} />
          <PwdField label="Повторите"    value={repPwd} onChange={setRepPwd} show={show} />
        </>
      )}

      {err && (
        <div className="rounded-lg px-3 py-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20">
          {err}
        </div>
      )}
      {done && (
        <div className="rounded-lg px-3 py-2 text-[11px] text-green-300 bg-green-500/10 border border-green-500/20 flex items-center gap-1.5">
          <Icon name="CheckCircle2" size={12} /> Пароль {hasPassword ? "изменён" : "установлен"}
        </div>
      )}

      {(!hasPassword || !forgot || codeSent) && (
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={busy}
            className="flex-1 py-2 rounded-lg text-[11px] font-bold text-white transition disabled:opacity-50"
            style={{ background: "#a78bfa" }}>
            {busy ? "Сохранение..." : hasPassword ? "Изменить пароль" : "Установить пароль"}
          </button>
          <button onClick={() => { reset(); setOpen(false); }}
            className="px-3 py-2 rounded-lg text-[11px] text-white/50 transition"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            Отмена
          </button>
        </div>
      )}

      {hasPassword && (
        <div className="text-[10px] text-white/30 leading-snug pt-1">
          После смены пароля все остальные устройства будут разлогинены.
        </div>
      )}
    </div>
  );
}

interface Props {
  loginMethods: string[];
  hasPassword: boolean;
}

export default function ProfileSecuritySection({ loginMethods, hasPassword }: Props) {
  return (
    <Section title="Безопасность" icon="ShieldCheck">
      <LoginMethodsRow methods={loginMethods} />
      <LinkMethodsRow methods={loginMethods} />
      <ChangePasswordBlock hasPassword={hasPassword} />
    </Section>
  );
}