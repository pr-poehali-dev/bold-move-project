// Кнопка входа через Telegram Login Widget. В отличие от Google/Яндекс работает без
// редиректа на отдельную страницу — Telegram сам встраивает iframe-кнопку и после
// подтверждения пользователя вызывает наш JS-колбэк с данными для проверки на backend
// (action=telegram-callback). Требует, чтобы домен сайта был привязан к боту через
// @BotFather → /setdomain.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];
const TELEGRAM_BOT_USERNAME = "PotolkiMSbot";

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
    __onTelegramAuth?: (user: TelegramAuthData) => void;
  }
}

interface Props {
  className?: string;
}

export default function TelegramLoginButton({ className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.__onTelegramAuth = async (user: TelegramAuthData) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${AUTH_URL}?action=telegram-callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Не удалось войти через Telegram");
        await loginWithToken(data.token);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Не удалось войти через Telegram");
      } finally {
        setLoading(false);
      }
    };

    if (containerRef.current && !containerRef.current.hasChildNodes()) {
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-radius", "12");
      script.setAttribute("data-onauth", "__onTelegramAuth(user)");
      script.setAttribute("data-request-access", "write");
      containerRef.current.appendChild(script);
    }

    return () => {
      delete window.__onTelegramAuth;
    };
  }, [loginWithToken]);

  return (
    <div className={className}>
      <div ref={containerRef} className="flex justify-center w-full [&>iframe]:!w-full" />
      {loading && <p className="text-center text-[11px] text-white/40 mt-1.5">Входим через Telegram…</p>}
      {error && (
        <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 mt-1.5">{error}</div>
      )}
    </div>
  );
}
