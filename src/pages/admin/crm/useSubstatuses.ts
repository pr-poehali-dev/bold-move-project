import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "./crmApi";
import { Substatus } from "./ordersTabsShared";

export function useSubstatuses() {
  const [substatuses, setSubstatuses] = useState<Substatus[]>([]);

  const load = useCallback(async () => {
    const data = await crmFetch("substatuses") as Substatus[];
    setSubstatuses(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { substatuses, setSubstatuses };
}
