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

async function fetchPdfBlob(parsed: ParsedEstimate): Promise<Blob> {
  const resp = await fetch(func2url["generate-pdf"], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
  if (!resp.ok) throw new Error("PDF generation failed");
  const data = await resp.json();
  if (!data.pdf) throw new Error("No PDF data");
  const bytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: "application/pdf" });
}

export async function generateEstimatePdf(parsed: ParsedEstimate) {
  const blob = await fetchPdfBlob(parsed);
  const url = URL.createObjectURL(blob);
  const today = new Date().toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const a = document.createElement("a");
  a.href = url;
  a.download = `Смета_MosPotolki_${today.replace(/\./g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function previewEstimatePdf(parsed: ParsedEstimate) {
  const blob = await fetchPdfBlob(parsed);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

export default generateEstimatePdf;