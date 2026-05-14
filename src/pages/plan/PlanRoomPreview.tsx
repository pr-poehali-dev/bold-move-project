import { useMemo } from "react";
import type { PlanState, Point, Segment } from "./planTypes";
import { buildShapePath, calcScale, distPx, midPoint, segmentNormal, pxToCm, polygonArea, polygonPerimeter } from "./planTypes";

// Отступ вокруг фигуры в единицах исходных координат
// — чтобы подписи углов/длин не уходили за край
const PAD_RATIO = 0.18; // 18% от размера фигуры с каждой стороны

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

  const scale = calcScale(points, segments);
  if (!scale) return { areaSqm: null, perimM: null };

  const areaPx  = polygonArea(points);
  const areaCm2 = areaPx / (scale * scale);
  const areaM2  = Math.round(areaCm2 / 10000 * 100) / 100;

  const allSet = segments.length > 0 && segments.every(s => s.lengthCm !== null && s.lengthCm > 0);
  const perimM = allSet
    ? Math.round(segments.reduce((s, seg) => s + (seg.lengthCm ?? 0), 0) / 100 * 100) / 100
    : Math.round((polygonPerimeter(points) / scale) / 100 * 100) / 100;

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

  // Вычисляем viewBox точно под фигуру + отступ для подписей
  const { vx, vy, vw, vh } = useMemo(() => {
    if (!points.length) return { vx: 0, vy: 0, vw: 100, vh: 100 };
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pw = maxX - minX || 1, ph = maxY - minY || 1;
    const padX = pw * PAD_RATIO;
    const padY = ph * PAD_RATIO;
    return {
      vx: minX - padX,
      vy: minY - padY,
      vw: pw + padX * 2,
      vh: ph + padY * 2,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

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

  // strokeWidth и fontSize в единицах viewBox — адаптируем под размер фигуры
  const strokeW  = Math.max(vw, vh) * 0.006;
  const ptRadius = Math.max(vw, vh) * 0.012;
  const fontSize = Math.max(vw, vh) * 0.045;

  // Подписи длин — в координатах viewBox
  const segLabels = segments.flatMap(seg => {
    if (!seg.showLength) return [];
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return [];
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const lenCm = seg.lengthCm ?? pxToCm(distPx(a, b), planScale);
    if (lenCm === null) return [];
    const offset = Math.max(vw, vh) * 0.07;
    return [{ id: seg.id, x: mid.x + nx * offset, y: mid.y + ny * offset, label: `${lenCm} см` }];
  });

  // Буквенные метки углов — наружу от полигона по биссектрисе угла
  const cx = points.length > 0 ? points.reduce((s, p) => s + p.x, 0) / points.length : 0;
  const cy = points.length > 0 ? points.reduce((s, p) => s + p.y, 0) / points.length : 0;
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const angleLabels = points.map((pt, idx) => {
    const n = points.length;
    const offset = Math.max(vw, vh) * 0.09;
    let ox: number, oy: number;
    if (isClosed && n >= 3) {
      const prev = points[(idx - 1 + n) % n];
      const next = points[(idx + 1) % n];
      const ax = prev.x - pt.x, ay = prev.y - pt.y;
      const bx = next.x - pt.x, by = next.y - pt.y;
      const la = Math.sqrt(ax * ax + ay * ay) || 1;
      const lb = Math.sqrt(bx * bx + by * by) || 1;
      ox = ax / la + bx / lb; oy = ay / la + by / lb;
      const ol = Math.sqrt(ox * ox + oy * oy) || 1;
      ox /= ol; oy /= ol;
      // Инвертируем если направление к центру
      if (ox * (cx - pt.x) + oy * (cy - pt.y) > 0) { ox = -ox; oy = -oy; }
    } else {
      const dx = pt.x - cx, dy = pt.y - cy;
      const dl = Math.sqrt(dx * dx + dy * dy) || 1;
      ox = dx / dl; oy = dy / dl;
    }
    return { id: pt.id, x: pt.x + ox * offset, y: pt.y + oy * offset, label: idx < 26 ? LETTERS[idx] : LETTERS[Math.floor(idx / 26) - 1] + LETTERS[idx % 26] };
  });

  const GRID = Math.max(vw, vh) * 0.08;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0a0a18" }}>
      {/* Сетка — на весь контейнер */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block" }}>
        <defs>
          <pattern id="rp-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={0.8} fill="rgba(255,255,255,0.07)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rp-grid)"/>
      </svg>

      {/* Фигура — viewBox точно под bbox фигуры, meet без пустых полей */}
      <svg
        width="100%" height="100%"
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, display: "block" }}
      >
        {/* Заливка */}
        {isClosed && points.length >= 3 && (
          <path d={shapePath} fill="rgba(251,191,36,0.1)" stroke="none"/>
        )}
        {/* Контур */}
        <path
          d={shapePath}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={strokeW}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Точки */}
        {points.map(pt => (
          <circle key={pt.id} cx={pt.x} cy={pt.y} r={ptRadius} fill="rgba(255,255,255,0.85)"/>
        ))}
        {/* Подписи длин */}
        {segLabels.map(l => (
          <text key={l.id} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={fontSize} fill="rgba(255,255,255,0.65)" fontFamily="monospace">
            {l.label}
          </text>
        ))}
        {/* Буквенные метки углов */}
        {angleLabels.map(l => (
          <text key={l.id} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={fontSize * 0.85} fill="rgba(255,255,255,0.55)" fontFamily="monospace" fontWeight={700}>
            {l.label}
          </text>
        ))}
      </svg>

      {showMeta && (meta.areaSqm !== null || meta.perimM !== null) && (
        <div style={{ position: "relative", display: "flex", gap: 8, padding: "6px 8px 0", fontSize: 12, color: "#6366f1", fontWeight: 600 }}>
          {meta.areaSqm !== null && <span>Площадь {meta.areaSqm} м²</span>}
          {meta.areaSqm !== null && meta.perimM !== null && <span style={{ color: "#9ca3af" }}>•</span>}
          {meta.perimM !== null && <span>Периметр {meta.perimM} м</span>}
        </div>
      )}
    </div>
  );
}