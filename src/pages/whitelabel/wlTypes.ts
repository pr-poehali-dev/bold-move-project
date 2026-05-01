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

export type DemoStatus = "new" | "interested" | "paid" | "rejected";

export interface DemoPipelineCompany {
  demo_id:           number;
  site_url:          string;
  created_at:        string;
  company_id:        number;
  email:             string;
  company_name:      string;
  bot_name:          string;
  brand_color:       string;
  support_phone:     string;
  estimates_balance: number;
  has_own_agent:     boolean;
  brand_logo_url:    string;
  deleted:           boolean;
  status:            DemoStatus;
  contact_name:      string;
  contact_phone:     string;
  contact_position:  string;
  notes:             string;
  next_action:          string;
  next_action_date:     string;
  trial_until:          string | null;
  agent_purchased_at:   string | null;
}

export const DEMO_STATUSES: { id: DemoStatus; label: string; color: string; bg: string }[] = [
  { id: "new",        label: "Новые",        color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  { id: "interested", label: "Интерес",      color: "#06b6d4", bg: "rgba(6,182,212,0.12)"   },
  { id: "paid",       label: "Оплатили",     color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  { id: "rejected",   label: "Отказ",        color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
];

export type PanelView =
  | null
  | { type: "site"; url: string }
  | { type: "site-authed"; url: string; token: string }
  | { type: "admin"; companyId: number }
  | { type: "agent"; companyId: number };