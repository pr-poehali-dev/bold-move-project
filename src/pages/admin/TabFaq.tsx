import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { FaqItem, QuickQuestion } from "./types";

type FaqSub = "knowledge" | "questions";

interface Props { token: string; isDark?: boolean; readOnly?: boolean; }

export default function TabFaq({ token, isDark = true, readOnly = false }: Props) {
  const [sub, setSub] = useState<FaqSub>("knowledge");

  const SUB_TABS: { id: FaqSub; label: string; icon: string }[] = [
    { id: "knowledge", label: "Знания бота",    icon: "Database" },
    { id: "questions", label: "Быстрые ответы", icon: "MessageCircle" },
  ];

  const activeCls = isDark
    ? "bg-violet-600/15 text-violet-300 border-b-2 border-violet-500"
    : "bg-violet-600/10 text-violet-700 border-b-2 border-violet-600";
  const inactiveCls = isDark ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-800";

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Подвкладки */}
      <div className="flex gap-0.5 mb-5 flex-shrink-0"
        style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb"}` }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
              sub === t.id ? activeCls : inactiveCls
            }`}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {sub === "knowledge" && <KnowledgeTab token={token} isDark={isDark} readOnly={readOnly} />}
      {sub === "questions" && <QuestionsTab token={token} isDark={isDark} readOnly={readOnly} />}
    </div>
  );
}

/* ── Знания бота (бывший TabFaq) ─────────────────────────────────────────── */
function KnowledgeTab({ token, isDark = true, readOnly = false }: { token: string; isDark?: boolean; readOnly?: boolean }) {
  const bg     = isDark ? "bg-white/5"    : "bg-white";
  const border = isDark ? "border-white/10" : "border-gray-200";
  const text   = isDark ? "text-white"    : "text-gray-900";
  const muted  = isDark ? "text-white/40" : "text-gray-500";
  const [items,   setItems]   = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [adding,  setAdding]  = useState(false);
  const [newItem, setNewItem] = useState({ title: "", content: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch("faq");
    if (r.ok) { const d = await r.json(); setItems(d.items); }
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

  if (loading) return <p className={`${muted} text-sm`}>Загрузка...</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className={`${muted} text-sm`}>AI читает эти записи при каждом вопросе клиента для точных ответов.</p>

      <div className="flex flex-col gap-3">
        {items.map(item => (
          <div key={item.id} className={`${bg} border ${border} rounded-xl p-4`}>
            {editing?.id === item.id ? (
              <div className="flex flex-col gap-3">
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })}
                  className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`}
                  placeholder="Название" />
                <textarea value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })}
                  rows={6}
                  className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm font-mono resize-y outline-none focus:border-violet-500`} />
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-1.5 text-sm ${muted} cursor-pointer`}>
                    <input type="checkbox" checked={editing.used} onChange={e => setEditing({ ...editing, used: e.target.checked })} />
                    Активна
                  </label>
                  <button onClick={() => save(editing)} className="ml-auto bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Сохранить</button>
                  <button onClick={() => setEditing(null)} className={`${muted} hover:${text} text-sm transition`}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.used ? "bg-green-400" : isDark ? "bg-white/20" : "bg-gray-300"}`} />
                    <span className={`font-medium text-sm ${text}`}>{item.title}</span>
                  </div>
                  <p className={`${muted} text-xs line-clamp-2`}>{item.content}</p>
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
            <input value={newItem.title} onChange={e => setNewItem(p => ({ ...p, title: e.target.value }))}
              placeholder="Название записи" autoFocus
              className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`} />
            <textarea value={newItem.content} onChange={e => setNewItem(p => ({ ...p, content: e.target.value }))}
              rows={5} placeholder="Содержимое..."
              className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm font-mono resize-y outline-none focus:border-violet-500`} />
            <div className="flex gap-2">
              <button onClick={add} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
              <button onClick={() => { setAdding(false); setNewItem({ title: "", content: "" }); }}
                className={`${muted} text-sm transition`}>Отмена</button>
            </div>
          </div>
        ) : (
          !readOnly && (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60">
              <Icon name="Plus" size={16} /> Добавить запись
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ── Быстрые ответы (бывший TabQuestions) ────────────────────────────────── */
function QuestionsTab({ token, isDark = true, readOnly = false }: { token: string; isDark?: boolean; readOnly?: boolean }) {
  const bg     = isDark ? "bg-white/5"      : "bg-white";
  const border = isDark ? "border-white/10"  : "border-gray-200";
  const text   = isDark ? "text-white"       : "text-gray-900";
  const muted  = isDark ? "text-white/40"    : "text-gray-500";
  const [items,   setItems]   = useState<QuickQuestion[]>([]);
  const [editing, setEditing] = useState<QuickQuestion | null>(null);
  const [adding,  setAdding]  = useState(false);
  const [newItem, setNewItem] = useState({ pattern: "", answer: "" });

  const load = useCallback(async () => {
    const r = await apiFetch("questions");
    if (r.ok) { const d = await r.json(); setItems(d.items); }
  }, []);

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
    await apiFetch("questions", { method: "POST", body: JSON.stringify(newItem) }, token);
    setNewItem({ pattern: "", answer: "" }); setAdding(false); load();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className={`${muted} text-sm`}>Шаблоны вопросов и готовые ответы — бот отвечает мгновенно без обращения к AI.</p>

      <div className="flex flex-col gap-3">
        {items.map(item => (
          <div key={item.id} className={`${bg} border ${border} rounded-xl p-4`}>
            {editing?.id === item.id ? (
              <div className="flex flex-col gap-3">
                <input value={editing.pattern} onChange={e => setEditing({ ...editing, pattern: e.target.value })}
                  placeholder="Паттерн вопроса (regex)"
                  className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm font-mono outline-none focus:border-violet-500`} />
                <textarea value={editing.answer} onChange={e => setEditing({ ...editing, answer: e.target.value })}
                  rows={4} placeholder="Ответ бота"
                  className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm resize-y outline-none focus:border-violet-500`} />
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-1.5 text-sm ${muted} cursor-pointer`}>
                    <input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                    Активен
                  </label>
                  <button onClick={() => save(editing)} className="ml-auto bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Сохранить</button>
                  <button onClick={() => setEditing(null)} className={`${muted} text-sm transition`}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.active ? "bg-green-400" : isDark ? "bg-white/20" : "bg-gray-300"}`} />
                    <span className={`font-mono text-xs ${isDark ? "text-violet-300" : "text-violet-600"} truncate`}>{item.pattern}</span>
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
              placeholder="Паттерн (например: гарантия|срок службы)" autoFocus
              className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm font-mono outline-none focus:border-violet-500`} />
            <textarea value={newItem.answer} onChange={e => setNewItem(p => ({ ...p, answer: e.target.value }))}
              rows={4} placeholder="Готовый ответ..."
              className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm resize-y outline-none focus:border-violet-500`} />
            <div className="flex gap-2">
              <button onClick={add} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
              <button onClick={() => { setAdding(false); setNewItem({ pattern: "", answer: "" }); }}
                className={`${muted} text-sm transition`}>Отмена</button>
            </div>
          </div>
        ) : (
          !readOnly && (
            <button onClick={() => setAdding(true)}
              className={`flex items-center gap-2 ${isDark ? "text-violet-400" : "text-violet-500"} hover:text-violet-400 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60`}>
              <Icon name="Plus" size={16} /> Добавить ответ
            </button>
          )
        )}
      </div>
    </div>
  );
}