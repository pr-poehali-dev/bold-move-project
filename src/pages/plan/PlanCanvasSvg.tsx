import React from "react";
import type { PlanState } from "./planTypes";
import { calcScale, buildShapePath, findSelfIntersections } from "./planTypes";
import {
  renderDimLine, renderSegmentLabel, renderAngleLabel, renderCornerArc, renderCustomDimLine,
  renderPoints, renderDiagonals, renderSegments, renderGhost, renderHints,
  InlineDimLabels,
} from "./PlanCanvasRenderers";
import { SegmentItemsBadges } from "./PlanCanvasLabelRenderers";
import type { RenderContext, SegmentHandlers } from "./PlanCanvasRenderers";

interface Props {
  svgRef: React.RefObject<SVGSVGElement>;
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  cursor: string;
  ghost: { x: number; y: number; willClose: boolean } | null;
  dimLineFrom: string | null;
  isPanning: React.MutableRefObject<boolean>;
  handlers: SegmentHandlers;
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseUp: () => void;
  onCanvasClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  onTouchStart: (e: React.TouchEvent<SVGSVGElement>) => void;
  onTouchMove: (e: React.TouchEvent<SVGSVGElement>) => void;
  onTouchEnd: (e: React.TouchEvent<SVGSVGElement>) => void;
  onDimLineClick: (e: React.MouseEvent, dlId: string) => void;
  deleteHover?: { x: number; y: number; type: "point" | "segment" } | null;
  onEditFloorItem?: (id: string) => void;
}

export default function PlanCanvasSvg({
  svgRef, state, onChange, cursor, ghost, dimLineFrom,
  handlers, onMouseMove, onMouseDown, onMouseUp,
  onCanvasClick, onTouchStart, onTouchMove, onTouchEnd,
  onDimLineClick, deleteHover, onEditFloorItem,
}: Props) {
  const {
    points, segments, diagonals, dimLines,
    isClosed, settings,
    selectedPointId, selectedSegmentId, selectedSegmentIds, selectedDiagonalId, selectedArcId, selectedDimLineId,
    tool, phase, floorItems,
  } = state;

  // Центр масс полигона (для размещения floorItems)
  const polyCx = points.length > 0 ? points.reduce((s, p) => s + p.x, 0) / points.length : 0;
  const polyCy = points.length > 0 ? points.reduce((s, p) => s + p.y, 0) / points.length : 0;

  const {
    showGrid, gridSize, zoom, panX, panY,
    showSegmentLabels, showAngleLabels, showDiagonals, showDimLines, showPoints, showPointLabels,
  } = settings;

  const scale = calcScale(points, segments);
  const shapePath = buildShapePath(points, segments, isClosed);
  const intersectingSegIds = isClosed ? findSelfIntersections(points, segments) : [];

  const ctx: RenderContext = {
    points, segments, diagonals, dimLines, scale, isClosed, tool,
    showDimLines, showSegmentLabels, showAngleLabels, showDiagonals, showPoints, showPointLabels,
    selectedPointId, selectedSegmentId, selectedSegmentIds, selectedDiagonalId, selectedArcId, selectedDimLineId,
    ghost, dimLineFrom, zoom, phase, intersectingSegIds,
    changedSegmentIds: state.isBuilt ? (state.changedSegmentIds ?? []) : [],
  };

  return (
    <svg
      ref={svgRef}
      width="100%" height="100%"
      style={{ cursor, userSelect: "none", touchAction: "none" }}
      onClick={onCanvasClick}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onContextMenu={e => e.preventDefault()}
    >
      <defs>
        {showGrid && (
          <pattern id="plan-grid" width={gridSize * zoom} height={gridSize * zoom} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={0.8} fill="rgba(255,255,255,0.07)" />
          </pattern>
        )}
      </defs>

      {/* Фон */}
      <rect className="canvas-bg" width="100%" height="100%" fill={showGrid ? "url(#plan-grid)" : "transparent"} />

      {/* Группа с pan+zoom */}
      <g transform={`translate(${panX * zoom},${panY * zoom}) scale(${zoom})`}>

        {/* Заливка */}
        {isClosed && points.length >= 3 && (
          <path d={shapePath} fill="rgba(139,92,246,0.07)" stroke="none" className="pointer-events-none" />
        )}

        {/* Контур */}
        {points.length >= 2 && (
          <path d={shapePath} fill="none" stroke={isClosed ? "#a78bfa" : "#6366f1"} strokeWidth={2} strokeLinejoin="round" className="pointer-events-none" />
        )}

        {/* Отрезки — широкая зона для клика/тача */}
        {renderSegments(ctx, handlers)}

        {/* Размерные линии */}
        {segments.map(seg => renderDimLine(seg, ctx))}
        {/* Подписи */}
        {segments.map(seg => renderSegmentLabel(seg, ctx))}
        {/* Пользовательские размерные линии */}
        {dimLines.map(dl => renderCustomDimLine(dl, ctx, onDimLineClick))}

        {/* Диагонали */}
        {renderDiagonals(ctx, handlers)}

        {/* Дуги скруглений */}
        {isClosed && segments.map(seg => {
          const idx = points.findIndex(p => p.id === seg.toId);
          if (idx < 0 || seg.arcRadius <= 0) return null;
          return renderCornerArc(points[idx], idx, seg.arcRadius, ctx);
        })}

        {/* Метки углов */}
        {isClosed && points.map((pt, idx) => renderAngleLabel(pt, idx, ctx))}

        {/* Ghost */}
        {renderGhost(ctx)}

        {/* Inline-edit размеров на чертеже */}
        {points.length >= 2 && (
          <InlineDimLabels state={state} onChange={onChange} />
        )}

        {/* Товары на стенах */}
        {isClosed && segments.map(seg => (
          <SegmentItemsBadges
            key={seg.id}
            seg={seg}
            ctx={ctx}
            allSegments={segments}
            onRemoveItem={(segId, priceId) => {
              const newSegs = segments.map(s => {
                if (s.id !== segId) return s;
                return { ...s, items: (s.items ?? []).filter(it => it.priceId !== priceId) };
              });
              onChange({ segments: newSegs });
            }}
            onUpdateQuantity={(segId, priceId, quantity) => {
              const newSegs = segments.map(s => {
                if (s.id !== segId) return s;
                return { ...s, items: (s.items ?? []).map(it => it.priceId === priceId ? { ...it, quantity } : it) };
              });
              onChange({ segments: newSegs });
            }}
          />
        ))}

        {/* Товары на полотне (floorItems) */}
        {isClosed && (floorItems ?? []).map((fi, idx) => {
          const FH = 24, FY_STEP = 30;
          const IMG_W = fi.imageUrl ? 23 : 0;
          const qtyStr = `${fi.quantity} ${fi.unit}`;
          // Динамическая ширина: символы × ~5.5px + отступы
          const nameW = fi.name.length * 5.5;
          const qtyW  = qtyStr.length * 5.5;
          const FW = Math.max(120, IMG_W + 8 + nameW + 6 + qtyW + 24 + 8);
          const fx = polyCx;
          const fy = polyCy - ((floorItems.length - 1) * FY_STEP) / 2 + idx * FY_STEP;
          const nameX = fx - FW / 2 + IMG_W + 8;
          const qtyX  = fx + FW / 2 - 24;
          return (
            <g key={fi.id}>
              {/* Фон бейджа */}
              <rect x={fx - FW / 2} y={fy - FH / 2} width={FW} height={FH} rx={8}
                fill="rgba(17,12,36,0.92)" stroke="rgba(124,58,237,0.35)" strokeWidth={1}
                style={{ pointerEvents: "none" }}
              />
              {/* Кликабельная область (всё кроме крестика) */}
              <rect x={fx - FW / 2} y={fy - FH / 2} width={FW - 20} height={FH} rx={8}
                fill="transparent" stroke="none"
                style={{ cursor: "pointer" }}
                onClick={e => { e.stopPropagation(); onEditFloorItem?.(fi.id); }}
              />
              {fi.imageUrl && (
                <image href={fi.imageUrl} x={fx - FW / 2 + 5} y={fy - 9} width={18} height={18}
                  preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none" }} />
              )}
              <text x={nameX} y={fy + 4}
                fontSize={9} fill="rgba(196,181,253,0.85)"
                fontFamily="system-ui, sans-serif" fontWeight={500}
                className="pointer-events-none select-none">
                {fi.name}
              </text>
              {/* Кол-во + единица */}
              <text x={qtyX} y={fy + 4} textAnchor="middle"
                fontSize={8.5} fontWeight={700} fill="rgba(167,139,250,0.9)"
                fontFamily="monospace" className="pointer-events-none select-none">
                {qtyStr}
              </text>
              {/* Крестик */}
              <g style={{ cursor: "pointer" }}
                onClick={e => {
                  e.stopPropagation();
                  onChange({ floorItems: (floorItems ?? []).filter(f => f.id !== fi.id) });
                }}>
                <circle cx={fx + FW / 2 - 7} cy={fy} r={8}
                  fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.45)" strokeWidth={0.8} />
                <line x1={fx + FW / 2 - 10} y1={fy - 3} x2={fx + FW / 2 - 4} y2={fy + 3}
                  stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} strokeLinecap="round" />
                <line x1={fx + FW / 2 - 4} y1={fy - 3} x2={fx + FW / 2 - 10} y2={fy + 3}
                  stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} strokeLinecap="round" />
              </g>
            </g>
          );
        })}

        {/* Точки */}
        {renderPoints(ctx, handlers)}

        {/* Подсказки */}
        {renderHints(ctx)}

        {/* Крестик-цель при инструменте delete */}
        {deleteHover && (
          <g className="pointer-events-none">
            <circle cx={deleteHover.x} cy={deleteHover.y} r={deleteHover.type === "point" ? 14 : 10}
              fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.7)" strokeWidth={1.5} />
            <line x1={deleteHover.x - 6} y1={deleteHover.y - 6} x2={deleteHover.x + 6} y2={deleteHover.y + 6}
              stroke="rgba(239,68,68,0.9)" strokeWidth={2} strokeLinecap="round" />
            <line x1={deleteHover.x + 6} y1={deleteHover.y - 6} x2={deleteHover.x - 6} y2={deleteHover.y + 6}
              stroke="rgba(239,68,68,0.9)" strokeWidth={2} strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  );
}