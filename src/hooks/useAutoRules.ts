import { useState, useEffect, useCallback } from "react";

const API_URL = "https://functions.poehali.dev/5e79f038-550c-41c6-8064-443681d7f8b4";
const CACHE_KEY = "auto_rules_cache_v1";

interface CachedAutoRules {
  rules: RuleEntry[];
  auto_mode: boolean;
  use_installation_price: boolean;
  use_measure_price: boolean;
  use_management_price: boolean;
}

function loadCache(): CachedAutoRules | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as CachedAutoRules : null;
  } catch { return null; }
}

function saveCache(v: CachedAutoRules) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* тихо */ }
}

export interface RuleEntry {
  key: string;
  label: string;
  pct: number | null;
  enabled: boolean;
  visible: boolean;
  row_type: "cost" | "income";
  sort_order: number;
  is_default: boolean;
}

export interface AutoRulesState {
  rules: RuleEntry[];
  auto_mode: boolean;
  use_installation_price: boolean;
  use_measure_price: boolean;
  use_management_price: boolean;
  loading: boolean;
  saving: boolean;
  load: () => Promise<void>;
  save: (rules: RuleEntry[], auto_mode: boolean, use_installation_price?: boolean, use_measure_price?: boolean, use_management_price?: boolean) => Promise<void>;
}

function getToken(): string {
  return localStorage.getItem("mp_user_token") || "";
}

export function useAutoRules(): AutoRulesState {
  // Правила компании меняются редко — сразу показываем то, что закэшировано
  // в localStorage (мгновенно, без "пустой" карточки), а в фоне тянем свежее из БД.
  const cached = loadCache();
  const [rules, setRules] = useState<RuleEntry[]>(cached?.rules ?? []);
  const [auto_mode, setAutoMode] = useState(cached?.auto_mode ?? false);
  const [use_installation_price, setUseInstallationPrice] = useState(cached?.use_installation_price ?? false);
  const [use_measure_price, setUseMeasurePrice] = useState(cached?.use_measure_price ?? false);
  const [use_management_price, setUseManagementPrice] = useState(cached?.use_management_price ?? false);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!loadCache()) setLoading(true);
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      const next: CachedAutoRules = {
        rules: data.rules || [],
        auto_mode: data.auto_mode ?? false,
        use_installation_price: data.use_installation_price ?? false,
        use_measure_price: data.use_measure_price ?? false,
        use_management_price: data.use_management_price ?? false,
      };
      setRules(next.rules);
      setAutoMode(next.auto_mode);
      setUseInstallationPrice(next.use_installation_price);
      setUseMeasurePrice(next.use_measure_price);
      setUseManagementPrice(next.use_management_price);
      saveCache(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (newRules: RuleEntry[], newAutoMode: boolean, newUseInstall?: boolean, newUseMeasure?: boolean, newUseManagement?: boolean) => {
    setSaving(true);
    const installVal = newUseInstall ?? use_installation_price;
    const measureVal = newUseMeasure ?? use_measure_price;
    const managementVal = newUseManagement ?? use_management_price;
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ rules: newRules, auto_mode: newAutoMode, use_installation_price: installVal, use_measure_price: measureVal, use_management_price: managementVal }),
      });
      setRules(newRules);
      setAutoMode(newAutoMode);
      setUseInstallationPrice(installVal);
      setUseMeasurePrice(measureVal);
      setUseManagementPrice(managementVal);
      saveCache({ rules: newRules, auto_mode: newAutoMode, use_installation_price: installVal, use_measure_price: measureVal, use_management_price: managementVal });
      window.dispatchEvent(new CustomEvent("auto-rules-updated"));
    } finally {
      setSaving(false);
    }
  }, [use_installation_price, use_measure_price, use_management_price]);

  useEffect(() => { load(); }, [load]);

  return { rules, auto_mode, use_installation_price, use_measure_price, use_management_price, loading, saving, load, save };
}