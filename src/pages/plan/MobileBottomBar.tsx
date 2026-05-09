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
}

// Стиль единой кнопки — как фиолетовая кнопка PanelBottom
const BTN = "w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all active:scale-95 shadow-lg";
const BTN_DEFAULT = `${BTN} bg-[#1c1c2e] border border-white/[0.12] text-white/70 active:bg-white/[0.12]`;
const BTN_ACTIVE  = `${BTN} bg-violet-600 shadow-violet-500/40 text-white`;

export default function MobileBottomBar({
  zoom, settings, onSettingChange, onZoomIn, onZoomOut, onZoomFit, onOpenPanel, onOpenCatalog,
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
    { key: "ortho",             label: "Ортогональный",   icon: "Axis3d"       },
    { key: "snapToPoints",      label: "Магнит",          icon: "Magnet"       },
    { key: "showGrid",          label: "Сетка",           icon: "Grid3x3"      },
    { key: "showPoints",        label: "Точки",           icon: "CircleDot"    },
    { key: "showSegmentLabels", label: "Подписи",         icon: "Type"         },
    { key: "showAngleLabels",   label: "Углы",            icon: "Angle"        },
    { key: "showDiagonals",     label: "Диагонали",       icon: "ArrowUpRight" },
    { key: "showDimLines",      label: "Размерные линии", icon: "ArrowLeftRight"},
  ];

  return (
    <div className="absolute bottom-4 left-0 right-0 flex items-end justify-center gap-3 z-20 px-4">

      {/* 1. Настройки */}
      <div ref={settingsRef} className="relative">
        {settingsOpen && (
          <div className="absolute bottom-14 left-0 bg-[#1a1b2e] border border-white/[0.12] rounded-2xl shadow-2xl p-2 flex flex-col gap-0.5 min-w-[200px] max-h-[60vh] overflow-y-auto">
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

      {/* 3. Чертёж (bottom sheet) */}
      <button
        onClick={onOpenPanel}
        className={BTN_ACTIVE}
      >
        <Icon name="PanelBottom" size={20} />
      </button>

      {/* 4. Расчёт (каталог) */}
      <button
        onClick={onOpenCatalog}
        className={BTN_DEFAULT}
      >
        <Icon name="LayoutGrid" size={20} />
      </button>
    </div>
  );
}