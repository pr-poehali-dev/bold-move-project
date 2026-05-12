import { useMemo } from "react";
import type { PlanState, Point, Segment } from "./planTypes";
import { buildShapePath, calcScale, distPx, midPoint, segmentNormal, pxToCm, polygonArea, polygonPerimeter } from "./planTypes";

const PAD = 16;

export interface RoomMeta {
  areaSqm: number | null;
  perimM: number | null;
}

export function getRoomMeta(data: object): RoomMeta {
  const state = data as PlanState;
  const points: Point[]     = state?.points   ?? [];
  const segments: Segment[] = state?.segments ?? [];
  const isClosed = state?.isClosed ?? false;
  if (!isClosed || points.length < 3) return { areaSqm: null, perimM: null };

  // Используем calcScale — он берёт масштаб из lengthCm введённых пользователем
  const scale = calcScale(points, segments);
  if (!scale) return { areaSqm: null, perimM: null };

  const areaPx  = polygonArea(points);
  const areaCm2 = areaPx / (scale * scale);
  const areaM2  = Math.round(areaCm2 / 10000 * 100) / 100;

  const perimPx = polygonPerimeter(points);

  // Если все стороны введены — берём точный периметр из lengthCm
  const allSet = segments.length > 0 && segments.every(s => s.lengthCm !== null && s.lengthCm > 0);
  const perimM = allSet
    ? Math.round(segments.reduce((s, seg) => s + (seg.lengthCm ?? 0), 0) / 100 * 100) / 100
    : Math.round((perimPx / scale) / 100 * 100) / 100;

  return { areaSqm: areaM2, perimM };
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

  // Вычисляем fit: масштаб + смещение чтобы фигура полностью вписалась
  const { fitScale, offX, offY } = useMemo(() => {
    if (!points.length) return { fitScale: 1, offX: 0, offY: 0 };
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pw = maxX - minX || 1, ph = maxY - minY || 1;
    const s = Math.min((width - PAD * 2) / pw, (height - PAD * 2) / ph);
    // Центрируем
    const ox = (width  - pw * s) / 2 - minX * s;
    const oy = (height - ph * s) / 2 - minY * s;
    return { fitScale: s, offX: ox, offY: oy };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points), width, height]);

  const planScale = useMemo(() => calcScale(points, segments), [points, segments]);
  const meta = useMemo(() => getRoomMeta(data), [data]);

  if (points.length < 2) {
    return (
      <div style={{ width: "100%", height: "100%", background: "#0a0a18", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="3" y="3" width="22" height="22" rx="3" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="4 3"/>
        </svg>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Пустой план</span>
      </div>
    );
  }

  const shapePath = buildShapePath(points, segments, isClosed);
  // Трансформ: сначала масштабируем, потом сдвигаем
  const transformStr = `translate(${offX}, ${offY}) scale(${fitScale})`;

  const segLabels = segments.flatMap(seg => {
    if (!seg.showLength) return [];
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return [];
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const lenCm = seg.lengthCm ?? pxToCm(distPx(a, b), planScale);
    if (lenCm === null) return [];
    // Позиция в экранных координатах (после трансформа)
    const sx = mid.x * fitScale + offX + nx * 13;
    const sy = mid.y * fitScale + offY + ny * 13;
    return [{ id: seg.id, x: sx, y: sy, label: `${lenCm} см` }];
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
    // Позиция в экранных координатах
    const sx = pt.x * fitScale + offX + (dx / dl) * 14;
    const sy = pt.y * fitScale + offY + (dy / dl) * 14;
    return { id: pt.id, x: sx, y: sy, label: `${deg}°`, isOdd };
  }) : [];

  const GRID = 18;

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <defs>
          <pattern id="rp-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={0.7} fill="rgba(255,255,255,0.07)"/>
          </pattern>
        </defs>
        <rect width={width} height={height} fill="#0a0a18"/>
        <rect width={width} height={height} fill="url(#rp-grid)"/>

        {/* Фигура в масштабированном пространстве */}
        <g transform={transformStr}>
          {isClosed && points.length >= 3 && (
            <path d={shapePath} fill="rgba(251,191,36,0.1)" stroke="none"/>
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
            <circle key={pt.id} cx={pt.x} cy={pt.y} r={3.5 / fitScale} fill="rgba(255,255,255,0.85)"/>
          ))}
        </g>

        {/* Подписи длин — в экранных координатах */}
        {segLabels.map(l => (
          <text key={l.id} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="rgba(255,255,255,0.6)" fontFamily="monospace" style={{ userSelect: "none" }}>
            {l.label}
          </text>
        ))}

        {/* Угловые метки — в экранных координатах */}
        {angleLabels.map(l => (
          <text key={l.id} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fill={l.isOdd ? "#fb923c" : "rgba(255,255,255,0.4)"} fontFamily="monospace" style={{ userSelect: "none" }}>
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