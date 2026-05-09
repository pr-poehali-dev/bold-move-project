import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { SegmentPriceItem } from "./planTypes";

interface Props {
  open: boolean;
  filteredPrices: PriceEntry[];
  selectedSegmentId: string | null;
  onClose: () => void;
  onAssignToSeg: (item: SegmentPriceItem, segId: string) => void;
  onAddToActive: (item: SegmentPriceItem) => void;
}

export default function PlanCatalogPanel({
  open,
  filteredPrices,
  selectedSegmentId,
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
        if (selectedSegmentId) {
          onAssignToSeg(item, selectedSegmentId);
        } else {
          onAddToActive(item);
        }
      }}
    />
  );
}
