// Фото проекта в конструкторе плана — по образцу CRM (DrawerFilesBlock.tsx):
// горизонтальная лента + кнопка "Сделать фото" слева + полноэкранный слайдер по клику.
// Фото сохраняются в базу данных с привязкой к project_id, и если у проекта есть
// crm_chat_id (привязка к карточке CRM) — backend сам добавит их и в категорию
// "Фото до" в CRM (см. backend/crm-manager resource=client_files).
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];

interface RemoteFile { id: number; url: string; name: string; type: string; category: string; }

interface Props {
  projectId: number;
  token?: string | null;
}

function headers(token?: string | null) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function uploadFile(file: File, token?: string | null): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let b64 = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  b64 = btoa(b64);
  const res = await fetch(`${CRM_URL}?r=upload`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ data: b64, filename: file.name, content_type: file.type }),
  });
  const data = await res.json();
  return data.url as string;
}

export default function PlanRoomPhotos({ projectId, token }: Props) {
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Счётчик запросов — если пока летел старый load() (например, браузер был
  // в фоне при открытии камеры) успел выполниться более новый load(), старый
  // ответ, пришедший позже, игнорируется, чтобы не затирать актуальный список
  // устаревшими данными (баг: "фото появляется и сразу пропадает").
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await fetch(`${CRM_URL}?r=client_files&project_id=${projectId}`, { headers: headers(token) });
      const data = await res.json();
      if (reqId !== requestIdRef.current) return; // пришёл устаревший ответ — игнорируем
      setFiles(Array.isArray(data) ? data : []);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => { load(); }, [load]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setUploading(true);
    for (const file of picked) {
      const url = await uploadFile(file, token);
      await fetch(`${CRM_URL}?r=client_files`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ project_id: projectId, url, name: file.name, type: file.type, category: "Фото до" }),
      });
    }
    await load();
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const deleteFile = async (fileId: number) => {
    await fetch(`${CRM_URL}?r=client_files`, {
      method: "DELETE",
      headers: headers(token),
      body: JSON.stringify({ id: fileId }),
    });
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setLightboxIdx(null);
  };

  const lightboxFile = lightboxIdx != null ? files[lightboxIdx] : null;

  useEffect(() => {
    if (lightboxIdx == null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowRight") setLightboxIdx(p => p != null && p < files.length - 1 ? p + 1 : p);
      if (e.key === "ArrowLeft") setLightboxIdx(p => p != null && p > 0 ? p - 1 : p);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, files.length]);

  return (
    <div className="w-full">
      <input ref={inputRef} type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={handleFiles} />

      <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 px-0.5" style={{ scrollbarWidth: "none" }}>
        {/* Кнопка сделать фото */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 transition disabled:opacity-50"
          style={{ background: "rgba(124,58,237,0.12)", border: "1.5px dashed rgba(124,58,237,0.4)" }}
        >
          {uploading
            ? <Icon name="Loader2" size={18} className="animate-spin" style={{ color: "#a78bfa" }} />
            : <Icon name="Camera" size={18} style={{ color: "#a78bfa" }} />}
          <span className="text-[9px] font-semibold" style={{ color: "#a78bfa" }}>Фото</span>
        </button>

        {loading && (
          <div className="flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
            <Icon name="Loader2" size={16} className="animate-spin text-white/30" />
          </div>
        )}

        {/* Лента фото */}
        {!loading && files.map((f, i) => (
          <div key={f.id} className="relative flex-shrink-0 w-16 h-16">
            <button onClick={() => setLightboxIdx(i)}
              className="w-full h-full rounded-xl overflow-hidden transition hover:opacity-80"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); if (window.confirm("Удалить это фото?")) deleteFile(f.id); }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition"
            >
              <Icon name="X" size={11} className="text-white" />
            </button>
          </div>
        ))}
      </div>

      {/* Полноэкранный слайдер — z-index выше модалки "Фото проекта" (z-[10000]),
          иначе он рендерится позади неё и виден размытым сквозь фон. */}
      {lightboxFile && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10" style={{ color: "#fff" }}
            onClick={() => setLightboxIdx(null)}>
            <Icon name="X" size={20} />
          </button>
          <button className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-red-500/20 transition" style={{ color: "#f87171", background: "rgba(239,68,68,0.12)" }}
            onClick={e => { e.stopPropagation(); if (window.confirm("Удалить это фото?")) deleteFile(lightboxFile.id); }}>
            <Icon name="Trash2" size={16} />
            <span className="text-xs font-semibold">Удалить</span>
          </button>
          {lightboxIdx != null && lightboxIdx > 0 && (
            <button className="absolute left-4 p-3 rounded-full hover:bg-white/10" style={{ color: "#fff" }}
              onClick={e => { e.stopPropagation(); setLightboxIdx(p => p != null ? p - 1 : p); }}>
              <Icon name="ChevronLeft" size={28} />
            </button>
          )}
          <img src={lightboxFile.url} alt={lightboxFile.name}
            className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain"
            onClick={e => e.stopPropagation()} />
          {lightboxIdx != null && lightboxIdx < files.length - 1 && (
            <button className="absolute right-4 p-3 rounded-full hover:bg-white/10" style={{ color: "#fff" }}
              onClick={e => { e.stopPropagation(); setLightboxIdx(p => p != null ? p + 1 : p); }}>
              <Icon name="ChevronRight" size={28} />
            </button>
          )}
          <div className="absolute bottom-4 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {lightboxFile.name}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}