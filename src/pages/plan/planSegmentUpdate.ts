import type { PlanState, Segment } from "./planTypes";
import { distPx, buildAutoDiagonals, rebuildWithRightAngles } from "./planTypes";

/**
 * Обновляет длину отрезка и, если все длины заполнены, выполняет rebuild фигуры.
 * Используется как в DrawingTab так и в PlanRightInputPanel.
 * Возвращает патч для onChange.
 */
export function updateSegmentWithRebuild(
  state: PlanState,
  id: string,
  patch: Partial<Segment>,
): Partial<PlanState> {
  const { points, segments, diagonals, isClosed } = state;
  const newSegments = segments.map(s => s.id === id ? { ...s, ...patch } : s);

  if (patch.lengthCm == null || patch.lengthCm <= 0) {
    return { segments: newSegments };
  }

  let baseScale = state.baseScale ?? null;
  const cleanedChangedIds = (state.changedSegmentIds ?? []).filter(cid => cid !== id);

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
  const isEditMode = !!state.isBuilt;

  // Режим построения: все стороны заполнены — rebuild
  if (!isEditMode && allSetAfter && baseScale && isClosed) {
    const result = rebuildWithRightAngles(points, newSegments, baseScale);
    if (result) {
      const finalSegs = result.segments ?? newSegments;
      const newDiags = buildAutoDiagonals(result.points, diagonals, baseScale);
      return {
        points: result.points,
        segments: finalSegs,
        diagonals: newDiags,
        baseScale,
        isBuilt: true,
        changedSegmentIds: [],
      };
    }
  }

  return { segments: newSegments, baseScale: baseScale ?? state.baseScale, changedSegmentIds: cleanedChangedIds };
}
