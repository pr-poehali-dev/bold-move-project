import func2url from "@/../backend/func2url.json";

export const AUTH_URL       = (func2url as Record<string, string>)["auth"];
export const AI_URL         = (func2url as Record<string, string>)["ai-chat"];
export const PDF_URL        = (func2url as Record<string, string>)["generate-pdf"];
export const PARSE_SITE_URL = (func2url as Record<string, string>)["parse-site"];

export const DEMO_ID       = 14;
export const DEMO_EMAIL    = "whitelabel-test@demo.local";
export const DEMO_PASSWORD = "demo123";

export interface CheckResult {
  ok:    boolean;
  label: string;
  data?: string;
}

export interface WLCompany {
  id: number;
  email: string;
  name: string;
  company_name: string;
  bot_name: string;
  brand_color: string;
  support_phone: string;
  estimates_balance: number;
  created_at: string;
  purchased_at: string;
}

export type PanelView =
  | null
  | { type: "site"; url: string }
  | { type: "site-authed"; url: string; token: string }
  | { type: "admin"; companyId: number }
  | { type: "agent"; companyId: number };