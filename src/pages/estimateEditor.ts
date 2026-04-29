import { EstimateItem } from "./chatConfig";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

// Кэш коэффициентов — загружается один раз при старте
let _econom_mult    = 0.85;
let _premium_mult   = 1.27;
let _econom_label   = "Econom";
let _standard_label = "Standard";
let _premium_label  = "Premium";

fetch(`${AUTH_URL}?action=get-pricing-rules`)
  .then(r => r.json())
  .then(d => {
    if (d.econom_mult   !== undefined) _econom_mult    = d.econom_mult;
    if (d.premium_mult  !== undefined) _premium_mult   = d.premium_mult;
    if (d.econom_label  !== undefined) _econom_label   = d.econom_label;
    if (d.standard_label !== undefined) _standard_label = d.standard_label;
    if (d.premium_label !== undefined) _premium_label  = d.premium_label;
  })
  .catch(() => {});

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
  const econom   = Math.round(standard * _econom_mult);
  const premium  = Math.round(standard * _premium_mult);

  lines.push("");
  lines.push("ИТОГО стоимость:");
  lines.push(`${_econom_label}: ${econom.toLocaleString("ru")} ₽`);
  lines.push(`${_standard_label}: ${standard.toLocaleString("ru")} ₽`);
  lines.push(`${_premium_label}: ${premium.toLocaleString("ru")} ₽`);

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
  // "площадь 15", "15 м²", "потолок 20 кв.м"
  const areaMatch = t.match(/(?:площадь|потолок|комнат[а-я]*)[^\d]*(\d+[\d.,]*)\s*(?:м²|кв\.?м|м2|кв)?/) ||
                    t.match(/(\d+[\d.,]*)\s*(?:м²|кв\.?м|м2)\s*(?:площадь|потолок)?/);
  if (areaMatch) {
    const area = parseFloat(areaMatch[1].replace(",", "."));
    if (!isNaN(area)) {
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
  const patterns: RegExp[] = [
    /(?:сделай|поставь|измени|поменяй|установи|хочу|нужно)\s+(\d+[\d.,]*)\s+(.+)/,
    /(?:поменяй|измени|сделай)\s+(.+?)\s+(?:на|=)\s*(\d+[\d.,]*)/,
    /(\d+[\d.,]*)\s+(.+?)\s+вместо\s+\d+/,
    /вместо\s+\d+\s+(.+?)\s+(?:сделай|поставь|нужно)\s+(\d+[\d.,]*)/,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;

    // Определяем qty и nameQuery в зависимости от паттерна
    let qty: number | null = null;
    let nameQuery = "";

    const n1 = parseNum(m[1]);
    const n2 = m[2] ? parseNum(m[2]) : null;

    if (n1 !== null && n2 === null) {
      qty = n1; nameQuery = m[2]?.trim() ?? "";
    } else if (n1 === null && n2 !== null) {
      qty = n2; nameQuery = m[1]?.trim() ?? "";
    } else if (n1 !== null && n2 !== null) {
      // оба числа — первый паттерн: qty=n1, name=m[2]
      qty = n1; nameQuery = m[2]?.trim() ?? "";
    }

    if (qty === null || !nameQuery) continue;
    const idx = findIdx(items, nameQuery);
    if (idx !== -1) {
      const updated = items.map((it, i) => i === idx ? { ...it, qty } : it);
      return { handled: true, items: updated, reply: "Готово ✅" };
    }
  }

  // ──── ПРОСТОЙ ФОРМАТ: "6 светильников" (число + название позиции из сметы) ────
  // Только если название точно совпадает с позицией в смете
  const simpleMatch = t.match(/^(\d+[\d.,]*)\s+(.+)$/);
  if (simpleMatch) {
    const qty = parseFloat(simpleMatch[1].replace(",", "."));
    const nameQuery = simpleMatch[2].trim();
    const idx = findIdx(items, nameQuery);
    // Дополнительная проверка — совпадение должно быть достаточно точным
    if (idx !== -1 && !isNaN(qty)) {
      const name = norm(items[idx].name);
      const words = norm(nameQuery).split(/\s+/).filter(w => w.length > 2);
      const matchScore = words.filter(w => name.includes(w)).length;
      if (matchScore >= 1 && words.length > 0) {
        const updated = items.map((it, i) => i === idx ? { ...it, qty } : it);
        return { handled: true, items: updated, reply: "Готово ✅" };
      }
    }
  }

  return { handled: false };
}