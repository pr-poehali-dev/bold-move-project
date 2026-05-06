import React, { useRef, useCallback, useEffect } from "react";
import type { PlanState, Point, Segment, DiagonalDef, DimLine } from "./planTypes";
import {
  pointLabel, segmentLabel, distPx, midPoint, segmentNormal,
  snapVal, snapToPoint, orthoPoint, buildAutoDiagonals, genId,
  pxToCm, calcScale, angleDeg, buildShapePath,
} from "./planTypes";
import Icon from "@/components/ui/icon";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

const PT_R = 6;
const SNAP_THR = 18;
const CLOSE_THR = 22;
const DIM_OFF = 28;

export default function PlanCanvas({ state, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ pointId: string; origX: number; origY: number } | null>(null);
  const panRef  = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);
  const isPanning = useRef(false);

  const {
    points, segments, diagonals, arcs, dimLines,
    isClosed, settings, tool, phase,
    selectedPointId, selectedSegmentId, selectedDiagonalId, selectedArcId, selectedDimLineId,
  } = state;

  const {
    ortho, snapToPoints: snapPts, showGrid, gridSize, zoom, panX, panY,
    showSegmentLabels, showAngleLabels, showDiagonals, showDimLines,
    showPoints, showPointLabels,
  } = settings;

  const scale = calcScale(points, segments);

  // ── Координаты мыши в пространстве чертежа ───────────────────────────────
  const getSvgXY = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom - panX,
      y: (e.clientY - rect.top)  / zoom - panY,
    };
  }, [zoom, panX, panY]);

  const applySnap = useCallback((rawX: number, rawY: number, excludeId: string | null = null) => {
    let x = snapVal(rawX, gridSize, showGrid);
    let y = snapVal(rawY, gridSize, showGrid);
    if (ortho && points.length > 0 && tool === "draw" && !isClosed) {
      const last = points[points.length - 1];
      const o = orthoPoint(last, x, y);
      x = o.x; y = o.y;
    }
    const snapped = snapToPoint(x, y, points, excludeId, SNAP_THR, snapPts);
    return { x: snapped.x, y: snapped.y, snapId: snapped.snapId };
  }, [gridSize, showGrid, ortho, points, tool, isClosed, snapPts]);

  // ── Ghost предпросмотр ────────────────────────────────────────────────────
  const [ghost, setGhost] = React.useState<{ x: number; y: number; willClose: boolean } | null>(null);

  // ── Контекстное меню (правый клик) ───────────────────────────────────────
  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number; type: "point" | "segment" | "diagonal" | "arc"; id: string } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Панорамирование (средняя кнопка или Space+drag)
    if (panRef.current) {
      const dx = (e.clientX - panRef.current.startX) / zoom;
      const dy = (e.clientY - panRef.current.startY) / zoom;
      onChange({ settings: { ...settings, panX: panRef.current.origPanX + dx, panY: panRef.current.origPanY + dy } });
      return;
    }

    if (tool === "draw" && phase === "draw" && !isClosed) {
      const raw = getSvgXY(e);
      const { x, y } = applySnap(raw.x, raw.y);
      const willClose = points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THR;
      setGhost({ x: willClose ? points[0].x : x, y: willClose ? points[0].y : y, willClose });
    } else {
      setGhost(null);
    }

    if (dragRef.current && tool === "move") {
      const raw = getSvgXY(e);
      const { x, y } = applySnap(raw.x, raw.y, dragRef.current.pointId);
      const newPts = points.map(p => p.id === dragRef.current!.pointId ? { ...p, x, y } : p);
      onChange({ points: newPts, diagonals: buildAutoDiagonals(newPts, diagonals) });
    }
  }, [tool, phase, isClosed, points, getSvgXY, applySnap, diagonals, onChange, settings, zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // средняя кнопка или Alt+левая = pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      panRef.current = { startX: e.clientX, startY: e.clientY, origPanX: panX, origPanY: panY };
      isPanning.current = true;
    }
  }, [panX, panY]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    panRef.current = null;
    isPanning.current = false;
  }, []);

  // ── Колёсико — zoom ───────────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.3, Math.min(4, Math.round((zoom + delta) * 10) / 10));
    onChange({ settings: { ...settings, zoom: newZoom } });
  }, [zoom, settings, onChange]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Клик на холст ────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning.current) return;
    setCtxMenu(null);
    const isCanvas = e.target === svgRef.current || (e.target as Element).classList.contains("canvas-bg");

    if (!isCanvas) {
      if (tool !== "draw") onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null, selectedArcId: null, selectedDimLineId: null });
      return;
    }

    if (tool === "draw" && phase === "draw" && !isClosed) {
      const raw = getSvgXY(e);
      const { x, y } = applySnap(raw.x, raw.y);

      if (points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THR) {
        const closing: Segment = { id: genId("s"), fromId: points[points.length - 1].id, toId: points[0].id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 };
        const newSegs = [...segments, closing];
        const newDiags = buildAutoDiagonals(points, diagonals);
        onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: newSegs[0]?.id ?? null });
        setGhost(null);
        return;
      }

      const np: Point = { id: genId("pt"), x, y };
      const newPts = [...points, np];
      const newSegs = [...segments];
      if (points.length > 0) {
        newSegs.push({ id: genId("s"), fromId: points[points.length - 1].id, toId: np.id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 });
      }
      onChange({ points: newPts, segments: newSegs });
    } else if (tool === "dimline" && isClosed) {
      // добавить размерную линию — клик на холст выбирает первую точку
    } else {
      onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null, selectedArcId: null, selectedDimLineId: null });
    }
  }, [tool, phase, isClosed, points, segments, diagonals, getSvgXY, applySnap, onChange]);

  // ── Правый клик — контекстное меню ───────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ── Клик на точку ────────────────────────────────────────────────────────
  const handlePointClick = useCallback((e: React.MouseEvent, pointId: string) => {
    e.stopPropagation();
    setCtxMenu(null);
    if (tool === "delete") {
      const newPts = points.filter(p => p.id !== pointId);
      const newSegs = segments.filter(s => s.fromId !== pointId && s.toId !== pointId);
      const newDiags = newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [];
      onChange({ points: newPts, segments: newSegs, diagonals: newDiags, isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
      return;
    }
    onChange({ selectedPointId: pointId, selectedSegmentId: null, selectedDiagonalId: null, selectedArcId: null });
  }, [tool, points, segments, isClosed, diagonals, onChange]);

  const handlePointCtxMenu = useCallback((e: React.MouseEvent, pointId: string) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "point", id: pointId });
  }, []);

  const handlePointMouseDown = useCallback((e: React.MouseEvent, pointId: string) => {
    if (tool !== "move") return;
    e.stopPropagation();
    const pt = points.find(p => p.id === pointId)!;
    dragRef.current = { pointId, origX: pt.x, origY: pt.y };
  }, [tool, points]);

  // ── Клик на отрезок ──────────────────────────────────────────────────────
  const handleSegmentClick = useCallback((e: React.MouseEvent, segId: string) => {
    e.stopPropagation();
    setCtxMenu(null);
    if (tool === "delete") {
      const newSegs = segments.filter(s => s.id !== segId);
      onChange({ segments: newSegs, isClosed: false, selectedSegmentId: null });
      return;
    }
    if (tool === "arc") {
      // В режиме дуги — увеличиваем радиус скругления
      const seg = segments.find(s => s.id === segId);
      if (seg) {
        const newR = (seg.arcRadius + 10) % 80;
        onChange({ segments: segments.map(s => s.id === segId ? { ...s, arcRadius: newR } : s) });
      }
      return;
    }
    onChange({ selectedSegmentId: segId, selectedPointId: null, selectedDiagonalId: null, selectedArcId: null });
  }, [tool, segments, onChange]);

  const handleSegmentCtxMenu = useCallback((e: React.MouseEvent, segId: string) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "segment", id: segId });
  }, []);

  // ── Клик на диагональ ────────────────────────────────────────────────────
  const handleDiagonalClick = useCallback((e: React.MouseEvent, diagId: string) => {
    e.stopPropagation();
    setCtxMenu(null);
    if (tool === "delete") {
      onChange({ diagonals: diagonals.filter(d => d.id !== diagId), selectedDiagonalId: null });
      return;
    }
    onChange({ selectedDiagonalId: diagId, selectedPointId: null, selectedSegmentId: null, selectedArcId: null });
  }, [tool, diagonals, onChange]);

  // ── Клик на размерную линию ───────────────────────────────────────────────
  const handleDimLineClick = useCallback((e: React.MouseEvent, dlId: string) => {
    e.stopPropagation();
    if (tool === "delete") {
      onChange({ dimLines: dimLines.filter(d => d.id !== dlId), selectedDimLineId: null });
      return;
    }
    onChange({ selectedDimLineId: dlId, selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null });
  }, [tool, dimLines, onChange]);

  // ── Escape ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGhost(null); setCtxMenu(null);
        if (phase === "draw" && points.length > 0 && !isClosed) {
          onChange({ points: points.slice(0, -1), segments: segments.slice(0, -1) });
        }
        onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null, selectedArcId: null, selectedDimLineId: null });
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !["INPUT","TEXTAREA","SELECT"].includes((e.target as Element).tagName)) {
        if (selectedPointId) {
          const newPts = points.filter(p => p.id !== selectedPointId);
          const newSegs = segments.filter(s => s.fromId !== selectedPointId && s.toId !== selectedPointId);
          onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [], isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
        }
        if (selectedSegmentId) onChange({ segments: segments.filter(s => s.id !== selectedSegmentId), isClosed: false, selectedSegmentId: null });
        if (selectedDiagonalId) onChange({ diagonals: diagonals.filter(d => d.id !== selectedDiagonalId), selectedDiagonalId: null });
        if (selectedDimLineId) onChange({ dimLines: dimLines.filter(d => d.id !== selectedDimLineId), selectedDimLineId: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, points, segments, isClosed, diagonals, dimLines, selectedPointId, selectedSegmentId, selectedDiagonalId, selectedDimLineId, onChange]);

  // ── Размерная линия для отрезка ───────────────────────────────────────────
  const renderDimLine = (seg: Segment) => {
    if (!showDimLines || !seg.showDimLine) return null;
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return null;
    const { nx, ny } = segmentNormal(a, b);
    const off = DIM_OFF;
    const x1 = a.x + nx * off, y1 = a.y + ny * off;
    const x2 = b.x + nx * off, y2 = b.y + ny * off;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const lenPx = distPx(a, b);
    const lenCm = seg.lengthCm ?? pxToCm(lenPx, scale);
    const label = lenCm !== null ? `${lenCm} см` : "";
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const normAngle = angle > 90 || angle < -90 ? angle + 180 : angle;

    return (
      <g key={`dim-${seg.id}`} className="pointer-events-none">
        <line x1={a.x + nx * (off - 7)} y1={a.y + ny * (off - 7)} x2={a.x + nx * (off + 7)} y2={a.y + ny * (off + 7)} stroke="#60a5fa" strokeWidth={1} />
        <line x1={b.x + nx * (off - 7)} y1={b.y + ny * (off - 7)} x2={b.x + nx * (off + 7)} y2={b.y + ny * (off + 7)} stroke="#60a5fa" strokeWidth={1} />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 2" />
        {label && (
          <text x={mx} y={my} transform={`rotate(${normAngle},${mx},${my})`}
            textAnchor="middle" dominantBaseline="auto" dy={-5}
            fontSize={10} fill="#93c5fd" fontFamily="monospace">{label}</text>
        )}
      </g>
    );
  };

  // ── Подпись отрезка ───────────────────────────────────────────────────────
  const renderSegmentLabel = (seg: Segment) => {
    if (!showSegmentLabels || !seg.showLength) return null;
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return null;
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const lbl = segmentLabel(points, seg);
    const lenPx = distPx(a, b);
    const lenCm = seg.lengthCm ?? pxToCm(lenPx, scale);
    const text = lenCm !== null ? `${lbl}: ${lenCm} см` : lbl;
    return (
      <text key={`lbl-${seg.id}`} x={mid.x + nx * 13} y={mid.y + ny * 13}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fill="#e2e8f0" fontFamily="monospace"
        className="pointer-events-none select-none">{text}</text>
    );
  };

  // ── Угол в точке ─────────────────────────────────────────────────────────
  const renderAngleLabel = (pt: Point, idx: number) => {
    if (!showAngleLabels || !isClosed) return null;
    const n = points.length;
    const prev = points[(idx - 1 + n) % n];
    const next = points[(idx + 1) % n];
    const deg = angleDeg(prev, pt, next);
    const ax = ((prev.x - pt.x) + (next.x - pt.x)) / 2;
    const ay = ((prev.y - pt.y) + (next.y - pt.y)) / 2;
    const alen = Math.sqrt(ax * ax + ay * ay) || 1;
    const nx2 = (ax / alen) * 26, ny2 = (ay / alen) * 26;
    const isOdd = Math.abs(deg - Math.round(deg / 90) * 90) > 1.5;
    return (
      <text key={`ang-${pt.id}`} x={pt.x + nx2} y={pt.y + ny2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={10} fill={isOdd ? "#fb923c" : "#fbbf24"}
        fontFamily="monospace"
        className="pointer-events-none select-none">{deg}°</text>
    );
  };

  // ── Скругление угла (дуга) ────────────────────────────────────────────────
  const renderCornerArc = (pt: Point, idx: number, radiusPx: number) => {
    if (radiusPx <= 0 || !isClosed) return null;
    const n = points.length;
    const prev = points[(idx - 1 + n) % n];
    const next = points[(idx + 1) % n];
    const d1 = distPx(prev, pt), d2 = distPx(pt, next);
    const r = Math.min(radiusPx, d1 * 0.45, d2 * 0.45);
    if (r < 1) return null;
    const ux = (prev.x - pt.x) / d1, uy = (prev.y - pt.y) / d1;
    const vx = (next.x - pt.x) / d2, vy = (next.y - pt.y) / d2;
    const p1x = pt.x + ux * r, p1y = pt.y + uy * r;
    const p2x = pt.x + vx * r, p2y = pt.y + vy * r;
    const cross = ux * vy - uy * vx;
    const sweep = cross > 0 ? 0 : 1;
    const isSelected = selectedArcId === pt.id;
    return (
      <path key={`arc-${pt.id}`}
        d={`M ${p1x} ${p1y} A ${r} ${r} 0 0 ${sweep} ${p2x} ${p2y}`}
        fill="none"
        stroke={isSelected ? "#34d399" : "#10b981"}
        strokeWidth={isSelected ? 2.5 : 1.8}
        strokeDasharray="3 2"
        className="pointer-events-none"
      />
    );
  };

  // ── Пользовательские размерные линии ─────────────────────────────────────
  const renderCustomDimLine = (dl: DimLine) => {
    if (!dl.visible) return null;
    const a = points.find(p => p.id === dl.fromId);
    const b = points.find(p => p.id === dl.toId);
    if (!a || !b) return null;
    const { nx, ny } = segmentNormal(a, b);
    const off = dl.offsetPx;
    const x1 = a.x + nx * off, y1 = a.y + ny * off;
    const x2 = b.x + nx * off, y2 = b.y + ny * off;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const lenPx = distPx(a, b);
    const lenCm = dl.labelCm ?? pxToCm(lenPx, scale);
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const normAngle = angle > 90 || angle < -90 ? angle + 180 : angle;
    const isSelected = dl.id === selectedDimLineId;
    return (
      <g key={`cdl-${dl.id}`}
        style={{ cursor: tool === "delete" ? "not-allowed" : "pointer" }}
        onClick={e => handleDimLineClick(e, dl.id)}
      >
        <line x1={a.x + nx * (off - 7)} y1={a.y + ny * (off - 7)} x2={a.x + nx * (off + 7)} y2={a.y + ny * (off + 7)} stroke={isSelected ? "#f472b6" : "#a78bfa"} strokeWidth={1.5} />
        <line x1={b.x + nx * (off - 7)} y1={b.y + ny * (off - 7)} x2={b.x + nx * (off + 7)} y2={b.y + ny * (off + 7)} stroke={isSelected ? "#f472b6" : "#a78bfa"} strokeWidth={1.5} />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isSelected ? "#f472b6" : "#a78bfa"} strokeWidth={isSelected ? 2 : 1.5} />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
        {lenCm !== null && (
          <text x={mx} y={my} transform={`rotate(${normAngle},${mx},${my})`}
            textAnchor="middle" dominantBaseline="auto" dy={-5}
            fontSize={10} fill={isSelected ? "#f472b6" : "#c4b5fd"} fontFamily="monospace"
            className="select-none">{lenCm} см</text>
        )}
      </g>
    );
  };

  const cursor =
    isPanning.current ? "grabbing" :
    tool === "draw" ? "crosshair" :
    tool === "move" ? "default" :
    tool === "delete" ? "not-allowed" :
    tool === "arc" ? "cell" :
    "default";

  const shapePath = buildShapePath(points, segments, isClosed);

  // Позиция трансформации для pan+zoom
  const transform = `translate(${panX * zoom}, ${panY * zoom}) scale(${zoom})`;

  return (
    <div className="w-full h-full overflow-hidden relative bg-[#0f1117] select-none">
      <svg
        ref={svgRef}
        width="100%" height="100%"
        style={{ cursor, userSelect: "none" }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        <defs>
          {showGrid && (
            <pattern id="plan-grid" width={gridSize * zoom} height={gridSize * zoom} patternUnits="userSpaceOnUse">
              <circle cx={0} cy={0} r={0.8} fill="rgba(255,255,255,0.07)" />
            </pattern>
          )}
        </defs>

        {/* Фон / сетка */}
        <rect className="canvas-bg" width="100%" height="100%" fill={showGrid ? "url(#plan-grid)" : "transparent"} />

        {/* Группа с трансформацией pan+zoom */}
        <g transform={transform}>

          {/* Заливка фигуры */}
          {isClosed && points.length >= 3 && (
            <path d={shapePath} fill="rgba(139,92,246,0.07)" stroke="none" className="pointer-events-none" />
          )}

          {/* Контур */}
          {points.length >= 2 && (
            <path d={shapePath} fill="none"
              stroke={isClosed ? "#a78bfa" : "#6366f1"}
              strokeWidth={2} strokeLinejoin="round"
              className="pointer-events-none"
            />
          )}

          {/* Отрезки — кликабельная зона */}
          {segments.map(seg => {
            const a = points.find(p => p.id === seg.fromId);
            const b = points.find(p => p.id === seg.toId);
            if (!a || !b) return null;
            const isSel = seg.id === selectedSegmentId;
            return (
              <g key={seg.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16}
                  style={{ cursor: tool === "delete" ? "not-allowed" : tool === "segment" || tool === "arc" ? "pointer" : "default" }}
                  onClick={e => handleSegmentClick(e, seg.id)}
                  onContextMenu={e => handleSegmentCtxMenu(e, seg.id)}
                />
                {isSel && (
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c4b5fd" strokeWidth={3} strokeDasharray="6 3" className="pointer-events-none" />
                )}
              </g>
            );
          })}

          {/* Размерные линии отрезков */}
          {segments.map(seg => renderDimLine(seg))}

          {/* Подписи отрезков */}
          {segments.map(seg => renderSegmentLabel(seg))}

          {/* Пользовательские размерные линии */}
          {dimLines.map(dl => renderCustomDimLine(dl))}

          {/* Диагонали */}
          {showDiagonals && diagonals.filter(d => d.visible).map(diag => {
            const a = points.find(p => p.id === diag.fromId);
            const b = points.find(p => p.id === diag.toId);
            if (!a || !b) return null;
            const mid = midPoint(a, b);
            const lenCm = diag.lengthCm ?? pxToCm(distPx(a, b), scale);
            const idxA = points.findIndex(p => p.id === diag.fromId);
            const idxB = points.findIndex(p => p.id === diag.toId);
            const lbl = `${pointLabel(idxA)}-${pointLabel(idxB)}`;
            const isSel = diag.id === selectedDiagonalId;
            return (
              <g key={diag.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12}
                  style={{ cursor: tool === "delete" ? "not-allowed" : "pointer" }}
                  onClick={e => handleDiagonalClick(e, diag.id)}
                />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={isSel ? "#fb923c" : "#92400e"}
                  strokeWidth={isSel ? 1.8 : 1.2}
                  strokeDasharray="7 4"
                  className="pointer-events-none"
                />
                {diag.showLength && lenCm !== null && (
                  <text x={mid.x + 4} y={mid.y - 5} fontSize={9.5} fill={isSel ? "#fb923c" : "#f59e0b"}
                    fontFamily="monospace" className="pointer-events-none select-none">{lbl}: {lenCm} см</text>
                )}
              </g>
            );
          })}

          {/* Дуги скруглений */}
          {isClosed && segments.map(seg => {
            const idx = points.findIndex(p => p.id === seg.toId);
            if (idx < 0 || seg.arcRadius <= 0) return null;
            const pt = points[idx];
            return renderCornerArc(pt, idx, seg.arcRadius);
          })}

          {/* Метки углов */}
          {isClosed && points.map((pt, idx) => renderAngleLabel(pt, idx))}

          {/* Ghost линия предпросмотра */}
          {ghost && points.length > 0 && tool === "draw" && (
            <line x1={points[points.length - 1].x} y1={points[points.length - 1].y}
              x2={ghost.x} y2={ghost.y}
              stroke={ghost.willClose ? "#34d399" : "#818cf8"}
              strokeWidth={1.5} strokeDasharray="6 4"
              className="pointer-events-none"
            />
          )}

          {/* Ghost точка */}
          {ghost && tool === "draw" && (
            <circle cx={ghost.x} cy={ghost.y} r={ghost.willClose ? 10 : 4}
              fill={ghost.willClose ? "rgba(52,211,153,0.25)" : "rgba(129,140,248,0.3)"}
              stroke={ghost.willClose ? "#34d399" : "#818cf8"} strokeWidth={1.5}
              className="pointer-events-none"
            />
          )}

          {/* Точки */}
          {showPoints && points.map((pt, idx) => {
            const isSel = pt.id === selectedPointId;
            const isFirst = idx === 0;
            const willClose = ghost?.willClose && isFirst;
            const seg = segments.find(s => s.toId === pt.id);
            const hasArc = seg ? seg.arcRadius > 0 : false;
            return (
              <g key={pt.id}
                style={{ cursor: tool === "move" ? "grab" : tool === "delete" ? "not-allowed" : tool === "draw" && isFirst && points.length >= 3 && !isClosed ? "pointer" : "default" }}
                onClick={e => handlePointClick(e, pt.id)}
                onMouseDown={e => handlePointMouseDown(e, pt.id)}
                onContextMenu={e => handlePointCtxMenu(e, pt.id)}
              >
                <circle cx={pt.x} cy={pt.y} r={PT_R + 7} fill="transparent" />
                {(isSel || willClose) && (
                  <circle cx={pt.x} cy={pt.y} r={PT_R + 6} fill="none"
                    stroke={willClose ? "#34d399" : "#c4b5fd"} strokeWidth={1.5} opacity={0.5} />
                )}
                {hasArc && !isSel && (
                  <circle cx={pt.x} cy={pt.y} r={PT_R + 3} fill="none" stroke="#10b981" strokeWidth={1} opacity={0.5} />
                )}
                <circle cx={pt.x} cy={pt.y} r={PT_R}
                  fill={isSel ? "#c4b5fd" : isFirst && !isClosed ? "#34d399" : "#7c3aed"}
                  stroke={isSel ? "#a78bfa" : "#4c1d95"} strokeWidth={2}
                />
                {showPointLabels && (
                  <text x={pt.x + 10} y={pt.y - 10} fontSize={11} fontWeight={700}
                    fill="#e2e8f0" fontFamily="monospace"
                    className="pointer-events-none select-none">{pointLabel(idx)}</text>
                )}
              </g>
            );
          })}

          {/* Подсказка */}
          {tool === "draw" && phase === "draw" && !isClosed && (
            <text x={16 / zoom} y={28 / zoom} fontSize={12 / zoom} fill="rgba(255,255,255,0.28)"
              fontFamily="sans-serif" className="pointer-events-none select-none">
              {points.length === 0 ? "Кликни чтобы поставить первую точку"
                : points.length < 3 ? `Поставь ещё минимум ${3 - points.length} точки`
                : "Кликни по зелёной точке чтобы замкнуть фигуру"}
            </text>
          )}

          {/* Подсказка режима дуг */}
          {tool === "arc" && isClosed && (
            <text x={16 / zoom} y={28 / zoom} fontSize={12 / zoom} fill="rgba(16,185,129,0.6)"
              fontFamily="sans-serif" className="pointer-events-none select-none">
              Кликни на отрезок чтобы добавить скругление угла
            </text>
          )}

        </g>
      </svg>

      {/* ── Контекстное меню ── */}
      {ctxMenu && (
        <div
          className="fixed z-50 bg-[#1a1b2e] border border-white/[0.12] rounded-xl shadow-2xl py-1 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={() => setCtxMenu(null)}
        >
          {ctxMenu.type === "point" && (<>
            <CtxItem icon="MousePointer2" label="Выделить" onClick={() => onChange({ selectedPointId: ctxMenu.id })} />
            <CtxItem icon="Move" label="Переместить" onClick={() => onChange({ tool: "move", selectedPointId: ctxMenu.id })} />
            <div className="h-px bg-white/[0.08] my-1" />
            <CtxItem icon="Trash2" label="Удалить точку" danger onClick={() => {
              const newPts = points.filter(p => p.id !== ctxMenu.id);
              const newSegs = segments.filter(s => s.fromId !== ctxMenu.id && s.toId !== ctxMenu.id);
              onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [], isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
            }} />
          </>)}
          {ctxMenu.type === "segment" && (<>
            <CtxItem icon="Ruler" label="Задать длину" onClick={() => onChange({ selectedSegmentId: ctxMenu.id, tool: "segment" })} />
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
            <CtxItem icon="Trash2" label="Удалить диагональ" danger onClick={() => onChange({ diagonals: diagonals.filter(d => d.id !== ctxMenu.id) })} />
          </>)}
        </div>
      )}

      {/* ── Мини-панель zoom в углу ── */}
      <div className="absolute bottom-8 right-4 flex flex-col gap-1">
        <button onClick={() => onChange({ settings: { ...settings, zoom: Math.min(4, Math.round((zoom + 0.2) * 10) / 10) } })}
          className="w-8 h-8 rounded-lg bg-white/[0.07] border border-white/[0.1] text-white/50 hover:bg-white/[0.12] hover:text-white/80 flex items-center justify-center transition">
          <Icon name="Plus" size={14} />
        </button>
        <div className="w-8 h-6 flex items-center justify-center text-[10px] text-white/30 font-mono">{Math.round(zoom * 100)}%</div>
        <button onClick={() => onChange({ settings: { ...settings, zoom: Math.max(0.3, Math.round((zoom - 0.2) * 10) / 10) } })}
          className="w-8 h-8 rounded-lg bg-white/[0.07] border border-white/[0.1] text-white/50 hover:bg-white/[0.12] hover:text-white/80 flex items-center justify-center transition">
          <Icon name="Minus" size={14} />
        </button>
      </div>
    </div>
  );
}

function CtxItem({ icon, label, onClick, danger = false }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition hover:bg-white/[0.06] ${danger ? "text-rose-400" : "text-white/70"}`}>
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}
