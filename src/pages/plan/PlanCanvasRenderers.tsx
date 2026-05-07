// Реэкспорт из декомпозированных модулей
export type { RenderContext, SegmentHandlers } from "./PlanCanvasTypes";
export { CtxItem } from "./PlanCanvasTypes";

export {
  renderDimLine,
  renderSegmentLabel,
  renderAngleLabel,
  renderCornerArc,
  renderCustomDimLine,
  renderDiagonals,
  InlineDimLabels,
} from "./PlanCanvasLabelRenderers";

export {
  renderPoints,
  renderSegments,
  renderGhost,
  renderHints,
} from "./PlanCanvasShapeRenderers";
