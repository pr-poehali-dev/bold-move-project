import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import type { Segment, DiagonalDef, DimLine, PlanState } from "./planTypes";
import {
  pointLabel, segmentLabel, distPx, midPoint, segmentNormal,
  pxToCm, calcScale, angleDeg, polygonOrientation,
} from "./planTypes";
import type { RenderContext, SegmentHandlers } from "./PlanCanvasTypes";
import { DIM_OFF } from "./PlanCanvasUtils";

// ── renderDimLine ─────────────────────────────────────────────────────────────

export function renderDimLine(seg: Segment, ctx: Pick<RenderContext, "points" | "scale" | "showDimLines" | "zoom">) {
  const { points, showDimLines, zoom } = ctx;
  if (!showDimLines || !seg.showDimLine) return null;
  const a = points.find(p => p.id === seg.fromId);
  const b = points.find(p => p.id === seg.toId);
  if (!a || !b) return null;
  const z = zoom ?? 1;
  const { nx, ny } = segmentNormal(a, b);
  const off  = DIM_OFF / z;
  const tick = 7 / z;
  const sw   = 1 / z;
  const fs   = 10 / z;
  const dy   = -5 / z;
  const x1 = a.x + nx * off, y1 = a.y + ny * off;
  const x2 = b.x + nx * off, y2 = b.y + ny * off;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const lenCm = seg.lengthCm ?? null;
  const label = lenCm !== null ? `${lenCm}` : "";
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const na = angle > 90 || angle < -90 ? angle + 180 : angle;
  return (
    <g key={`dim-${seg.id}`} className="pointer-events-none">
      <line x1={a.x + nx * (off - tick)} y1={a.y + ny * (off - tick)} x2={a.x + nx * (off + tick)} y2={a.y + ny * (off + tick)} stroke="#60a5fa" strokeWidth={sw} />
      <line x1={b.x + nx * (off - tick)} y1={b.y + ny * (off - tick)} x2={b.x + nx * (off + tick)} y2={b.y + ny * (off + tick)} stroke="#60a5fa" strokeWidth={sw} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60a5fa" strokeWidth={sw} strokeDasharray={`${4/z} ${2/z}`} />
      {label && <text x={mx} y={my} transform={`rotate(${na},${mx},${my})`} textAnchor="middle" dominantBaseline="auto" dy={dy} fontSize={fs} fill="#93c5fd" fontFamily="monospace">{label}</text>}
    </g>
  );
}

// ── renderSegmentLabel ────────────────────────────────────────────────────────

export function renderSegmentLabel(seg: Segment, ctx: Pick<RenderContext, "points" | "scale" | "showSegmentLabels" | "zoom">) {
  const { points, showSegmentLabels, zoom } = ctx;
  if (!showSegmentLabels || !seg.showLength) return null;
  const a = points.find(p => p.id === seg.fromId);
  const b = points.find(p => p.id === seg.toId);
  if (!a || !b) return null;
  const z = zoom ?? 1;
  const mid = midPoint(a, b);
  const { nx, ny } = segmentNormal(a, b);
  const lbl = segmentLabel(points, seg);
  const lenCm = seg.lengthCm ?? null;
  const text = lenCm !== null ? `${lbl}: ${lenCm}` : lbl;
  return (
    <text key={`lbl-${seg.id}`} x={mid.x + nx * (13 / z)} y={mid.y + ny * (13 / z)}
      textAnchor="middle" dominantBaseline="middle" fontSize={11 / z} fill="#e2e8f0" fontFamily="monospace"
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

  // Умный размер иконки: пропорционально длине стены
  const n = items.length;
  const z = Math.max(zoom, 0.1);

  // Вписываем n иконок + зазоры в 50% длины стены (SVG-единицы)
  const denom = n + 0.25 * (n - 1);
  const fitS = segLen * 0.50 / denom;

  // Абсолютный максимум: 48px экранных, минимум: 14px экранных
  const MAX_S = 48 / z;
  const MIN_S = 14 / z;

  // Минимальный размер должен влезать в стену (n иконок + промежутки в 70% длины)
  // Если даже минимальный размер не помещается — прячем
  const minTotalW = n * MIN_S + (n - 1) * MIN_S * 0.25;
  if (minTotalW > segLen * 0.70) return null;
  if (fitS < MIN_S) return null;

  const S   = Math.min(MAX_S, fitS);
  const GAP = S * 0.25;

  // Финальная проверка — иконки не должны выходить за пределы 80% длины стены
  const totalW = n * S + (n - 1) * GAP;
  if (totalW > segLen * 0.80) return null;

  // Отступ от стены: фиксированные 18px экранных внутрь полигона
  // Это гарантирует что иконки не перекрывают лейбл длины (который снаружи)
  const OFF = S / 2 + 18 / z;

  const cx = mid.x - nx * OFF;
  const cy = mid.y - ny * OFF;

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
                x={px - S / 2 + S * 0.08} y={py - S / 2 + S * 0.08}
                width={S * 0.84} height={S * 0.84}
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
      {tooltip && (() => {
        const hasTooltipImg = !!items.find(it => it.name === tooltip.name)?.imageUrl;
        const maxChars = 28;
        const displayName = tooltip.name.length > maxChars ? tooltip.name.slice(0, maxChars - 1) + "…" : tooltip.name;
        const charW = 5.5;
        const imgW = hasTooltipImg ? 20 : 0;
        const pad = 16;
        const tW = Math.max(80, displayName.length * charW + imgW + pad * 2);
        const tx = tooltip.px;
        const ty = tooltip.py - S / 2 - 30;
        return (
          <g className="pointer-events-none">
            <polygon
              points={`${tx},${tooltip.py - S / 2 - 2} ${tx - 5},${tooltip.py - S / 2 - 8} ${tx + 5},${tooltip.py - S / 2 - 8}`}
              fill="rgba(17,12,36,0.97)"
            />
            <rect
              x={tx - tW / 2} y={ty}
              width={tW} height={22} rx={6}
              fill="rgba(17,12,36,0.97)" stroke="rgba(124,58,237,0.45)" strokeWidth={1}
            />
            {hasTooltipImg && (
              <image
                href={items.find(it => it.name === tooltip.name)!.imageUrl!}
                x={tx - tW / 2 + pad / 2} y={ty + 3}
                width={16} height={16}
                preserveAspectRatio="xMidYMid meet"
              />
            )}
            <text
              x={hasTooltipImg ? tx - tW / 2 + pad / 2 + 16 + 4 : tx}
              y={ty + 11}
              textAnchor={hasTooltipImg ? "start" : "middle"}
              dominantBaseline="middle"
              fontSize={9} fill="#e9d5ff" fontFamily="system-ui" fontWeight={600}
            >
              {displayName}
            </text>
          </g>
        );
      })()}

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

export function renderAngleLabel(pt: import("./planTypes").Point, idx: number, ctx: Pick<RenderContext, "points" | "segments" | "isClosed" | "showAngleLabels" | "zoom">) {
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
  editingSegId?: string | null;
  onSetEditingSegId?: (id: string | null) => void;
  svgRef?: React.RefObject<SVGSVGElement>;
}

export function InlineDimLabels({ state, onChange, editingSegId, onSetEditingSegId, svgRef }: InlineDimProps) {
  const { points, segments } = state;
  // Если editingSegId пробрасывается снаружи — используем его, иначе локальный стейт
  const [localEditingId, setLocalEditingId] = React.useState<string | null>(null);
  const editingId = editingSegId !== undefined ? editingSegId : localEditingId;
  const setEditingId = (id: string | null) => {
    setLocalEditingId(id);
    onSetEditingSegId?.(id);
  };
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Экранная позиция поля ввода — вычисляется из SVG-координат
  const [inputPos, setInputPos] = React.useState<{ x: number; y: number } | null>(null);

  // Вычисляем экранную позицию метки редактируемого сегмента
  React.useEffect(() => {
    if (!editingId || !svgRef?.current) { setInputPos(null); return; }
    const seg = segments.find(s => s.id === editingId);
    if (!seg) { setInputPos(null); return; }
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) { setInputPos(null); return; }
    const zoom = state.settings?.zoom ?? 1;
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const segLen = distPx(a, b);
    const BASE_OFF = 14;
    const svgOff = BASE_OFF / zoom;
    const extraOff = segLen < 20 / zoom ? Math.min(60 / zoom, 30 / zoom) : segLen < 50 / zoom ? Math.min(40 / zoom, 20 / zoom) : 0;
    const off = svgOff + extraOff;
    const lx = mid.x + nx * off;
    const ly = mid.y + ny * off;
    // Переводим SVG-координаты в экранные через CTM
    const svgEl = svgRef.current;
    const pt = svgEl.createSVGPoint();
    pt.x = lx; pt.y = ly;
    const ctm = (svgEl.querySelector("g") as SVGGElement | null)?.getScreenCTM();
    if (ctm) {
      const screen = pt.matrixTransform(ctm);
      setInputPos({ x: screen.x, y: screen.y });
    }
  }, [editingId, segments, points, state.settings?.zoom]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId, inputPos]);

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

  // Portal с HTML-инпутом вне SVG — не зависит от zoom
  const inputPortal = editingId && inputPos ? ReactDOM.createPortal(
    <input
      ref={inputRef}
      type="number"
      min={1} max={99999} step={0.5}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => commitEdit(editingId)}
      onKeyDown={e => {
        if (e.key === "Enter") commitEdit(editingId);
        if (e.key === "Escape") cancelEdit();
        e.stopPropagation();
      }}
      style={{
        position: "fixed",
        left: inputPos.x - 44,
        top: inputPos.y - 18,
        width: 88, height: 36,
        background: "rgba(17,17,30,0.97)", color: "rgba(255,255,255,0.95)",
        border: "2px solid rgba(124,58,237,0.8)", borderRadius: 8,
        padding: "0 10px",
        fontSize: 16, fontFamily: "monospace", fontWeight: 700,
        outline: "none",
        boxSizing: "border-box",
        boxShadow: "0 0 16px rgba(124,58,237,0.5), 0 2px 14px rgba(0,0,0,0.8)",
        zIndex: 9999,
      }}
    />,
    document.body
  ) : null;

  return (
    <>
      {inputPortal}
      {segments.map(seg => {
        const a = points.find(p => p.id === seg.fromId);
        const b = points.find(p => p.id === seg.toId);
        if (!a || !b) return null;

        const mid = midPoint(a, b);
        const { nx, ny } = segmentNormal(a, b);
        const segLen = distPx(a, b);
        const zoom = state.settings?.zoom ?? 1;
        const BASE_OFF = 14;
        const svgOff = BASE_OFF / zoom;
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
        // Во время редактирования прячем SVG-метку — вместо неё HTML-инпут
        if (isEditing) return null;

        // Фиксированные размеры в экранных пикселях — не зависят от zoom
        const FS_PX = 11;     // font-size физических пикселей
        const BOX_H_PX = 20;  // высота метки физических пикселей
        const BOX_R_PX = 4;   // скругление
        const CHAR_W_PX = FS_PX * 0.65;
        const BOX_W_PX = Math.max(FS_PX * 3.8, displayText.length * CHAR_W_PX + FS_PX);
        const PAD_PX = 6;
        // Переводим в SVG-координаты — честное деление без округления
        const fs = FS_PX / zoom;
        const boxH = BOX_H_PX / zoom;
        const boxR = BOX_R_PX / zoom;
        const textW = BOX_W_PX / zoom;
        const pad = PAD_PX / zoom;

        return (
          <g key={seg.id} style={{ cursor: "text" }}
            onClick={e => {
              e.stopPropagation();
              setEditingId(seg.id);
              setDraft(seg.lengthCm !== null ? String(seg.lengthCm) : "");
            }}>
            {(extraOff > 0) && (
              <line x1={mid.x} y1={mid.y} x2={lx} y2={ly}
                stroke="rgba(255,255,255,0.2)" strokeWidth={0.6 / zoom} strokeDasharray={`${3/zoom} ${2/zoom}`}
                className="pointer-events-none" />
            )}
            {/* Расширенная зона клика */}
            <rect x={lx - textW / 2 - pad} y={ly - boxH / 2 - pad / 2} width={textW + pad * 2} height={boxH + pad}
              rx={boxR} fill="transparent" />
            <rect x={lx - textW / 2} y={ly - boxH / 2} width={textW} height={boxH} rx={boxR}
              fill="rgba(17,17,17,0.85)" stroke="rgba(255,255,255,0.2)" strokeWidth={0.7 / zoom} />
            <text x={lx} y={ly}
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