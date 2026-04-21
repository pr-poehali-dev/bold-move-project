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

  // Запись со сметой — LLM ответил и есть llm_answer с расчётом
  const hasEstimate = (i: BotCorrection) => {
    if (!i.llm_answer) return false;
    const d = i.recognized_json as Record<string, unknown> | null;
    const isLLM = !d || "reason" in (d ?? {});
    return isLLM;
  };

  // Синонимы из прайса для проверки isKnown
  const knownSynonyms = new Set(
    prices.flatMap(p => {
      const syns = p.synonyms ? p.synonyms.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : [];
      return [p.name.toLowerCase(), ...syns];
    })
  );
  const isKnown = (w: string) => {
    const wl = w.toLowerCase();
    return knownSynonyms.has(wl) || [...knownSynonyms].some(s => s === wl || s.includes(wl) || wl.includes(s));
  };

  // Получить список unknown слов для записи
  const getUnknownWords = (i: BotCorrection): string[] => {
    const d = i.recognized_json as { unknown_word?: string | null; unknown_words?: string[] } | null;
    const base = d?.unknown_words?.length ? d.unknown_words : d?.unknown_word ? [d.unknown_word] : [];
    const extra = extraWords[i.id] ?? [];
    return [
      ...base.filter(w => !extra.some(e => e.includes(w) && e !== w)),
      ...extra,
    ];
  };

  // Все слова карточки обработаны — в doneWords или isKnown
  const allWordsResolved = (i: BotCorrection): boolean => {
    const words = getUnknownWords(i);
    if (words.length === 0) return true;
    const done = doneWords[i.id] ?? [];
    return words.every(w => done.includes(w) || isKnown(w));
  };

  // Бот не понял — есть нераспознанные слова
  const hasUnknownWords = (i: BotCorrection) => {
    const d = i.recognized_json as { unknown_word?: string | null; unknown_words?: string[] } | null;
    return (d?.unknown_words?.length ?? 0) > 0 || !!d?.unknown_word;
  };

  // "Нужно обучить" — есть смета, есть unknown слова, и НЕ все обработаны
  const needsTraining = items.filter(i =>
    i.status === "pending" && hasEstimate(i) && hasUnknownWords(i) && !allWordsResolved(i)
  );

  // "Всё понятно LLM" — нет unknown слов, или все слова уже обработаны
  const allGood = items.filter(i =>
    i.status === "pending" && hasEstimate(i) && (!hasUnknownWords(i) || allWordsResolved(i))
  );

  // Проверенные (для совместимости)
  const pending = needsTraining;
  const reviewed = items.filter(i => i.status !== "pending" && hasEstimate(i));

  return {
    items, prices, loading,
    pending, reviewed,
    needsTraining, allGood,
    expandedId, setExpandedId,
    doneWords, extraWords,
    setItemDoneWords, setItemExtraWords,
    update, remove,
  };
}