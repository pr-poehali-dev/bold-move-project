import type { PlanState } from "./planTypes";
import { buildAutoDiagonals } from "./planTypes";
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
}

export default function PlanCanvasOverlay({
  state, onChange, ctxMenu, onCloseCtxMenu, lpIndicator,
}: Props) {
  const { points, segments, diagonals, isClosed, settings } = state;
  const { zoom } = settings;

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
              onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [], isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
            }} />
          </>)}
          {ctxMenu.type === "segment" && (<>
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

      {/* Мини zoom */}
      <div className="absolute bottom-8 right-3 flex flex-col gap-1">
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
    </>
  );
}
