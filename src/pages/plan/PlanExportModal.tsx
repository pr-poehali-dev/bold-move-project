import React, { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { PlanState } from "./planTypes";
import { getSvgDataUrl, downloadSvg, downloadPng } from "./planExport";

interface Props {
  state: PlanState;
  onClose: () => void;
}

type Format = "svg" | "png";
type BgOption = "dark" | "white" | "transparent";

const BG_COLORS: Record<BgOption, string> = {
  dark:        "#0f1117",
  white:       "#ffffff",
  transparent: "transparent",
};

export default function PlanExportModal({ state, onClose }: Props) {
  const [format,     setFormat]    = useState<Format>("png");
  const [scale,      setScale]     = useState(2);
  const [bg,         setBg]        = useState<BgOption>("dark");
  const [filename,   setFilename]  = useState(state.room.name || "plan");
  const [previewUrl, setPreview]   = useState("");
  const [loading,    setLoading]   = useState(false);
  const [exporting,  setExporting] = useState(false);

  // Генерация превью
  const rebuildPreview = useCallback(() => {
    setLoading(true);
    // Небольшой debounce через setTimeout
    const id = setTimeout(() => {
      try {
        const url = getSvgDataUrl(state, 1);
        setPreview(url);
      } catch {
        setPreview("");
      } finally {
        setLoading(false);
      }
    }, 80);
    return () => clearTimeout(id);
  }, [state]);

  useEffect(() => {
    const cleanup = rebuildPreview();
    return cleanup;
  }, [rebuildPreview]);

  // Закрыть по Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasShape = state.points.length >= 2;
  const fname = `${filename.replace(/[^a-zа-яА-ЯёЁ0-9_\- ]/gi, "_")}.${format}`;

  const handleExport = async () => {
    if (!hasShape) return;
    setExporting(true);
    try {
      if (format === "svg") {
        downloadSvg(state, fname, scale);
      } else {
        await downloadPng(state, fname, scale, BG_COLORS[bg]);
      }
    } finally {
      setExporting(false);
    }
  };

  const btnTab = (active: boolean) =>
    `flex-1 py-2 rounded-xl text-xs font-bold border transition ${
      active
        ? "bg-violet-500/25 border-violet-500/50 text-violet-200"
        : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:bg-white/[0.08]"
    }`;

  const lbl = "block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5";

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-[#13141f] rounded-2xl border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh]">

        {/* Заголовок */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.07] shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
            <Icon name="Download" size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white/90">Экспорт чертежа</p>
            <p className="text-[11px] text-white/35">{state.room.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center transition">
            <Icon name="X" size={14} className="text-white/50" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Превью */}
            <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/[0.08] flex items-center justify-center relative"
              style={{ background: bg === "white" ? "#fff" : bg === "transparent" ? "repeating-conic-gradient(#1a1b2e 0% 25%, #0f1117 0% 50%) 0 0 / 16px 16px" : "#0f1117" }}>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-violet-500/40 border-t-violet-400 animate-spin" />
                </div>
              )}
              {!hasShape && (
                <div className="text-center text-white/25 text-xs">
                  <Icon name="PenTool" size={24} className="mx-auto mb-2 opacity-30" />
                  <p>Нарисуйте фигуру чтобы экспортировать</p>
                </div>
              )}
              {previewUrl && hasShape && (
                <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Превью чертежа" />
              )}
            </div>

            {/* Формат */}
            <div>
              <label className={lbl}>Формат</label>
              <div className="flex gap-2">
                {(["png", "svg"] as Format[]).map(f => (
                  <button key={f} className={btnTab(format === f)} onClick={() => setFormat(f)}>
                    <span className="uppercase">{f}</span>
                    {f === "png" && <span className="ml-1 text-[10px] text-white/30 normal-case">растр</span>}
                    {f === "svg" && <span className="ml-1 text-[10px] text-white/30 normal-case">вектор</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Масштаб */}
            <div>
              <label className={lbl}>Масштаб: {scale}×
                {scale === 1 && <span className="ml-1 text-white/25 normal-case font-normal">экран</span>}
                {scale === 2 && <span className="ml-1 text-white/25 normal-case font-normal">retina</span>}
                {scale >= 3 && <span className="ml-1 text-white/25 normal-case font-normal">печать</span>}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(s => (
                  <button key={s} className={btnTab(scale === s)} onClick={() => setScale(s)}>
                    {s}×
                  </button>
                ))}
              </div>
              {/* Примерный размер файла */}
              {state.points.length >= 2 && (() => {
                const xs = state.points.map(p => p.x);
                const ys = state.points.map(p => p.y);
                const w = Math.round((Math.max(...xs) - Math.min(...xs) + 120) * scale);
                const h = Math.round((Math.max(...ys) - Math.min(...ys) + 120) * scale);
                return (
                  <p className="text-[10px] text-white/25 mt-1.5">
                    Размер: {w} × {h} px
                    {format === "svg" && " · векторный, не зависит от масштаба"}
                  </p>
                );
              })()}
            </div>

            {/* Фон (только для PNG) */}
            {format === "png" && (
              <div>
                <label className={lbl}>Фон</label>
                <div className="flex gap-2">
                  {([
                    ["dark",        "Тёмный",       "#0f1117"],
                    ["white",       "Белый",         "#ffffff"],
                    ["transparent", "Прозрачный",    ""],
                  ] as const).map(([val, label, color]) => (
                    <button key={val} className={btnTab(bg === val)} onClick={() => setBg(val)}>
                      <span className="flex items-center gap-1.5">
                        {color
                          ? <span className="w-3 h-3 rounded-sm border border-white/20 inline-block shrink-0" style={{ background: color }} />
                          : <span className="w-3 h-3 rounded-sm border border-white/20 inline-block shrink-0 bg-[repeating-conic-gradient(#888_0%_25%,#555_0%_50%)_0_0/_6px_6px]" />
                        }
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Имя файла */}
            <div>
              <label className={lbl}>Имя файла</label>
              <div className="flex gap-2 items-center">
                <input
                  value={filename}
                  onChange={e => setFilename(e.target.value)}
                  className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 transition font-mono"
                  placeholder="plan"
                />
                <span className="text-xs text-white/25 font-mono shrink-0">.{format}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/[0.07] shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border bg-white/[0.04] border-white/[0.08] text-white/50 hover:bg-white/[0.08] transition">
            Отмена
          </button>
          <button
            onClick={handleExport}
            disabled={!hasShape || exporting}
            className="flex-2 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed bg-violet-600 border-violet-500 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20"
            style={{ flex: 2 }}
          >
            {exporting
              ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Экспортируем…</>
              : <><Icon name="Download" size={15} /> Скачать {format.toUpperCase()}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
