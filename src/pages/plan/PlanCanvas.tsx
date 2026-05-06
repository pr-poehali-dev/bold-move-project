import React, { useRef, useCallback, useEffect } from "react";
import type {
  PlanState, Point, Segment, DiagonalDef,
} from "./planTypes";
import {
  pointLabel, segmentLabel, distPx, midPoint, segmentNormal,
  snapVal, snapToPoint, orthoPoint, buildAutoDiagonals, genId, pxToCm, calcScale,
  angleDeg,
} from "./planTypes";

interface PlanCanvasProps {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

const POINT_RADIUS = 6;
const SNAP_THRESHOLD = 18;
const CLOSE_THRESHOLD = 20;
const DIM_OFFSET = 22;      // отступ размерной линии от отрезка

export default function PlanCanvas({ state, onChange }: PlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    pointId: string;
    startX: number; startY: number;
    origX: number; origY: number;
  } | null>(null);

  const {
    points, segments, diagonals, arcs: _arcs,
    isClosed, settings, tool, phase,
    selectedPointId, selectedSegmentId, selectedDiagonalId,
  } = state;

  const { ortho, snapToPoints: snapPts, showGrid, gridSize, zoom,
    showSegmentLabels, showAngleLabels, showDiagonals, showDimLines } = settings;

  // ── Масштаб пикселей в см ─────────────────────────────────────────────────
  const scale = calcScale(points, segments);

  // ── Координата мыши относительно SVG с учётом zoom ───────────────────────
  const getSvgXY = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }, [zoom]);

  // ── Применить ortho + snap к сетке + snap к точкам ───────────────────────
  const applySnap = useCallback((
    rawX: number, rawY: number,
    excludeId: string | null = null
  ): { x: number; y: number; snapId: string | null } => {
    let x = snapVal(rawX, gridSize, showGrid);
    let y = snapVal(rawY, gridSize, showGrid);

    // ортогональное черчение от последней точки
    if (ortho && points.length > 0 && tool === "draw" && !isClosed) {
      const last = points[points.length - 1];
      const o = orthoPoint(last, x, y);
      x = o.x; y = o.y;
    }

    // магнитные точки
    const snapped = snapToPoint(x, y, points, excludeId, SNAP_THRESHOLD, snapPts);
    return { x: snapped.x, y: snapped.y, snapId: snapped.snapId };
  }, [gridSize, showGrid, ortho, points, tool, isClosed, snapPts]);

  // ── Предварительная точка (ghost) при рисовании ───────────────────────────
  const [ghost, setGhost] = React.useState<{ x: number; y: number; willClose: boolean } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tool === "draw" && phase === "draw" && !isClosed) {
      const raw = getSvgXY(e);
      const { x, y } = applySnap(raw.x, raw.y);
      const willClose = points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THRESHOLD;
      setGhost({ x: willClose ? points[0].x : x, y: willClose ? points[0].y : y, willClose });
    } else {
      setGhost(null);
    }

    // drag точки
    if (dragRef.current && tool === "move") {
      const raw = getSvgXY(e);
      const { x, y } = applySnap(raw.x, raw.y, dragRef.current.pointId);
      const newPoints = points.map(p =>
        p.id === dragRef.current!.pointId ? { ...p, x, y } : p
      );
      // пересчитать диагонали
      const newDiagonals = buildAutoDiagonals(newPoints, diagonals);
      onChange({ points: newPoints, diagonals: newDiagonals });
    }
  }, [tool, phase, isClosed, points, getSvgXY, applySnap, diagonals, onChange]);

  // ── Клик на холст ─────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target !== svgRef.current && !(e.target as Element).classList.contains("canvas-bg")) {
      // клик попал на элемент — сбрасываем выделение, не ставим точку
      if (tool !== "draw") {
        onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null });
      }
      return;
    }

    if (tool === "draw" && phase === "draw" && !isClosed) {
      const raw = getSvgXY(e);
      const { x, y } = applySnap(raw.x, raw.y);

      // попытка замкнуть
      if (points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THRESHOLD) {
        // замыкаем
        const closingSegment: Segment = {
          id: genId("s"),
          fromId: points[points.length - 1].id,
          toId: points[0].id,
          lengthCm: null,
          showLength: true,
          showDimLine: true,
        };
        const newSegs = [...segments, closingSegment];
        const newDiags = buildAutoDiagonals(points, diagonals);
        onChange({
          segments: newSegs,
          diagonals: newDiags,
          isClosed: true,
          phase: "lengths",
          tool: "move",
          activeInputIndex: 0,
          selectedSegmentId: newSegs[0]?.id ?? null,
        });
        setGhost(null);
        return;
      }

      const newPoint: Point = { id: genId("pt"), x, y };
      const newPoints = [...points, newPoint];
      const newSegs = [...segments];

      if (points.length > 0) {
        newSegs.push({
          id: genId("s"),
          fromId: points[points.length - 1].id,
          toId: newPoint.id,
          lengthCm: null,
          showLength: true,
          showDimLine: true,
        });
      }

      onChange({ points: newPoints, segments: newSegs });
    } else if (tool === "delete") {
      onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null });
    } else {
      onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null });
    }
  }, [tool, phase, isClosed, points, segments, diagonals, getSvgXY, applySnap, onChange]);

  // ── Клик на точку ─────────────────────────────────────────────────────────
  const handlePointClick = useCallback((e: React.MouseEvent, pointId: string) => {
    e.stopPropagation();
    if (tool === "delete") {
      // удаляем точку и связанные отрезки
      const newPoints = points.filter(p => p.id !== pointId);
      const newSegs = segments.filter(s => s.fromId !== pointId && s.toId !== pointId);
      // если осталось меньше 3 — фигура разомкнута
      const wasLastClose = isClosed && newPoints.length < 3;
      const newDiags = newPoints.length >= 3 ? buildAutoDiagonals(newPoints, diagonals) : [];
      onChange({
        points: newPoints,
        segments: newSegs,
        diagonals: newDiags,
        isClosed: wasLastClose ? false : isClosed && newPoints.length >= 3,
        selectedPointId: null,
      });
      return;
    }
    onChange({ selectedPointId: pointId, selectedSegmentId: null, selectedDiagonalId: null });
  }, [tool, points, segments, isClosed, diagonals, onChange]);

  // ── Начало drag точки ─────────────────────────────────────────────────────
  const handlePointMouseDown = useCallback((e: React.MouseEvent, pointId: string) => {
    if (tool !== "move") return;
    e.stopPropagation();
    const raw = getSvgXY(e);
    const pt = points.find(p => p.id === pointId)!;
    dragRef.current = { pointId, startX: raw.x, startY: raw.y, origX: pt.x, origY: pt.y };
  }, [tool, points, getSvgXY]);

  // ── Конец drag ────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Клик на отрезок ───────────────────────────────────────────────────────
  const handleSegmentClick = useCallback((e: React.MouseEvent, segId: string) => {
    e.stopPropagation();
    if (tool === "delete") {
      const seg = segments.find(s => s.id === segId);
      if (!seg) return;
      // при удалении отрезка размыкаем фигуру
      const newSegs = segments.filter(s => s.id !== segId);
      onChange({ segments: newSegs, isClosed: false, selectedSegmentId: null });
      return;
    }
    onChange({ selectedSegmentId: segId, selectedPointId: null, selectedDiagonalId: null });
  }, [tool, segments, onChange]);

  // ── Клик на диагональ ────────────────────────────────────────────────────
  const handleDiagonalClick = useCallback((e: React.MouseEvent, diagId: string) => {
    e.stopPropagation();
    if (tool === "delete") {
      const newDiags = diagonals.filter(d => d.id !== diagId);
      onChange({ diagonals: newDiags, selectedDiagonalId: null });
      return;
    }
    onChange({ selectedDiagonalId: diagId, selectedPointId: null, selectedSegmentId: null });
  }, [tool, diagonals, onChange]);

  // ── Escape — сбросить состояние ───────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGhost(null);
        if (phase === "draw" && points.length > 0 && !isClosed) {
          // отмена последней точки
          const newPoints = points.slice(0, -1);
          const newSegs = segments.slice(0, -1);
          onChange({ points: newPoints, segments: newSegs });
        }
        onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null });
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedPointId) {
          const newPoints = points.filter(p => p.id !== selectedPointId);
          const newSegs = segments.filter(s => s.fromId !== selectedPointId && s.toId !== selectedPointId);
          const newDiags = newPoints.length >= 3 ? buildAutoDiagonals(newPoints, diagonals) : [];
          onChange({ points: newPoints, segments: newSegs, diagonals: newDiags, selectedPointId: null, isClosed: newPoints.length >= 3 && isClosed });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, points, segments, isClosed, diagonals, selectedPointId, onChange]);

  // ── Построить SVG path для фигуры ────────────────────────────────────────
  const buildPath = (): string => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    if (isClosed) d += " Z";
    return d;
  };

  // ── Размерная линия для отрезка ───────────────────────────────────────────
  const renderDimLine = (seg: Segment) => {
    if (!showDimLines || !seg.showDimLine) return null;
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return null;
    const { nx, ny } = segmentNormal(a, b);
    const off = DIM_OFFSET;
    const x1 = a.x + nx * off, y1 = a.y + ny * off;
    const x2 = b.x + nx * off, y2 = b.y + ny * off;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const lenPx = distPx(a, b);
    const lenCm = seg.lengthCm ?? pxToCm(lenPx, scale);
    const label = lenCm !== null ? `${lenCm} см` : "";
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

    return (
      <g key={`dim-${seg.id}`} className="pointer-events-none">
        {/* засечки */}
        <line x1={a.x + nx * (off - 6)} y1={a.y + ny * (off - 6)}
              x2={a.x + nx * (off + 6)} y2={a.y + ny * (off + 6)}
              stroke="#60a5fa" strokeWidth={1} />
        <line x1={b.x + nx * (off - 6)} y1={b.y + ny * (off - 6)}
              x2={b.x + nx * (off + 6)} y2={b.y + ny * (off + 6)}
              stroke="#60a5fa" strokeWidth={1} />
        {/* линия */}
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 2" />
        {/* подпись */}
        {label && (
          <text
            x={mx} y={my}
            transform={`rotate(${angle > 90 || angle < -90 ? angle + 180 : angle}, ${mx}, ${my})`}
            textAnchor="middle" dominantBaseline="auto"
            dy={-4}
            fontSize={10} fill="#93c5fd" fontFamily="monospace"
          >{label}</text>
        )}
      </g>
    );
  };

  // ── Подпись на отрезке ────────────────────────────────────────────────────
  const renderSegmentLabel = (seg: Segment) => {
    if (!showSegmentLabels || !seg.showLength) return null;
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return null;
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const label = segmentLabel(points, seg);
    const lenPx = distPx(a, b);
    const lenCm = seg.lengthCm ?? pxToCm(lenPx, scale);
    const text = lenCm !== null ? `${label}: ${lenCm} см` : label;
    return (
      <text key={`lbl-${seg.id}`}
        x={mid.x + nx * 12} y={mid.y + ny * 12}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fill="#e2e8f0"
        fontFamily="monospace"
        className="pointer-events-none select-none"
      >{text}</text>
    );
  };

  // ── Подпись угла в точке ──────────────────────────────────────────────────
  const renderAngleLabel = (pt: Point, idx: number) => {
    if (!showAngleLabels || !isClosed) return null;
    const n = points.length;
    const prev = points[(idx - 1 + n) % n];
    const next = points[(idx + 1) % n];
    const deg = angleDeg(prev, pt, next);
    // направление вовнутрь — среднее направление
    const ax = ((prev.x - pt.x) + (next.x - pt.x)) / 2;
    const ay = ((prev.y - pt.y) + (next.y - pt.y)) / 2;
    const alen = Math.sqrt(ax * ax + ay * ay) || 1;
    const nx = (ax / alen) * 24, ny = (ay / alen) * 24;
    return (
      <text key={`ang-${pt.id}`}
        x={pt.x + nx} y={pt.y + ny}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={10} fill="#fbbf24"
        fontFamily="monospace"
        className="pointer-events-none select-none"
      >{deg}°</text>
    );
  };

  // ── Курсор для режима ─────────────────────────────────────────────────────
  const cursor =
    tool === "draw" ? "crosshair" :
    tool === "move" ? "default" :
    tool === "delete" ? "not-allowed" :
    "default";

  const svgW = 10000; const svgH = 10000;

  return (
    <div className="w-full h-full overflow-hidden relative bg-[#0f1117]">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgW / zoom} ${svgH / zoom}`}
        style={{ cursor, userSelect: "none" }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* ── Сетка ── */}
        {showGrid && (
          <defs>
            <pattern id="plan-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
              <circle cx={0} cy={0} r={0.8} fill="rgba(255,255,255,0.07)" />
            </pattern>
          </defs>
        )}
        {showGrid && (
          <rect className="canvas-bg" width={svgW / zoom} height={svgH / zoom} fill="url(#plan-grid)" />
        )}
        {!showGrid && (
          <rect className="canvas-bg" width={svgW / zoom} height={svgH / zoom} fill="transparent" />
        )}

        {/* ── Заливка фигуры ── */}
        {points.length >= 3 && isClosed && (
          <path d={buildPath()} fill="rgba(139,92,246,0.08)" stroke="none" className="pointer-events-none" />
        )}

        {/* ── Контур незамкнутой фигуры ── */}
        {points.length >= 2 && (
          <path
            d={buildPath()}
            fill="none"
            stroke={isClosed ? "#a78bfa" : "#6366f1"}
            strokeWidth={2}
            strokeLinejoin="round"
            className="pointer-events-none"
          />
        )}

        {/* ── Отрезки (кликабельные широкие прозрачные) ── */}
        {segments.map(seg => {
          const a = points.find(p => p.id === seg.fromId);
          const b = points.find(p => p.id === seg.toId);
          if (!a || !b) return null;
          const isSelected = seg.id === selectedSegmentId;
          return (
            <g key={seg.id}>
              {/* широкая прозрачная зона для клика */}
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="transparent" strokeWidth={14}
                style={{ cursor: tool === "delete" ? "not-allowed" : tool === "segment" ? "pointer" : "default" }}
                onClick={e => handleSegmentClick(e, seg.id)}
              />
              {/* визуальная линия */}
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isSelected ? "#c4b5fd" : "#7c3aed"}
                strokeWidth={isSelected ? 2.5 : 2}
                className="pointer-events-none"
              />
            </g>
          );
        })}

        {/* ── Размерные линии ── */}
        {segments.map(seg => renderDimLine(seg))}

        {/* ── Подписи отрезков ── */}
        {segments.map(seg => renderSegmentLabel(seg))}

        {/* ── Диагонали ── */}
        {showDiagonals && diagonals.map(diag => {
          if (!diag.visible) return null;
          const a = points.find(p => p.id === diag.fromId);
          const b = points.find(p => p.id === diag.toId);
          if (!a || !b) return null;
          const isSelected = diag.id === selectedDiagonalId;
          const mid = midPoint(a, b);
          const lenPx = distPx(a, b);
          const lenCm = diag.lengthCm ?? pxToCm(lenPx, scale);
          const idxA = points.findIndex(p => p.id === diag.fromId);
          const idxB = points.findIndex(p => p.id === diag.toId);
          const diagLabel = `${pointLabel(idxA)}-${pointLabel(idxB)}`;
          return (
            <g key={diag.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="transparent" strokeWidth={10}
                style={{ cursor: tool === "delete" ? "not-allowed" : "pointer" }}
                onClick={e => handleDiagonalClick(e, diag.id)}
              />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isSelected ? "#fb923c" : "#9a7227"}
                strokeWidth={isSelected ? 1.5 : 1}
                strokeDasharray="6 4"
                className="pointer-events-none"
              />
              {diag.showLength && lenCm !== null && (
                <text x={mid.x + 4} y={mid.y - 4}
                  fontSize={9.5} fill="#f59e0b" fontFamily="monospace"
                  className="pointer-events-none select-none"
                >{diagLabel}: {lenCm} см</text>
              )}
            </g>
          );
        })}

        {/* ── Углы ── */}
        {isClosed && points.map((pt, idx) => renderAngleLabel(pt, idx))}

        {/* ── Ghost линия (предпросмотр) ── */}
        {ghost && points.length > 0 && tool === "draw" && (
          <line
            x1={points[points.length - 1].x} y1={points[points.length - 1].y}
            x2={ghost.x} y2={ghost.y}
            stroke={ghost.willClose ? "#34d399" : "#818cf8"}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            className="pointer-events-none"
          />
        )}

        {/* ── Ghost точка (предпросмотр замыкания) ── */}
        {ghost && tool === "draw" && (
          <circle
            cx={ghost.x} cy={ghost.y} r={ghost.willClose ? 9 : 4}
            fill={ghost.willClose ? "rgba(52,211,153,0.3)" : "rgba(129,140,248,0.4)"}
            stroke={ghost.willClose ? "#34d399" : "#818cf8"}
            strokeWidth={1.5}
            className="pointer-events-none"
          />
        )}

        {/* ── Точки ── */}
        {points.map((pt, idx) => {
          const isSelected = pt.id === selectedPointId;
          const isFirst = idx === 0;
          const willClose = ghost?.willClose && isFirst;
          return (
            <g key={pt.id}
              style={{ cursor: tool === "move" ? "grab" : tool === "delete" ? "not-allowed" : tool === "draw" && isFirst && points.length >= 3 && !isClosed ? "pointer" : "default" }}
              onClick={e => handlePointClick(e, pt.id)}
              onMouseDown={e => handlePointMouseDown(e, pt.id)}
            >
              {/* область клика */}
              <circle cx={pt.x} cy={pt.y} r={POINT_RADIUS + 6} fill="transparent" />
              {/* внешний ring при выделении */}
              {(isSelected || willClose) && (
                <circle cx={pt.x} cy={pt.y} r={POINT_RADIUS + 5}
                  fill="none"
                  stroke={willClose ? "#34d399" : "#c4b5fd"}
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              )}
              {/* основная точка */}
              <circle
                cx={pt.x} cy={pt.y} r={POINT_RADIUS}
                fill={isSelected ? "#c4b5fd" : isFirst && !isClosed ? "#34d399" : "#7c3aed"}
                stroke={isSelected ? "#a78bfa" : "#4c1d95"}
                strokeWidth={2}
              />
              {/* метка A, B, C ... */}
              <text x={pt.x + 10} y={pt.y - 10}
                fontSize={11} fontWeight={700} fill="#e2e8f0"
                fontFamily="monospace"
                className="pointer-events-none select-none"
              >{pointLabel(idx)}</text>
            </g>
          );
        })}

        {/* ── Подсказка при рисовании ── */}
        {tool === "draw" && phase === "draw" && !isClosed && (
          <text x={16} y={24} fontSize={12} fill="rgba(255,255,255,0.3)"
            fontFamily="sans-serif" className="pointer-events-none select-none"
          >
            {points.length === 0
              ? "Кликни чтобы поставить первую точку"
              : points.length < 3
              ? `Точек: ${points.length} — поставь ещё минимум ${3 - points.length}`
              : "Кликни по зелёной точке чтобы замкнуть фигуру"}
          </text>
        )}
      </svg>
    </div>
  );
}
