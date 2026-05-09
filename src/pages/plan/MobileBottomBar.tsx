import React, { useRef } from "react";
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
  voiceStatus?: string;
  voiceInterim?: string;
  attachedCount?: number;
  filterAttached?: boolean;
  onToggleFilterAttached?: () => void;
}

// Стиль единой кнопки — как фиолетовая кнопка PanelBottom
const BTN = "w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all active:scale-95 shadow-lg";
const BTN_DEFAULT = `${BTN} bg-[#1c1c2e] border border-white/[0.12] text-white/70 active:bg-white/[0.12]`;
const BTN_ACTIVE  = `${BTN} bg-violet-600 shadow-violet-500/40 text-white`;

export default function MobileBottomBar({
  zoom, settings, onSettingChange, onZoomIn, onZoomOut, onZoomFit, onOpenPanel, onOpenCatalog,
  onOpenSides, selectedSegmentId,
  sheetOpen = false, catalogOpen = false, rightPanelOpen = false,
  onToggleVoiceDraw, isVoiceDrawing = false, voiceStatus, voiceInterim,
  attachedCount = 0, filterAttached = false, onToggleFilterAttached,
}: Props) {
  const [zoomOpen,     setZoomOpen]     = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const zoomRef     = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Закрываем при клике вне
  React.useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (zoomRef.current && !zoomRef.current.contains(e.target as Node)) setZoomOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
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
    <div className="absolute bottom-4 left-0 right-0 flex items-end justify-center gap-3 z-20 px-4">

      {/* 1. Настройки */}
      <div ref={settingsRef} className="relative">
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
          onClick={() => { setSettingsOpen(v => !v); setZoomOpen(false); }}
          className={settingsOpen ? BTN_ACTIVE : BTN_DEFAULT}
        >
          <Icon name="SlidersHorizontal" size={20} />
        </button>
      </div>

      {/* 2. Зум */}
      <div ref={zoomRef} className="relative">
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
          onClick={() => { setZoomOpen(v => !v); setSettingsOpen(false); }}
          className={zoomOpen ? BTN_ACTIVE : BTN_DEFAULT}
        >
          <span className="text-[11px] font-bold font-mono">{Math.round(zoom * 100)}</span>
        </button>
      </div>

      {/* 3. Расчёт (каталог) */}
      <button
        onClick={onOpenCatalog}
        className={catalogOpen ? BTN_ACTIVE : BTN_DEFAULT}
      >
        <Icon name="LayoutGrid" size={20} />
      </button>

      {/* 4. Чертёж (bottom sheet) */}
      <button
        onClick={onOpenPanel}
        className={sheetOpen ? BTN_ACTIVE : BTN_DEFAULT}
      >
        <Icon name="PanelBottom" size={20} />
      </button>

      {/* 5. Стороны (правая панель ввода) */}
      <button
        onClick={onOpenSides}
        className={rightPanelOpen ? BTN_ACTIVE : BTN_DEFAULT}
      >
        <Icon name="Ruler" size={20} />
      </button>

      {/* 6. Голосовое рисование */}
      {onToggleVoiceDraw && (
        <div className="relative">
          {/* Всплывающая подсказка над кнопкой */}
          {isVoiceDrawing && (voiceStatus || voiceInterim) && (
            <div className="absolute bottom-14 right-0 bg-[#1a1b2e] border border-violet-500/30 rounded-2xl shadow-2xl p-3 w-56 z-50">
              {voiceStatus && (
                <p className="text-[11px] text-violet-300 font-medium leading-snug">{voiceStatus}</p>
              )}
              {voiceInterim && (
                <p className="text-[10px] text-white/40 italic mt-1">{voiceInterim}</p>
              )}
            </div>
          )}
          <button
            onClick={onToggleVoiceDraw}
            className={`${isVoiceDrawing
              ? "w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all active:scale-95 shadow-lg bg-red-600 shadow-red-500/40 animate-pulse"
              : BTN_DEFAULT
            }`}
          >
            <Icon name={isVoiceDrawing ? "MicOff" : "Mic"} size={20} />
          </button>
        </div>
      )}
    </div>
  );
}