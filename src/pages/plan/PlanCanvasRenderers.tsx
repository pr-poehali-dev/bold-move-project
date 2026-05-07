import React from "react";
import type { Point, Segment, DiagonalDef, DimLine, PlanState } from "./planTypes";
import {
  pointLabel, segmentLabel, distPx, midPoint, segmentNormal,
  pxToCm, calcScale, angleDeg, polygonOrientation, buildAutoDiagonals,
} from "./planTypes";
import Icon from "@/components/ui/icon";
import { DIM_OFF, PT_R, PT_HIT } from "./PlanCanvasUtils";

// ── Типы для render-пропсов ───────────────────────────────────────────────────

export interface RenderContext {
  points: Point[];
  segments: Segment[];
  diagonals: DiagonalDef[];
  dimLines: DimLine[];
  scale: number | null;
  isClosed: boolean;
  tool: string;
  showDimLines: boolean;
  showSegmentLabels: boolean;
  showAngleLabels: boolean;
  showDiagonals: boolean;
  showPoints: boolean;
  showPointLabels: boolean;
  selectedPointId: string | null;
  selectedSegmentId: string | null;
  selectedDiagonalId: string | null;
  selectedArcId: string | null;
  selectedDimLineId: string | null;
  ghost: { x: number; y: number; willClose: boolean } | null;
  dimLineFrom: string | null;
  zoom: number;
  phase: string;
  activeInputIndex?: number;
}

export interface SegmentHandlers {
  onSegmentClick: (e: React.MouseEvent, segId: string) => void;
  onSegmentCtxMenu: (e: React.MouseEvent, segId: string) => void;
  onDimLineClick: (e: React.MouseEvent, dlId: string) => void;
  onDiagonalClick: (e: React.MouseEvent, diagId: string) => void;
  onPointClick: (e: React.MouseEvent, pointId: string) => void;
  onPointMouseDown: (e: React.MouseEvent, pointId: string) => void;
  onPointCtxMenu: (e: React.MouseEvent, pointId: string) => void;
}

// ── CtxItem ───────────────────────────────────────────────────────────────────

export function CtxItem({
  icon, label, onClick, danger = false,
}: {
  icon: string; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition hover:bg-white/[0.06] ${danger ? "text-rose-400" : "text-white/70"}`}>
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}

// ── renderDimLine ─────────────────────────────────────────────────────────────

export function renderDimLine(seg: Segment, ctx: Pick<RenderContext, "points" | "scale" | "showDimLines">) {
  const { points, scale, showDimLines } = ctx;
  if (!showDimLines || !seg.showDimLine) return null;
  const a = points.find(p => p.id === seg.fromId);
  const b = points.find(p => p.id === seg.toId);
  if (!a || !b) return null;
  const { nx, ny } = segmentNormal(a, b);
  const off = DIM_OFF;
  const x1 = a.x + nx * off, y1 = a.y + ny * off;
  const x2 = b.x + nx * off, y2 = b.y + ny * off;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const lenCm = seg.lengthCm ?? null;
  const label = lenCm !== null ? `${lenCm} см` : "";
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const na = angle > 90 || angle < -90 ? angle + 180 : angle;
  return (
    <g key={`dim-${seg.id}`} className="pointer-events-none">
      <line x1={a.x + nx * (off - 7)} y1={a.y + ny * (off - 7)} x2={a.x + nx * (off + 7)} y2={a.y + ny * (off + 7)} stroke="#60a5fa" strokeWidth={1} />
      <line x1={b.x + nx * (off - 7)} y1={b.y + ny * (off - 7)} x2={b.x + nx * (off + 7)} y2={b.y + ny * (off + 7)} stroke="#60a5fa" strokeWidth={1} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 2" />
      {label && <text x={mx} y={my} transform={`rotate(${na},${mx},${my})`} textAnchor="middle" dominantBaseline="auto" dy={-5} fontSize={10} fill="#93c5fd" fontFamily="monospace">{label}</text>}
    </g>
  );
}

// ── renderSegmentLabel ────────────────────────────────────────────────────────

export function renderSegmentLabel(seg: Segment, ctx: Pick<RenderContext, "points" | "scale" | "showSegmentLabels">) {
  const { points, scale, showSegmentLabels } = ctx;
  if (!showSegmentLabels || !seg.showLength) return null;
  const a = points.find(p => p.id === seg.fromId);
  const b = points.find(p => p.id === seg.toId);
  if (!a || !b) return null;
  const mid = midPoint(a, b);
  const { nx, ny } = segmentNormal(a, b);
  const lbl = segmentLabel(points, seg);
  const lenCm = seg.lengthCm ?? null;
  const text = lenCm !== null ? `${lbl}: ${lenCm} см` : lbl;
  return (
    <text key={`lbl-${seg.id}`} x={mid.x + nx * 13} y={mid.y + ny * 13}
      textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#e2e8f0" fontFamily="monospace"
      className="pointer-events-none select-none">{text}</text>
  );
}

// ── renderAngleLabel ──────────────────────────────────────────────────────────

export function renderAngleLabel(pt: Point, idx: number, ctx: Pick<RenderContext, "points" | "isClosed" | "showAngleLabels">) {
  const { points, isClosed, showAngleLabels } = ctx;
  if (!showAngleLabels || !isClosed) return null;
  const n = points.length;
  const prev = points[(idx - 1 + n) % n];
  const next = points[(idx + 1) % n];
  const isCW = polygonOrientation(points) > 0;
  const deg = angleDeg(prev, pt, next, isCW);
  const ax = ((prev.x - pt.x) + (next.x - pt.x)) / 2;
  const ay = ((prev.y - pt.y) + (next.y - pt.y)) / 2;
  const alen = Math.sqrt(ax * ax + ay * ay) || 1;
  const isOdd = Math.abs(deg - Math.round(deg / 90) * 90) > 1.5;
  return (
    <text key={`ang-${pt.id}`} x={pt.x + (ax / alen) * 26} y={pt.y + (ay / alen) * 26}
      textAnchor="middle" dominantBaseline="middle" fontSize={10}
      fill={isOdd ? "#fb923c" : "#fbbf24"} fontFamily="monospace"
      className="pointer-events-none select-none">{deg}°</text>
  );
}

// ── renderCornerArc ───────────────────────────────────────────────────────────

export function renderCornerArc(pt: Point, idx: number, radiusPx: number, ctx: Pick<RenderContext, "points" | "isClosed" | "selectedArcId">) {
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
      {lenCm !== null && <text x={mx} y={my} transform={`rotate(${na},${mx},${my})`} textAnchor="middle" dominantBaseline="auto" dy={-5} fontSize={10} fill={col} fontFamily="monospace" className="select-none">{lenCm} см</text>}
    </g>
  );
}

// ── Рендер точек ─────────────────────────────────────────────────────────────

export function renderPoints(ctx: RenderContext, handlers: SegmentHandlers) {
  const {
    points, segments, isClosed, tool,
    showPoints, showPointLabels,
    selectedPointId, ghost,
  } = ctx;
  if (!showPoints) return null;
  // Центр фигуры для определения направления меток наружу
  const cx = points.length > 0 ? points.reduce((s, p) => s + p.x, 0) / points.length : 0;
  const cy = points.length > 0 ? points.reduce((s, p) => s + p.y, 0) / points.length : 0;

  return points.map((pt, idx) => {
    const isSel = pt.id === selectedPointId;
    const isFirst = idx === 0;
    const seg = segments.find(s => s.toId === pt.id);
    const hasArc = seg ? seg.arcRadius > 0 : false;

    // Направление метки — от центра фигуры наружу
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const dlen = Math.sqrt(dx * dx + dy * dy) || 1;
    const lx = pt.x + (dx / dlen) * 14;
    const ly = pt.y + (dy / dlen) * 14;

    return (
      <g key={pt.id}
        style={{ cursor: tool === "move" ? "grab" : tool === "delete" ? "not-allowed" : "pointer" }}
        onClick={e => handlers.onPointClick(e, pt.id)}
        onMouseDown={e => handlers.onPointMouseDown(e, pt.id)}
        onContextMenu={e => handlers.onPointCtxMenu(e, pt.id)}
      >
        <circle cx={pt.x} cy={pt.y} r={PT_HIT} fill="transparent" />
        {(isSel || (ghost?.willClose && isFirst)) && (
          <circle cx={pt.x} cy={pt.y} r={PT_R + 6} fill="none"
            stroke={ghost?.willClose && isFirst ? "#34d399" : "#c4b5fd"} strokeWidth={1.5} opacity={0.5} />
        )}
        {hasArc && !isSel && (
          <circle cx={pt.x} cy={pt.y} r={PT_R + 3} fill="none" stroke="#10b981" strokeWidth={1} opacity={0.4} />
        )}
        <circle cx={pt.x} cy={pt.y} r={PT_R}
          fill={isSel ? "#c4b5fd" : isFirst && !isClosed ? "#34d399" : "#7c3aed"}
          stroke={isSel ? "#a78bfa" : "#4c1d95"} strokeWidth={2} />
        {showPointLabels && (
          <text x={lx} y={ly} fontSize={11} fontWeight={700} fill="#e2e8f0" fontFamily="monospace"
            textAnchor="middle" dominantBaseline="middle"
            className="pointer-events-none select-none">{pointLabel(idx)}</text>
        )}
      </g>
    );
  });
}

// ── Рендер диагоналей ────────────────────────────────────────────────────────

export function renderDiagonals(ctx: RenderContext, handlers: Pick<SegmentHandlers, "onDiagonalClick">) {
  const { points, diagonals, scale, tool, showDiagonals, selectedDiagonalId } = ctx;
  if (!showDiagonals) return null;
  return diagonals.filter(d => d.visible).map(diag => {
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
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16}
          style={{ cursor: tool === "delete" ? "not-allowed" : "pointer" }}
          onClick={e => handlers.onDiagonalClick(e, diag.id)}
        />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isSel ? "#fb923c" : "#92400e"} strokeWidth={isSel ? 1.8 : 1.2} strokeDasharray="7 4" className="pointer-events-none" />
        {diag.showLength && lenCm !== null && (
          <text x={mid.x + 4} y={mid.y - 5} fontSize={9.5} fill={isSel ? "#fb923c" : "#f59e0b"} fontFamily="monospace" className="pointer-events-none select-none">{lbl}: {lenCm} см</text>
        )}
      </g>
    );
  });
}

// ── Inline-edit размеров прямо на чертеже ─────────────────────────────────────

interface InlineDimProps {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

export function InlineDimLabels({ state, onChange }: InlineDimProps) {
  const { points, segments, diagonals } = state;
  const scale = calcScale(points, segments);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const commitEdit = (segId: string) => {
    const val = parseFloat(draft);
    if (!isNaN(val) && val > 0) {
      const newSegments = segments.map(s => s.id === segId ? { ...s, lengthCm: val } : s);
      // Точки не двигаем — только сохраняем lengthCm и baseScale
      let baseScale = state.baseScale ?? null;
      if (!baseScale) {
        const seg = segments.find(s => s.id === segId);
        if (seg) {
          const a = points.find(p => p.id === seg.fromId);
          const b = points.find(p => p.id === seg.toId);
          if (a && b) {
            const px = distPx(a, b);
            if (px > 0) baseScale = px / val;
          }
        }
      }
      onChange({ segments: newSegments, baseScale: baseScale ?? undefined });
    }
    setEditingId(null);
    setDraft("");
  };

  const cancelEdit = () => { setEditingId(null); setDraft(""); };

  return (
    <>
      {segments.map(seg => {
        const a = points.find(p => p.id === seg.fromId);
        const b = points.find(p => p.id === seg.toId);
        if (!a || !b) return null;

        const mid = midPoint(a, b);
        const { nx, ny } = segmentNormal(a, b);
        // Смещение по нормали: минимум 14px, но увеличиваем для коротких отрезков
        const segLen = distPx(a, b);
        const off = Math.max(14, 28 - segLen * 0.3);
        const lx = mid.x + nx * off;
        const ly = mid.y + ny * off;

        const lenCm = seg.lengthCm ?? null;
        const displayText = lenCm !== null ? `${lenCm} см` : "—";

        const isEditing = editingId === seg.id;

        if (isEditing) {
          return (
            <foreignObject key={seg.id} x={lx - 34} y={ly - 13} width={68} height={26}
              style={{ overflow: "visible" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <input
                  ref={inputRef}
                  type="number"
                  min={1} max={99999} step={0.5}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={() => commitEdit(seg.id)}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitEdit(seg.id);
                    if (e.key === "Escape") cancelEdit();
                    e.stopPropagation();
                  }}
                  style={{
                    width: 54, height: 24,
                    background: "#fff", color: "#111",
                    border: "none", borderRadius: 6,
                    padding: "0 6px",
                    fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                    outline: "none",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.6)",
                  }}
                />
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>см</span>
              </div>
            </foreignObject>
          );
        }

        // Ширина метки зависит от длины текста
        const textW = Math.max(38, displayText.length * 6.5 + 10);

        return (
          <g key={seg.id} style={{ cursor: "text" }}
            onClick={e => {
              e.stopPropagation();
              setEditingId(seg.id);
              setDraft(seg.lengthCm !== null ? String(seg.lengthCm) : "");
            }}>
            {/* Зона клика */}
            <rect x={lx - textW / 2 - 6} y={ly - 12} width={textW + 12} height={24}
              rx={5} fill="transparent" />
            {/* Фон метки */}
            <rect x={lx - textW / 2} y={ly - 9} width={textW} height={18} rx={4}
              fill="rgba(17,17,17,0.8)" stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} />
            <text x={lx} y={ly + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={10} fontFamily="monospace" fontWeight={700}
              fill="rgba(255,255,255,0.9)"
              className="select-none pointer-events-none">
              {displayText}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ── Рендер отрезков (зоны клика) ─────────────────────────────────────────────

export function renderSegments(ctx: RenderContext, handlers: Pick<SegmentHandlers, "onSegmentClick" | "onSegmentCtxMenu">) {
  const { points, segments, tool, selectedSegmentId } = ctx;
  return segments.map(seg => {
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return null;
    const isSel = seg.id === selectedSegmentId;
    return (
      <g key={seg.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={20}
          style={{ cursor: tool === "delete" ? "not-allowed" : "pointer" }}
          onClick={e => handlers.onSegmentClick(e, seg.id)}
          onContextMenu={e => handlers.onSegmentCtxMenu(e, seg.id)}
        />
        {isSel && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c4b5fd" strokeWidth={3} strokeDasharray="6 3" className="pointer-events-none" />}
      </g>
    );
  });
}

// ── Рендер ghost-линий ───────────────────────────────────────────────────────

export function renderGhost(ctx: RenderContext) {
  const { ghost, tool, points, dimLineFrom } = ctx;
  if (!ghost) return null;
  return (
    <>
      {/* Ghost для draw */}
      {tool === "draw" && points.length > 0 && (
        <line x1={points[points.length - 1].x} y1={points[points.length - 1].y}
          x2={ghost.x} y2={ghost.y}
          stroke={ghost.willClose ? "#34d399" : "#818cf8"} strokeWidth={1.5} strokeDasharray="6 4" className="pointer-events-none" />
      )}
      {tool === "draw" && (
        <circle cx={ghost.x} cy={ghost.y} r={ghost.willClose ? 11 : 4}
          fill={ghost.willClose ? "rgba(52,211,153,0.2)" : "rgba(129,140,248,0.3)"}
          stroke={ghost.willClose ? "#34d399" : "#818cf8"} strokeWidth={1.5} className="pointer-events-none" />
      )}
      {/* Ghost для dimline */}
      {tool === "dimline" && dimLineFrom && (() => {
        const fromPt = points.find(p => p.id === dimLineFrom);
        if (!fromPt) return null;
        const { nx, ny } = segmentNormal(fromPt, { id: "", x: ghost.x, y: ghost.y });
        const off = DIM_OFF;
        const x1 = fromPt.x + nx * off, y1 = fromPt.y + ny * off;
        const x2 = ghost.x + nx * off, y2 = ghost.y + ny * off;
        return (
          <g className="pointer-events-none">
            <line x1={fromPt.x + nx*(off-6)} y1={fromPt.y + ny*(off-6)} x2={fromPt.x + nx*(off+6)} y2={fromPt.y + ny*(off+6)} stroke="#a78bfa" strokeWidth={1} opacity={0.6} />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7} />
            <circle cx={ghost.x} cy={ghost.y} r={5} fill="rgba(167,139,250,0.25)" stroke="#a78bfa" strokeWidth={1.5} />
          </g>
        );
      })()}
    </>
  );
}

// ── Рендер подсказок и подсветки dimline ─────────────────────────────────────

export function renderHints(ctx: RenderContext) {
  const { tool, phase, isClosed, points, dimLineFrom, zoom } = ctx;
  return (
    <>
      {tool === "draw" && phase === "draw" && !isClosed && (
        <text x={12 / zoom} y={28 / zoom} fontSize={12 / zoom} fill="rgba(255,255,255,0.25)" fontFamily="sans-serif" className="pointer-events-none select-none">
          {points.length === 0 ? "Нажми чтобы поставить первую точку"
            : points.length < 3 ? `Ещё ${3 - points.length} точки минимум`
            : "Нажми зелёную точку чтобы замкнуть"}
        </text>
      )}
      {tool === "arc" && isClosed && (
        <text x={12 / zoom} y={28 / zoom} fontSize={12 / zoom} fill="rgba(16,185,129,0.55)" fontFamily="sans-serif" className="pointer-events-none select-none">
          Нажми на отрезок чтобы добавить скругление
        </text>
      )}
      {tool === "move" && (
        <text x={12 / zoom} y={28 / zoom} fontSize={12 / zoom} fill="rgba(255,255,255,0.2)" fontFamily="sans-serif" className="pointer-events-none select-none">
          Зажми и тяни точку пальцем
        </text>
      )}
      {tool === "dimline" && (
        <text x={12 / zoom} y={28 / zoom} fontSize={12 / zoom} fill="rgba(167,139,250,0.6)" fontFamily="sans-serif" className="pointer-events-none select-none">
          {dimLineFrom ? "Теперь нажми вторую точку" : "Нажми первую точку размера"}
        </text>
      )}
      {tool === "dimline" && dimLineFrom && (() => {
        const pt = points.find(p => p.id === dimLineFrom);
        if (!pt) return null;
        return <circle cx={pt.x} cy={pt.y} r={PT_R + 8} fill="none" stroke="#a78bfa" strokeWidth={2} opacity={0.7} strokeDasharray="3 2" className="pointer-events-none" />;
      })()}
    </>
  );
}