import func2url from "@/../backend/func2url.json";

export const AUTH_URL       = (func2url as Record<string, string>)["auth"];
export const AI_URL         = (func2url as Record<string, string>)["ai-chat"]
  || "https://functions.poehali.dev/f05382e5-8616-4209-bce6-00d9bcf86686";
export const PDF_URL        = (func2url as Record<string, string>)["generate-pdf"];
export const PARSE_SITE_URL = (func2url as Record<string, string>)["parse-site"];

/** Декодирует punycode-домен (xn--...) в кириллицу/unicode через встроенный punycode-декодер. */
function punycodeDecodeHost(host: string): string {
  // Браузерный URL API кодирует IDN → punycode, но не декодирует обратно.
  // Используем встроенный алгоритм punycode (RFC 3492) вручную для каждого лейбла.
  return host.split(".").map(label => {
    if (!label.startsWith("xn--")) return label;
    try {
      const code = label.slice(4); // убираем "xn--"
      const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, initialBias = 72, initialN = 128;
      let n = initialN, i = 0, bias = initialBias;
      const output: number[] = [];

      // Базовая часть (ASCII до последнего дефиса)
      const lastDash = code.lastIndexOf("-");
      const basic = lastDash < 0 ? "" : code.slice(0, lastDash);
      const rest  = lastDash < 0 ? code : code.slice(lastDash + 1);
      for (const ch of basic) output.push(ch.charCodeAt(0));

      const digitOf = (c: string) => {
        const cp = c.charCodeAt(0);
        if (cp >= 48 && cp <= 57)  return cp - 22;   // '0'-'9' → 26-35
        if (cp >= 65 && cp <= 90)  return cp - 65;   // 'A'-'Z'
        if (cp >= 97 && cp <= 122) return cp - 97;   // 'a'-'z'
        return base;
      };
      const adaptBias = (delta: number, numPoints: number, firstTime: boolean) => {
        delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
        delta += Math.floor(delta / numPoints);
        let k = 0;
        while (delta > Math.floor(((base - tMin) * tMax) / 2)) { delta = Math.floor(delta / (base - tMin)); k += base; }
        return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
      };

      let idx = 0;
      while (idx < rest.length) {
        const oldi = i;
        let w = 1;
        for (let k = base; ; k += base) {
          const digit = digitOf(rest[idx++]);
          i += digit * w;
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (digit < t) break;
          w *= base - t;
        }
        bias = adaptBias(i - oldi, output.length + 1, oldi === 0);
        n += Math.floor(i / (output.length + 1));
        i %= output.length + 1;
        output.splice(i++, 0, n);
      }
      return String.fromCodePoint(...output);
    } catch { return label; }
  }).join(".");
}

export function decodeDomain(siteUrl: string): string {
  try {
    const host = siteUrl.replace(/https?:\/\//, "").split("/")[0];
    if (host.includes("xn--")) return punycodeDecodeHost(host);
    return host;
  } catch {
    return siteUrl.replace(/https?:\/\//, "").split("/")[0];
  }
}

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

export type DemoStatus = "new" | "interested" | "presentation" | "presented" | "paid" | "rejected" | "upsell";

export interface DemoPipelineCompany {
  demo_id:           number;
  site_url:          string;
  created_at:        string;
  company_id:        number;
  email:             string;
  company_name:      string;
  bot_name:          string;
  bot_avatar_url:    string;
  bot_greeting:      string;
  brand_color:       string;
  support_phone:     string;
  support_email:     string;
  telegram_url:      string;
  working_hours:     string;
  pdf_footer_address: string;
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
  estimates_used:       number;
  presentation_at:      string | null;
  manager_id:           number | null;
  manager_name:         string;
}

export const DEMO_STATUSES: { id: DemoStatus; label: string; color: string; bg: string }[] = [
  { id: "new",          label: "Новые",          color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  { id: "interested",   label: "Интерес",        color: "#06b6d4", bg: "rgba(6,182,212,0.12)"   },
  { id: "presentation", label: "Презентация",    color: "#f97316", bg: "rgba(249,115,22,0.12)"  },
  { id: "presented",    label: "Показ проведён", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  { id: "paid",         label: "Оплатили",       color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  { id: "upsell",       label: "Доп. продажа",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  { id: "rejected",     label: "Отказ",          color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
];

export type PanelView =
  | null
  | { type: "site"; url: string }
  | { type: "site-authed"; url: string; token: string }
  | { type: "admin"; companyId: number }
  | { type: "agent"; companyId: number };