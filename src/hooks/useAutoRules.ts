import { useState, useEffect, useCallback } from "react";

const API_URL = "https://functions.poehali.dev/5e79f038-550c-41c6-8064-443681d7f8b4";

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
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [auto_mode, setAutoMode] = useState(false);
  const [use_installation_price, setUseInstallationPrice] = useState(false);
  const [use_measure_price, setUseMeasurePrice] = useState(false);
  const [use_management_price, setUseManagementPrice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setRules(data.rules || []);
      setAutoMode(data.auto_mode ?? false);
      setUseInstallationPrice(data.use_installation_price ?? false);
      setUseMeasurePrice(data.use_measure_price ?? false);
      setUseManagementPrice(data.use_management_price ?? false);
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
      window.dispatchEvent(new CustomEvent("auto-rules-updated"));
    } finally {
      setSaving(false);
    }
  }, [use_installation_price, use_measure_price, use_management_price]);

  useEffect(() => { load(); }, [load]);

  return { rules, auto_mode, use_installation_price, use_measure_price, use_management_price, loading, saving, load, save };
}