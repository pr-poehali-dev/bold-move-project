import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { crmFetch, uploadFile } from "./crmApi";
import { Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";

const isImage = (u: string) => /\.(jpg|jpeg|png|webp|gif|bmp|svg)/i.test(u);

interface ClientFile {
  id: number;
  url: string;
  name: string;
  type: string;
}

interface Props {
  clientId: number;
  hiddenBlocks: Set<BlockId>;
  toggleHidden: (id: BlockId) => void;
  logAction: (icon: string, color: string, text: string) => void;
  editingBlock: BlockId | null;
  setEditingBlock: (id: BlockId | null) => void;
}

export function DrawerFilesBlock({ clientId, hiddenBlocks, toggleHidden, logAction, editingBlock, setEditingBlock }: Props) {
  const t = useTheme();
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxId, setLightboxId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const renameRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isHidden = hiddenBlocks.has("files");
  const editMode = editingBlock === "files";

  useEffect(() => {
    crmFetch("client_files", undefined, { client_id: String(clientId) })
      .then(d => { if (Array.isArray(d)) setFiles(d as ClientFile[]); })
      .catch(() => {});
  }, [clientId]);

  const imageFiles = files.filter(f => isImage(f.url));
  const lightboxFile = lightboxId != null ? files.find(f => f.id === lightboxId) ?? null : null;
  const lightboxIdx = lightboxFile ? imageFiles.findIndex(f => f.id === lightboxFile.id) : -1;

  useEffect(() => {
    if (lightboxId === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxId(null);
      if (e.key === "ArrowRight" && lightboxIdx < imageFiles.length - 1) setLightboxId(imageFiles[lightboxIdx + 1].id);
      if (e.key === "ArrowLeft" && lightboxIdx > 0) setLightboxId(imageFiles[lightboxIdx - 1].id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxId, lightboxIdx, imageFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setUploading(true);
    for (const file of picked) {
      const url = await uploadFile(file);
      const ftype = isImage(url) ? "image" : "doc";
      const saved = await crmFetch("client_files", {
        method: "POST",
        body: JSON.stringify({ client_id: clientId, url, name: file.name, type: ftype }),
      }) as ClientFile;
      setFiles(prev => [...prev, saved]);
      logAction("Paperclip", "#06b6d4", `Файл: ${file.name}`);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDelete = async (file: ClientFile) => {
    if (!window.confirm(`Удалить «${file.name}»?`)) return;
    await crmFetch("client_files", { method: "DELETE", body: JSON.stringify({ id: file.id, client_id: clientId }) });
    setFiles(prev => prev.filter(f => f.id !== file.id));
    if (lightboxId === file.id) setLightboxId(null);
    logAction("Trash2", "#ef4444", `Файл удалён: ${file.name}`);
  };

  const handleRename = async (file: ClientFile) => {
    const name = renameRef.current.trim();
    if (!name || name === file.name) { setRenamingId(null); return; }
    await crmFetch("client_files", { method: "PUT", body: JSON.stringify({ id: file.id, client_id: clientId, name }) });
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, name } : f));
    setRenamingId(null);
    logAction("Pencil", "#06b6d4", `Переименован: ${name}`);
  };

  return (
    <Section icon="Paperclip" title="Файлы" color="#06b6d4" hidden={isHidden}
      onToggleHidden={() => toggleHidden("files")}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : "files") : undefined}>

      {/* Шапка: счётчик + кнопка загрузки */}
      <div className="flex items-center justify-between py-2" style={{ borderBottom: files.length > 0 ? `1px solid ${t.border2}` : "none" }}>
        <span className="text-xs" style={{ color: t.textMute }}>{files.length} файлов</span>
        <button onClick={() => inputRef.current?.click()}
          className="text-xs text-violet-400/70 underline decoration-dashed hover:text-violet-300 transition flex items-center gap-1">
          {uploading
            ? <><Icon name="Loader2" size={11} className="animate-spin" />Загрузка...</>
            : <><Icon name="Upload" size={11} />Загрузить</>}
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={handleUpload} />
      </div>

      {files.length > 0 && (
        <div className="pb-2">
          {/* Картинки — сетка */}
          {imageFiles.length > 0 && (
            <div className="grid grid-cols-5 gap-1.5 my-2">
              {imageFiles.map(f => (
                <div key={f.id} className="relative aspect-square">
                  <button onClick={() => !editMode && setLightboxId(f.id)}
                    className="w-full h-full rounded-lg overflow-hidden hover:opacity-80 transition"
                    style={{ border: `1px solid ${t.border}` }}>
                    <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                  </button>
                  {editMode && (
                    <button onClick={() => handleDelete(f)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition"
                      title="Удалить">
                      <Icon name="X" size={9} className="text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Документы — список */}
          {files.filter(f => !isImage(f.url)).map(f => (
            <div key={f.id} className="flex items-center gap-2 py-1.5"
              style={{ borderTop: `1px solid ${t.border2}22` }}>
              <Icon name="FileText" size={13} style={{ color: "#06b6d4" }} className="flex-shrink-0" />
              {renamingId === f.id ? (
                <input
                  autoFocus
                  defaultValue={f.name}
                  onChange={e => { renameRef.current = e.target.value; }}
                  onBlur={() => handleRename(f)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(f); if (e.key === "Escape") setRenamingId(null); }}
                  className="flex-1 text-xs rounded-lg px-2 py-0.5 focus:outline-none"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid #7c3aed40", color: "#fff" }}
                />
              ) : (
                <span className="text-xs flex-1 truncate cursor-pointer hover:opacity-70"
                  style={{ color: t.textSub }}
                  onClick={() => window.open(f.url, "_blank")}>
                  {f.name}
                </span>
              )}
              {editMode ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { renameRef.current = f.name; setRenamingId(f.id); }} title="Переименовать"
                    className="p-1 rounded hover:bg-white/10" style={{ color: t.textMute }}>
                    <Icon name="Pencil" size={11} />
                  </button>
                  <button onClick={() => handleDelete(f)} title="Удалить"
                    className="p-1 rounded hover:text-red-400" style={{ color: "#ef4444" }}>
                    <Icon name="X" size={11} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/doc:opacity-100 transition">
                  <button onClick={() => window.open(f.url, "_blank")} title="Открыть"
                    className="p-1 rounded hover:bg-white/10" style={{ color: t.textMute }}>
                    <Icon name="ExternalLink" size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxFile && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightboxId(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition" style={{ color: "#fff" }}
            onClick={() => setLightboxId(null)}>
            <Icon name="X" size={20} />
          </button>
          {lightboxIdx > 0 && (
            <button className="absolute left-4 p-3 rounded-full hover:bg-white/10 transition" style={{ color: "#fff" }}
              onClick={e => { e.stopPropagation(); setLightboxId(imageFiles[lightboxIdx - 1].id); }}>
              <Icon name="ChevronLeft" size={28} />
            </button>
          )}
          <img src={lightboxFile.url} alt={lightboxFile.name}
            className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain"
            onClick={e => e.stopPropagation()} />
          {lightboxIdx < imageFiles.length - 1 && (
            <button className="absolute right-4 p-3 rounded-full hover:bg-white/10 transition" style={{ color: "#fff" }}
              onClick={e => { e.stopPropagation(); setLightboxId(imageFiles[lightboxIdx + 1].id); }}>
              <Icon name="ChevronRight" size={28} />
            </button>
          )}
          <div className="absolute bottom-4 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {lightboxIdx + 1} / {imageFiles.length} — {lightboxFile.name}
          </div>
        </div>,
        document.body
      )}
    </Section>
  );
}
