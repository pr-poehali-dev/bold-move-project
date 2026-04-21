import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "./api";
import { STORAGE_KEYS } from "./constants";
import type { BotCorrection, PriceItem } from "./types";

function readStorage<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}

export function useCorrectionsList(token: string) {
  const [items, setItems] = useState<BotCorrection[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [doneWords, setDoneWords] = useState<Record<number, string[]>>(() =>
    readStorage(STORAGE_KEYS.DONE_WORDS, {})
  );
  const [extraWords, setExtraWords] = useState<Record<number, string[]>>(() =>
    readStorage(STORAGE_KEYS.EXTRA_WORDS, {})
  );

  const persistDoneWords = (fn: (prev: Record<number, string[]>) => Record<number, string[]>) => {
    setDoneWords(prev => {
      const next = fn(prev);
      localStorage.setItem(STORAGE_KEYS.DONE_WORDS, JSON.stringify(next));
      return next;
    });
  };

  const persistExtraWords = (fn: (prev: Record<number, string[]>) => Record<number, string[]>) => {
    setExtraWords(prev => {
      const next = fn(prev);
      localStorage.setItem(STORAGE_KEYS.EXTRA_WORDS, JSON.stringify(next));
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [cr, pr] = await Promise.all([apiFetch("corrections"), apiFetch("prices")]);
    if (cr.ok) { const d = await cr.json(); setItems(d.items); }
    if (pr.ok) { const d = await pr.json(); setPrices(d.items); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id: number, status: string) => {
    await apiFetch("corrections", { method: "PUT", body: JSON.stringify({ id, status }) }, token, id);
    setItems(prev => prev.map(c => c.id === id ? { ...c, status: status as BotCorrection["status"] } : c));
    setExpandedId(null);
  };

  const remove = async (id: number) => {
    await apiFetch("corrections", { method: "DELETE", body: JSON.stringify({ id }) }, token, id);
    setItems(prev => prev.filter(c => c.id !== id));
  };

  const setItemDoneWords = (id: number, words: string[]) =>
    persistDoneWords(prev => ({ ...prev, [id]: words }));

  const setItemExtraWords = (id: number, words: string[]) =>
    persistExtraWords(prev => ({ ...prev, [id]: words }));

  // Нужны только LLM-записи где бот реально чего-то не понял (есть нераспознанные слова)
  // Исключаем: авторасчёт, уточняющие вопросы без сметы, записи без unknown_words
  const isTrainable = (i: BotCorrection) => {
    const d = i.recognized_json as Record<string, unknown> | null;
    const isLLM = !d || "reason" in (d ?? {});
    if (!isLLM) return false; // авторасчёт — не нужен
    const skipInfo = d as { unknown_word?: string | null; unknown_words?: string[] } | null;
    const hasUnknown = (skipInfo?.unknown_words?.length ?? 0) > 0 || !!skipInfo?.unknown_word;
    return hasUnknown; // только те где есть нераспознанные слова
  };

  const pending = items.filter(i => i.status === "pending" && isTrainable(i));
  const reviewed = items.filter(i => i.status !== "pending" && isTrainable(i));

  return {
    items, prices, loading,
    pending, reviewed,
    expandedId, setExpandedId,
    doneWords, extraWords,
    setItemDoneWords, setItemExtraWords,
    update, remove,
  };
}