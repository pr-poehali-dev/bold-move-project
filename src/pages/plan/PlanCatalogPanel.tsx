import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import PlanVoiceCatalogButton from "./PlanVoiceCatalogButton";
import type { VoiceCatalogItem } from "./useVoiceCatalog";

interface Props {
  open: boolean;
  filteredPrices: PriceEntry[];
  selectedSegmentId: string | null;
  selectedSegmentIds?: string[];
  state: PlanState;
  onClose: () => void;
  onAssignToSegs: (item: SegmentPriceItem, segIds: string[]) => void;
  onAssignToAllSegs: (item: SegmentPriceItem) => void;
  onAddToActive: (item: SegmentPriceItem) => void;
}

// Маппинг товара от бота → SegmentPriceItem через прайс
function matchItem(voiceItem: VoiceCatalogItem, prices: PriceEntry[]): SegmentPriceItem | null {
  const name = voiceItem.name.toLowerCase().trim();

  // 1. Точное совпадение
  let found = prices.find(p => p.name.toLowerCase() === name);

  // 2. Частичное — name начинается с имени из прайса или наоборот
  if (!found) {
    found = prices.find(p =>
      name.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(name)
    );
  }

  // 3. По ключевым словам — минимум 2 слова совпадают
  if (!found) {
    const words = name.split(/\s+/).filter(w => w.length > 2);
    found = prices.find(p => {
      const pWords = p.name.toLowerCase().split(/\s+/);
      const matches = words.filter(w => pWords.some(pw => pw.includes(w) || w.includes(pw)));
      return matches.length >= 2;
    });
  }

  if (!found) return null;

  return {
    priceId:          found.id,
    name:             found.name,
    category:         found.category,
    imageUrl:         found.image_url,
    categoryImageUrl: found.category_image_url,
    unit:             found.unit,
    quantity:         voiceItem.qty ?? 1,
    isWallItem:       found.is_wall_item !== false,
  };
}

export default function PlanCatalogPanel({
  open,
  filteredPrices,
  selectedSegmentId,
  selectedSegmentIds,
  state,
  onClose,
  onAssignToSegs,
  onAssignToAllSegs,
  onAddToActive,
}: Props) {

  // Обработка items от бота: маппим и добавляем в смету
  const handleVoiceItems = (items: VoiceCatalogItem[]) => {
    items.forEach(voiceItem => {
      const matched = matchItem(voiceItem, filteredPrices);
      if (!matched) return;

      if (matched.isWallItem && state.segments.length > 0) {
        // Настенный товар → на все стены (как assignItemToAllSegs)
        onAssignToAllSegs(matched);
      } else {
        // Полотно / штучный товар → в активные (карточку)
        onAddToActive({ ...matched, quantity: voiceItem.qty ?? 1 });
      }
    });
  };

  return (
    <div className="relative">
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
            onAssignToSegs(item, ids);
          } else {
            onAddToActive(item);
          }
        }}
      />

      {/* Кнопка микрофона — только когда каталог открыт */}
      {open && (
        <div
          className="fixed z-50"
          style={{ bottom: 96, right: 16 }}
        >
          <PlanVoiceCatalogButton
            state={state}
            onItems={handleVoiceItems}
          />
        </div>
      )}
    </div>
  );
}
