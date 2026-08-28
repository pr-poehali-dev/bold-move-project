import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { uploadFile, crmFetch } from "./crmApi";
import { Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";

const isImage = (u: string) => /\.(jpg|jpeg|png|webp|gif|bmp|svg)/i.test(u);

interface FileEntry { id: number; url: string; name: string; }
interface FileCategory { label: string; files: FileEntry[]; }

const DEFAULT_LABELS = ["Смета", "Чертежи", "Договор", "Фото до", "Фото после"];

// Список меток категорий (не сами файлы — они теперь в базе данных) —
// хранится локально только чтобы помнить порядок и добавленные пользователем
// категории, даже если в них ещё нет ни одного файла.
const LABELS_KEY = (id: number) => `crm_files_labels_${id}`;

function loadLabels(clientId: number): string[] {
  try {
    const stored = localStorage.getItem(LABELS_KEY(clientId));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Донастройка для уже существующих карточек: если новая общая категория
        // "Чертежи" ещё не сохранена локально — подставляем её сразу после "Сметы",
        // не трогая остальные категории (в том числе добавленные пользователем).
        if (!parsed.includes("Чертежи")) {
          const idx = parsed.indexOf("Смета");
          const insertAt = idx >= 0 ? idx + 1 : 0;
          const next = [...parsed.slice(0, insertAt), "Чертежи", ...parsed.slice(insertAt)];
          saveLabels(clientId, next);
          return next;
        }
        return parsed;
      }
    }
  } catch { /* */ }
  return [...DEFAULT_LABELS];
}

function saveLabels(clientId: number, labels: string[]) {
  localStorage.setItem(LABELS_KEY(clientId), JSON.stringify(labels));
}

interface RemoteFile { id: number; url: string; name: string; type: string; category: string; }

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

  const [labels, setLabels] = useState<string[]>(() => loadLabels(clientId));
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<number | null>(null); // индекс категории
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ catIdx: number; fileIdx: number } | null>(null);
  const [newRowVal, setNewRowVal] = useState("");
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [labelVal, setLabelVal] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crmFetch("client_files", undefined, { client_id: String(clientId) });
      setRemoteFiles(Array.isArray(data) ? data as RemoteFile[] : []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  // Собираем категории из меток + реальных файлов из базы (сгруппированных по category)
  const cats: FileCategory[] = labels.map(label => ({
    label,
    files: remoteFiles.filter(f => f.category === label).map(f => ({ id: f.id, url: f.url, name: f.name })),
  }));

  const updateLabels = (next: string[]) => { setLabels(next); saveLabels(clientId, next); };

  // Добавить категорию
  const addCategory = () => {
    if (!newRowVal.trim()) return;
    updateLabels([...labels, newRowVal.trim()]);
    setNewRowVal("");
  };

  // Удалить категорию (файлы в ней остаются в базе, просто перестают отображаться тут;
  // это как и раньше — категория это лишь группировка)
  const deleteCategory = (i: number) => {
    if (!window.confirm("Точно удалить? Файлы внутри останутся в базе, но пропадут из этого списка.")) return;
    updateLabels(labels.filter((_, j) => j !== i));
  };

  // Переименовать категорию
  const renameCategory = (i: number, label: string) => {
    if (!label.trim()) return;
    updateLabels(labels.map((l, j) => j === i ? label.trim() : l));
  };

  // Загрузить файл в категорию.
  // Оптимистично добавляем файл в список СРАЗУ после успешного сохранения (по ответу
  // сервера с готовым id) — на мобильной сети список больше не «схлопывается» и файл
  // не исчезает на время перезагрузки. При сбое показываем понятную ошибку.
  const handleUpload = async (catIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setUploading(catIdx);
    setUploadError(null);
    const category = labels[catIdx];
    let anyFailed = false;
    // Конкретная причина от первого сбоя — «Файл 12 МБ, максимум 4 МБ» полезнее,
    // чем общее «не удалось загрузить» (особенно на телефоне, где непонятно почему).
    let firstError: string | null = null;
    for (const file of picked) {
      try {
        const url = await uploadFile(file);
        const saved = await crmFetch("client_files", {
          method: "POST",
          body: JSON.stringify({ client_id: clientId, url, name: file.name, type: file.type, category }),
        }) as Partial<RemoteFile> & { error?: string };
        if (!saved || saved.error || !saved.id) {
          anyFailed = true;
          if (!firstError) firstError = saved?.error || `«${file.name}»: сервер не сохранил файл`;
          continue;
        }
        // Оптимистично показываем файл сразу
        setRemoteFiles(prev => {
          if (prev.some(f => f.id === saved.id)) return prev;
          return [...prev, {
            id: saved.id as number, url: saved.url || url, name: saved.name || file.name,
            type: saved.type || file.type, category: saved.category || category,
          }];
        });
        logAction("Paperclip", "#06b6d4", `${category}: ${file.name}`);
      } catch (e) {
        anyFailed = true;
        if (!firstError) {
          firstError = e instanceof Error && e.message
            ? `«${file.name}»: ${e.message}`
            : `«${file.name}»: не удалось загрузить, проверьте соединение`;
        }
      }
    }
    if (anyFailed) {
      setUploadError(firstError || "Не удалось загрузить часть файлов. Проверьте соединение и попробуйте снова.");
    }
    setUploading(null);
    if (inputRefs.current[catIdx]) inputRefs.current[catIdx]!.value = "";
    // Тихо сверяемся с сервером в фоне (не блокирует показ уже добавленных файлов)
    load();
  };

  // Удалить файл из категории — оптимистично убираем из списка, при ошибке возвращаем.
  const deleteFile = async (fileId: number) => {
    if (!window.confirm("Точно удалить файл?")) return;
    const backup = remoteFiles;
    setRemoteFiles(prev => prev.filter(f => f.id !== fileId));
    try {
      const res = await crmFetch("client_files", { method: "DELETE", body: JSON.stringify({ id: fileId }) }) as { error?: string };
      if (res && res.error) throw new Error(res.error);
    } catch {
      setRemoteFiles(backup); // откат — файл не удалился
      setUploadError("Не удалось удалить файл. Проверьте соединение и попробуйте снова.");
    }
  };

  const [copied, setCopied] = useState<string | null>(null);

  // navigator.share работает только на мобильных — на ПК сразу копируем в буфер
  const isMobile = () => typeof window !== "undefined" && "ontouchstart" in window;

  const doShare = (text: string, title: string) => {
    if (navigator.share && isMobile()) {
      navigator.share({ title, text }).catch(e => {
        if (e instanceof Error && e.name === "AbortError") return;
        copyFallback(text, title);
      });
    } else {
      copyFallback(text, title);
    }
  };

  const copyFallback = (text: string, title: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(title);
        setTimeout(() => setCopied(null), 2500);
      }).catch(() => execCopy(text, title));
    } else {
      execCopy(text, title);
    }
  };

  const execCopy = (text: string, title: string) => {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    setCopied(title);
    setTimeout(() => setCopied(null), 2500);
  };

  // Поделиться файлами категории — все ссылки одним сообщением
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

      {/* Тост ошибки загрузки/удаления */}
      {uploadError && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-1 text-xs font-medium"
          style={{ background: "#ef444420", border: "1px solid #ef444440", color: "#fca5a5" }}>
          <Icon name="AlertTriangle" size={12} />
          <span className="flex-1">{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="p-0.5 rounded hover:bg-white/10">
            <Icon name="X" size={11} />
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: t.textMute }}>
          <Icon name="Loader2" size={12} className="animate-spin" /> Загрузка файлов...
        </div>
      )}

      {!loading && cats.map((cat, catIdx) => {
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
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid #7c3aed40", color: t.text }}
                />
              ) : (
                <span
                  className={`text-xs w-36 flex-shrink-0 ${editMode ? "cursor-pointer hover:opacity-70" : ""}`}
                  style={{ color: t.textSub }}
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
              {/* Без ограничения типов: перечень accept на iPhone делал фото в формате
                  HEIC (стандарт съёмки на новых айфонах) недоступными для выбора —
                  они были видны, но не нажимались. Проверка размера и сжатие
                  происходят при загрузке (см. uploadFile), поэтому фильтр здесь не нужен. */}
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
                      <div key={f.id} className="relative aspect-square">
                        <button onClick={() => setLightbox({ catIdx, fileIdx: fi })}
                          className="w-full h-full rounded-lg overflow-hidden hover:opacity-80 transition"
                          style={{ border: `1px solid ${t.border}` }}>
                          <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                        </button>
                        {/* Кнопка удаления видна всегда (на телефоне режима редактирования не видно) */}
                        <button onClick={(e) => { e.stopPropagation(); deleteFile(f.id); }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition shadow-md"
                          style={{ border: "1.5px solid #07070f" }}
                          title="Удалить файл">
                          <Icon name="X" size={11} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Документы */}
                {catDocs.map(f => (
                  <div key={f.id} className="flex items-center gap-2 py-1 group/doc">
                    <Icon name="FileText" size={11} style={{ color: "#06b6d4" }} className="flex-shrink-0" />
                    <span className="text-xs flex-1 truncate cursor-pointer hover:opacity-70"
                      style={{ color: t.textSub }}
                      onClick={() => window.open(f.url, "_blank")}>
                      {f.name}
                    </span>
                    {/* Кнопка удаления видна всегда */}
                    <button onClick={() => deleteFile(f.id)}
                      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition hover:bg-red-500/15"
                      style={{ color: "#ef4444" }}
                      title="Удалить файл">
                      <Icon name="Trash2" size={13} />
                    </button>
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