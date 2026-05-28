import React from "react";
import type { PlanState, PlanSettings } from "./planTypes";
import { buildAutoDiagonals, genId, midPoint, distPx } from "./planTypes";
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
  onOpenCatalog?: () => void;
  onEditSegmentLength?: (segId: string) => void;
}

export default function PlanCanvasOverlay({
  state, onChange, ctxMenu, onCloseCtxMenu, lpIndicator, onSettingChange, onOpenCatalog, onEditSegmentLength,
}: Props) {
  const { points, segments, diagonals, isClosed, settings } = state;
  const { zoom } = settings;
  const isMobile = window.innerWidth < 768;

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
        <>
          {/* Прозрачная подложка — закрывает меню при тапе мимо */}
          <div
            className="fixed inset-0 z-40"
            onPointerDown={onCloseCtxMenu}
            onTouchStart={onCloseCtxMenu}
          />
        <div className="fixed z-50 bg-[#1a1b2e] border border-white/[0.12] rounded-xl shadow-2xl py-1 min-w-[180px]"
          style={{
            left: Math.min(ctxMenu.x, window.innerWidth - 196),
            top:  Math.min(ctxMenu.y, window.innerHeight - 180),
          }}
          onPointerDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
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
            <CtxItem icon="Pencil" label="Редактировать длину" onClick={() => onEditSegmentLength?.(ctxMenu.id)} />
            <div className="h-px bg-white/[0.08] my-1" />
            <CtxItem icon="MapPin" label="Добавить точку" onClick={() => {
              const seg = segments.find(s => s.id === ctxMenu.id);
              if (!seg) return;
              const fromPt = points.find(p => p.id === seg.fromId);
              const toPt   = points.find(p => p.id === seg.toId);
              if (!fromPt || !toPt) return;
              const mid = midPoint(fromPt, toPt);
              const newPt = { id: genId("p"), x: mid.x, y: mid.y };
              const ptIdx = points.findIndex(p => p.id === seg.toId);
              const newPoints = [...points.slice(0, ptIdx), newPt, ...points.slice(ptIdx)];
              const totalPx = distPx(fromPt, toPt);
              const px1 = distPx(fromPt, newPt);
              const px2 = distPx(newPt, toPt);
              const ratio1 = totalPx > 0 ? px1 / totalPx : 0.5;
              const ratio2 = totalPx > 0 ? px2 / totalPx : 0.5;
              const len1 = seg.lengthCm != null ? Math.round(seg.lengthCm * ratio1 * 10) / 10 : null;
              const len2 = seg.lengthCm != null ? Math.round(seg.lengthCm * ratio2 * 10) / 10 : null;
              const newSeg1 = { ...seg, id: genId("s"), toId: newPt.id, lengthCm: len1, arcRadius: 0 };
              const newSeg2 = { ...seg, id: genId("s"), fromId: newPt.id, lengthCm: len2, arcRadius: 0 };
              const newSegs = segments.map(s => s.id === ctxMenu.id ? newSeg1 : s);
              newSegs.splice(newSegs.findIndex(s => s.id === newSeg1.id) + 1, 0, newSeg2);
              const newDiags = buildAutoDiagonals(newPoints, diagonals, state.baseScale ?? null);
              onChange({ points: newPoints, segments: newSegs, diagonals: newDiags, selectedSegmentId: null });
            }} />
            <CtxItem icon="Spline" label="Добавить дугу" onClick={() => {
              const seg = segments.find(s => s.id === ctxMenu.id);
              if (seg) onChange({ segments: segments.map(s => s.id === ctxMenu.id ? { ...s, arcRadius: Math.max(20, s.arcRadius + 20) } : s) });
            }} />
            <div className="h-px bg-white/[0.08] my-1" />
            <CtxItem icon="Trash2" label="Удалить отрезок" danger onClick={() => onChange({ segments: segments.filter(s => s.id !== ctxMenu.id), isClosed: false })} />
          </>)}
          {ctxMenu.type === "diagonal" && (<>
            <CtxItem icon="Trash2" label="Удалить" danger onClick={() => onChange({ diagonals: diagonals.filter(d => d.id !== ctxMenu.id) })} />
          </>)}
        </div>
        </>
      )}

      {/* Зум и каталог перенесены в MobileBottomBar */}
    </>
  );
}