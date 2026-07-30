import { useState, useEffect } from "react";
import { Client } from "./crmApi";

// Открыть заявку из URL (?order=) или из календаря, + открыть модалку новой заявки
// при переходе из проектов конструктора (?new_order=1&link_project_id=...).
export function useOrdersUrlParams(
  allClients: Client[],
  initialOrderId: number | null | undefined,
  setSelected: (c: Client | null) => void,
) {
  const [initialHandled, setInitialHandled] = useState(false);
  useEffect(() => {
    if (!initialOrderId || allClients.length === 0 || initialHandled) return;
    const found = allClients.find(c => c.id === initialOrderId);
    if (found) {
      setSelected(found);
      setInitialHandled(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("order");
      window.history.replaceState({}, "", url.toString());
    }
  }, [initialOrderId, allClients, initialHandled, setSelected]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newOrderLinkProjectId, setNewOrderLinkProjectId] = useState<number | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("new_order") === "1") {
      const pid = sp.get("link_project_id");
      if (pid) setNewOrderLinkProjectId(Number(pid));
      setShowAddModal(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("new_order");
      url.searchParams.delete("link_project_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return { showAddModal, setShowAddModal, newOrderLinkProjectId, setNewOrderLinkProjectId };
}
