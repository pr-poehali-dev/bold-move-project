import func2url from "@/../backend/func2url.json";

export const AUTH_URL   = (func2url as Record<string, string>)["auth"];
export const PRICES_URL = (func2url as Record<string, string>)["get-prices"];

// Кэш коэффициентов 3 цен
export const pricingRules = {
  econom_mult:    0.85,
  premium_mult:   1.27,
  econom_label:   "Econom",
  standard_label: "Standard",
  premium_label:  "Premium",
};

fetch(`${AUTH_URL}?action=get-pricing-rules`)
  .then(r => r.json())
  .then(d => { Object.assign(pricingRules, d); })
  .catch(() => {});

export interface PriceItem {
  id: number;
  name: string;
  price: number;
  unit: string;
  category: string;
}

export interface EstimateBlock {
  title: string;
  numbered: boolean;
  items: { name: string; value: string }[];
}

export interface SavedEstimate {
  id: number;
  title: string;
  blocks: EstimateBlock[];
  totals: string[];
  final_phrase: string;
  total_econom: number | null;
  total_standard: number | null;
  total_premium: number | null;
  status: string;
  created_at: string;
}

// Парсим "20 м² × 399 ₽ = 7 980 ₽" → { qty, unit, price, total }
export function parseValue(value: string) {
  const m = value.match(/([\d,.\s]+)\s*([а-яёa-z²³.]+)?\s*[×x*]\s*([\d\s]+)\s*₽\s*=\s*([\d\s]+)\s*₽/i);
  if (m) {
    const qty   = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
    const unit  = (m[2] || "шт").trim();
    const price = parseInt(m[3].replace(/\s/g, ""), 10);
    const total = parseInt(m[4].replace(/\s/g, ""), 10);
    return { qty, unit, price, total };
  }
  const simple = value.match(/([\d\s]+)\s*₽/);
  if (simple) return { qty: 1, unit: "шт", price: parseInt(simple[1].replace(/\s/g, ""), 10), total: parseInt(simple[1].replace(/\s/g, ""), 10) };
  return null;
}

export function fmt(n: number) { return Math.round(n).toLocaleString("ru-RU"); }