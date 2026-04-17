import { useState, useEffect, useCallback } from "react";
import func2url from "@/../backend/func2url.json";
import Icon from "@/components/ui/icon";

const API = (func2url as Record<string, string>)["parse-xlsx"];

type Tab = "prompt" | "faq" | "questions";

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

export default function AdminPanel() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem("admin_token") || "");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("prompt");

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
    if (r.ok) {
      sessionStorage.setItem("admin_token", passwordInput);
      setToken(passwordInput);
    } else {
      setLoginError("Неверный пароль");
    }
  };

  const logout = () => {
    sessionStorage.removeItem("admin_token");
    setToken("");
  };

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
    loadPrompt();
    loadFaq();
    loadQuestions();
  }, [isAuthed, loadPrompt, loadFaq, loadQuestions]);

  const savePrompt = async () => {
    setPromptSaving(true);
    setPromptMsg("");
    const r = await apiFetch("prompt", { method: "PUT", body: JSON.stringify({ content: prompt }) }, token);
    setPromptMsg(r.ok ? "Сохранено!" : "Ошибка сохранения");
    setPromptSaving(false);
    setTimeout(() => setPromptMsg(""), 3000);
  };

  const saveFaqItem = async (item: FaqItem) => {
    await apiFetch("faq", { method: "PUT", body: JSON.stringify(item) }, token, item.id);
    setEditFaq(null);
    loadFaq();
  };

  const deleteFaqItem = async (id: number) => {
    if (!confirm("Удалить запись?")) return;
    await apiFetch("faq", { method: "DELETE" }, token, id);
    loadFaq();
  };

  const addFaqItem = async () => {
    if (!newFaq.title.trim() || !newFaq.content.trim()) return;
    await apiFetch("faq", { method: "POST", body: JSON.stringify(newFaq) }, token);
    setNewFaq({ title: "", content: "" });
    setAddingFaq(false);
    loadFaq();
  };

  const saveQuestion = async (q: QuickQuestion) => {
    await apiFetch("questions", { method: "PUT", body: JSON.stringify(q) }, token, q.id);
    setEditQ(null);
    loadQuestions();
  };

  const deleteQuestion = async (id: number) => {
    if (!confirm("Удалить вопрос?")) return;
    await apiFetch("questions", { method: "DELETE" }, token, id);
    loadQuestions();
  };

  const addQuestion = async () => {
    if (!newQ.pattern.trim() || !newQ.answer.trim()) return;
    await apiFetch("questions", { method: "POST", body: JSON.stringify(newQ) }, token);
    setNewQ({ pattern: "", answer: "" });
    setAddingQ(false);
    loadQuestions();
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
            type="password"
            placeholder="Пароль"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-violet-500 transition"
          />
          {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
          <button onClick={login} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2.5 font-medium transition">
            Войти
          </button>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "prompt",    label: "Системный промпт", icon: "BrainCircuit" },
    { id: "faq",       label: "База знаний",       icon: "Database" },
    { id: "questions", label: "Быстрые вопросы",   icon: "MessageCircle" },
  ];

  return (
    <div className="min-h-screen bg-[#0b0b11] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="BrainCircuit" size={20} className="text-violet-400" />
          <span className="font-semibold">Управление AI</span>
        </div>
        <button onClick={logout} className="text-white/40 hover:text-white/70 flex items-center gap-1.5 text-sm transition">
          <Icon name="LogOut" size={16} />
          Выйти
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 px-6 flex gap-1 pt-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-t-lg transition ${
              tab === t.id
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-4xl mx-auto">

        {/* ─── Промпт ─── */}
        {tab === "prompt" && (
          <div className="flex flex-col gap-4">
            <p className="text-white/50 text-sm">Это главная инструкция для AI — она определяет как бот считает сметы, что говорит и как себя ведёт.</p>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={28}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono resize-y outline-none focus:border-violet-500 transition"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={savePrompt}
                disabled={promptSaving}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium transition"
              >
                {promptSaving ? "Сохраняю..." : "Сохранить"}
              </button>
              {promptMsg && <span className={`text-sm ${promptMsg.includes("Ошибка") ? "text-red-400" : "text-green-400"}`}>{promptMsg}</span>}
            </div>
          </div>
        )}

        {/* ─── База знаний ─── */}
        {tab === "faq" && (
          <div className="flex flex-col gap-4">
            <p className="text-white/50 text-sm">Файлы знаний — AI читает их при каждом вопросе клиента и использует для точных ответов.</p>

            {faqLoading ? (
              <p className="text-white/30 text-sm">Загрузка...</p>
            ) : (
              <div className="flex flex-col gap-3">
                {faqItems.map(item => (
                  <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    {editFaq?.id === item.id ? (
                      <div className="flex flex-col gap-3">
                        <input
                          value={editFaq.title}
                          onChange={e => setEditFaq({ ...editFaq, title: e.target.value })}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500"
                          placeholder="Название"
                        />
                        <textarea
                          value={editFaq.content}
                          onChange={e => setEditFaq({ ...editFaq, content: e.target.value })}
                          rows={6}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-y outline-none focus:border-violet-500"
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-sm text-white/60 cursor-pointer">
                            <input type="checkbox" checked={editFaq.used} onChange={e => setEditFaq({ ...editFaq, used: e.target.checked })} />
                            Активна
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
                          <button onClick={() => setEditFaq(item)} className="text-white/30 hover:text-violet-400 p-1.5 transition">
                            <Icon name="Pencil" size={15} />
                          </button>
                          <button onClick={() => deleteFaqItem(item.id)} className="text-white/30 hover:text-red-400 p-1.5 transition">
                            <Icon name="Trash2" size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {addingFaq ? (
                  <div className="bg-white/5 border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3">
                    <input
                      value={newFaq.title}
                      onChange={e => setNewFaq({ ...newFaq, title: e.target.value })}
                      placeholder="Название записи"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500"
                    />
                    <textarea
                      value={newFaq.content}
                      onChange={e => setNewFaq({ ...newFaq, content: e.target.value })}
                      rows={5}
                      placeholder="Содержимое..."
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-y outline-none focus:border-violet-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={addFaqItem} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
                      <button onClick={() => { setAddingFaq(false); setNewFaq({ title: "", content: "" }); }} className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingFaq(true)} className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60">
                    <Icon name="Plus" size={16} />
                    Добавить запись
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Быстрые вопросы ─── */}
        {tab === "questions" && (
          <div className="flex flex-col gap-4">
            <p className="text-white/50 text-sm">Когда клиент пишет ключевые слова — AI отвечает мгновенно, без обращения к нейросети. Паттерн — это регулярное выражение.</p>

            <div className="flex flex-col gap-3">
              {questions.map(q => (
                <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  {editQ?.id === q.id ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-white/40 text-xs mb-1 block">Паттерн (ключевые слова)</label>
                        <input
                          value={editQ.pattern}
                          onChange={e => setEditQ({ ...editQ, pattern: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs mb-1 block">Ответ AI</label>
                        <textarea
                          value={editQ.answer}
                          onChange={e => setEditQ({ ...editQ, answer: e.target.value })}
                          rows={4}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-y outline-none focus:border-violet-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-sm text-white/60 cursor-pointer">
                          <input type="checkbox" checked={editQ.active} onChange={e => setEditQ({ ...editQ, active: e.target.checked })} />
                          Активен
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
                        <button onClick={() => setEditQ(q)} className="text-white/30 hover:text-violet-400 p-1.5 transition">
                          <Icon name="Pencil" size={15} />
                        </button>
                        <button onClick={() => deleteQuestion(q.id)} className="text-white/30 hover:text-red-400 p-1.5 transition">
                          <Icon name="Trash2" size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {addingQ ? (
                <div className="bg-white/5 border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3">
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Паттерн</label>
                    <input
                      value={newQ.pattern}
                      onChange={e => setNewQ({ ...newQ, pattern: e.target.value })}
                      placeholder="(гарантия|срок службы)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Ответ</label>
                    <textarea
                      value={newQ.answer}
                      onChange={e => setNewQ({ ...newQ, answer: e.target.value })}
                      rows={4}
                      placeholder="Текст ответа AI..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-y outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addQuestion} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
                    <button onClick={() => { setAddingQ(false); setNewQ({ pattern: "", answer: "" }); }} className="text-white/40 hover:text-white/70 text-sm transition">Отмена</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingQ(true)} className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60">
                  <Icon name="Plus" size={16} />
                  Добавить вопрос
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}