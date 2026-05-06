import React, { useCallback, useEffect } from "react";
import type { PlanState, Point, Segment, DimLine } from "./planTypes";
import {
  snapVal, snapToPoint, orthoPoint, buildAutoDiagonals, genId,
} from "./planTypes";
import { PT_HIT, SNAP_THR, CLOSE_THR, DIM_OFF, findNearestSegment, findNearestDiagonal } from "./PlanCanvasUtils";
import { distPx } from "./planTypes";
import type { PlanCanvasState } from "./usePlanCanvasState";

interface Params {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  cs: PlanCanvasState;
}

/** Хук: все обработчики событий холста (mouse, touch, wheel, keyboard) */
export function usePlanCanvasEvents({ state, onChange, cs }: Params) {
  const {
    svgRef, dragRef, panRef, pinchRef, isPanning, didMoveRef,
    longPressRef, longPressPos, setVibrated,
    setGhost, dimLineFrom, setDimLineFrom, setCtxMenu,
  } = cs;

  const {
    points, segments, diagonals, dimLines,
    isClosed, settings, tool, phase,
    selectedPointId, selectedSegmentId, selectedDiagonalId, selectedDimLineId,
  } = state;

  const { ortho, snapToPoints: snapPts, showGrid, gridSize, zoom, panX, panY } = settings;

  // ── Конвертация координат ────────────────────────────────────────────────
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom - panX,
      y: (clientY - rect.top)  / zoom - panY,
    };
  }, [zoom, panX, panY, svgRef]);

  const applySnap = useCallback((rawX: number, rawY: number, excludeId: string | null = null) => {
    const snappedFirst = snapToPoint(rawX, rawY, points, excludeId, SNAP_THR, snapPts);
    if (snappedFirst.snapped) return { x: snappedFirst.x, y: snappedFirst.y, snapped: true };
    let x = snapVal(rawX, gridSize, showGrid);
    let y = snapVal(rawY, gridSize, showGrid);
    if (ortho && points.length > 0 && tool === "draw" && !isClosed) {
      const o = orthoPoint(points[points.length - 1], x, y);
      x = o.x; y = o.y;
    }
    // Ортогональное перетаскивание: привязываем к соседним точкам по горизонтали/вертикали
    if (ortho && tool === "move" && excludeId) {
      const neighbors = segments
        .filter(s => s.fromId === excludeId || s.toId === excludeId)
        .map(s => points.find(p => p.id === (s.fromId === excludeId ? s.toId : s.fromId)))
        .filter(Boolean) as typeof points;
      if (neighbors.length > 0) {
        // Берём ближайшего соседа по оси к которой мы ближе
        let bestX = x, bestY = y, bestDist = Infinity;
        for (const nb of neighbors) {
          const dx = Math.abs(x - nb.x);
          const dy = Math.abs(y - nb.y);
          if (dx < bestDist) { bestDist = dx; bestX = nb.x; bestY = y; }
          if (dy < bestDist) { bestDist = dy; bestX = x; bestY = nb.y; }
        }
        x = bestX; y = bestY;
      }
    }
    return { x, y, snapped: false };
  }, [gridSize, showGrid, ortho, points, tool, isClosed, snapPts, segments]);

  // ── Long press ────────────────────────────────────────────────────────────
  const clearLongPress = useCallback(() => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
    longPressPos.current = null;
  }, [longPressRef, longPressPos]);

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
      const baseScale = state.baseScale ?? null;
      const newSegs = segments.map(s => {
        if (s.fromId !== movedId && s.toId !== movedId) return s;
        if (!baseScale) return { ...s, lengthCm: null };
        const a = newPts.find(p => p.id === s.fromId);
        const b = newPts.find(p => p.id === s.toId);
        const px = a && b ? distPx(a, b) : 0;
        return { ...s, lengthCm: Math.round((px / baseScale) * 10) / 10 };
      });
      onChange({ points: newPts, segments: newSegs, diagonals: buildAutoDiagonals(newPts, diagonals) });
    }
  }, [tool, phase, isClosed, points, dimLineFrom, clientToSvg, applySnap, diagonals, onChange, settings, zoom, panRef, dragRef, setGhost, segments]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      panRef.current = { startX: e.clientX, startY: e.clientY, origPanX: panX, origPanY: panY };
      isPanning.current = true;
    }
  }, [panX, panY, panRef, isPanning]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null; panRef.current = null; isPanning.current = false;
  }, [dragRef, panRef, isPanning]);

  // ════════════════════════════════════════════════════════════════════════
  // TOUCH EVENTS
  // ════════════════════════════════════════════════════════════════════════

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

      const hitPt   = points.find(p => distPx(p, { id: "", x: raw.x, y: raw.y }) < PT_HIT);
      const hitSeg  = !hitPt ? findNearestSegment(raw.x, raw.y, points, segments, 18) : null;
      const hitDiag = !hitPt && !hitSeg ? findNearestDiagonal(raw.x, raw.y, points, diagonals, 18) : null;

      if (hitPt || hitSeg || hitDiag) {
        const type = hitPt ? "point" : hitSeg ? "segment" : "diagonal";
        const id   = (hitPt?.id ?? hitSeg?.id ?? hitDiag?.id)!;
        longPressPos.current = { clientX: t.clientX, clientY: t.clientY, type, id };

        longPressRef.current = setTimeout(() => {
          if (!longPressPos.current) return;
          if ("vibrate" in navigator) navigator.vibrate(40);
          setVibrated(true);
          setTimeout(() => setVibrated(false), 300);
          setCtxMenu({
            x: longPressPos.current.clientX,
            y: longPressPos.current.clientY,
            type: longPressPos.current.type,
            id:   longPressPos.current.id,
          });
          didMoveRef.current = true;
          dragRef.current = null;
          panRef.current = null;
          longPressPos.current = null;
        }, 500);
      }

      if (tool === "move" && hitPt) {
        dragRef.current = { pointId: hitPt.id };
        return;
      }
      panRef.current = { startX: t.clientX, startY: t.clientY, origPanX: panX, origPanY: panY };
    }
  }, [tool, points, segments, diagonals, clientToSvg, panX, panY, zoom, clearLongPress,
      pinchRef, panRef, dragRef, didMoveRef, longPressRef, longPressPos, setVibrated, setCtxMenu]);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (longPressRef.current) clearLongPress();

    if (e.touches.length === 2 && pinchRef.current) {
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
      if (dragRef.current && tool === "move") {
        const raw = clientToSvg(t.clientX, t.clientY);
        const { x, y } = applySnap(raw.x, raw.y, dragRef.current.pointId);
        const movedId = dragRef.current.pointId;
        const newPts = points.map(p => p.id === movedId ? { ...p, x, y } : p);
        const baseScale = state.baseScale ?? null;
        const newSegs = segments.map(s => {
          if (s.fromId !== movedId && s.toId !== movedId) return s;
          if (!baseScale) return { ...s, lengthCm: null };
          const a = newPts.find(p => p.id === s.fromId);
          const b = newPts.find(p => p.id === s.toId);
          const px = a && b ? distPx(a, b) : 0;
          return { ...s, lengthCm: Math.round((px / baseScale) * 10) / 10 };
        });
        onChange({ points: newPts, segments: newSegs, diagonals: buildAutoDiagonals(newPts, diagonals) });
        didMoveRef.current = true;
        return;
      }
      if (panRef.current) {
        const dx = (t.clientX - panRef.current.startX) / zoom;
        const dy = (t.clientY - panRef.current.startY) / zoom;
        onChange({ settings: { ...settings, panX: panRef.current.origPanX + dx, panY: panRef.current.origPanY + dy } });
        didMoveRef.current = true;
      }
    }
  }, [tool, points, segments, clientToSvg, applySnap, diagonals, onChange, settings, zoom,
      clearLongPress, pinchRef, panRef, dragRef, didMoveRef, longPressRef]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    pinchRef.current = null;
    clearLongPress();

    if (didMoveRef.current) {
      dragRef.current = null; panRef.current = null;
      didMoveRef.current = false;
      return;
    }

    if (e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const raw = clientToSvg(t.clientX, t.clientY);

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

      if (tool === "draw" && phase === "draw" && !isClosed) {
        const { x, y } = applySnap(raw.x, raw.y);
        if (points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THR) {
          const closing: Segment = { id: genId("s"), fromId: points[points.length - 1].id, toId: points[0].id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 };
          const newSegs = [...segments, closing];
          const newDiags = buildAutoDiagonals(points, diagonals);
          onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: newSegs[0]?.id ?? null, sidebarTab: "drawing" });
        } else {
          const np: Point = { id: genId("pt"), x, y };
          const newPts = [...points, np];
          const newSegs = [...segments];
          if (points.length > 0) newSegs.push({ id: genId("s"), fromId: points[points.length - 1].id, toId: np.id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 });
          onChange({ points: newPts, segments: newSegs });
        }
      } else {
        onChange({ selectedPointId: null, selectedSegmentId: null, selectedDiagonalId: null });
      }
    }

    dragRef.current = null; panRef.current = null; didMoveRef.current = false;
  }, [tool, phase, isClosed, points, segments, diagonals, dimLines, dimLineFrom,
      clientToSvg, applySnap, onChange, clearLongPress,
      pinchRef, panRef, dragRef, didMoveRef, setDimLineFrom]);

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
    svg.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    return () => { svg.removeEventListener("wheel", handleWheel); };
  }, [handleWheel, svgRef]);

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
        onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: newSegs[0]?.id ?? null, sidebarTab: "drawing" });
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
  }, [tool, phase, isClosed, points, segments, diagonals, clientToSvg, applySnap, onChange, isPanning, svgRef, setCtxMenu, setGhost]);

  // ── Клики на элементы (мышь) ─────────────────────────────────────────────
  const handlePointClick = useCallback((e: React.MouseEvent, pointId: string) => {
    e.stopPropagation(); setCtxMenu(null);
    if (tool === "delete") {
      const newPts = points.filter(p => p.id !== pointId);
      const newSegs = segments.filter(s => s.fromId !== pointId && s.toId !== pointId);
      onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [], isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
      return;
    }
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
    if (tool === "draw" && phase === "draw" && !isClosed) {
      const pt = points.find(p => p.id === pointId);
      if (!pt) return;
      if (pointId === points[0]?.id && points.length >= 3) {
        const closing: Segment = { id: genId("s"), fromId: points[points.length - 1].id, toId: points[0].id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 };
        const newSegs = [...segments, closing];
        const newDiags = buildAutoDiagonals(points, diagonals);
        onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: newSegs[0]?.id ?? null, sidebarTab: "drawing" });
        setGhost(null);
        return;
      }
      if (pointId === points[points.length - 1]?.id) return;
      const np = { ...pt, id: genId("pt") };
      const newPts = [...points, np];
      const newSegs = [...segments];
      newSegs.push({ id: genId("s"), fromId: points[points.length - 1].id, toId: np.id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 });
      onChange({ points: newPts, segments: newSegs });
      return;
    }
    onChange({ selectedPointId: pointId, selectedSegmentId: null, selectedDiagonalId: null, selectedArcId: null });
  }, [tool, phase, isClosed, points, segments, diagonals, dimLines, dimLineFrom, onChange, setCtxMenu, setDimLineFrom, setGhost]);

  const handlePointCtxMenu = useCallback((e: React.MouseEvent, pointId: string) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "point", id: pointId });
  }, [setCtxMenu]);

  const handlePointMouseDown = useCallback((e: React.MouseEvent, pointId: string) => {
    if (tool !== "move") return;
    e.stopPropagation();
    dragRef.current = { pointId };
  }, [tool, dragRef]);

  const handleSegmentClick = useCallback((e: React.MouseEvent, segId: string) => {
    e.stopPropagation(); setCtxMenu(null);
    if (tool === "delete") { onChange({ segments: segments.filter(s => s.id !== segId), isClosed: false }); return; }
    if (tool === "arc") {
      const seg = segments.find(s => s.id === segId);
      if (seg) onChange({ segments: segments.map(s => s.id === segId ? { ...s, arcRadius: (seg.arcRadius + 15) % 90 } : s) });
      return;
    }
    onChange({ selectedSegmentId: segId, selectedPointId: null, selectedDiagonalId: null, selectedArcId: null });
  }, [tool, segments, onChange, setCtxMenu]);

  const handleSegmentCtxMenu = useCallback((e: React.MouseEvent, segId: string) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "segment", id: segId });
  }, [setCtxMenu]);

  const handleDiagonalClick = useCallback((e: React.MouseEvent, diagId: string) => {
    e.stopPropagation(); setCtxMenu(null);
    if (tool === "delete") { onChange({ diagonals: diagonals.filter(d => d.id !== diagId) }); return; }
    onChange({ selectedDiagonalId: diagId, selectedPointId: null, selectedSegmentId: null, selectedArcId: null });
  }, [tool, diagonals, onChange, setCtxMenu]);

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
  }, [phase, points, segments, isClosed, diagonals, dimLines, selectedPointId, selectedSegmentId, selectedDiagonalId, selectedDimLineId, onChange, setGhost, setCtxMenu]);

  return {
    clientToSvg,
    applySnap,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleCanvasClick,
    handlePointClick,
    handlePointCtxMenu,
    handlePointMouseDown,
    handleSegmentClick,
    handleSegmentCtxMenu,
    handleDiagonalClick,
    handleDimLineClick,
  };
}