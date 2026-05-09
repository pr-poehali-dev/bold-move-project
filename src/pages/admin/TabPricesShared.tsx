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

// ── MaterialButton ────────────────────────────────────────────────────────────

export function MaterialButton({
  category,
  initialValue,
  isDark,
}: {
  category: string;
  initialValue: boolean;
  isDark: boolean;
}) {
  const [isMaterial, setIsMaterial] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next = !isMaterial;
    setIsMaterial(next);
    setSaving(true);
    await fetch(`${BASE}?r=category_settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, is_material: next }),
    });
    setSaving(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all touch-manipulation disabled:opacity-50 ${
        isMaterial
          ? isDark ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-600"
          : isDark ? "bg-white/5 border-white/10 text-white/30" : "bg-gray-50 border-gray-200 text-gray-400"
      }`}
    >
      <Icon name={saving ? "Loader" : "ShoppingCart"} size={12} className={saving ? "animate-spin" : ""} />
      {isMaterial ? "в закупке" : "не в закупке"}
    </button>
  );
}
