import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { BotCorrection, PriceItem } from "./types";

interface Props { token: string; }

export default function TabCorrections({ token }: Props) {
  const [items, setItems] = useState<BotCorrection[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cr, pr] = await Promise.all([
      apiFetch("corrections"),
      apiFetch("prices"),
    ]);
    if (cr.ok) { const d = await cr.json(); setItems(d.items); }
    if (pr.ok) { const d = await pr.json(); setPrices(d.items); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id: number, status: string, corrected_json?: Record<string, unknown>) => {
    await apiFetch("corrections", {
      method: "PUT",
      body: JSON.stringify({ id, status, corrected_json }),
    }, token, id);
    setItems(prev => prev.map(c => c.id === id ? { ...c, status: status as BotCorrection["status"], corrected_json: corrected_json ?? c.corrected_json } : c));
  };

  const pending = items.filter(i => i.status === "pending");
  const reviewed = items.filter(i => i.status !== "pending");

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  const renderCard = (item: BotCorrection) => {
    const recognized = item.recognized_json as Record<string, unknown> | null;
    const isExpanded = expandedId === item.id;

    return (
      <div key={item.id} className={`bg-white/[0.03] border rounded-xl p-4 flex flex-col gap-3 ${item.status === "pending" ? "border-amber-500/30" : item.status === "approved" ? "border-green-500/20" : "border-white/10"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.status === "pending" ? "bg-amber-500/20 text-amber-300" : item.status === "approved" ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/40"}`}>
                {item.status === "pending" ? "Ожидает" : item.status === "approved" ? "Одобрено" : "Отклонено"}
              </span>
              <span className="text-white/30 text-xs">{new Date(item.created_at).toLocaleString("ru")}</span>
            </div>
            <p className="text-white text-sm font-medium">«{item.user_text}»</p>
          </div>
          <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="text-white/30 hover:text-white/60 transition mt-1">
            <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} />
          </button>
        </div>

        {recognized && (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(recognized).filter(([, v]) => v !== null && v !== false && v !== 0).map(([k, v]) => {
              const price = prices.find(p => p.name === k || k.includes(String(p.id)));
              return (
                <div key={k} className="bg-white/[0.03] rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-white/40 text-xs truncate">{price?.name ?? k}</span>
                  <span className="text-violet-300 text-xs font-mono ml-auto">{String(v)}</span>
                </div>
              );
            })}
          </div>
        )}

        {isExpanded && item.status === "pending" && (
          <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
            <p className="text-white/40 text-xs">Что распознал бот (JSON):</p>
            <pre className="text-xs text-green-400/80 bg-black/20 rounded-lg p-3 overflow-x-auto max-h-40">
              {JSON.stringify(item.recognized_json, null, 2)}
            </pre>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => update(item.id, "approved")}
                className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-sm py-2 rounded-lg transition flex items-center justify-center gap-1.5">
                <Icon name="Check" size={14} /> Верно, запомнить
              </button>
              <button
                onClick={() => update(item.id, "rejected")}
                className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm py-2 rounded-lg transition flex items-center justify-center gap-1.5">
                <Icon name="X" size={14} /> Неверно, пропустить
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
        <Icon name="GraduationCap" size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <span className="text-amber-300 font-medium">Обучение бота.</span>
          <span className="text-white/50 ml-1">Здесь попадают запросы клиентов, которые бот не смог точно распознать. Одобряйте правильные — бот запомнит синонимы автоматически.</span>
        </div>
      </div>

      {pending.length === 0 && reviewed.length === 0 && (
        <p className="text-white/30 text-sm text-center py-8">Пока нет запросов для проверки</p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-amber-300 text-xs font-semibold uppercase tracking-wider">Ожидают проверки ({pending.length})</h3>
          {pending.map(renderCard)}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-white/30 text-xs font-semibold uppercase tracking-wider">Проверенные ({reviewed.length})</h3>
          {reviewed.map(renderCard)}
        </div>
      )}
    </div>
  );
}
