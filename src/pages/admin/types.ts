export type AdminTab = "prices" | "rules" | "prompt" | "faq" | "questions";

export interface FaqItem {
  id: number;
  title: string;
  content: string;
  used: boolean;
}

export interface QuickQuestion {
  id: number;
  pattern: string;
  answer: string;
  active: boolean;
}

export interface PriceItem {
  id: number;
  category: string;
  name: string;
  price: number;
  unit: string;
  description: string;
  active: boolean;
}