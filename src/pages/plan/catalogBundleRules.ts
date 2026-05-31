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
  // Блок питания: в calc_rule есть слова "до" И "вт" (как в бэкенде)
  const powerItems: PriceEntry[] = [];
  const regularItems: PriceEntry[] = [];
  for (const bid of bundleIds) {
    const br = priceById.get(bid);
    if (!br) continue;
    const calc = (br.calc_rule ?? "").toLowerCase();
    if (calc.includes("до") && calc.includes("вт")) {
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
    let qty = triggerQty; // по умолчанию — столько же сколько триггер (как в бэкенде)
    // Катушки ленты: unit = "катушка" или в calc_rule упоминается "катушка" / "кратно"
    const isTape = br.unit === "катушка" || /катушк|кратно/i.test(calc);
    if (isTape) {
      // Шаг катушки: ищем "(1 катушка = Nм)" или "кратно Nм" или default 5
      const stepM = calc.match(/катушка\s*=\s*(\d+)/i)?.[1]
        ?? calc.match(/кратно\s+(\d+)/i)?.[1]
        ?? "5";
      const step = parseInt(stepM);
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

  // Блок питания: выбираем наименьший достаточный по длине ленты
  // В calc_rule вида "до 5м → 100Вт, до 10м → 200Вт..." ищем пары (метры → ватты)
  // и выбираем блок, мощность которого покрывает tapeQty метров ленты
  if (powerItems.length > 0) {
    // Извлекаем из названия блока его мощность в ваттах (напр. "Блок питания 100 Вт" → 100)
    const getWatts = (r: PriceEntry) => {
      const m = r.name.match(/(\d+)\s*[вВ][тТ]/);
      return m ? parseInt(m[1]) : 9999;
    };
    // Из calc_rule любого блока вытаскиваем таблицу "до Xм → YВт"
    // и находим нужную мощность под tapeQty метров ленты
    const calcText = (powerItems[0].calc_rule ?? "").toLowerCase();
    // Ищем все пары вида "до Xм" и соответствующую мощность "YВт"
    const pairRegex = /до\s+(\d+)\s*м[^,]*?(\d+)\s*вт/g;
    const pairs: { maxM: number; watts: number }[] = [];
    let pm: RegExpExecArray | null;
    while ((pm = pairRegex.exec(calcText)) !== null) {
      pairs.push({ maxM: parseInt(pm[1]), watts: parseInt(pm[2]) });
    }

    let chosenWatts = 9999;
    if (pairs.length > 0) {
      pairs.sort((a, b) => a.maxM - b.maxM);
      const pair = pairs.find(p => tapeQty <= p.maxM) ?? pairs[pairs.length - 1];
      chosenWatts = pair.watts;
    }

    // Находим блок с нужными ваттами (или наибольший если не нашли точного)
    const sorted = [...powerItems].sort((a, b) => getWatts(a) - getWatts(b));
    const chosen = sorted.find(r => getWatts(r) >= chosenWatts) ?? sorted[sorted.length - 1];

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