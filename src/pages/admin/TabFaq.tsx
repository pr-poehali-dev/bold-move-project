import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { FaqItem } from "./types";

interface Props { token: string; }

export default function TabFaq({ token }: Props) {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: "", content: "" });

  const load = useCallback(async () => {
    const cached = sessionStorage.getItem("adm_faq");
    if (cached) { setItems(JSON.parse(cached)); return; }
    setLoading(true);
    const r = await apiFetch("faq");
    if (r.ok) { const d = await r.json(); setItems(d.items); sessionStorage.setItem("adm_faq", JSON.stringify(d.items)); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (item: FaqItem) => {
    await apiFetch("faq", { method: "PUT", body: JSON.stringify(item) }, token, item.id);
    setEditing(null); load();
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить запись?")) return;
    await apiFetch("faq", { method: "DELETE" }, token, id); load();
  };

  const add = async () => {
    if (!newItem.title.trim() || !newItem.content.trim()) return;
    await apiFetch("faq", { method: "POST", body: JSON.stringify(newItem) }, token);
    setNewItem({ title: "", content: "" }); setAdding(false); load();
  };

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-white/50 text-sm">AI читает эти записи при каждом вопросе клиента для точных ответов.</p>

      <div className="flex flex-col gap-3">
        {items.map(item => (
          <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
            {editing?.id === item.id ? (
              <div className="flex flex-col gap-3">
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500"
                  placeholder="Название" />
                <textarea value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })}
                  rows={6}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-y outline-none focus:border-violet-500" />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-white/60 cursor-pointer">
                    <input type="checkbox" checked={editing.used} onChange={e => setEditing({ ...editing, used: e.target.checked })} />
                    Активна
                  </label>
                  <button onClick={() => save(editing)} className="ml-auto bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Сохранить</button>
                  <button onClick={() => setEditing(null)} className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.used ? "bg-green-400" : "bg-white/20"}`} />
                    <span className="font-medium text-sm">{item.title}</span>
                  </div>
                  <p className="text-white/40 text-xs line-clamp-2">{item.content}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setEditing(item)} className="text-white/30 hover:text-violet-400 p-1.5 transition"><Icon name="Pencil" size={15} /></button>
                  <button onClick={() => remove(item.id)} className="text-white/30 hover:text-red-400 p-1.5 transition"><Icon name="Trash2" size={15} /></button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding ? (
          <div className="bg-white/5 border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3">
            <input value={newItem.title} onChange={e => setNewItem(p => ({ ...p, title: e.target.value }))}
              placeholder="Название записи" autoFocus
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500" />
            <textarea value={newItem.content} onChange={e => setNewItem(p => ({ ...p, content: e.target.value }))}
              rows={5} placeholder="Содержимое..."
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-y outline-none focus:border-violet-500" />
            <div className="flex gap-2">
              <button onClick={add} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
              <button onClick={() => { setAdding(false); setNewItem({ title: "", content: "" }); }}
                className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60">
            <Icon name="Plus" size={16} /> Добавить запись
          </button>
        )}
      </div>
    </div>
  );
}