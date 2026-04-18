export interface SkipInfo {
  reason: "complex_keyword" | "no_area" | "unknown";
  unknown_word: string | null;
  unknown_words: string[];
}

export interface RecognizedData {
  area?: number;
  canvas?: string;
  perim?: number;
  n_lyustra?: number;
  n_svetilnik?: number;
  has_nisha?: boolean;
  nisha_label?: string | null;
  nisha_len?: number | null;
  profile_len?: number;
  standard_total?: number;
  reason?: string;
  unknown_word?: string | null;
  unknown_words?: string[];
}

export const RECOGNIZED_LABELS: { key: string; label: string; unit: string; icon: string }[] = [
  { key: "area",           label: "Площадь",           unit: "м²", icon: "Square" },
  { key: "canvas",         label: "Полотно",            unit: "",   icon: "Layers" },
  { key: "perim",          label: "Периметр",           unit: "мп", icon: "Maximize" },
  { key: "profile_len",    label: "Профиль",            unit: "мп", icon: "Minus" },
  { key: "n_lyustra",      label: "Люстры",             unit: "шт", icon: "Lightbulb" },
  { key: "n_svetilnik",    label: "Светильники GX-53",  unit: "шт", icon: "Zap" },
  { key: "has_nisha",      label: "Ниша для штор",      unit: "",   icon: "PanelRight" },
  { key: "nisha_label",    label: "Тип ниши",           unit: "",   icon: "Tag" },
  { key: "nisha_len",      label: "Длина ниши",         unit: "мп", icon: "Ruler" },
  { key: "standard_total", label: "Итого Standard",     unit: "₽",  icon: "Banknote" },
];
