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

  const [threshold, setThreshold] = useState(0);
  const [thresholdSaving, setThresholdSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [cr, pr, st] = await Promise.all([apiFetch("corrections"), apiFetch("prices"), apiFetch("settings")]);
    if (cr.ok) { const d = await cr.json(); setItems(d.items); }
    if (pr.ok) { const d = await pr.json(); setPrices(d.items); }
    if (st.ok) { const d = await st.json(); setThreshold(parseInt(d.llm_threshold ?? "0")); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveThreshold = async (val: number) => {
    setThresholdSaving(true);
    await apiFetch("settings", { method: "PUT", body: JSON.stringify({ llm_threshold: val }) }, token);
    setThresholdSaving(false);
  };

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

      {/* Ползунок LLM / Авторасчёт */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="SlidersHorizontal" size={14} className="text-white/40" />
            <span className="text-xs text-white/60 font-medium">Режим расчёта</span>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            threshold === 0 ? "bg-blue-500/20 text-blue-300"
            : threshold === 100 ? "bg-green-500/20 text-green-300"
            : "bg-violet-500/20 text-violet-300"
          }`}>
            {threshold < 100 ? `LLM для сложных (${threshold})` : "Всё в Авторасчёт"}
          </span>
        </div>
        <input
          type="range" min={0} max={100} step={10}
          value={threshold}
          onChange={e => setThreshold(parseInt(e.target.value))}
          onMouseUp={e => saveThreshold(parseInt((e.target as HTMLInputElement).value))}
          onTouchEnd={e => saveThreshold(parseInt((e.target as HTMLInputElement).value))}
          className="w-full accent-violet-500 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-white/25">
          <span>← Сложные → LLM</span>
          <span className="text-violet-400/60">{thresholdSaving ? "Сохраняю..." : ""}</span>
          <span>Всё в Авторасчёт →</span>
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