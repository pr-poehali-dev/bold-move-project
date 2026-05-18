import React from "react";
import type { DimLine } from "../planTypes";
import {
  distPx, segmentNormal, pxToCm, angleDeg, polygonOrientation,
} from "../planTypes";
import type { RenderContext, SegmentHandlers } from "../PlanCanvasTypes";

// ── renderAngleLabel ──────────────────────────────────────────────────────────

// Строим упорядоченную цепочку точек через сегменты (кэш на уровне вызова)
function buildChainFromSegments(points: import("../planTypes").Point[], segments: import("../planTypes").Segment[]): string[] | null {
  if (!points.length || !segments.length) return null;
  const chain: string[] = [points[0].id];
  let cur = points[0].id;
  for (let i = 0; i < segments.length; i++) {
    const s = segments.find(sg => sg.fromId === cur);
    if (!s) break;
    if (chain.includes(s.toId)) break;
    chain.push(s.toId);
    cur = s.toId;
  }
  return chain.length === points.length ? chain : null;
}

export function renderAngleLabel(pt: import("../planTypes").Point, idx: number, ctx: Pick<RenderContext, "points" | "segments" | "isClosed" | "showAngleLabels" | "zoom">) {
  const { points, segments, isClosed, showAngleLabels, zoom } = ctx;
  if (!showAngleLabels || !isClosed) return null;

  const z = zoom ?? 1;
  const off = 26 / z;   // отступ от угла ~26px на экране
  const fs  = 10 / z;   // шрифт ~10px на экране

  const chain = buildChainFromSegments(points, segments);
  const orderedPoints = chain ? chain.map(id => points.find(p => p.id === id)!) : points;
  const n = orderedPoints.length;

  const orderedIdx = orderedPoints.findIndex(p => p.id === pt.id);
  if (orderedIdx < 0) return null;

  const prev = orderedPoints[(orderedIdx - 1 + n) % n];
  const next = orderedPoints[(orderedIdx + 1) % n];

  const isCW = polygonOrientation(orderedPoints) > 0;
  const deg = angleDeg(prev, pt, next, isCW);
  const ax = ((prev.x - pt.x) + (next.x - pt.x)) / 2;
  const ay = ((prev.y - pt.y) + (next.y - pt.y)) / 2;
  const alen = Math.sqrt(ax * ax + ay * ay) || 1;
  const isOdd = Math.abs(deg - Math.round(deg / 90) * 90) > 1.5;
  return (
    <text key={`ang-${pt.id}`} x={pt.x + (ax / alen) * off} y={pt.y + (ay / alen) * off}
      textAnchor="middle" dominantBaseline="middle" fontSize={fs}
      fill={isOdd ? "#fb923c" : "#fbbf24"} fontFamily="monospace"
      className="pointer-events-none select-none">{deg}°</text>
  );
}

// ── renderCornerArc ───────────────────────────────────────────────────────────

export function renderCornerArc(pt: import("../planTypes").Point, idx: number, radiusPx: number, ctx: Pick<RenderContext, "points" | "isClosed" | "selectedArcId">) {
  const { points, isClosed, selectedArcId } = ctx;
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
  const sweep = (ux * vy - uy * vx) > 0 ? 0 : 1;
  return (
    <path key={`arc-${pt.id}`}
      d={`M ${p1x} ${p1y} A ${r} ${r} 0 0 ${sweep} ${p2x} ${p2y}`}
      fill="none" stroke={selectedArcId === pt.id ? "#34d399" : "#10b981"}
      strokeWidth={selectedArcId === pt.id ? 2.5 : 1.8}
      strokeDasharray="3 2" className="pointer-events-none" />
  );
}

// ── renderCustomDimLine ───────────────────────────────────────────────────────

export function renderCustomDimLine(
  dl: DimLine,
  ctx: Pick<RenderContext, "points" | "scale" | "tool" | "selectedDimLineId">,
  onDimLineClick: (e: React.MouseEvent, dlId: string) => void,
) {
  const { points, scale, tool, selectedDimLineId } = ctx;
  if (!dl.visible) return null;
  const a = points.find(p => p.id === dl.fromId);
  const b = points.find(p => p.id === dl.toId);
  if (!a || !b) return null;
  const { nx, ny } = segmentNormal(a, b);
  const off = dl.offsetPx;
  const x1 = a.x + nx * off, y1 = a.y + ny * off;
  const x2 = b.x + nx * off, y2 = b.y + ny * off;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const lenCm = dl.labelCm ?? pxToCm(distPx(a, b), scale);
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const na = angle > 90 || angle < -90 ? angle + 180 : angle;
  const isSel = dl.id === selectedDimLineId;
  const col = isSel ? "#f472b6" : "#a78bfa";
  return (
    <g key={`cdl-${dl.id}`} style={{ cursor: tool === "delete" ? "not-allowed" : "pointer" }} onClick={e => onDimLineClick(e, dl.id)}>
      <line x1={a.x + nx * (off - 7)} y1={a.y + ny * (off - 7)} x2={a.x + nx * (off + 7)} y2={a.y + ny * (off + 7)} stroke={col} strokeWidth={1.5} />
      <line x1={b.x + nx * (off - 7)} y1={b.y + ny * (off - 7)} x2={b.x + nx * (off + 7)} y2={b.y + ny * (off + 7)} stroke={col} strokeWidth={1.5} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={isSel ? 2 : 1.5} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
      {lenCm !== null && <text x={mx} y={my} transform={`rotate(${na},${mx},${my})`} textAnchor="middle" dominantBaseline="auto" dy={-5} fontSize={10} fill={col} fontFamily="monospace" className="select-none">{lenCm}</text>}
    </g>
  );
}

// ── Рендер диагоналей ────────────────────────────────────────────────────────

export function renderDiagonals(ctx: RenderContext, handlers: Pick<SegmentHandlers, "onDiagonalClick">) {
  const { points, diagonals, scale, tool, showDiagonals, selectedDiagonalId } = ctx;
  if (!showDiagonals) return null;
  return diagonals.filter(d => d.visible).map(diag => {
    const a = points.find(p => p.id === diag.fromId);
    const b = points.find(p => p.id === diag.toId);
    if (!a || !b) return null;
    const lenCm = diag.lengthCm ?? pxToCm(distPx(a, b), scale);
    const isSel = diag.id === selectedDiagonalId;
    // Лейбл размещаем на 1/4 от точки A (подальше от центра пересечения)
    const tx = a.x + (b.x - a.x) * 0.25;
    const ty = a.y + (b.y - a.y) * 0.25;
    return (
      <g key={diag.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16}
          style={{ cursor: tool === "delete" ? "not-allowed" : "pointer" }}
          onClick={e => handlers.onDiagonalClick(e, diag.id)}
        />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isSel ? "#fb923c" : "#92400e"} strokeWidth={isSel ? 1.8 : 1.2} strokeDasharray="7 4" className="pointer-events-none" />
        {diag.showLength && lenCm !== null && (() => {
          const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
          const na = angle > 90 || angle < -90 ? angle + 180 : angle;
          return (
            <text
              x={tx} y={ty}
              transform={`rotate(${na},${tx},${ty})`}
              textAnchor="middle" dominantBaseline="auto" dy={-5}
              fontSize={9.5} fill={isSel ? "#fb923c" : "#f59e0b"}
              fontFamily="monospace"
              className="pointer-events-none select-none"
            >{lenCm}</text>
          );
        })()}
      </g>
    );
  });
}
