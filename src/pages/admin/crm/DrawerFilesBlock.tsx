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
}

export function DrawerFilesBlock({ clientId, hiddenBlocks, toggleHidden, logAction }: Props) {
  const t = useTheme();
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxId, setLightboxId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const renameRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isHidden = hiddenBlocks.has("files");

  // Загружаем файлы из БД при открытии
  useEffect(() => {
    crmFetch("client_files", undefined, { client_id: String(clientId) })
      .then(d => { if (Array.isArray(d)) setFiles(d as ClientFile[]); })
      .catch(() => {});
  }, [clientId]);

  const imageFiles = files.filter(f => isImage(f.url));
  const lightboxFile = lightboxId != null ? files.find(f => f.id === lightboxId) ?? null : null;
  const lightboxIdx = lightboxFile ? imageFiles.findIndex(f => f.id === lightboxFile.id) : -1;

  // Клавиатура в лайтбоксе
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
    await crmFetch("client_files", {
      method: "DELETE",
      body: JSON.stringify({ id: file.id, client_id: clientId }),
    });
    setFiles(prev => prev.filter(f => f.id !== file.id));
    if (lightboxId === file.id) setLightboxId(null);
    logAction("Trash2", "#ef4444", `Файл удалён: ${file.name}`);
  };

  const handleRename = async (file: ClientFile) => {
    const name = renameRef.current.trim();
    if (!name || name === file.name) { setRenamingId(null); return; }
    await crmFetch("client_files", {
      method: "PUT",
      body: JSON.stringify({ id: file.id, client_id: clientId, name }),
    });
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, name } : f));
    setRenamingId(null);
    logAction("Pencil", "#06b6d4", `Переименован: ${name}`);
  };

  const handleShare = (file: ClientFile) => {
    navigator.clipboard.writeText(file.url).then(() => alert("Ссылка скопирована!"));
  };

  return (
    <Section icon="Paperclip" title="Файлы" color="#06b6d4"
      hidden={isHidden}
      onToggleHidden={() => toggleHidden("files")}>

      {/* Кнопка загрузки */}
      <div className="flex items-center justify-between py-2">
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
        <div className="pb-3">
          {/* Картинки — сетка 5 в ряд */}
          {imageFiles.length > 0 && (
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {imageFiles.map(f => (
                <button key={f.id} onClick={() => setLightboxId(f.id)}
                  className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition"
                  style={{ border: `1px solid ${t.border}` }}>
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Документы — список */}
          {files.filter(f => !isImage(f.url)).map(f => (
            <div key={f.id} className="flex items-center gap-2 py-1.5 group/doc"
              style={{ borderTop: `1px solid ${t.border2}22` }}>
              <Icon name="FileText" size={13} style={{ color: "#06b6d4" }} className="flex-shrink-0" />
              <span className="text-xs flex-1 truncate" style={{ color: t.textSub }}>{f.name}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover/doc:opacity-100 transition">
                <button onClick={() => window.open(f.url, "_blank")} title="Открыть"
                  className="p-1 rounded hover:bg-white/10" style={{ color: t.textMute }}>
                  <Icon name="ExternalLink" size={11} />
                </button>
                <button onClick={() => handleShare(f)} title="Поделиться"
                  className="p-1 rounded hover:bg-white/10" style={{ color: t.textMute }}>
                  <Icon name="Link" size={11} />
                </button>
                <button onClick={() => { renameRef.current = f.name; setRenamingId(f.id); }} title="Переименовать"
                  className="p-1 rounded hover:bg-white/10" style={{ color: t.textMute }}>
                  <Icon name="Pencil" size={11} />
                </button>
                <button onClick={() => handleDelete(f)} title="Удалить"
                  className="p-1 rounded hover:text-red-400" style={{ color: t.textMute }}>
                  <Icon name="Trash2" size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка переименования */}
      {renamingId != null && (() => {
        const file = files.find(f => f.id === renamingId);
        if (!file) return null;
        return createPortal(
          <div className="fixed inset-0 z-[9998] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setRenamingId(null)}>
            <div className="rounded-2xl p-5 w-72" style={{ background: t.surface, border: `1px solid ${t.border}` }}
              onClick={e => e.stopPropagation()}>
              <div className="text-sm font-semibold mb-3" style={{ color: t.text }}>Переименовать файл</div>
              <input
                autoFocus
                defaultValue={file.name}
                onChange={e => { renameRef.current = e.target.value; }}
                onKeyDown={e => {
                  if (e.key === "Enter") handleRename(file);
                  if (e.key === "Escape") setRenamingId(null);
                }}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none mb-3"
                style={{ background: t.surface2, border: `1px solid #7c3aed50`, color: "#fff" }}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setRenamingId(null)}
                  className="px-3 py-1.5 text-xs rounded-lg" style={{ color: t.textMute }}>
                  Отмена
                </button>
                <button onClick={() => handleRename(file)}
                  className="px-3 py-1.5 text-xs rounded-lg font-semibold"
                  style={{ background: "#7c3aed", color: "#fff" }}>
                  Сохранить
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Лайтбокс */}
      {lightboxFile && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightboxId(null)}>

          {/* Навигация */}
          {lightboxIdx > 0 && (
            <button onClick={e => { e.stopPropagation(); setLightboxId(imageFiles[lightboxIdx - 1].id); }}
              className="absolute left-4 p-2 rounded-full hover:bg-white/10 transition" style={{ color: "#fff" }}>
              <Icon name="ChevronLeft" size={28} />
            </button>
          )}
          {lightboxIdx < imageFiles.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setLightboxId(imageFiles[lightboxIdx + 1].id); }}
              className="absolute right-4 p-2 rounded-full hover:bg-white/10 transition" style={{ color: "#fff" }}>
              <Icon name="ChevronRight" size={28} />
            </button>
          )}

          {/* Картинка */}
          <img src={lightboxFile.url} alt={lightboxFile.name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "82vw", maxHeight: "78vh", borderRadius: 12, objectFit: "contain" }} />

          {/* Панель действий снизу */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-2xl px-5 py-3"
            style={{ background: "rgba(18,18,24,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}>

            <span className="text-sm text-white/70 truncate max-w-[200px]">{lightboxFile.name}</span>

            <div className="w-px h-4 bg-white/20 mx-1" />

            <button onClick={() => handleShare(lightboxFile)} title="Скопировать ссылку"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/10 transition" style={{ color: "#a78bfa" }}>
              <Icon name="Link" size={13} /> Поделиться
            </button>

            <button onClick={() => { setLightboxId(null); renameRef.current = lightboxFile.name; setRenamingId(lightboxFile.id); }}
              title="Переименовать"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/10 transition" style={{ color: "#d4d4d4" }}>
              <Icon name="Pencil" size={13} /> Переименовать
            </button>

            <button onClick={() => handleDelete(lightboxFile)} title="Удалить"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-500/20 transition" style={{ color: "#f87171" }}>
              <Icon name="Trash2" size={13} /> Удалить
            </button>
          </div>

          {/* Закрыть */}
          <button onClick={() => setLightboxId(null)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition" style={{ color: "#fff" }}>
            <Icon name="X" size={20} />
          </button>
        </div>,
        document.body
      )}
    </Section>
  );
}
