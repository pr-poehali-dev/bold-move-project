import { useEffect, useRef, useState } from "react";
import { Spin } from "./WLHelpers";

export function IframeAdmin({ token, tab }: { token: string | null; tab?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const src = `/company?iframe=1${tab ? `&tab=${tab}` : ""}`;

  useEffect(() => {
    if (!token) return;
    readyRef.current = false;
    setReady(false);
    let tokenSent = false;

    const send = () => {
      const cw = iframeRef.current?.contentWindow;
      if (!cw) return;
      cw.postMessage({ type: "set-token", token }, "*");
      console.log("[WL] postMessage sent, token=", token.slice(0, 8));
      if (!tokenSent) {
        tokenSent = true;
        // Показываем iframe через 800ms после первой отправки
        setTimeout(() => { readyRef.current = true; setReady(true); }, 800);
      }
    };

    const handler = (e: MessageEvent) => {
      if (e.data === "iframe-ready") send();
    };
    window.addEventListener("message", handler);

    // Активно шлём токен каждые 300ms — iframe мог загрузиться раньше нашего listener
    const interval = setInterval(() => {
      if (readyRef.current) { clearInterval(interval); return; }
      send();
    }, 300);

    // Fallback: через 4 секунды показываем в любом случае
    const fallback = setTimeout(() => {
      readyRef.current = true;
      setReady(true);
      clearInterval(interval);
    }, 4000);

    return () => {
      window.removeEventListener("message", handler);
      clearInterval(interval);
      clearTimeout(fallback);
    };
  }, [token]);  

  return (
    <div className="flex-1 relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#06060c" }}>
          <Spin /><span className="ml-2 text-white/40 text-sm">Загрузка панели...</span>
        </div>
      )}
      <iframe
        key={token ?? "no-token"}
        ref={iframeRef}
        src={src}
        className="w-full h-full border-0"
        title="Панель управления компании"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s" }}
      />
    </div>
  );
}

export function IframeSiteAuthed({ url, token }: { url: string; token: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const tokenSentRef = useRef(false);

  const sendToken = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "set-token", token },
      window.location.origin
    );
  };

  useEffect(() => {
    tokenSentRef.current = false;
    const handler = (e: MessageEvent) => {
      if (e.data === "iframe-ready") {
        sendToken();
        if (!tokenSentRef.current) {
          tokenSentRef.current = true;
          setTimeout(() => setReady(true), 600);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#06060c" }}>
          <Spin /><span className="ml-2 text-white/40 text-sm">Авторизация...</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={`${url}${url.includes("?") ? "&" : "?"}iframe=1`}
        className="w-full h-full border-0"
        title="Демо-сайт"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s" }}
      />
    </div>
  );
}