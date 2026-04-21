import { useEffect, useRef, useState } from "react";
import func2url from "@/../backend/func2url.json";

const PRICES_URL = func2url["get-prices"];
const PRICE_BY_NAME_URL = func2url["get-price-by-name"];

export interface PriceItem {
  id: number;
  name: string;
  price: number;
  unit: string;
  category: string;
  synonyms: string;
}

let _cache: PriceItem[] | null = null;

export function usePrices(): PriceItem[] {
  const [prices, setPrices] = useState<PriceItem[]>(_cache ?? []);
  const fetched = useRef(false);

  useEffect(() => {
    if (_cache || fetched.current) return;
    fetched.current = true;
    fetch(PRICES_URL)
      .then((r) => r.json())
      .then((d) => {
        _cache = d.prices ?? [];
        setPrices(_cache!);
      })
      .catch(() => {});
  }, []);

  return prices;
}

// Поиск ближайшей позиции в прайсе по названию (используется вне хука)
function normStr(s: string) {
  return s.toLowerCase().replace(/ё/g, "е").trim();
}

export function findPriceByName(prices: PriceItem[], query: string): PriceItem | null {
  if (!prices.length || !query) return null;
  const q = normStr(query);

  // 1. Точное вхождение в name
  const exact = prices.find((p) => normStr(p.name).includes(q));
  if (exact) return exact;

  // 2. Поиск по synonyms
  const bySynonym = prices.find((p) => p.synonyms && normStr(p.synonyms).includes(q));
  if (bySynonym) return bySynonym;

  // 3. По словам длиннее 2 символов
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return null;

  let best: PriceItem | null = null;
  let bestScore = 0;
  for (const p of prices) {
    const haystack = normStr(p.name + " " + p.synonyms);
    const score = words.filter((w) => haystack.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 1 ? best : null;
}

// Async: спрашивает backend (БД → LLM) если локальный поиск не дал результата
export async function fetchPriceByName(name: string): Promise<{ price: number; unit: string }> {
  try {
    const r = await fetch(PRICE_BY_NAME_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const d = await r.json();
    return { price: d.price ?? 0, unit: d.unit ?? '' };
  } catch {
    return { price: 0, unit: '' };
  }
}