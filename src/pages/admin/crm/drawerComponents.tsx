import { useState, useRef } from "react";
import { uploadFile, DEFAULT_TAGS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

// ── InlineField ───────────────────────────────────────────────────────────────
export function InlineField({ label, value, onSave, type = "text", placeholder = "—" }: {
  label: string;
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? ""));
  const ref = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    if (val !== String(value ?? "")) onSave(val);
  };

  const displayVal = () => {
    if (!value) return null;
    if (type === "datetime-local")
      return new Date(String(value)).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    if (type === "number") return Number(value).toLocaleString("ru-RU");
    return String(value);
  };

  return (
    <div className="flex items-center justify-between py-2 group" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <span className="text-xs flex-shrink-0 w-36" style={{ color: t.textMute }}>{label}</span>
      {editing ? (
        <input ref={ref} type={type} value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
          className="flex-1 rounded-lg px-2 py-1 text-sm text-right focus:outline-none"
          style={{ background: t.surface2, color: "#fff", border: "1px solid #7c3aed50" }}
        />
      ) : (
        <button onClick={() => { setEditing(true); setVal(String(value ?? "")); }}
          className="flex-1 text-right text-sm transition hover:opacity-70 truncate">
          {displayVal()
            ? <span style={{ color: "#fff" }}>{displayVal()}</span>
            : <span className="text-xs text-violet-400/60 underline underline-offset-2 decoration-dashed">{placeholder}</span>}
        </button>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function Section({ icon, title, color = "#8b5cf6", children, onEdit, hidden, onToggleHidden }: {
  icon: string; title: string; color?: string; children: React.ReactNode;
  onEdit?: () => void;
  hidden?: boolean;
  onToggleHidden?: () => void;
}) {
  const t = useTheme();
  return (
    <div className="rounded-2xl overflow-hidden group/section" style={{ background: t.surface2, border: `1px solid ${t.border}`, opacity: hidden ? 0.45 : 1 }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: hidden ? "none" : `1px solid ${t.border}` }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "20" }}>
          <Icon name={icon} size={12} style={{ color }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider flex-1" style={{ color }}>{title}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition">
          {onToggleHidden && (
            <button onClick={onToggleHidden} title={hidden ? "Показать" : "Скрыть"}
              className="p-1 rounded-md transition hover:bg-white/10"
              style={{ color: hidden ? color : t.textMute }}>
              <Icon name={hidden ? "EyeOff" : "Eye"} size={12} />
            </button>
          )}
          {onEdit && !hidden && (
            <button onClick={onEdit} title="Редактировать блок"
              className="p-1 rounded-md transition hover:bg-white/10"
              style={{ color: t.textMute }}>
              <Icon name="Pencil" size={12} />
            </button>
          )}
        </div>
      </div>
      {!hidden && <div className="px-4 pb-1">{children}</div>}
    </div>
  );
}

// ── FileField ─────────────────────────────────────────────────────────────────
export function FileField({ label, url, onUploaded, accept = "*" }: {
  label: string; url: string | null | undefined;
  onUploaded: (url: string) => void; accept?: string;
}) {
  const t = useTheme();
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const u = await uploadFile(file);
    onUploaded(u);
    setUploading(false);
  };

  const isImage = url && /\.(jpg|jpeg|png|webp|gif)$/i.test(url);

  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <span className="text-xs w-36 flex-shrink-0" style={{ color: t.textMute }}>{label}</span>
      <div className="flex items-center gap-2">
        {isImage && url && (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={label} className="w-12 h-8 object-cover rounded-md" style={{ border: `1px solid ${t.border}` }} />
          </a>
        )}
        {!isImage && url && (
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-violet-400 underline flex items-center gap-1">
            <Icon name="FileText" size={11} /> Открыть
          </a>
        )}
        <button onClick={() => ref.current?.click()}
          className="text-xs text-violet-400/70 underline decoration-dashed hover:text-violet-300 transition flex items-center gap-1">
          {uploading ? <><Icon name="Loader2" size={11} className="animate-spin" /> Загрузка...</> : <><Icon name="Upload" size={11} /> {url ? "Заменить" : "Загрузить"}</>}
        </button>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ── TagsField ─────────────────────────────────────────────────────────────────
export function TagsField({ tags, onSave }: { tags: string[] | null; onSave: (tags: string[]) => void }) {
  const t = useTheme();
  const current = tags || [];
  const [custom, setCustom] = useState("");

  const toggle = (label: string) => {
    onSave(current.includes(label) ? current.filter(tg => tg !== label) : [...current, label]);
  };
  const addCustom = () => {
    if (!custom.trim() || current.includes(custom.trim())) return;
    onSave([...current, custom.trim()]);
    setCustom("");
  };

  return (
    <div className="pt-2 pb-1">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {DEFAULT_TAGS.map(tg => (
          <button key={tg.label} onClick={() => toggle(tg.label)}
            className="px-2 py-0.5 rounded-lg text-xs font-medium transition border"
            style={current.includes(tg.label)
              ? { background: tg.color + "25", color: tg.color, borderColor: tg.color + "50" }
              : { borderColor: "transparent", background: t.surface, color: t.textMute }}>
            {tg.label}
          </button>
        ))}
        {current.filter(tg => !DEFAULT_TAGS.find(d => d.label === tg)).map(tg => (
          <span key={tg} className="px-2 py-0.5 rounded-lg text-xs font-medium flex items-center gap-1"
            style={{ background: t.surface, color: t.textSub }}>
            {tg}
            <button onClick={() => toggle(tg)} className="hover:text-red-400 transition" style={{ color: t.textMute }}>
              <Icon name="X" size={9} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addCustom()}
          placeholder="Новая метка..."
          className="flex-1 rounded-lg px-3 py-1 text-xs focus:outline-none"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
        <button onClick={addCustom} className="px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs rounded-lg transition">+</button>
      </div>
    </div>
  );
}