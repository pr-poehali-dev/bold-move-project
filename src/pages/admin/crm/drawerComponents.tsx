import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { uploadFile, DEFAULT_TAGS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

// ── InlineField ───────────────────────────────────────────────────────────────
export function InlineField({ label, value, onSave, type = "text", placeholder = "—", hideLabel }: {
  label: string;
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
  hideLabel?: boolean;
}) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const valRef = useRef("");       // всегда актуальное значение без stale closure
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const displayVal = () => {
    if (!value && value !== 0) return null;
    if (type === "datetime-local")
      return new Date(String(value)).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    if (type === "number") return Math.round(Number(value)).toLocaleString("ru-RU");
    return String(value);
  };

  const startEdit = () => {
    valRef.current = String(value ?? "");
    setEditing(true);
  };

  const commit = () => {
    const v = valRef.current;
    setEditing(false);
    onSaveRef.current(v);
  };

  return (
    <div className="flex items-center justify-between py-2 group" style={{ borderBottom: `1px solid ${t.border2}` }}>
      {!hideLabel && <span className="text-xs flex-shrink-0 w-36" style={{ color: "#d4d4d4" }}>{label}</span>}
      {editing ? (
        <input
          type={type}
          defaultValue={String(value ?? "")}
          autoFocus
          onChange={e => { valRef.current = e.target.value; }}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 rounded-lg px-2 py-1 text-sm text-right focus:outline-none"
          style={{ background: t.surface2, color: "#fff", border: "1px solid #7c3aed50" }}
        />
      ) : (
        <button onClick={startEdit}
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
export function Section({ icon, title, color = "#8b5cf6", children, onEdit, onDelete, onShare, hidden, onToggleHidden }: {
  icon: string; title: string; color?: string; children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
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
        <div className={`flex items-center gap-1 transition ${hidden ? "opacity-100" : "opacity-0 group-hover/section:opacity-100"}`}>
          {onShare && !hidden && (
            <button onClick={onShare} title="Поделиться всеми файлами"
              className="p-1 rounded-md transition hover:bg-white/10"
              style={{ color: "#a3a3a3" }}>
              <Icon name="Share2" size={12} />
            </button>
          )}
          {onToggleHidden && (
            <button onClick={onToggleHidden} title={hidden ? "Показать блок" : "Скрыть блок"}
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
          {onDelete && !hidden && (
            <button onClick={onDelete} title="Удалить блок"
              className="p-1 rounded-md transition hover:bg-red-500/15"
              style={{ color: "#a3a3a3" }}>
              <Icon name="Trash2" size={12} />
            </button>
          )}
        </div>
      </div>
      {!hidden && <div className="px-4 pb-1">{children}</div>}
    </div>
  );
}

const isImage = (u: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(u);

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
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const renameValRef = useRef("");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const imageItems = uploadedList.filter(f => isImage(f.url));

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

  const commitRename = (idx: number) => {
    const v = renameValRef.current.trim();
    if (v) setUploadedList(prev => prev.map((f, i) => i === idx ? { ...f, name: v } : f));
    setRenamingIdx(null);
  };

  const deleteFile = (idx: number) => {
    setUploadedList(prev => prev.filter((_, i) => i !== idx));
  };

  const openLightbox = (globalIdx: number) => {
    const imgIndex = imageItems.findIndex(img => img.url === uploadedList[globalIdx].url);
    if (imgIndex !== -1) setLightboxIdx(imgIndex);
  };

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowRight") setLightboxIdx(i => i !== null ? Math.min(i + 1, imageItems.length - 1) : null);
      if (e.key === "ArrowLeft") setLightboxIdx(i => i !== null ? Math.max(i - 1, 0) : null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, imageItems.length]);

  return (
    <div className="py-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs w-36 flex-shrink-0" style={{ color: "#d4d4d4" }}>{label}</span>
        <button onClick={() => ref.current?.click()}
          className="text-xs text-violet-400/70 underline decoration-dashed hover:text-violet-300 transition flex items-center gap-1">
          {uploading
            ? <><Icon name="Loader2" size={11} className="animate-spin" /> Загрузка...</>
            : <><Icon name="Upload" size={11} /> Загрузить</>}
        </button>
        <input ref={ref} type="file" accept={accept} multiple className="hidden" onChange={handleFiles} />
      </div>
      {uploadedList.length > 0 && (
        <div className="flex flex-col gap-1 mt-1 pl-36">
          {uploadedList.map((f, i) => (
            <div key={i} className="flex items-center gap-1 group/file">
              {isImage(f.url) ? (
                <button onClick={() => openLightbox(i)} className="flex-shrink-0" title={f.name}>
                  <img src={f.url} alt={f.name} className="w-14 h-10 object-cover rounded-md hover:opacity-80 transition"
                    style={{ border: `1px solid ${t.border}` }} />
                </button>
              ) : (
                <button onClick={() => window.open(f.url, "_blank")}
                  className="flex items-center gap-1 text-xs text-violet-400 underline hover:text-violet-300 transition max-w-[120px] truncate">
                  <Icon name="FileText" size={11} className="flex-shrink-0" />
                  {renamingIdx !== i && <span className="truncate">{f.name}</span>}
                </button>
              )}
              {renamingIdx === i ? (
                <input
                  autoFocus
                  defaultValue={f.name}
                  onChange={e => { renameValRef.current = e.target.value; }}
                  onBlur={() => commitRename(i)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); commitRename(i); }
                    if (e.key === "Escape") setRenamingIdx(null);
                  }}
                  className="text-xs rounded px-1.5 py-0.5 focus:outline-none"
                  style={{ background: t.surface2, color: "#fff", border: `1px solid #7c3aed50`, width: 110 }}
                />
              ) : (
                <>
                  {isImage(f.url) && (
                    <span className="text-xs truncate max-w-[80px] opacity-0 group-hover/file:opacity-100 transition"
                      style={{ color: t.textMute }}>{f.name}</span>
                  )}
                  <button
                    onClick={() => { renameValRef.current = f.name; setRenamingIdx(i); }}
                    className="opacity-0 group-hover/file:opacity-100 transition p-0.5 rounded hover:text-violet-300"
                    style={{ color: t.textMute }}
                    title="Переименовать"
                  >
                    <Icon name="Pencil" size={10} />
                  </button>
                </>
              )}
              <button
                onClick={() => deleteFile(i)}
                className="opacity-0 group-hover/file:opacity-100 transition p-0.5 rounded hover:text-red-400"
                style={{ color: t.textMute }}
                title="Удалить"
              >
                <Icon name="X" size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxIdx !== null && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.88)" }}
          onClick={() => setLightboxIdx(null)}
        >
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition"
            style={{ color: "#fff" }}
          >
            <Icon name="X" size={20} />
          </button>
          {lightboxIdx > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i - 1 : null); }}
              className="absolute left-4 p-2 rounded-full hover:bg-white/10 transition"
              style={{ color: "#fff" }}
            >
              <Icon name="ChevronLeft" size={28} />
            </button>
          )}
          {lightboxIdx < imageItems.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i + 1 : null); }}
              className="absolute right-4 p-2 rounded-full hover:bg-white/10 transition"
              style={{ color: "#fff" }}
            >
              <Icon name="ChevronRight" size={28} />
            </button>
          )}
          <img
            src={imageItems[lightboxIdx].url}
            alt={imageItems[lightboxIdx].name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 10, objectFit: "contain" }}
          />
        </div>,
        document.body
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
                  onKeyDown={e => {
                    if (e.key === "Enter") renameTag(label, editVal);
                    if (e.key === "Escape") setEditingIdx(null);
                  }}
                  className="rounded-lg px-2 py-0.5 text-xs focus:outline-none w-28"
                  style={{ background: t.surface, border: `1px solid ${color}80`, color: "#fff" }}
                />
              </div>
            ) : (
              <span key={label}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
                style={{ background: color + "30", color: "#fff", border: `1px solid ${color}60` }}>
                {label}
                {editMode ? (
                  <>
                    <button onClick={() => { setEditingIdx(idx); setEditVal(label); }}
                      className="opacity-60 hover:opacity-100 transition ml-0.5" title="Переименовать">
                      <Icon name="Pencil" size={9} />
                    </button>
                    <button onClick={() => deleteTag(label)}
                      className="opacity-60 hover:text-red-300 hover:opacity-100 transition" title="Удалить">
                      <Icon name="X" size={9} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => deleteTag(label)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-300 transition" title="Удалить">
                    <Icon name="X" size={9} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* В режиме редактирования — дефолтные неактивные + поле добавления */}
      {editMode && (
        <>
          {inactiveDefs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 pb-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
              <span className="w-full text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "#a3a3a3" }}>
                Добавить стандартную:
              </span>
              {inactiveDefs.map(tg => (
                <button key={tg.label} onClick={() => toggle(tg.label)}
                  className="px-2 py-0.5 rounded-lg text-xs font-semibold transition border"
                  style={{ borderColor: tg.color + "50", background: tg.color + "15", color: "#fff" }}>
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
              className="px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs rounded-lg transition">
              +
            </button>
          </div>
        </>
      )}

      {/* Пусто и не в режиме редактирования — показываем дефолтные как подсказки */}
      {current.length === 0 && !editMode && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {DEFAULT_TAGS.map(tg => (
            <button key={tg.label} onClick={() => toggle(tg.label)}
              className="px-2 py-0.5 rounded-lg text-xs font-medium transition border"
              style={{ borderColor: tg.color + "40", background: t.surface, color: "#a3a3a3" }}>
              {tg.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}