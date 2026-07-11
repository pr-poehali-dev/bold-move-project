import React, { useCallback, useEffect, useRef } from "react";
import type { PlanState, Point, Segment, DimLine } from "./planTypes";
import {
  snapVal, snapToPoint, orthoPoint, buildAutoDiagonals, genId,
} from "./planTypes";
import { PT_HIT, SNAP_THR, CLOSE_THR, DIM_OFF, findNearestSegment, findNearestDiagonal, ptToSegDist } from "./PlanCanvasUtils";
import { distPx } from "./planTypes";
import type { PlanCanvasState } from "./usePlanCanvasState";

interface Params {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  onReplace: (patch: Partial<PlanState>) => void; // replace без записи в историю (для drag)
  cs: PlanCanvasState;
  onStartEditSeg?: (segId: string) => void; // двойной тап по стене → открыть ввод длины
}

/** Хук: все обработчики событий холста (mouse, touch, wheel, keyboard) */
export function usePlanCanvasEvents({ state, onChange, onReplace, cs, onStartEditSeg }: Params) {
  const {
    svgRef, dragRef, nearbyPtRef, touchStartTimeRef, panRef, pinchRef, isPanning, didMoveRef,
    longPressRef, longPressPos, setVibrated,
    setGhost, dimLineFrom, setDimLineFrom, setCtxMenu, setDeleteHover,
    setLassoPath,
  } = cs;

  // Блокируем mouse-click после touch чтобы избежать двойного вызова
  const lastTouchEndRef = useRef<number>(0);

  // Двойной тап по пустой области полигона → выбрать все стены
  const lastEmptyTapRef = useRef<number>(0);

  // Двойной тап по стене → открыть ввод длины
  const lastSegTapRef = useRef<{ id: string; time: number } | null>(null);

  // ПК: "покраска" выделения — зажали кнопку в любом месте канваса, ведём мышь по стенам
  // без отпускания — каждая стена под курсором добавляется/убирается тем же режимом.
  // mode === null пока курсор ещё не коснулся ни одной стены (режим определится по первой встреченной).
  const dragSelectRef = useRef<{ mode: "add" | "remove" | null; visited: Set<string> } | null>(null);

  const {
    points, segments, diagonals, dimLines,
    isClosed, settings, tool, phase,
    selectedPointId, selectedSegmentId, selectedDiagonalId, selectedDimLineId,
  } = state;

  const { ortho, snapToPoints: snapPts, showGrid, gridSize, zoom, panX, panY } = settings;

  // Ref для актуального tool — чтобы обработчики через addEventListener читали текущее значение
  const toolRef = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  // Ref для selectedPointId — чтобы touchStart читал актуальное значение
  const selectedPointIdRef = useRef(selectedPointId);
  useEffect(() => { selectedPointIdRef.current = selectedPointId; }, [selectedPointId]);

  // Ref для актуального selectedSegmentIds — чтобы избежать stale closure в touch-обработчиках
  const selectedSegmentIdsRef = useRef<string[]>(state.selectedSegmentIds ?? []);
  useEffect(() => { selectedSegmentIdsRef.current = state.selectedSegmentIds ?? []; }, [state.selectedSegmentIds]);

  // Ref для актуальных settings — чтобы pinch/pan всегда читал свежие zoom/panX/panY
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Если масштаб установлен — snap по 1 см, иначе по gridSize пикселей
  const effectiveGridSize = state.baseScale ? state.baseScale : gridSize;

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
    let x = snapVal(rawX, effectiveGridSize, showGrid);
    let y = snapVal(rawY, effectiveGridSize, showGrid);
    if (ortho && points.length > 0 && tool === "draw" && !isClosed) {
      const o = orthoPoint(points[points.length - 1], x, y);
      x = o.x; y = o.y;
    }
    // Ортогональное перетаскивание: привязываем к соседним точкам по горизонтали/вертикали
    // Срабатывает только если точка близко к оси соседа (порог ORTHO_SNAP_THR)
    const ORTHO_SNAP_THR = 12; // px — мягкий порог притяжения к оси
    if (ortho && tool === "move" && excludeId) {
      const neighbors = segments
        .filter(s => s.fromId === excludeId || s.toId === excludeId)
        .map(s => points.find(p => p.id === (s.fromId === excludeId ? s.toId : s.fromId)))
        .filter(Boolean) as typeof points;
      if (neighbors.length > 0) {
        let bestX = x, bestY = y;
        let snapX = false, snapY = false;
        for (const nb of neighbors) {
          // Привязываем по X только если очень близко к вертикали соседа
          if (Math.abs(x - nb.x) < ORTHO_SNAP_THR) { bestX = nb.x; snapX = true; }
          // Привязываем по Y только если очень близко к горизонтали соседа
          if (Math.abs(y - nb.y) < ORTHO_SNAP_THR) { bestY = nb.y; snapY = true; }
        }
        if (snapX) x = bestX;
        if (snapY) y = bestY;
      }
    }
    return { x, y, snapped: false };
  }, [effectiveGridSize, gridSize, showGrid, ortho, points, tool, isClosed, snapPts, segments]);

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
    // ПК: "покраска" выделения стен — кнопка мыши зажата (в любом месте канваса),
    // курсор ведут по стенам. Рисуем произвольную линию-след за курсором (см. lassoPath)
    // и отмечаем стены под ней. Режим (добавить/убрать) определяется по ПЕРВОЙ стене,
    // которую задел курсор — если старт был не на стене, mode ещё не выбран (null).
    if (dragSelectRef.current) {
      const svgPt = clientToSvg(e.clientX, e.clientY);
      setLassoPath(prev => (prev ? [...prev, svgPt] : [svgPt]));

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const segId = el?.getAttribute("data-seg-id");
      if (segId && !dragSelectRef.current.visited.has(segId)) {
        dragSelectRef.current.visited.add(segId);
        const prev = selectedSegmentIdsRef.current;
        const already = prev.includes(segId);
        // Первая встреченная стена — определяем режим по её текущему состоянию
        if (dragSelectRef.current.mode === null) {
          dragSelectRef.current.mode = already ? "remove" : "add";
        }
        const mode = dragSelectRef.current.mode;
        if (mode === "add" && !already) {
          const next = [...prev, segId];
          onChange({ selectedSegmentIds: next, selectedSegmentId: segId });
        } else if (mode === "remove" && already) {
          const next = prev.filter(id => id !== segId);
          onChange({ selectedSegmentIds: next, selectedSegmentId: next.length > 0 ? next[next.length - 1] : null });
        }
      }
      return;
    }
    if (tool === "draw" && phase === "draw" && !isClosed) {
      const raw = clientToSvg(e.clientX, e.clientY);
      const { x, y } = applySnap(raw.x, raw.y);
      const willClose = points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THR;
      setGhost({ x: willClose ? points[0].x : x, y: willClose ? points[0].y : y, willClose });
      setDeleteHover(null);
    } else if (tool === "dimline" && dimLineFrom) {
      const raw = clientToSvg(e.clientX, e.clientY);
      const { x, y } = applySnap(raw.x, raw.y);
      setGhost({ x, y, willClose: false });
      setDeleteHover(null);
    } else if (tool === "delete") {
      setGhost(null);
      const raw = clientToSvg(e.clientX, e.clientY);
      const hitPt = points.find(p => distPx(p, { id: "", x: raw.x, y: raw.y }) < PT_HIT);
      if (hitPt) {
        setDeleteHover({ x: hitPt.x, y: hitPt.y, type: "point" });
      } else {
        const hitSeg = findNearestSegment(raw.x, raw.y, points, segments, 14);
        if (hitSeg) {
          const a = points.find(p => p.id === hitSeg.fromId);
          const b = points.find(p => p.id === hitSeg.toId);
          if (a && b) {
            setDeleteHover({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, type: "segment" });
          } else setDeleteHover(null);
        } else {
          setDeleteHover(null);
        }
      }
    } else {
      setGhost(null);
      setDeleteHover(null);
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
      // replace — не добавляет в историю, drag завершится push'ем в handleMouseUp
      onReplace({ points: newPts, segments: newSegs, diagonals: buildAutoDiagonals(newPts, diagonals, state.baseScale ?? null, true) });
    }
  }, [tool, phase, isClosed, points, segments, dimLineFrom, clientToSvg, applySnap, diagonals, onChange, onReplace, settings, zoom, panRef, dragRef, setGhost, setDeleteHover, setLassoPath]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      panRef.current = { startX: e.clientX, startY: e.clientY, origPanX: panX, origPanY: panY };
      isPanning.current = true;
      return;
    }
    // ПК: зажали левую кнопку в ЛЮБОМ месте канваса (не только на стене — этот случай
    // уже обрабатывает handleSegmentMouseDown с e.stopPropagation) — запускаем "покраску"
    // выделения стен. Режим (добавить/убрать) определится по первой стене под курсором
    // в handleMouseMove. Точки (tool="move") и другие drag-инструменты не задеты —
    // их обработчики вызывают stopPropagation раньше и сюда не доходят.
    if (e.button === 0 && !e.altKey && Date.now() - lastTouchEndRef.current >= 350
      && (tool === "move" || tool === "segment") && !dragSelectRef.current) {
      dragSelectRef.current = { mode: null, visited: new Set() };
      setLassoPath([clientToSvg(e.clientX, e.clientY)]);
    }
  }, [panX, panY, panRef, isPanning, tool, clientToSvg, setLassoPath]);

  const handleMouseUp = useCallback(() => {
    // Если был drag — фиксируем финальное состояние в историю (один шаг undo)
    if (dragRef.current) onChange({ points, segments, diagonals });
    dragRef.current = null; panRef.current = null; isPanning.current = false;
    // Линию-след убираем сразу — визуально она не нужна после отпускания кнопки
    setLassoPath(null);
    // dragSelectRef сбрасываем НЕ сразу — браузер после mouseup ещё пришлёт "click"
    // по тому же сегменту, и handleSegmentClick должен успеть увидеть что drag-select был активен.
    if (dragSelectRef.current) setTimeout(() => { dragSelectRef.current = null; }, 0);
  }, [dragRef, panRef, isPanning, onChange, points, segments, diagonals, setLassoPath]);

  // ════════════════════════════════════════════════════════════════════════
  // TOUCH EVENTS
  // ════════════════════════════════════════════════════════════════════════

  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    didMoveRef.current = false;
    clearLongPress();

    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      pinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy), zoom: settingsRef.current.zoom, midX, midY };
      panRef.current = null;
      dragRef.current = null;
      clearLongPress();
      return;
    }

    if (e.touches.length === 1) {
      touchStartTimeRef.current = performance.now();
      const t = e.touches[0];
      const raw = clientToSvg(t.clientX, t.clientY);

      const hitPt   = points.find(p => distPx(p, { id: "", x: raw.x, y: raw.y }) < PT_HIT);
      const hitSeg  = !hitPt ? findNearestSegment(raw.x, raw.y, points, segments, 20) : null;
      const hitDiag = !hitPt && !hitSeg ? findNearestDiagonal(raw.x, raw.y, points, diagonals, 20) : null;

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

      if (toolRef.current === "move") {
        if (hitPt) {
          // На мобиле drag только если угол уже выбран (selectedPointId совпадает)
          const isMobile = window.innerWidth < 768;
          const alreadySelected = selectedPointIdRef.current === hitPt.id;
          if (!isMobile || alreadySelected) {
            dragRef.current = { pointId: hitPt.id };
            nearbyPtRef.current = null;
            return;
          }
          // Угол не выбран — просто выбираем его, без drag
          nearbyPtRef.current = null;
        }
        // Нет прямого попадания в точку — drag не начинаем, только pan
        nearbyPtRef.current = null;
      }
      // Если попали в сегмент — не устанавливаем pan, чтобы дрожание пальца не сбивало клик
      if (!hitSeg) {
        panRef.current = { startX: t.clientX, startY: t.clientY, origPanX: panX, origPanY: panY };
      }
    }
  }, [tool, points, segments, diagonals, clientToSvg, panX, panY, zoom, clearLongPress,
      pinchRef, panRef, dragRef, nearbyPtRef, didMoveRef, longPressRef, longPressPos, setVibrated, setCtxMenu, settingsRef]);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (longPressRef.current) clearLongPress();

    if (e.touches.length === 2) {
      // Сбрасываем pan — мы в режиме pinch
      panRef.current = null;
      dragRef.current = null;

      if (!pinchRef.current) {
        // Инициализируем pinch если ещё не было (второй палец лёг во время move)
        const dx0 = e.touches[0].clientX - e.touches[1].clientX;
        const dy0 = e.touches[0].clientY - e.touches[1].clientY;
        const mid0X = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const mid0Y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        pinchRef.current = { dist: Math.sqrt(dx0 * dx0 + dy0 * dy0), zoom: settingsRef.current.zoom, midX: mid0X, midY: mid0Y };
        return;
      }

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const rawDist = Math.sqrt(dx * dx + dy * dy);
      // Сглаживание расстояния (EMA α=0.35) — убирает дрожание пальцев
      const dist = pinchRef.current.dist * 0.65 + rawDist * 0.35;
      // Игнорируем микро-дрожание < 3px
      if (Math.abs(rawDist - pinchRef.current.dist) < 3) return;
      // ratio от предыдущего шага — ограничиваем макс изменение за кадр (не более 5%)
      const rawRatio = rawDist / pinchRef.current.dist;
      const stepRatio = Math.max(0.95, Math.min(1.05, rawRatio));
      const cur = settingsRef.current;
      const newZoom = Math.max(0.3, Math.min(4, cur.zoom * stepRatio));

      const svg = svgRef.current;
      const rect = svg ? svg.getBoundingClientRect() : { left: 0, top: 0 };
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      // Зум к точке под пальцами: точка в SVG-координатах остаётся на месте
      const originX = (midX - rect.left) / cur.zoom - cur.panX;
      const originY = (midY - rect.top)  / cur.zoom - cur.panY;
      const newPanX = (midX - rect.left) / newZoom - originX;
      const newPanY = (midY - rect.top)  / newZoom - originY;

      // Пан от смещения центра между пальцами
      const panDx = pinchRef.current.midX !== undefined ? (midX - pinchRef.current.midX) / newZoom : 0;
      const panDy = pinchRef.current.midY !== undefined ? (midY - pinchRef.current.midY) / newZoom : 0;

      // Обновляем dist (сглаженный) и mid для следующего шага
      pinchRef.current = { ...pinchRef.current, dist, midX, midY };
      onChange({ settings: { ...cur, zoom: newZoom, panX: newPanX + panDx, panY: newPanY + panDy } });
      didMoveRef.current = true;
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      // Drag точки — только если tool === "move" и dragRef уже установлен в touchStart
      if (dragRef.current && toolRef.current === "move") {
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
        // replace — не добавляет в историю, drag завершится push'ем в handleTouchEnd
        onReplace({ points: newPts, segments: newSegs, diagonals: buildAutoDiagonals(newPts, diagonals, state.baseScale ?? null, true) });
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
  }, [tool, points, segments, clientToSvg, applySnap, diagonals, onChange, onReplace, settings, zoom,
      clearLongPress, pinchRef, panRef, dragRef, didMoveRef, longPressRef, svgRef, settingsRef]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    pinchRef.current = null;
    nearbyPtRef.current = null;
    clearLongPress();

    if (didMoveRef.current) {
      // Если был drag точки — фиксируем финальное состояние одним шагом в историю
      if (dragRef.current) onChange({ points, segments, diagonals });
      dragRef.current = null; panRef.current = null;
      didMoveRef.current = false;
      return;
    }

    if (e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const raw = clientToSvg(t.clientX, t.clientY);

      // Двойной тап по ПУСТОЙ области полигона — выбрать все стены
      // Засчитывается только если оба тапа были не по стене, не по точке, не по товару
      const tapTarget = e.target as Element;
      const onSegItem = !!tapTarget.closest("[data-seg-item]");
      const SEG_HIT_THR_DBL = Math.max(8, 20 / zoom);
      const hitSegForDbl = findNearestSegment(raw.x, raw.y, points, segments, SEG_HIT_THR_DBL);
      const hitPtForDbl = points.find(p => distPx(p, { id: "", x: raw.x, y: raw.y }) < PT_HIT);
      const isEmptyAreaTap = isClosed && !onSegItem && !hitSegForDbl && !hitPtForDbl;

      if (isEmptyAreaTap) {
        const now = Date.now();
        if (now - lastEmptyTapRef.current < 450) {
          lastEmptyTapRef.current = 0;
          dragRef.current = null; panRef.current = null;
          const allSelected = selectedSegmentIdsRef.current.length === segments.length;
          if (allSelected) {
            // Все уже выбраны — снимаем выделение
            onChange({ selectedSegmentIds: [], selectedSegmentId: null, selectedPointId: null });
          } else {
            // Выбираем все стены
            onChange({ selectedSegmentIds: segments.map(s => s.id), selectedSegmentId: segments[segments.length - 1]?.id ?? null, selectedPointId: null, selectedDiagonalId: null });
          }
          lastTouchEndRef.current = Date.now();
          return;
        }
        lastEmptyTapRef.current = now;
      } else {
        // Тап по стене/точке/товару — сбрасываем счётчик двойного тапа
        lastEmptyTapRef.current = 0;
      }

      // Ищем ближайшую точку и ближайшую стену одновременно
      // Threshold адаптирован к зуму: 20px экранных = 20/zoom в SVG-координатах
      // При высоком зуме (крупный план) уменьшаем threshold чтобы не захватывать соседние тонкие стены
      const SEG_HIT_THR = Math.max(8, 20 / zoom); // порог попадания в стену (px в SVG)
      let hitPtCandidate = points.find(p => distPx(p, { id: "", x: raw.x, y: raw.y }) < PT_HIT) ?? null;
      const hitSegCandidate = findNearestSegment(raw.x, raw.y, points, segments, SEG_HIT_THR);

      // В режиме select/move: если стена ближе к пальцу чем точка — дать приоритет стене
      // (решает проблему с тонкими стенами где угловые точки перекрывают всю стену)
      if (hitPtCandidate && hitSegCandidate && tool !== "delete" && tool !== "dimline" && tool !== "draw") {
        const ptDist = distPx(hitPtCandidate, { id: "", x: raw.x, y: raw.y });
        const segA = points.find(p => p.id === hitSegCandidate.fromId);
        const segB = points.find(p => p.id === hitSegCandidate.toId);
        const segDist = segA && segB ? ptToSegDist(raw.x, raw.y, segA.x, segA.y, segB.x, segB.y) : Infinity;
        // Если палец попал в зону стены ощутимо ближе чем к точке — выбираем стену
        if (segDist + 8 < ptDist) hitPtCandidate = null;
      }

      const hitPt = hitPtCandidate;
      if (hitPt) {
        if (tool === "delete") {
          // Удаляем угол: убираем точку + оба отрезка, соединяем соседей напрямую
          const prevSeg = segments.find(s => s.toId === hitPt.id);
          const nextSeg = segments.find(s => s.fromId === hitPt.id);
          const newPts  = points.filter(p => p.id !== hitPt.id);
          let newSegs   = segments.filter(s => s.fromId !== hitPt.id && s.toId !== hitPt.id);
          if (prevSeg && nextSeg && newPts.length >= 2) {
            // Соединяем предыдущий и следующий узлы новым отрезком
            newSegs = [...newSegs, { ...prevSeg, id: genId("s"), toId: nextSeg.toId, lengthCm: null }];
          }
          const newDiags = newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [];
          const newIsClosed = isClosed && newPts.length >= 3;
          onChange({ points: newPts, segments: newSegs, diagonals: newDiags, isClosed: newIsClosed, phase: newIsClosed ? undefined : "draw", selectedPointId: null });
        } else if (tool === "dimline") {
          if (!dimLineFrom) {
            setDimLineFrom(hitPt.id);
            onChange({ selectedPointId: hitPt.id });
          } else if (dimLineFrom !== hitPt.id) {
            const newDl: DimLine = { id: genId("dl"), fromId: dimLineFrom, toId: hitPt.id, offsetPx: DIM_OFF, visible: true, labelCm: null };
            onChange({ dimLines: [...dimLines, newDl], selectedDimLineId: newDl.id, selectedPointId: null });
            setDimLineFrom(null);
          }
        } else if (tool === "draw") {
          // В режиме рисования тап по точке — не выбираем её, замыкание обрабатывается ниже
        } else {
          onChange({ selectedPointId: hitPt.id, selectedSegmentId: null, selectedSegmentIds: [], selectedDiagonalId: null });
          dragRef.current = null; panRef.current = null;
          return;
        }
        dragRef.current = null; panRef.current = null;
        return;
      }

      const hitSeg = hitSegCandidate ?? findNearestSegment(raw.x, raw.y, points, segments, SEG_HIT_THR);
      if (hitSeg) {
        e.preventDefault();
        lastTouchEndRef.current = Date.now();
        if (tool === "delete") {
          onChange({ segments: segments.filter(s => s.id !== hitSeg.id), isClosed: false, phase: "draw" });
        } else if (tool === "arc") {
          const newR = (hitSeg.arcRadius + 15) % 90;
          onChange({ segments: segments.map(s => s.id === hitSeg.id ? { ...s, arcRadius: newR } : s) });
        } else {
          // Двойной тап по той же стене → открыть ввод длины
          const now = Date.now();
          const prev = lastSegTapRef.current;
          if (prev && prev.id === hitSeg.id && now - prev.time < 450 && onStartEditSeg) {
            lastSegTapRef.current = null;
            onStartEditSeg(hitSeg.id);
            dragRef.current = null; panRef.current = null;
            return;
          }
          lastSegTapRef.current = { id: hitSeg.id, time: now };

          const prev2 = selectedSegmentIdsRef.current;
          const isSelected2 = prev2.includes(hitSeg.id);
          const next2 = isSelected2 ? prev2.filter(id => id !== hitSeg.id) : [...prev2, hitSeg.id];
          onChange({ selectedSegmentIds: next2, selectedSegmentId: next2.length > 0 ? next2[next2.length - 1] : null, selectedPointId: null });
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
          onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: null, selectedSegmentIds: [], sidebarTab: "drawing" });
        } else {
          const np: Point = { id: genId("pt"), x, y };
          const newPts = [...points, np];
          const newSegs = [...segments];
          if (points.length > 0) newSegs.push({ id: genId("s"), fromId: points[points.length - 1].id, toId: np.id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 });
          onChange({ points: newPts, segments: newSegs });
        }
      } else {
        // Не сбрасываем выделение если тап был на иконке товара или попапе
        const tapEl = e.target as Element;
        const onItem = !!tapEl.closest("[data-seg-item]") || !!tapEl.closest("[data-item-popup]") || !!tapEl.closest("[data-active-item]");
        if (!onItem) {
          onChange({ selectedPointId: null, selectedSegmentId: null, selectedSegmentIds: [], selectedDiagonalId: null });
        }
      }
    }

    dragRef.current = null; panRef.current = null; didMoveRef.current = false;
    lastTouchEndRef.current = Date.now();
  }, [tool, phase, isClosed, points, segments, diagonals, dimLines, dimLineFrom,
      clientToSvg, applySnap, onChange, onReplace, clearLongPress,
      pinchRef, panRef, dragRef, nearbyPtRef, didMoveRef, setDimLineFrom, zoom]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  // Зумим "от точки под курсором": берём SVG-координату точки под мышью ДО
  // изменения zoom, затем подбираем panX/panY так, чтобы эта же точка снова
  // оказалась под курсором ПОСЛЕ зума. Без этого чертёж "уезжает" при скролле.
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.3, Math.min(10, Math.round((zoom + delta) * 10) / 10));
    if (newZoom === zoom) return;

    const svg = svgRef.current;
    if (!svg) {
      onChange({ settings: { ...settings, zoom: newZoom } });
      return;
    }
    const rect = svg.getBoundingClientRect();
    const mousePixelX = e.clientX - rect.left;
    const mousePixelY = e.clientY - rect.top;

    // Точка под курсором в координатах чертежа (до зума)
    const svgX = mousePixelX / zoom - panX;
    const svgY = mousePixelY / zoom - panY;

    // Подбираем pan так, чтобы та же точка осталась под курсором (после зума)
    const newPanX = mousePixelX / newZoom - svgX;
    const newPanY = mousePixelY / newZoom - svgY;

    onChange({ settings: { ...settings, zoom: newZoom, panX: newPanX, panY: newPanY } });
  }, [zoom, panX, panY, settings, onChange, svgRef]);

  // Ref для актуального handleTouchMove (чтобы не пересоздавать listener)
  const touchMoveRef = useRef<(e: TouchEvent) => void>(() => {});
  const touchStartRef = useRef<(e: TouchEvent) => void>(() => {});
  const touchEndRef = useRef<(e: TouchEvent) => void>(() => {});

  useEffect(() => { touchMoveRef.current = handleTouchMove as unknown as (e: TouchEvent) => void; }, [handleTouchMove]);
  useEffect(() => { touchStartRef.current = handleTouchStart as unknown as (e: TouchEvent) => void; }, [handleTouchStart]);
  useEffect(() => { touchEndRef.current = handleTouchEnd as unknown as (e: TouchEvent) => void; }, [handleTouchEnd]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onMove  = (e: TouchEvent) => touchMoveRef.current(e);
    const onStart = (e: TouchEvent) => touchStartRef.current(e);
    const onEnd   = (e: TouchEvent) => touchEndRef.current(e);
    svg.addEventListener("wheel",      handleWheel, { passive: false });
    svg.addEventListener("touchmove",  onMove,  { passive: false });
    svg.addEventListener("touchstart", onStart, { passive: false });
    svg.addEventListener("touchend",   onEnd,   { passive: false });
    return () => {
      svg.removeEventListener("wheel",      handleWheel);
      svg.removeEventListener("touchmove",  onMove);
      svg.removeEventListener("touchstart", onStart);
      svg.removeEventListener("touchend",   onEnd);
    };
  }, [handleWheel, svgRef]);  

  // ── Click (мышь) ──────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning.current) return;
    if (Date.now() - lastTouchEndRef.current < 350) return;
    // После drag-select (покраска стен зажатой кнопкой) браузер шлёт финальный click,
    // который может попасть на пустой фон (если отпустили не точно над стеной) —
    // такой click НЕ должен сбрасывать только что сделанное выделение стен.
    // Но если это был просто клик без движения (ни одна стена не задета) — пропускаем
    // защиту, чтобы обычный клик по пустому месту по-прежнему снимал выделение.
    if (dragSelectRef.current && dragSelectRef.current.visited.size > 0) return;
    setCtxMenu(null);
    const isCanvas = e.target === svgRef.current || (e.target as Element).classList.contains("canvas-bg");
    // Двойной клик работает в любом месте полигона, не только по пустому фону
    if (isClosed && e.detail === 2) {
      onChange({ selectedSegmentIds: segments.map(s => s.id), selectedSegmentId: segments[segments.length - 1]?.id ?? null, selectedPointId: null, selectedDiagonalId: null });
      return;
    }
    if (!isCanvas) {
      if (tool !== "draw") onChange({ selectedPointId: null, selectedSegmentId: null, selectedSegmentIds: [], selectedDiagonalId: null, selectedArcId: null, selectedDimLineId: null });
      return;
    }
    if (tool === "draw" && phase === "draw" && !isClosed) {
      const raw = clientToSvg(e.clientX, e.clientY);
      const { x, y } = applySnap(raw.x, raw.y);
      if (points.length >= 3 && distPx({ id: "", x, y }, points[0]) < CLOSE_THR) {
        const closing: Segment = { id: genId("s"), fromId: points[points.length - 1].id, toId: points[0].id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 };
        const newSegs = [...segments, closing];
        const newDiags = buildAutoDiagonals(points, diagonals);
        onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: null, selectedSegmentIds: [], sidebarTab: "drawing" });
        setGhost(null);
        return;
      }
      const np: Point = { id: genId("pt"), x, y };
      const newPts = [...points, np];
      const newSegs = [...segments];
      if (points.length > 0) newSegs.push({ id: genId("s"), fromId: points[points.length - 1].id, toId: np.id, lengthCm: null, showLength: true, showDimLine: true, arcRadius: 0 });
      onChange({ points: newPts, segments: newSegs });
    } else {
      onChange({ selectedPointId: null, selectedSegmentId: null, selectedSegmentIds: [], selectedDiagonalId: null, selectedArcId: null, selectedDimLineId: null });
    }
  }, [tool, phase, isClosed, points, segments, diagonals, clientToSvg, applySnap, onChange, isPanning, svgRef, setCtxMenu, setGhost]);

  // ── Клики на элементы (мышь) ─────────────────────────────────────────────
  const handlePointClick = useCallback((e: React.MouseEvent, pointId: string) => {
    e.stopPropagation(); setCtxMenu(null);
    if (tool === "delete") {
      // Удаляем угол: убираем точку + оба отрезка, соединяем соседей напрямую
      const prevSeg = segments.find(s => s.toId === pointId);
      const nextSeg = segments.find(s => s.fromId === pointId);
      const newPts  = points.filter(p => p.id !== pointId);
      let newSegs   = segments.filter(s => s.fromId !== pointId && s.toId !== pointId);
      if (prevSeg && nextSeg && newPts.length >= 2) {
        newSegs = [...newSegs, { ...prevSeg, id: genId("s"), toId: nextSeg.toId, lengthCm: null }];
      }
      const newIsClosed2 = isClosed && newPts.length >= 3;
      onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [], isClosed: newIsClosed2, phase: newIsClosed2 ? undefined : "draw", selectedPointId: null });
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
        onChange({ segments: newSegs, diagonals: newDiags, isClosed: true, phase: "lengths", tool: "move", activeInputIndex: 0, selectedSegmentId: null, sidebarTab: "drawing" });
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
    onChange({ selectedPointId: pointId, selectedSegmentId: null, selectedSegmentIds: [], selectedDiagonalId: null, selectedArcId: null });
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
    if (Date.now() - lastTouchEndRef.current < 350) return;
    if (tool === "delete") { onChange({ segments: segments.filter(s => s.id !== segId), isClosed: false }); return; }
    if (tool === "arc") {
      const seg = segments.find(s => s.id === segId);
      if (seg) onChange({ segments: segments.map(s => s.id === segId ? { ...s, arcRadius: (seg.arcRadius + 15) % 90 } : s) });
      return;
    }
    // ПК: mousedown-обработчик (handleSegmentMouseDown) уже применил toggle для этой стены —
    // браузер после mousedown+mouseup на одном элементе всегда шлёт ещё и click,
    // повторное применение здесь отменило бы только что сделанный выбор.
    if (dragSelectRef.current) return;
    const prev = selectedSegmentIdsRef.current;
    const isSelected = prev.includes(segId);
    const next = isSelected ? prev.filter(id => id !== segId) : [...prev, segId];
    onChange({
      selectedSegmentIds: next,
      selectedSegmentId: next.length > 0 ? next[next.length - 1] : null,
      selectedPointId: null,
      selectedDiagonalId: null,
      selectedArcId: null,
    });
  }, [tool, segments, state.selectedSegmentIds, onChange, setCtxMenu]);

  // ПК: зажали кнопку мыши на стене — запоминаем режим "покраски" (добавить/убрать)
  // по текущему состоянию ЭТОЙ стены, и сразу применяем его к ней самой.
  // Дальше handleMouseMove подхватывает соседние стены под курсором тем же режимом,
  // пока кнопка не отпущена (см. handleMouseUp).
  const handleSegmentMouseDown = useCallback((e: React.MouseEvent, segId: string) => {
    if (e.button !== 0 || e.altKey) return; // только левая кнопка, без Alt (тот — для pan)
    if (Date.now() - lastTouchEndRef.current < 350) return; // игнорируем синтетический mousedown после тача (мобиле)
    if (tool === "delete" || tool === "arc") return; // в этих режимах click работает как раньше
    const prev = selectedSegmentIdsRef.current;
    const mode: "add" | "remove" = prev.includes(segId) ? "remove" : "add";
    dragSelectRef.current = { mode, visited: new Set([segId]) };
    setLassoPath([clientToSvg(e.clientX, e.clientY)]);
    const next = mode === "add" ? [...prev, segId] : prev.filter(id => id !== segId);
    onChange({
      selectedSegmentIds: next,
      selectedSegmentId: next.length > 0 ? next[next.length - 1] : null,
      selectedPointId: null,
      selectedDiagonalId: null,
      selectedArcId: null,
    });
  }, [tool, onChange, clientToSvg, setLassoPath]);

  const handleSegmentCtxMenu = useCallback((e: React.MouseEvent, segId: string) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "segment", id: segId });
  }, [setCtxMenu]);

  const handleDiagonalClick = useCallback((e: React.MouseEvent, diagId: string) => {
    e.stopPropagation(); setCtxMenu(null);
    if (tool === "delete") { onChange({ diagonals: diagonals.filter(d => d.id !== diagId) }); return; }
    onChange({ selectedDiagonalId: diagId, selectedPointId: null, selectedSegmentId: null, selectedSegmentIds: [], selectedArcId: null });
  }, [tool, diagonals, onChange, setCtxMenu]);

  const handleDimLineClick = useCallback((e: React.MouseEvent, dlId: string) => {
    e.stopPropagation();
    if (tool === "delete") { onChange({ dimLines: dimLines.filter(d => d.id !== dlId) }); return; }
    onChange({ selectedDimLineId: dlId, selectedPointId: null, selectedSegmentId: null, selectedSegmentIds: [] });
  }, [tool, dimLines, onChange]);

  // ── Escape / Delete ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGhost(null); setCtxMenu(null);
        if (phase === "draw" && points.length > 0 && !isClosed)
          onChange({ points: points.slice(0, -1), segments: segments.slice(0, -1) });
        onChange({ selectedPointId: null, selectedSegmentId: null, selectedSegmentIds: [], selectedDiagonalId: null, selectedArcId: null, selectedDimLineId: null });
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !["INPUT","TEXTAREA","SELECT"].includes((e.target as Element).tagName)) {
        if (selectedPointId) {
          const newPts = points.filter(p => p.id !== selectedPointId);
          const newSegs = segments.filter(s => s.fromId !== selectedPointId && s.toId !== selectedPointId);
          onChange({ points: newPts, segments: newSegs, diagonals: newPts.length >= 3 ? buildAutoDiagonals(newPts, diagonals) : [], isClosed: isClosed && newPts.length >= 3, selectedPointId: null });
        }
        if (selectedSegmentId) onChange({ segments: segments.filter(s => s.id !== selectedSegmentId), isClosed: false, selectedSegmentId: null, selectedSegmentIds: [] });
        if (selectedDiagonalId) onChange({ diagonals: diagonals.filter(d => d.id !== selectedDiagonalId), selectedDiagonalId: null });
        if (selectedDimLineId) onChange({ dimLines: dimLines.filter(d => d.id !== selectedDimLineId), selectedDimLineId: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, points, segments, isClosed, diagonals, dimLines, selectedPointId, selectedSegmentId, selectedDiagonalId, selectedDimLineId, onChange, setGhost, setCtxMenu]);

  // Двойной клик мышью — выбрать все стены (работает и снаружи полигона)
  const handleCanvasDblClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isClosed) return;
    e.stopPropagation();
    onChange({
      selectedSegmentIds: segments.map(s => s.id),
      selectedSegmentId: segments[segments.length - 1]?.id ?? null,
      selectedPointId: null,
      selectedDiagonalId: null,
    });
  }, [isClosed, segments, onChange]);

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
    handleCanvasDblClick,
    handlePointClick,
    handlePointCtxMenu,
    handlePointMouseDown,
    handleSegmentClick,
    handleSegmentMouseDown,
    handleSegmentCtxMenu,
    handleDiagonalClick,
    handleDimLineClick,
  };
}