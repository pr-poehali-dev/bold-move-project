import { EstimateItem } from "./chatConfig";

export interface EditResult {
  handled: boolean;
  items?: EstimateItem[];
  reply?: string;
}

function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, "е").trim();
}

function findIdx(items: EstimateItem[], query: string): number {
  const q = norm(query);
  if (!q || q.length < 2) return -1;
  const exact = items.findIndex((it) => norm(it.name).includes(q));
  if (exact !== -1) return exact;
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return -1;
  let best = -1, bestScore = 0;
  for (let i = 0; i < items.length; i++) {
    const name = norm(items[i].name);
    const score = words.filter((w) => name.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return bestScore >= 1 ? best : -1;
}

function parseNum(s: string): number | null {
  if (!s) return null;
  const m = s.match(/^[\d.,]+$/);
  if (!m) return null;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

function parseUnit(s: string): string | undefined {
  const m = s.match(/м²|м2|кв\.?м|м\.п|мп|пм|шт\.?/i);
  return m ? m[0] : undefined;
}

// Генерируем минимальный текст-заглушку для isEstimate() — рендер идёт из items
export function buildEstimateText(items: EstimateItem[], oldText: string): string {
  const standard = Math.round(items.reduce((s, it) => s + it.qty * it.price, 0));
  const econom   = Math.round(standard * 0.85);
  const premium  = Math.round(standard * 1.27);

  // Сохраняем заголовок из оригинала (до первой строки с ₽)
  const origLines = oldText.split("\n");
  const headerLines: string[] = [];
  for (const l of origLines) {
    const tr = l.trim();
    if (tr.includes("₽") && !tr.startsWith("Econom") && !tr.startsWith("Standard") && !tr.startsWith("Premium") && !/итого/i.test(tr)) break;
    if (/^[-•]\s/.test(tr) && tr.includes("×")) break;
    headerLines.push(l);
  }

  const lines = [...headerLines];
  for (const item of items) {
    const unitStr = item.unit ? ` ${item.unit}` : "";
    const total = Math.round(item.qty * item.price);
    lines.push(`- ${item.name} ${item.qty}${unitStr} × ${item.price} ₽ = ${total} ₽`);
  }
  lines.push("");
  lines.push("ИТОГО стоимость:");
  lines.push(`Econom: ${econom.toLocaleString("ru")} ₽`);
  lines.push(`Standard: ${standard.toLocaleString("ru")} ₽`);
  lines.push(`Premium: ${premium.toLocaleString("ru")} ₽`);

  const finalLine = origLines.find((l) =>
    l.toLowerCase().includes("на какой день") || l.toLowerCase().includes("замер")
  );
  if (finalLine) lines.push("", finalLine);

  return lines.join("\n");
}

export function applyEstimateEdit(items: EstimateItem[], text: string): EditResult {
  const t = norm(text);

  // ──── УДАЛИТЬ ПОЗИЦИЮ ────
  const removeMatch = t.match(/(?:убери|удали|исключи|убрать|удалить|не нужн[оа]|без)\s+(.+)/);
  if (removeMatch) {
    const idx = findIdx(items, removeMatch[1].trim());
    if (idx !== -1) {
      return { handled: true, items: items.filter((_, i) => i !== idx), reply: "Готово ✅" };
    }
  }

  // ──── ДОБАВИТЬ ПОЗИЦИЮ ────
  const addMatch = t.match(/(?:добавь|добавить|включи|добавь ещё)\s+(.+)/);
  if (addMatch) {
    const raw = addMatch[1].trim();
    const numMatch = raw.match(/^(\d+[\d.,]*)\s+(.+)$/);
    const qty = numMatch ? parseFloat(numMatch[1]) : 1;
    const name = numMatch ? numMatch[2].trim() : raw;
    const unit = parseUnit(raw);
    // Ищем такую же позицию уже в смете — берём её цену
    const existing = findIdx(items, name);
    const price = existing !== -1 ? items[existing].price : 0;
    return { handled: true, items: [...items, { name, qty, price, unit }], reply: "Готово ✅" };
  }

  // ──── ИЗМЕНИТЬ ПЛОЩАДЬ ────
  // Меняем ВСЕ позиции с единицей м² (полотно, раскрой, огарпунивание, монтаж полотна)
  const areaMatch =
    t.match(/(?:площадь|потолок|комнат[а-я]*)[^\d]*(\d+[\d.,]*)\s*(?:м²|кв\.?м|м2|кв)?/) ||
    t.match(/(\d+[\d.,]*)\s*(?:м²|кв\.?м|м2)\s*(?:площадь|потолок)?/);
  if (areaMatch) {
    const area = parseFloat(areaMatch[1].replace(",", "."));
    if (!isNaN(area) && area > 0 && area < 1000) {
      const sqmItems = items.filter((it) =>
        it.unit === "м²" || it.unit === "м2" ||
        norm(it.name).includes("полотн") ||
        norm(it.name).includes("раскрой") ||
        norm(it.name).includes("огарпун") ||
        norm(it.name).includes("монтаж полотн")
      );
      if (sqmItems.length > 0) {
        const updated = items.map((it) => {
          const isArea =
            it.unit === "м²" || it.unit === "м2" ||
            norm(it.name).includes("полотн") ||
            norm(it.name).includes("раскрой") ||
            norm(it.name).includes("огарпун") ||
            norm(it.name).includes("монтаж полотн");
          return isArea ? { ...it, qty: area, unit: "м²" } : it;
        });
        return { handled: true, items: updated, reply: "Готово ✅" };
      }
    }
  }

  // ──── ИЗМЕНИТЬ КОЛИЧЕСТВО — явные команды ────
  const patterns: [RegExp, (m: RegExpMatchArray) => { qty: number | null; nameQuery: string }][] = [
    [
      /(?:сделай|поставь|измени|поменяй|установи|хочу|нужно)\s+(\d+[\d.,]*)\s+(.+)/,
      (m) => ({ qty: parseNum(m[1]), nameQuery: m[2]?.trim() ?? "" }),
    ],
    [
      /(?:поменяй|измени|сделай)\s+(.+?)\s+(?:на|=)\s*(\d+[\d.,]*)/,
      (m) => ({ qty: parseNum(m[2]), nameQuery: m[1]?.trim() ?? "" }),
    ],
    [
      /(\d+[\d.,]*)\s+(.+?)\s+вместо\s+\d+/,
      (m) => ({ qty: parseNum(m[1]), nameQuery: m[2]?.trim() ?? "" }),
    ],
    [
      /вместо\s+\d+\s+(.+?)\s+(?:сделай|поставь|нужно)\s+(\d+[\d.,]*)/,
      (m) => ({ qty: parseNum(m[2]), nameQuery: m[1]?.trim() ?? "" }),
    ],
  ];

  for (const [re, extract] of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const { qty, nameQuery } = extract(m);
    if (qty === null || qty <= 0 || !nameQuery) continue;
    const idx = findIdx(items, nameQuery);
    if (idx !== -1) {
      const updated = items.map((it, i) => i === idx ? { ...it, qty } : it);
      return { handled: true, items: updated, reply: "Готово ✅" };
    }
  }

  // ──── ПРОСТОЙ ФОРМАТ: "6 светильников" — только если слово точно совпадает с позицией ────
  const simpleMatch = t.match(/^(\d+[\d.,]*)\s+(.{3,})$/);
  if (simpleMatch) {
    const qty = parseFloat(simpleMatch[1].replace(",", "."));
    const nameQuery = simpleMatch[2].trim();
    if (!isNaN(qty) && qty > 0) {
      const idx = findIdx(items, nameQuery);
      if (idx !== -1) {
        const name = norm(items[idx].name);
        const words = norm(nameQuery).split(/\s+/).filter((w) => w.length > 2);
        const matchScore = words.filter((w) => name.includes(w)).length;
        if (matchScore >= 1) {
          const updated = items.map((it, i) => i === idx ? { ...it, qty } : it);
          return { handled: true, items: updated, reply: "Готово ✅" };
        }
      }
    }
  }

  return { handled: false };
}
