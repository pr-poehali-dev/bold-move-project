import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import PlanVoiceCatalogButton from "./PlanVoiceCatalogButton";
import type { VoiceCatalogItem } from "./useVoiceCatalog";
import { findSegIdsForItem } from "./useVoiceCatalog";

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
  onAssignMany: (wallItems: { item: SegmentPriceItem; segIds: string[] | null }[], floorItems: SegmentPriceItem[]) => void;
}

// Категории которые идут НА СТЕНЫ (пог.м вдоль периметра)
const WALL_CATEGORIES = new Set([
  "Профиль стандартный",
  "Теневой профиль",
  "Парящий профиль",
  "Ниши для штор",
  "Двухуровневые",
  "Вставки и заглушки",
  "Углы и заглушки",
]);

// Категории которые НЕ показываем на чертеже вообще (тихо в смету)
const SILENT_CATEGORIES = new Set([
  "Монтаж",
]);

// Категории на полотно (м², шт)
// Полотна, Освещение, Закладные, Вентиляция, Дополнительно — всё остальное

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

  // is_wall_item определяем по категории — надёжнее чем поле из API
  const isWall = WALL_CATEGORIES.has(found.category);

  return {
    priceId:          found.id,
    name:             found.name,
    category:         found.category,
    imageUrl:         found.image_url,
    categoryImageUrl: found.category_image_url,
    unit:             found.unit,
    quantity:         voiceItem.qty ?? 1,
    isWallItem:       isWall,
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
  onAssignToAllSegs,
  onAddToActive,
  onAssignMany,
}: Props) {

  // Обработка items от бота: маппим по ПОЛНОМУ прайсу и добавляем ОДНИМ push
  const handleVoiceItems = (items: VoiceCatalogItem[], transcript: string) => {
    const wallItemsWithSegs: { item: SegmentPriceItem; segIds: string[] | null }[] = [];
    const floorItems: SegmentPriceItem[] = [];

    items.forEach(voiceItem => {
      const matched = matchItem(voiceItem, allPrices);
      if (!matched) return;

      // Монтаж, Раскрой, Огарпунивание — тихо в смету, не на чертёж
      if (
        SILENT_CATEGORIES.has(matched.category) ||
        matched.name === "Раскрой ПВХ" ||
        matched.name === "Огарпунивание ПВХ"
      ) {
        floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
        return;
      }

      if (matched.isWallItem && state.segments.length > 0) {
        // Ищем конкретные сегменты для ЭТОГО товара по контексту транскрипта
        const itemSegIds = findSegIdsForItem(matched.name, matched.category, transcript, state);
        wallItemsWithSegs.push({ item: matched, segIds: itemSegIds });
      } else {
        floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
      }
    });

    // ОДИН push для всего — нет race condition
    if (wallItemsWithSegs.length > 0 || floorItems.length > 0) {
      onAssignMany(wallItemsWithSegs, floorItems);
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