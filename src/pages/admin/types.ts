export type AdminTab = "prices" | "rules" | "prompt" | "faq" | "questions" | "corrections";

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
  synonyms: string;
  active: boolean;
  sort_order: number;
  calc_rule: string;
  bundle: string;
  when_condition: string;
  when_not_condition: string;
}

export interface SuggestedItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface BotCorrection {
  id: number;
  session_id: string;
  user_text: string;
  recognized_json: Record<string, unknown> | null;
  corrected_json: Record<string, unknown> | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  suggested_items: SuggestedItem[] | null;
  llm_answer: string | null;
}