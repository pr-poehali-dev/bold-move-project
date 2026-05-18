import React, { useState, useRef } from "react";
import type { Segment } from "../planTypes";
import { distPx, midPoint, segmentNormal } from "../planTypes";
import type { RenderContext } from "../PlanCanvasTypes";

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
  const wallCm = seg.lengthCm ?? null;

  // Все иконки полностью видимы
  const fadeOpacity = 1;

  // Размер иконки растёт линейно с длиной стены:
  // wallCm 50 → S ~20px, wallCm 200 → S ~32px, wallCm 500 → S ~48px, wallCm 1000+ → S ~60px
  const MAX_S_PX = 60;
  const MIN_S_PX = 20;
  // Линейная интерполяция от 50см до 1000см
  const cmForSize = wallCm ?? 200;
  const t = Math.max(0, Math.min(1, (cmForSize - 50) / (1000 - 50)));
  const targetS_PX = MIN_S_PX + (MAX_S_PX - MIN_S_PX) * t;
  const targetS = targetS_PX / z;

  // Ограничение по длине стены не применяем — иконки могут торчать наружу для коротких
  const S   = targetS;
  const GAP = S * 0.25;

  const totalW = n * S + (n - 1) * GAP;

  // Умный отступ от стены — зависит от ориентации стены и размера поля ввода длины
  // Поле ввода длины: ширина ~40px, высота ~20px (экранных)
  // На горизонтальной стене лейбл сверху/снизу → отступ по Y нужен большой (высота)
  // На вертикальной стене лейбл слева/справа → отступ по X нужен большой (ширина)
  // Используем |nx| и |ny| — компоненты нормали — для интерполяции
  const LABEL_HALF_H_PX = 12; // половина высоты лейбла длины + небольшой зазор
  const LABEL_HALF_W_PX = 24; // половина ширины лейбла длины + небольшой зазор
  const absNx = Math.abs(nx);
  const absNy = Math.abs(ny);
  // Проекция: сколько лейбл занимает по направлению нормали
  const labelProjPx = absNx * LABEL_HALF_W_PX + absNy * LABEL_HALF_H_PX;
  // Отступ = половина иконки + проекция лейбла + 4px зазор
  const OFF = S / 2 + (labelProjPx + 4) / z;

  const cx = mid.x - nx * OFF;
  const cy = mid.y - ny * OFF;

  // Иконки центрируются по середине стены
  const startOffset = -totalW / 2 + S / 2;

  return (
    <g key={`seg-items-${seg.id}`} style={{ opacity: fadeOpacity, transition: "opacity 0.2s ease" }}>
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
  return <SegmentItemsBadges seg={seg} ctx={ctx as Pick<RenderContext, "points" | "zoom">} allSegments={[seg]} onRemoveItem={onRemoveItem} />;
}