import React, { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { uploadBrandImage } from "@/pages/admin/own-agent/brandApi";
import func2url from "@/../backend/func2url.json";

const GEN_URL = (func2url as Record<string, string>)["generate-image"];

const PROMPT_EXAMPLES = [
  "iPhone 14 Pro мокап, фронтальный вид, тёмный фон, пустой экран для вставки контента",
  "MacBook Pro открытый, вид сбоку, минималистичный белый фон, пустой экран",
  "Рекламный баннер с красивым градиентным фоном, место для текста в центре",
  "Современная визитная карточка, минималистичный дизайн, тёмные тона",
  "Смартфон с пустым экраном, держит рука, размытый офисный фон",
  "Планшет iPad на столе, пустой экран, кофе рядом, уютная атмосфера",
];

interface Props {
  onGenerated: (imageUrl: string, prompt: string) => void;
  onClose: () => void;
  token: string | null;
  initialPrompt?: string;
}

export function AiImageModal({ onGenerated, onClose, token, initialPrompt = "" }: Props) {
  const [prompt,   setPrompt]   = useState(initialPrompt);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [preview,  setPreview]  = useState("");
  const [size,     setSize]     = useState<"1024x1024" | "1792x1024" | "1024x1792">("1024x1024");
  const [quality,  setQuality]  = useState<"standard" | "hd">("standard");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setPreview("");
    try {
      const res = await fetch(GEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), size, quality }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setError(d.error || "Ошибка генерации"); return; }
      setPreview(d.url);
    } catch { setError("Не удалось подключиться к AI"); }
    finally { setLoading(false); }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const url = await uploadBrandImage(token, file);
      setPreview(url);
    } catch { setError("Ошибка загрузки файла"); }
    finally { setUploading(false); }
  };

  const handleConfirm = () => {
    if (!preview) return;
    onGenerated(preview, prompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[#0e0e1a] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center">
              <Icon name="Sparkles" size={15} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">AI Генерация картинки</p>
              <p className="text-white/35 text-[11px]">Опишите что должно быть на изображении</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Промпт */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">
              Промпт — что должно быть на картинке
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && e.metaKey && generate()}
              placeholder="Например: iPhone 14 мокап с пустым экраном, тёмный фон..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none focus:border-fuchsia-500/50 resize-none"
            />
            {/* Примеры */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PROMPT_EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => setPrompt(ex)}
                  className="px-2 py-1 rounded-lg text-[10px] text-white/40 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition text-left truncate max-w-[180px]">
                  {ex.slice(0, 28)}…
                </button>
              ))}
            </div>
          </div>

          {/* Параметры */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">Формат</label>
              <div className="flex gap-1">
                {([["1024x1024","1:1 Квадрат"],["1792x1024","16:9 Широкий"],["1024x1792","9:16 Вертикальный"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setSize(v)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] transition ${size===v?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">Качество</label>
              <div className="flex gap-1">
                {(["standard","hd"] as const).map(q => (
                  <button key={q} onClick={() => setQuality(q)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] transition ${quality===q?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>
                    {q === "standard" ? "Стандарт" : "HD"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Превью */}
          {preview && (
            <div className="relative rounded-xl overflow-hidden border border-white/[0.1]">
              <img src={preview} alt="Результат" className="w-full object-contain max-h-64" />
              <button onClick={() => setPreview("")}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white/60 hover:text-white transition">
                <Icon name="X" size={12} />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <Icon name="AlertCircle" size={13} />
              {error}
            </div>
          )}

          {/* Кнопки действий */}
          <div className="flex gap-2">
            {/* Генерировать */}
            <button onClick={generate} disabled={loading || !prompt.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:brightness-110 disabled:opacity-40 transition">
              {loading ? (
                <><Icon name="Loader" size={15} className="animate-spin" /> Генерирую...</>
              ) : (
                <><Icon name="Sparkles" size={15} /> Сгенерировать</>
              )}
            </button>

            {/* Загрузить своё */}
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs text-white/60 hover:text-white/90 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] transition">
              <Icon name={uploading?"Loader":"Upload"} size={13} className={uploading?"animate-spin":""} />
              Загрузить
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          </div>

          {/* Добавить на холст */}
          {preview && (
            <button onClick={handleConfirm}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition">
              <Icon name="CheckCircle2" size={16} />
              Добавить на холст
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
