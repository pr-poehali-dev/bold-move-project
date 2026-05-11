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
  token,
}: {
  currentUrl?: string | null;
  uploadEndpoint: string;
  onUploaded: (url: string) => void;
  isDark: boolean;
  token?: string;
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
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(uploadEndpoint, {
          method: "PUT",
          headers,
          body: JSON.stringify({ image: b64, content_type: file.type }),
        });
        const data = await res.json();
        if (data.url) onUploaded(data.url + "?t=" + Date.now());
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
  initialShowInDrum = true,
  isDark,
  token,
}: {
  category: string;
  initialValue: boolean;
  initialIsWall?: boolean;
  initialShowInDrum?: boolean;
  isDark: boolean;
  token?: string;
}) {
  return (
    <CategoryFunctionsButton
      category={category}
      initialIsMaterial={initialValue}
      initialIsWall={initialIsWall}
      initialShowInDrum={initialShowInDrum}
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
  initialShowInDrum = true,
  isDark,
  token,
}: {
  category: string;
  initialIsMaterial: boolean;
  initialIsWall: boolean;
  initialShowInDrum?: boolean;
  isDark: boolean;
  token?: string;
}) {
  const [open, setOpen]             = useState(false);
  const [isMaterial, setIsMaterial] = useState(initialIsMaterial);
  const [isWall, setIsWall]         = useState(initialIsWall);
  const [showInDrum, setShowInDrum] = useState(initialShowInDrum);
  const [saving, setSaving]         = useState(false);
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

  const save = async (mat: boolean, wall: boolean, drum: boolean) => {
    setSaving(true);
    await fetch(`${BASE}?r=category_settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ category, is_material: mat, is_wall_item: wall, show_in_drum: drum }),
    });
    setSaving(false);
  };

  const toggle = async (field: "material" | "wall" | "drum") => {
    const mat  = field === "material" ? !isMaterial : isMaterial;
    const wall = field === "wall"     ? !isWall     : isWall;
    const drum = field === "drum"     ? !showInDrum : showInDrum;
    if (field === "material") setIsMaterial(mat);
    if (field === "wall")     setIsWall(wall);
    if (field === "drum")     setShowInDrum(drum);
    await save(mat, wall, drum);
  };

  // Кнопка всегда называется "настройки"

  const ToggleRow = ({ active, color, label: lbl, sub, onClick }: {
    active: boolean; color: string; label: string; sub: string; onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition hover:bg-white/5 ${isDark ? "text-white/70" : "text-gray-700"}`}
    >
      <div className={`w-8 h-4 rounded-full flex items-center transition-all flex-shrink-0 ${active ? color : isDark ? "bg-white/10" : "bg-gray-200"}`}>
        <div className={`w-3 h-3 rounded-full bg-white ml-0.5 transition-transform ${active ? "translate-x-4" : "translate-x-0"}`} />
      </div>
      <div className="flex flex-col items-start">
        <span className="font-medium">{lbl}</span>
        <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>{sub}</span>
      </div>
    </button>
  );

  const sep = <div className={`mx-3 my-1 h-px ${isDark ? "bg-white/5" : "bg-gray-100"}`} />;

  return (
    <div ref={ref} className="relative flex-shrink-0 flex items-center gap-1.5">
      {/* Бейджи — реагируют мгновенно на изменение тоглов */}
      {!isMaterial && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium cursor-pointer ${
          isDark ? "bg-white/5 border-white/10 text-white/30" : "bg-gray-100 border-gray-200 text-gray-400"
        }`} onClick={() => setOpen(v => !v)}>не в закупке</span>
      )}
      {!isWall && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium cursor-pointer ${
          isDark ? "bg-amber-500/15 border-amber-500/25 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-600"
        }`} onClick={() => setOpen(v => !v)}>на полотно</span>
      )}
      {!showInDrum && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium cursor-pointer ${
          isDark ? "bg-white/5 border-white/10 text-white/25" : "bg-gray-100 border-gray-200 text-gray-400"
        }`} onClick={() => setOpen(v => !v)}>скрыта</span>
      )}
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
        настройки
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-1.5 z-50 rounded-xl shadow-xl border min-w-[210px] py-2 px-1 ${
          isDark ? "bg-[#0e0c1e] border-white/10" : "bg-white border-gray-200"
        }`}>
          <div className={`text-[10px] uppercase tracking-wider px-3 pb-2 pt-1 ${isDark ? "text-white/25" : "text-gray-400"}`}>
            Функции категории
          </div>
          <ToggleRow
            active={isMaterial} color="bg-blue-500"
            label="В закупке"
            sub={isMaterial ? "Учитывается в закупке" : "Не учитывается в закупке"}
            onClick={() => toggle("material")}
          />
          {sep}
          <ToggleRow
            active={!isWall} color="bg-amber-500"
            label="На полотно"
            sub={!isWall ? "Товар на полотне потолка" : "Товар крепится к стенам"}
            onClick={() => toggle("wall")}
          />
          {sep}
          <ToggleRow
            active={showInDrum} color="bg-emerald-500"
            label="В барабане"
            sub={showInDrum ? "Видна в каталоге /план" : "Скрыта в каталоге /план"}
            onClick={() => toggle("drum")}
          />
        </div>
      )}
    </div>
  );
}