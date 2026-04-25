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
    if (!value && value !== 0) return null;
    if (type === "datetime-local")
      return new Date(String(value)).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    if (type === "number") return Number(value).toLocaleString("ru-RU");
    return String(value);
  };

  return (
    <div className="flex items-center justify-between py-2 group" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <span className="text-xs flex-shrink-0 w-36" style={{ color: "#a3a3a3" }}>{label}</span>
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
              style={{ color: hidden ? color : "#a3a3a3" }}>
              <Icon name={hidden ? "EyeOff" : "Eye"} size={12} />
            </button>
          )}
          {onEdit && !hidden && (
            <button onClick={onEdit} title="Редактировать блок"
              className="p-1 rounded-md transition hover:bg-white/10"
              style={{ color: "#a3a3a3" }}>
              <Icon name="Pencil" size={12} />
            </button>
          )}
        </div>
      </div>
      {!hidden && <div className="px-4 pb-1">{children}</div>}
    </div>
  );
}

// ── FileField — множественная загрузка ────────────────────────────────────────
export function FileField({ label, url, onUploaded, accept = "*" }: {
  label: string;
  url: string | null | undefined;
  onUploaded: (url: string, filename: string) => void;
  accept?: string;
}) {
  const t = useTheme();
  const [uploading, setUploading] = useState(false);
  const [uploadedList, setUploadedList] = useState<{ url: string; name: string }[]>(
    url ? [{ url, name: url.split("/").pop() || "файл" }] : []
  );
  const ref = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const u = await uploadFile(file);
      setUploadedList(prev => [...prev, { url: u, name: file.name }]);
      onUploaded(u, file.name);
    }
    setUploading(false);
    if (ref.current) ref.current.value = "";
  };

  const isImage = (u: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(u);

  return (
    <div className="py-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs w-36 flex-shrink-0" style={{ color: "#a3a3a3" }}>{label}</span>
        <button onClick={() => ref.current?.click()}
          className="text-xs text-violet-400/70 underline decoration-dashed hover:text-violet-300 transition flex items-center gap-1">
          {uploading
            ? <><Icon name="Loader2" size={11} className="animate-spin" /> Загрузка...</>
            : <><Icon name="Upload" size={11} /> Загрузить</>}
        </button>
        <input ref={ref} type="file" accept={accept} multiple className="hidden" onChange={handleFiles} />
      </div>
      {uploadedList.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1 pl-36">
          {uploadedList.map((f, i) => (
            isImage(f.url) ? (
              <a key={i} href={f.url} target="_blank" rel="noreferrer" title={f.name}>
                <img src={f.url} alt={f.name} className="w-14 h-10 object-cover rounded-md hover:opacity-80 transition"
                  style={{ border: `1px solid ${t.border}` }} />
              </a>
            ) : (
              <a key={i} href={f.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-violet-400 underline hover:text-violet-300 transition max-w-[120px] truncate">
                <Icon name="FileText" size={11} className="flex-shrink-0" />
                <span className="truncate">{f.name}</span>
              </a>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ── TagsField — управляется через editMode проп (карандашик в Section) ────────
export function TagsField({ tags, onSave, editMode = false }: {
  tags: string[] | null;
  onSave: (tags: string[]) => void;
  editMode?: boolean;
}) {
  const t = useTheme();
  const current = tags || [];
  const [newLabel, setNewLabel] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");

  const toggle = (label: string) => {
    onSave(current.includes(label) ? current.filter(tg => tg !== label) : [...current, label]);
  };

  const deleteTag = (label: string) => {
    onSave(current.filter(tg => tg !== label));
  };

  const renameTag = (oldLabel: string, newLbl: string) => {
    const trimmed = newLbl.trim();
    if (!trimmed || trimmed === oldLabel) { setEditingIdx(null); return; }
    onSave(current.map(tg => tg === oldLabel ? trimmed : tg));
    setEditingIdx(null);
  };

  const addNew = () => {
    const trimmed = newLabel.trim();
    if (!trimmed || current.includes(trimmed)) return;
    onSave([...current, trimmed]);
    setNewLabel("");
  };

  const inactiveDefs = DEFAULT_TAGS.filter(d => !current.includes(d.label));

  return (
    <div className="pt-2 pb-1">
      {/* Активные метки */}
      {current.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {current.map((label, idx) => {
            const def = DEFAULT_TAGS.find(d => d.label === label);
            const color = def?.color || "#8b5cf6";
            return editMode && editingIdx === idx ? (
              <div key={label} className="flex items-center gap-1">
                <input
                  autoFocus
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={() => renameTag(label, editVal)}
                  onKeyDown={e => { if (e.key === "Enter") renameTag(label, editVal); if (e.key === "Escape") setEditingIdx(null); }}
                  className="rounded-lg px-2 py-0.5 text-xs focus:outline-none w-24"
                  style={{ background: t.surface, border: `1px solid ${color}60`, color: "#fff" }}
                />
              </div>
            ) : (
              <span key={label}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium"
                style={{ background: color + "25", color, border: `1px solid ${color}50` }}>
                {label}
                {editMode ? (
                  <>
                    <button onClick={() => { setEditingIdx(idx); setEditVal(label); }}
                      className="hover:text-white transition ml-0.5" title="Переименовать">
                      <Icon name="Pencil" size={9} />
                    </button>
                    <button onClick={() => deleteTag(label)}
                      className="hover:text-red-300 transition" title="Удалить">
                      <Icon name="X" size={9} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => deleteTag(label)}
                    className="hover:text-red-300 transition opacity-40 hover:opacity-100" title="Удалить">
                    <Icon name="X" size={9} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* В режиме редактирования — неактивные дефолтные + поле добавления */}
      {editMode && (
        <>
          {inactiveDefs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 pb-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
              <span className="w-full text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "#a3a3a3" }}>Добавить:</span>
              {inactiveDefs.map(tg => (
                <button key={tg.label} onClick={() => toggle(tg.label)}
                  className="px-2 py-0.5 rounded-lg text-xs font-medium transition border"
                  style={{ borderColor: tg.color + "40", background: t.surface, color: tg.color }}>
                  + {tg.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-1">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addNew()}
              placeholder="Новая метка..."
              className="flex-1 rounded-lg px-3 py-1 text-xs focus:outline-none"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
            <button onClick={addNew}
              className="px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs rounded-lg transition">+</button>
          </div>
        </>
      )}

      {/* Пусто и не в режиме редактирования — показываем дефолтные */}
      {current.length === 0 && !editMode && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {DEFAULT_TAGS.map(tg => (
            <button key={tg.label} onClick={() => toggle(tg.label)}
              className="px-2 py-0.5 rounded-lg text-xs font-medium transition border"
              style={{ borderColor: "transparent", background: t.surface, color: "#a3a3a3" }}>
              {tg.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}