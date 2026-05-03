export const RISK_LS_KEY            = "discount_risk_settings";
export const COMPLEXITY_LS_KEY      = "discount_complexity_settings";
export const COMPLEXITY_PROMPTS_KEY = "discount_complexity_prompts";
export const COMPLEXITY_FORMULA_KEY = "discount_complexity_formula";

export interface ComplexityAnalysis {
  mathScore: number;
  mathResult: string;
  semanticResult: string;
  combineResult: {
    score: number;
    recommended_discount: number;
    level: "low" | "mid" | "high";
    summary: string;
  } | null;
  items: Array<{ name: string; complexity: number; weight: number; qty: number; unitScore: number }>;
}

export interface RiskSettings {
  max_discount: number;
  low_risk_threshold: number;
  mid_risk_threshold: number;
  min_margin: number;
  warn_margin: number;
  allow_zero_margin: boolean;
}

export const RISK_DEFAULTS: RiskSettings = {
  max_discount: 30,
  low_risk_threshold: 10,
  mid_risk_threshold: 20,
  min_margin: 5,
  warn_margin: 15,
  allow_zero_margin: false,
};

export function loadRiskSettings(): RiskSettings {
  try {
    const s = localStorage.getItem(RISK_LS_KEY);
    return s ? { ...RISK_DEFAULTS, ...JSON.parse(s) } : RISK_DEFAULTS;
  } catch { return RISK_DEFAULTS; }
}

export interface AiRisk {
  level: "low" | "mid" | "high";
  recommended_discount: number;
  reason: string;
  items: string[];
}
