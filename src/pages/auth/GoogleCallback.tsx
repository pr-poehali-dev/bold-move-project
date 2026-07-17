// Страница возврата от Google OAuth — обменивает code на сессию через backend/auth
// (action=google-callback), затем логинится тем же токеном, что и обычный вход.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { SOCIAL_STATE_KEY, SOCIAL_LINK_TOKEN_KEY } from "@/components/SocialLoginButtons";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

export default function GoogleCallback() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const storedState = sessionStorage.getItem(SOCIAL_STATE_KEY);
      const linkToken = sessionStorage.getItem(SOCIAL_LINK_TOKEN_KEY);
      sessionStorage.removeItem(SOCIAL_STATE_KEY);
      sessionStorage.removeItem(SOCIAL_LINK_TOKEN_KEY);

      if (!code) { setError("Google не передал код авторизации"); return; }
      if (storedState && state !== storedState) { setError("Ошибка проверки безопасности (state)"); return; }

      try {
        const res = await fetch(`${AUTH_URL}?action=google-callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(linkToken ? { code, link_token: linkToken } : { code }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setError(data.error || "Не удалось войти через Google"); return; }
        if (linkToken) { navigate("/?profile=1&linked=google", { replace: true }); return; }
        await loginWithToken(data.token);
        navigate("/", { replace: true });
      } catch {
        setError("Ошибка сети");
      }
    };
    run();
  }, [loginWithToken, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0b0b11" }}>
      <div className="text-center">
        {error ? (
          <>
            <Icon name="CircleAlert" size={32} className="mx-auto mb-3" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white/70 mb-4">{error}</p>
            <button onClick={() => navigate("/", { replace: true })}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#f97316" }}>
              Вернуться на главную
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-white/50">Входим через Google…</p>
          </>
        )}
      </div>
    </div>
  );
}