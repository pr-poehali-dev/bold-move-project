import React, { useState, useRef, useCallback, useMemo } from "react";
import type { PlanState } from "./planTypes";
import { calcScale, buildShapePath, findSelfIntersections } from "./planTypes";
import {
  renderDimLine, renderSegmentLabel, renderAngleLabel, renderCornerArc, renderCustomDimLine,
  renderPoints, renderDiagonals, renderSegments, renderGhost, renderHints,
  InlineDimLabels,
} from "./PlanCanvasRenderers";
import type { RenderContext, SegmentHandlers } from "./PlanCanvasRenderers";
import { findNearestSegment } from "./PlanCanvasUtils";
import PlanCanvasFloorItems from "./PlanCanvasFloorItems";
import PlanCanvasWallItems from "./PlanCanvasWallItems";
import { MovePendingBanner } from "./PlanCanvasMovePending";

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
  didMoveRef?: React.MutableRefObject<boolean>;
  longPressRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  longPressPos?: React.MutableRefObject<{ clientX: number; clientY: number; type: string; id: string } | null>;
  setCtxMenu?: (v: null) => void;
  isDraggingWallItem?: boolean;
  /** Линия-след "покраски" выделения стен (ПК, зажатая кнопка мыши) — SVG-координаты */
  lassoPath?: { x: number; y: number }[] | null;
  /** Стены, где назначен товар — на который сейчас навели курсор в списке/баре */
  highlightSegIds?: string[];
}

export default function PlanCanvasSvg({
  svgRef, state, onChange, cursor, ghost, dimLineFrom,
  handlers, onMouseMove, onMouseDown, onMouseUp,
  onCanvasClick, onCanvasDblClick, onTouchStart, onTouchMove, onTouchEnd,
  onDimLineClick, deleteHover, onEditFloorItem, onEditSegItem, editingSegId, onSetEditingSegId,
  didMoveRef, longPressRef, longPressPos, setCtxMenu, isDraggingWallItem, lassoPath, highlightSegIds,
}: Props) {
  const {
    points, segments, diagonals, dimLines,
    isClosed, settings,
    selectedPointId, selectedSegmentId, selectedSegmentIds, selectedDiagonalId, selectedArcId, selectedDimLineId,
    tool, phase, floorItems,
  } = state;

  // Истинный центроид полигона (формула Шоэлейса) — всегда внутри для выпуклых,
  // для вогнутых (Г, П, L-форм) дополнительно проверяем что точка внутри
  const { polyCx, polyCy } = useMemo(() => {
    if (points.length < 3) return { polyCx: 0, polyCy: 0 };

    // 1. Считаем центроид по формуле площади
    let area = 0, cx = 0, cy = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cross = points[i].x * points[j].y - points[j].x * points[i].y;
      area += cross;
      cx += (points[i].x + points[j].x) * cross;
      cy += (points[i].y + points[j].y) * cross;
    }
    area /= 2;
    const absArea = Math.abs(area);
    if (absArea < 1) return {
      polyCx: (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2,
      polyCy: (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2,
    };
    cx /= (6 * area);
    cy /= (6 * area);

    // 2. Проверяем что центроид внутри полигона (ray casting)
    const isInside = (px: number, py: number) => {
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;
        if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
          inside = !inside;
      }
      return inside;
    };

    // 3. Всегда ищем pole of inaccessibility — точку максимально удалённую от всех рёбер.
    // Это работает как для выпуклых, так и для вогнутых (Г, П, L) полигонов.
    // Для прямоугольника даст геометрический центр, для Г-формы — центр широкой части.
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    // Вспомогательная: расстояние от точки до отрезка
    const ptToSegDist2 = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-10) return Math.hypot(px - ax, py - ay);
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
      return Math.hypot(px - ax - t * dx, py - ay - t * dy);
    };

    // Функция: минимальное расстояние от точки до всех рёбер полигона
    const minDistToEdges = (px: number, py: number) => {
      let d = Infinity;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const v = ptToSegDist2(px, py, points[i].x, points[i].y, points[j].x, points[j].y);
        if (v < d) d = v;
      }
      return d;
    };

    // Скоринг: minDist до рёбер — главный критерий (вписанная окружность).
    // При равных minDist выбираем точку ближе к математическому центроиду полигона
    // (центроид тяготеет к более тяжёлой/большой части фигуры).
    const bboxDiag = Math.hypot(maxX - minX, maxY - minY) || 1;
    const score = (px: number, py: number) => {
      const d = minDistToEdges(px, py);
      // Нормализованная близость к центроиду [0..1], вес 0.01 — лёгкий тай-брейкер
      const distToCentroid = Math.hypot(px - cx, py - cy) / bboxDiag;
      return d - distToCentroid * 0.01 * d;
    };

    // Шаг 1: грубая сетка 32×32
    const steps = 32;
    let bestX = cx, bestY = cy;
    let bestScore = isInside(cx, cy) ? score(cx, cy) : -1;

    for (let si = 1; si < steps; si++) {
      for (let sj = 1; sj < steps; sj++) {
        const tx = minX + (maxX - minX) * si / steps;
        const ty = minY + (maxY - minY) * sj / steps;
        if (!isInside(tx, ty)) continue;
        const s = score(tx, ty);
        if (s > bestScore) { bestScore = s; bestX = tx; bestY = ty; }
      }
    }

    // Шаг 2: уточнение вокруг лучшей точки (4 итерации bisection)
    let refineSz = (maxX - minX) / steps;
    for (let iter = 0; iter < 4; iter++) {
      const rx0 = bestX - refineSz, rx1 = bestX + refineSz;
      const ry0 = bestY - refineSz, ry1 = bestY + refineSz;
      const refineSteps = 16;
      for (let si = 0; si <= refineSteps; si++) {
        for (let sj = 0; sj <= refineSteps; sj++) {
          const tx = rx0 + (rx1 - rx0) * si / refineSteps;
          const ty = ry0 + (ry1 - ry0) * sj / refineSteps;
          if (!isInside(tx, ty)) continue;
          const s = score(tx, ty);
          if (s > bestScore) { bestScore = s; bestX = tx; bestY = ty; }
        }
      }
      refineSz /= 2;
    }

    return { polyCx: bestX, polyCy: bestY };
  }, [points]);

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

  // ── Режим перемещения/дублирования товара между стенами ──────────────────
  const [movePending, setMovePending] = useState<{ fromSegId: string; priceId: number; mode: "move" | "duplicate" } | null>(null);
  const movePendingRef = useRef(movePending);
  movePendingRef.current = movePending;

  const clientToSvgMove = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const { zoom: z, panX: px, panY: py } = state.settings;
    return { x: (clientX - rect.left) / z - px, y: (clientY - rect.top) / z - py };
  }, [svgRef, state.settings]);

  const executeMoveToSeg = useCallback((toSegId: string) => {
    const mp = movePendingRef.current;
    if (!mp || toSegId === mp.fromSegId) { setMovePending(null); return; }
    const { fromSegId, priceId, mode } = mp;
    setMovePending(null);
    const fromSeg = segments.find(s => s.id === fromSegId);
    const item = fromSeg?.items?.find(it => it.priceId === priceId);
    if (!item) return;
    const toSeg = segments.find(s => s.id === toSegId);
    const meters = toSeg?.lengthCm ? Math.round(toSeg.lengthCm / 100 * 100) / 100 : item.quantity ?? 1;
    const newSegs = segments.map(s => {
      // При дублировании исходная стена не трогается — товар остаётся на месте
      if (mode === "move" && s.id === fromSegId) return { ...s, items: (s.items ?? []).filter(it => it.priceId !== priceId) };
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
  }, [segments, onChange]);

  // Нативный перехват touchstart — гасим long-press в режиме movePending
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = () => {
      if (!movePendingRef.current) return;
      if (longPressRef?.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
      if (longPressPos) longPressPos.current = null;
    };
    svg.addEventListener("touchstart", handler, { capture: true, passive: true });
    return () => svg.removeEventListener("touchstart", handler, true);
  }, [svgRef, longPressRef, longPressPos]);

  // Нативный перехват touchend — выполняем перемещение товара
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: TouchEvent) => {
      if (!movePendingRef.current || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const svgPt = clientToSvgMove(t.clientX, t.clientY);
      const hit = findNearestSegment(svgPt.x, svgPt.y, points, segments, Math.max(40, 60 / state.settings.zoom));
      if (hit) {
        e.stopPropagation();
        e.preventDefault();
        if (longPressRef?.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
        if (longPressPos) longPressPos.current = null;
        if (setCtxMenu) setCtxMenu(null);
        if (didMoveRef) didMoveRef.current = true;
        executeMoveToSeg(hit.id);
      }
    };
    svg.addEventListener("touchend", handler, { capture: true });
    return () => svg.removeEventListener("touchend", handler, true);
  }, [svgRef, clientToSvgMove, points, segments, state.settings.zoom, executeMoveToSeg]);

  // ── Подсказка "двойной клик — выбрать все стены" ────────────────────────
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

  const moveTargetSegIds = movePending
    ? segments.filter(s => s.id !== movePending.fromSegId).map(s => s.id)
    : null;

  const ctx: RenderContext = {
    points, segments, diagonals, dimLines, scale, isClosed, tool,
    showDimLines, showSegmentLabels, showAngleLabels, showDiagonals, showPoints, showPointLabels,
    selectedPointId, selectedSegmentId,
    selectedSegmentIds: moveTargetSegIds ?? selectedSegmentIds,
    selectedDiagonalId, selectedArcId, selectedDimLineId,
    ghost, dimLineFrom, zoom, phase, intersectingSegIds,
    changedSegmentIds: state.isBuilt ? (state.changedSegmentIds ?? []) : [],
    isDraggingWallItem,
    highlightSegIds,
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

      {movePending && (
        <MovePendingBanner onCancel={() => setMovePending(null)} mode={movePending.mode} />
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
          {/* Размытие для линии-следа "покраски" — эффект мазка кистью */}
          <filter id="lasso-brush" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={Math.max(1.2, 3 / zoom)} />
          </filter>
        </defs>

        <rect className="canvas-bg" width="100%" height="100%" fill={showGrid ? "url(#plan-grid)" : "transparent"} />

        <g transform={`translate(${panX * zoom},${panY * zoom}) scale(${zoom})`}>

          {isClosed && points.length >= 3 && (
            <path d={shapePath} fill="rgba(139,92,246,0.07)" stroke="none" className="pointer-events-none" />
          )}

          {isClosed && points.length >= 3 && tool !== "draw" && (
            <path d={shapePath} fill="transparent" stroke="none" style={{ cursor: "cell", pointerEvents: "fill" }} onMouseEnter={handlePolygonEnter} />
          )}

          {points.length >= 2 && (
            <path d={shapePath} fill="none" stroke={isClosed ? "#a78bfa" : "#6366f1"} strokeWidth={2} strokeLinejoin="round" className="pointer-events-none" />
          )}

          {renderSegments(ctx, movePending ? {
            ...handlers,
            onSegmentClick: (e, toSegId) => {
              e.stopPropagation();
              executeMoveToSeg(toSegId);
            },
            onSegmentMouseDown: undefined, // при переносе товара между стенами drag-select выделения не нужен
          } : handlers)}

          {segments.map(seg => renderDimLine(seg, ctx))}
          {segments.map(seg => renderSegmentLabel(seg, ctx))}
          {dimLines.map(dl => renderCustomDimLine(dl, ctx, onDimLineClick))}

          {renderDiagonals(ctx, handlers)}

          {isClosed && segments.map(seg => {
            const idx = points.findIndex(p => p.id === seg.toId);
            if (idx < 0 || seg.arcRadius <= 0) return null;
            return renderCornerArc(points[idx], idx, seg.arcRadius, ctx);
          })}

          {isClosed && points.map((pt, idx) => renderAngleLabel(pt, idx, ctx))}

          {renderGhost(ctx)}

          {points.length >= 2 && (
            <InlineDimLabels state={state} onChange={onChange} editingSegId={editingSegId} onSetEditingSegId={onSetEditingSegId} svgRef={svgRef} />
          )}

          {isClosed && (
            <PlanCanvasWallItems
              segments={segments}
              ctx={ctx}
              onChange={onChange}
              onEditSegItem={onEditSegItem}
              onStartMove={(fromSegId, priceId) => setMovePending({ fromSegId, priceId, mode: "move" })}
              onStartDuplicate={(fromSegId, priceId) => setMovePending({ fromSegId, priceId, mode: "duplicate" })}
              selectedSegmentIds={state.selectedSegmentIds}
            />
          )}

          {isClosed && (
            <PlanCanvasFloorItems
              floorItems={floorItems}
              polyCx={polyCx}
              polyCy={polyCy}
              polyBBox={polyBBox}
              onChange={onChange}
              onEditFloorItem={onEditFloorItem}
            />
          )}

          {renderPoints(ctx, handlers)}
          {renderHints(ctx)}

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

          {/* Линия-след "покраски" выделения стен — синий размытый мазок кистью, повторяет движение мыши */}
          {lassoPath && lassoPath.length > 1 && (
            <g className="pointer-events-none">
              {/* Мягкое размытое свечение под мазком */}
              <polyline
                points={lassoPath.map(p => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={Math.max(5, 9 / zoom)}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.35}
                filter="url(#lasso-brush)"
              />
              {/* Основной мазок — плотнее по центру */}
              <polyline
                points={lassoPath.map(p => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#60a5fa"
                strokeWidth={Math.max(2.5, 4.5 / zoom)}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.65}
                filter="url(#lasso-brush)"
              />
            </g>
          )}
        </g>
      </svg>
    </>
  );
}