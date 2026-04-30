import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { CheckResult } from "./wlTypes";

export function Section({ title, icon, color, children }: {
  title: string; icon: string; color: string; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}1f` }}>
          <Icon name={icon} size={14} style={{ color }} />
        </div>
        <h2 className="text-sm font-black uppercase tracking-wider" style={{ color }}>{title}</h2>
      </div>
      <div className="rounded-2xl p-4 space-y-2.5"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {children}
      </div>
    </section>
  );
}

export function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const el = document.createElement("input");
    el.value = value;
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-white/30">{label}</div>
        {href
          ? <a href={href} target="_blank" rel="noreferrer"
              className="text-xs font-mono truncate block hover:underline"
              style={{ color: "#06b6d4" }}>{value}</a>
          : <div className="text-xs font-mono text-white/80 truncate">{value}</div>
        }
      </div>
      <button onClick={copy} className="text-white/40 hover:text-white/80 transition flex-shrink-0 p-1">
        <Icon name={copied ? "Check" : "Copy"} size={11} style={{ color: copied ? "#10b981" : undefined }} />
      </button>
    </div>
  );
}

export function LinkBtn({ icon, label, href, target, onClick, color }: {
  icon: string; label: string; href?: string; target?: string;
  onClick?: () => void | undefined; color: string;
}) {
  const cls = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition cursor-pointer";
  const style = { background: `${color}1f`, color, border: `1px solid ${color}40` };
  if (href) return <a href={href} target={target} rel="noreferrer" className={cls} style={style}>
    <Icon name={icon} size={12} />{label}
  </a>;
  return <button onClick={onClick} className={cls} style={style}>
    <Icon name={icon} size={12} />{label}
  </button>;
}

export function TestRow({ id, name, onRun, running, result }: {
  id: string; name: string; onRun: () => void;
  running: string | null; result: CheckResult | null;
}) {
  const isRun = running === id;
  return (
    <div className="rounded-xl p-3"
      style={{
        background: result ? (result.ok ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)") : "rgba(255,255,255,0.025)",
        border: `1px solid ${result ? (result.ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)") : "rgba(255,255,255,0.06)"}`,
      }}>
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: result ? (result.ok ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)") : "rgba(255,255,255,0.05)" }}>
          {isRun
            ? <Spin />
            : <Icon name={result ? (result.ok ? "Check" : "X") : "Circle"} size={13}
                style={{ color: result ? (result.ok ? "#10b981" : "#ef4444") : "rgba(255,255,255,0.4)" }} />}
        </div>
        <div className="flex-1 text-[12px] text-white/80">{name}</div>
        <button onClick={onRun} disabled={!!running}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition disabled:opacity-50"
          style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.35)" }}>
          {isRun ? "..." : "Запустить"}
        </button>
      </div>
      {result && (
        <div className="mt-2 ml-10 text-[11px] leading-snug"
          style={{ color: result.ok ? "#86efac" : "#fca5a5" }}>
          {result.label}
        </div>
      )}
      {result?.data && (
        <pre className="mt-2 ml-10 text-[10px] text-white/40 bg-white/[0.03] rounded-lg px-2 py-1.5 overflow-x-auto whitespace-pre-wrap">
          {result.data}
        </pre>
      )}
    </div>
  );
}

export function Spin() {
  return <div className="w-3 h-3 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />;
}

export function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center" style={{ background: "#06060c" }}>{children}</div>;
}

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