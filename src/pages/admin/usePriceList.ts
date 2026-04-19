import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "./api";
import type { PriceItem } from "./types";

export function usePriceList(token: string) {
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null);
  const [aiDescLoadingId, setAiDescLoadingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch("prices");
    if (r.ok) { const d = await r.json(); setPrices(d.items); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveField = async (item: PriceItem, field: keyof PriceItem, val: string) => {
    const updated = { ...item, [field]: field === "price" ? parseInt(val) || 0 : val };
    await apiFetch("prices", { method: "PUT", body: JSON.stringify(updated) }, token, item.id);
    setPrices(prev => prev.map(p => p.id === item.id ? updated : p));
  };

  const toggleActive = async (item: PriceItem) => {
    const updated = { ...item, active: !item.active };
    await apiFetch("prices", { method: "PUT", body: JSON.stringify(updated) }, token, item.id);
    setPrices(prev => prev.map(p => p.id === item.id ? updated : p));
  };

  const addItem = async (
    category: string, name: string, price: string, unit: string, description: string,
    onAdded?: (name: string) => void
  ) => {
    const r = await apiFetch("prices", {
      method: "POST",
      body: JSON.stringify({ category, name, price: parseInt(price) || 0, unit, description, synonyms: "" }),
    }, token);
    if (r.ok) {
      await load();
      onAdded?.(name);
    }
  };

  const deleteItem = async (id: number) => {
    await apiFetch("prices", { method: "DELETE" }, token, id);
    setPrices(prev => prev.filter(p => p.id !== id));
  };

  const renameCategory = async (oldName: string, newName: string) => {
    const r = await apiFetch("prices&rename_category", {
      method: "PUT",
      body: JSON.stringify({ old_name: oldName, new_name: newName }),
    }, token);
    if (r.ok) setPrices(prev => prev.map(p => p.category === oldName ? { ...p, category: newName } : p));
  };

  const generateSynonyms = async (item: PriceItem) => {
    setAiLoadingId(item.id);
    try {
      const r = await apiFetch("match-synonym", {
        method: "POST",
        body: JSON.stringify({
          word: `GENERATE_SYNONYMS:${item.name}|${item.description || ""}|${item.category}`,
          prices: [],
        }),
      }, token);
      if (r.ok) {
        const d = await r.json();
        if (d.synonyms) {
          const existing = item.synonyms ? item.synonyms.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
          const newSyns = d.synonyms.split(",").map((s: string) => s.trim()).filter((s: string) => s && !existing.includes(s));
          const merged = [...existing, ...newSyns].join(", ");
          await saveField(item, "synonyms", merged);
        }
      }
    } finally {
      setAiLoadingId(null);
    }
  };

  const generateDescription = async (item: PriceItem) => {
    setAiDescLoadingId(item.id);
    try {
      const r = await apiFetch("match-synonym", {
        method: "POST",
        body: JSON.stringify({
          word: `GENERATE_DESCRIPTION:${item.name}|${item.category}`,
          prices: [],
        }),
      }, token);
      if (r.ok) {
        const d = await r.json();
        if (d.description) await saveField(item, "description", d.description);
      }
    } finally {
      setAiDescLoadingId(null);
    }
  };

  const moveItem = async (item: PriceItem, target: PriceItem) => {
    if (item.id === target.id) return;
    // Переставляем sort_order местами
    const newOrderA = target.sort_order;
    const newOrderB = item.sort_order;
    await Promise.all([
      apiFetch("prices", { method: "PUT", body: JSON.stringify({ ...item, sort_order: newOrderA }) }, token, item.id),
      apiFetch("prices", { method: "PUT", body: JSON.stringify({ ...target, sort_order: newOrderB }) }, token, target.id),
    ]);
    setPrices(prev => prev.map(p => {
      if (p.id === item.id) return { ...p, sort_order: newOrderA };
      if (p.id === target.id) return { ...p, sort_order: newOrderB };
      return p;
    }));
  };

  const byCategory = prices.reduce<Record<string, PriceItem[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const byCategorySorted = Object.fromEntries(
    Object.entries(byCategory).map(([cat, items]) => [
      cat,
      [...items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    ])
  );

  return {
    prices, loading, aiLoadingId, aiDescLoadingId, byCategory: byCategorySorted,
    load, saveField, toggleActive, addItem, deleteItem, renameCategory,
    generateSynonyms, generateDescription, moveItem,
  };
}