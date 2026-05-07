import React from "react";
import type { PlanState, Segment, DiagonalDef, PlanSettings, RoomParams } from "./planTypes";
import {
  distPx, calcScale, polygonArea, polygonPerimeter, buildAutoDiagonals, rebuildFromAnglesAndLengths,
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

  const focusNext = (idx: number) => {
    const next = inputRefs.current[idx + 1];
    if (next?.current) { next.current.focus(); next.current.select(); }
  };

  const updateSegment = (id: string, patch: Partial<Segment>) => {
    const newSegments = segments.map(s => s.id === id ? { ...s, ...patch } : s);
    if (patch.lengthCm !== undefined && patch.lengthCm !== null && patch.lengthCm > 0) {
      let baseScale = state.baseScale ?? null;
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
      // Если все стороны введены — перестраиваем фигуру по углам + длинам
      const allSet = newSegments.every(s => s.lengthCm !== null && s.lengthCm > 0);
      console.log('[updateSegment] allSet:', allSet, 'isClosed:', isClosed, newSegments.map(s => s.lengthCm));
      if (allSet && isClosed) {
        const result = rebuildFromAnglesAndLengths(points, newSegments, baseScale);

        if (result) {
          // Определяем какие стороны изменились (кроме той что ввёл пользователь)
          const changedIds = newSegments
            .filter(s => s.id !== id)
            .filter(s => {
              const oldSeg = segments.find(os => os.id === s.id);
              if (!oldSeg || !oldSeg.lengthCm) return false;
              return Math.abs((oldSeg.lengthCm ?? 0) - (s.lengthCm ?? 0)) > 0.05;
            })
            .map(s => s.id);
          const newDiags = buildAutoDiagonals(result.points, diagonals, result.baseScale);
          onChange({ points: result.points, segments: newSegments, diagonals: newDiags, baseScale: result.baseScale, changedSegmentIds: changedIds });
          // Сбрасываем подсветку через 2 секунды
          if (changedIds.length > 0) {
            setTimeout(() => onChange({ changedSegmentIds: [] }), 2000);
          }
          return;
        }
      }
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
      />
    </div>
  );
}