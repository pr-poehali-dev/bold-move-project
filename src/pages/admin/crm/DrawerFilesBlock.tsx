import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { uploadFile } from "./crmApi";
import { Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";

const isImage = (u: string) => /\.(jpg|jpeg|png|webp|gif|bmp|svg)/i.test(u);

interface FileEntry { url: string; name: string; }
interface FileCategory { label: string; files: FileEntry[]; }

const DEFAULT_CATEGORIES: FileCategory[] = [
  { label: "Смета",     files: [] },
  { label: "Договор",   files: [] },
  { label: "Фото до",   files: [] },
  { label: "Фото после",files: [] },
];

const LS_KEY = (id: number) => `crm_files_v2_${id}`;

function loadCategories(clientId: number): FileCategory[] {
  try {
    const stored = localStorage.getItem(LS_KEY(clientId));
    if (stored) return JSON.parse(stored);
  } catch { /* */ }
  return DEFAULT_CATEGORIES.map(c => ({ ...c, files: [] }));
}

function saveCategories(clientId: number, cats: FileCategory[]) {
  localStorage.setItem(LS_KEY(clientId), JSON.stringify(cats));
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
  const isHidden = hiddenBlocks.has("files");
  const editMode = editingBlock === "files";

  const [cats, setCats] = useState<FileCategory[]>(() => loadCategories(clientId));
  const [uploading, setUploading] = useState<number | null>(null); // индекс категории
  const [lightbox, setLightbox] = useState<{ catIdx: number; fileIdx: number } | null>(null);
  const [newRowVal, setNewRowVal] = useState("");
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [labelVal, setLabelVal] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (next: FileCategory[]) => { setCats(next); saveCategories(clientId, next); };

  // Добавить категорию
  const addCategory = () => {
    if (!newRowVal.trim()) return;
    update([...cats, { label: newRowVal.trim(), files: [] }]);
    setNewRowVal("");
  };

  // Удалить категорию
  const deleteCategory = (i: number) => {
    if (!window.confirm("Точно удалить?")) return;
    update(cats.filter((_, j) => j !== i));
  };

  // Переименовать категорию
  const renameCategory = (i: number, label: string) => {
    if (!label.trim()) return;
    update(cats.map((c, j) => j === i ? { ...c, label: label.trim() } : c));
  };

  // Загрузить файл в категорию
  const handleUpload = async (catIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setUploading(catIdx);
    const uploaded: FileEntry[] = [];
    for (const file of picked) {
      const url = await uploadFile(file);
      uploaded.push({ url, name: file.name });
      logAction("Paperclip", "#06b6d4", `${cats[catIdx].label}: ${file.name}`);
    }
    setCats(prev => {
      const next = prev.map((c, j) => j === catIdx ? { ...c, files: [...c.files, ...uploaded] } : c);
      saveCategories(clientId, next);
      return next;
    });
    setUploading(null);
    if (inputRefs.current[catIdx]) inputRefs.current[catIdx]!.value = "";
  };

  // Удалить файл из категории
  const deleteFile = (catIdx: number, fileIdx: number) => {
    if (!window.confirm("Точно удалить файл?")) return;
    const updated = cats.map((c, j) => j === catIdx
      ? { ...c, files: c.files.filter((_, k) => k !== fileIdx) }
      : c
    );
    update(updated);
  };

  const [copied, setCopied] = useState<string | null>(null);

  const doShare = async (text: string, title: string) => {
    // navigator.share — штатный системный шаринг (Android/iOS)
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (e) {
        // Пользователь отменил — не показываем fallback
        if (e instanceof Error && e.name === "AbortError") return;
        // Другая ошибка (iframe, desktop без поддержки) — падаем на буфер
      }
    }
    // Fallback — копирование в буфер
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(title);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareFiles = (files: FileEntry[], title: string) => {
    doShare(files.map(f => f.url).join("\n"), title);
  };

  const shareAllFiles = () => {
    const all = cats.flatMap(c => c.files);
    if (!all.length) return;
    const text = cats
      .filter(c => c.files.length > 0)
      .map(c => `${c.label}:\n${c.files.map(f => f.url).join("\n")}`)
      .join("\n\n");
    doShare(text, "Все файлы");
  };

  // Lightbox
  const lightboxCat = lightbox ? cats[lightbox.catIdx] : null;
  const lightboxImages = lightboxCat ? lightboxCat.files.filter(f => isImage(f.url)) : [];
  const lightboxFile = lightbox ? lightboxImages[lightbox.fileIdx] ?? null : null;

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox(p => p && p.fileIdx < lightboxImages.length - 1 ? { ...p, fileIdx: p.fileIdx + 1 } : p);
      if (e.key === "ArrowLeft") setLightbox(p => p && p.fileIdx > 0 ? { ...p, fileIdx: p.fileIdx - 1 } : p);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, lightboxImages.length]);

  return (
    <Section icon="Paperclip" title="Файлы" color="#06b6d4" hidden={isHidden}
      onToggleHidden={() => toggleHidden("files")}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : "files") : undefined}
      onShare={cats.some(c => c.files.length > 0) ? shareAllFiles : undefined}>

      {/* Тост "скопировано" */}
      {copied && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-1 text-xs font-medium"
          style={{ background: "#06b6d420", border: "1px solid #06b6d440", color: "#67e8f9" }}>
          <Icon name="Check" size={12} />
          Ссылки «{copied}» скопированы в буфер
        </div>
      )}

      {cats.map((cat, catIdx) => {
        const catImages = cat.files.filter(f => isImage(f.url));
        const catDocs   = cat.files.filter(f => !isImage(f.url));

        return (
          <div key={catIdx} className="py-1" style={{ borderBottom: `1px solid ${t.border2}` }}>
            {/* Строка категории */}
            <div className="flex items-center gap-2 py-1.5">
              {/* Label — редактируемый в editMode */}
              {editMode && editingLabel === catIdx ? (
                <input autoFocus value={labelVal}
                  onChange={e => setLabelVal(e.target.value)}
                  onBlur={() => { renameCategory(catIdx, labelVal); setEditingLabel(null); }}
                  onKeyDown={e => { if (e.key === "Enter") { renameCategory(catIdx, labelVal); setEditingLabel(null); } }}
                  className="text-xs rounded-lg px-2 py-0.5 focus:outline-none w-36 flex-shrink-0"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid #7c3aed40", color: "#fff" }}
                />
              ) : (
                <span
                  className={`text-xs w-36 flex-shrink-0 ${editMode ? "cursor-pointer hover:opacity-70" : ""}`}
                  style={{ color: "#d4d4d4" }}
                  onClick={() => { if (editMode) { setEditingLabel(catIdx); setLabelVal(cat.label); } }}>
                  {cat.label}
                </span>
              )}

              {/* Счётчик + поделиться категорией + загрузка */}
              <div className="flex-1 flex items-center justify-end gap-2">
                {cat.files.length > 0 && (
                  <span className="text-xs" style={{ color: t.textMute }}>{cat.files.length} файл(ов)</span>
                )}
                {cat.files.length > 0 && (
                  <button onClick={() => shareFiles(cat.files, cat.label)}
                    className="p-1 rounded-md transition hover:bg-white/10" title={`Поделиться «${cat.label}»`}
                    style={{ color: "#a3a3a3" }}>
                    <Icon name="Share2" size={11} />
                  </button>
                )}
                <button onClick={() => inputRefs.current[catIdx]?.click()}
                  className="text-xs flex items-center gap-1 transition hover:opacity-80"
                  style={{ color: uploading === catIdx ? t.textMute : undefined }}>
                  {uploading === catIdx
                    ? <><Icon name="Loader2" size={10} className="animate-spin" style={{ color: t.textMute }} />Загрузка...</>
                    : <span className="underline underline-offset-2 decoration-dashed" style={{ color: "#a78bfa99" }}>
                        {cat.files.length > 0 ? "Добавить ещё" : "Загрузить"}
                      </span>}
                </button>
              </div>
              <input
                ref={el => { inputRefs.current[catIdx] = el; }}
                type="file" multiple className="hidden"
                onChange={e => handleUpload(catIdx, e)}
              />

              {/* X — удалить категорию */}
              {editMode && (
                <button onClick={() => deleteCategory(catIdx)}
                  className="flex-shrink-0 p-1 rounded-md text-red-400/50 hover:text-red-400 transition-all">
                  <Icon name="X" size={11} />
                </button>
              )}
            </div>

            {/* Файлы категории */}
            {cat.files.length > 0 && (
              <div className="pl-2 pb-1.5">
                {/* Картинки */}
                {catImages.length > 0 && (
                  <div className="grid grid-cols-5 gap-1 mb-1.5">
                    {catImages.map((f, fi) => (
                      <div key={fi} className="relative aspect-square">
                        <button onClick={() => setLightbox({ catIdx, fileIdx: fi })}
                          className="w-full h-full rounded-lg overflow-hidden hover:opacity-80 transition"
                          style={{ border: `1px solid ${t.border}` }}>
                          <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                        </button>
                        {/* Share фото */}
                        <button onClick={() => shareFiles([f], f.name)}
                          className="absolute bottom-0 left-0 w-5 h-5 rounded-tr-lg bg-black/50 flex items-center justify-center hover:bg-black/70 transition"
                          title="Поделиться">
                          <Icon name="Share2" size={9} className="text-white" />
                        </button>
                        {editMode && (
                          <button onClick={() => deleteFile(catIdx, cat.files.indexOf(f))}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition">
                            <Icon name="X" size={8} className="text-white" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Документы */}
                {catDocs.map((f, fi) => (
                  <div key={fi} className="flex items-center gap-2 py-1 group/doc">
                    <Icon name="FileText" size={11} style={{ color: "#06b6d4" }} className="flex-shrink-0" />
                    <span className="text-xs flex-1 truncate cursor-pointer hover:opacity-70"
                      style={{ color: t.textSub }}
                      onClick={() => window.open(f.url, "_blank")}>
                      {f.name}
                    </span>
                    <button onClick={() => shareFiles([f], f.name)}
                      className="p-0.5 rounded hover:bg-white/10 flex-shrink-0 opacity-0 group-hover/doc:opacity-100 transition"
                      title="Поделиться" style={{ color: "#a3a3a3" }}>
                      <Icon name="Share2" size={10} />
                    </button>
                    {editMode && (
                      <button onClick={() => deleteFile(catIdx, cat.files.indexOf(f))}
                        className="p-0.5 rounded hover:text-red-400 flex-shrink-0" style={{ color: "#ef4444" }}>
                        <Icon name="X" size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Добавить категорию в режиме редактирования */}
      {editMode && (
        <div className="flex items-center gap-1.5 mt-2 mb-1">
          <input value={newRowVal} onChange={e => setNewRowVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addCategory(); }}
            placeholder="Новая категория..."
            className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid #06b6d440", color: "#fff" }}
          />
          <button onClick={addCategory}
            className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
            style={{ background: "#06b6d420", color: "#06b6d4" }}>
            OK
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxFile && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10" style={{ color: "#fff" }}
            onClick={() => setLightbox(null)}>
            <Icon name="X" size={20} />
          </button>
          {lightbox && lightbox.fileIdx > 0 && (
            <button className="absolute left-4 p-3 rounded-full hover:bg-white/10" style={{ color: "#fff" }}
              onClick={e => { e.stopPropagation(); setLightbox(p => p ? { ...p, fileIdx: p.fileIdx - 1 } : p); }}>
              <Icon name="ChevronLeft" size={28} />
            </button>
          )}
          <img src={lightboxFile.url} alt={lightboxFile.name}
            className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain"
            onClick={e => e.stopPropagation()} />
          {lightbox && lightbox.fileIdx < lightboxImages.length - 1 && (
            <button className="absolute right-4 p-3 rounded-full hover:bg-white/10" style={{ color: "#fff" }}
              onClick={e => { e.stopPropagation(); setLightbox(p => p ? { ...p, fileIdx: p.fileIdx + 1 } : p); }}>
              <Icon name="ChevronRight" size={28} />
            </button>
          )}
          <div className="absolute bottom-4 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {lightboxFile.name}
          </div>
        </div>,
        document.body
      )}
    </Section>
  );
}