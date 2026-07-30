import { Client } from "./crmApi";

// Общий текстовый поиск заявки по имени клиента / телефону / адресу / номеру заявки.
// Используется и в списке заявок (OrdersListView), и в канбане (OrdersKanbanView).
export function matchesOrderSearch(c: Client, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (c.client_name || "").toLowerCase().includes(q) ||
    (c.phone || "").includes(q) ||
    (c.address || "").toLowerCase().includes(q) ||
    String(c.id).includes(q)
  );
}

export function filterOrdersBySearch(list: Client[], query: string): Client[] {
  if (!query) return list;
  return list.filter(c => matchesOrderSearch(c, query));
}
