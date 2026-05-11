import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

export const BASE      = (func2url as Record<string, string>)["parse-xlsx"];
export const IMAGE_URL = (func2url as Record<string, string>)["price-image"];

export const EMPTY_NEW = { name: "", price: "", purchase_price: "", unit: "шт", description: "" };
export const EMPTY_CAT = { name: "", firstItem: "", price: "", unit: "шт", description: "" };

// ── Цветовые классы темы ─────────────────────────────────────────────────────

export interface ThemeClasses {
  text: string;
  muted: string;
  muted2: string;
  border: string;
  border2: string;
  bg: string;
  bgInput: string;
  borderInput: string;
  selectBg: string;
}

export function buildTheme(isDark: boolean): ThemeClasses {
  return {
    text:        isDark ? "text-white"       : "text-gray-900",
    muted:       isDark ? "text-white/40"    : "text-gray-500",
    muted2:      isDark ? "text-white/30"    : "text-gray-400",
    border:      isDark ? "border-white/10"  : "border-gray-200",
    border2:     isDark ? "border-white/5"   : "border-gray-100",
    bg:          isDark ? "bg-white/[0.03]"  : "bg-white",
    bgInput:     isDark ? "bg-white/5"       : "bg-gray-50",
    borderInput: isDark ? "border-white/15"  : "border-gray-200",
    selectBg:    isDark ? "#0b0b11"          : "#ffffff",
  };
}

// ── ImageUploadButton ─────────────────────────────────────────────────────────

export function ImageUploadButton({
  currentUrl,
  uploadEndpoint,
  onUploaded,
  isDark,
}: {
  currentUrl?: string | null;
  uploadEndpoint: string;
  onUploaded: (url: string) => void;
  isDark: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      try {
        const res = await fetch(uploadEndpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: b64, content_type: file.type }),
        });
        const data = await res.json();
        if (data.url) onUploaded(data.url);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {currentUrl && (
        <img src={currentUrl} alt="" className="w-7 h-7 rounded object-cover border border-white/10" />
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        title={currentUrl ? "Сменить картинку" : "Добавить картинку"}
        className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded border transition disabled:opacity-40 ${
          isDark
            ? "border-white/10 text-white/25 hover:text-white/60 hover:border-white/30"
            : "border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300"
        }`}
      >
        {loading
          ? <Icon name="Loader" size={10} className="animate-spin" />
          : <Icon name={currentUrl ? "RefreshCw" : "ImagePlus"} size={10} />
        }
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ── MaterialButton (legacy alias) ─────────────────────────────────────────────

/** @deprecated Используй CategoryFunctionsButton */
export function MaterialButton({
  category,
  initialValue,
  initialIsWall = true,
  isDark,
  token,
}: {
  category: string;
  initialValue: boolean;
  initialIsWall?: boolean;
  isDark: boolean;
  token?: string;
}) {
  return (
    <CategoryFunctionsButton
      category={category}
      initialIsMaterial={initialValue}
      initialIsWall={initialIsWall}
      isDark={isDark}
      token={token}
    />
  );
}

// ── CategoryFunctionsButton ───────────────────────────────────────────────────

export function CategoryFunctionsButton({
  category,
  initialIsMaterial,
  initialIsWall,
  isDark,
  token,
}: {
  category: string;
  initialIsMaterial: boolean;
  initialIsWall: boolean;
  isDark: boolean;
  token?: string;
}) {
  const [open, setOpen]           = useState(false);
  const [isMaterial, setIsMaterial] = useState(initialIsMaterial);
  const [isWall, setIsWall]       = useState(initialIsWall);
  const [saving, setSaving]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Закрываем при клике вне
  useState(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });

  const save = async (newMaterial: boolean, newWall: boolean) => {
    setSaving(true);
    await fetch(`${BASE}?r=category_settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ category, is_material: newMaterial, is_wall_item: newWall }),
    });
    setSaving(false);
  };

  const toggleMaterial = async () => {
    const next = !isMaterial;
    setIsMaterial(next);
    await save(next, isWall);
  };

  const toggleWall = async () => {
    const next = !isWall;
    setIsWall(next);
    await save(isMaterial, next);
  };

  // Суммарный «статус» для кнопки
  const label = !isMaterial ? "не в закупке" : !isWall ? "на полотно" : "функции";

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all touch-manipulation disabled:opacity-50 ${
          isDark
            ? "bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
            : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600"
        }`}
      >
        <Icon name={saving ? "Loader" : "Settings2"} size={12} className={saving ? "animate-spin" : ""} />
        {label}
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-1.5 z-50 rounded-xl shadow-xl border min-w-[200px] py-2 px-1 ${
          isDark ? "bg-[#0e0c1e] border-white/10" : "bg-white border-gray-200"
        }`}>
          {/* Заголовок */}
          <div className={`text-[10px] uppercase tracking-wider px-3 pb-2 pt-1 ${isDark ? "text-white/25" : "text-gray-400"}`}>
            Функции категории
          </div>

          {/* Переключатель: в закупке */}
          <button
            type="button"
            onClick={() => { toggleMaterial(); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition hover:bg-white/5 ${isDark ? "text-white/70" : "text-gray-700"}`}
          >
            <div className={`w-8 h-4 rounded-full flex items-center transition-all flex-shrink-0 ${isMaterial ? "bg-blue-500" : isDark ? "bg-white/10" : "bg-gray-200"}`}>
              <div className={`w-3 h-3 rounded-full bg-white ml-0.5 transition-transform ${isMaterial ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-medium">В закупке</span>
              <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                {isMaterial ? "Учитывается в закупке" : "Не учитывается в закупке"}
              </span>
            </div>
          </button>

          {/* Разделитель */}
          <div className={`mx-3 my-1.5 h-px ${isDark ? "bg-white/5" : "bg-gray-100"}`} />

          {/* Переключатель: к стенам / на полотно */}
          <button
            type="button"
            onClick={() => { toggleWall(); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition hover:bg-white/5 ${isDark ? "text-white/70" : "text-gray-700"}`}
          >
            <div className={`w-8 h-4 rounded-full flex items-center transition-all flex-shrink-0 ${isWall ? "bg-violet-500" : isDark ? "bg-white/10" : "bg-gray-200"}`}>
              <div className={`w-3 h-3 rounded-full bg-white ml-0.5 transition-transform ${isWall ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-medium">{isWall ? "К стенам" : "На полотно"}</span>
              <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                {isWall ? "Товар крепится к стенам" : "Товар размещается на полотне"}
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}