import { EstimateItem } from "./chatConfig";

export interface EditResult {
  handled: boolean;
  items?: EstimateItem[];
  reply?: string;
}

// Нормализация строк для сравнения
function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, "е").trim();
}

// Ищем позицию по ключевым словам в названии
function findIdx(items: EstimateItem[], query: string): number {
  const q = norm(query);
  // Точное вхождение
  const idx = items.findIndex((it) => norm(it.name).includes(q));
  if (idx !== -1) return idx;
  // Слово за словом — ищем наибольшее перекрытие
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < items.length; i++) {
    const name = norm(items[i].name);
    const score = words.filter((w) => name.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return bestScore >= 1 ? best : -1;
}

// Парсим число из строки: "6 штук" → 6
function parseNum(s: string): number | null {
  const m = s.match(/[\d.,]+/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(",", "."));
  return isNaN(n) ? null : n;
}

// Извлекаем единицу измерения
function parseUnit(s: string): string | undefined {
  const m = s.match(/м²|м2|кв\.?м|м\.п|мп|пм|шт\.?/i);
  return m ? m[0] : undefined;
}

// Генерируем текст сметы из items для совместимости с EstimateTable
export function buildEstimateText(items: EstimateItem[], oldText: string): string {
  // Сохраняем заголовок и итоговый блок из старого текста, заменяем только позиции
  // Для простоты — перестраиваем полный текст из items
  const lines: string[] = [];

  // Заголовок из оригинала — ищем строки до первой позиции
  const origLines = oldText.split("\n");
  const headerLines: string[] = [];
  for (const l of origLines) {
    if (l.trim().includes("₽") && !l.trim().startsWith("Econom") && !l.trim().startsWith("Standard") && !l.trim().startsWith("Premium") && !/итого/i.test(l)) break;
    if (/^(\d+)\.\s/.test(l.trim()) && !l.includes("₽")) break;
    headerLines.push(l);
  }
  lines.push(...headerLines);

  // Позиции
  for (const item of items) {
    const unitStr = item.unit ? ` ${item.unit}` : "";
    const total = Math.round(item.qty * item.price);
    lines.push(`- ${item.name} ${item.qty}${unitStr} × ${item.price} ₽ = ${total} ₽`);
  }

  // Итоги — ищем строки с Econom/Standard/Premium из оригинала
  const econom = Math.round(items.reduce((s, it) => s + it.qty * it.price * 0.85, 0));
  const standard = Math.round(items.reduce((s, it) => s + it.qty * it.price, 0));
  const premium = Math.round(items.reduce((s, it) => s + it.qty * it.price * 1.27, 0));

  lines.push("");
  lines.push("ИТОГО стоимость:");
  lines.push(`Econom: ${econom.toLocaleString("ru")} ₽`);
  lines.push(`Standard: ${standard.toLocaleString("ru")} ₽`);
  lines.push(`Premium: ${premium.toLocaleString("ru")} ₽`);

  // Финальная фраза из оригинала
  const finalLine = origLines.find((l) =>
    l.toLowerCase().includes("на какой день") ||
    l.toLowerCase().includes("замер") ||
    l.toLowerCase().includes("предварительн")
  );
  if (finalLine) lines.push("", finalLine);

  return lines.join("\n");
}

export function applyEstimateEdit(items: EstimateItem[], text: string): EditResult {
  const t = norm(text);

  // ──── ИЗМЕНИТЬ КОЛИЧЕСТВО ────
  // "сделай 6 светильников", "поменяй количество шторы на 3"
  const qtyPatterns = [
    /(?:сделай|поставь|измени|поменяй|установи|хочу|нужно|укажи|поставь)\s+(\d+[\d.,]*)\s*(.+)/,
    /(.+?)\s+(?:сделай|поставь|измени|поменяй)\s+(\d+[\d.,]*)/,
    /(\d+[\d.,]*)\s+(.+?)\s+(?:вместо|а не|не \d)/,
    /(?:вместо|замени на)\s+(\d+[\d.,]*)\s*(.+)/,
    /(.+?)\s*[-–:]\s*(\d+[\d.,]*)\s*(?:шт|штук|штуки|м²|кв\.м|м\.п|мп|пм)?/,
  ];

  // Простой паттерн: "6 светильников", "площадь 15 м²"
  const simpleQty = t.match(/^(\d+[\d.,]*)\s+(.+)$/) || t.match(/^(.+?)\s+(\d+[\d.,]*)\s*(м²|кв\.?м|м\.п|мп|шт\.?|штук)?$/);
  if (simpleQty) {
    let qty: number | null = null;
    let nameQuery = "";
    let unit: string | undefined;

    const a = parseNum(simpleQty[1]);
    const b = parseNum(simpleQty[2] || "");

    if (a !== null && b === null) {
      qty = a;
      nameQuery = (simpleQty[2] || "").trim();
      unit = parseUnit(simpleQty[3] || "");
    } else if (b !== null && a === null) {
      qty = b;
      nameQuery = simpleQty[1].trim();
    }

    if (qty !== null && nameQuery.length > 1) {
      const idx = findIdx(items, nameQuery);
      if (idx !== -1) {
        const updated = items.map((it, i) =>
          i === idx ? { ...it, qty, ...(unit ? { unit } : {}) } : it
        );
        return { handled: true, items: updated, reply: "Готово ✅" };
      }
    }
  }

  // "поменяй количество светильников на 6"
  const changeQty = t.match(/(?:поменяй|измени|сделай|установи|поставь)\s+(?:количество\s+)?(.+?)\s+(?:на|=|:)\s*(\d+[\d.,]*)/);
  if (changeQty) {
    const nameQuery = changeQty[1].trim();
    const qty = parseNum(changeQty[2]);
    if (qty !== null) {
      const idx = findIdx(items, nameQuery);
      if (idx !== -1) {
        const updated = items.map((it, i) => i === idx ? { ...it, qty } : it);
        return { handled: true, items: updated, reply: "Готово ✅" };
      }
    }
  }

  // "6 светильников вместо 4" / "вместо 4 светильников сделай 6"
  const instead = t.match(/(\d+[\d.,]*)\s+(.+?)\s+вместо\s+\d+/) ||
                  t.match(/вместо\s+\d+\s+(.+?)\s+(?:сделай|поставь|нужно|хочу)\s+(\d+[\d.,]*)/);
  if (instead) {
    const qty = parseNum(instead[1]);
    const nameQuery = instead[2]?.trim() || instead[1]?.trim();
    if (qty !== null && nameQuery) {
      const idx = findIdx(items, nameQuery);
      if (idx !== -1) {
        const updated = items.map((it, i) => i === idx ? { ...it, qty } : it);
        return { handled: true, items: updated, reply: "Готово ✅" };
      }
    }
  }

  // ──── ИЗМЕНИТЬ ПЛОЩАДЬ ────
  const areaMatch = t.match(/(?:площадь|потолок|комнат[а-я]*)\s+(\d+[\d.,]*)\s*(?:м²|кв\.?м|м2|кв)?/) ||
                    t.match(/(\d+[\d.,]*)\s*(?:м²|кв\.?м|м2|кв)\s*(?:площадь|потолок)?/);
  if (areaMatch) {
    const area = parseNum(areaMatch[1]);
    if (area !== null) {
      // Ищем позиции с единицей м² или "полотно", "площадь"
      const idx = items.findIndex((it) =>
        it.unit === "м²" || it.unit === "м2" || norm(it.name).includes("полотн") ||
        norm(it.name).includes("плёнк") || norm(it.name).includes("монтаж полотн")
      );
      if (idx !== -1) {
        const updated = items.map((it, i) =>
          i === idx ? { ...it, qty: area, unit: "м²" } : it
        );
        return { handled: true, items: updated, reply: "Готово ✅" };
      }
    }
  }

  // ──── УДАЛИТЬ ПОЗИЦИЮ ────
  const removeMatch = t.match(/(?:убери|удали|исключи|убрать|удалить|не нужн[оа]|без)\s+(.+)/);
  if (removeMatch) {
    const nameQuery = removeMatch[1].trim();
    const idx = findIdx(items, nameQuery);
    if (idx !== -1) {
      const updated = items.filter((_, i) => i !== idx);
      return { handled: true, items: updated, reply: "Готово ✅" };
    }
  }

  // ──── ДОБАВИТЬ ПОЗИЦИЮ ────
  const addMatch = t.match(/(?:добавь|добавить|включи|нужно добавить|добавь ещё)\s+(.+)/);
  if (addMatch) {
    const raw = addMatch[1].trim();
    const qtyInAdd = parseNum(raw);
    const unit = parseUnit(raw);
    const nameClean = raw.replace(/^\d+[\d.,]*\s*/, "").replace(/м²|кв\.?м|м\.п|мп|шт\.?|штук/i, "").trim();

    // Ищем среднюю цену из существующих позиций для примерного расчёта
    const avgPrice = items.length > 0
      ? Math.round(items.reduce((s, it) => s + it.price, 0) / items.length)
      : 500;

    const newItem: EstimateItem = {
      name: nameClean || raw,
      qty: qtyInAdd ?? 1,
      price: avgPrice,
      unit,
    };
    return { handled: true, items: [...items, newItem], reply: "Готово ✅" };
  }

  return { handled: false };
}
