import React, { useState, useRef } from "react";
import type { Segment } from "../planTypes";
import { distPx, midPoint, segmentNormal, polygonOrientation } from "../planTypes";
import type { RenderContext } from "../PlanCanvasTypes";
import { DIM_OFF } from "../PlanCanvasUtils";

// ── SegmentItemsBadges — товары прикреплённые к стене ────────────────────────

interface SegmentItemsBadgesProps {
  seg: Segment;
  ctx: Pick<RenderContext, "points" | "zoom">;
  allSegments: Segment[];
  onRemoveItem?: (segId: string, priceId: number) => void;
  onUpdateQuantity?: (segId: string, priceId: number, quantity: number) => void;
  onEditSegItem?: (segId: string, priceId: number, screenX: number, screenY: number) => void;
  // Drag между стенами
  onMoveItemToSeg?: (fromSegId: string, priceId: number, toSegId: string) => void;
}

export function SegmentItemsBadges({
  seg, ctx, allSegments, onRemoveItem, onMoveItemToSeg, onEditSegItem,
}: SegmentItemsBadgesProps) {
  // Хуки — ВСЕГДА до любых return
  const [tooltip, setTooltip] = useState<{ px: number; py: number; name: string; qty: number; unit: string } | null>(null);
  const [dragState, setDragState] = useState<{ priceId: number; x: number; y: number } | null>(null);
  const dragStateRef = useRef<{ priceId: number; x: number; y: number } | null>(null);
  // Mouse double-click ref
  const dblRef       = useRef<{ key: string; t: number }>({ key: "", t: 0 });
  // Mouse drag ref
  const dragRef      = useRef<{ priceId: number; startX: number; startY: number; moved: boolean } | null>(null);
  // Флаг: был touch — игнорируем следующий синтетический click от браузера
  const wasTouchedRef = useRef(false);

  // Touch state: таймер long-press, флаг что drag активирован
  const touchRef = useRef<{
    priceId: number;
    key: string;
    startX: number;
    startY: number;
    startPx: number; // SVG координата
    startPy: number;
    scaleX: number;
    scaleY: number;
    timer: ReturnType<typeof setTimeout> | null;
    dragging: boolean; // true = long-press сработал, drag активен
  } | null>(null);

  const items = seg.items;
  if (!items || items.length === 0) return null;
  const a = ctx.points.find(p => p.id === seg.fromId);
  const b = ctx.points.find(p => p.id === seg.toId);
  if (!a || !b) return null;

  const zoom = ctx.zoom ?? 1;
  const mid = midPoint(a, b);
  const { nx: rawNx, ny: rawNy } = segmentNormal(a, b);
  const segLen = distPx(a, b) || 1;
  const tx = (b.x - a.x) / segLen;
  const ty = (b.y - a.y) / segLen;

  // Определяем ориентацию полигона (CW/CCW) и корректируем знак нормали.
  // segmentNormal возвращает левый перпендикуляр (-dy, dx).
  // Для CCW-полигона (area > 0) он смотрит внутрь → инвертируем.
  // Для CW-полигона (area < 0 в SVG где Y↓) он смотрит наружу → оставляем.
  // polygonOrientation: > 0 = CCW (Y вверх), но в SVG Y↓ поэтому знак инвертирован.
  const polyOri = polygonOrientation(ctx.points); // > 0 = CW в SVG
  // Если CW (polyOri > 0) — нормаль уже наружу. Если CCW — инвертируем.
  const normalSign = polyOri > 0 ? 1 : -1;
  const nx = rawNx * normalSign;
  const ny = rawNy * normalSign;

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

  // Отступ от стены в canvas-единицах.
  // Поле «400» рисуется на BASE_OFF=14 canvas-единиц от стены (центр поля).
  // Высота поля = 20px экранных = 20/z canvas-единиц → половина = 10/z.
  // Ширина поля ≈ 36px экранных = 36/z → половина = 18/z.
  // Проецируем по нормали: для вертикальной стены (nx≈1) → ширина, для горизонтальной (ny≈1) → высота.
  const absNx = Math.abs(nx);
  const absNy = Math.abs(ny);
  const BASE_LABEL_OFF = 14; // canvas-единиц от стены до центра поля (из InlineDimLabels)
  const fieldHalfProj = (absNx * 18 + absNy * 10) / z; // половина поля в canvas-единицах
  const GAP_PX = 0; // зазор в экранных пикселях
  const OFF = BASE_LABEL_OFF / z + fieldHalfProj + GAP_PX / z + S / 2;

  // Нормаль гарантированно смотрит наружу — двигаемся ПО нормали (наружу от полигона)
  const cx = mid.x + nx * OFF;
  const cy = mid.y + ny * OFF;

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
          // Игнорируем синтетический click после touch
          if (wasTouchedRef.current) { wasTouchedRef.current = false; return; }
          // Одиночный клик мышью — открываем попап
          onEditSegItem?.(seg.id, item.priceId, e.clientX, e.clientY);
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
            // Нормаль корректируется по ориентации полигона (та же логика что выше)
            const bx = mX + snx * normalSign * OFF;
            const by = mY + sny * normalSign * OFF;
            const d = Math.hypot(finalPx - bx, finalPy - by);
            if (d < bestDist) { bestDist = d; bestSegId = s.id; }
          });
          if (bestSegId && bestSegId !== seg.id && bestDist < 120) {
            onMoveItemToSeg!(seg.id, item.priceId, bestSegId);
          }
          dragRef.current = null;
          dragStateRef.current = null;
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
          e.stopPropagation();
          wasTouchedRef.current = true; // блокируем синтетический click
          if (touchRef.current?.timer) clearTimeout(touchRef.current.timer);

          const touch = e.touches[0];
          const svgEl = (e.target as SVGElement).closest("svg");
          let scaleX = 1, scaleY = 1;
          if (svgEl) {
            const rect = svgEl.getBoundingClientRect();
            const vb = svgEl.viewBox.baseVal;
            scaleX = vb.width / rect.width;
            scaleY = vb.height / rect.height;
          }

          touchRef.current = {
            priceId: item.priceId,
            key: itemKey,
            startX: touch.clientX,
            startY: touch.clientY,
            startPx: px,
            startPy: py,
            scaleX,
            scaleY,
            dragging: false,
            timer: setTimeout(() => {
              if (touchRef.current && touchRef.current.key === itemKey) {
                // Долгое нажатие — показываем tooltip на 3 сек
                setTooltip({ px, py, name: item.name, qty: item.quantity ?? 1, unit: item.unit });
                setTimeout(() => setTooltip(null), 3000);

                if (!onMoveItemToSeg) return;
                // Активируем drag
                touchRef.current.dragging = true;
                touchRef.current.timer = null;
                setDragState({ priceId: item.priceId, x: px, y: py });

                // Перехватываем все touch-события на window пока drag активен
                // Это предотвращает движение холста под пальцем
                const onWindowMove = (ev: TouchEvent) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  const tr = touchRef.current;
                  if (!tr || !tr.dragging) return;
                  const t = ev.touches[0];
                  const newDs = {
                    priceId: item.priceId,
                    x: tr.startPx + (t.clientX - tr.startX) * tr.scaleX,
                    y: tr.startPy + (t.clientY - tr.startY) * tr.scaleY,
                  };
                  dragStateRef.current = newDs;
                  setDragState({ ...newDs });
                };
                const onWindowEnd = (ev: TouchEvent) => {
                  ev.stopPropagation();
                  window.removeEventListener("touchmove", onWindowMove, true);
                  window.removeEventListener("touchend", onWindowEnd, true);
                };
                window.addEventListener("touchmove", onWindowMove, { capture: true, passive: false });
                window.addEventListener("touchend", onWindowEnd, { capture: true });
              }
            }, 500),
          };
        };

        const handleTouchMove = (e: React.TouchEvent) => {
          const tr = touchRef.current;
          if (!tr || tr.key !== itemKey) return;
          const touch = e.touches[0];

          if (tr.dragging) {
            // Drag активен — блокируем всё, позиция обновляется через window listener
            e.stopPropagation();
            e.preventDefault();
          } else {
            // Drag ещё не активирован — если палец сдвинулся > 10px, отменяем таймер
            const dx = Math.abs(touch.clientX - tr.startX);
            const dy = Math.abs(touch.clientY - tr.startY);
            if (dx > 10 || dy > 10) {
              if (tr.timer) { clearTimeout(tr.timer); tr.timer = null; }
            }
          }
        };

        const handleTouchEnd = (e: React.TouchEvent) => {
          const tr = touchRef.current;
          if (!tr || tr.key !== itemKey) return;
          e.stopPropagation();
          e.preventDefault(); // предотвращаем синтетический click от браузера

          // Отменяем таймер long-press
          if (tr.timer) { clearTimeout(tr.timer); tr.timer = null; }
          touchRef.current = null;

          if (tr.dragging) {
            // Завершаем drag — ищем ближайшую стену (используем ref, т.к. state может быть stale)
            const ds = dragStateRef.current;
            dragStateRef.current = null;
            if (ds) finishDrag(ds.x, ds.y);
            else setDragState(null);
          } else {
            // Короткий тап — обрабатываем одиночный / двойной
            setDragState(null);
            const touch = e.changedTouches[0];
            const dx = Math.abs(touch.clientX - tr.startX);
            const dy = Math.abs(touch.clientY - tr.startY);
            // Если палец почти не двигался — это тап, сразу открываем попап
            if (dx < 12 && dy < 12) {
              onEditSegItem?.(seg.id, item.priceId, touch.clientX, touch.clientY);
            }
          }
        };

        return (
          <g key={itemKey}
            data-seg-item="1"
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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