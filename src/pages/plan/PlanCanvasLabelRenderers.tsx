// Агрегатор реэкспортов — декомпозированная версия
// Логика разнесена по подмодулям в ./labelRenderers/

export { renderDimLine, renderSegmentLabel } from "./labelRenderers/renderDimAndSegmentLabel";
export { SegmentItemsBadges, renderSegmentItems } from "./labelRenderers/SegmentItemsBadges";
export {
  renderAngleLabel,
  renderCornerArc,
  renderCustomDimLine,
  renderDiagonals,
} from "./labelRenderers/renderAngleArcDiagonal";
export { InlineDimLabels } from "./labelRenderers/InlineDimLabels";
