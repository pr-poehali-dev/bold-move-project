import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import func2url from "@/../backend/func2url.json";

interface EstimateBlock {
  title: string;
  items: { name: string; value: string }[];
}

interface ParsedEstimate {
  blocks: EstimateBlock[];
  totals: string[];
  finalPhrase: string;
}

let cachedFonts: { regular: string; bold: string } | null = null;

async function ensureFonts() {
  if (cachedFonts) return;
  const resp = await fetch(func2url["get-font"]);
  const data = await resp.json();
  if (data.font) {
    cachedFonts = { regular: data.font, bold: data.bold || data.font };
  }
}

function setupFonts(doc: jsPDF): string {
  if (!cachedFonts) return "helvetica";
  doc.addFileToVFS("Roboto-Regular.ttf", cachedFonts.regular);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", cachedFonts.bold);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");
  return "Roboto";
}

export async function generateEstimatePdf(parsed: ParsedEstimate) {
  await ensureFonts();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const f = setupFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 40, "F");
  doc.setFont(f, "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 140, 50);
  doc.text("MOSPOTOLKI", 15, 18);
  doc.setFont(f, "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 210);
  doc.text("Натяжные потолки | +7 (977) 606-89-01 | mospotolki.net", 15, 27);
  doc.setFont(f, "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("СМЕТА", pageW - 15, 18, { align: "right" });
  doc.setFont(f, "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 190);
  doc.text("от " + today, pageW - 15, 27, { align: "right" });

  let y = 50;

  for (let bi = 0; bi < parsed.blocks.length; bi++) {
    const block = parsed.blocks[bi];
    const rows = block.items.map((item) => [item.name, item.value]);

    autoTable(doc, {
      startY: y,
      head: [[bi + 1 + ". " + block.title, "Сумма"]],
      body: rows,
      theme: "grid",
      styles: {
        font: f,
        fontStyle: "normal",
        fontSize: 11,
        cellPadding: 3.5,
        textColor: [0, 0, 0],
        lineColor: [160, 160, 170],
        lineWidth: 0.3,
      },
      headStyles: {
        font: f,
        fontStyle: "bold",
        fontSize: 12,
        textColor: [200, 80, 0],
        fillColor: [240, 238, 245],
        lineWidth: 0.3,
      },
      bodyStyles: {
        font: f,
        fontStyle: "normal",
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 45, halign: "right", fontStyle: "bold", textColor: [0, 0, 0] },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    if (y > 250) { doc.addPage(); y = 15; }
  }

  if (parsed.totals.length > 0) {
    y += 4;
    const boxH = 14 + parsed.totals.length * 11;
    if (y + boxH > 275) { doc.addPage(); y = 15; }

    doc.setFillColor(255, 248, 238);
    doc.roundedRect(14, y, pageW - 28, boxH, 3, 3, "F");
    doc.setDrawColor(255, 130, 40);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, pageW - 28, boxH, 3, 3, "S");

    y += 9;
    doc.setFont(f, "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("ИТОГО:", 20, y);

    for (const t of parsed.totals) {
      y += 10;
      const parts = t.split(":");
      const label = parts[0].trim();
      const val = parts.slice(1).join(":").trim();
      const isSt = /standard/i.test(label);

      doc.setFont(f, "bold");
      doc.setFontSize(isSt ? 15 : 12);
      doc.setTextColor(isSt ? 200 : 0, isSt ? 80 : 0, isSt ? 0 : 0);
      doc.text(label + ":", 20, y);
      doc.text(val, pageW - 20, y, { align: "right" });
    }
    y += 14;
  }

  if (parsed.finalPhrase) {
    if (y > 265) { doc.addPage(); y = 15; }
    doc.setFont(f, "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    const fLines = doc.splitTextToSize(parsed.finalPhrase, pageW - 28);
    doc.text(fLines, 14, y);
  }

  doc.setFont(f, "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 90);
  doc.text("MosPotolki | Мытищи, Пограничная 24 | +7 (977) 606-89-01 | wa.me/79776068901", pageW / 2, 288, { align: "center" });

  doc.save("Смета_MosPotolki_" + today.replace(/\./g, "-") + ".pdf");
}

export default generateEstimatePdf;
