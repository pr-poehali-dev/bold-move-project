import { Client } from "./crmApi";

// Оставляем только цифры — чтобы тире/скобки/пробелы в номере (или в запросе)
// не мешали поиску: "+7-999-123-45-67" и "79991234567" должны находить друг друга.
export function normalizePhone(s: string): string {
  return (s || "").replace(/\D/g, "");
}

// Общий текстовый поиск заявки по имени клиента / телефону / адресу / номеру заявки.
// Используется и в списке заявок (OrdersListView), и в канбане (OrdersKanbanView).
export function matchesOrderSearch(c: Client, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const qDigits = normalizePhone(query);
  return (
    (c.client_name || "").toLowerCase().includes(q) ||
    (qDigits.length > 0 && normalizePhone(c.phone || "").includes(qDigits)) ||
    (c.address || "").toLowerCase().includes(q) ||
    String(c.id).includes(q)
  );
}

export function filterOrdersBySearch(list: Client[], query: string): Client[] {
  if (!query) return list;
  return list.filter(c => matchesOrderSearch(c, query));
}