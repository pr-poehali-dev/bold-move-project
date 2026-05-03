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
  loading: boolean;
  saving: boolean;
  load: () => Promise<void>;
  save: (rules: RuleEntry[], auto_mode: boolean) => Promise<void>;
}

function getToken(): string {
  return localStorage.getItem("mp_user_token") || "";
}

export function useAutoRules(): AutoRulesState {
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [auto_mode, setAutoMode] = useState(false);
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
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (newRules: RuleEntry[], newAutoMode: boolean) => {
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ rules: newRules, auto_mode: newAutoMode }),
      });
      setRules(newRules);
      setAutoMode(newAutoMode);
      window.dispatchEvent(new CustomEvent("auto-rules-updated"));
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { rules, auto_mode, loading, saving, load, save };
}
