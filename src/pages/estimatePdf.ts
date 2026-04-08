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

function setup(doc: jsPDF): string {
  if (!cachedFonts) return "helvetica";
  try {
    doc.addFileToVFS("Roboto-Regular.ttf", cachedFonts.regular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    if (cachedFonts.bold) {
      doc.addFileToVFS("Roboto-Bold.ttf", cachedFonts.bold);
      doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    }
    doc.setFont("Roboto", "normal");
    return "Roboto";
  } catch {
    return "helvetica";
  }
}

export async function generateEstimatePdf(parsed: ParsedEstimate) {
  await ensureFont();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const f = setup(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 38, "F");
  doc.setFont(f, "normal");
  doc.setFontSize(20);
  doc.setTextColor(255, 140, 50);
  doc.text("MOSPOTOLKI", 15, 17);
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 230);
  doc.text("Натяжные потолки | +7 (977) 606-89-01 | mospotolki.net", 15, 25);
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("СМЕТА", pageW - 15, 17, { align: "right" });
  doc.setFont(f, "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 230);
  doc.text("от " + today, pageW - 15, 25, { align: "right" });

  let y = 46;
  let numCounter = 0;

  for (let bi = 0; bi < parsed.blocks.length; bi++) {
    const block = parsed.blocks[bi];
    if (block.numbered) numCounter++;
    const blockLabel = block.numbered ? `${numCounter}. ${block.title}` : block.title;
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
        // Ищем последний × в строке
        const lastMul = Math.max(s.lastIndexOf("×"), s.lastIndexOf("x"), s.lastIndexOf("х"));
        if (lastMul < 0) return null;
        // Итог — после последнего "="
        const lastEq = s.lastIndexOf("=");
        let price = s.slice(lastMul + 1).trim();
        let preTotal: string | undefined;
        if (lastEq > lastMul) {
          price = s.slice(lastMul + 1, lastEq).trim();
          preTotal = s.slice(lastEq + 1).trim();
        }
        // Кол-во — часть до последнего ×, берём последний числовой блок
        const beforeMul = s.slice(0, lastMul).trim();
        // Убираем промежуточные вычисления (всё после последнего "=")
        const lastEqBefore = beforeMul.lastIndexOf("=");
        const qty = lastEqBefore >= 0 ? beforeMul.slice(lastEqBefore + 1).trim() : beforeMul;
        return { qty, price, preTotal };
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

      if (isJustName && next && /[×xх]/.test(next.name)) {
        const [, qty, price, total] = parseLine(next.name, next.value);
        rows.push([cur.name, qty, price, total]);
        i += 2;
      } else {
        rows.push(parseLine(cur.name, cur.value));
        i += 1;
      }
    }

    autoTable(doc, {
      startY: y,
      head: [[blockLabel, "Кол-во", "Цена/ед", "Сумма"]],
      body: rows,
      theme: "grid",
      styles: {
        font: f,
        fontStyle: "bold",
        fontSize: 10,
        cellPadding: 4,
        textColor: [0, 0, 0],
        lineColor: [100, 100, 110],
        lineWidth: 0.4,
      },
      headStyles: {
        font: f,
        fontStyle: "bold",
        fontSize: 11,
        textColor: [180, 60, 0],
        fillColor: [235, 232, 245],
        lineWidth: 0.4,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 28, halign: "right", textColor: [0, 0, 0], fontStyle: "bold" },
        2: { cellWidth: 34, halign: "right", textColor: [0, 0, 0], fontStyle: "bold" },
        3: { cellWidth: 28, halign: "right", textColor: [0, 0, 0], fontStyle: "bold" },
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
    doc.setFont(f, "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("ИТОГО:", 19, y);

    for (const t of parsed.totals) {
      y += 10;
      const parts = t.split(":");
      const label = parts[0].trim();
      const val = parts.slice(1).join(":").trim();
      const isSt = /standard/i.test(label);

      doc.setFont(f, "normal");
      doc.setFontSize(isSt ? 14 : 11);
      doc.setTextColor(isSt ? 180 : 0, isSt ? 60 : 0, 0);
      doc.text(label + ":", 19, y);
      doc.text(val, pageW - 19, y, { align: "right" });
    }
    y += 12;
  }

  if (parsed.finalPhrase) {
    if (y > 268) { doc.addPage(); y = 15; }
    doc.setFont(f, "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 60);
    const fLines = doc.splitTextToSize(parsed.finalPhrase, pageW - 28);
    doc.text(fLines, 14, y);
  }

  doc.setFont(f, "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text("MosPotolki | Мытищи, Пограничная 24 | +7 (977) 606-89-01 | wa.me/79776068901", pageW / 2, 288, { align: "center" });

  doc.save("Смета_MosPotolki_" + today.replace(/\./g, "-") + ".pdf");
}

export default generateEstimatePdf;