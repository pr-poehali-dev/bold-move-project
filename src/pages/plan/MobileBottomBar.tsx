import { useState } from "react";
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
  const [hintsOpen, setHintsOpen] = useState(false);



  return (
    <div className="absolute left-0 right-0 flex items-end justify-center gap-2 z-20 px-4" style={{ bottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}>



      {/* 3. Стороны (правая панель ввода) — только мобайл */}
      {isMobile && (
        <button
          onClick={onOpenSides}
          className={rightPanelOpen ? BTN_ACTIVE : BTN_DEFAULT}
        >
          <Icon name="PanelRight" size={20} />
        </button>
      )}

      {/* 4. Чертёж: bottom sheet (мобайл) / toggle сайдбара (ПК) */}
      <button
        onClick={onOpenPanel}
        className={sheetOpen ? BTN_ACTIVE : BTN_DEFAULT}
      >
        <Icon name="PanelBottom" size={20} />
      </button>

      {/* 5. Каталог */}
      <button
        onClick={onOpenCatalog}
        className={catalogOpen ? BTN_ACTIVE : BTN_DEFAULT}
      >
        <Icon name="LayoutGrid" size={20} />
      </button>

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

          {/* Статус записи — только когда активно идёт запись или распознавание */}
          {(isVoiceDrawing || isVoiceProcessing) && !isClosed && (
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
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-600/80 flex items-center justify-center text-white hover:bg-violet-500 transition-all"
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