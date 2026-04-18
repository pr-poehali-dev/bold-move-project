import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { BotCorrection, PriceItem } from "./types";
import CorrectionCard from "./CorrectionCard";

interface Props { token: string; }

export default function TabCorrections({ token }: Props) {
  const [items, setItems] = useState<BotCorrection[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [doneWords, setDoneWords] = useState<Record<number, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("corr_done") ?? "{}"); } catch { return {}; }
  });
  const [mergeFirst, setMergeFirst] = useState<{ corrId: number; word: string } | null>(null);
  const [extraWords, setExtraWords] = useState<Record<number, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("corr_extra") ?? "{}"); } catch { return {}; }
  });

  const setDoneWordsPersist = (fn: (prev: Record<number, string[]>) => Record<number, string[]>) => {
    setDoneWords(prev => {
      const next = fn(prev);
      localStorage.setItem("corr_done", JSON.stringify(next));
      return next;
    });
  };

  const setExtraWordsPersist = (fn: (prev: Record<number, string[]>) => Record<number, string[]>) => {
    setExtraWords(prev => {
      const next = fn(prev);
      localStorage.setItem("corr_extra", JSON.stringify(next));
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

  const pending = items.filter(i => i.status === "pending");
  const reviewed = items.filter(i => i.status !== "pending");

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
        <Icon name="GraduationCap" size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <span className="text-amber-300 font-medium">Обучение бота.</span>
          <span className="text-white/50 ml-1">Красным выделены слова которые бот не знает. Нажмите на слово → выберите позицию → бот запомнит синоним и в следующий раз распознает сам.</span>
        </div>
      </div>

      {pending.length === 0 && reviewed.length === 0 && (
        <p className="text-white/30 text-sm text-center py-8">Пока нет запросов</p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-amber-300 text-xs font-semibold uppercase tracking-wider">Ожидают проверки ({pending.length})</h3>
          {pending.map(item => (
            <CorrectionCard
              key={item.id}
              item={item}
              prices={prices}
              token={token}
              isExpanded={expandedId === item.id}
              onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onRemove={() => remove(item.id)}
              onUpdate={(status) => update(item.id, status)}
              doneWords={doneWords[item.id] ?? []}
              onDoneWordsChange={(words) => setDoneWordsPersist(prev => ({ ...prev, [item.id]: words }))}
              extraWords={extraWords[item.id] ?? []}
              onExtraWordsChange={(words) => setExtraWordsPersist(prev => ({ ...prev, [item.id]: words }))}
              mergeFirst={mergeFirst}
              onMergeFirstChange={setMergeFirst}
            />
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-white/30 text-xs font-semibold uppercase tracking-wider">Проверенные ({reviewed.length})</h3>
          {reviewed.map(item => (
            <CorrectionCard
              key={item.id}
              item={item}
              prices={prices}
              token={token}
              isExpanded={expandedId === item.id}
              onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onRemove={() => remove(item.id)}
              onUpdate={(status) => update(item.id, status)}
              doneWords={doneWords[item.id] ?? []}
              onDoneWordsChange={(words) => setDoneWordsPersist(prev => ({ ...prev, [item.id]: words }))}
              extraWords={extraWords[item.id] ?? []}
              onExtraWordsChange={(words) => setExtraWordsPersist(prev => ({ ...prev, [item.id]: words }))}
              mergeFirst={mergeFirst}
              onMergeFirstChange={setMergeFirst}
            />
          ))}
        </div>
      )}
    </div>
  );
}