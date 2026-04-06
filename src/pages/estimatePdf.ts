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

const FONT_URLS = [
  "https://cdn.jsdelivr.net/gh/AryaBhatt/Fonts@master/Roboto/Roboto-Regular.ttf",
  "https://cdn.jsdelivr.net/gh/googlefonts/roboto-classic@main/src/hinted/Roboto-Regular.ttf",
];

let fontBase64: string | null = null;
let fontLoaded = false;

async function ensureFont() {
  if (fontLoaded) return;
  for (const url of FONT_URLS) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const buf = await resp.arrayBuffer();
      if (buf.byteLength < 50000) continue;
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fontBase64 = btoa(binary);
      fontLoaded = true;
      return;
    } catch {
      continue;
    }
  }
}

function setupFont(doc: jsPDF): string {
  if (fontBase64) {
    try {
      doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
      doc.addFont("Roboto-Regular.ttf", "RobotoCyr", "normal");
      doc.setFont("RobotoCyr", "normal");
      return "RobotoCyr";
    } catch {
      return "helvetica";
    }
  }
  return "helvetica";
}

export async function generateEstimatePdf(parsed: ParsedEstimate) {
  await ensureFont();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const f = setupFont(doc);

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
  doc.text("+7 (977) 606-89-01 | mospotolki.net", 15, 24);
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("SMETA", pageW - 15, 16, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 160);
  doc.text(today, pageW - 15, 24, { align: "right" });

  let y = 46;

  for (let bi = 0; bi < parsed.blocks.length; bi++) {
    const block = parsed.blocks[bi];
    const rows = block.items.map((item) => [item.name, item.value]);

    autoTable(doc, {
      startY: y,
      head: [[bi + 1 + ". " + block.title, ""]],
      body: rows,
      theme: "grid",
      styles: {
        font: f,
        fontStyle: "normal",
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [50, 50, 60],
        lineColor: [210, 210, 220],
        lineWidth: 0.15,
      },
      headStyles: {
        font: f,
        fontStyle: "normal",
        fontSize: 9,
        textColor: [255, 130, 40],
        fillColor: [248, 248, 252],
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 40, halign: "right" },
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
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 110);
    doc.text("TOTAL:", 19, y);

    for (const t of parsed.totals) {
      y += 8;
      const parts = t.split(":");
      const label = parts[0].trim();
      const val = parts.slice(1).join(":").trim();
      const isSt = /standard/i.test(label);

      doc.setFont(f, "normal");
      doc.setFontSize(isSt ? 11 : 9);
      doc.setTextColor(isSt ? 220 : 70, isSt ? 100 : 70, isSt ? 20 : 80);
      doc.text(label + ":", 19, y);
      doc.text(val, pageW - 19, y, { align: "right" });
    }
    y += 10;
  }

  if (parsed.finalPhrase) {
    if (y > 270) { doc.addPage(); y = 15; }
    doc.setFont(f, "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 150);
    const fLines = doc.splitTextToSize(parsed.finalPhrase, pageW - 28);
    doc.text(fLines, 14, y);
  }

  doc.setFont(f, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(160, 160, 170);
  doc.text("MosPotolki | +7 (977) 606-89-01 | wa.me/79776068901", pageW / 2, 288, { align: "center" });

  doc.save("Smeta_MosPotolki_" + today.replace(/\./g, "-") + ".pdf");
}

export default generateEstimatePdf;
