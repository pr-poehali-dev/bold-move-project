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
  // Точное вхождение
  const exact = items.findIndex((it) => norm(it.name).includes(q));
  if (exact !== -1) return exact;
  // По словам длиннее 2 символов
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

export function buildEstimateText(items: EstimateItem[], oldText: string): string {
  const lines: string[] = [];
  const origLines = oldText.split("\n");

  // Заголовок — строки до первой позиции с ₽
  for (const l of origLines) {
    const tr = l.trim();
    if (tr.includes("₽") && !tr.startsWith("Econom") && !tr.startsWith("Standard") && !tr.startsWith("Premium") && !/итого/i.test(tr)) break;
    if (/^[-•]\s/.test(tr) && tr.includes("×")) break;
    lines.push(l);
  }

  for (const item of items) {
    const unitStr = item.unit ? ` ${item.unit}` : "";
    const total = Math.round(item.qty * item.price);
    lines.push(`- ${item.name} ${item.qty}${unitStr} × ${item.price} ₽ = ${total} ₽`);
  }

  const standard = Math.round(items.reduce((s, it) => s + it.qty * it.price, 0));
  const econom   = Math.round(standard * 0.85);
  const premium  = Math.round(standard * 1.27);

  lines.push("");
  lines.push("ИТОГО стоимость:");
  lines.push(`Econom: ${econom.toLocaleString("ru")} ₽`);
  lines.push(`Standard: ${standard.toLocaleString("ru")} ₽`);
  lines.push(`Premium: ${premium.toLocaleString("ru")} ₽`);

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
    const avgPrice = items.length > 0
      ? Math.round(items.reduce((s, it) => s + it.price, 0) / items.length)
      : 500;
    return { handled: true, items: [...items, { name, qty, price: avgPrice, unit }], reply: "Готово ✅" };
  }

  // ──── ИЗМЕНИТЬ ПЛОЩАДЬ ────
  // Только явные команды изменения: "измени площадь на 15", "площадь 15 м²", "поменяй на 20 кв.м"
  // НЕ перехватываем: "потолок в комнате 20 м²", "что такое 15 кв.м"
  const areaChangeMatch =
    t.match(/(?:измени|поменяй|сделай|укажи|обнови)\s+(?:площадь|размер)[^\d]*(\d+[\d.,]*)/) ||
    t.match(/площадь\s+(\d+[\d.,]*)\s*(?:м²|кв\.?м|м2|кв\b)/) ||
    t.match(/^(\d+[\d.,]*)\s*(?:м²|м2|кв\.?м)\s*$/);
  if (areaChangeMatch) {
    const area = parseFloat(areaChangeMatch[1].replace(",", "."));
    if (!isNaN(area) && area > 0 && area < 1000) {
      const idx = items.findIndex((it) =>
        it.unit === "м²" || it.unit === "м2" ||
        norm(it.name).includes("полотн") ||
        norm(it.name).includes("плёнк") ||
        norm(it.name).includes("монтаж полотн")
      );
      if (idx !== -1) {
        const updated = items.map((it, i) => i === idx ? { ...it, qty: area, unit: "м²" } : it);
        return { handled: true, items: updated, reply: "Готово ✅" };
      }
    }
  }

  // ──── ИЗМЕНИТЬ КОЛИЧЕСТВО — явные команды ────
  // "сделай 6 светильников", "поменяй светильники на 6", "6 светильников вместо 4"
  // Убраны "хочу" и "нужно" — они слишком часто встречаются в обычных вопросах
  const patterns: RegExp[] = [
    /(?:сделай|поставь|измени|поменяй|установи)\s+(\d+[\d.,]*)\s+(.+)/,
    /(?:поменяй|измени|сделай)\s+(.+?)\s+(?:на|=)\s*(\d+[\d.,]*)/,
    /(\d+[\d.,]*)\s+(.+?)\s+вместо\s+\d+/,
    /вместо\s+\d+\s+(.+?)\s+(?:сделай|поставь)\s+(\d+[\d.,]*)/,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;

    let qty: number | null = null;
    let nameQuery = "";

    const n1 = parseNum(m[1]);
    const n2 = m[2] ? parseNum(m[2]) : null;

    if (n1 !== null && n2 === null) {
      qty = n1; nameQuery = m[2]?.trim() ?? "";
    } else if (n1 === null && n2 !== null) {
      qty = n2; nameQuery = m[1]?.trim() ?? "";
    } else if (n1 !== null && n2 !== null) {
      qty = n1; nameQuery = m[2]?.trim() ?? "";
    }

    if (qty === null || !nameQuery) continue;
    const idx = findIdx(items, nameQuery);
    if (idx !== -1) {
      const updated = items.map((it, i) => i === idx ? { ...it, qty } : it);
      return { handled: true, items: updated, reply: "Готово ✅" };
    }
  }

  // ──── ПРОСТОЙ ФОРМАТ: "6 светильников" — ТОЛЬКО если слово точно есть в смете ────
  // Короткие фразы типа "2 комнаты" или "3 варианта" НЕ перехватываем
  const simpleMatch = t.match(/^(\d+[\d.,]*)\s+(.{4,})$/);
  if (simpleMatch) {
    const qty = parseFloat(simpleMatch[1].replace(",", "."));
    const nameQuery = simpleMatch[2].trim();
    const idx = findIdx(items, nameQuery);
    if (idx !== -1 && !isNaN(qty)) {
      const name = norm(items[idx].name);
      const words = norm(nameQuery).split(/\s+/).filter(w => w.length > 2);
      // Требуем совпадение минимум 2 слов ИЛИ одного длинного (>5 символов)
      const matchScore = words.filter(w => name.includes(w)).length;
      const hasLongWord = words.some(w => w.length > 5 && name.includes(w));
      if ((matchScore >= 2 || hasLongWord) && words.length > 0) {
        const updated = items.map((it, i) => i === idx ? { ...it, qty } : it);
        return { handled: true, items: updated, reply: "Готово ✅" };
      }
    }
  }

  return { handled: false };
}