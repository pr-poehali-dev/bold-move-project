export const PRICE_UNITS = ["шт", "м²", "пог.м", "уп", "катушка"] as const;
export type PriceUnit = typeof PRICE_UNITS[number];

export const DEFAULT_CATEGORY = "Дополнительно";
export const EMPTY_BUNDLE = "[]";

export const STORAGE_KEYS = {
  DONE_WORDS: "corr_done",
  EXTRA_WORDS: "corr_extra",
} as const;
