import React, { useRef, useCallback, useEffect } from "react";
import type { PlanState, Point, Segment, DiagonalDef, DimLine } from "./planTypes";
import {
  pointLabel, segmentLabel, distPx, midPoint, segmentNormal,
  snapVal, snapToPoint, orthoPoint, buildAutoDiagonals, genId,
  pxToCm, calcScale, angleDeg, buildShapePath,
} from "./planTypes";
import Icon from "@/components/ui/icon";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

const PT_R       = 7;    // радиус точки (чуть больше для тача)
const PT_HIT     = 22;   // зона клика по точке на тач
const SNAP_THR   = 30;   // увеличен для надёжного снаппинга на тач
const CLOSE_THR  = 30;   // порог замыкания (больше для пальца)
const DIM_OFF    = 28;

export default function PlanCanvas({ state, onChange }: Props) {
  const svgRef    = useRef<SVGSVGElement>(null);
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

  // ════════════════════════════════════════════════════════════════════════
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
      const newPts = points.map(p => p.id === dragRef.current!.pointId ? { ...p, x, y } : p);
      onChange({ points: newPts, diagonals: buildAutoDiagonals(newPts, diagonals) });
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
        const newPts = points.map(p => p.id === dragRef.current!.pointId ? { ...p, x, y } : p);
        onChange({ points: newPts, diagonals: buildAutoDiagonals(newPts, diagonals) });
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

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderDimLine = (seg: Segment) => {
    if (!showDimLines || !seg.showDimLine) return null;
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return null;
    const { nx, ny } = segmentNormal(a, b);
    const off = DIM_OFF;
    const x1 = a.x + nx * off, y1 = a.y + ny * off;
    const x2 = b.x + nx * off, y2 = b.y + ny * off;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const lenCm = seg.lengthCm ?? pxToCm(distPx(a, b), scale);
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
  };

  const renderSegmentLabel = (seg: Segment) => {
    if (!showSegmentLabels || !seg.showLength) return null;
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return null;
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const lbl = segmentLabel(points, seg);
    const lenCm = seg.lengthCm ?? pxToCm(distPx(a, b), scale);
    const text = lenCm !== null ? `${lbl}: ${lenCm} см` : lbl;
    return (
      <text key={`lbl-${seg.id}`} x={mid.x + nx * 13} y={mid.y + ny * 13}
        textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#e2e8f0" fontFamily="monospace"
        className="pointer-events-none select-none">{text}</text>
    );
  };

  const renderAngleLabel = (pt: Point, idx: number) => {
    if (!showAngleLabels || !isClosed) return null;
    const n = points.length;
    const prev = points[(idx - 1 + n) % n];
    const next = points[(idx + 1) % n];
    const deg = angleDeg(prev, pt, next);
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
  };

  const renderCornerArc = (pt: Point, idx: number, radiusPx: number) => {
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
  };

  const renderCustomDimLine = (dl: DimLine) => {
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
      <g key={`cdl-${dl.id}`} style={{ cursor: tool === "delete" ? "not-allowed" : "pointer" }} onClick={e => handleDimLineClick(e, dl.id)}>
        <line x1={a.x + nx * (off - 7)} y1={a.y + ny * (off - 7)} x2={a.x + nx * (off + 7)} y2={a.y + ny * (off + 7)} stroke={col} strokeWidth={1.5} />
        <line x1={b.x + nx * (off - 7)} y1={b.y + ny * (off - 7)} x2={b.x + nx * (off + 7)} y2={b.y + ny * (off + 7)} stroke={col} strokeWidth={1.5} />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={isSel ? 2 : 1.5} />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
        {lenCm !== null && <text x={mx} y={my} transform={`rotate(${na},${mx},${my})`} textAnchor="middle" dominantBaseline="auto" dy={-5} fontSize={10} fill={col} fontFamily="monospace" className="select-none">{lenCm} см</text>}
      </g>
    );
  };

  const cursor = isPanning.current ? "grabbing" : tool === "draw" ? "crosshair" : tool === "move" ? "default" : tool === "delete" ? "not-allowed" : tool === "arc" ? "cell" : "default";
  const shapePath = buildShapePath(points, segments, isClosed);

  // Позиция long-press индикатора (в координатах экрана)
  const [lpIndicator, setLpIndicator] = React.useState<{ x: number; y: number } | null>(null);

  // Запускаем индикатор вместе с таймером — патчим handleTouchStart через useEffect
  useEffect(() => {
    // Следим за longPressPos и показываем индикатор
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

  return (
    <div className="w-full h-full overflow-hidden relative bg-[#0f1117] select-none touch-none">
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
          {segments.map(seg => {
            const a = points.find(p => p.id === seg.fromId);
            const b = points.find(p => p.id === seg.toId);
            if (!a || !b) return null;
            const isSel = seg.id === selectedSegmentId;
            return (
              <g key={seg.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={20}
                  style={{ cursor: tool === "delete" ? "not-allowed" : "pointer" }}
                  onClick={e => handleSegmentClick(e, seg.id)}
                  onContextMenu={e => handleSegmentCtxMenu(e, seg.id)}
                />
                {isSel && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c4b5fd" strokeWidth={3} strokeDasharray="6 3" className="pointer-events-none" />}
              </g>
            );
          })}

          {/* Размерные линии */}
          {segments.map(seg => renderDimLine(seg))}
          {/* Подписи */}
          {segments.map(seg => renderSegmentLabel(seg))}
          {/* Пользовательские размерные линии */}
          {dimLines.map(dl => renderCustomDimLine(dl))}

          {/* Диагонали */}
          {showDiagonals && diagonals.filter(d => d.visible).map(diag => {
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
                  onClick={e => handleDiagonalClick(e, diag.id)}
                />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isSel ? "#fb923c" : "#92400e"} strokeWidth={isSel ? 1.8 : 1.2} strokeDasharray="7 4" className="pointer-events-none" />
                {diag.showLength && lenCm !== null && (
                  <text x={mid.x + 4} y={mid.y - 5} fontSize={9.5} fill={isSel ? "#fb923c" : "#f59e0b"} fontFamily="monospace" className="pointer-events-none select-none">{lbl}: {lenCm} см</text>
                )}
              </g>
            );
          })}

          {/* Дуги скруглений */}
          {isClosed && segments.map(seg => {
            const idx = points.findIndex(p => p.id === seg.toId);
            if (idx < 0 || seg.arcRadius <= 0) return null;
            return renderCornerArc(points[idx], idx, seg.arcRadius);
          })}

          {/* Метки углов */}
          {isClosed && points.map((pt, idx) => renderAngleLabel(pt, idx))}

          {/* Ghost (только мышь) */}
          {ghost && points.length > 0 && tool === "draw" && (
            <line x1={points[points.length - 1].x} y1={points[points.length - 1].y}
              x2={ghost.x} y2={ghost.y}
              stroke={ghost.willClose ? "#34d399" : "#818cf8"} strokeWidth={1.5} strokeDasharray="6 4" className="pointer-events-none" />
          )}
          {ghost && tool === "draw" && (
            <circle cx={ghost.x} cy={ghost.y} r={ghost.willClose ? 11 : 4}
              fill={ghost.willClose ? "rgba(52,211,153,0.2)" : "rgba(129,140,248,0.3)"}
              stroke={ghost.willClose ? "#34d399" : "#818cf8"} strokeWidth={1.5} className="pointer-events-none" />
          )}
          {/* Ghost для dimline — от первой точки к курсору */}
          {ghost && tool === "dimline" && dimLineFrom && (() => {
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

          {/* Точки */}
          {showPoints && points.map((pt, idx) => {
            const isSel = pt.id === selectedPointId;
            const isFirst = idx === 0;
            const seg = segments.find(s => s.toId === pt.id);
            const hasArc = seg ? seg.arcRadius > 0 : false;
            return (
              <g key={pt.id}
                style={{ cursor: tool === "move" ? "grab" : tool === "delete" ? "not-allowed" : "pointer" }}
                onClick={e => handlePointClick(e, pt.id)}
                onMouseDown={e => handlePointMouseDown(e, pt.id)}
                onContextMenu={e => handlePointCtxMenu(e, pt.id)}
              >
                {/* Увеличенная зона касания */}
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
                  <text x={pt.x + 11} y={pt.y - 11} fontSize={11} fontWeight={700} fill="#e2e8f0" fontFamily="monospace" className="pointer-events-none select-none">{pointLabel(idx)}</text>
                )}
              </g>
            );
          })}

          {/* Подсказки */}
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
          {/* Подсветка первой точки dimline */}
          {tool === "dimline" && dimLineFrom && (() => {
            const pt = points.find(p => p.id === dimLineFrom);
            if (!pt) return null;
            return <circle cx={pt.x} cy={pt.y} r={PT_R + 8} fill="none" stroke="#a78bfa" strokeWidth={2} opacity={0.7} strokeDasharray="3 2" className="pointer-events-none" />;
          })()}
        </g>
      </svg>

      {/* Long-press индикатор — анимированный круг */}
      {lpIndicator && (
        <div
          className="pointer-events-none absolute z-30"
          style={{ left: lpIndicator.x, top: lpIndicator.y, transform: "translate(-50%,-50%)" }}
        >
          <div className="w-12 h-12 rounded-full border-2 border-violet-400/70 animate-ping" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-violet-500/40" />
          </div>
        </div>
      )}

      {/* Контекстное меню */}
      {ctxMenu && (
        <div className="fixed z-50 bg-[#1a1b2e] border border-white/[0.12] rounded-xl shadow-2xl py-1 min-w-[180px]"
          style={{
            left: Math.min(ctxMenu.x, window.innerWidth - 196),
            top:  Math.min(ctxMenu.y, window.innerHeight - 180),
          }}
          onClick={() => setCtxMenu(null)}>
          {ctxMenu.type === "point" && (<>
            <CtxItem icon="Move" label="Переместить" onClick={() => onChange({ tool: "move", selectedPointId: ctxMenu.id })} />
            <div className="h-px bg-white/[0.08] my-1" />
            <CtxItem icon="Trash2" label="Удалить точку" danger onClick={() => {
              const newPts = points.filter(p => p.id !== ctxMenu.id);
              const newSegs = segments.filter(s => s.fromId !== ctxMenu.id && s.toId !== ctxMenu.id);
              onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [], isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
            }} />
          </>)}
          {ctxMenu.type === "segment" && (<>
            <CtxItem icon="Spline" label="Добавить дугу" onClick={() => {
              const seg = segments.find(s => s.id === ctxMenu.id);
              if (seg) onChange({ segments: segments.map(s => s.id === ctxMenu.id ? { ...s, arcRadius: Math.max(20, s.arcRadius + 20) } : s) });
            }} />
            <CtxItem icon="Eye" label="Скрыть длину" onClick={() => onChange({ segments: segments.map(s => s.id === ctxMenu.id ? { ...s, showLength: !s.showLength } : s) })} />
            <div className="h-px bg-white/[0.08] my-1" />
            <CtxItem icon="Trash2" label="Удалить отрезок" danger onClick={() => onChange({ segments: segments.filter(s => s.id !== ctxMenu.id), isClosed: false })} />
          </>)}
          {ctxMenu.type === "diagonal" && (<>
            <CtxItem icon="Eye" label="Скрыть длину" onClick={() => onChange({ diagonals: diagonals.map(d => d.id === ctxMenu.id ? { ...d, showLength: !d.showLength } : d) })} />
            <div className="h-px bg-white/[0.08] my-1" />
            <CtxItem icon="Trash2" label="Удалить" danger onClick={() => onChange({ diagonals: diagonals.filter(d => d.id !== ctxMenu.id) })} />
          </>)}
        </div>
      )}

      {/* Мини zoom */}
      <div className="absolute bottom-8 right-3 flex flex-col gap-1">
        <button onClick={() => onChange({ settings: { ...settings, zoom: Math.min(4, Math.round((zoom + 0.2) * 10) / 10) } })}
          className="w-9 h-9 rounded-xl bg-white/[0.07] border border-white/[0.1] text-white/50 hover:bg-white/[0.14] flex items-center justify-center transition active:scale-95">
          <Icon name="Plus" size={15} />
        </button>
        <div className="w-9 h-6 flex items-center justify-center text-[10px] text-white/30 font-mono">{Math.round(zoom * 100)}%</div>
        <button onClick={() => onChange({ settings: { ...settings, zoom: Math.max(0.3, Math.round((zoom - 0.2) * 10) / 10) } })}
          className="w-9 h-9 rounded-xl bg-white/[0.07] border border-white/[0.1] text-white/50 hover:bg-white/[0.14] flex items-center justify-center transition active:scale-95">
          <Icon name="Minus" size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Утилиты поиска ближайшего элемента ───────────────────────────────────────

function ptToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
}

function findNearestSegment(x: number, y: number, points: Point[], segments: Segment[], threshold: number): Segment | null {
  let best: Segment | null = null;
  let bestD = threshold;
  for (const seg of segments) {
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) continue;
    const d = ptToSegDist(x, y, a.x, a.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = seg; }
  }
  return best;
}

function findNearestDiagonal(x: number, y: number, points: Point[], diagonals: DiagonalDef[], threshold: number): DiagonalDef | null {
  let best: DiagonalDef | null = null;
  let bestD = threshold;
  for (const diag of diagonals) {
    if (!diag.visible) continue;
    const a = points.find(p => p.id === diag.fromId);
    const b = points.find(p => p.id === diag.toId);
    if (!a || !b) continue;
    const d = ptToSegDist(x, y, a.x, a.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = diag; }
  }
  return best;
}

function CtxItem({ icon, label, onClick, danger = false }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition hover:bg-white/[0.06] ${danger ? "text-rose-400" : "text-white/70"}`}>
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}