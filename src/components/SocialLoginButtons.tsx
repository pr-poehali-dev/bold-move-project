// Кнопки входа через Google / Яндекс. Работают с backend/auth (action=google-auth-url,
// action=yandex-auth-url) — получают auth_url, сохраняют state в sessionStorage и редиректят.
// Callback-страницы (/auth/google/callback, /auth/yandex/callback) завершают вход через loginWithToken.
import { useState } from "react";
import GoogleLoginButton from "@/components/extensions/google-auth/GoogleLoginButton";
import YandexLoginButton from "@/components/extensions/yandex-auth/YandexLoginButton";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

export const SOCIAL_STATE_KEY = "social_auth_state";

async function startSocialLogin(
  provider: "google" | "yandex",
  setLoading: (v: boolean) => void,
  setError: (msg: string | null) => void,
) {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch(`${AUTH_URL}?action=${provider}-auth-url`, { method: "GET" });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Не удалось начать вход");
    if (data.state) sessionStorage.setItem(SOCIAL_STATE_KEY, data.state);
    window.location.href = data.auth_url;
  } catch (err: unknown) {
    setLoading(false);
    setError(err instanceof Error ? err.message : "Не удалось начать вход");
  }
}

interface Props {
  className?: string;
}

export default function SocialLoginButtons({ className }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<"google" | "yandex" | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="flex items-center gap-2 my-1">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] text-white/30">или</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <GoogleLoginButton
        className="w-full"
        isLoading={loadingProvider === "google"}
        disabled={loadingProvider !== null}
        onClick={() => startSocialLogin("google", v => setLoadingProvider(v ? "google" : null), setError)}
      />
      <YandexLoginButton
        className="w-full"
        isLoading={loadingProvider === "yandex"}
        disabled={loadingProvider !== null}
        onClick={() => startSocialLogin("yandex", v => setLoadingProvider(v ? "yandex" : null), setError)}
      />
      {error && (
        <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
      )}
    </div>
  );
}