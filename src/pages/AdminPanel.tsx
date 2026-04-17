import { useState, useEffect, useCallback, useRef } from "react";
import func2url from "@/../backend/func2url.json";
import Icon from "@/components/ui/icon";

const API = (func2url as Record<string, string>)["parse-xlsx"];

type Tab = "prices" | "prompt" | "faq" | "questions";

interface FaqItem {
  id: number;
  title: string;
  content: string;
  used: boolean;
}

interface QuickQuestion {
  id: number;
  pattern: string;
  answer: string;
  active: boolean;
}

interface PriceItem {
  id: number;
  category: string;
  name: string;
  price: number;
  unit: string;
  description: string;
  active: boolean;
}

function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number) {
  let url = `${API}?r=${resource}`;
  if (id !== undefined) url += `&id=${id}`;
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Admin-Token": token } : {}),
      ...(opts?.headers || {}),
    },
  });
}

// Инлайн-ячейка с авто-сохранением
function EditableCell({
  value,
  type = "text",
  onSave,
  className = "",
}: {
  value: string | number;
  type?: "text" | "number";
  onSave: (val: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    if (draft === String(value)) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
        className={`bg-violet-500/10 border border-violet-500/40 rounded px-2 py-0.5 text-white outline-none w-full ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:text-violet-300 transition-colors rounded px-1 -mx-1 ${saving ? "opacity-50" : ""} ${className}`}
      title="Нажмите для редактирования"
    >
      {saving ? "..." : value}
    </span>
  );
}

export default function AdminPanel() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem("admin_token") || "");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("prices");

  // Prices
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [addingInCat, setAddingInCat] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState({ name: "", price: "", unit: "шт", description: "" });

  // Prompt
  const [prompt, setPrompt] = useState("");
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptMsg, setPromptMsg] = useState("");

  // FAQ
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [editFaq, setEditFaq] = useState<FaqItem | null>(null);
  const [newFaq, setNewFaq] = useState({ title: "", content: "" });
  const [addingFaq, setAddingFaq] = useState(false);

  // Questions
  const [questions, setQuestions] = useState<QuickQuestion[]>([]);
  const [editQ, setEditQ] = useState<QuickQuestion | null>(null);
  const [newQ, setNewQ] = useState({ pattern: "", answer: "" });
  const [addingQ, setAddingQ] = useState(false);

  const isAuthed = !!token;

  const login = async () => {
    setLoginError("");
    const r = await apiFetch("login", { method: "POST", body: JSON.stringify({ password: passwordInput }) });
    if (r.ok) { sessionStorage.setItem("admin_token", passwordInput); setToken(passwordInput); }
    else setLoginError("Неверный пароль");
  };

  const logout = () => { sessionStorage.removeItem("admin_token"); setToken(""); };

  const loadPrices = useCallback(async () => {
    setPricesLoading(true);
    const r = await apiFetch("prices");
    if (r.ok) { const d = await r.json(); setPrices(d.items); }
    setPricesLoading(false);
  }, []);

  const loadPrompt = useCallback(async () => {
    const r = await apiFetch("prompt");
    if (r.ok) { const d = await r.json(); setPrompt(d.content); }
  }, []);

  const loadFaq = useCallback(async () => {
    setFaqLoading(true);
    const r = await apiFetch("faq");
    if (r.ok) { const d = await r.json(); setFaqItems(d.items); }
    setFaqLoading(false);
  }, []);

  const loadQuestions = useCallback(async () => {
    const r = await apiFetch("questions");
    if (r.ok) { const d = await r.json(); setQuestions(d.items); }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    loadPrices(); loadPrompt(); loadFaq(); loadQuestions();
  }, [isAuthed, loadPrices, loadPrompt, loadFaq, loadQuestions]);

  // Сохранение одного поля цены
  const savePriceField = async (item: PriceItem, field: keyof PriceItem, val: string) => {
    const updated = { ...item, [field]: field === "price" ? parseInt(val) || 0 : val };
    await apiFetch("prices", { method: "PUT", body: JSON.stringify(updated) }, token, item.id);
    setPrices(prev => prev.map(p => p.id === item.id ? updated : p));
  };

  const togglePriceActive = async (item: PriceItem) => {
    const updated = { ...item, active: !item.active };
    await apiFetch("prices", { method: "PUT", body: JSON.stringify(updated) }, token, item.id);
    setPrices(prev => prev.map(p => p.id === item.id ? updated : p));
  };

  const addPriceItem = async (category: string) => {
    if (!newPrice.name.trim()) return;
    const r = await apiFetch("prices", { method: "POST", body: JSON.stringify({ ...newPrice, category, price: parseInt(newPrice.price) || 0 }) }, token);
    if (r.ok) {
      setAddingInCat(null);
      setNewPrice({ name: "", price: "", unit: "шт", description: "" });
      loadPrices();
    }
  };

  const deletePriceItem = async (id: number) => {
    if (!confirm("Удалить позицию?")) return;
    await apiFetch("prices", { method: "DELETE" }, token, id);
    setPrices(prev => prev.filter(p => p.id !== id));
  };

  const savePrompt = async () => {
    setPromptSaving(true); setPromptMsg("");
    const r = await apiFetch("prompt", { method: "PUT", body: JSON.stringify({ content: prompt }) }, token);
    setPromptMsg(r.ok ? "Сохранено!" : "Ошибка сохранения");
    setPromptSaving(false);
    setTimeout(() => setPromptMsg(""), 3000);
  };

  const saveFaqItem = async (item: FaqItem) => {
    await apiFetch("faq", { method: "PUT", body: JSON.stringify(item) }, token, item.id);
    setEditFaq(null); loadFaq();
  };
  const deleteFaqItem = async (id: number) => {
    if (!confirm("Удалить запись?")) return;
    await apiFetch("faq", { method: "DELETE" }, token, id); loadFaq();
  };
  const addFaqItem = async () => {
    if (!newFaq.title.trim() || !newFaq.content.trim()) return;
    await apiFetch("faq", { method: "POST", body: JSON.stringify(newFaq) }, token);
    setNewFaq({ title: "", content: "" }); setAddingFaq(false); loadFaq();
  };

  const saveQuestion = async (q: QuickQuestion) => {
    await apiFetch("questions", { method: "PUT", body: JSON.stringify(q) }, token, q.id);
    setEditQ(null); loadQuestions();
  };
  const deleteQuestion = async (id: number) => {
    if (!confirm("Удалить вопрос?")) return;
    await apiFetch("questions", { method: "DELETE" }, token, id); loadQuestions();
  };
  const addQuestion = async () => {
    if (!newQ.pattern.trim() || !newQ.answer.trim()) return;
    await apiFetch("questions", { method: "POST", body: JSON.stringify(newQ) }, token);
    setNewQ({ pattern: "", answer: "" }); setAddingQ(false); loadQuestions();
  };

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#0b0b11] flex items-center justify-center">
        <div className="bg-[#13131f] border border-white/10 rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="ShieldCheck" size={22} className="text-violet-400" />
            <span className="text-white font-semibold text-lg">Вход для администратора</span>
          </div>
          <input
            type="password" placeholder="Пароль" value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-violet-500 transition"
          />
          {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
          <button onClick={login} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2.5 font-medium transition">Войти</button>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "prices",    label: "Цены",             icon: "Tag" },
    { id: "prompt",    label: "Системный промпт",  icon: "BrainCircuit" },
    { id: "faq",       label: "База знаний",        icon: "Database" },
    { id: "questions", label: "Быстрые вопросы",    icon: "MessageCircle" },
  ];

  // Группируем цены по категориям
  const pricesByCategory = prices.reduce<Record<string, PriceItem[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0b0b11] text-white">
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="BrainCircuit" size={20} className="text-violet-400" />
          <span className="font-semibold">Управление AI</span>
        </div>
        <button onClick={logout} className="text-white/40 hover:text-white/70 flex items-center gap-1.5 text-sm transition">
          <Icon name="LogOut" size={16} /> Выйти
        </button>
      </div>

      <div className="border-b border-white/10 px-4 flex gap-1 pt-2 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-t-lg transition whitespace-nowrap ${
              tab === t.id ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500" : "text-white/50 hover:text-white/80"
            }`}>
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-6xl mx-auto">

        {/* ─── ЦЕНЫ ─── */}
        {tab === "prices" && (
          <div>
            <p className="text-white/50 text-sm mb-4">Нажмите на любую ячейку чтобы изменить — сохраняется мгновенно. Строки можно отключить (AI будет игнорировать позицию).</p>
            {pricesLoading ? (
              <p className="text-white/30 text-sm">Загрузка...</p>
            ) : (
              <div className="flex flex-col gap-6">
                {Object.entries(pricesByCategory).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-violet-300 text-xs font-semibold uppercase tracking-wider mb-2 px-1">{category}</h3>
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[35%]">Название</th>
                            <th className="text-right text-white/30 font-normal px-4 py-2.5 w-[10%]">Цена ₽</th>
                            <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[8%]">Ед.</th>
                            <th className="text-left text-white/30 font-normal px-4 py-2.5">Описание (как AI понимает позицию)</th>
                            <th className="px-3 py-2.5 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={item.id}
                              className={`border-b border-white/5 last:border-0 ${!item.active ? "opacity-40" : ""} ${idx % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                              <td className="px-4 py-2.5 text-white">
                                <EditableCell value={item.name} onSave={v => savePriceField(item, "name", v)} />
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-green-400">
                                <EditableCell value={item.price} type="number" onSave={v => savePriceField(item, "price", v)} className="text-right" />
                              </td>
                              <td className="px-4 py-2.5 text-white/50">
                                <EditableCell value={item.unit} onSave={v => savePriceField(item, "unit", v)} />
                              </td>
                              <td className="px-4 py-2.5 text-white/40 text-xs">
                                <EditableCell value={item.description} onSave={v => savePriceField(item, "description", v)} />
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => togglePriceActive(item)}
                                    title={item.active ? "Отключить" : "Включить"}
                                    className={`w-4 h-4 rounded-full border transition flex-shrink-0 ${item.active ? "bg-green-400 border-green-400" : "border-white/20 hover:border-white/40"}`} />
                                  <button onClick={() => deletePriceItem(item.id)}
                                    title="Удалить"
                                    className="text-white/20 hover:text-red-400 transition p-0.5">
                                    <Icon name="X" size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Форма добавления */}
                      {addingInCat === category ? (
                        <div className="border-t border-white/10 px-4 py-3 flex gap-2 items-end flex-wrap bg-violet-500/5">
                          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                            <span className="text-white/30 text-xs">Название</span>
                            <input autoFocus value={newPrice.name} onChange={e => setNewPrice(p => ({ ...p, name: e.target.value }))}
                              placeholder="Новая позиция..."
                              className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
                          </div>
                          <div className="flex flex-col gap-1 w-24">
                            <span className="text-white/30 text-xs">Цена ₽</span>
                            <input type="number" value={newPrice.price} onChange={e => setNewPrice(p => ({ ...p, price: e.target.value }))}
                              placeholder="0"
                              className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500 font-mono" />
                          </div>
                          <div className="flex flex-col gap-1 w-20">
                            <span className="text-white/30 text-xs">Единица</span>
                            <input value={newPrice.unit} onChange={e => setNewPrice(p => ({ ...p, unit: e.target.value }))}
                              placeholder="шт"
                              className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
                          </div>
                          <div className="flex flex-col gap-1 flex-[2] min-w-[160px]">
                            <span className="text-white/30 text-xs">Описание для AI</span>
                            <input value={newPrice.description} onChange={e => setNewPrice(p => ({ ...p, description: e.target.value }))}
                              placeholder="Как AI понимает эту позицию..."
                              className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
                          </div>
                          <div className="flex gap-2 pb-0.5">
                            <button onClick={() => addPriceItem(category)}
                              className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition whitespace-nowrap">
                              Добавить
                            </button>
                            <button onClick={() => { setAddingInCat(null); setNewPrice({ name: "", price: "", unit: "шт", description: "" }); }}
                              className="text-white/40 hover:text-white/70 text-sm transition">
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setAddingInCat(category); setNewPrice({ name: "", price: "", unit: "шт", description: "" }); }}
                          className="w-full py-2.5 text-violet-400/60 hover:text-violet-400 text-xs flex items-center justify-center gap-1.5 border-t border-white/5 transition hover:bg-violet-500/5">
                          <Icon name="Plus" size={13} />
                          Добавить позицию в «{category}»
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── ПРОМПТ ─── */}
        {tab === "prompt" && (
          <div className="flex flex-col gap-4">
            <p className="text-white/50 text-sm">Это главная инструкция для AI — она определяет как бот считает сметы, что говорит и как себя ведёт.</p>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={28}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono resize-y outline-none focus:border-violet-500 transition" />
            <div className="flex items-center gap-3">
              <button onClick={savePrompt} disabled={promptSaving}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium transition">
                {promptSaving ? "Сохраняю..." : "Сохранить"}
              </button>
              {promptMsg && <span className={`text-sm ${promptMsg.includes("Ошибка") ? "text-red-400" : "text-green-400"}`}>{promptMsg}</span>}
            </div>
          </div>
        )}

        {/* ─── БАЗА ЗНАНИЙ ─── */}
        {tab === "faq" && (
          <div className="flex flex-col gap-4">
            <p className="text-white/50 text-sm">Файлы знаний — AI читает их при каждом вопросе клиента и использует для точных ответов.</p>
            {faqLoading ? <p className="text-white/30 text-sm">Загрузка...</p> : (
              <div className="flex flex-col gap-3">
                {faqItems.map(item => (
                  <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    {editFaq?.id === item.id ? (
                      <div className="flex flex-col gap-3">
                        <input value={editFaq.title} onChange={e => setEditFaq({ ...editFaq, title: e.target.value })}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500" placeholder="Название" />
                        <textarea value={editFaq.content} onChange={e => setEditFaq({ ...editFaq, content: e.target.value })}
                          rows={6} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-y outline-none focus:border-violet-500" />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-sm text-white/60 cursor-pointer">
                            <input type="checkbox" checked={editFaq.used} onChange={e => setEditFaq({ ...editFaq, used: e.target.checked })} /> Активна
                          </label>
                          <button onClick={() => saveFaqItem(editFaq)} className="ml-auto bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Сохранить</button>
                          <button onClick={() => setEditFaq(null)} className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
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
                          <button onClick={() => setEditFaq(item)} className="text-white/30 hover:text-violet-400 p-1.5 transition"><Icon name="Pencil" size={15} /></button>
                          <button onClick={() => deleteFaqItem(item.id)} className="text-white/30 hover:text-red-400 p-1.5 transition"><Icon name="Trash2" size={15} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {addingFaq ? (
                  <div className="bg-white/5 border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3">
                    <input value={newFaq.title} onChange={e => setNewFaq({ ...newFaq, title: e.target.value })} placeholder="Название записи"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500" />
                    <textarea value={newFaq.content} onChange={e => setNewFaq({ ...newFaq, content: e.target.value })} rows={5} placeholder="Содержимое..."
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-y outline-none focus:border-violet-500" />
                    <div className="flex gap-2">
                      <button onClick={addFaqItem} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
                      <button onClick={() => { setAddingFaq(false); setNewFaq({ title: "", content: "" }); }} className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingFaq(true)} className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60">
                    <Icon name="Plus" size={16} /> Добавить запись
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── БЫСТРЫЕ ВОПРОСЫ ─── */}
        {tab === "questions" && (
          <div className="flex flex-col gap-4">
            <p className="text-white/50 text-sm">Когда клиент пишет ключевые слова — AI отвечает мгновенно, без обращения к нейросети.</p>
            <div className="flex flex-col gap-3">
              {questions.map(q => (
                <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  {editQ?.id === q.id ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-white/40 text-xs mb-1 block">Паттерн (ключевые слова)</label>
                        <input value={editQ.pattern} onChange={e => setEditQ({ ...editQ, pattern: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-violet-500" />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs mb-1 block">Ответ AI</label>
                        <textarea value={editQ.answer} onChange={e => setEditQ({ ...editQ, answer: e.target.value })} rows={4}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-y outline-none focus:border-violet-500" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-sm text-white/60 cursor-pointer">
                          <input type="checkbox" checked={editQ.active} onChange={e => setEditQ({ ...editQ, active: e.target.checked })} /> Активен
                        </label>
                        <button onClick={() => saveQuestion(editQ)} className="ml-auto bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Сохранить</button>
                        <button onClick={() => setEditQ(null)} className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
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
                        <button onClick={() => setEditQ(q)} className="text-white/30 hover:text-violet-400 p-1.5 transition"><Icon name="Pencil" size={15} /></button>
                        <button onClick={() => deleteQuestion(q.id)} className="text-white/30 hover:text-red-400 p-1.5 transition"><Icon name="Trash2" size={15} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {addingQ ? (
                <div className="bg-white/5 border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3">
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Паттерн</label>
                    <input value={newQ.pattern} onChange={e => setNewQ({ ...newQ, pattern: e.target.value })} placeholder="(гарантия|срок службы)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Ответ</label>
                    <textarea value={newQ.answer} onChange={e => setNewQ({ ...newQ, answer: e.target.value })} rows={4} placeholder="Текст ответа AI..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-y outline-none focus:border-violet-500" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addQuestion} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
                    <button onClick={() => { setAddingQ(false); setNewQ({ pattern: "", answer: "" }); }} className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingQ(true)} className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60">
                  <Icon name="Plus" size={16} /> Добавить вопрос
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}