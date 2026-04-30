import { useEffect, useRef, useState } from "react";
import { Spin } from "./WLHelpers";

export function IframeAdmin({ token, tab }: { token: string | null; tab?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const src = `/company?iframe=1${tab ? `&tab=${tab}` : ""}`;

  useEffect(() => {
    if (!token || !iframeRef.current) return;
    const handler = (e: MessageEvent) => {
      if (e.data === "iframe-ready") {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "set-token", token },
          window.location.origin
        );
        setReady(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [token]);

  return (
    <div className="flex-1 relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#06060c" }}>
          <Spin /><span className="ml-2 text-white/40 text-sm">Загрузка панели...</span>
        </div>
      )}
      <iframe
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
