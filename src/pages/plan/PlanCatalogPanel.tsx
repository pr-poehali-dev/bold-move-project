import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { SegmentPriceItem } from "./planTypes";

interface Props {
  open: boolean;
  filteredPrices: PriceEntry[];
  selectedSegmentId: string | null;
  selectedSegmentIds?: string[];
  onClose: () => void;
  onAssignToSegs: (item: SegmentPriceItem, segIds: string[]) => void;
  onAddToActive: (item: SegmentPriceItem) => void;
}

export default function PlanCatalogPanel({
  open,
  filteredPrices,
  selectedSegmentId,
  selectedSegmentIds,
  onClose,
  onAssignToSegs,
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
          // Назначаем на все выбранные стены атомарно (один push)
          onAssignToSegs(item, ids);
        } else {
          // Нет выбранных стен — просто добавляем в нижнюю панель
          onAddToActive(item);
        }
      }}
    />
  );
}