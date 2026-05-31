import type { PriceEntry } from "./CategoryDrumPanel";
import type { FloorItem, SegmentPriceItem } from "./planTypes";
import { genId } from "./planTypes";

// Ключевые слова парящих профилей (для расчёта суммарной длины → катушки ленты)
const FLOATING_KEYWORDS = ["flexy", "fly", "парящий пк", "пк-6"];

function isFloating(name: string) {
  const n = name.toLowerCase();
  return FLOATING_KEYWORDS.some(w => n.includes(w));
}

/**
 * Фронтовой аналог бэкендовой apply_bundles_and_rules().
 * Принимает список товаров (стены + полотно) и прайс,
 * возвращает дополнительные FloorItem[], которые нужно добавить в state.floorItems.
 *
 * Логика:
 * 1. Для каждого товара читает bundle[] из прайса
 * 2. Обычные bundle-позиции: добавляет если ещё не в списке
 *    - calc_rule "кратно Nм" → катушки: ceil(суммарная длина парящих / N)
 *    - иначе qty = 1
 * 3. Блоки питания (calc_rule "до Xвт"): выбирает наименьший подходящий
 */
export function applyBundleRules(
  // Все текущие товары (wall-items по всем сегментам + floorItems)
  existingPriceIds: Set<number>,
  // Товар-триггер (только что добавленный) и его количество в пог.м
  triggerItem: SegmentPriceItem,
  triggerQty: number,
  // Суммарная длина ВСЕХ парящих профилей на плане (пог.м)
  totalFloatingLen: number,
  // Полный прайс с bundle/calc_rule
  prices: PriceEntry[],
): FloorItem[] {
  const priceById = new Map(prices.map(p => [p.id, p]));
  const trigger = prices.find(p => p.id === triggerItem.priceId);
  if (!trigger?.bundle) return [];

  let bundleIds: number[] = [];
  try {
    bundleIds = JSON.parse(trigger.bundle);
  } catch {
    return [];
  }
  if (!bundleIds.length) return [];

  // Разбиваем bundle на блоки питания и обычные позиции
  const powerItems: PriceEntry[] = [];
  const regularItems: PriceEntry[] = [];
  for (const bid of bundleIds) {
    const br = priceById.get(bid);
    if (!br) continue;
    const calc = (br.calc_rule ?? "").toLowerCase();
    if (/до\s+\d+\s*вт/.test(calc)) {
      powerItems.push(br);
    } else {
      regularItems.push(br);
    }
  }

  const toAdd: FloorItem[] = [];
  const addedIds = new Set<number>(existingPriceIds);
  let tapeQty = triggerQty;

  // Обычные bundle-позиции
  for (const br of regularItems) {
    if (addedIds.has(br.id)) continue;
    const calc = (br.calc_rule ?? "").toLowerCase();
    let qty = 1;
    if (/кратно/.test(calc)) {
      const m = calc.match(/кратно\s+(\d+)/);
      const step = m ? parseInt(m[1]) : 5;
      const baseLen = totalFloatingLen > 0 ? totalFloatingLen : triggerQty;
      const catushki = Math.max(1, Math.ceil(baseLen / step));
      qty = catushki;
      tapeQty = catushki * step;
    }
    toAdd.push({
      id: genId("fi"),
      priceId: br.id,
      name: br.name,
      category: br.category,
      imageUrl: br.image_url ?? null,
      unit: br.unit,
      quantity: qty,
    });
    addedIds.add(br.id);
  }

  // Блок питания: выбираем наименьший достаточный по ватт
  if (powerItems.length > 0) {
    const sorted = [...powerItems].sort((a, b) => {
      const wa = parseInt((a.calc_rule ?? "").match(/до\s+(\d+)/)?.[1] ?? "9999");
      const wb = parseInt((b.calc_rule ?? "").match(/до\s+(\d+)/)?.[1] ?? "9999");
      return wa - wb;
    });
    const chosen = sorted.find(r => {
      const maxW = parseInt((r.calc_rule ?? "").match(/до\s+(\d+)/)?.[1] ?? "0");
      return tapeQty <= maxW;
    }) ?? sorted[sorted.length - 1];
    if (chosen && !addedIds.has(chosen.id)) {
      toAdd.push({
        id: genId("fi"),
        priceId: chosen.id,
        name: chosen.name,
        category: chosen.category,
        imageUrl: chosen.image_url ?? null,
        unit: chosen.unit,
        quantity: 1,
      });
    }
  }

  return toAdd;
}

/**
 * Считает суммарную длину всех парящих профилей в текущем плане (сегменты).
 */
export function calcTotalFloatingLen(
  segments: { lengthCm?: number; items?: SegmentPriceItem[] }[],
): number {
  let total = 0;
  for (const seg of segments) {
    for (const it of seg.items ?? []) {
      if (isFloating(it.name)) {
        total += (it.quantity ?? (seg.lengthCm ? seg.lengthCm / 100 : 1));
      }
    }
  }
  return total;
}

export { isFloating };
