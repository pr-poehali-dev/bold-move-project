import React, { useState, useRef, useCallback, useMemo } from "react";
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
  onCanvasDblClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  deleteHover?: { x: number; y: number; type: "point" | "segment" } | null;
  onEditFloorItem?: (id: string) => void;
  onEditSegItem?: (segId: string, priceId: number) => void;
  editingSegId?: string | null;
  onSetEditingSegId?: (id: string | null) => void;
}

export default function PlanCanvasSvg({
  svgRef, state, onChange, cursor, ghost, dimLineFrom,
  handlers, onMouseMove, onMouseDown, onMouseUp,
  onCanvasClick, onCanvasDblClick, onTouchStart, onTouchMove, onTouchEnd,
  onDimLineClick, deleteHover, onEditFloorItem, onEditSegItem, editingSegId, onSetEditingSegId,
}: Props) {
  const {
    points, segments, diagonals, dimLines,
    isClosed, settings,
    selectedPointId, selectedSegmentId, selectedSegmentIds, selectedDiagonalId, selectedArcId, selectedDimLineId,
    tool, phase, floorItems,
  } = state;

  // Центр bounding box полигона (для размещения floorItems — точнее чем среднее арифметическое)
  const polyCx = points.length > 0 ? (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2 : 0;
  const polyCy = points.length > 0 ? (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2 : 0;

  // AABB внутреннего пространства полигона (для масштабирования floorItems)
  const polyBBox = useMemo(() => {
    if (points.length < 3) return null;
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  }, [points]);

  // Tooltip для иконок товаров
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; name: string; qty: number; unit: string } | null>(null);
  // Двойной клик для удаления иконки товара
  const lastBadgeTapRef = useRef<{ key: string; t: number }>({ key: "", t: 0 });

  // Подсказка "двойной клик — выбрать все стены" — показывается один раз
  const HINT_KEY = "plan_dblclick_hint_shown";
  const [showDblHint, setShowDblHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePolygonEnter = useCallback(() => {
    if (localStorage.getItem(HINT_KEY)) return;
    localStorage.setItem(HINT_KEY, "1");
    setShowDblHint(true);
    hintTimerRef.current = setTimeout(() => setShowDblHint(false), 2500);
  }, []);

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
    <>
    {showDblHint && (
      <div style={{
        position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
        background: "rgba(17,12,36,0.92)", border: "1px solid rgba(124,58,237,0.5)",
        color: "#c4b5fd", fontSize: 13, padding: "7px 14px", borderRadius: 10,
        pointerEvents: "none", zIndex: 50, whiteSpace: "nowrap",
        animation: "fadeInUp 0.25s ease",
      }}>
        Двойной клик — выбрать все стены
      </div>
    )}
    <svg
      ref={svgRef}
      width="100%" height="100%"
      style={{ cursor, userSelect: "none", touchAction: "none" }}
      onClick={onCanvasClick}
      onDoubleClick={onCanvasDblClick}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onContextMenu={e => e.preventDefault()}
    >
      <defs>
        {showGrid && (
          <pattern id="plan-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse"
            patternTransform={`translate(${panX * zoom},${panY * zoom}) scale(${zoom})`}>
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

        {/* Зона двойного клика внутри полигона — меняет курсор, намекая на "выбрать все" */}
        {isClosed && points.length >= 3 && tool !== "draw" && (
          <path d={shapePath} fill="transparent" stroke="none" style={{ cursor: "cell", pointerEvents: "fill" }} onMouseEnter={handlePolygonEnter} />
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
          <InlineDimLabels state={state} onChange={onChange} editingSegId={editingSegId} onSetEditingSegId={onSetEditingSegId} svgRef={svgRef} />
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
            onMoveItemToSeg={(fromSegId, priceId, toSegId) => {
              if (fromSegId === toSegId) return;
              const fromSeg = segments.find(s => s.id === fromSegId);
              const item = fromSeg?.items?.find(it => it.priceId === priceId);
              if (!item) return;
              const toSeg = segments.find(s => s.id === toSegId);
              const meters = toSeg?.lengthCm ? Math.round(toSeg.lengthCm / 100 * 100) / 100 : item.quantity ?? 1;
              const newSegs = segments.map(s => {
                if (s.id === fromSegId) return { ...s, items: (s.items ?? []).filter(it => it.priceId !== priceId) };
                if (s.id === toSegId) {
                  const existing = s.items ?? [];
                  if (existing.some(it => it.priceId === priceId)) {
                    return { ...s, items: existing.map(it => it.priceId === priceId ? { ...it, quantity: (it.quantity ?? 1) + meters } : it) };
                  }
                  return { ...s, items: [...existing, { ...item, quantity: meters }] };
                }
                return s;
              });
              onChange({ segments: newSegs });
            }}
            onEditSegItem={onEditSegItem}
          />
        ))}

        {/* Товары на полотне (floorItems) — монтаж, раскрой и огарпунивание не показываем */}
        {isClosed && polyBBox && (() => {
          const visibleItems = (floorItems ?? []).filter(fi =>
            fi.category !== "Монтаж" &&
            fi.name !== "Раскрой ПВХ" &&
            fi.name !== "Огарпунивание ПВХ"
          );
          if (visibleItems.length === 0) return null;

          // Иконки: S×S квадрат, выровнены по сетке внутри полигона
          const S = Math.min(32, Math.max(20, (polyBBox.w * 0.12)));
          const GAP = S * 0.3;
          const cols = Math.max(1, Math.floor((polyBBox.w * 0.7) / (S + GAP)));
          const rows = Math.ceil(visibleItems.length / cols);
          const gridW = cols * (S + GAP) - GAP;
          const gridH = rows * (S + GAP) - GAP;
          const startX = polyCx - gridW / 2 + S / 2;
          const startY = polyCy - gridH / 2 + S / 2;

          return visibleItems.map((fi, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const fx = startX + col * (S + GAP);
            const fy = startY + row * (S + GAP);
            const itemKey = `floor-${fi.id}`;

            return (
              <g key={fi.id}
                style={{ cursor: "pointer" }}
                onClick={e => { e.stopPropagation(); onEditFloorItem?.(fi.id); }}
                onDoubleClick={e => { e.stopPropagation(); onChange({ floorItems: (floorItems ?? []).filter(f => f.id !== fi.id) }); }}
                onMouseEnter={() => setHoverTooltip({ x: fx, y: fy - S / 2 - 4, name: fi.name, qty: fi.quantity, unit: fi.unit })}
                onMouseLeave={() => setHoverTooltip(null)}
              >
                {/* Фон иконки */}
                <rect x={fx - S / 2} y={fy - S / 2} width={S} height={S} rx={S * 0.22}
                  fill="rgba(17,12,36,0.92)" stroke="rgba(124,58,237,0.5)" strokeWidth={1.2}
                />
                {/* Изображение */}
                {fi.imageUrl ? (
                  <image href={fi.imageUrl} x={fx - S / 2 + 2} y={fy - S / 2 + 2}
                    width={S - 4} height={S - 4}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ pointerEvents: "none" }}
                  />
                ) : (
                  <text x={fx} y={fy + 1} textAnchor="middle" dominantBaseline="middle"
                    fontSize={S * 0.4} fontWeight={700} fill="rgba(196,181,253,0.9)"
                    fontFamily="system-ui" className="pointer-events-none select-none">
                    {fi.name.charAt(0).toUpperCase()}
                  </text>
                )}
                {/* Количество — маленький бейдж снизу */}
                <rect x={fx - S / 2} y={fy + S / 2 - 9} width={S} height={9} rx={3}
                  fill="rgba(124,58,237,0.75)" className="pointer-events-none" />
                <text x={fx} y={fy + S / 2 - 4} textAnchor="middle" dominantBaseline="middle"
                  fontSize={6.5} fontWeight={700} fill="#e9d5ff"
                  fontFamily="monospace" className="pointer-events-none select-none">
                  {fi.quantity} {fi.unit}
                </text>
                {/* Метка двойного клика — крестик при hover */}
                <title>{fi.name} — {fi.quantity} {fi.unit} · двойной клик = удалить</title>
              </g>
            );
          });
        })()}

        {/* Tooltip для floorItem иконок */}
        {hoverTooltip && (
          <g className="pointer-events-none">
            <rect
              x={hoverTooltip.x - 60} y={hoverTooltip.y - 28}
              width={120} height={22} rx={6}
              fill="rgba(17,12,36,0.97)" stroke="rgba(124,58,237,0.5)" strokeWidth={1}
            />
            <text x={hoverTooltip.x} y={hoverTooltip.y - 14}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fill="#e9d5ff" fontFamily="system-ui" fontWeight={600}>
              {hoverTooltip.name} · {hoverTooltip.qty} {hoverTooltip.unit}
            </text>
          </g>
        )}

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
    </>
  );
}