import func2url from "@/../backend/func2url.json";
import type { Brand } from "@/context/BrandContext";

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

interface PdfOptions {
  brand?: Brand | null;
  isCustom?: boolean;
}

async function fetchPdfBlob(parsed: ParsedEstimate, opt?: PdfOptions): Promise<Blob> {
  const body: Record<string, unknown> = { ...parsed };
  if (opt?.isCustom && opt.brand) {
    body.company_id = opt.brand.company_id ?? undefined;
    body.brand = {
      company_name:       opt.brand.company_name,
      brand_logo_url:     opt.brand.brand_logo_url,
      brand_color:        opt.brand.brand_color,
      support_phone:      opt.brand.support_phone,
      website:            opt.brand.website,
      telegram:           opt.brand.telegram_url,
      max_url:            opt.brand.max_url,
      working_hours:      opt.brand.working_hours,
      pdf_footer_address: opt.brand.pdf_footer_address,
    };
  }

  const resp = await fetch(func2url["generate-pdf"], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error("PDF generation failed");
  const data = await resp.json();
  if (!data.pdf) throw new Error("No PDF data");
  const bytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: "application/pdf" });
}

export async function generateEstimatePdf(parsed: ParsedEstimate, opt?: PdfOptions) {
  const blob = await fetchPdfBlob(parsed, opt);
  const url = URL.createObjectURL(blob);
  const today = new Date().toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  // Имя файла: бренд компании или дефолт MosPotolki
  const brandSlug = (opt?.isCustom && opt.brand?.company_name)
    ? opt.brand.company_name.replace(/[^a-zA-Z0-9А-Яа-я]+/g, "_").replace(/^_+|_+$/g, "")
    : "MosPotolki";
  const a = document.createElement("a");
  a.href = url;
  a.download = `Смета_${brandSlug || "MosPotolki"}_${today.replace(/\./g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function previewEstimatePdf(parsed: ParsedEstimate, opt?: PdfOptions) {
  const blob = await fetchPdfBlob(parsed, opt);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

export default generateEstimatePdf;
