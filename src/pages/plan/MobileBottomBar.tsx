import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { PlanSettings, PlanState } from "./planTypes";
import type { VoiceCatalogItem } from "./useVoiceCatalog";
import useVoiceCatalog from "./useVoiceCatalog";
import VoiceResultPopup, { splitTranscriptToItems, type VoiceResultItem } from "./VoiceResultPopup";

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
  // Режим наполнения (когда полотно построено)
  planState?: PlanState;
  onVoiceCatalogItems?: (items: VoiceCatalogItem[], transcript: string) => void;
  onOpenMaterials?: () => void;
  materialsOpen?: boolean;
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
  planState, onVoiceCatalogItems,
  onOpenMaterials, materialsOpen = false,
}: Props) {
  const [hintsOpen, setHintsOpen] = useState(false);
  const [voicePopupItems, setVoicePopupItems] = useState<VoiceResultItem[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryCountRef = useRef(0); // сколько автоповторов уже было

  // Голосовое наполнение — используется когда полотно построено
  const catalogVoice = useVoiceCatalog({
    state: planState ?? ({ segments: [], points: [], floorItems: [] } as unknown as import("./planTypes").PlanState),
    onItems: (items, transcript) => {
      setVoicePopupItems(prev => {
        if (prev.length === 0) return prev;

        if (items.length > 0) {
          // Бот нашёл товары — все метки ok
          return prev.map(p => ({ ...p, status: "ok" as const }));
        } else {
          // Бот ничего не нашёл — все pending-метки → fail
          return prev.map(p =>
            p.status === "pending" ? { ...p, status: "fail" as const } : p
          );
        }
      });
      if (items.length > 0) onVoiceCatalogItems?.(items, transcript);
    },
    onTranscript: (transcript) => {
      retryCountRef.current = 0;
      const labels = splitTranscriptToItems(transcript);
      setVoicePopupItems(labels.map(label => ({ label, status: "pending" as const })));
    },
  });



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

      {/* 5. Материалы (смета) */}
      {onOpenMaterials && (
        <button
          onClick={onOpenMaterials}
          className={materialsOpen ? BTN_ACTIVE : BTN_DEFAULT}
        >
          <Icon name="Package" size={20} />
        </button>
      )}

      {/* 6. Каталог */}
      <button
        onClick={onOpenCatalog}
        className={catalogOpen ? BTN_ACTIVE : BTN_DEFAULT}
      >
        <Icon name="LayoutGrid" size={20} />
      </button>

      {/* 6. Голосовая кнопка — всегда видна если есть onToggleVoiceDraw */}
      {onToggleVoiceDraw && (
        <div className="relative">

          {/* ── Режим рисования (полотно не построено) ── */}
          {!isClosed && (
            <>
              {/* Подсказки по формам */}
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

              {/* Статус записи */}
              {(isVoiceDrawing || isVoiceProcessing) && (
                <div
                  className="absolute bottom-14 right-0 bg-[#1a1b2e] border border-violet-500/30 rounded-2xl shadow-2xl p-3 w-56 z-50"
                  onClick={e => e.stopPropagation()}
                >
                  {isVoiceProcessing && <p className="text-[10px] text-amber-400 font-semibold mb-1 uppercase tracking-wide">Распознаю...</p>}
                  {isVoiceDrawing && !isVoiceProcessing && <p className="text-[10px] text-red-400 font-semibold mb-1 uppercase tracking-wide">● Запись</p>}
                  {!isVoiceDrawing && !isVoiceProcessing && voiceInterim && <p className="text-[10px] text-emerald-400 font-semibold mb-1 uppercase tracking-wide">Распознано:</p>}
                  {voiceInterim && <p className="text-[13px] text-white font-medium leading-snug mb-1">«{voiceInterim}»</p>}
                  {voiceStatus && <p className="text-[11px] text-violet-300 leading-snug">{voiceStatus}</p>}
                </div>
              )}
            </>
          )}

          {/* ── Кнопка микрофона (общая) ── */}
          <button
            onClick={() => {
              setHintsOpen(false);
              if (isClosed && onVoiceCatalogItems) {
                // Режим наполнения — используем useVoiceCatalog
                catalogVoice.toggleRecording();
              } else {
                // Режим рисования
                onToggleVoiceDraw();
              }
            }}
            disabled={isClosed ? catalogVoice.isProcessing : isVoiceProcessing}
            className={`relative overflow-hidden ${
              (isClosed ? catalogVoice.isProcessing : isVoiceProcessing)
                ? "w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all shadow-lg bg-amber-600 shadow-amber-500/40 opacity-80"
                : (isClosed ? catalogVoice.isRecording : isVoiceDrawing)
                ? "w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all active:scale-95 shadow-lg bg-red-600 shadow-red-500/40"
                : BTN_DEFAULT
            }`}
          >
            {(isClosed ? catalogVoice.isRecording : isVoiceDrawing) && !(isClosed ? catalogVoice.isProcessing : isVoiceProcessing) && (
              <svg viewBox="0 0 48 48" width="48" height="48" className="absolute inset-0 pointer-events-none" style={{ opacity: 0.55 }}>
                {[6, 14, 22, 30, 38].map((x, i) => {
                  const vol = isClosed ? catalogVoice.volume : voiceVolume;
                  const h = Math.max(4, Math.round(vol * 28 * (0.6 + 0.4 * Math.sin(i * 1.3))));
                  return <rect key={i} x={x} y={48 - h} width={6} height={h} rx={3} fill="rgba(255,255,255,0.7)" style={{ transition: "height 0.08s, y 0.08s" }} />;
                })}
              </svg>
            )}
            <Icon
              name={
                (isClosed ? catalogVoice.isProcessing : isVoiceProcessing) ? "Loader"
                : (isClosed ? catalogVoice.isRecording : isVoiceDrawing) ? "MicOff"
                : "Mic"
              }
              size={20}
              className={(isClosed ? catalogVoice.isProcessing : isVoiceProcessing) ? "animate-spin" : ""}
            />
          </button>

          {/* Кнопка подсказок — только в режиме рисования, когда не записываем */}
          {!isClosed && !isVoiceDrawing && !isVoiceProcessing && (
            <button
              onClick={() => setHintsOpen(v => !v)}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-600/80 flex items-center justify-center text-white hover:bg-violet-500 transition-all"
              title="Примеры фраз"
            >
              <Icon name="HelpCircle" size={10} />
            </button>
          )}

          {/* Статус наполнения — только в режиме наполнения */}
          {isClosed && (catalogVoice.isRecording || catalogVoice.isProcessing || catalogVoice.status) && (
            <div
              className="absolute bottom-14 right-0 bg-[#1a1b2e] border border-violet-500/30 rounded-2xl shadow-2xl p-3 w-56 z-50"
              onClick={e => e.stopPropagation()}
            >
              {catalogVoice.isProcessing && <p className="text-[10px] text-amber-400 font-semibold mb-1 uppercase tracking-wide">Обрабатываю...</p>}
              {catalogVoice.isRecording && !catalogVoice.isProcessing && (
                <p className="text-[10px] text-red-400 font-semibold mb-1 uppercase tracking-wide">● Говорите...</p>
              )}
              {catalogVoice.status && <p className="text-[11px] text-violet-300 leading-snug">{catalogVoice.status}</p>}
            </div>
          )}
        </div>
      )}

      {/* Попап результатов голосового наполнения */}
      {voicePopupItems.length > 0 && (
        <VoiceResultPopup
          items={voicePopupItems}
          isRetrying={isRetrying}
          onClose={() => setVoicePopupItems([])}
          onRetry={retryCountRef.current >= 1 ? () => {
            const failLabels = voicePopupItems.filter(p => p.status === "fail").map(p => p.label);
            if (failLabels.length === 0) return;
            retryCountRef.current += 1;
            setIsRetrying(true);
            // Помечаем fail → pending перед повтором
            setVoicePopupItems(prev => prev.map(p =>
              p.status === "fail" ? { ...p, status: "pending" as const } : p
            ));
            catalogVoice.sendToAI(failLabels.join(", "))
              .then(({ items: retryItems, transcript }) => {
                setVoicePopupItems(curr => {
                  if (retryItems.length > 0) {
                    onVoiceCatalogItems?.(retryItems, transcript);
                    // Все pending → ok
                    return curr.map(p =>
                      p.status === "pending" ? { ...p, status: "ok" as const } : p
                    );
                  } else {
                    // Ничего не нашли → pending обратно в fail
                    return curr.map(p =>
                      p.status === "pending" ? { ...p, status: "fail" as const } : p
                    );
                  }
                });
              })
              .finally(() => setIsRetrying(false));
          } : undefined}
        />
      )}
    </div>
  );
}