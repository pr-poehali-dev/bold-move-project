import { useState, useEffect, useCallback } from "react";
import { crmFetch, OrderSource } from "@/pages/admin/crm/crmApi";

export function useOrderSources() {
  const [sources, setSources] = useState<OrderSource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crmFetch("order_sources") as OrderSource[];
      setSources(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (name: string, color: string) => {
    const res = await crmFetch("order_sources", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    }) as OrderSource;
    setSources(prev => [...prev, res]);
    return res;
  };

  const update = async (id: number, patch: Partial<Pick<OrderSource, "name" | "color" | "sort_order">>) => {
    await crmFetch("order_sources", {
      method: "PUT",
      body: JSON.stringify({ id, ...patch }),
    }, { id: String(id) });
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const remove = async (id: number) => {
    await crmFetch("order_sources", { method: "DELETE", body: JSON.stringify({ id }) }, { id: String(id) });
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const getByName = (name: string | null) => sources.find(s => s.name === name) ?? null;

  return { sources, loading, load, create, update, remove, getByName };
}
