import { segmentNormal } from "./planTypes";
import type { RenderContext, SegmentHandlers } from "./PlanCanvasTypes";
import { DIM_OFF, PT_R, PT_HIT } from "./PlanCanvasUtils";
import { pointLabel } from "./planTypes";

// ── Рендер точек ─────────────────────────────────────────────────────────────

export function renderPoints(ctx: RenderContext, handlers: SegmentHandlers) {
  const {
    points, segments, isClosed, tool,
    showPoints, showPointLabels,
    selectedPointId, ghost, zoom,
  } = ctx;
  if (!showPoints) return null;

  // Все размеры в SVG-координатах = экранные пиксели / zoom
  const z = zoom ?? 1;
  const r      = PT_R   / z;   // радиус точки ~7px на экране
  const hitR   = PT_HIT / z;   // зона касания ~28px на экране
  const lblOff = 14    / z;    // отступ буквы от точки ~14px на экране
  const fs     = 11    / z;    // размер шрифта ~11px на экране
  const sw     = 1.5  / z;    // strokeWidth

  const cx = points.length > 0 ? points.reduce((s, p) => s + p.x, 0) / points.length : 0;
  const cy = points.length > 0 ? points.reduce((s, p) => s + p.y, 0) / points.length : 0;
  const n = points.length;

  return points.map((pt, idx) => {
    const isSel = pt.id === selectedPointId;
    const isFirst = idx === 0;
    const seg = segments.find(s => s.toId === pt.id);
    const hasArc = seg ? seg.arcRadius > 0 : false;

    // Направление буквы: биссектриса угла, знак определяется ориентацией полигона (CW/CCW)
    let lx: number, ly: number;
    if (isClosed && n >= 3) {
      const prev = points[(idx - 1 + n) % n];
      const next = points[(idx + 1) % n];
      // Единичные векторы вдоль рёбер ОТ текущей точки
      const ax = prev.x - pt.x, ay = prev.y - pt.y;
      const bx = next.x - pt.x, by = next.y - pt.y;
      const la = Math.sqrt(ax * ax + ay * ay) || 1;
      const lb = Math.sqrt(bx * bx + by * by) || 1;
      const uax = ax / la, uay = ay / la;
      const ubx = bx / lb, uby = by / lb;
      // Биссектриса — сумма единичных векторов
      let ox = uax + ubx;
      let oy = uay + uby;
      // Если биссектриса вырождается (угол 180°) — берём нормаль к ребру
      if (Math.sqrt(ox * ox + oy * oy) < 0.01) { ox = -uay; oy = uax; }
      const ol = Math.sqrt(ox * ox + oy * oy) || 1;
      ox /= ol; oy /= ol;
      // Определяем ориентацию полигона (знак площади)
      let area2 = 0;
      for (let i = 0; i < n; i++) {
        const pi = points[i], pj = points[(i + 1) % n];
        area2 += (pi.x * pj.y - pj.x * pi.y);
      }
      // Знак cross-product двух рёбер в вершине: если совпадает с ориентацией — угол выпуклый (наружу)
      const cross = ax * by - ay * bx; // >0 = CCW поворот, <0 = CW
      // Если полигон CCW (area2>0) и крест >0 — выпуклый угол, биссектриса уже наружу
      // Если полигон CW  (area2<0) и крест <0 — выпуклый угол, биссектриса уже наружу
      // Иначе — вогнутый, инвертируем
      const isConvex = area2 > 0 ? cross > 0 : cross < 0;
      if (!isConvex) { ox = -ox; oy = -oy; }
      lx = pt.x + ox * lblOff;
      ly = pt.y + oy * lblOff;
    } else {
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const dlen = Math.sqrt(dx * dx + dy * dy) || 1;
      lx = pt.x + (dx / dlen) * lblOff;
      ly = pt.y + (dy / dlen) * lblOff;
    }

    return (
      <g key={pt.id}
        style={{ cursor: tool === "move" ? "grab" : "pointer" }}
        onClick={e => handlers.onPointClick(e, pt.id)}
        onMouseDown={e => handlers.onPointMouseDown(e, pt.id)}
        onContextMenu={e => handlers.onPointCtxMenu(e, pt.id)}
      >
        <circle cx={pt.x} cy={pt.y} r={hitR} fill="transparent" />
        {(isSel || (ghost?.willClose && isFirst)) && (
          <circle cx={pt.x} cy={pt.y} r={r + 6 / z} fill="none"
            stroke={ghost?.willClose && isFirst ? "#34d399" : "#c4b5fd"} strokeWidth={sw} opacity={0.5} />
        )}
        {isSel && (
          <circle cx={pt.x} cy={pt.y} r={r + 14 / z} fill="rgba(196,181,253,0.12)"
            stroke="#a78bfa" strokeWidth={1.5 / z} strokeDasharray={`${4/z} ${3/z}`}
            className="pointer-events-none">
            <animate attributeName="stroke-dashoffset" from="0" to={`${-14/z}`} dur="1s" repeatCount="indefinite" />
          </circle>
        )}
        {hasArc && !isSel && (
          <circle cx={pt.x} cy={pt.y} r={r + 3 / z} fill="none" stroke="#10b981" strokeWidth={sw * 0.7} opacity={0.4} />
        )}
        <circle cx={pt.x} cy={pt.y} r={r}
          fill={isSel ? "#c4b5fd" : isFirst && !isClosed ? "#34d399" : "#7c3aed"}
          stroke={isSel ? "#a78bfa" : "#4c1d95"} strokeWidth={sw} />
        {showPointLabels && (
          <text x={lx} y={ly} fontSize={fs} fontWeight={700} fill="#e2e8f0" fontFamily="monospace"
            textAnchor="middle" dominantBaseline="middle"
            className="pointer-events-none select-none">{pointLabel(idx)}</text>
        )}
      </g>
    );
  });
}

// ── Рендер отрезков (зоны клика) ─────────────────────────────────────────────

export function renderSegments(ctx: RenderContext, handlers: Pick<SegmentHandlers, "onSegmentClick" | "onSegmentCtxMenu">) {
  const { points, segments, tool, selectedSegmentIds, intersectingSegIds, changedSegmentIds, zoom, isClosed } = ctx;
  const z = zoom ?? 1;
  const selIds = selectedSegmentIds ?? [];
  return segments.map(seg => {
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return null;
    const isSel = selIds.includes(seg.id);
    const isIntersecting = intersectingSegIds?.includes(seg.id);
    const isChanged = changedSegmentIds?.includes(seg.id);
    // Стена без прикреплённого товара — подсвечиваем жёлтым
    const isEmpty = isClosed && (!seg.items || seg.items.length === 0);
    // Hit-зона: фиксированные 18px на экране, адаптированные к зуму
    // При высоком зуме (крупный план) — не перекрываем соседние тонкие стены
    const hitW = Math.max(8, 18 / z);
    return (
      <g key={seg.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={hitW}
          style={{ cursor: "pointer" }}
          onClick={e => handlers.onSegmentClick(e, seg.id)}
          onContextMenu={e => handlers.onSegmentCtxMenu(e, seg.id)}
        />
        {isEmpty && !isIntersecting && !isSel && (
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#facc15" strokeWidth={3} opacity={0.9}
            strokeDasharray="8 4" className="pointer-events-none" />
        )}
        {isChanged && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#facc15" strokeWidth={3} opacity={0.9} className="pointer-events-none seg-recalc-flash" />}
        {isIntersecting && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f87171" strokeWidth={2.5} opacity={0.8} className="pointer-events-none" />}
        {isSel && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ef4444" strokeWidth={2.5} strokeDasharray="8 4" className="pointer-events-none" />}
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