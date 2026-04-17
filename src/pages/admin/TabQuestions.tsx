import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { QuickQuestion } from "./types";

interface Props { token: string; }

export default function TabQuestions({ token }: Props) {
  const [items, setItems] = useState<QuickQuestion[]>([]);
  const [editing, setEditing] = useState<QuickQuestion | null>(null);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ pattern: "", answer: "" });

  const load = useCallback(async () => {
    const r = await apiFetch("questions");
    if (r.ok) { const d = await r.json(); setItems(d.items); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (q: QuickQuestion) => {
    await apiFetch("questions", { method: "PUT", body: JSON.stringify(q) }, token, q.id);
    setEditing(null); load();
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить вопрос?")) return;
    await apiFetch("questions", { method: "DELETE" }, token, id); load();
  };

  const add = async () => {
    if (!newItem.pattern.trim() || !newItem.answer.trim()) return;
    await apiFetch("questions", { method: "POST", body: JSON.stringify(newItem) }, token);
    setNewItem({ pattern: "", answer: "" }); setAdding(false); load();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-white/50 text-sm">Когда клиент пишет ключевые слова — AI отвечает мгновенно, без нейросети. Паттерн — регулярное выражение.</p>

      <div className="flex flex-col gap-3">
        {items.map(q => (
          <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
            {editing?.id === q.id ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Паттерн (ключевые слова)</label>
                  <input value={editing.pattern} onChange={e => setEditing({ ...editing, pattern: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Ответ AI</label>
                  <textarea value={editing.answer} onChange={e => setEditing({ ...editing, answer: e.target.value })}
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-y outline-none focus:border-violet-500" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-white/60 cursor-pointer">
                    <input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                    Активен
                  </label>
                  <button onClick={() => save(editing)} className="ml-auto bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Сохранить</button>
                  <button onClick={() => setEditing(null)} className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${q.active ? "bg-green-400" : "bg-white/20"}`} />
                    <code className="text-violet-300 text-xs bg-violet-500/10 px-2 py-0.5 rounded truncate max-w-xs">{q.pattern}</code>
                  </div>
                  <p className="text-white/40 text-xs line-clamp-2">{q.answer}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setEditing(q)} className="text-white/30 hover:text-violet-400 p-1.5 transition"><Icon name="Pencil" size={15} /></button>
                  <button onClick={() => remove(q.id)} className="text-white/30 hover:text-red-400 p-1.5 transition"><Icon name="Trash2" size={15} /></button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding ? (
          <div className="bg-white/5 border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <label className="text-white/40 text-xs mb-1 block">Паттерн</label>
              <input value={newItem.pattern} onChange={e => setNewItem(p => ({ ...p, pattern: e.target.value }))}
                placeholder="(гарантия|срок службы)" autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1 block">Ответ</label>
              <textarea value={newItem.answer} onChange={e => setNewItem(p => ({ ...p, answer: e.target.value }))}
                rows={4} placeholder="Текст ответа AI..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-y outline-none focus:border-violet-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={add} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
              <button onClick={() => { setAdding(false); setNewItem({ pattern: "", answer: "" }); }}
                className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60">
            <Icon name="Plus" size={16} /> Добавить вопрос
          </button>
        )}
      </div>
    </div>
  );
}
