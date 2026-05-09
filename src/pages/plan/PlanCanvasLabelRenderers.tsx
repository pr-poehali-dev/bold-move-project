import React from "react";
import type { Segment, DiagonalDef, DimLine, PlanState } from "./planTypes";
import {
  pointLabel, segmentLabel, distPx, midPoint, segmentNormal,
  pxToCm, calcScale, angleDeg, polygonOrientation,
} from "./planTypes";
import type { RenderContext, SegmentHandlers } from "./PlanCanvasTypes";
import { DIM_OFF } from "./PlanCanvasUtils";

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

// ── SegmentItemsBadges — товары прикреплённые к стене (компонент с попапом) ──

interface SegmentItemsBadgesProps {
  seg: Segment;
  ctx: Pick<RenderContext, "points">;
  allSegments: Segment[]; // для подсчёта суммы по всему потолку
  onRemoveItem?: (segId: string, priceId: number) => void;
  onUpdateQuantity?: (segId: string, priceId: number, quantity: number) => void;
}

export function SegmentItemsBadges({
  seg, ctx, allSegments,
}: SegmentItemsBadgesProps) {
  const items = seg.items;
  if (!items || items.length === 0) return null;
  const a = ctx.points.find(p => p.id === seg.fromId);
  const b = ctx.points.find(p => p.id === seg.toId);
  if (!a || !b) return null;

  const mid = midPoint(a, b);
  const { nx, ny } = segmentNormal(a, b);
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const na    = angle > 90 || angle < -90 ? angle + 180 : angle;

  const W   = 148;
  const H   = 24;
  const GAP = 5;
  const OFF = 28;

  const totalH    = items.length * H + (items.length - 1) * GAP;
  const startOff  = -(totalH / 2) + H / 2;
  const segLen    = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux        = (b.x - a.x) / segLen;
  const uy        = (b.y - a.y) / segLen;

  return (
    <g key={`seg-items-${seg.id}`}>
      {items.map((item, idx) => {
        const along = startOff + idx * (H + GAP);
        const px    = mid.x - nx * OFF + ux * along;
        const py    = mid.y - ny * OFF + uy * along;
        const label = item.name.length > 14 ? item.name.slice(0, 12) + "…" : item.name;
        const itemKey = `${seg.id}-${item.priceId}`;
        const qty   = item.quantity ?? 1;

        // Суммарное кол-во этого товара по всему потолку
        const totalQty = allSegments.reduce((sum, s) => {
          const found = (s.items ?? []).find(it => it.priceId === item.priceId);
          return sum + (found ? (found.quantity ?? 1) : 0);
        }, 0);

        return (
          <g key={itemKey} transform={`translate(${px},${py}) rotate(${na})`}>
            {/* Фон-таблетка */}
            <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={8}
              fill="rgba(17,12,36,0.92)" stroke="rgba(124,58,237,0.55)" strokeWidth={1}
              style={{ pointerEvents: "none" }}
            />

            {/* Картинка */}
            {item.imageUrl && (
              <image href={item.imageUrl} x={-W / 2 + 5} y={-9} width={18} height={18}
                preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none" }} />
            )}

            {/* Название */}
            <text x={item.imageUrl ? -W / 2 + 28 : -W / 2 + 8} y={4}
              fontSize={9} fill="rgba(196,181,253,0.95)"
              fontFamily="system-ui, sans-serif" fontWeight={500}
              className="pointer-events-none select-none">
              {label}
            </text>

            {/* Счётчик: количество на этой стене / итого по потолку */}
            <g style={{ pointerEvents: "none" }}>
              <rect x={W / 2 - 40} y={-H / 2 + 3} width={30} height={H - 6} rx={4}
                fill="rgba(124,58,237,0.22)" stroke="rgba(124,58,237,0.4)" strokeWidth={0.6} />
              <text x={W / 2 - 25} y={4} textAnchor="middle"
                fontSize={8.5} fontWeight={700} fill="rgba(196,181,253,0.9)"
                fontFamily="monospace" className="select-none">
                {qty}/{totalQty}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

// Обёртка-функция для обратной совместимости (используется в старых местах)
export function renderSegmentItems(
  seg: Segment,
  ctx: Pick<RenderContext, "points">,
  onRemoveItem?: (segId: string, priceId: number) => void,
) {
  return <SegmentItemsBadges seg={seg} ctx={ctx} allSegments={[seg]} onRemoveItem={onRemoveItem} />;
}

// ── renderAngleLabel ──────────────────────────────────────────────────────────

export function renderAngleLabel(pt: import("./planTypes").Point, idx: number, ctx: Pick<RenderContext, "points" | "isClosed" | "showAngleLabels">) {
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

export function renderCornerArc(pt: import("./planTypes").Point, idx: number, radiusPx: number, ctx: Pick<RenderContext, "points" | "isClosed" | "selectedArcId">) {
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
        const segLen = distPx(a, b);
        const off = segLen < 30 ? 36 : segLen < 60 ? 24 : 14;
        const lx = mid.x + nx * off;
        const ly = mid.y + ny * off;

        const lenCm = seg.lengthCm ?? null;
        if (lenCm === null) return null;
        const displayText = `${lenCm} см`;

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
                    background: "rgba(17,17,30,0.95)", color: "rgba(255,255,255,0.9)",
                    border: "1px solid rgba(124,58,237,0.6)", borderRadius: 6,
                    padding: "0 6px",
                    fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                    outline: "none",
                    boxShadow: "0 0 10px rgba(124,58,237,0.3), 0 2px 10px rgba(0,0,0,0.6)",
                  }}
                />
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>см</span>
              </div>
            </foreignObject>
          );
        }

        const textW = Math.max(38, displayText.length * 6.5 + 10);

        return (
          <g key={seg.id} style={{ cursor: "text" }}
            onClick={e => {
              e.stopPropagation();
              setEditingId(seg.id);
              setDraft(seg.lengthCm !== null ? String(seg.lengthCm) : "");
            }}>
            {segLen < 30 && (
              <line x1={mid.x} y1={mid.y} x2={lx} y2={ly}
                stroke="rgba(255,255,255,0.2)" strokeWidth={0.8} strokeDasharray="2 2"
                className="pointer-events-none" />
            )}
            <rect x={lx - textW / 2 - 6} y={ly - 12} width={textW + 12} height={24}
              rx={5} fill="transparent" />
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