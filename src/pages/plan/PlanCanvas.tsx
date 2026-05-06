import React, { useRef, useCallback, useEffect } from "react";
import type { PlanState, Point, Segment, DimLine } from "./planTypes";
import {
  snapVal, snapToPoint, orthoPoint, buildAutoDiagonals, genId,
  calcScale, buildShapePath,
} from "./planTypes";
import { PT_HIT, SNAP_THR, CLOSE_THR, DIM_OFF, findNearestSegment, findNearestDiagonal } from "./PlanCanvasUtils";
import {
  renderDimLine, renderSegmentLabel, renderAngleLabel, renderCornerArc, renderCustomDimLine,
  renderPoints, renderDiagonals, renderSegments, renderGhost, renderHints,
  InlineDimLabels,
} from "./PlanCanvasRenderers";
import type { RenderContext, SegmentHandlers } from "./PlanCanvasRenderers";
import { distPx } from "./planTypes";
import PlanCanvasOverlay from "./PlanCanvasOverlay";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

export default function PlanCanvas({ state, onChange }: Props) {
  const svgRef       = useRef<SVGSVGElement>(null);
  const dragRef      = useRef<{ pointId: string } | null>(null);
  const panRef       = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);
  const pinchRef     = useRef<{ dist: number; zoom: number } | null>(null);
  const isPanning    = useRef(false);
  const didMoveRef   = useRef(false);
  // Long press
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPos = useRef<{ clientX: number; clientY: number; type: "point" | "segment" | "diagonal"; id: string } | null>(null);
  // setVibrated нужен для принудительного ре-рендера после вибрации
  const [, setVibrated] = React.useState(false);

  const {
    points, segments, diagonals, dimLines,
    isClosed, settings, tool, phase,
    selectedPointId, selectedSegmentId, selectedDiagonalId, selectedArcId, selectedDimLineId,
  } = state;

  const { ortho, snapToPoints: snapPts, showGrid, gridSize, zoom, panX, panY,
    showSegmentLabels, showAngleLabels, showDiagonals, showDimLines, showPoints, showPointLabels } = settings;

  const scale = calcScale(points, segments);

  // ── Координаты из clientX/Y в пространство чертежа ──────────────────────
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom - panX,
      y: (clientY - rect.top)  / zoom - panY,
    };
  }, [zoom, panX, panY]);

  const applySnap = useCallback((rawX: number, rawY: number, excludeId: string | null = null) => {
    // Сначала пробуем привязку к точке — если нашли, ortho не трогаем
    const snappedFirst = snapToPoint(rawX, rawY, points, excludeId, SNAP_THR, snapPts);
    if (snappedFirst.snapped) {
      return { x: snappedFirst.x, y: snappedFirst.y, snapped: true };
    }
    // Нет snap к точке — применяем сетку и ortho
    let x = snapVal(rawX, gridSize, showGrid);
    let y = snapVal(rawY, gridSize, showGrid);
    if (ortho && points.length > 0 && tool === "draw" && !isClosed) {
      const o = orthoPoint(points[points.length - 1], x, y);
      x = o.x; y = o.y;
    }
    return { x, y, snapped: false };
  }, [gridSize, showGrid, ortho, points, tool, isClosed, snapPts]);

  // ── Ghost предпросмотр (только на десктопе) ──────────────────────────────
  const [ghost, setGhost] = React.useState<{ x: number; y: number; willClose: boolean } | null>(null);

  // ── Инструмент dimline: первая выбранная точка ────────────────────────────
  const [dimLineFrom, setDimLineFrom] = React.useState<string | null>(null);

  // ── Контекстное меню ─────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = React.useState<{
    x: number; y: number; type: "point" | "segment" | "diagonal"; id: string
  } | null>(null);

  // Сбрасываем dimLineFrom при смене инструмента
  useEffect(() => {
    if (tool !== "dimline") setDimLineFrom(null);
  }, [tool]);

  // ════════════════════════════════════════════════════════════════════════
  // MOUSE EVENTS
  // ════════════════════════════════════════════════════════════════════════

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (panRef.current) {
      const dx = (e.clientX - panRef.current.startX) / zoom;
      const dy = (e.clientY - panRef.current.startY) / zoom;
      onChange({ settings: { ...settings, panX: panRef.current.origPanX + dx, panY: panRef.current.origPanY + dy } });
      return;
    }
    if (tool === "draw" && phase === "draw" && !isClosed) {
      const raw = clientToSvg(e.clientX, e.clientY);
      const { x, y } = applySnap(raw.x, raw.y);
      const willClose = points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THR;
      setGhost({ x: willClose ? points[0].x : x, y: willClose ? points[0].y : y, willClose });
    } else if (tool === "dimline" && dimLineFrom) {
      const raw = clientToSvg(e.clientX, e.clientY);
      const { x, y } = applySnap(raw.x, raw.y);
      setGhost({ x, y, willClose: false });
    } else {
      setGhost(null);
    }
    if (dragRef.current && tool === "move") {
      const raw = clientToSvg(e.clientX, e.clientY);
      const { x, y } = applySnap(raw.x, raw.y, dragRef.current.pointId);
      const movedId = dragRef.current.pointId;
      const newPts = points.map(p => p.id === movedId ? { ...p, x, y } : p);
      // Сбрасываем lengthCm у отрезков связанных с перетаскиваемой точкой
      const newSegs = segments.map(s =>
        (s.fromId === movedId || s.toId === movedId) ? { ...s, lengthCm: null } : s
      );
      onChange({ points: newPts, segments: newSegs, diagonals: buildAutoDiagonals(newPts, diagonals) });
    }
  }, [tool, phase, isClosed, points, dimLineFrom, clientToSvg, applySnap, diagonals, onChange, settings, zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      panRef.current = { startX: e.clientX, startY: e.clientY, origPanX: panX, origPanY: panY };
      isPanning.current = true;
    }
  }, [panX, panY]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null; panRef.current = null; isPanning.current = false;
  }, []);

  // ════════════════════════════════════════════════════════════════════════
  // TOUCH EVENTS — полная поддержка пальца
  // ════════════════════════════════════════════════════════════════════════

  // ── Очистка long press таймера ───────────────────────────────────────────
  const clearLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    longPressPos.current = null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    didMoveRef.current = false;
    clearLongPress();

    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy), zoom };
      panRef.current = null;
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const raw = clientToSvg(t.clientX, t.clientY);

      // Определяем что под пальцем для long press
      const hitPt   = points.find(p => distPx(p, { id: "", x: raw.x, y: raw.y }) < PT_HIT);
      const hitSeg  = !hitPt ? findNearestSegment(raw.x, raw.y, points, segments, 18) : null;
      const hitDiag = !hitPt && !hitSeg ? findNearestDiagonal(raw.x, raw.y, points, diagonals, 18) : null;

      // Запускаем long press (500мс)
      if (hitPt || hitSeg || hitDiag) {
        const type  = hitPt ? "point" : hitSeg ? "segment" : "diagonal";
        const id    = (hitPt?.id ?? hitSeg?.id ?? hitDiag?.id)!;
        longPressPos.current = { clientX: t.clientX, clientY: t.clientY, type, id };

        longPressRef.current = setTimeout(() => {
          if (!longPressPos.current) return;
          // Вибрация если поддерживается
          if ("vibrate" in navigator) navigator.vibrate(40);
          setVibrated(true);
          setTimeout(() => setVibrated(false), 300);
          setCtxMenu({
            x: longPressPos.current.clientX,
            y: longPressPos.current.clientY,
            type: longPressPos.current.type,
            id:   longPressPos.current.id,
          });
          // Не считаем это tapом
          didMoveRef.current = true;
          dragRef.current = null;
          panRef.current = null;
          longPressPos.current = null;
        }, 500);
      }

      // Drag точки (в режиме move)
      if (tool === "move" && hitPt) {
        dragRef.current = { pointId: hitPt.id };
        return;
      }

      // Pan
      panRef.current = { startX: t.clientX, startY: t.clientY, origPanX: panX, origPanY: panY };
    }
  }, [tool, points, segments, diagonals, clientToSvg, panX, panY, zoom, clearLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();

    // Любое движение пальца отменяет long press
    if (longPressRef.current) clearLongPress();

    if (e.touches.length === 2 && pinchRef.current) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / pinchRef.current.dist;
      const newZoom = Math.max(0.3, Math.min(4, Math.round(pinchRef.current.zoom * ratio * 10) / 10));
      onChange({ settings: { ...settings, zoom: newZoom } });
      didMoveRef.current = true;
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];

      // Drag точки пальцем
      if (dragRef.current && tool === "move") {
        const raw = clientToSvg(t.clientX, t.clientY);
        const { x, y } = applySnap(raw.x, raw.y, dragRef.current.pointId);
        const movedId = dragRef.current.pointId;
        const newPts = points.map(p => p.id === movedId ? { ...p, x, y } : p);
        const newSegs = segments.map(s =>
          (s.fromId === movedId || s.toId === movedId) ? { ...s, lengthCm: null } : s
        );
        onChange({ points: newPts, segments: newSegs, diagonals: buildAutoDiagonals(newPts, diagonals) });
        didMoveRef.current = true;
        return;
      }

      // Pan пальцем
      if (panRef.current) {
        const dx = (t.clientX - panRef.current.startX) / zoom;
        const dy = (t.clientY - panRef.current.startY) / zoom;
        onChange({ settings: { ...settings, panX: panRef.current.origPanX + dx, panY: panRef.current.origPanY + dy } });
        didMoveRef.current = true;
      }
    }
  }, [tool, points, clientToSvg, applySnap, diagonals, onChange, settings, zoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    pinchRef.current = null;
    clearLongPress(); // всегда гасим таймер при отпускании

    if (didMoveRef.current) {
      dragRef.current = null; panRef.current = null;
      didMoveRef.current = false;
      return;
    }

    // Одиночный тап — обрабатываем как клик
    if (e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const raw = clientToSvg(t.clientX, t.clientY);

      // Попал ли тап на точку?
      const hitPt = points.find(p => distPx(p, { id: "", x: raw.x, y: raw.y }) < PT_HIT);
      if (hitPt) {
        if (tool === "delete") {
          const newPts = points.filter(p => p.id !== hitPt.id);
          const newSegs = segments.filter(s => s.fromId !== hitPt.id && s.toId !== hitPt.id);
          const newDiags = newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [];
          onChange({ points: newPts, segments: newSegs, diagonals: newDiags, isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
        } else if (tool === "dimline") {
          if (!dimLineFrom) {
            setDimLineFrom(hitPt.id);
            onChange({ selectedPointId: hitPt.id });
          } else if (dimLineFrom !== hitPt.id) {
            const newDl: DimLine = { id: genId("dl"), fromId: dimLineFrom, toId: hitPt.id, offsetPx: DIM_OFF, visible: true, labelCm: null };
            onChange({ dimLines: [...dimLines, newDl], selectedDimLineId: newDl.id, selectedPointId: null });
            setDimLineFrom(null);
          }
        } else {
          onChange({ selectedPointId: hitPt.id, selectedSegmentId: null, selectedDiagonalId: null });
        }
        dragRef.current = null; panRef.current = null;
        return;
      }

      // Попал ли тап на отрезок?
      const hitSeg = findNearestSegment(raw.x, raw.y, points, segments, 16);
      if (hitSeg) {
        if (tool === "delete") {
          onChange({ segments: segments.filter(s => s.id !== hitSeg.id), isClosed: false });
        } else if (tool === "arc") {
          const newR = (hitSeg.arcRadius + 15) % 90;
          onChange({ segments: segments.map(s => s.id === hitSeg.id ? { ...s, arcRadius: newR } : s) });
        } else {
          onChange({ selectedSegmentId: hitSeg.id, selectedPointId: null });
        }
        dragRef.current = null; panRef.current = null;
        return;
      }

      // Попал ли тап на диагональ?
      const hitDiag = findNearestDiagonal(raw.x, raw.y, points, diagonals, 16);
      if (hitDiag) {
        if (tool === "delete") {
          onChange({ diagonals: diagonals.filter(d => d.id !== hitDiag.id) });
        } else {
          onChange({ selectedDiagonalId: hitDiag.id, selectedPointId: null });
        }
        dragRef.current = null; panRef.current = null;
        return;
      }

      // Тап по пустому холсту — рисование
      if (tool === "draw" && phase === "draw" && !isClosed) {
        const { x, y } = applySnap(raw.x, raw.y);

        // Замыкание — тап близко к первой точке
        if (points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THR) {
          const closing: Segment = { id: genId("s"), fromId: points[points.length - 1].id, toId: points[0].id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 };
          const newSegs = [...segments, closing];
          const newDiags = buildAutoDiagonals(points, diagonals);
          onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: newSegs[0]?.id ?? null });
        } else {
          const np: Point = { id: genId("pt"), x, y };
          const newPts = [...points, np];
          const newSegs = [...segments];
          if (points.length > 0) {
            newSegs.push({ id: genId("s"), fromId: points[points.length - 1].id, toId: np.id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 });
          }
          onChange({ points: newPts, segments: newSegs });
        }
      } else {
        onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null });
      }
    }

    dragRef.current = null; panRef.current = null; didMoveRef.current = false;
  }, [tool, phase, isClosed, points, segments, diagonals, dimLines, dimLineFrom, clientToSvg, applySnap, onChange, clearLongPress]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.3, Math.min(4, Math.round((zoom + delta) * 10) / 10));
    onChange({ settings: { ...settings, zoom: newZoom } });
  }, [zoom, settings, onChange]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", handleWheel, { passive: false });
    // Блокируем дефолтный тач-скролл на SVG
    svg.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    return () => {
      svg.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // ── Click (мышь) ──────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning.current) return;
    setCtxMenu(null);
    const isCanvas = e.target === svgRef.current || (e.target as Element).classList.contains("canvas-bg");
    if (!isCanvas) {
      if (tool !== "draw") onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null, selectedArcId: null, selectedDimLineId: null });
      return;
    }
    if (tool === "draw" && phase === "draw" && !isClosed) {
      const raw = clientToSvg(e.clientX, e.clientY);
      const { x, y } = applySnap(raw.x, raw.y);
      if (points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THR) {
        const closing: Segment = { id: genId("s"), fromId: points[points.length - 1].id, toId: points[0].id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 };
        const newSegs = [...segments, closing];
        const newDiags = buildAutoDiagonals(points, diagonals);
        onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: newSegs[0]?.id ?? null });
        setGhost(null);
        return;
      }
      const np: Point = { id: genId("pt"), x, y };
      const newPts = [...points, np];
      const newSegs = [...segments];
      if (points.length > 0) newSegs.push({ id: genId("s"), fromId: points[points.length - 1].id, toId: np.id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 });
      onChange({ points: newPts, segments: newSegs });
    } else {
      onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null, selectedArcId: null, selectedDimLineId: null });
    }
  }, [tool, phase, isClosed, points, segments, diagonals, clientToSvg, applySnap, onChange]);

  // ── Клики на элементы (мышь) ─────────────────────────────────────────────
  const handlePointClick = useCallback((e: React.MouseEvent, pointId: string) => {
    e.stopPropagation(); setCtxMenu(null);
    if (tool === "delete") {
      const newPts = points.filter(p => p.id !== pointId);
      const newSegs = segments.filter(s => s.fromId !== pointId && s.toId !== pointId);
      onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [], isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
      return;
    }
    // Размерная линия — двухшаговый режим
    if (tool === "dimline") {
      if (!dimLineFrom) {
        setDimLineFrom(pointId);
        onChange({ selectedPointId: pointId });
      } else if (dimLineFrom !== pointId) {
        const newDl: DimLine = { id: genId("dl"), fromId: dimLineFrom, toId: pointId, offsetPx: DIM_OFF, visible: true, labelCm: null };
        onChange({ dimLines: [...dimLines, newDl], selectedDimLineId: newDl.id, selectedPointId: null });
        setDimLineFrom(null);
      }
      return;
    }
    // В режиме draw — клик на точку = snap к ней
    if (tool === "draw" && phase === "draw" && !isClosed) {
      const pt = points.find(p => p.id === pointId);
      if (!pt) return;
      // Клик на первую точку = замыкание
      if (pointId === points[0]?.id && points.length >= 3) {
        const closing: Segment = { id: genId("s"), fromId: points[points.length - 1].id, toId: points[0].id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 };
        const newSegs = [...segments, closing];
        const newDiags = buildAutoDiagonals(points, diagonals);
        onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: newSegs[0]?.id ?? null });
        setGhost(null);
        return;
      }
      // Клик на последнюю точку — ничего не делаем
      if (pointId === points[points.length - 1]?.id) return;
      // Клик на любую другую точку — добавляем отрезок к ней (привязка)
      const np = { ...pt, id: genId("pt") };
      const newPts = [...points, np];
      const newSegs = [...segments];
      newSegs.push({ id: genId("s"), fromId: points[points.length - 1].id, toId: np.id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 });
      onChange({ points: newPts, segments: newSegs });
      return;
    }
    onChange({ selectedPointId: pointId, selectedSegmentId: null, selectedDiagonalId: null, selectedArcId: null });
  }, [tool, phase, isClosed, points, segments, diagonals, dimLines, dimLineFrom, onChange]);

  const handlePointCtxMenu = useCallback((e: React.MouseEvent, pointId: string) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "point", id: pointId });
  }, []);

  const handlePointMouseDown = useCallback((e: React.MouseEvent, pointId: string) => {
    if (tool !== "move") return;
    e.stopPropagation();
    dragRef.current = { pointId };
  }, [tool]);

  const handleSegmentClick = useCallback((e: React.MouseEvent, segId: string) => {
    e.stopPropagation(); setCtxMenu(null);
    if (tool === "delete") { onChange({ segments: segments.filter(s => s.id !== segId), isClosed: false }); return; }
    if (tool === "arc") {
      const seg = segments.find(s => s.id === segId);
      if (seg) onChange({ segments: segments.map(s => s.id === segId ? { ...s, arcRadius: (seg.arcRadius + 15) % 90 } : s) });
      return;
    }
    onChange({ selectedSegmentId: segId, selectedPointId: null, selectedDiagonalId: null, selectedArcId: null });
  }, [tool, segments, onChange]);

  const handleSegmentCtxMenu = useCallback((e: React.MouseEvent, segId: string) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "segment", id: segId });
  }, []);

  const handleDiagonalClick = useCallback((e: React.MouseEvent, diagId: string) => {
    e.stopPropagation(); setCtxMenu(null);
    if (tool === "delete") { onChange({ diagonals: diagonals.filter(d => d.id !== diagId) }); return; }
    onChange({ selectedDiagonalId: diagId, selectedPointId: null, selectedSegmentId: null, selectedArcId: null });
  }, [tool, diagonals, onChange]);

  const handleDimLineClick = useCallback((e: React.MouseEvent, dlId: string) => {
    e.stopPropagation();
    if (tool === "delete") { onChange({ dimLines: dimLines.filter(d => d.id !== dlId) }); return; }
    onChange({ selectedDimLineId: dlId, selectedPointId: null, selectedSegmentId: null });
  }, [tool, dimLines, onChange]);

  // ── Escape / Delete ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGhost(null); setCtxMenu(null);
        if (phase === "draw" && points.length > 0 && !isClosed)
          onChange({ points: points.slice(0, -1), segments: segments.slice(0, -1) });
        onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null, selectedArcId: null, selectedDimLineId: null });
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !["INPUT","TEXTAREA","SELECT"].includes((e.target as Element).tagName)) {
        if (selectedPointId) {
          const newPts = points.filter(p => p.id !== selectedPointId);
          const newSegs = segments.filter(s => s.fromId !== selectedPointId && s.toId !== selectedPointId);
          onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [], isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
        }
        if (selectedSegmentId) onChange({ segments: segments.filter(s => s.id !== selectedSegmentId), isClosed: false, selectedSegmentId: null });
        if (selectedDiagonalId) onChange({ diagonals: diagonals.filter(d => d.id !== selectedDiagonalId), selectedDiagonalId: null });
        if (selectedDimLineId) onChange({ dimLines: dimLines.filter(d => d.id !== selectedDimLineId), selectedDimLineId: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, points, segments, isClosed, diagonals, dimLines, selectedPointId, selectedSegmentId, selectedDiagonalId, selectedDimLineId, onChange]);

  // ── Позиция long-press индикатора ─────────────────────────────────────────
  const [lpIndicator, setLpIndicator] = React.useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (longPressPos.current) {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        setLpIndicator({
          x: longPressPos.current.clientX - rect.left,
          y: longPressPos.current.clientY - rect.top,
        });
      } else {
        setLpIndicator(null);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  // ── Render context & handlers ─────────────────────────────────────────────
  const cursor = isPanning.current ? "grabbing" : tool === "draw" ? "crosshair" : tool === "move" ? "default" : tool === "delete" ? "not-allowed" : tool === "arc" ? "cell" : "default";
  const shapePath = buildShapePath(points, segments, isClosed);

  const ctx: RenderContext = {
    points, segments, diagonals, dimLines, scale, isClosed, tool,
    showDimLines, showSegmentLabels, showAngleLabels, showDiagonals, showPoints, showPointLabels,
    selectedPointId, selectedSegmentId, selectedDiagonalId, selectedArcId, selectedDimLineId,
    ghost, dimLineFrom, zoom, phase,
  };

  const handlers: SegmentHandlers = {
    onSegmentClick: handleSegmentClick,
    onSegmentCtxMenu: handleSegmentCtxMenu,
    onDimLineClick: handleDimLineClick,
    onDiagonalClick: handleDiagonalClick,
    onPointClick: handlePointClick,
    onPointMouseDown: handlePointMouseDown,
    onPointCtxMenu: handlePointCtxMenu,
  };

  return (
    <div className="w-full h-full overflow-hidden relative bg-[#111] select-none touch-none">
      <svg
        ref={svgRef}
        width="100%" height="100%"
        style={{ cursor, userSelect: "none", touchAction: "none" }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={e => e.preventDefault()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <defs>
          {showGrid && (
            <pattern id="plan-grid" width={gridSize * zoom} height={gridSize * zoom} patternUnits="userSpaceOnUse">
              <circle cx={0} cy={0} r={0.8} fill="rgba(255,255,255,0.07)" />
            </pattern>
          )}
        </defs>

        {/* Фон */}
        <rect className="canvas-bg" width="100%" height="100%" fill={showGrid ? "url(#plan-grid)" : "transparent"} />

        {/* Группа с pan+zoom */}
        <g transform={`translate(${panX * zoom},${panY * zoom}) scale(${zoom})`}>

          {/* Заливка */}
          {isClosed && points.length >= 3 && (
            <path d={shapePath} fill="rgba(139,92,246,0.07)" stroke="none" className="pointer-events-none" />
          )}

          {/* Контур */}
          {points.length >= 2 && (
            <path d={shapePath} fill="none" stroke={isClosed ? "#a78bfa" : "#6366f1"} strokeWidth={2} strokeLinejoin="round" className="pointer-events-none" />
          )}

          {/* Отрезки — широкая зона для клика/тача */}
          {renderSegments(ctx, handlers)}

          {/* Размерные линии */}
          {segments.map(seg => renderDimLine(seg, ctx))}
          {/* Подписи */}
          {segments.map(seg => renderSegmentLabel(seg, ctx))}
          {/* Пользовательские размерные линии */}
          {dimLines.map(dl => renderCustomDimLine(dl, ctx, handleDimLineClick))}

          {/* Диагонали */}
          {renderDiagonals(ctx, handlers)}

          {/* Дуги скруглений */}
          {isClosed && segments.map(seg => {
            const idx = points.findIndex(p => p.id === seg.toId);
            if (idx < 0 || seg.arcRadius <= 0) return null;
            return renderCornerArc(points[idx], idx, seg.arcRadius, ctx);
          })}

          {/* Метки углов */}
          {isClosed && points.map((pt, idx) => renderAngleLabel(pt, idx, ctx))}

          {/* Ghost */}
          {renderGhost(ctx)}

          {/* Inline-edit размеров на чертеже */}
          {points.length >= 2 && (
            <InlineDimLabels state={state} onChange={onChange} />
          )}

          {/* Точки */}
          {renderPoints(ctx, handlers)}

          {/* Подсказки */}
          {renderHints(ctx)}
        </g>
      </svg>

      <PlanCanvasOverlay
        state={state}
        onChange={onChange}
        ctxMenu={ctxMenu}
        onCloseCtxMenu={() => setCtxMenu(null)}
        lpIndicator={lpIndicator}
      />
    </div>
  );
}