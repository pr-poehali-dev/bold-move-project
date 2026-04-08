import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

let cachedFonts: { regular: string; bold?: string } | null = null;
// Сбрасываем кеш при каждом вызове чтобы шрифт регистрировался в новом doc
function clearFontCache() { cachedFonts = null; }

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchFontBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    return await arrayBufferToBase64(buf);
  } catch {
    return null;
  }
}

async function ensureFont() {
  if (cachedFonts) return;
  // Сначала пробуем бэкенд (уже кешировано в S3)
  try {
    const resp = await fetch(func2url["get-font"]);
    if (resp.ok) {
      const data = await resp.json();
      if (data.font) {
        cachedFonts = { regular: data.font, bold: data.bold };
        return;
      }
    }
  } catch { /* продолжаем */ }

  // Фолбэк: грузим напрямую с Google Fonts CDN
  const regular = await fetchFontBase64(
    "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf"
  );
  const bold = await fetchFontBase64(
    "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYJb2mT.ttf"
  );
  if (regular) cachedFonts = { regular, bold: bold ?? undefined };
}

function setup(doc: jsPDF): { regular: string; bold: string } {
  if (!cachedFonts) {
    console.warn("[PDF] no fonts — using helvetica");
    return { regular: "helvetica", bold: "helvetica" };
  }
  const uid = Date.now();
  const rFile = `R-${uid}.ttf`;
  const bFile = `B-${uid}.ttf`;
  try {
    // Регистрируем regular и как normal и как bold (fallback)
    doc.addFileToVFS(rFile, cachedFonts.regular);
    doc.addFont(rFile, "PdfF", "normal");
    doc.addFont(rFile, "PdfF", "bold");

    if (cachedFonts.bold) {
      // Если есть отдельный bold — регистрируем его
      doc.addFileToVFS(bFile, cachedFonts.bold);
      doc.addFont(bFile, "PdfF", "bold");
      console.log("[PDF] bold font loaded OK");
    } else {
      console.warn("[PDF] bold not available, using regular for bold");
    }
    doc.setFont("PdfF", "normal");
    return { regular: "PdfF", bold: "PdfF" };
  } catch(e) {
    console.error("[PDF] font register error:", e);
    return { regular: "helvetica", bold: "helvetica" };
  }
}

export async function generateEstimatePdf(parsed: ParsedEstimate) {
  clearFontCache();
  await ensureFont();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const f = setup(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 38, "F");
  doc.setFont(f.bold, "normal");
  doc.setFontSize(20);
  doc.setTextColor(255, 140, 50);
  doc.text("MOSPOTOLKI", 15, 17);
  doc.setFontSize(9);
  doc.setFont(f.regular, "normal");
  doc.setTextColor(220, 220, 230);
  doc.text("Натяжные потолки | +7 (977) 606-89-01 | mospotolki.net", 15, 25);
  doc.setFont(f.bold, "normal");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("СМЕТА", pageW - 15, 17, { align: "right" });
  doc.setFont(f.regular, "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 230);
  doc.text("от " + today, pageW - 15, 25, { align: "right" });

  let y = 46;
  let numCounter = 0;

  for (let bi = 0; bi < parsed.blocks.length; bi++) {
    const block = parsed.blocks[bi];
    if (block.numbered) numCounter++;
    const blockLabel = (block.numbered ? `${numCounter}. ${block.title}` : block.title).replace(/\*\*/g, "");
    // Универсальный разбор строки: извлекает название, кол-во, цену, итог
    const parseLine = (name: string, value: string): [string, string, string, string] => {
      const hasMul = (s: string) => /[×xх]/.test(s);
      const hasCurrency = (s: string) => /[₽Р]/.test(s);

      // Вычисляем итог из кол-ва и цены
      const compute = (qty: string, price: string): string => {
        const q = parseFloat(qty.replace(/[^\d.]/g, ""));
        const p = parseFloat(price.replace(/[^\d.]/g, ""));
        return (!isNaN(q) && !isNaN(p) && p > 0)
          ? Math.round(q * p).toLocaleString("ru-RU") + " Р"
          : "";
      };

      // Разбиваем формулу на qty и price по последнему ×
      // Итог берём после последнего "= число Р"
      const splitMul = (s: string): { qty: string; price: string; preTotal?: string } | null => {
        const lastMul = Math.max(s.lastIndexOf("×"), s.lastIndexOf("x"), s.lastIndexOf("х"));
        if (lastMul < 0) return null;

        const lastEq = s.lastIndexOf("=");
        let price = s.slice(lastMul + 1).trim();
        let preTotal: string | undefined;
        if (lastEq > lastMul) {
          price = s.slice(lastMul + 1, lastEq).trim();
          preTotal = s.slice(lastEq + 1).trim().replace(/\*\*/g, "").trim();
        }
        // Очищаем price от лишнего (берём только первое число + единицу)
        price = price.replace(/\*\*/g, "").trim();
        const priceNum = price.match(/[\d\s,.]+\s*[₽Рм²шт\w]*/)?.[0]?.trim() || price;

        // qty: берём часть до последнего ×, затем только число после последнего =
        const beforeMul = s.slice(0, lastMul).trim();
        const lastEqBefore = beforeMul.lastIndexOf("=");
        let qty = lastEqBefore >= 0 ? beforeMul.slice(lastEqBefore + 1).trim() : beforeMul;
        // Оставляем только число + единицу измерения (убираем промежуточные формулы)
        qty = qty.replace(/\*\*/g, "").trim();
        const qtyClean = qty.match(/[\d,.]+\s*[м²шткгмlp]*/)?.[0]?.trim() || qty;

        return { qty: qtyClean, price: priceNum, preTotal };
      };

      // Случай 1: name = "Название: формула" (через двоеточие)
      const colonIdx = name.indexOf(":");
      if (colonIdx > 0 && hasMul(name)) {
        const title = name.slice(0, colonIdx).trim();
        const formula = name.slice(colonIdx + 1).trim();
        const sp = splitMul(formula);
        if (sp) {
          const total = value || sp.preTotal || compute(sp.qty, sp.price);
          return [title, sp.qty, sp.price, total];
        }
      }

      // Случай 2: value содержит формулу
      if (hasMul(value) && hasCurrency(value)) {
        const sp = splitMul(value);
        if (sp) {
          const total = sp.preTotal || compute(sp.qty, sp.price);
          return [name, sp.qty, sp.price, total];
        }
      }

      // Случай 3: name содержит формулу без двоеточия
      if (hasMul(name) && hasCurrency(name)) {
        const sp = splitMul(name);
        if (sp) {
          const total = value || sp.preTotal || compute(sp.qty, sp.price);
          return ["", sp.qty, sp.price, total];
        }
      }

      // Случай 4: название + итог без формулы
      return [name, "", "", value];
    };

    // Объединяем пары: если строка без цены, а следующая — формула
    const rows: string[][] = [];
    let i = 0;
    while (i < block.items.length) {
      const cur = block.items[i];
      const next = block.items[i + 1];
      const isJustName = !cur.value && !/[×xх₽Рру]/.test(cur.name);

      const clean = (s: string) => s.replace(/\*\*/g, "").trim();
      if (isJustName && next && /[×xх]/.test(next.name)) {
        const [n, qty, price, total] = parseLine(next.name, next.value);
        rows.push([clean(cur.name || n), qty, price, total]);
        i += 2;
      } else {
        const [n, qty, price, total] = parseLine(cur.name, cur.value);
        rows.push([clean(n), qty, price, total]);
        i += 1;
      }
    }

    autoTable(doc, {
      startY: y,
      head: [[blockLabel, "Кол-во", "Цена/ед", "Сумма"]],
      body: rows,
      theme: "grid",
      styles: {
        font: f.regular,
        fontStyle: "normal",
        fontSize: 10,
        cellPadding: 4,
        textColor: 0,
        lineColor: 180,
        lineWidth: 0.4,
      },
      headStyles: {
        font: f.regular,
        fontStyle: "normal",
        fontSize: 11,
        textColor: [180, 60, 0],
        fillColor: [235, 232, 245],
        lineWidth: 0.4,
      },
      bodyStyles: {
        textColor: 0,
        font: f.regular,
        fontStyle: "normal",
        fillColor: false,
      },
      alternateRowStyles: {
        fillColor: [248, 248, 252],
        textColor: 0,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 28, halign: "right" },
        2: { cellWidth: 34, halign: "right" },
        3: { cellWidth: 28, halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
    if (y > 255) { doc.addPage(); y = 15; }
  }

  if (parsed.totals.length > 0) {
    y += 3;
    const boxH = 14 + parsed.totals.length * 11;
    if (y + boxH > 275) { doc.addPage(); y = 15; }

    doc.setFillColor(255, 248, 238);
    doc.roundedRect(14, y, pageW - 28, boxH, 2, 2, "F");
    doc.setDrawColor(255, 130, 40);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, pageW - 28, boxH, 2, 2, "S");

    y += 8;
    doc.setFont(f.bold, "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("ИТОГО:", 19, y);

    // Чистим totals: убираем markdown **, формулы (оставляем только итоговое число)
    const cleanTotals = parsed.totals
      .map(t => t.replace(/\*\*/g, "").trim())
      .filter(t => t && !/^[-–—]{2,}$/.test(t));

    // Оставляем только строки вида "Название: число Р" — без формул с +/×
    const simpleTotals = cleanTotals.map(t => {
      const colonIdx = t.indexOf(":");
      if (colonIdx < 0) return t;
      const label = t.slice(0, colonIdx).trim();
      let val = t.slice(colonIdx + 1).trim();
      // Если в значении есть формула (содержит + или =), берём последнее число
      if (/[+=]/.test(val)) {
        const nums = val.match(/[\d\s]+[₽Р]/g);
        val = nums ? nums[nums.length - 1].trim() : val;
      }
      return label + ": " + val;
    });

    for (const t of simpleTotals) {
      y += 10;
      const colonIdx = t.indexOf(":");
      const label = colonIdx >= 0 ? t.slice(0, colonIdx).trim() : t;
      const val = colonIdx >= 0 ? t.slice(colonIdx + 1).trim() : "";
      const isSt = /standard/i.test(label);

      doc.setFont(f.bold, "normal");
      doc.setFontSize(isSt ? 14 : 11);
      doc.setTextColor(isSt ? 180 : 0, isSt ? 60 : 0, 0);
      doc.text(label + ":", 19, y);
      if (val) doc.text(val, pageW - 19, y, { align: "right" });
    }
    y += 12;
  }

  if (parsed.finalPhrase) {
    if (y > 268) { doc.addPage(); y = 15; }
    doc.setFont(f.regular, "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 60);
    const fLines = doc.splitTextToSize(parsed.finalPhrase, pageW - 28);
    doc.text(fLines, 14, y);
  }

  doc.setFont(f.regular, "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text("MosPotolki | Мытищи, Пограничная 24 | +7 (977) 606-89-01 | wa.me/79776068901", pageW / 2, 288, { align: "center" });

  doc.save("Смета_MosPotolki_" + today.replace(/\./g, "-") + ".pdf");
}

export default generateEstimatePdf;