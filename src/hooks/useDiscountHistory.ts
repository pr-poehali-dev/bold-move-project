import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "@/pages/admin/crm/crmApi";

export interface DiscountEntry {
  id: number;
  discount_pct: number;
  discount_amount: number;
  contract_sum_before: number;
  contract_sum_after: number;
  is_active: boolean;
  created_at: string;
}

export function useDiscountHistory(clientId: number) {
  const [history, setHistory]   = useState<DiscountEntry[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crmFetch("discount-history", undefined, { client_id: String(clientId) });
      setHistory(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const addEntry = useCallback(async (entry: Omit<DiscountEntry, "id" | "is_active" | "created_at">) => {
    const res = await crmFetch("discount-history", {
      method: "POST",
      body: JSON.stringify({
        discount_pct: entry.discount_pct,
        discount_amount: entry.discount_amount,
        contract_sum_before: entry.contract_sum_before,
        contract_sum_after: entry.contract_sum_after,
      }),
    }, { client_id: String(clientId) });
    await load();
    return res;
  }, [clientId, load]);

  const deactivateLast = useCallback(async () => {
    if (history.length === 0) return null;
    const last = history[history.length - 1];
    await crmFetch("discount-history", { method: "PUT" }, { client_id: String(clientId), id: String(last.id) });
    await load();
    return last;
  }, [history, clientId, load]);

  useEffect(() => { load(); }, [load]);

  const totalDiscountAmount = history.reduce((s, e) => s + Number(e.discount_amount), 0);
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;

  return { history, loading, load, addEntry, deactivateLast, totalDiscountAmount, lastEntry };
}
