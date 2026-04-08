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

async function ensureFont() {
  if (cachedFont) return;
  try {
    const resp = await fetch(func2url["get-font"]);
    if (resp.ok) {
      const data = await resp.json();
      if (data.font) { cachedFont = data.font; return; }
    }
  } catch { /* ignore */ }
  // fallback: грузим напрямую
  try {
    const resp = await fetch("https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf");
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      cachedFont = btoa(bin);
    }
  } catch { /* ignore */ }
}

function registerFont(doc: jsPDF): string {
  if (!cachedFont) return "helvetica";
  try {
    const name = `F${Date.now()}`;
    doc.addFileToVFS(`${name}.ttf`, cachedFont);
    doc.addFont(`${name}.ttf`, name, "normal");
    return name;
  } catch {
    return "helvetica";
  }
}

// Рисует одну строку таблицы, возвращает новый y
function drawRow(
  doc: jsPDF, font: string,
  cols: string[], x: number, y: number, colWidths: number[],
  rowH: number, isHead: boolean, pageH: number,
  addPage: () => void
) {
  if (y + rowH > pageH - 15) { addPage(); y = 20; }

  // Фон заголовка
  if (isHead) {
    doc.setFillColor(235, 232, 245);
    doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
  }

  // Рамка строки
  doc.setDrawColor(180, 180, 200);
  doc.setLineWidth(0.3);
  let cx = x;
  for (const w of colWidths) {
    doc.rect(cx, y, w, rowH);
    cx += w;
  }

  // Текст — ВСЕГДА чёрный
  doc.setFont(font, "normal");
  doc.setFontSize(isHead ? 10 : 9.5);
  doc.setTextColor(0, 0, 0); // чёрный — нативный вызов без autoTable

  cx = x;
  for (let i = 0; i < cols.length; i++) {
    const w = colWidths[i];
    const text = (cols[i] || "").replace(/\*\*/g, "");
    const align = i === 0 ? "left" : "right";
    const tx = align === "right" ? cx + w - 2 : cx + 2;
    // Обрезаем длинный текст
    const maxW = w - 4;
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines[0] || "", tx, y + rowH / 2 + 1.5, { align, baseline: "middle" });
    cx += w;
  }

  return y + rowH;
}

export async function generateEstimatePdf(parsed: ParsedEstimate) {
  cachedFont = null;
  await ensureFont();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const font = registerFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const today = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const margin = 14;
  const tableW = pageW - margin * 2;
  const colWidths = [tableW - 28 - 34 - 28, 28, 34, 28]; // name, qty, price, sum

  // Шапка документа
  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 36, "F");
  doc.setFont(font, "normal");
  doc.setFontSize(18);
  doc.setTextColor(255, 140, 50);
  doc.text("MOSPOTOLKI", 15, 15);
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 215);
  doc.text("Натяжные потолки | +7 (977) 606-89-01", 15, 23);
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("СМЕТА", pageW - 15, 15, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 215);
  doc.text("от " + today, pageW - 15, 23, { align: "right" });

  let y = 44;
  let numCounter = 0;
  let pageNum = 1;

  const addPage = () => {
    doc.addPage();
    pageNum++;
    y = 20;
  };

  const parseLine = (name: string, value: string): [string, string, string, string] => {
    const clean = (s: string) => s.replace(/\*\*/g, "").trim();
    const hasMul = (s: string) => /[×xх]/.test(s);

    const compute = (qty: string, price: string) => {
      const q = parseFloat(qty.replace(/[^\d.]/g, ""));
      const p = parseFloat(price.replace(/[^\d.]/g, ""));
      return (!isNaN(q) && !isNaN(p) && p > 0) ? Math.round(q * p).toLocaleString("ru-RU") + " Р" : "";
    };

    const splitMul = (s: string) => {
      const lastMul = Math.max(s.lastIndexOf("×"), s.lastIndexOf("x"), s.lastIndexOf("х"));
      if (lastMul < 0) return null;
      const lastEq = s.lastIndexOf("=");
      let price = s.slice(lastMul + 1).trim();
      let preTotal: string | undefined;
      if (lastEq > lastMul) {
        price = s.slice(lastMul + 1, lastEq).trim();
        preTotal = clean(s.slice(lastEq + 1));
      }
      price = clean(price).match(/[\d\s,.]+\s*[₽Рм²шт\w]*/)?.[0]?.trim() || clean(price);
      const beforeMul = s.slice(0, lastMul).trim();
      const lastEqB = beforeMul.lastIndexOf("=");
      let qty = lastEqB >= 0 ? beforeMul.slice(lastEqB + 1).trim() : beforeMul;
      qty = clean(qty).match(/[\d,.]+\s*[м²шткгмlp]*/)?.[0]?.trim() || clean(qty);
      return { qty, price, preTotal };
    };

    const colonIdx = name.indexOf(":");
    if (colonIdx > 0 && hasMul(name)) {
      const sp = splitMul(name.slice(colonIdx + 1));
      if (sp) return [clean(name.slice(0, colonIdx)), sp.qty, sp.price, value || sp.preTotal || compute(sp.qty, sp.price)];
    }
    if (hasMul(value)) {
      const sp = splitMul(value);
      if (sp) return [clean(name), sp.qty, sp.price, sp.preTotal || compute(sp.qty, sp.price)];
    }
    if (hasMul(name)) {
      const sp = splitMul(name);
      if (sp) return ["", sp.qty, sp.price, value || sp.preTotal || compute(sp.qty, sp.price)];
    }
    return [clean(name), "", "", clean(value)];
  };

  for (const block of parsed.blocks) {
    if (block.numbered) numCounter++;
    const label = ((block.numbered ? `${numCounter}. ` : "") + block.title).replace(/\*\*/g, "");

    // Заголовок блока
    y = drawRow(doc, font, [label, "Кол-во", "Цена/ед", "Сумма"], margin, y, colWidths, 8, true, pageH, addPage);

    // Строки
    let i = 0;
    while (i < block.items.length) {
      const cur = block.items[i];
      const next = block.items[i + 1];
      const isJustName = !cur.value && !/[×xх₽Р]/.test(cur.name);
      let row: string[];
      if (isJustName && next) {
        const [n, qty, price, total] = parseLine(next.name, next.value);
        row = [cur.name.replace(/\*\*/g, "") || n, qty, price, total];
        i += 2;
      } else {
        const [n, qty, price, total] = parseLine(cur.name, cur.value);
        row = [n, qty, price, total];
        i++;
      }
      y = drawRow(doc, font, row, margin, y, colWidths, 7, false, pageH, addPage);
    }
    y += 4;
  }

  // Итого
  if (parsed.totals.length > 0) {
    y += 2;
    const cleanTotals = parsed.totals
      .map(t => t.replace(/\*\*/g, "").trim())
      .filter(t => t && !/^[-–—]{2,}$/.test(t))
      .map(t => {
        const ci = t.indexOf(":");
        if (ci < 0) return t;
        let val = t.slice(ci + 1).trim();
        if (/[+=]/.test(val)) {
          const nums = val.match(/[\d\s]+[₽Р]/g);
          val = nums ? nums[nums.length - 1].trim() : val;
        }
        return t.slice(0, ci).trim() + ": " + val;
      });

    const boxH = 10 + cleanTotals.length * 8;
    if (y + boxH > pageH - 15) { addPage(); }

    doc.setFillColor(255, 248, 238);
    doc.setDrawColor(255, 130, 40);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, tableW, boxH, 2, 2, "FD");

    y += 7;
    doc.setFont(font, "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("ИТОГО:", margin + 3, y);

    for (const t of cleanTotals) {
      y += 8;
      const ci = t.indexOf(":");
      const lbl = ci >= 0 ? t.slice(0, ci).trim() : t;
      const val = ci >= 0 ? t.slice(ci + 1).trim() : "";
      const isSt = /standard/i.test(lbl);
      doc.setFontSize(isSt ? 11 : 9.5);
      doc.setTextColor(isSt ? 180 : 0, isSt ? 60 : 0, 0);
      doc.text(lbl + ":", margin + 3, y);
      if (val) doc.text(val, margin + tableW - 3, y, { align: "right" });
    }
    y += 10;
  }

  if (parsed.finalPhrase) {
    if (y > pageH - 20) addPage();
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(parsed.finalPhrase.replace(/\*\*/g, ""), tableW);
    doc.text(lines, margin, y);
  }

  // Футер
  doc.setFont(font, "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("MosPotolki | Мытищи, Пограничная 24 | +7 (977) 606-89-01", pageW / 2, pageH - 8, { align: "center" });

  doc.save(`Смета_MosPotolki_${today.replace(/\./g, "-")}.pdf`);
}

export default generateEstimatePdf;
