import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import PhoneInput from "@/components/ui/PhoneInput";
import { uploadBrandImage } from "./brandApi";

// ── Shared style helpers ──────────────────────────────────────────────────────
export function fieldStyles(isDark: boolean) {
  return {
    muted:  isDark ? "rgba(255,255,255,0.4)"   : "#6b7280",
    border: isDark ? "rgba(255,255,255,0.08)"  : "#e5e7eb",
    bg:     isDark ? "rgba(255,255,255,0.05)"  : "#f9fafb",
    text:   isDark ? "#fff"                    : "#0f1623",
  };
}

// ── Section ───────────────────────────────────────────────────────────────────
export function Section({ title, icon, children, isDark }: {
  title: string; icon: string; children: React.ReactNode; isDark: boolean;
}) {
  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon name={icon} size={13} style={{ color: "#a78bfa" }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: muted }}>{title}</span>
      </div>
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: bg, border: `1px solid ${border}` }}>
        {children}
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
export function Field({ label, value, onChange, placeholder, type = "text", multiline, rows = 2, isDark, aiBtn }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; multiline?: boolean; rows?: number; isDark: boolean;
  aiBtn?: React.ReactNode;
}) {
  const { muted, border, bg, text } = fieldStyles(isDark);
  const cls = "w-full px-3.5 py-2.5 rounded-xl text-sm transition focus:outline-none";
  const style = { background: bg, border: `1px solid ${border}`, color: text };
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      <div className="relative">
        {multiline
          ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
              placeholder={placeholder} className={cls + " resize-none"} style={style} />
          : <input type={type} value={value} onChange={e => onChange(e.target.value)}
              placeholder={placeholder} className={cls + (aiBtn && !value ? " pr-16" : "")} style={style} />
        }
        {aiBtn && !value && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{aiBtn}</div>
        )}
      </div>
    </div>
  );
}

// ── AiFieldBtn ────────────────────────────────────────────────────────────────
export function AiFieldBtn({ field, busy, attempts, onRun, siteUrl }: {
  field: string; busy: boolean; attempts: number; onRun: (f: string) => void; siteUrl: string;
}) {
  if (!siteUrl) return null;
  if (attempts >= 2) return (
    <span className="text-[9px] flex items-center gap-1" style={{ color: "#ef4444" }}>
      <svg width="9" height="8" viewBox="0 0 9 8" fill="none">
        <path d="M4.5 0.5L8.5 7.5H0.5L4.5 0.5Z" fill="#ef4444"/>
        <text x="4.5" y="6.5" textAnchor="middle" fontSize="4" fontWeight="900" fill="white">!</text>
      </svg>
      вручную
    </span>
  );
  return (
    <button disabled={busy} onClick={() => onRun(field)}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition hover:opacity-80 disabled:opacity-40"
      style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}>
      {busy
        ? <div className="w-2 h-2 border border-current/30 border-t-current rounded-full animate-spin" />
        : <Icon name="Sparkles" size={9} />
      }
      {busy ? "..." : attempts > 0 ? "ещё" : "AI"}
    </button>
  );
}

// ── ChoiceField ───────────────────────────────────────────────────────────────
export function ChoiceField({ label, value, onChange, options, isDark }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { val: string; label: string; icon: string }[]; isDark: boolean;
}) {
  const { muted, border, bg, text } = fieldStyles(isDark);
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(o => {
          const active = o.val === value;
          return (
            <button key={o.val} onClick={() => onChange(o.val)}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold transition"
              style={active
                ? { background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa" }
                : { background: bg, border: `1px solid ${border}`, color: text }}>
              <Icon name={o.icon} size={13} />
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── PhoneField ────────────────────────────────────────────────────────────────
export function PhoneField({ label, value, onChange, isDark }: {
  label: string; value: string; onChange: (v: string) => void; isDark: boolean;
}) {
  const { muted, border, bg, text } = fieldStyles(isDark);
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      <PhoneInput value={value} onChange={onChange} showValidation
        className="w-full px-3.5 py-2.5 rounded-xl text-sm transition focus:outline-none"
        style={{ background: bg, border: `1px solid ${border}`, color: text }} />
    </div>
  );
}

// ── ColorField ────────────────────────────────────────────────────────────────
export function ColorField({ label, value, onChange, isDark }: {
  label: string; value: string; onChange: (v: string) => void; isDark: boolean;
}) {
  const { muted, border, bg, text } = fieldStyles(isDark);
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-12 h-10 rounded-lg cursor-pointer flex-shrink-0"
          style={{ background: bg, border: `1px solid ${border}` }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder="#f97316"
          className="flex-1 px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase transition focus:outline-none"
          style={{ background: bg, border: `1px solid ${border}`, color: text }} />
        <div className="w-10 h-10 rounded-lg flex-shrink-0"
          style={{ background: value, border: `1px solid ${border}` }} />
      </div>
    </div>
  );
}

// ── Определение ориентации изображения ───────────────────────────────────────
function detectOrientation(url: string): Promise<"horizontal" | "vertical"> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      // горизонтальный если ширина > высоты * 1.2, иначе квадратный/вертикальный
      resolve(img.width > img.height * 1.2 ? "horizontal" : "vertical");
    };
    img.onerror = () => resolve("horizontal");
    img.src = url;
  });
}

// ── ImageUploader ─────────────────────────────────────────────────────────────
export function ImageUploader({ label, hint, value, onChange, token, isDark, onOrientationDetected }: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
  token: string | null; isDark: boolean;
  onOrientationDetected?: (o: "horizontal" | "vertical") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const { muted, border, bg } = fieldStyles(isDark);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("Файл больше 2 МБ"); return; }
    setErr(""); setBusy(true);
    try {
      const url = await uploadBrandImage(token, file);
      onChange(url);
      if (onOrientationDetected) {
        const orientation = await detectOrientation(url);
        onOrientationDetected(orientation);
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: bg, border: `1px dashed ${border}` }}>
          {value
            ? <img src={value} alt="" className="w-full h-full object-contain" />
            : <Icon name="Image" size={20} style={{ color: muted }} />}
        </div>
        <div className="flex-1 min-w-0">
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => inputRef.current?.click()} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition disabled:opacity-50"
              style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.32)" }}>
              {busy
                ? <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Загрузка...</>
                : <><Icon name="Upload" size={11} /> {value ? "Заменить" : "Загрузить"}</>}
            </button>
            {value && (
              <button onClick={() => onChange("")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition"
                style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                <Icon name="X" size={11} /> Убрать
              </button>
            )}
          </div>
          <div className="text-[10px] mt-1" style={{ color: muted }}>{hint}</div>
        </div>
      </div>
      {err && <div className="text-[10.5px] mt-1.5" style={{ color: "#ef4444" }}>{err}</div>}
    </div>
  );
}

// ── CopyLink ──────────────────────────────────────────────────────────────────
export function CopyLink({ link, isDark }: { link: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };
  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.04)" : "#f9fafb";
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <Icon name="Link" size={11} style={{ color: muted }} />
      <span className="text-[11px] font-mono max-w-[220px] truncate" style={{ color: muted }}>{link}</span>
      <button onClick={copy} className="flex items-center gap-1 text-[11px] font-bold transition"
        style={{ color: copied ? "#10b981" : "#a78bfa" }}>
        <Icon name={copied ? "Check" : "Copy"} size={11} />
        {copied ? "Скопировано" : "Копировать"}
      </button>
    </div>
  );
}