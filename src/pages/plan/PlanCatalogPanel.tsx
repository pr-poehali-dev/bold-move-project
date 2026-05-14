import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { SegmentPriceItem } from "./planTypes";

interface Props {
  open: boolean;
  filteredPrices: PriceEntry[];
  selectedSegmentId: string | null;
  selectedSegmentIds?: string[];
  onClose: () => void;
  onAssignToSeg: (item: SegmentPriceItem, segId: string) => void;
  onAddToActive: (item: SegmentPriceItem) => void;
}

export default function PlanCatalogPanel({
  open,
  filteredPrices,
  selectedSegmentId,
  selectedSegmentIds,
  onClose,
  onAssignToSeg,
  onAddToActive,
}: Props) {
  return (
    <CategoryDrumPanel
      open={open}
      onClose={onClose}
      prices={filteredPrices}
      onDragItem={item => {
        onClose();
        const ids = selectedSegmentIds && selectedSegmentIds.length > 0
          ? selectedSegmentIds
          : selectedSegmentId ? [selectedSegmentId] : [];
        if (ids.length > 0) {
          ids.forEach(segId => onAssignToSeg(item, segId));
        } else {
          onAddToActive(item);
        }
      }}
    />
  );
}