import React, { useState, useRef } from "react";
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
  const label = lenCm !== null ? `${lenCm}` : "";
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
  const text = lenCm !== null ? `${lbl}: ${lenCm}` : lbl;
  return (
    <text key={`lbl-${seg.id}`} x={mid.x + nx * 13} y={mid.y + ny * 13}
      textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#e2e8f0" fontFamily="monospace"
      className="pointer-events-none select-none">{text}</text>
  );
}

// ── SegmentItemsBadges — товары прикреплённые к стене ────────────────────────

interface SegmentItemsBadgesProps {
  seg: Segment;
  ctx: Pick<RenderContext, "points" | "zoom">;
  allSegments: Segment[];
  onRemoveItem?: (segId: string, priceId: number) => void;
  onUpdateQuantity?: (segId: string, priceId: number, quantity: number) => void;
  // Drag между стенами
  onMoveItemToSeg?: (fromSegId: string, priceId: number, toSegId: string) => void;
}

export function SegmentItemsBadges({
  seg, ctx, allSegments, onRemoveItem, onMoveItemToSeg,
}: SegmentItemsBadgesProps) {
  // Хуки — ВСЕГДА до любых return
  const [tooltip, setTooltip] = useState<{ px: number; py: number; name: string; qty: number; unit: string } | null>(null);
  const [dragState, setDragState] = useState<{ priceId: number; x: number; y: number } | null>(null);
  const dblRef  = useRef<{ key: string; t: number }>({ key: "", t: 0 });
  const dragRef = useRef<{ priceId: number; startX: number; startY: number; moved: boolean } | null>(null);

  const items = seg.items;
  if (!items || items.length === 0) return null;
  const a = ctx.points.find(p => p.id === seg.fromId);
  const b = ctx.points.find(p => p.id === seg.toId);
  if (!a || !b) return null;

  const zoom = ctx.zoom ?? 1;
  const mid = midPoint(a, b);
  const { nx, ny } = segmentNormal(a, b);
  const segLen = distPx(a, b) || 1;
  const tx = (b.x - a.x) / segLen;
  const ty = (b.y - a.y) / segLen;

  // Умное масштабирование: иконка пропорциональна стене, но читаема при любом zoom
  // MAX/MIN — в экранных пикселях, переводим в SVG-координаты через /zoom
  const MAX_S_PX = 30;
  const MIN_S_PX = 12;
  const availablePerItem = (segLen * 0.7) / items.length;
  const S_px = Math.min(MAX_S_PX, Math.max(MIN_S_PX, availablePerItem * zoom * 0.8));
  const S   = S_px / zoom; // SVG-координаты
  const GAP = S * 0.22;
  const OFF = S * 0.9;

  const cx = mid.x - nx * OFF;
  const cy = mid.y - ny * OFF;

  const totalW = items.length * S + (items.length - 1) * GAP;
  const startOffset = -totalW / 2 + S / 2;

  return (
    <g key={`seg-items-${seg.id}`}>
      {items.map((item, idx) => {
        const offset = startOffset + idx * (S + GAP);
        const px = cx + tx * offset;
        const py = cy + ty * offset;
        const itemKey = `${seg.id}-${item.priceId}`;
        const hasImg = !!item.imageUrl;

        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          const now = Date.now();
          if (dblRef.current.key === itemKey && now - dblRef.current.t < 400) {
            // Двойной клик — удалить
            dblRef.current = { key: "", t: 0 };
            onRemoveItem?.(seg.id, item.priceId);
          } else {
            dblRef.current = { key: itemKey, t: now };
          }
        };

        // Общая функция поиска ближайшего сегмента и вызова onMoveItemToSeg
        const finishDrag = (finalPx: number, finalPy: number) => {
          let bestSegId: string | null = null;
          let bestDist = Infinity;
          allSegments.forEach(s => {
            const pa = ctx.points.find(p => p.id === s.fromId);
            const pb = ctx.points.find(p => p.id === s.toId);
            if (!pa || !pb) return;
            const mX = (pa.x + pb.x) / 2;
            const mY = (pa.y + pb.y) / 2;
            const { nx: snx, ny: sny } = segmentNormal(pa, pb);
            const bx = mX - snx * OFF;
            const by = mY - sny * OFF;
            const d = Math.hypot(finalPx - bx, finalPy - by);
            if (d < bestDist) { bestDist = d; bestSegId = s.id; }
          });
          if (bestSegId && bestSegId !== seg.id && bestDist < 120) {
            onMoveItemToSeg!(seg.id, item.priceId, bestSegId);
          }
          dragRef.current = null;
          setDragState(null);
        };

        const handleMouseDown = (e: React.MouseEvent) => {
          if (!onMoveItemToSeg) return;
          e.stopPropagation();
          dragRef.current = { priceId: item.priceId, startX: e.clientX, startY: e.clientY, moved: false };
          const onMove = (me: MouseEvent) => {
            if (!dragRef.current) return;
            const dx = Math.abs(me.clientX - dragRef.current.startX);
            const dy = Math.abs(me.clientY - dragRef.current.startY);
            if (dx > 6 || dy > 6) {
              dragRef.current.moved = true;
              setDragState({ priceId: item.priceId, x: px + (me.clientX - dragRef.current.startX), y: py + (me.clientY - dragRef.current.startY) });
              setTooltip(null);
            }
          };
          const onUp = (ue: MouseEvent) => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            if (dragRef.current?.moved) {
              finishDrag(px + (ue.clientX - dragRef.current.startX), py + (ue.clientY - dragRef.current.startY));
            } else {
              dragRef.current = null;
              setDragState(null);
            }
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        };

        const handleTouchStart = (e: React.TouchEvent) => {
          if (!onMoveItemToSeg) return;
          e.stopPropagation();
          const t = e.touches[0];
          dragRef.current = { priceId: item.priceId, startX: t.clientX, startY: t.clientY, moved: false };
        };

        const handleTouchMove = (e: React.TouchEvent) => {
          if (!dragRef.current || dragRef.current.priceId !== item.priceId) return;
          e.stopPropagation();
          const t = e.touches[0];
          const dx = Math.abs(t.clientX - dragRef.current.startX);
          const dy = Math.abs(t.clientY - dragRef.current.startY);
          if (dx > 8 || dy > 8) {
            dragRef.current.moved = true;
            // Конвертируем clientX/Y delta в SVG-координаты через пропорцию
            // Находим SVG-элемент через closest
            const svgEl = (e.target as SVGElement).closest("svg");
            let scaleX = 1, scaleY = 1;
            if (svgEl) {
              const rect = svgEl.getBoundingClientRect();
              const vb = svgEl.viewBox.baseVal;
              scaleX = vb.width / rect.width;
              scaleY = vb.height / rect.height;
            }
            setDragState({
              priceId: item.priceId,
              x: px + (t.clientX - dragRef.current.startX) * scaleX,
              y: py + (t.clientY - dragRef.current.startY) * scaleY,
            });
            setTooltip(null);
          }
        };

        const handleTouchEnd = (e: React.TouchEvent) => {
          if (!dragRef.current || dragRef.current.priceId !== item.priceId) return;
          e.stopPropagation();
          if (dragRef.current.moved && dragState) {
            finishDrag(dragState.x, dragState.y);
          } else {
            // короткий тап — обрабатываем как клик
            handleClick(e as unknown as React.MouseEvent);
            dragRef.current = null;
            setDragState(null);
          }
        };

        return (
          <g key={itemKey}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseEnter={() => !dragRef.current && setTooltip({ px, py, name: item.name, qty: item.quantity ?? 1, unit: item.unit })}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: onMoveItemToSeg ? "grab" : "pointer" }}
          >
            {/* Фон иконки */}
            <rect
              x={px - S / 2} y={py - S / 2} width={S} height={S} rx={6}
              fill="rgba(17,12,36,0.92)" stroke="rgba(124,58,237,0.6)" strokeWidth={1.2}
              style={{ pointerEvents: "all" }}
            />

            {/* Картинка товара */}
            {hasImg ? (
              <image
                href={item.imageUrl!}
                x={px - S / 2 + 2} y={py - S / 2 + 2}
                width={S - 4} height={S - 4}
                preserveAspectRatio="xMidYMid meet"
                style={{ pointerEvents: "none" }}
              />
            ) : (
              <text
                x={px} y={py + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fontWeight={700}
                fill="rgba(196,181,253,0.9)"
                fontFamily="system-ui, sans-serif"
                className="pointer-events-none select-none"
              >
                {item.name.charAt(0).toUpperCase()}
              </text>
            )}

            {/* Подсказка — нативный SVG title (работает везде) */}
            <title>{item.name} · двойной клик = удалить</title>
          </g>
        );
      })}

      {/* Tooltip при hover */}
      {tooltip && (
        <g className="pointer-events-none">
          {/* Треугольник-стрелка вверх */}
          <polygon
            points={`${tooltip.px},${tooltip.py - S / 2 - 2} ${tooltip.px - 5},${tooltip.py - S / 2 - 8} ${tooltip.px + 5},${tooltip.py - S / 2 - 8}`}
            fill="rgba(17,12,36,0.97)"
          />
          <rect
            x={tooltip.px - 68} y={tooltip.py - S / 2 - 30}
            width={136} height={22} rx={6}
            fill="rgba(17,12,36,0.97)" stroke="rgba(124,58,237,0.45)" strokeWidth={1}
          />
          {/* Иконка товара */}
          {items.find(it => it.name === tooltip.name)?.imageUrl && (
            <image
              href={items.find(it => it.name === tooltip.name)!.imageUrl!}
              x={tooltip.px - 64} y={tooltip.py - S / 2 - 28}
              width={16} height={16}
              preserveAspectRatio="xMidYMid meet"
            />
          )}
          <text
            x={tooltip.px} y={tooltip.py - S / 2 - 18}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#e9d5ff" fontFamily="system-ui" fontWeight={600}
          >
            {tooltip.name}
          </text>

        </g>
      )}

      {/* Ghost иконка при drag */}
      {dragState && (() => {
        const dragItem = items.find(it => it.priceId === dragState.priceId);
        if (!dragItem) return null;
        return (
          <g className="pointer-events-none" style={{ opacity: 0.75 }}>
            <rect x={dragState.x - S / 2} y={dragState.y - S / 2} width={S} height={S} rx={6}
              fill="rgba(124,58,237,0.7)" stroke="rgba(196,181,253,0.9)" strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            {dragItem.imageUrl && (
              <image href={dragItem.imageUrl} x={dragState.x - S / 2 + 2} y={dragState.y - S / 2 + 2}
                width={S - 4} height={S - 4} preserveAspectRatio="xMidYMid meet" />
            )}
          </g>
        );
      })()}
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

// Строим упорядоченную цепочку точек через сегменты (кэш на уровне вызова)
function buildChainFromSegments(points: import("./planTypes").Point[], segments: import("./planTypes").Segment[]): string[] | null {
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

export function renderAngleLabel(pt: import("./planTypes").Point, idx: number, ctx: Pick<RenderContext, "points" | "segments" | "isClosed" | "showAngleLabels">) {
  const { points, segments, isClosed, showAngleLabels } = ctx;
  if (!showAngleLabels || !isClosed) return null;

  // Строим правильную цепочку через сегменты
  const chain = buildChainFromSegments(points, segments);
  const orderedPoints = chain ? chain.map(id => points.find(p => p.id === id)!) : points;
  const n = orderedPoints.length;

  // Находим индекс точки в упорядоченной цепочке
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
        // Умный offset: адаптируем под длину стены и zoom
        // Чем короче стена — тем дальше выносим метку, но в SVG-координатах
        // делим на zoom чтобы метка оставалась читаемой при любом масштабе
        const zoom = state.settings?.zoom ?? 1;
        const BASE_OFF = 14; // базовый отступ в экранных пикселях
        const svgOff = BASE_OFF / zoom; // переводим в SVG-координаты
        // Для коротких стен добавляем вынос — но не более 60px в SVG
        const extraOff = segLen < 20 / zoom
          ? Math.min(60 / zoom, 30 / zoom)
          : segLen < 50 / zoom
            ? Math.min(40 / zoom, 20 / zoom)
            : 0;
        const off = svgOff + extraOff;
        const lx = mid.x + nx * off;
        const ly = mid.y + ny * off;

        const lenCm = seg.lengthCm ?? null;
        if (lenCm === null) return null;
        const displayText = `${lenCm}`;

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
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}></span>
              </div>
            </foreignObject>
          );
        }

        // Размер шрифта и бокса — фиксированный в экранных пикселях (делим на zoom)
        const fs = Math.round(10 / zoom);
        const charW = fs * 0.65;
        const textW = Math.max(fs * 3.8, displayText.length * charW + fs);
        const boxH = fs * 1.8;
        const boxR = fs * 0.4;

        return (
          <g key={seg.id} style={{ cursor: "text" }}
            onClick={e => {
              e.stopPropagation();
              setEditingId(seg.id);
              setDraft(seg.lengthCm !== null ? String(seg.lengthCm) : "");
            }}>
            {/* Линия-выноска для коротких стен */}
            {(extraOff > 0) && (
              <line x1={mid.x} y1={mid.y} x2={lx} y2={ly}
                stroke="rgba(255,255,255,0.2)" strokeWidth={0.6 / zoom} strokeDasharray={`${3/zoom} ${2/zoom}`}
                className="pointer-events-none" />
            )}
            <rect x={lx - textW / 2 - fs * 0.6} y={ly - boxH / 2 - fs * 0.3} width={textW + fs * 1.2} height={boxH + fs * 0.6}
              rx={boxR} fill="transparent" />
            <rect x={lx - textW / 2} y={ly - boxH / 2} width={textW} height={boxH} rx={boxR}
              fill="rgba(17,17,17,0.85)" stroke="rgba(255,255,255,0.2)" strokeWidth={0.7 / zoom} />
            <text x={lx} y={ly + fs * 0.05}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={fs} fontFamily="monospace" fontWeight={700}
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