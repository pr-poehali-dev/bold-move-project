import { useEffect, useState } from "react";
import { Spin } from "./WLHelpers";

const WL_TOKEN_KEY = "wl_iframe_token";

export function IframeAdmin({ token, tab }: { token: string | null; tab?: string }) {
  const [ready, setReady] = useState(false);

  // Пишем токен в localStorage — iframe прочитает его при загрузке (same-origin)
  useEffect(() => {
    if (!token) return;
    setReady(false);
    localStorage.setItem(WL_TOKEN_KEY, token);
    console.log("[WL] token written to localStorage, key=", WL_TOKEN_KEY);
    // Даём iframe время загрузиться и применить токен
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, [token]);

  const src = `/company?iframe=1${tab ? `&tab=${tab}` : ""}`;

  return (
    <div className="flex-1 relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#06060c" }}>
          <Spin /><span className="ml-2 text-white/40 text-sm">Загрузка панели...</span>
        </div>
      )}
      {token && (
        <iframe
          key={token}
          src={src}
          className="w-full h-full border-0"
          title="Панель управления компании"
          style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s" }}
        />
      )}
    </div>
  );
}

export function IframeSiteAuthed({ url, token }: { url: string; token: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    localStorage.setItem(WL_TOKEN_KEY, token);
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, [token]);

  return (
    <div className="flex-1 relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#06060c" }}>
          <Spin /><span className="ml-2 text-white/40 text-sm">Авторизация...</span>
        </div>
      )}
      <iframe
        key={token}
        src={`${url}${url.includes("?") ? "&" : "?"}iframe=1`}
        className="w-full h-full border-0"
        title="Демо-сайт"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s" }}
      />
    </div>
  );
}