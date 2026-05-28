import type { PriceEntry } from "./CategoryDrumPanel";
import type { SegmentPriceItem } from "./planTypes";
import type { VoiceCatalogItem } from "./useVoiceCatalog";

// Категории которые идут НА СТЕНЫ (пог.м вдоль периметра)
export const WALL_CATEGORIES = new Set([
  "Профиль стандартный",
  "Теневой профиль",
  "Парящий профиль",
  "Ниши для штор",
  "Двухуровневые",
  "Вставки и заглушки",
  "Углы и заглушки",
]);

// Категории которые НЕ показываем на чертеже вообще (тихо в смету)
export const SILENT_CATEGORIES = new Set([
  "Монтаж",
]);

// Исправляем дефолт теневого профиля: если AI вернул просто "теневой" без уточнения
// или вернул "Теневой профиль" как абстрактную категорию — заменяем на EuroKRAB стеновой
export function fixShadowProfile(items: VoiceCatalogItem[], prices: PriceEntry[]): VoiceCatalogItem[] {
  const eurokrabName = prices.find(p => /EuroKRAB.*стеновой/i.test(p.name))?.name ?? "EuroKRAB стеновой";
  return items.map(item => {
    const n = item.name.toLowerCase();
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
export function ensureLightingBundle(items: VoiceCatalogItem[], prices: PriceEntry[]): VoiceCatalogItem[] {
  const isLight    = (n: string) => /светильник|gx.?53|споты|точечн|точки/i.test(n);
  const isLamp     = (n: string) => /лампа.*gx|gx.*лампа/i.test(n);
  const isZakladna = (n: string) => /под светильник|∅90|диаметр.*90|90.*диаметр/i.test(n);

  const hasLight    = items.some(i => isLight(i.name) && !isLamp(i.name) && !isZakladna(i.name));
  const hasLamp     = items.some(i => isLamp(i.name));
  const hasZakladna = items.some(i => isZakladna(i.name));

  if (!hasLight && !hasLamp && !hasZakladna) return items;

  const lightItem = items.find(i => isLight(i.name)) || items.find(i => isLamp(i.name)) || items.find(i => isZakladna(i.name));
  const qty = lightItem?.qty ?? 1;

  const findInPrices = (pattern: RegExp) => prices.find(p => pattern.test(p.name))?.name;

  const lightName    = findInPrices(/Светильник GX-53/) ?? "Светильник GX-53 + лампа";
  const lampName     = findInPrices(/Лампа GX-53/) ?? "Лампа GX-53";
  const zakladnaName = findInPrices(/Под светильник.*90|∅90/) ?? "Под светильник ∅90";

  const result = [...items];
  if (!hasLight)    result.push({ name: lightName,    qty, unit: "шт" });
  if (!hasLamp)     result.push({ name: lampName,     qty, unit: "шт" });
  if (!hasZakladna) result.push({ name: zakladnaName, qty, unit: "шт" });

  return result;
}

// Маппинг товара от бота → SegmentPriceItem через прайс
export function matchItem(voiceItem: VoiceCatalogItem, prices: PriceEntry[]): SegmentPriceItem | null {
  const name = voiceItem.name.toLowerCase().trim().replace(/\s+/g, ' ');

  // 1. Точное совпадение (нормализуем пробелы в прайсе тоже)
  let found = prices.find(p => p.name.toLowerCase().replace(/\s+/g, ' ') === name);

  // 2. Частичное — name начинается с имени из прайса или наоборот
  if (!found) {
    found = prices.find(p => {
      const pn = p.name.toLowerCase().replace(/\s+/g, ' ');
      return name.includes(pn) || pn.includes(name);
    });
  }

  // 3. По ключевым словам — минимум 2 слова совпадают
  if (!found) {
    const words = name.split(/\s+/).filter(w => w.length > 2);
    found = prices.find(p => {
      const pWords = p.name.toLowerCase().replace(/\s+/g, ' ').split(/\s+/);
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
