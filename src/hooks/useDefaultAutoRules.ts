import { useState, useEffect, useCallback } from "react";
import { RuleEntry } from "./useAutoRules";

const API_URL = "https://functions.poehali.dev/5e79f038-550c-41c6-8064-443681d7f8b4";

export type DefaultRulesMap = Record<string, RuleEntry[]>;

function getToken(externalToken?: string): string {
  return externalToken || localStorage.getItem("mp_user_token") || "";
}

export function useDefaultAutoRules(token?: string) {
  const [defaults, setDefaults] = useState<DefaultRulesMap>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?r=defaults`, {
        headers: { Authorization: `Bearer ${getToken(token)}` },
      });
      const data = await res.json();
      setDefaults(data || {});
    } finally {
      setLoading(false);
    }
  }, [token]);

  const saveRole = useCallback(async (role: string, rules: RuleEntry[]) => {
    setSaving(true);
    try {
      await fetch(`${API_URL}?r=defaults`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken(token)}` },
        body: JSON.stringify({ role, rules }),
      });
      setDefaults(prev => ({ ...prev, [role]: rules }));
    } finally {
      setSaving(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return { defaults, loading, saving, saveRole };
}