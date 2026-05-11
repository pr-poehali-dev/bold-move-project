import type { FloorItem, Segment, SegmentPriceItem } from "./planTypes";
import DragGhost from "./DragGhost";
import DragCardGhost from "./DragCardGhost";
import ActiveItemsSlider from "./ActiveItemsSlider";

interface Props {
  dragItem: SegmentPriceItem | null;
  dragPos: { x: number; y: number } | null;
  dragCardItem: SegmentPriceItem | null;
  dragCardPos: { x: number; y: number } | null;
  activeItems: SegmentPriceItem[];
  tapActiveId: number | null;
  hoverSegId: string | null;
  isMobile: boolean;
  segments: Segment[];
  floorItems: FloorItem[];
  anyPanelOpen: boolean;
  onTapActiveId: (id: number | null) => void;
  onRemoveActiveItem: (priceId: number) => void;
  onAssignToAllSegs: (item: SegmentPriceItem) => void;
  onRemoveFromAllSegs: (priceId: number) => void;
  isItemOnAllSegs: (priceId: number) => boolean;
  onAdjustQuantity: (priceId: number, delta: number) => void;
  onSetQuantity: (priceId: number, value: number) => void;
  onAddToFloor?: (item: SegmentPriceItem) => void;
  hasSegments: boolean;
}

export default function PlanDragGhosts({
  dragItem, dragPos,
  dragCardItem, dragCardPos,
  activeItems, tapActiveId,
  hoverSegId, isMobile,
  segments, floorItems, anyPanelOpen,
  onTapActiveId, onRemoveActiveItem,
  onAssignToAllSegs, onRemoveFromAllSegs, isItemOnAllSegs, onAdjustQuantity, onSetQuantity, onAddToFloor, hasSegments,
}: Props) {
  return (
    <>
      {/* ── Drag ghost — летит за курсором на десктопе ── */}
      {dragItem && dragPos && (
        <DragGhost dragItem={dragItem} dragPos={dragPos} hoverSegId={hoverSegId} />
      )}

      {/* ── Ghost карточки при drag из нижней панели ── */}
      {dragCardItem && dragCardPos && (
        <DragCardGhost dragCardItem={dragCardItem} dragCardPos={dragCardPos} hoverSegId={hoverSegId} />
      )}

      {/* ── Активные карточки внизу + попап ── */}
      <ActiveItemsSlider
        activeItems={activeItems}
        tapActiveId={tapActiveId}
        hoverSegId={hoverSegId}
        isMobile={isMobile}
        segments={segments}
        floorItems={floorItems}
        anyPanelOpen={anyPanelOpen}
        onTapActiveId={onTapActiveId}
        onRemoveActiveItem={onRemoveActiveItem}
        onAssignToAllSegs={onAssignToAllSegs}
        onRemoveFromAllSegs={onRemoveFromAllSegs}
        isItemOnAllSegs={isItemOnAllSegs}
        onAdjustQuantity={onAdjustQuantity}
        onSetQuantity={onSetQuantity}
        onAddToFloor={onAddToFloor}
        hasSegments={hasSegments}
      />

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}
