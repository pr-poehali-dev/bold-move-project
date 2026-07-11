import type { FloorItem, Segment, SegmentPriceItem } from "./planTypes";
import DragGhost from "./DragGhost";
import DragCardGhost from "./DragCardGhost";
import ActiveItemsSlider from "./ActiveItemsSlider";

interface Props {
  dragItem: SegmentPriceItem | null;
  dragPos: { x: number; y: number } | null;
  dragCardItem: SegmentPriceItem | null;
  dragCardPos: { x: number; y: number } | null;
  /** "Клик для размещения" — товар прицеплен к курсору без зажатия мыши, ждёт клика по стене */
  clickPlaceItem?: SegmentPriceItem | null;
  clickPlacePos?: { x: number; y: number } | null;
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
  onReplaceItem?: (item: SegmentPriceItem) => void;
  hasSegments: boolean;
  selectedSegmentIds?: string[];
  onAssignToSelectedSegs?: (item: SegmentPriceItem, segIds: string[]) => void;
  /** Навели/увели курсор с карточки товара — подсветить его стены на чертеже */
  onHoverItem?: (priceId: number | null) => void;
}

export default function PlanDragGhosts({
  dragItem, dragPos,
  dragCardItem, dragCardPos,
  clickPlaceItem, clickPlacePos,
  activeItems, tapActiveId,
  hoverSegId, isMobile,
  segments, floorItems, anyPanelOpen,
  onTapActiveId, onRemoveActiveItem,
  onAssignToAllSegs, onRemoveFromAllSegs, isItemOnAllSegs, onAdjustQuantity, onSetQuantity, onAddToFloor, onReplaceItem, hasSegments,
  selectedSegmentIds, onAssignToSelectedSegs, onHoverItem,
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

      {/* ── "Клик для размещения" — товар прицеплен к курсору без зажатия мыши ── */}
      {clickPlaceItem && (
        <>
          {clickPlacePos && <DragGhost dragItem={clickPlaceItem} dragPos={clickPlacePos} hoverSegId={hoverSegId} />}
          <div
            style={{
              position: "fixed", left: "50%", bottom: 90, transform: "translateX(-50%)",
              zIndex: 9999, pointerEvents: "none",
              background: "rgba(15,16,23,0.92)", border: "1px solid rgba(124,58,237,0.4)",
              borderRadius: 10, padding: "6px 14px", fontSize: 12, color: "rgba(255,255,255,0.75)",
              whiteSpace: "nowrap",
            }}
          >
            Кликните по стене, чтобы разместить «{clickPlaceItem.name}» · Esc — отмена
          </div>
        </>
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
        onReplaceItem={onReplaceItem}
        hasSegments={hasSegments}
        selectedSegmentIds={selectedSegmentIds}
        onAssignToSelectedSegs={onAssignToSelectedSegs}
        onHoverItem={onHoverItem}
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