import { useState, useEffect, useCallback } from "react";
import { crmFetch, ClientStatus } from "@/pages/admin/crm/crmApi";

export function useClientStatuses() {
  const [statuses, setStatuses] = useState<ClientStatus[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crmFetch("client_statuses") as ClientStatus[];
      setStatuses(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (name: string, color: string) => {
    const res = await crmFetch("client_statuses", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    }) as ClientStatus;
    setStatuses(prev => [...prev, res]);
    return res;
  };

  const update = async (id: number, patch: Partial<Pick<ClientStatus, "name" | "color" | "sort_order">>) => {
    await crmFetch("client_statuses", {
      method: "PUT",
      body: JSON.stringify({ id, ...patch }),
    }, { id: String(id) });
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const remove = async (id: number) => {
    await crmFetch("client_statuses", { method: "DELETE", body: JSON.stringify({ id }) }, { id: String(id) });
    setStatuses(prev => prev.filter(s => s.id !== id));
  };

  const getByName = (name: string | null) => statuses.find(s => s.name === name) ?? null;

  return { statuses, loading, load, create, update, remove, getByName };
}
