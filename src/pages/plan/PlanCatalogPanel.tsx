import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import PlanVoiceCatalogButton from "./PlanVoiceCatalogButton";
import type { VoiceCatalogItem } from "./useVoiceCatalog";

interface Props {
  open: boolean;
  filteredPrices: PriceEntry[];
  allPrices: PriceEntry[];          // полный прайс для маппинга голосовых items
  selectedSegmentId: string | null;
  selectedSegmentIds?: string[];
  state: PlanState;
  onClose: () => void;
  onAssignToSegs: (item: SegmentPriceItem, segIds: string[]) => void;
  onAssignToAllSegs: (item: SegmentPriceItem) => void;
  onAddToActive: (item: SegmentPriceItem) => void;
  // один атомарный push для всех голосовых товаров сразу
  onAssignMany: (wallItems: SegmentPriceItem[], activeItems: SegmentPriceItem[]) => void;
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
  allPrices,
  selectedSegmentId,
  selectedSegmentIds,
  state,
  onClose,
  onAssignToSegs,
  onAssignToAllSegs: _onAssignToAllSegs,
  onAddToActive,
  onAssignMany,
}: Props) {

  // Обработка items от бота: маппим по ПОЛНОМУ прайсу и добавляем ОДНИМ push
  const handleVoiceItems = (items: VoiceCatalogItem[]) => {
    console.log("[VoiceCatalog] items from bot:", items);
    const wallItems: SegmentPriceItem[] = [];
    const activeItems: SegmentPriceItem[] = [];

    items.forEach(voiceItem => {
      const matched = matchItem(voiceItem, allPrices);
      console.log(`[VoiceCatalog] "${voiceItem.name}" → ${matched ? matched.name : "NOT FOUND"}`);
      if (!matched) return;
      if (matched.isWallItem && state.segments.length > 0) {
        wallItems.push(matched);
      } else {
        activeItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
      }
    });

    console.log(`[VoiceCatalog] wall=${wallItems.length} active=${activeItems.length} из ${items.length}`);
    if (wallItems.length > 0 || activeItems.length > 0) {
      onAssignMany(wallItems, activeItems);
    }
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