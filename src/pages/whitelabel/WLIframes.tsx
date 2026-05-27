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

    const send = () => {
      if (readyRef.current || !iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        { type: "set-token", token },
        window.location.origin
      );
    };

    // Слушаем подтверждение от iframe
    const handler = (e: MessageEvent) => {
      if (e.data === "iframe-ready") {
        send();
      }
      // Когда iframe получил токен и снова слет "iframe-ready" после apply — считаем готовым
      // Но проще: помечаем ready через небольшой таймаут после первой отправки
    };
    window.addEventListener("message", handler);

    // Активно шлём токен каждые 200ms пока iframe не примет
    const interval = setInterval(() => {
      if (readyRef.current) { clearInterval(interval); return; }
      send();
    }, 200);

    // Через 3 секунды в любом случае показываем iframe
    const fallback = setTimeout(() => {
      readyRef.current = true;
      setReady(true);
      clearInterval(interval);
    }, 3000);

    return () => {
      window.removeEventListener("message", handler);
      clearInterval(interval);
      clearTimeout(fallback);
    };
  }, [token]);  

  // Когда iframe принял токен — он перестаёт пинговать и loading в нём снимается.
  // Мы показываем iframe через 600ms после первой успешной отправки.
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => { readyRef.current = true; setReady(true); }, 600);
    return () => clearTimeout(t);
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