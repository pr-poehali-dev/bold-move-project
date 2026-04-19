import { useState, useEffect } from "react";
import { apiFetch } from "./api";
import { parseBundle, addSynonym } from "./utils";
import { PRICE_UNITS, DEFAULT_CATEGORY } from "./constants";
import type { PriceItem } from "./types";

export type RowMode = "ai-loading" | "found" | "notfound-manual";

export interface WordRow {
  word: string;
  edited: string;
  mode: RowMode;
  selectedId: number | null;
  manualOpen: boolean;
  newName: string;
  newPrice: string;
  newUnit: string;
  newCategory: string;
  createMode: boolean;
  bundleIds: number[];
  bundleSearch: string;
  bundleOpen: boolean;
}

function makeRow(word: string, defaultCategory: string, manualOpen: boolean): WordRow {
  return {
    word, edited: word, mode: "ai-loading",
    selectedId: null, manualOpen,
    newName: word, newPrice: "", newUnit: PRICE_UNITS[0],
    newCategory: defaultCategory, createMode: false,
    bundleIds: [], bundleSearch: "", bundleOpen: false,
  };
}

export function useWordMatching(words: string[], prices: PriceItem[], token: string) {
  const categories = [...new Set(prices.map(p => p.category))];
  const defaultCategory = categories[0] ?? DEFAULT_CATEGORY;
  const autoOpen = words.length === 1;

  const [rows, setRows] = useState<WordRow[]>(() =>
    words.map(w => makeRow(w, defaultCategory, autoOpen))
  );

  const updateRow = (i: number, patch: Partial<WordRow>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const matchOne = async (i: number, currentRows: WordRow[]) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, mode: "ai-loading" } : r));
    try {
      const r = await apiFetch("match-synonym", {
        method: "POST",
        body: JSON.stringify({
          word: currentRows[i].edited,
          prices: prices.map(p => ({ id: p.id, name: p.name, category: p.category, synonyms: p.synonyms })),
        }),
      }, token);
      if (r.ok) {
        const data = await r.json();
        if (data.matched_id && data.matched_id !== 0) {
          const matched = prices.find(p => p.id === data.matched_id);
          const existingBundle = matched ? parseBundle(matched as PriceItem & { bundle?: string }) : [];
          setRows(prev => prev.map((r, idx) => idx === i
            ? { ...r, mode: "found", selectedId: data.matched_id, bundleIds: existingBundle }
            : r));
        } else {
          setRows(prev => prev.map((r, idx) => idx === i
            ? { ...r, mode: "notfound-manual", manualOpen: true, createMode: true }
            : r));
        }
      } else {
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, mode: "notfound-manual", manualOpen: true } : r));
      }
    } catch {
      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, mode: "notfound-manual", manualOpen: true } : r));
    }
  };

  const rematchAll = () => {
    setRows(prev => {
      prev.forEach((_, i) => matchOne(i, prev));
      return prev;
    });
  };

  useEffect(() => {
    const initial = words.map(w => makeRow(w, defaultCategory, autoOpen));
    words.forEach((_, i) => matchOne(i, initial));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAll = async (onAdded: (name: string) => void, saving: (v: boolean) => void) => {
    saving(true);
    const savedNames: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.mode === "found" && row.selectedId) {
        const price = prices.find(p => p.id === row.selectedId) as (PriceItem & { bundle?: string; calc_rule?: string }) | undefined;
        if (!price) continue;
        const updatedSynonyms = addSynonym(price.synonyms, row.edited);
        await apiFetch("prices", {
          method: "PUT",
          body: JSON.stringify({ ...price, synonyms: updatedSynonyms, bundle: JSON.stringify(row.bundleIds) }),
        }, token, price.id);
        savedNames.push(price.name);
      } else if (row.mode === "notfound-manual") {
        if (row.createMode && row.newName.trim()) {
          const name = row.newName.trim();
          const syn = row.edited.trim() !== name ? row.edited.trim() : "";
          const r = await apiFetch("prices", {
            method: "POST",
            body: JSON.stringify({
              name, category: row.newCategory || defaultCategory,
              price: parseInt(row.newPrice) || 0, unit: row.newUnit,
              description: "", synonyms: syn,
            }),
          }, token);
          if (r.ok) {
            const created = await r.json();
            if (row.bundleIds.length > 0 && created.id) {
              await apiFetch("prices", {
                method: "PUT",
                body: JSON.stringify({
                  id: created.id, name, category: row.newCategory || defaultCategory,
                  price: parseInt(row.newPrice) || 0, unit: row.newUnit,
                  description: "", synonyms: syn, active: true,
                  bundle: JSON.stringify(row.bundleIds), calc_rule: "",
                }),
              }, token, created.id);
            }
            savedNames.push(name);
          }
        } else if (!row.createMode && row.selectedId) {
          const price = prices.find(p => p.id === row.selectedId) as (PriceItem & { bundle?: string; calc_rule?: string }) | undefined;
          if (!price) continue;
          const updatedSynonyms = addSynonym(price.synonyms, row.edited);
          await apiFetch("prices", {
            method: "PUT",
            body: JSON.stringify({ ...price, synonyms: updatedSynonyms, bundle: JSON.stringify(row.bundleIds) }),
          }, token, price.id);
          savedNames.push(price.name);
        }
      }
    }
    saving(false);
    if (savedNames.length > 0) onAdded(savedNames[0]);
  };

  return { rows, updateRow, matchOne, rematchAll, saveAll, categories, defaultCategory };
}
