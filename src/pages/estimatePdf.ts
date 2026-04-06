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

let cachedFont: string | null = null;

async function ensureFont() {
  if (cachedFont) return;
  const resp = await fetch(func2url["get-font"]);
  const data = await resp.json();
  if (data.font) cachedFont = data.font;
}

function setup(doc: jsPDF): string {
  if (!cachedFont) return "helvetica";
  doc.addFileToVFS("Roboto.ttf", cachedFont);
  doc.addFont("Roboto.ttf", "Roboto", "normal");
  doc.setFont("Roboto", "normal");
  return "Roboto";
}

function boldText(doc: jsPDF, text: string, x: number, y: number, opts?: { align?: "right" | "center" }) {
  doc.text(text, x, y, opts);
  doc.text(text, x + 0.22, y, opts);
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
  boldText(doc, "MOSPOTOLKI", 15, 17);
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);
  doc.text("Натяжные потолки | +7 (977) 606-89-01 | mospotolki.net", 15, 25);
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  boldText(doc, "СМЕТА", pageW - 15, 17, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 190);
  doc.text("от " + today, pageW - 15, 25, { align: "right" });

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
        lineColor: [150, 150, 160],
        lineWidth: 0.3,
      },
      headStyles: {
        font: f,
        fontStyle: "normal",
        fontSize: 10,
        textColor: [180, 60, 0],
        fillColor: [240, 237, 245],
        lineWidth: 0.3,
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 42, halign: "right" },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data) => {
        if (data.section === "head") {
          const cell = data.cell;
          doc.setFont(f, "normal");
          doc.setFontSize(10);
          doc.setTextColor(180, 60, 0);
          doc.text(cell.text.join(" "), cell.x + cell.padding("left") + 0.2, cell.y + cell.padding("top") + cell.contentHeight / 1.2);
        }
        if (data.section === "body" && data.column.index === 1) {
          const cell = data.cell;
          doc.setFont(f, "normal");
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
          const tx = cell.x + cell.width - cell.padding("right");
          const ty = cell.y + cell.padding("top") + cell.contentHeight / 1.2;
          doc.text(cell.text.join(" "), tx + 0.2, ty, { align: "right" });
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
    if (y > 255) { doc.addPage(); y = 15; }
  }

  if (parsed.totals.length > 0) {
    y += 3;
    const boxH = 12 + parsed.totals.length * 10;
    if (y + boxH > 275) { doc.addPage(); y = 15; }

    doc.setFillColor(255, 248, 238);
    doc.roundedRect(14, y, pageW - 28, boxH, 2, 2, "F");
    doc.setDrawColor(255, 130, 40);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, pageW - 28, boxH, 2, 2, "S");

    y += 8;
    doc.setFont(f, "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    boldText(doc, "ИТОГО:", 19, y);

    for (const t of parsed.totals) {
      y += 9;
      const parts = t.split(":");
      const label = parts[0].trim();
      const val = parts.slice(1).join(":").trim();
      const isSt = /standard/i.test(label);

      doc.setFont(f, "normal");
      doc.setFontSize(isSt ? 13 : 10);
      doc.setTextColor(isSt ? 180 : 0, isSt ? 60 : 0, 0);
      boldText(doc, label + ":", 19, y);
      boldText(doc, val, pageW - 19, y, { align: "right" });
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
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 90);
  doc.text("MosPotolki | Мытищи, Пограничная 24 | +7 (977) 606-89-01 | wa.me/79776068901", pageW / 2, 288, { align: "center" });

  doc.save("Смета_MosPotolki_" + today.replace(/\./g, "-") + ".pdf");
}

export default generateEstimatePdf;
