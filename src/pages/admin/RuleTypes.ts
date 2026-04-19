import type { PriceItem } from "./types";

export interface RuleItem extends PriceItem {
  calc_rule: string;
  bundle: string;
}

export interface RuleType {
  id: number;
  name: string;
  label: string;
  description: string;
  placeholder: string;
  sort_order: number;
  active: boolean;
}

export type DraftMap = Record<number, {
  calc_rule: string;
  when_condition: string;
  when_not_condition: string;
  bundle: string;
  custom: Record<string, string>;
  bundleIds: number[];
  bundleSearch: string;
  bundleOpen: boolean;
}>;

export function parseBundleIds(bundle: string): number[] {
  try {
    const parsed = JSON.parse(bundle);
    if (Array.isArray(parsed) && parsed.every(x => typeof x === "number")) return parsed;
  } catch { /* */ }
  return [];
}
