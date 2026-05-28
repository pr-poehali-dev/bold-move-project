import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { QuickQuestion } from "./types";

interface Props { token: string; isDark?: boolean; readOnly?: boolean; }

export default function FaqQuestionsTab({ token, isDark = true, readOnly = false }: Props) {
  const bg     = isDark ? "bg-white/5"      : "bg-white";
  const border = isDark ? "border-white/10"  : "border-gray-200";
  const text   = isDark ? "text-white"       : "text-gray-900";
  const muted  = isDark ? "text-white/40"    : "text-gray-500";

  const [items,   setItems]   = useState<QuickQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<QuickQuestion | null>(null);
  const [adding,  setAdding]  = useState(false);
  const [newItem, setNewItem] = useState({ pattern: "", answer: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch("questions", undefined, token);
    if (r.ok) { const d = await r.json(); setItems(d.items ?? []); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async (item: QuickQuestion) => {
    await apiFetch("questions", { method: "PUT", body: JSON.stringify(item) }, token, item.id);
    setEditing(null); load();
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить?")) return;
    await apiFetch("questions", { method: "DELETE" }, token, id); load();
  };

  const add = async () => {
    if (!newItem.pattern.trim() || !newItem.answer.trim()) return;
    await apiFetch("questions", { method: "POST", body: JSON.stringify({ ...newItem, active: true }) }, token);
    setNewItem({ pattern: "", answer: "" }); setAdding(false); load();
  };

  if (loading) return <p className={`${muted} text-sm`}>Загрузка...</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className={`${muted} text-sm`}>Шаблоны вопросов и готовые ответы для быстрой реакции бота.</p>
      <div className="flex flex-col gap-3">
        {items.map(item => (
          <div key={item.id} className={`${bg} border ${border} rounded-xl p-4`}>
            {editing?.id === item.id ? (
              <div className="flex flex-col gap-3">
                <input value={editing.pattern} onChange={e => setEditing({ ...editing, pattern: e.target.value })}
                  className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`}
                  placeholder="Шаблон вопроса" />
                <textarea value={editing.answer} onChange={e => setEditing({ ...editing, answer: e.target.value })}
                  rows={4}
                  className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm resize-y outline-none focus:border-violet-500`}
                  placeholder="Готовый ответ" />
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-1.5 text-sm ${muted} cursor-pointer`}>
                    <input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                    Активен
                  </label>
                  <button onClick={() => save(editing)} className="ml-auto bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Сохранить</button>
                  <button onClick={() => setEditing(null)} className={`${muted} text-sm`}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.active ? "bg-green-400" : isDark ? "bg-white/20" : "bg-gray-300"}`} />
                    <span className={`font-medium text-sm ${text}`}>{item.pattern}</span>
                  </div>
                  <p className={`${muted} text-xs line-clamp-2`}>{item.answer}</p>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditing(item)} className={`${isDark ? "text-white/30" : "text-gray-300"} hover:text-violet-400 p-1.5 transition`}><Icon name="Pencil" size={15} /></button>
                    <button onClick={() => remove(item.id)} className={`${isDark ? "text-white/30" : "text-gray-300"} hover:text-red-400 p-1.5 transition`}><Icon name="Trash2" size={15} /></button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {!readOnly && adding ? (
          <div className={`${bg} border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3`}>
            <input value={newItem.pattern} onChange={e => setNewItem(p => ({ ...p, pattern: e.target.value }))}
              placeholder="Шаблон вопроса" autoFocus
              className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`} />
            <textarea value={newItem.answer} onChange={e => setNewItem(p => ({ ...p, answer: e.target.value }))}
              rows={4} placeholder="Готовый ответ"
              className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm resize-y outline-none focus:border-violet-500`} />
            <div className="flex gap-2">
              <button onClick={add} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
              <button onClick={() => { setAdding(false); setNewItem({ pattern: "", answer: "" }); }} className={`${muted} text-sm`}>Отмена</button>
            </div>
          </div>
        ) : (
          !readOnly && (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60">
              <Icon name="Plus" size={16} /> Добавить ответ
            </button>
          )
        )}
      </div>
    </div>
  );
}
