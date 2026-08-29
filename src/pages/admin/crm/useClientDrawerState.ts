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

  // Возвращают true — сохранилось; false — сервер отклонил (например, статус
  // требовал дату, прав не хватило и т.п.). При ошибке локальное изменение
  // откатывается — иначе экран показывал бы то, что на деле не сохранилось
  // (именно так пропадал переход статуса: карточка "переключалась" визуально,
  // а на сервере запрос падал молча).
  //
  // Ответ сервера может содержать status/sub_status, дополненные им самим —
  // например, при переводе на «Замер» без даты backend сам подставляет
  // подэтап «Дата замера не назначена» (см. crm-manager). Патч, отправленный
  // отсюда, этого поля не содержит, поэтому без учёта ответа сервера экран
  // держал бы «голый» системный статус и не показывал реально сохранённый
  // подэтап, пока карточку не перезагрузят.
  const save = async (patch: Partial<Client>): Promise<boolean> => {
    const prev = data;
    setData(p => ({ ...p, ...patch }));
    if (isLocalCard) return true;
    setSaving(true);
    const res = await crmFetch("clients", { method: "PUT", body: JSON.stringify(patch) }, { id: String(data.id) }) as { error?: string; status?: string; sub_status?: string | null };
    setSaving(false);
    if (res?.error) {
      setData(prev);
      return false;
    }
    const serverExtra: Partial<Client> = {};
    if (res.status !== undefined) serverExtra.status = res.status;
    if (res.sub_status !== undefined) serverExtra.sub_status = res.sub_status;
    if (Object.keys(serverExtra).length > 0) setData(p => ({ ...p, ...serverExtra }));
    onUpdated();
    return true;
  };

  const saveOrder = async (patch: Partial<Client>): Promise<boolean> => {
    const prev = orderData;
    setOrderData(p => ({ ...p, ...patch }));
    if (isLocalCard) return true;
    setSaving(true);
    const res = await crmFetch("clients", { method: "PUT", body: JSON.stringify(patch) }, { id: String(orderData.id) }) as { error?: string; status?: string; sub_status?: string | null };
    setSaving(false);
    if (res?.error) {
      setOrderData(prev);
      return false;
    }
    const serverExtra: Partial<Client> = {};
    if (res.status !== undefined) serverExtra.status = res.status;
    if (res.sub_status !== undefined) serverExtra.sub_status = res.sub_status;
    if (Object.keys(serverExtra).length > 0) setOrderData(p => ({ ...p, ...serverExtra }));
    onUpdated();
    return true;
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