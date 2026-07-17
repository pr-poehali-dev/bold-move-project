// Кнопка входа через Telegram — визуально в одном стиле с Google/Яндекс.
// Вместо стандартного iframe-виджета используется JS API Telegram.Login.auth(),
// которое открывает всплывающее окно входа по клику на нашу кнопку и возвращает
// данные пользователя в колбэк. Проверка подлинности — на backend (action=telegram-callback).
// Требует привязки домена к боту через @BotFather → /setdomain (уже сделано).
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    Telegram?: {
      Login: {
        auth: (
          options: { bot_id: string; request_access?: boolean | string },
          callback: (user: TelegramAuthData | false) => void
        ) => void;
      };
    };
  }
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <circle cx="120" cy="120" r="120" fill="#229ED9" />
      <path
        fill="#fff"
        d="M170.6 72.6l-19.8 96.5c-1.5 6.6-5.4 8.3-11 5.1l-30.4-22.4-14.7 14.1c-1.6 1.6-3 3-6.1 3l2.2-31.2 56.8-51.3c2.5-2.2-.5-3.4-3.8-1.2l-70.2 44.2-30.2-9.4c-6.6-2-6.7-6.6 1.4-9.8l118-45.5c5.5-2 10.3 1.3 8.6 9.5z"
      />
    </svg>
  );
}

interface Props {
  className?: string;
  /** Если задан — не логинит новым токеном, а привязывает Telegram к уже вошедшему пользователю */
  linkToken?: string;
  /** Колбэк при успешной привязке (используется вместе с linkToken) */
  onLinked?: () => void;
  label?: string;
}

export default function TelegramLoginButton({ className = "", linkToken, onLinked, label }: Props) {
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const botIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    fetch(`${AUTH_URL}?action=telegram-bot-id`)
      .then(res => res.json())
      .then(data => { if (data.bot_id) botIdRef.current = data.bot_id; })
      .catch(() => {});

    if (!scriptLoadedRef.current && !document.querySelector('script[src*="telegram-widget.js"]')) {
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      document.body.appendChild(script);
      scriptLoadedRef.current = true;
    }
  }, []);

  const handleClick = () => {
    setError(null);
    if (!window.Telegram?.Login || !botIdRef.current) {
      setError("Telegram ещё загружается, попробуйте через секунду");
      return;
    }
    setLoading(true);
    window.Telegram.Login.auth(
      { bot_id: botIdRef.current, request_access: true },
      async (user) => {
        if (!user) { setLoading(false); return; }
        try {
          const res = await fetch(`${AUTH_URL}?action=telegram-callback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(linkToken ? { ...user, link_token: linkToken } : user),
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || "Не удалось войти через Telegram");
          if (linkToken) { onLinked?.(); return; }
          await loginWithToken(data.token);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Не удалось войти через Telegram");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  return (
    <div>
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`bg-[#229ED9] hover:bg-[#1c8bc0] text-white ${className}`}
      >
        {loading ? (
          <Spinner className="!w-5 !h-5 mr-2 flex-shrink-0" />
        ) : (
          <TelegramIcon className="!w-5 !h-5 mr-2 flex-shrink-0" />
        )}
        {loading ? "Загрузка..." : (label || "Войти через Telegram")}
      </Button>
      {error && (
        <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 mt-1.5">{error}</div>
      )}
    </div>
  );
}