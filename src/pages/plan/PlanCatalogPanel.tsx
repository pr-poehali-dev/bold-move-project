import { useState } from "react";
import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import PlanVoiceCatalogButton from "./PlanVoiceCatalogButton";
import type { VoiceCatalogItem } from "./useVoiceCatalog";
import { findSegIdsForItem, ALL_SEGS_SENTINEL } from "./useVoiceCatalog";
import Icon from "@/components/ui/icon";

// Товар "подвисший" — стена не определена, ждёт выбора пользователя
interface PendingWallItem {
  item: SegmentPriceItem;
  otherWallItems: { item: SegmentPriceItem; segIds: string[] | null }[];
  floorItems: SegmentPriceItem[];
}

interface Props {
  open: boolean;
  filteredPrices: PriceEntry[];
  allPrices: PriceEntry[];
  selectedSegmentId: string | null;
  selectedSegmentIds?: string[];
  state: PlanState;
  onClose: () => void;
  onAssignToSegs: (item: SegmentPriceItem, segIds: string[]) => void;
  onAssignToAllSegs: (item: SegmentPriceItem) => void;
  onAddToActive: (item: SegmentPriceItem) => void;
  onAssignMany: (wallItems: { item: SegmentPriceItem; segIds: string[] | null }[], floorItems: SegmentPriceItem[]) => void;
  // Передаём наружу pending-состояние чтобы canvas мог подсвечивать стены
  pendingItem?: SegmentPriceItem | null;
  onSegmentClickForPending?: (segId: string) => void;
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
  onSegmentClickForPending,
}: Props) {
  // Товар ожидающий выбора стены
  const [pendingWall, setPendingWall] = useState<PendingWallItem | null>(null);

  // Обработка items от бота
  const handleVoiceItems = (items: VoiceCatalogItem[], transcript: string) => {
    const wallItemsWithSegs: { item: SegmentPriceItem; segIds: string[] | null }[] = [];
    const floorItems: SegmentPriceItem[] = [];
    const unknownWallItems: SegmentPriceItem[] = [];

    items.forEach(voiceItem => {
      const matched = matchItem(voiceItem, allPrices);
      if (!matched) return;

      if (
        SILENT_CATEGORIES.has(matched.category) ||
        matched.name === "Раскрой ПВХ" ||
        matched.name === "Огарпунивание ПВХ"
      ) {
        floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
        return;
      }

      if (matched.isWallItem && state.segments.length > 0) {
        const itemSegIds = findSegIdsForItem(matched.name, matched.category, transcript, state);
        // Если цель неизвестна — товар уходит в "подвисшие"
        if (!itemSegIds) {
          unknownWallItems.push(matched);
        } else {
          // ALL_SEGS_SENTINEL → передаём как null (добавить на все)
          const finalIds = itemSegIds[0] === ALL_SEGS_SENTINEL ? null : itemSegIds;
          wallItemsWithSegs.push({ item: matched, segIds: finalIds });
        }
      } else {
        floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
      }
    });

    // Сначала применяем всё что знаем
    if (wallItemsWithSegs.length > 0 || floorItems.length > 0) {
      onAssignMany(wallItemsWithSegs, floorItems);
    }

    // Если есть неизвестные — показываем первый, остальные в очередь
    if (unknownWallItems.length > 0) {
      setPendingWall({
        item: unknownWallItems[0],
        otherWallItems: unknownWallItems.slice(1).map(it => ({ item: it, segIds: null })),
        floorItems: [],
      });
    }
  };

  // Пользователь выбрал стену для подвисшего товара (клик по стене на чертеже)
  const handlePendingSegClick = (segId: string) => {
    if (!pendingWall) return;
    const { item, otherWallItems, floorItems } = pendingWall;
    onAssignMany([{ item, segIds: [segId] }, ...otherWallItems], floorItems);
    setPendingWall(null);
    onSegmentClickForPending?.(segId);
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
        <div className="fixed z-50" style={{ bottom: 96, right: 16 }}>
          <PlanVoiceCatalogButton state={state} onItems={handleVoiceItems} />
        </div>
      )}

      {/* Баннер "выберите стену" — показывается поверх чертежа когда стена не определена */}
      {pendingWall && (
        <div
          className="fixed z-[10000] left-0 right-0 flex justify-center"
          style={{ bottom: 160, pointerEvents: "none" }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: "rgba(12,10,28,0.97)",
              border: "1.5px solid rgba(124,58,237,0.7)",
              boxShadow: "0 0 32px rgba(124,58,237,0.4), 0 8px 24px rgba(0,0,0,0.7)",
              backdropFilter: "blur(16px)",
              pointerEvents: "all",
              maxWidth: 420,
            }}
          >
            {/* Картинка товара */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)" }}
            >
              {pendingWall.item.imageUrl
                ? <img src={pendingWall.item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <Icon name="Package" size={20} style={{ color: "#a78bfa" }} />}
            </div>

            {/* Текст */}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-black text-white truncate">{pendingWall.item.name}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "rgba(167,139,250,0.8)" }}>
                Нажмите на стену чтобы добавить
              </div>
            </div>

            {/* Кнопки быстрого выбора по ориентации */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {state.segments.map((seg, i) => {
                const a = state.points.find(p => p.id === seg.fromId);
                const b = state.points.find(p => p.id === seg.toId);
                const label = `${String.fromCharCode(65 + i)}-${String.fromCharCode(65 + ((i + 1) % state.segments.length))}`;
                const lenM = seg.lengthCm ? (seg.lengthCm / 100).toFixed(1) + "м" : "?";
                return (
                  <button
                    key={seg.id}
                    onClick={() => handlePendingSegClick(seg.id)}
                    className="flex flex-col items-center px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition hover:brightness-110 active:scale-95"
                    style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.4)", minWidth: 38 }}
                    title={`Стена ${label} (${lenM})`}
                  >
                    <span>{label}</span>
                    <span style={{ color: "rgba(196,181,253,0.6)", fontSize: 9 }}>{lenM}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setPendingWall(null)}
                className="w-7 h-7 flex items-center justify-center rounded-xl transition hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.3)" }}
                title="Отмена"
              >
                <Icon name="X" size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}