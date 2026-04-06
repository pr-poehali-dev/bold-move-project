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

let fontBase64: string | null = null;

async function ensureFont() {
  if (fontBase64) return;
  const resp = await fetch(func2url["get-font"]);
  const data = await resp.json();
  if (data.font) {
    fontBase64 = data.font;
  }
}

export async function generateEstimatePdf(parsed: ParsedEstimate) {
  await ensureFont();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let f = "helvetica";
  if (fontBase64) {
    doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
    doc.addFont("Roboto-Regular.ttf", "RobotoCyr", "normal");
    doc.setFont("RobotoCyr", "normal");
    f = "RobotoCyr";
  }

  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 38, "F");
  doc.setFont(f, "normal");
  doc.setFontSize(20);
  doc.setTextColor(255, 140, 50);
  doc.text("MOSPOTOLKI", 15, 16);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 190);
  doc.text("Натяжные потолки | +7 (977) 606-89-01 | mospotolki.net", 15, 24);
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("СМЕТА", pageW - 15, 16, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 160);
  doc.text("от " + today, pageW - 15, 24, { align: "right" });

  let y = 46;

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
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 0, 0],
        lineColor: [180, 180, 190],
        lineWidth: 0.2,
      },
      headStyles: {
        font: f,
        fontStyle: "normal",
        fontSize: 10,
        textColor: [220, 100, 20],
        fillColor: [245, 243, 248],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 42, halign: "right", textColor: [0, 0, 0] },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
    if (y > 255) { doc.addPage(); y = 15; }
  }

  if (parsed.totals.length > 0) {
    y += 3;
    const boxH = 10 + parsed.totals.length * 9;
    if (y + boxH > 280) { doc.addPage(); y = 15; }

    doc.setFillColor(255, 248, 240);
    doc.roundedRect(14, y, pageW - 28, boxH, 2, 2, "F");
    doc.setDrawColor(255, 140, 50);
    doc.setLineWidth(0.4);
    doc.roundedRect(14, y, pageW - 28, boxH, 2, 2, "S");

    y += 7;
    doc.setFont(f, "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("ИТОГО:", 19, y);

    for (const t of parsed.totals) {
      y += 9;
      const parts = t.split(":");
      const label = parts[0].trim();
      const val = parts.slice(1).join(":").trim();
      const isSt = /standard/i.test(label);

      doc.setFont(f, "normal");
      doc.setFontSize(isSt ? 13 : 10);
      doc.setTextColor(isSt ? 200 : 0, isSt ? 80 : 0, isSt ? 10 : 0);
      doc.text(label + ":", 19, y);
      doc.text(val, pageW - 19, y, { align: "right" });
    }
    y += 10;
  }

  if (parsed.finalPhrase) {
    if (y > 270) { doc.addPage(); y = 15; }
    doc.setFont(f, "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 90);
    const fLines = doc.splitTextToSize(parsed.finalPhrase, pageW - 28);
    doc.text(fLines, 14, y);
  }

  doc.setFont(f, "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 110);
  doc.text("MosPotolki | Мытищи, Пограничная 24 | +7 (977) 606-89-01 | wa.me/79776068901", pageW / 2, 288, { align: "center" });

  doc.save("Смета_MosPotolki_" + today.replace(/\./g, "-") + ".pdf");
}

export default generateEstimatePdf;