import { useState } from "react";
import { crmFetch, STATUS_COLORS, Client } from "./crmApi";
import { DrawerTabId } from "./DrawerTabsBar";

// Состояние и бизнес-логика карточки клиента: сохранение вкладки "Клиент",
// сохранение выбранной заявки, удаление, заголовок/цвет шапки.
export function useClientDrawerState(
  client: Client,
  allClientOrders: Client[],
  isLocalCard: boolean | undefined,
  defaultTab: "client" | "orders" | "touches",
  defaultOrderId: number | undefined,
  contactMode: boolean,
  onUpdated: () => void,
  onDeleted: (deletedId: number) => void,
) {
  const [data, setData]               = useState<Client>(client);
  const [saving, setSaving]           = useState(false);
  const [drawerTab, setDrawerTab]     = useState<DrawerTabId>(defaultTab as "client" | "orders" | "plan" | "touches");
  const [selectedOrderId, setSelectedOrderId] = useState<number>(defaultOrderId ?? client.id);
  const [orderData, setOrderData] = useState<Client>(
    allClientOrders.find(o => o.id === selectedOrderId) ?? allClientOrders[0] ?? data
  );

  const save = async (patch: Partial<Client>) => {
    setData(prev => ({ ...prev, ...patch }));
    if (isLocalCard) return;
    setSaving(true);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify(patch) }, { id: String(data.id) });
    setSaving(false);
    onUpdated();
  };

  const saveOrder = async (patch: Partial<Client>) => {
    setOrderData(prev => ({ ...prev, ...patch }));
    if (isLocalCard) return;
    setSaving(true);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify(patch) }, { id: String(orderData.id) });
    setSaving(false);
    onUpdated();
  };

  const ord = drawerTab === "orders" ? orderData : data;

  const handleDelete = async () => {
    const targetId = ord.id;
    if (!isLocalCard) {
      await crmFetch("clients", { method: "DELETE" }, { id: String(targetId) });
    }
    onDeleted(targetId);
  };

  const lsKey = `order_title_${ord.id}`;
  const customTitle = localStorage.getItem(lsKey);
  const orderTitle = contactMode
    ? (data.client_name || "Клиент без имени")
    : (customTitle || `Заявка №${ord.id}`);
  const displayColor = STATUS_COLORS[ord.status] || "#8b5cf6";

  return {
    data, setData, saving, drawerTab, setDrawerTab,
    selectedOrderId, setSelectedOrderId, orderData, setOrderData,
    save, saveOrder, ord, handleDelete, lsKey, orderTitle, displayColor,
  };
}
