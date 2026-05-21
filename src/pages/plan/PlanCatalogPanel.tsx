import { useState, useEffect } from "react";
import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import PlanVoiceCatalogButton from "./PlanVoiceCatalogButton";
import type { VoiceCatalogItem } from "./useVoiceCatalog";
import { findSegIdsForItem, ALL_SEGS_SENTINEL } from "./useVoiceCatalog";
import Icon from "@/components/ui/icon";

// Исправляем дефолт теневого профиля: если AI вернул просто "теневой" без уточнения
// или вернул "Теневой профиль" как абстрактную категорию — заменяем на EuroKRAB стеновой
function fixShadowProfile(items: VoiceCatalogItem[], prices: PriceEntry[]): VoiceCatalogItem[] {
  const eurokrabName = prices.find(p => /EuroKRAB.*стеновой/i.test(p.name))?.name ?? "EuroKRAB стеновой";
  return items.map(item => {
    const n = item.name.toLowerCase();
    // Абстрактный "теневой профиль" без уточнения конкретной модели
    const isAbstractShadow =
      /^теневой профиль$/i.test(item.name.trim()) ||
      (n.includes("теневой") && !n.includes("классик") && !n.includes("flexy") && !n.includes("еврокраб") && !n.includes("eurokrab") && !n.includes("fly") && !n.includes("парящ"));
    if (isAbstractShadow) {
      console.log("[voice] shadow profile defaulted to EuroKRAB:", item.name, "→", eurokrabName);
      return { ...item, name: eurokrabName };
    }
    return item;
  });
}

// Гарантируем комплект светильника: если есть любая из трёх позиций — добавляем все три
function ensureLightingBundle(items: VoiceCatalogItem[], prices: PriceEntry[]): VoiceCatalogItem[] {
  const isLight    = (n: string) => /светильник|gx.?53|споты|точечн|точки/i.test(n);
  const isLamp     = (n: string) => /лампа.*gx|gx.*лампа/i.test(n);
  const isZakladna = (n: string) => /под светильник|∅90|диаметр.*90|90.*диаметр/i.test(n);

  const hasLight    = items.some(i => isLight(i.name) && !isLamp(i.name) && !isZakladna(i.name));
  const hasLamp     = items.some(i => isLamp(i.name));
  const hasZakladna = items.some(i => isZakladna(i.name));

  if (!hasLight && !hasLamp && !hasZakladna) return items;

  // Находим количество светильников (из любой уже добавленной позиции)
  const lightItem = items.find(i => isLight(i.name)) || items.find(i => isLamp(i.name)) || items.find(i => isZakladna(i.name));
  const qty = lightItem?.qty ?? 1;

  const findInPrices = (pattern: RegExp) =>
    prices.find(p => pattern.test(p.name))?.name;

  const lightName    = findInPrices(/Светильник GX-53/) ?? "Светильник GX-53 + лампа";
  const lampName     = findInPrices(/Лампа GX-53/) ?? "Лампа GX-53";
  const zakladnaName = findInPrices(/Под светильник.*90|∅90/) ?? "Под светильник ∅90";

  const result = [...items];
  if (!hasLight)    result.push({ name: lightName,    qty, unit: "шт" });
  if (!hasLamp)     result.push({ name: lampName,     qty, unit: "шт" });
  if (!hasZakladna) result.push({ name: zakladnaName, qty, unit: "шт" });

  return result;
}

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
  pendingItem?: SegmentPriceItem | null;
  onSegmentClickForPending?: (segId: string) => void;
  initialCategory?: string; // открыть сразу на этой категории (для замены товара)
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
  initialCategory,
}: Props) {
  // Товар ожидающий выбора стены
  const [pendingWall, setPendingWall] = useState<PendingWallItem | null>(null);
  // Стены выбранные пользователем для pending товара (мультивыбор)
  const [pendingSelectedSegs, setPendingSelectedSegs] = useState<string[]>([]);

  // Когда pendingWall активен — отслеживаем клики по стенам через selectedSegmentIds
  useEffect(() => {
    if (!pendingWall) { setPendingSelectedSegs([]); return; }
    const ids = state.selectedSegmentIds ?? [];
    if (ids.length > 0) setPendingSelectedSegs(ids);
  }, [state.selectedSegmentIds, pendingWall]);

  // Подтверждение выбора стен (кнопка ОК)
  const handlePendingConfirm = () => {
    if (!pendingWall || pendingSelectedSegs.length === 0) return;
    const { item, otherWallItems, floorItems } = pendingWall;
    onAssignMany([{ item, segIds: pendingSelectedSegs }, ...otherWallItems], floorItems);
    setPendingWall(null);
    setPendingSelectedSegs([]);
  };

  // Детект команды замены
  const isReplaceCommand = (t: string) =>
    /замен|поменя|вместо|измен|передел|переключ|смени|своп|убери.{0,30}поставь|убери.{0,30}добавь/i.test(t);

  // Найти все стены где стоит товар с данной категорией
  const findSegsWithCategory = (category: string): string[] =>
    state.segments
      .filter(seg => (seg.items ?? []).some(it => it.category === category))
      .map(seg => seg.id);

  // Обработка items от бота
  const handleVoiceItems = (items: VoiceCatalogItem[], transcript: string) => {
    console.log("[voice] transcript:", transcript);
    console.log("[voice] items:", items.map(i => i.name));

    // Исправляем дефолт теневого профиля, затем гарантируем комплект светильника
    const guaranteedItems = ensureLightingBundle(fixShadowProfile(items, allPrices), allPrices);
    if (guaranteedItems.length !== items.length) {
      console.log("[voice] lighting bundle auto-completed:", guaranteedItems.map(i => i.name));
    }
    const items_ = guaranteedItems;

    // Команда замены: ставим новый товар на те же стены где стоял старый
    if (isReplaceCommand(transcript)) {
      const wallItemsWithSegs: { item: SegmentPriceItem; segIds: string[] | null }[] = [];
      const floorItems: SegmentPriceItem[] = [];

      items_.forEach(voiceItem => {
        const matched = matchItem(voiceItem, allPrices);
        if (!matched) return;
        if (SILENT_CATEGORIES.has(matched.category) ||
            matched.name === "Раскрой ПВХ" || matched.name === "Огарпунивание ПВХ") {
          floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
          return;
        }
        if (matched.isWallItem && state.segments.length > 0) {
          const segsWithCategory = findSegsWithCategory(matched.category);
          if (segsWithCategory.length > 0) {
            wallItemsWithSegs.push({ item: matched, segIds: segsWithCategory });
          } else {
            wallItemsWithSegs.push({ item: matched, segIds: [ALL_SEGS_SENTINEL] });
          }
        } else {
          floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
        }
      });

      if (wallItemsWithSegs.length > 0 || floorItems.length > 0) {
        onAssignMany(wallItemsWithSegs, floorItems);
      }
      return;
    }

    // Обычный режим добавления
    const wallItemsWithSegs: { item: SegmentPriceItem; segIds: string[] | null }[] = [];
    const floorItems: SegmentPriceItem[] = [];
    const unknownWallItems: SegmentPriceItem[] = [];

    items_.forEach(voiceItem => {
      const matched = matchItem(voiceItem, allPrices);
      if (!matched) { console.log("[voice] no match for:", voiceItem.name); return; }

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
        console.log("[voice] segIds for", matched.name, "->", itemSegIds);
        if (!itemSegIds) {
          unknownWallItems.push(matched);
        } else {
          wallItemsWithSegs.push({ item: matched, segIds: itemSegIds });
        }
      } else {
        floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
      }
    });

    if (wallItemsWithSegs.length > 0 || floorItems.length > 0) {
      onAssignMany(wallItemsWithSegs, floorItems);
    }

    if (unknownWallItems.length > 0) {
      setPendingWall({
        item: unknownWallItems[0],
        otherWallItems: [],
        floorItems: [],
      });
    }
  };

  // Старый обработчик оставляем для совместимости (не используется)
  const handlePendingSegClick = (_segId: string) => { void _segId; };



  return (
    <div className="relative">
      <CategoryDrumPanel
        open={open}
        onClose={onClose}
        prices={filteredPrices}
        initialCategory={initialCategory}
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

      {/* Баннер "выберите стены на чертеже" — в центре полотна */}
      {pendingWall && (
        <div
          className="fixed z-[10000] inset-0 flex items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="flex flex-col items-center gap-3 px-5 py-4 rounded-2xl"
            style={{
              background: "rgba(12,10,28,0.96)",
              border: "1.5px solid rgba(124,58,237,0.7)",
              boxShadow: "0 0 40px rgba(124,58,237,0.35), 0 8px 32px rgba(0,0,0,0.8)",
              backdropFilter: "blur(20px)",
              pointerEvents: "all",
              maxWidth: 340,
            }}
          >
            {/* Шапка: картинка + название */}
            <div className="flex items-center gap-3 w-full">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)" }}
              >
                {pendingWall.item.imageUrl
                  ? <img src={pendingWall.item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Icon name="Package" size={22} style={{ color: "#a78bfa" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-black text-white truncate">{pendingWall.item.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "rgba(167,139,250,0.75)" }}>
                  {pendingSelectedSegs.length === 0
                    ? "Нажмите на стену (или несколько) на чертеже"
                    : `Выбрано стен: ${pendingSelectedSegs.length} — нажмите ОК`}
                </div>
              </div>
              <button
                onClick={() => { setPendingWall(null); setPendingSelectedSegs([]); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-white/10 flex-shrink-0"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                <Icon name="X" size={13} />
              </button>
            </div>

            {/* Кнопка ОК — появляется когда выбрана хотя бы одна стена */}
            {pendingSelectedSegs.length > 0 && (
              <button
                onClick={handlePendingConfirm}
                className="w-full py-2.5 rounded-xl text-[13px] font-black transition hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
              >
                <Icon name="Check" size={15} />
                Добавить на {pendingSelectedSegs.length === 1 ? "стену" : `${pendingSelectedSegs.length} стены`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}