import jsPDF from "jspdf";
import func2url from "@/../backend/func2url.json";

interface EstimateBlock {
  title: string;
  numbered: boolean;
  items: { name: string; value: string }[];
}

interface ParsedEstimate {
  blocks: EstimateBlock[];
  totals: string[];
  finalPhrase: string;
}

let cachedFont: string | null = null;
let cachedBold: string | null = null;

async function ensureFont() {
  if (cachedFont) return;
  try {
    const resp = await fetch(func2url["get-font"]);
    if (resp.ok) {
      const data = await resp.json();
      if (data.font) {
        cachedFont = data.font;
        cachedBold = data.bold || null;
        return;
      }
    }
  } catch { /* ignore */ }
}

function setupDoc(doc: jsPDF): { fontName: string; hasBold: boolean } {
  if (!cachedFont) return { fontName: "helvetica", hasBold: false };
  try {
    doc.addFileToVFS("Roboto-Regular.ttf", cachedFont);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    if (cachedBold) {
      doc.addFileToVFS("Roboto-Bold.ttf", cachedBold);
      doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    }
    return { fontName: "Roboto", hasBold: !!cachedBold };
  } catch {
    return { fontName: "helvetica", hasBold: false };
  }
}

function clean(s: string) {
  return s.replace(/\*\*/g, "").trim();
}

/**
 * Разбирает value вида "32 м² × 399 Р = 12 768 Р" на [qty, price, total].
 * Если не удаётся разобрать — возвращает ["", "", value].
 */
function splitValue(value: string): [string, string, string] {
  const v = clean(value);
  if (!v) return ["", "", ""];

  // Паттерн: qty × price = total
  const mulEq = v.match(/^([\d\s,.]+\s*[м²шткгмlpа-яА-Я.]*)\s*[×xх]\s*([\d\s,.]+\s*[₽Рруб.]*)\s*=\s*([\d\s,.]+\s*[₽Рруб.]*)$/);
  if (mulEq) return [mulEq[1].trim(), mulEq[2].trim(), mulEq[3].trim()];

  // Паттерн: qty × price (без итога)
  const mul = v.match(/^([\d\s,.]+\s*[м²шткгмlpа-яА-Я.]*)\s*[×xх]\s*([\d\s,.]+\s*[₽Рруб.]*)$/);
  if (mul) {
    const q = parseFloat(mul[1].replace(/[^\d.]/g, ""));
    const p = parseFloat(mul[2].replace(/[^\d.]/g, ""));
    const total = (!isNaN(q) && !isNaN(p)) ? Math.round(q * p).toLocaleString("ru-RU") + " Р" : "";
    return [mul[1].trim(), mul[2].trim(), total];
  }

  // Просто число с валютой — это итог
  if (/^\d[\d\s,.]*\s*[₽Рруб.]/.test(v)) return ["", "", v];

  return ["", "", v];
}

function textCell(
  doc: jsPDF, text: string, x: number, y: number,
  w: number, h: number, align: "left" | "right", fontName: string, fontSize: number
) {
  doc.setFont(fontName, "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor("#000000");
  const tx = align === "right" ? x + w - 2 : x + 2;
  const maxW = w - 4;
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines[0] || "", tx, y + h / 2 + 1.2, { align });
}

function drawTableRow(
  doc: jsPDF, fontName: string,
  cols: string[], x: number, y: number,
  colWidths: number[], rowH: number, isHead: boolean,
  pageH: number, doAddPage: () => number
): number {
  if (y + rowH > pageH - 15) y = doAddPage();

  const totalW = colWidths.reduce((a, b) => a + b, 0);

  if (isHead) {
    doc.setFillColor(235, 232, 245);
    doc.rect(x, y, totalW, rowH, "F");
  }

  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.2);
  let cx = x;
  for (const w of colWidths) {
    doc.rect(cx, y, w, rowH);
    cx += w;
  }

  const fontSize = isHead ? 9 : 9;
  cx = x;
  for (let i = 0; i < cols.length; i++) {
    const align = i === 0 ? "left" : "right";
    textCell(doc, clean(cols[i] || ""), cx, y, colWidths[i], rowH, align as "left" | "right", fontName, fontSize);
    cx += colWidths[i];
  }

  return y + rowH;
}

export async function generateEstimatePdf(parsed: ParsedEstimate) {
  cachedFont = null;
  cachedBold = null;
  await ensureFont();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { fontName, hasBold } = setupDoc(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const today = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const margin = 12;
  const tableW = pageW - margin * 2;
  const colWidths = [tableW * 0.46, tableW * 0.16, tableW * 0.18, tableW * 0.20];

  // Шапка
  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 34, "F");

  doc.setFont(fontName, hasBold ? "bold" : "normal");
  doc.setFontSize(18);
  doc.setTextColor("#FF8C32");
  doc.text("MOSPOTOLKI", 14, 14);

  doc.setFont(fontName, "normal");
  doc.setFontSize(8);
  doc.setTextColor("#C8C8D7");
  doc.text("Натяжные потолки | +7 (977) 606-89-01 | mospotolki.net", 14, 22);

  doc.setFont(fontName, hasBold ? "bold" : "normal");
  doc.setFontSize(14);
  doc.setTextColor("#FFFFFF");
  doc.text("СМЕТА", pageW - 14, 14, { align: "right" });

  doc.setFont(fontName, "normal");
  doc.setFontSize(8);
  doc.setTextColor("#C8C8D7");
  doc.text("от " + today, pageW - 14, 22, { align: "right" });

  let y = 42;
  let numCounter = 0;

  const doAddPage = () => { doc.addPage(); return 18; };

  for (const block of parsed.blocks) {
    if (block.numbered) numCounter++;
    const label = ((block.numbered ? `${numCounter}. ` : "") + block.title).replace(/\*\*/g, "");

    y = drawTableRow(doc, fontName, [label, "Кол-во", "Цена/ед", "Сумма"], margin, y, colWidths, 8, true, pageH, doAddPage);

    for (const item of block.items) {
      const name = clean(item.name);
      const value = clean(item.value);
      const [qty, price, total] = splitValue(value);

      if (qty || price || total) {
        y = drawTableRow(doc, fontName, [name, qty, price, total], margin, y, colWidths, 7, false, pageH, doAddPage);
      } else {
        y = drawTableRow(doc, fontName, [name, "", "", ""], margin, y, colWidths, 7, false, pageH, doAddPage);
      }
    }
    y += 3;
  }

  // Итого
  if (parsed.totals.length > 0) {
    y += 2;
    const cleanTotals = parsed.totals
      .map(t => clean(t))
      .filter(t => t && !/^[-–—]{2,}$/.test(t));

    const boxH = 8 + cleanTotals.length * 7;
    if (y + boxH > pageH - 15) y = doAddPage();

    doc.setFillColor(255, 248, 238);
    doc.setDrawColor(255, 130, 40);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, tableW, boxH, 2, 2, "FD");

    y += 6;
    for (const t of cleanTotals) {
      const ci = t.indexOf(":");
      const lbl = ci >= 0 ? t.slice(0, ci).trim() : t;
      const val = ci >= 0 ? t.slice(ci + 1).trim() : "";
      const isHL = /standard/i.test(lbl);

      doc.setFont(fontName, (hasBold && isHL) ? "bold" : "normal");
      doc.setFontSize(isHL ? 11 : 9);
      doc.setTextColor(isHL ? "#D35400" : "#000000");
      doc.text(lbl + (ci >= 0 ? ":" : ""), margin + 3, y);
      if (val) doc.text(val, margin + tableW - 3, y, { align: "right" });
      y += 7;
    }
    y += 3;
  }

  if (parsed.finalPhrase) {
    if (y > pageH - 20) y = doAddPage();
    doc.setFont(fontName, "normal");
    doc.setFontSize(8);
    doc.setTextColor("#505050");
    const lines = doc.splitTextToSize(clean(parsed.finalPhrase), tableW);
    doc.text(lines, margin, y);
  }

  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  doc.setTextColor("#969696");
  doc.text("MosPotolki | Мытищи, Пограничная 24 | +7 (977) 606-89-01", pageW / 2, pageH - 8, { align: "center" });

  doc.save(`Смета_MosPotolki_${today.replace(/\./g, "-")}.pdf`);
}

export default generateEstimatePdf;
