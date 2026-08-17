import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "@/pages/admin/crm/crmApi";

/** Статья расхода. kind определяет, какие доп. поля показывать в форме:
 *  ad_service / ad_budget — привязка к рекламному источнику,
 *  salary — поле сотрудника, general — без доп. полей. */
export type ExpenseKind = "ad_service" | "ad_budget" | "salary" | "general";

export interface ExpenseCategory {
  id: number;
  name: string;
  kind: ExpenseKind;
  color: string;
  sort_order: number;
}

export interface Expense {
  id: number;
  category_id: number | null;
  category_name: string;
  category_kind: ExpenseKind;
  category_color: string;
  source_id: number | null;
  source_name: string | null;
  employee: string | null;
  amount: number;
  spent_on: string | null;
  comment: string | null;
}

export interface ExpenseInput {
  category_id?: number | null;
  source_id?: number | null;
  employee?: string | null;
  amount: number;
  spent_on?: string;
  comment?: string | null;
}

export function useExpenses() {
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exp, cats] = await Promise.all([
        crmFetch("expenses") as Promise<Expense[]>,
        crmFetch("expense-categories") as Promise<ExpenseCategory[]>,
      ]);
      setExpenses(Array.isArray(exp) ? exp : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (input: ExpenseInput) => {
    await crmFetch("expenses", { method: "POST", body: JSON.stringify(input) });
    await load();
  };

  const update = async (id: number, patch: Partial<ExpenseInput>) => {
    await crmFetch("expenses", { method: "PUT", body: JSON.stringify({ id, ...patch }) }, { id: String(id) });
    await load();
  };

  const remove = async (id: number) => {
    await crmFetch("expenses", { method: "DELETE", body: JSON.stringify({ id }) }, { id: String(id) });
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const createCategory = async (name: string, kind: ExpenseKind = "general", color = "#f97316") => {
    const res = await crmFetch("expense-categories", {
      method: "POST", body: JSON.stringify({ name, kind, color }),
    }) as ExpenseCategory;
    setCategories(prev => [...prev, res]);
    return res;
  };

  const updateCategory = async (id: number, patch: Partial<Pick<ExpenseCategory, "name" | "kind" | "color" | "sort_order">>) => {
    await crmFetch("expense-categories", { method: "PUT", body: JSON.stringify({ id, ...patch }) }, { id: String(id) });
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const removeCategory = async (id: number) => {
    await crmFetch("expense-categories", { method: "DELETE", body: JSON.stringify({ id }) }, { id: String(id) });
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  return {
    expenses, categories, loading, load,
    create, update, remove,
    createCategory, updateCategory, removeCategory,
  };
}

export default useExpenses;
