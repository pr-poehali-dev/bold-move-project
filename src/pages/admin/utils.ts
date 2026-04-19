import type { PriceItem } from "./types";

export function parseBundle(price: PriceItem & { bundle?: string }): number[] {
  try {
    const b = price.bundle;
    if (!b || b === "[]") return [];
    return JSON.parse(b) as number[];
  } catch { return []; }
}

export function addSynonym(existing: string, word: string): string {
  const parts = existing ? existing.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (!parts.includes(word.trim())) parts.push(word.trim());
  return parts.join(", ");
}

export function parseSynonyms(synonyms: string): string[] {
  return synonyms ? synonyms.split(",").map(s => s.trim()).filter(Boolean) : [];
}

export function isWordKnown(word: string, knownSynonyms: Set<string>): boolean {
  const wl = word.toLowerCase();
  return knownSynonyms.has(wl) || [...knownSynonyms].some(s => s === wl || s.includes(wl) || wl.includes(s));
}

export function buildKnownSynonyms(prices: PriceItem[]): Set<string> {
  return new Set(
    prices.flatMap(p => {
      const syns = parseSynonyms(p.synonyms).map(s => s.toLowerCase());
      return [p.name.toLowerCase(), ...syns];
    })
  );
}
