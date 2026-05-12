import { useMemo } from "react";
import type { PlanState, Point, Segment } from "./planTypes";
import { buildShapePath, calcScale, distPx, midPoint, segmentNormal, pxToCm, polygonArea, polygonPerimeter } from "./planTypes";

const PAD = 20;

function fitPoints(points: Point[], w: number, h: number, pad: number) {
  if (!points.length) return { tx: (x: number) => x, ty: (y: number) => y, fitScale: 1 };
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pw = maxX - minX || 1, ph = maxY - minY || 1;
  const s = Math.min((w - pad * 2) / pw, (h - pad * 2) / ph);
  const ox = (w - pw * s) / 2 - minX * s;
  const oy = (h - ph * s) / 2 - minY * s;
  return { tx: (x: number) => x * s + ox, ty: (y: number) => y * s + oy, fitScale: s };
}

export interface RoomMeta {
  areaSqm: number | null;
  perimM: number | null;
}

export function getRoomMeta(data: object): RoomMeta {
  const state = data as PlanState;
  const points: Point[]     = state?.points   ?? [];
  const segments: Segment[] = state?.segments ?? [];
  const isClosed = state?.isClosed ?? false;
  const baseScale = state?.baseScale ?? null;
  if (!isClosed || points.length < 3 || !baseScale) return { areaSqm: null, perimM: null };
  const areaPx2 = polygonArea(points);
  const areaSqm = Math.round(areaPx2 / (baseScale * baseScale)) / 100;
  const perimPx = polygonPerimeter(points);
  const perimM  = Math.round(perimPx / (baseScale * 100) * 100) / 100;
  return { areaSqm, perimM };
}

interface Props {
  data: object;
  width?: number;
  height?: number;
  showMeta?: boolean;
}

export default function PlanRoomPreview({ data, width = 280, height = 160, showMeta = false }: Props) {
  const state = data as PlanState;
  const points: Point[]     = state?.points   ?? [];
  const segments: Segment[] = state?.segments ?? [];
  const isClosed = state?.isClosed ?? false;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { tx, ty, fitScale } = useMemo(() => fitPoints(points, width, height, PAD), [JSON.stringify(points), width, height]);
  const planScale = useMemo(() => calcScale(points, segments), [points, segments]);
  const meta = useMemo(() => getRoomMeta(data), [data]);

  if (points.length < 2) {
    return (
      <div style={{ width, height, background: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="3" y="3" width="22" height="22" rx="3" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4 3"/>
        </svg>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>Пустой план</span>
      </div>
    );
  }

  const shapePath = buildShapePath(points, segments, isClosed);
  const minXpt = Math.min(...points.map(p => p.x));
  const minYpt = Math.min(...points.map(p => p.y));
  const transformStr = `translate(${tx(minXpt) - minXpt * fitScale},${ty(minYpt) - minYpt * fitScale}) scale(${fitScale})`;

  const segLabels = segments.flatMap(seg => {
    if (!seg.showLength) return [];
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return [];
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const lenCm = seg.lengthCm ?? pxToCm(distPx(a, b), planScale);
    if (lenCm === null) return [];
    return [{ id: seg.id, x: tx(mid.x) + nx * 13, y: ty(mid.y) + ny * 13, label: `${lenCm} см` }];
  });

  const angleLabels = isClosed ? points.map((pt, idx) => {
    const n = points.length;
    const prev = points[(idx - 1 + n) % n];
    const next = points[(idx + 1) % n];
    const ax = prev.x - pt.x, ay = prev.y - pt.y;
    const bx = next.x - pt.x, by = next.y - pt.y;
    const la = Math.sqrt(ax * ax + ay * ay) || 1;
    const lb = Math.sqrt(bx * bx + by * by) || 1;
    const cosA = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    const deg = Math.round(Math.acos(cosA) * 180 / Math.PI);
    const isOdd = Math.abs(deg - Math.round(deg / 90) * 90) > 1.5;
    const dx = ax / la + bx / lb, dy = ay / la + by / lb;
    const dl = Math.sqrt(dx * dx + dy * dy) || 1;
    return { id: pt.id, x: tx(pt.x) + (dx / dl) * 14, y: ty(pt.y) + (dy / dl) * 14, label: `${deg}°`, isOdd };
  }) : [];

  const GRID = 18;

  return (
    <div>
      <svg
        width={width} height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", borderRadius: 8 }}
      >
        <defs>
          <pattern id="rp-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width={width} height={height} fill="#ffffff"/>
        <rect width={width} height={height} fill="url(#rp-grid)"/>
        <g transform={transformStr}>
          {isClosed && points.length >= 3 && (
            <path d={shapePath} fill="rgba(251,191,36,0.12)" stroke="none"/>
          )}
          <path
            d={shapePath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={2 / fitScale}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map(pt => (
            <circle key={pt.id} cx={pt.x} cy={pt.y} r={3 / fitScale} fill="#1e293b"/>
          ))}
        </g>
        {segLabels.map(l => (
          <text key={l.id} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#374151" fontFamily="monospace" style={{ userSelect: "none" }}>
            {l.label}
          </text>
        ))}
        {angleLabels.map(l => (
          <text key={l.id} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fill={l.isOdd ? "#ef4444" : "#6b7280"} fontFamily="monospace" style={{ userSelect: "none" }}>
            {l.label}
          </text>
        ))}
      </svg>
      {showMeta && (meta.areaSqm !== null || meta.perimM !== null) && (
        <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 12, color: "#6366f1", fontWeight: 600 }}>
          {meta.areaSqm !== null && <span>Площадь {meta.areaSqm} м²</span>}
          {meta.areaSqm !== null && meta.perimM !== null && <span style={{ color: "#9ca3af" }}>•</span>}
          {meta.perimM !== null && <span>Периметр {meta.perimM} м</span>}
        </div>
      )}
    </div>
  );
}
