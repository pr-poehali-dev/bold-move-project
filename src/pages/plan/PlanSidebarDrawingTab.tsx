import React from "react";
import type { PlanState, Segment, DiagonalDef, PlanSettings, RoomParams } from "./planTypes";
import {
  distPx, calcScale, polygonArea, polygonPerimeter, buildAutoDiagonals, rebuildFromAnglesAndLengths, rebuildWithRightAngles,
  angleDeg, polygonOrientation,
} from "./planTypes";
import DrawingTabShapeSection from "./DrawingTabShapeSection";
import DrawingTabSidesSection from "./DrawingTabSidesSection";
import DrawingTabAnglesSection from "./DrawingTabAnglesSection";
import DrawingTabDiagonalsSection from "./DrawingTabDiagonalsSection";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

export default function DrawingTab({ state, onChange }: Props) {
  const { points, segments, diagonals, isClosed, settings } = state;
  const scale = calcScale(points, segments);

  // Refs для навигации Enter между полями длин
  const inputRefs = React.useRef<React.RefObject<HTMLInputElement>[]>([]);
  if (inputRefs.current.length !== segments.length) {
    inputRefs.current = segments.map(() => React.createRef<HTMLInputElement>());
  }

  // Набор сегментов с "перевёрнутым" направлением (против часовой)
  const flippedSegIds = React.useRef<Set<string>>(new Set());
  const [, forceFlipRender] = React.useState(0);

  const onFlipSegment = (id: string) => {
    if (flippedSegIds.current.has(id)) {
      flippedSegIds.current.delete(id);
    } else {
      flippedSegIds.current.add(id);
    }
    forceFlipRender(n => n + 1);
  };

  // Ref для функции фокуса первой незаполненной диагонали
  const focusDiagonalRef = React.useRef<(() => void) | null>(null);

  const focusNext = (idx: number) => {
    const next = inputRefs.current[idx + 1];
    if (next?.current) { next.current.focus(); next.current.select(); }
  };

  const updateSegment = (id: string, patch: Partial<Segment>) => {
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
          const newDiags = buildAutoDiagonals(result.points, diagonals, baseScale);
          onChange({ points: result.points, segments: newSegments, diagonals: newDiags, baseScale, isBuilt: true, changedSegmentIds: [] });
          return;
        }
      }

      // ── РЕЖИМ РЕДАКТИРОВАНИЯ: rebuild уже был, пользователь меняет сторону ───
      if (isEditMode && baseScale && isClosed) {
        const seg = segments.find(s => s.id === id);
        if (seg && patch.lengthCm) {
          const isFlipped = flippedSegIds.current.has(id);

          // По умолчанию (по часовой): фиксирован toId, двигается fromId
          // Флип (против часовой):     фиксирован fromId, двигается toId
          const fixedPtId  = isFlipped ? seg.fromId : seg.toId;
          const movedPtId  = isFlipped ? seg.toId   : seg.fromId;

          const fixedPoint = points.find(p => p.id === fixedPtId);
          const movedPoint = points.find(p => p.id === movedPtId);

          if (fixedPoint && movedPoint) {
            const origLen = distPx(fixedPoint, movedPoint);
            if (origLen > 0) {
              const ux = (movedPoint.x - fixedPoint.x) / origLen;
              const uy = (movedPoint.y - fixedPoint.y) / origLen;
              const newLenPx = patch.lengthCm * baseScale;
              const newMovedCoord = { x: fixedPoint.x + ux * newLenPx, y: fixedPoint.y + uy * newLenPx };

              const newPoints = points.map(p =>
                p.id === movedPtId ? { ...p, ...newMovedCoord } : p
              );

              // Пересчитываем соседний сегмент:
              // По часовой (fromId двигается) → следующий: тот где movedPtId=fromId,
              //   если нет — тот где movedPtId=toId (замыкающий случай)
              // Против часовой (toId двигается) → предыдущий: тот где movedPtId=toId,
              //   если нет — тот где movedPtId=fromId
              const autoRecalcIds: string[] = [];
              // По часовой: двигается fromId → ищем сегмент где movedPtId = fromId (следующий).
              // Фолбек на toId ТОЛЬКО если такого сегмента нет совсем (замыкающий H-A: H нигде не fromId).
              // Против часовой: двигается toId → ищем сегмент где movedPtId = toId (предыдущий).
              // Фолбек на fromId ТОЛЬКО если такого сегмента нет совсем.
              const affectedSeg = isFlipped
                ? (newSegments.find(s => s.id !== id && s.toId   === movedPtId) ??
                   (newSegments.every(s => s.id === id || s.toId !== movedPtId)
                     ? newSegments.find(s => s.id !== id && s.fromId === movedPtId)
                     : undefined))
                : (newSegments.find(s => s.id !== id && s.fromId === movedPtId) ??
                   (newSegments.every(s => s.id === id || s.fromId !== movedPtId)
                     ? newSegments.find(s => s.id !== id && s.toId === movedPtId)
                     : undefined));

              const updatedSegments = newSegments.map(s => {
                if (s.id === id) return s;
                if (!affectedSeg || s.id !== affectedSeg.id) return s;
                const a = newPoints.find(p => p.id === s.fromId);
                const b = newPoints.find(p => p.id === s.toId);
                if (!a || !b) return s;
                const px = distPx(a, b);
                autoRecalcIds.push(s.id);
                return { ...s, lengthCm: Math.round((px / baseScale!) * 10) / 10 };
              });

              const newDiags = buildAutoDiagonals(newPoints, diagonals, baseScale);
              // Убираем текущий сегмент из подсветки, добавляем пересчитанные соседи
              const finalChangedIds = [...cleanedChangedIds.filter(cid => !autoRecalcIds.includes(cid)), ...autoRecalcIds];
              onChange({ points: newPoints, segments: updatedSegments, diagonals: newDiags, baseScale, changedSegmentIds: finalChangedIds });
              return;
            }
          }
        }
      }

      // ── Режим построения: не все стороны ещё введены ────────────────────────
      // Просто сохраняем lengthCm, точки не двигаем
      const newDiags = buildAutoDiagonals(points, diagonals, baseScale);
      onChange({ segments: newSegments, diagonals: newDiags, baseScale: baseScale ?? undefined, changedSegmentIds: [] });
      return;
    }

    onChange({ segments: newSegments });
  };

  const updateDiagonal = (id: string, patch: Partial<DiagonalDef>) => {
    const newDiagonals = diagonals.map(d => d.id === id ? { ...d, ...patch } : d);
    if (patch.lengthCm !== undefined && patch.lengthCm !== null && patch.lengthCm > 0) {
      const diag = diagonals.find(d => d.id === id);
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
      />
      <DrawingTabSidesSection
        state={state}
        onChange={onChange}
        inputRefs={inputRefs}
        updateSegment={updateSegment}
        updateSettings={updateSettings}
        focusNext={focusNext}
        onFocusDiagonal={() => focusDiagonalRef.current?.()}
        flippedSegIds={flippedSegIds.current}
        onFlipSegment={onFlipSegment}
      />
      <DrawingTabAnglesSection
        state={state}
        onChange={onChange}
        updateSettings={updateSettings}
      />
      <DrawingTabDiagonalsSection
        state={state}
        onChange={onChange}
        updateDiagonal={updateDiagonal}
        updateSettings={updateSettings}
        focusDiagonalRef={focusDiagonalRef}
        autoOpen={hasSkews}
      />
    </div>
  );
}