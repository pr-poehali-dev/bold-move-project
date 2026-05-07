import React from "react";
import type { PlanState, PlanSettings } from "./planTypes";
import { buildAutoDiagonals, genId, midPoint } from "./planTypes";
import Icon from "@/components/ui/icon";
import { CtxItem } from "./PlanCanvasRenderers";

interface CtxMenu {
  x: number;
  y: number;
  type: "point" | "segment" | "diagonal";
  id: string;
}

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  ctxMenu: CtxMenu | null;
  onCloseCtxMenu: () => void;
  lpIndicator: { x: number; y: number } | null;
  onSettingChange?: (patch: Partial<PlanSettings>) => void;
}

export default function PlanCanvasOverlay({
  state, onChange, ctxMenu, onCloseCtxMenu, lpIndicator, onSettingChange,
}: Props) {
  const { points, segments, diagonals, isClosed, settings } = state;
  const { zoom } = settings;
  const isMobile = window.innerWidth < 768;
  const [fnOpen, setFnOpen] = React.useState(false);
  const fnRef = React.useRef<HTMLDivElement>(null);

  // Закрываем меню при клике вне
  React.useEffect(() => {
    if (!fnOpen) return;
    const handler = (e: MouseEvent) => {
      if (fnRef.current && !fnRef.current.contains(e.target as Node)) setFnOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [fnOpen]);

  return (
    <>
      {/* Long-press индикатор — анимированный круг */}
      {lpIndicator && (
        <div
          className="pointer-events-none absolute z-30"
          style={{ left: lpIndicator.x, top: lpIndicator.y, transform: "translate(-50%,-50%)" }}
        >
          <div className="w-12 h-12 rounded-full border-2 border-violet-400/70 animate-ping" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-violet-500/40" />
          </div>
        </div>
      )}

      {/* Контекстное меню */}
      {ctxMenu && (
        <div className="fixed z-50 bg-[#1a1b2e] border border-white/[0.12] rounded-xl shadow-2xl py-1 min-w-[180px]"
          style={{
            left: Math.min(ctxMenu.x, window.innerWidth - 196),
            top:  Math.min(ctxMenu.y, window.innerHeight - 180),
          }}
          onClick={onCloseCtxMenu}>
          {ctxMenu.type === "point" && (<>
            <CtxItem icon="Move" label="Переместить" onClick={() => onChange({ tool: "move", selectedPointId: ctxMenu.id })} />
            <div className="h-px bg-white/[0.08] my-1" />
            <CtxItem icon="Trash2" label="Удалить точку" danger onClick={() => {
              const newPts = points.filter(p => p.id !== ctxMenu.id);
              const newSegs = segments.filter(s => s.fromId !== ctxMenu.id && s.toId !== ctxMenu.id);
              onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals, state.baseScale ?? null) : [], isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
            }} />
          </>)}
          {ctxMenu.type === "segment" && (<>
            <CtxItem icon="MapPin" label="Добавить точку" onClick={() => {
              const seg = segments.find(s => s.id === ctxMenu.id);
              if (!seg) return;
              const fromPt = points.find(p => p.id === seg.fromId);
              const toPt   = points.find(p => p.id === seg.toId);
              if (!fromPt || !toPt) return;
              const mid = midPoint(fromPt, toPt);
              const newPt = { id: genId("p"), x: mid.x, y: mid.y };
              // Вставляем новую точку между fromId и toId
              const ptIdx = points.findIndex(p => p.id === seg.toId);
              const newPoints = [...points.slice(0, ptIdx), newPt, ...points.slice(ptIdx)];
              // Заменяем отрезок A→B на A→newPt и newPt→B
              const newSeg1 = { ...seg, id: genId("s"), toId: newPt.id, lengthCm: null, arcRadius: 0 };
              const newSeg2 = { ...seg, id: genId("s"), fromId: newPt.id, lengthCm: null, arcRadius: 0 };
              const newSegs = segments.map(s => s.id === ctxMenu.id ? newSeg1 : s);
              newSegs.splice(newSegs.findIndex(s => s.id === newSeg1.id) + 1, 0, newSeg2);
              const newDiags = buildAutoDiagonals(newPoints, diagonals, state.baseScale ?? null);
              onChange({ points: newPoints, segments: newSegs, diagonals: newDiags, selectedSegmentId: null });
            }} />
            <CtxItem icon="Spline" label="Добавить дугу" onClick={() => {
              const seg = segments.find(s => s.id === ctxMenu.id);
              if (seg) onChange({ segments: segments.map(s => s.id === ctxMenu.id ? { ...s, arcRadius: Math.max(20, s.arcRadius + 20) } : s) });
            }} />
            <CtxItem icon="Eye" label="Скрыть длину" onClick={() => onChange({ segments: segments.map(s => s.id === ctxMenu.id ? { ...s, showLength: !s.showLength } : s) })} />
            <div className="h-px bg-white/[0.08] my-1" />
            <CtxItem icon="Trash2" label="Удалить отрезок" danger onClick={() => onChange({ segments: segments.filter(s => s.id !== ctxMenu.id), isClosed: false })} />
          </>)}
          {ctxMenu.type === "diagonal" && (<>
            <CtxItem icon="Eye" label="Скрыть длину" onClick={() => onChange({ diagonals: diagonals.map(d => d.id === ctxMenu.id ? { ...d, showLength: !d.showLength } : d) })} />
            <div className="h-px bg-white/[0.08] my-1" />
            <CtxItem icon="Trash2" label="Удалить" danger onClick={() => onChange({ diagonals: diagonals.filter(d => d.id !== ctxMenu.id) })} />
          </>)}
        </div>
      )}

      {/* Мини zoom — только на десктопе */}
      {!isMobile && (
        <div className="absolute bottom-4 right-3 flex flex-col gap-1">
          <button onClick={() => onChange({ settings: { ...settings, zoom: Math.min(4, Math.round((zoom + 0.2) * 10) / 10) } })}
            className="w-9 h-9 rounded-xl bg-white/[0.07] border border-white/[0.1] text-white/50 hover:bg-white/[0.14] flex items-center justify-center transition active:scale-95">
            <Icon name="Plus" size={15} />
          </button>
          <div className="w-9 h-6 flex items-center justify-center text-[10px] text-white/30 font-mono">{Math.round(zoom * 100)}%</div>
          <button onClick={() => onChange({ settings: { ...settings, zoom: Math.max(0.3, Math.round((zoom - 0.2) * 10) / 10) } })}
            className="w-9 h-9 rounded-xl bg-white/[0.07] border border-white/[0.1] text-white/50 hover:bg-white/[0.14] flex items-center justify-center transition active:scale-95">
            <Icon name="Minus" size={15} />
          </button>
        </div>
      )}

      {/* Мобиле: кнопка функций в нижнем левом углу */}
      {isMobile && onSettingChange && (
        <div ref={fnRef} className="absolute bottom-4 left-3 z-20">
          {/* Меню открывается вверх */}
          {fnOpen && (
            <div className="absolute bottom-12 left-0 bg-[#1c1c1c] border border-white/[0.12] rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 min-w-[200px]">
              <div className="px-2 pt-1 pb-0.5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Рисование</p>
              </div>
              {[
                { key: "ortho",         label: "Ортогональный",  icon: "Axis3d"    },
                { key: "snapToPoints",  label: "Магнит к точкам", icon: "Magnet"   },
              ].map(({ key, label, icon }) => (
                <button key={key}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left w-full ${
                    settings[key as keyof typeof settings]
                      ? "bg-white text-[#111]"
                      : "text-white/60 hover:bg-white/[0.07] hover:text-white"
                  }`}
                  onClick={() => onSettingChange({ [key]: !settings[key as keyof typeof settings] })}>
                  <Icon name={icon} size={13} />
                  <span className="flex-1">{label}</span>
                  {settings[key as keyof typeof settings] && <Icon name="Check" size={11} />}
                </button>
              ))}
              <div className="px-2 pt-2 pb-0.5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Отображение</p>
              </div>
              {[
                { key: "showGrid",          label: "Сетка",        icon: "Grid3x3"     },
                { key: "showPoints",        label: "Точки",        icon: "CircleDot"   },
                { key: "showSegmentLabels", label: "Подписи A-B",  icon: "Type"        },
              ].map(({ key, label, icon }) => (
                <button key={key}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left w-full ${
                    settings[key as keyof typeof settings]
                      ? "bg-white text-[#111]"
                      : "text-white/60 hover:bg-white/[0.07] hover:text-white"
                  }`}
                  onClick={() => onSettingChange({ [key]: !settings[key as keyof typeof settings] })}>
                  <Icon name={icon} size={13} />
                  <span className="flex-1">{label}</span>
                  {settings[key as keyof typeof settings] && <Icon name="Check" size={11} />}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setFnOpen(v => !v)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
              fnOpen
                ? "bg-white/[0.12] border-white/[0.2] text-white"
                : "bg-white/[0.06] border-white/[0.1] text-white/50"
            }`}>
            <Icon name="SlidersHorizontal" size={16} />
          </button>
        </div>
      )}
    </>
  );
}