import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "@/pages/admin/crm/crmApi";

// Суммы кастомных статей затрат/доходов (Откат, Логистика и т.д.) по конкретному заказу.
// Хранятся в БД (client_custom_fin_values) — общие для всех сотрудников компании.
export function useCustomFinValues(clientId: number) {
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await crmFetch("custom-fin-values", undefined, { client_id: String(clientId) });
      setValues(data && typeof data === "object" ? data as Record<string, number | null> : {});
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const saveValue = useCallback(async (rowKey: string, value: string) => {
    const numVal = value === "" ? null : Number(value);
    setValues(prev => ({ ...prev, [rowKey]: numVal }));
    await crmFetch("custom-fin-values", {
      method: "POST",
      body: JSON.stringify({ row_key: rowKey, value: numVal }),
    }, { client_id: String(clientId) });
  }, [clientId]);

  return { values, loading, saveValue, reload: load };
}
