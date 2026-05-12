import React, { useMemo } from "react";
import type { PlanState, Point, Segment } from "./planTypes";
import { buildShapePath, calcScale, distPx, midPoint, segmentNormal, pxToCm } from "./planTypes";

const PAD = 24; // отступ внутри превью
const GRID = 20; // шаг сетки в px превью

interface Props {
  data: object; // PlanState из БД
  width?: number;
  height?: number;
}

function fitToBox(
  points: Point[],
  boxW: number,
  boxH: number,
  pad: number
): { tx: (x: number) => number; ty: (y: number) => number; scale: number } {
  if (points.length === 0) {
    return { tx: x => x, ty: y => y, scale: 1 };
  }
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scaleX = (boxW - pad * 2) / w;
  const scaleY = (boxH - pad * 2) / h;
  const s = Math.min(scaleX, scaleY);
  const offX = (boxW - w * s) / 2 - minX * s;
  const offY = (boxH - h * s) / 2 - minY * s;
  return {
    tx: (x: number) => x * s + offX,
    ty: (y: number) => y * s + offY,
    scale: s,
  };
}

export default function PlanRoomPreview({ data, width = 260, height = 160 }: Props) {
  const state = data as PlanState;
  const points: Point[]   = state?.points   ?? [];
  const segments: Segment[] = state?.segments ?? [];
  const isClosed = state?.isClosed ?? false;

  const { tx, ty, scale: fitScale } = useMemo(
    () => fitToBox(points, width, height, PAD),
     
    [points, width, height]
  );

  const planScale = useMemo(() => calcScale(points, segments), [points, segments]);

  if (points.length < 2) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2"
        style={{ width, height, background: "#f8f8fb", borderRadius: 8 }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="4" y="4" width="24" height="24" rx="3" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4 3"/>
        </svg>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>Пустой план</span>
      </div>
    );
  }

  // Путь контура
  const shapePath = buildShapePath(points, segments, isClosed);

  // Масштабированный path: применяем tx/ty через transform на группе
  const minXpt = Math.min(...points.map(p => p.x));
  const minYpt = Math.min(...points.map(p => p.y));

  // Подписи длин отрезков
  const segLabels = segments.map(seg => {
    if (!seg.showLength) return null;
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return null;
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const lenCm = seg.lengthCm ?? pxToCm(distPx(a, b), planScale);
    if (lenCm === null) return null;
    const lx = tx(mid.x) + nx * 12;
    const ly = ty(mid.y) + ny * 12;
    return { id: seg.id, lx, ly, label: `${lenCm} см` };
  }).filter(Boolean) as { id: string; lx: number; ly: number; label: string }[];

  // Угловые метки
  const angleLabels = isClosed ? points.map((pt, idx) => {
    const n = points.length;
    const prev = points[(idx - 1 + n) % n];
    const next = points[(idx + 1) % n];
    const ax = (prev.x - pt.x), ay = (prev.y - pt.y);
    const bx = (next.x - pt.x), by = (next.y - pt.y);
    const dot = ax * bx + ay * by;
    const lenA = Math.sqrt(ax * ax + ay * ay) || 1;
    const lenB = Math.sqrt(bx * bx + by * by) || 1;
    const cosA = Math.max(-1, Math.min(1, dot / (lenA * lenB)));
    const deg = Math.round(Math.acos(cosA) * 180 / Math.PI);
    const isOdd = Math.abs(deg - Math.round(deg / 90) * 90) > 1.5;
    const dirX = (ax / lenA + bx / lenB);
    const dirY = (ay / lenA + by / lenB);
    const dl = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    return {
      id: pt.id,
      x: tx(pt.x) + (dirX / dl) * 14,
      y: ty(pt.y) + (dirY / dl) * 14,
      label: `${deg}°`,
      isOdd,
    };
  }) : [];

  // Трансформ: перевести точки из исходного пространства в превью-координаты
  const transformStr = `translate(${tx(minXpt) - minXpt * fitScale}, ${ty(minYpt) - minYpt * fitScale}) scale(${fitScale})`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", background: "#fff", borderRadius: 8 }}
    >
      <defs>
        <pattern id={`grid-preview`} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
        </pattern>
      </defs>

      {/* Белый фон + сетка */}
      <rect width={width} height={height} fill="url(#grid-preview)" />

      {/* Группа с трансформом подгонки */}
      <g transform={transformStr}>
        {/* Заливка */}
        {isClosed && points.length >= 3 && (
          <path d={shapePath} fill="rgba(252,211,77,0.15)" stroke="none" />
        )}
        {/* Контур */}
        <path
          d={shapePath}
          fill="none"
          stroke={isClosed ? "#f59e0b" : "#f59e0b"}
          strokeWidth={2 / fitScale}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Точки */}
        {points.map(pt => (
          <circle
            key={pt.id}
            cx={pt.x} cy={pt.y}
            r={3 / fitScale}
            fill="#1e293b"
          />
        ))}
      </g>

      {/* Подписи длин (в координатах превью, поверх трансформа) */}
      {segLabels.map(l => (
        <text
          key={l.id}
          x={l.lx} y={l.ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="#374151"
          fontFamily="monospace"
          style={{ userSelect: "none" }}
        >
          {l.label}
        </text>
      ))}

      {/* Угловые метки */}
      {angleLabels.map(l => (
        <text
          key={l.id}
          x={l.x} y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill={l.isOdd ? "#ef4444" : "#6b7280"}
          fontFamily="monospace"
          style={{ userSelect: "none" }}
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}
