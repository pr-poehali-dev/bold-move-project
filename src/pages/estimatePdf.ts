import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EstimateBlock {
  title: string;
  items: { name: string; value: string }[];
}

interface ParsedEstimate {
  blocks: EstimateBlock[];
  totals: string[];
  finalPhrase: string;
}

const FONT_URL = "https://cdn.jsdelivr.net/gh/nicholasgasior/gfonts@master/fonts/roboto/Roboto-Regular.ttf";
const FONT_BOLD_URL = "https://cdn.jsdelivr.net/gh/nicholasgasior/gfonts@master/fonts/roboto/Roboto-Bold.ttf";

const fontCache: { regular?: string; bold?: string } = {};

async function loadFont(url: string): Promise<string> {
  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function ensureFonts() {
  if (!fontCache.regular) {
    fontCache.regular = await loadFont(FONT_URL);
  }
  if (!fontCache.bold) {
    fontCache.bold = await loadFont(FONT_BOLD_URL);
  }
}

export async function generateEstimatePdf(parsed: ParsedEstimate) {
  await ensureFonts();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.addFileToVFS("Roboto-Regular.ttf", fontCache.regular!);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", fontCache.bold!);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.setFont("Roboto");

  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 40, "F");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 140, 50);
  doc.text("MOSPOTOLKI", 15, 18);
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 190);
  doc.text("Натяжные потолки от производителя  |  +7 (977) 606-89-01  |  mospotolki.net", 15, 26);
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("СМЕТА", pageW - 15, 18, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 160);
  const today = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.text(`от ${today}`, pageW - 15, 26, { align: "right" });

  let y = 48;

  for (let bi = 0; bi < parsed.blocks.length; bi++) {
    const block = parsed.blocks[bi];

    const rows = block.items.map((item) => [item.name, item.value]);

    autoTable(doc, {
      startY: y,
      head: [[`${bi + 1}. ${block.title}`, "Стоимость"]],
      body: rows,
      theme: "plain",
      styles: {
        font: "Roboto",
        fontStyle: "normal",
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 4, right: 4 },
        textColor: [60, 60, 70],
        lineColor: [220, 220, 230],
        lineWidth: 0.2,
      },
      headStyles: {
        font: "Roboto",
        fontStyle: "bold",
        fontSize: 9,
        textColor: [255, 140, 50],
        fillColor: [245, 245, 250],
        lineWidth: 0,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 40, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 15, right: 15 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

    if (y > 260) {
      doc.addPage();
      y = 15;
    }
  }

  if (parsed.totals.length > 0) {
    y += 2;
    doc.setFillColor(255, 245, 235);
    doc.roundedRect(15, y, pageW - 30, 8 + parsed.totals.length * 8, 3, 3, "F");
    doc.setDrawColor(255, 140, 50);
    doc.roundedRect(15, y, pageW - 30, 8 + parsed.totals.length * 8, 3, 3, "S");

    y += 7;
    doc.setFont("Roboto", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 130);
    doc.text("ИТОГО:", 20, y);
    y += 2;

    for (const t of parsed.totals) {
      y += 7;
      const parts = t.split(":");
      const label = parts[0].trim();
      const val = parts.slice(1).join(":").trim();
      const isSt = /standard/i.test(label);

      doc.setFont("Roboto", "bold");
      doc.setFontSize(isSt ? 12 : 9);
      doc.setTextColor(isSt ? 255 : 80, isSt ? 120 : 80, isSt ? 30 : 90);
      doc.text(label + ":", 20, y);
      doc.text(val, pageW - 20, y, { align: "right" });
    }

    y += 12;
  }

  if (parsed.finalPhrase) {
    if (y > 270) {
      doc.addPage();
      y = 15;
    }
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 150);
    const lines = doc.splitTextToSize(parsed.finalPhrase, pageW - 30);
    doc.text(lines, 15, y);
    y += lines.length * 4 + 5;
  }

  if (y > 270) {
    doc.addPage();
    y = 15;
  }
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 170);
  doc.text("MosPotolki  |  Мытищи, Пограничная 24  |  +7 (977) 606-89-01  |  wa.me/79776068901", pageW / 2, 287, { align: "center" });

  doc.save(`Смета_MosPotolki_${today.replace(/\./g, "-")}.pdf`);
}

export default generateEstimatePdf;
