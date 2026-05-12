import React from "react";
import type { PlanState, Segment, DiagonalDef, PlanSettings, RoomParams } from "./planTypes";
import {
  distPx, calcScale, polygonArea, polygonPerimeter, buildAutoDiagonals, rebuildFromAnglesAndLengths, rebuildWithRightAngles,
  angleDeg, polygonOrientation, calcMissingSegmentLength,
} from "./planTypes";
import DrawingTabShapeSection from "./DrawingTabShapeSection";
import DrawingTabSidesSection from "./DrawingTabSidesSection";
import DrawingTabAnglesSection from "./DrawingTabAnglesSection";
import DrawingTabDiagonalsSection from "./DrawingTabDiagonalsSection";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  onSectionOpen?: () => void;
  noAutoOpen?: boolean;
}

export default function DrawingTab({ state, onChange, onSectionOpen, noAutoOpen }: Props) {
  const { points, segments, diagonals, isClosed, settings } = state;
  const scale = calcScale(points, segments);

  // Refs для навигации Enter между полями длин
  const inputRefs = React.useRef<React.RefObject<HTMLInputElement>[]>([]);
  if (inputRefs.current.length !== segments.length) {
    inputRefs.current = segments.map(() => React.createRef<HTMLInputElement>());
  }

  // Последний сегмент изменённый пользователем (для показа кнопки флипа)
  const [lastChangedSegId, setLastChangedSegId] = React.useState<string | null>(null);

  // Набор сегментов с "перевёрнутым" направлением (против часовой)
  const flippedSegIds = React.useRef<Set<string>>(new Set());
  // Снимок точек сразу после первого rebuild (исходный квадрат/прямоугольник)
  const builtPoints = React.useRef<import("./planTypes").Point[] | null>(null);
  // Снимок сегментов сразу после первого rebuild
  const builtSegments = React.useRef<import("./planTypes").Segment[] | null>(null);
  // Длины сегментов ДО авто-пересчёта (для восстановления при флипе)
  const prevLengths = React.useRef<Map<string, number>>(new Map());

  const onFlipSegment = (id: string) => {
    // Переключаем флаг
    if (flippedSegIds.current.has(id)) {
      flippedSegIds.current.delete(id);
    } else {
      flippedSegIds.current.add(id);
    }

    // Флип: берём исходный квадрат (builtPoints/builtSegments),
    // двигаем нужную точку от фиксированной в том же направлении на новую длину.
    if (!state.isBuilt || !state.baseScale || !isClosed) return;
    const seg = segments.find(s => s.id === id);
    if (!seg || !seg.lengthCm) return;
    if (!builtPoints.current || !builtSegments.current) return;

    const isFlipped = flippedSegIds.current.has(id);
    const baseScale  = state.baseScale;

    // Исходные (до любых редактирований) точки и сегменты
    const srcPoints   = builtPoints.current;
    const srcSegments = builtSegments.current;

    // Фиксированная точка и двигающаяся — в исходной фигуре
    // Без флипа: фиксирован fromId (B), двигается toId (C)
    // С флипом:  фиксирован toId (C),   двигается fromId (B)
    const fixedPtId = isFlipped ? seg.toId   : seg.fromId;
    const movedPtId = isFlipped ? seg.fromId : seg.toId;

    const fixedPoint = srcPoints.find(p => p.id === fixedPtId);
    const movedPoint = srcPoints.find(p => p.id === movedPtId);
    if (!fixedPoint || !movedPoint) return;

    // Направление от fixedPoint к movedPoint в исходной фигуре
    const origLen = distPx(fixedPoint, movedPoint);
    if (origLen === 0) return;
    const ux = (movedPoint.x - fixedPoint.x) / origLen;
    const uy = (movedPoint.y - fixedPoint.y) / origLen;

    // Двигаем точку на новую длину
    const newLenPx = seg.lengthCm * baseScale;
    const newMovedCoord = { x: fixedPoint.x + ux * newLenPx, y: fixedPoint.y + uy * newLenPx };
    const newPoints = srcPoints.map(p => p.id === movedPtId ? { ...p, ...newMovedCoord } : p);

    // Пересчитываем соседний сегмент
    const autoRecalcIds: string[] = [];
    const affectedSeg = isFlipped
      ? (srcSegments.find(s => s.id !== id && s.toId   === movedPtId) ??
         (srcSegments.every(s => s.id === id || s.toId !== movedPtId)
           ? srcSegments.find(s => s.id !== id && s.fromId === movedPtId) : undefined))
      : (srcSegments.find(s => s.id !== id && s.fromId === movedPtId) ??
         (srcSegments.every(s => s.id === id || s.fromId !== movedPtId)
           ? srcSegments.find(s => s.id !== id && s.toId === movedPtId) : undefined));

    const updatedSegments = srcSegments.map(s => {
      // Изменённый сегмент — берём с введённой длиной (не из srcSegments где было 400)
      if (s.id === id) return { ...s, lengthCm: seg.lengthCm };
      if (!affectedSeg || s.id !== affectedSeg.id) return s;
      const a = newPoints.find(p => p.id === s.fromId);
      const b = newPoints.find(p => p.id === s.toId);
      if (!a || !b) return s;
      const px = distPx(a, b);
      autoRecalcIds.push(s.id);
      return { ...s, lengthCm: Math.round((px / baseScale) * 10) / 10 };
    });

    const newDiags = buildAutoDiagonals(newPoints, diagonals, baseScale);
    // Не сбрасываем lastChangedSegId — кнопка остаётся, можно переключать туда-обратно
    onChange({ points: newPoints, segments: updatedSegments, diagonals: newDiags, changedSegmentIds: autoRecalcIds });
  };

  // Ref для функции фокуса первой незаполненной диагонали
  const focusDiagonalRef = React.useRef<(() => void) | null>(null);

  const focusNext = (idx: number) => {
    const next = inputRefs.current[idx + 1];
    if (next?.current) { next.current.focus(); next.current.select(); }
  };

  const updateSegment = (id: string, patch: Partial<Segment>, forceRecalc = false) => {
    const newSegments = segments.map(s => s.id === id ? { ...s, ...patch } : s);

    if (patch.lengthCm !== undefined && patch.lengthCm !== null && patch.lengthCm > 0) {
      let baseScale = state.baseScale ?? null;
      // Пользователь сам ввёл значение — снимаем жёлтую подсветку с этого сегмента
      const cleanedChangedIds = (state.changedSegmentIds ?? []).filter(cid => cid !== id);

      // Вычисляем baseScale из текущего сегмента если ещё нет
      if (!baseScale) {
        const seg = segments.find(s => s.id === id);
        if (seg) {
          const a = points.find(p => p.id === seg.fromId);
          const b = points.find(p => p.id === seg.toId);
          if (a && b) {
            const px = distPx(a, b);
            if (px > 0) baseScale = px / patch.lengthCm;
          }
        }
      }

      const allSetAfter = newSegments.every(s => s.lengthCm !== null && s.lengthCm > 0);
      // Режим редактирования — только если rebuild уже был выполнен (isBuilt=true)
      const isEditMode = !!state.isBuilt;

      // ── РЕЖИМ ПОСТРОЕНИЯ: все стороны заполнены и rebuild ещё не был ─────────
      if (!isEditMode && allSetAfter && baseScale && isClosed) {
        const result = rebuildWithRightAngles(points, newSegments, baseScale);
        if (result) {
          // result.segments содержит геометрически скорректированный последний сегмент (если не сходится)
          const finalSegs = result.segments ?? newSegments;
          builtPoints.current   = result.points;
          builtSegments.current = finalSegs;
          const newDiags = buildAutoDiagonals(result.points, diagonals, baseScale);
          // correctedIds — ID сторон автоматически скорректированных геометрией (показываем жёлтым)
          onChange({ points: result.points, segments: finalSegs, diagonals: newDiags, baseScale, isBuilt: true, changedSegmentIds: result.correctedIds ?? [] });
          return;
        }
      }

      // ── РЕЖИМ РЕДАКТИРОВАНИЯ: rebuild уже был, пользователь меняет сторону ───
      // Просто обновляем lengthCm без пересчёта соседей и без сдвига точек.
      // Пользователь сам контролирует все стороны.
      if (isEditMode && baseScale && isClosed) {
        const seg = segments.find(s => s.id === id);
        if (!forceRecalc && seg && patch.lengthCm && patch.lengthCm === seg.lengthCm) {
          onChange({ segments: newSegments, changedSegmentIds: [] });
          return;
        }
        setLastChangedSegId(id); // показываем кнопку флипа для этой стороны
        const newDiags = buildAutoDiagonals(points, diagonals, baseScale);
        onChange({ segments: newSegments, diagonals: newDiags, changedSegmentIds: [] });
        return;
      }

      // ── Авторасчёт последней стороны ОТКЛЮЧЁН ────────────────────────────────
      // Клиент вводит все стороны самостоятельно

      // Просто сохраняем lengthCm, точки не двигаем. Подсветка всегда пуста.
      const newDiags = buildAutoDiagonals(points, diagonals, baseScale);
      onChange({ segments: newSegments, diagonals: newDiags, baseScale: baseScale ?? undefined, isBuilt: false, changedSegmentIds: [] });
      return;
    }

    onChange({ segments: newSegments });
  };

  const updateDiagonal = (id: string, patch: Partial<DiagonalDef>) => {
    // Помечаем что пользователь вручную ввёл длину — drag не будет перезаписывать
    const patchWithFlag = patch.lengthCm !== undefined && patch.lengthCm !== null && patch.lengthCm > 0
      ? { ...patch, userSet: true }
      : patch;
    const newDiagonals = diagonals.map(d => d.id === id ? { ...d, ...patchWithFlag } : d);
    if (patch.lengthCm !== undefined && patch.lengthCm !== null && patch.lengthCm > 0) {
      const diag = diagonals.find(d => d.id === id);
      // Если значение не изменилось — не делаем rebuild фигуры
      if (diag && patch.lengthCm === diag.lengthCm) {
        onChange({ diagonals: newDiagonals });
        return;
      }
      if (diag && state.baseScale) {
        const fromPt = points.find(p => p.id === diag.fromId);
        const toPt   = points.find(p => p.id === diag.toId);
        if (fromPt && toPt) {
          const origPx = distPx(fromPt, toPt);
          if (origPx > 0) {
            const targetPx = patch.lengthCm * state.baseScale;
            const ux = (toPt.x - fromPt.x) / origPx;
            const uy = (toPt.y - fromPt.y) / origPx;
            const newToPt = { x: fromPt.x + ux * targetPx, y: fromPt.y + uy * targetPx };
            const newPoints = points.map(p => p.id === diag.toId ? { ...p, ...newToPt } : p);
            const newSegments = segments.map(s => {
              if (s.fromId !== diag.toId && s.toId !== diag.toId) return s;
              const a = newPoints.find(p => p.id === s.fromId);
              const b = newPoints.find(p => p.id === s.toId);
              const px = a && b ? distPx(a, b) : 0;
              return { ...s, lengthCm: Math.round((px / state.baseScale!) * 10) / 10 };
            });
            const newDiags = buildAutoDiagonals(newPoints, newDiagonals, state.baseScale);
            onChange({ points: newPoints, segments: newSegments, diagonals: newDiags });
            return;
          }
        }
      }
    }
    onChange({ diagonals: newDiagonals });
  };

  const updateSettings = (patch: Partial<PlanSettings>) =>
    onChange({ settings: { ...settings, ...patch } });

  const updateRoom = (patch: Partial<RoomParams>) =>
    onChange({ room: { ...state.room, ...patch } });

  // Вычисления для секции Фигура
  const areaPx = polygonArea(points);
  const perimPx = polygonPerimeter(points);
  const areaCm2 = scale ? Math.round(areaPx / (scale * scale) * 10) / 10 : null;
  const areaM2  = areaCm2 ? Math.round(areaCm2 / 10000 * 100) / 100 : null;
  const perimCm = scale ? Math.round((perimPx / scale) * 10) / 10 : null;
  const perimM  = perimCm ? Math.round(perimCm / 100 * 100) / 100 : null;
  const allLengthsSet = segments.length > 0 && segments.every(s => s.lengthCm !== null && s.lengthCm > 0);
  const exactPerimCm  = allLengthsSet ? segments.reduce((sum, s) => sum + (s.lengthCm ?? 0), 0) : null;
  const exactPerimM   = exactPerimCm ? Math.round(exactPerimCm / 100 * 100) / 100 : null;
  const displayPerimM = exactPerimM ?? perimM;

  // Определяем есть ли скосы (не-прямые углы) — чтобы открыть секцию диагоналей
  const hasSkews = allLengthsSet && isClosed && (() => {
    if (points.length < 3) return false;
    const isCW = polygonOrientation(points) > 0;
    const SNAP_TOL = 15;
    return points.some((pt, idx) => {
      const n = points.length;
      const prev = points[(idx - 1 + n) % n];
      const next = points[(idx + 1) % n];
      const deg = angleDeg(prev, pt, next, isCW);
      const snapped = Math.abs(deg - 90) <= SNAP_TOL || Math.abs(deg - 270) <= SNAP_TOL;
      return !snapped;
    });
  })();

  return (
    <div>
      <DrawingTabShapeSection
        state={state}
        onChange={onChange}
        displayPerimM={displayPerimM}
        areaM2={areaM2}
        updateRoom={updateRoom}
        onSectionOpen={onSectionOpen}
      />
      <DrawingTabSidesSection
        state={state}
        onChange={onChange}
        inputRefs={inputRefs}
        updateSegment={updateSegment}
        updateSettings={updateSettings}
        focusNext={focusNext}
        onFocusDiagonal={() => focusDiagonalRef.current?.()}
        lastChangedSegId={lastChangedSegId}
        onFlipSegment={onFlipSegment}
        onSectionOpen={onSectionOpen}
        noAutoOpen={noAutoOpen}
      />
      <DrawingTabAnglesSection
        state={state}
        onChange={onChange}
        updateSettings={updateSettings}
        onSectionOpen={onSectionOpen}
      />
      <DrawingTabDiagonalsSection
        state={state}
        onChange={onChange}
        updateDiagonal={updateDiagonal}
        updateSettings={updateSettings}
        focusDiagonalRef={focusDiagonalRef}
        autoOpen={hasSkews}
        onSectionOpen={onSectionOpen}
      />
    </div>
  );
}