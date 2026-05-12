import React, { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import type { PlanSettings } from "./planTypes";

interface Props {
  zoom: number;
  settings: PlanSettings;
  onSettingChange: (patch: Partial<PlanSettings>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onOpenPanel: () => void;
  onOpenCatalog: () => void;
  onOpenSides: () => void;
  selectedSegmentId?: string | null;
  sheetOpen?: boolean;
  catalogOpen?: boolean;
  rightPanelOpen?: boolean;
  onToggleVoiceDraw?: () => void;
  isVoiceDrawing?: boolean;
  isVoiceProcessing?: boolean;
  voiceStatus?: string;
  voiceInterim?: string;
  voiceVolume?: number;
  isClosed?: boolean;
  attachedCount?: number;
  filterAttached?: boolean;
  onToggleFilterAttached?: () => void;
  isMobile?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}

// Стиль единой кнопки — как фиолетовая кнопка PanelBottom
const BTN = "w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all active:scale-95 shadow-lg";
const BTN_DEFAULT = `${BTN} bg-[#1c1c2e] border border-white/[0.12] text-white/70 active:bg-white/[0.12]`;
const BTN_ACTIVE  = `${BTN} bg-violet-600 shadow-violet-500/40 text-white`;

export default function MobileBottomBar({
  zoom, settings, onSettingChange, onZoomIn, onZoomOut, onZoomFit, onOpenPanel, onOpenCatalog,
  onOpenSides, selectedSegmentId,
  sheetOpen = false, catalogOpen = false, rightPanelOpen = false,
  onToggleVoiceDraw, isVoiceDrawing = false, isVoiceProcessing = false, voiceStatus, voiceInterim,
  voiceVolume = 0, isClosed = false,
  attachedCount = 0, filterAttached = false, onToggleFilterAttached, isMobile = false,
  onSettingsOpenChange,
}: Props) {
  const [zoomOpen,     setZoomOpen]     = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [hintsOpen,    setHintsOpen]    = useState(false);

  const setSettings = (v: boolean) => { setSettingsOpen(v); onSettingsOpenChange?.(v); };
  const zoomRef     = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Закрываем при клике вне
  React.useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (zoomRef.current && !zoomRef.current.contains(e.target as Node)) setZoomOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettings(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  const SETTINGS_ITEMS = [
    { key: "ortho",             label: "Ортогональный",   icon: "Axis3d"        },
    { key: "snapToPoints",      label: "Магнит",          icon: "Magnet"        },
    { key: "showGrid",          label: "Сетка",           icon: "Grid3x3"       },
    { key: "showPoints",        label: "Точки",           icon: "CircleDot"     },
    { key: "showPointLabels",   label: "Метки точек",     icon: "Tag"           },
    { key: "showSegmentLabels", label: "Подписи",         icon: "Type"          },
    { key: "showAngleLabels",   label: "Углы",            icon: "Angle"         },
    { key: "showDiagonals",     label: "Диагонали",       icon: "ArrowUpRight"  },
    { key: "showDimLines",      label: "Размерные линии", icon: "ArrowLeftRight" },
  ];

  return (
    <div className="absolute left-0 right-0 flex items-end justify-center gap-2 z-20 px-4" style={{ bottom: "72px" }}>

      {/* 1. Настройки — только мобайл */}
      {isMobile && <div ref={settingsRef} className="relative">
        {settingsOpen && (
          <div className="absolute bottom-14 left-0 bg-[#1a1b2e] border border-white/[0.12] rounded-2xl shadow-2xl p-2 flex flex-col gap-0.5 min-w-[210px] max-h-[65vh] overflow-y-auto">
            {SETTINGS_ITEMS.map(({ key, label, icon }) => (
              <button key={key}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all text-left w-full ${
                  settings[key as keyof typeof settings]
                    ? "bg-violet-600/20 text-violet-200 border border-violet-500/30"
                    : "text-white/60 hover:bg-white/[0.06]"
                }`}
                onClick={() => onSettingChange({ [key]: !settings[key as keyof typeof settings] })}>
                <Icon name={icon} size={14} />
                <span className="flex-1">{label}</span>
                {settings[key as keyof typeof settings] && <Icon name="Check" size={11} className="text-violet-400" />}
              </button>
            ))}
            {/* Фильтр — только добавленные на холст */}
            {onToggleFilterAttached && (
              <>
                <div className="h-px bg-white/[0.08] my-1" />
                <button
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all text-left w-full ${
                    filterAttached
                      ? "bg-emerald-600/20 text-emerald-200 border border-emerald-500/30"
                      : "text-white/60 hover:bg-white/[0.06]"
                  }`}
                  onClick={onToggleFilterAttached}
                >
                  <Icon name="Pin" size={14} />
                  <span className="flex-1">На холсте</span>
                  {attachedCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">
                      {attachedCount}
                    </span>
                  )}
                  {filterAttached && <Icon name="Check" size={11} className="text-emerald-400 ml-1" />}
                </button>
              </>
            )}
          </div>
        )}
        <button
          onClick={() => { setSettings(!settingsOpen); setZoomOpen(false); }}
          className={settingsOpen ? BTN_ACTIVE : BTN_DEFAULT}
        >
          <Icon name="SlidersHorizontal" size={20} />
        </button>
      </div>}

      {/* 2. Зум — только мобайл */}
      {isMobile && <div ref={zoomRef} className="relative">
        {zoomOpen && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#1a1b2e] border border-white/[0.12] rounded-2xl shadow-2xl p-2 flex flex-col items-center gap-1 min-w-[52px]">
            <button
              onClick={onZoomIn}
              className="w-10 h-10 rounded-xl bg-white/[0.06] text-white/70 hover:bg-white/[0.12] flex items-center justify-center transition active:scale-95">
              <Icon name="Plus" size={16} />
            </button>
            <button
              onClick={onZoomFit}
              className="text-[10px] text-white/40 font-mono py-1 hover:text-white/70 transition">
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={onZoomOut}
              className="w-10 h-10 rounded-xl bg-white/[0.06] text-white/70 hover:bg-white/[0.12] flex items-center justify-center transition active:scale-95">
              <Icon name="Minus" size={16} />
            </button>
          </div>
        )}
        <button
          onClick={() => { setZoomOpen(v => !v); setSettings(false); }}
          className={zoomOpen ? BTN_ACTIVE : BTN_DEFAULT}
        >
          <span className="text-[11px] font-bold font-mono">{Math.round(zoom * 100)}</span>
        </button>
      </div>}

      {/* 3. Каталог */}
      <button
        onClick={() => { onOpenCatalog(); setSettings(false); setZoomOpen(false); }}
        className={catalogOpen ? BTN_ACTIVE : BTN_DEFAULT}
      >
        <Icon name="LayoutGrid" size={20} />
      </button>

      {/* 4. Чертёж: bottom sheet (мобайл) / toggle сайдбара (ПК) */}
      <button
        onClick={() => { onOpenPanel(); setSettings(false); setZoomOpen(false); }}
        className={sheetOpen ? BTN_ACTIVE : BTN_DEFAULT}
      >
        <Icon name="PanelBottom" size={20} />
      </button>

      {/* 5. Стороны (правая панель ввода) — только мобайл */}
      {isMobile && (
        <button
          onClick={() => { onOpenSides(); setSettings(false); setZoomOpen(false); }}
          className={rightPanelOpen ? BTN_ACTIVE : BTN_DEFAULT}
        >
          <Icon name="PanelRight" size={20} />
        </button>
      )}

      {/* 6. Голосовое рисование */}
      {onToggleVoiceDraw && (
        <div className="relative">

          {/* Подсказки по формам — только когда не идёт запись */}
          {hintsOpen && !isVoiceDrawing && !isVoiceProcessing && (
            <div
              className="absolute bottom-14 right-0 bg-[#1a1b2e] border border-violet-500/30 rounded-2xl shadow-2xl p-3 z-50"
              style={{ width: "17rem" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wide">Примеры фраз</p>
                <button onClick={() => setHintsOpen(false)} className="text-white/30 hover:text-white/70">
                  <Icon name="X" size={12} />
                </button>
              </div>
              {[
                { label: "Квадрат",       example: "квадрат 250" },
                { label: "Прямоугольник", example: "прямоугольник 400 на 300" },
                { label: "Г-образная",    example: "г-образная 400 300 150 100" },
                { label: "П-образная",    example: "п-образная 500 400 200 150" },
                { label: "Любая форма",   example: "400 вправо 300 вправо 400 замкнуть" },
              ].map(({ label, example }) => (
                <div key={label} className="mb-1.5 last:mb-0">
                  <p className="text-[9px] text-white/35 uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-[11px] text-white/80 font-mono bg-white/[0.05] rounded-lg px-2 py-1">«{example}»</p>
                </div>
              ))}
            </div>
          )}

          {/* Статус записи — только когда идёт запись или распознавание; скрываем после замыкания */}
          {(isVoiceDrawing || isVoiceProcessing || voiceInterim) && !isClosed && (
            <div
              className="absolute bottom-14 right-0 bg-[#1a1b2e] border border-violet-500/30 rounded-2xl shadow-2xl p-3 w-56 z-50"
              onClick={e => e.stopPropagation()}
            >
              {isVoiceProcessing && (
                <p className="text-[10px] text-amber-400 font-semibold mb-1 uppercase tracking-wide">Распознаю...</p>
              )}
              {isVoiceDrawing && !isVoiceProcessing && (
                <p className="text-[10px] text-red-400 font-semibold mb-1 uppercase tracking-wide">● Запись</p>
              )}
              {!isVoiceDrawing && !isVoiceProcessing && voiceInterim && (
                <p className="text-[10px] text-emerald-400 font-semibold mb-1 uppercase tracking-wide">Распознано:</p>
              )}
              {voiceInterim && (
                <p className="text-[13px] text-white font-medium leading-snug mb-1">«{voiceInterim}»</p>
              )}
              {voiceStatus && (
                <p className="text-[11px] text-violet-300 leading-snug">{voiceStatus}</p>
              )}
            </div>
          )}

          {/* Кнопка микрофона */}
          <button
            onClick={() => {
              setHintsOpen(false);
              onToggleVoiceDraw();
            }}
            disabled={isVoiceProcessing}
            className={`relative overflow-hidden ${
              isVoiceProcessing
                ? "w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all shadow-lg bg-amber-600 shadow-amber-500/40 opacity-80"
                : isVoiceDrawing
                ? "w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all active:scale-95 shadow-lg bg-red-600 shadow-red-500/40"
                : BTN_DEFAULT
            }`}
          >
            {isVoiceDrawing && !isVoiceProcessing && (
              <svg viewBox="0 0 48 48" width="48" height="48" className="absolute inset-0 pointer-events-none" style={{ opacity: 0.55 }}>
                {[6, 14, 22, 30, 38].map((x, i) => {
                  const h = Math.max(4, Math.round(voiceVolume * 28 * (0.6 + 0.4 * Math.sin(i * 1.3))));
                  return <rect key={i} x={x} y={48 - h} width={6} height={h} rx={3} fill="rgba(255,255,255,0.7)" style={{ transition: "height 0.08s, y 0.08s" }} />;
                })}
              </svg>
            )}
            <Icon name={isVoiceProcessing ? "Loader" : isVoiceDrawing ? "MicOff" : "Mic"} size={20} className={isVoiceProcessing ? "animate-spin" : ""} />
          </button>

          {/* Кнопка подсказок — только когда не записываем */}
          {!isVoiceDrawing && !isVoiceProcessing && (
            <button
              onClick={() => setHintsOpen(v => !v)}
              className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-violet-600/80 flex items-center justify-center text-white hover:bg-violet-500 transition-all"
              title="Примеры фраз"
            >
              <Icon name="HelpCircle" size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}