import { useState, useRef, useEffect, useCallback } from "react";
import func2url from "@/../backend/func2url.json";
import { CATALOG } from "./data/catalog";
import { REVIEWS, FAQ } from "./data/content";
import { PORTFOLIO_ITEMS } from "./data/portfolio";
import Icon from "@/components/ui/icon";

// ─── types ───────────────────────────────────────────────────────────────────
type Section = "catalog" | "calc" | "portfolio" | "ai" | "reviews" | "faq" | "contacts";

interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
}

// ─── menu config ─────────────────────────────────────────────────────────────
const MENU: { id: Section; label: string; emoji: string }[] = [
  { id: "catalog",   label: "Каталог",      emoji: "📁" },
  { id: "calc",      label: "Калькулятор",  emoji: "🧮" },
  { id: "portfolio", label: "Портфолио",    emoji: "🖼️" },
  { id: "ai",        label: "AI-советы",    emoji: "🤖" },
  { id: "reviews",   label: "Отзывы",       emoji: "⭐" },
  { id: "faq",       label: "FAQ",          emoji: "❓" },
  { id: "contacts",  label: "Контакты",     emoji: "📞" },
];

const AI_URL = func2url["ai-chat"];
const FALLBACK = "Извините, сейчас помощник недоступен. Позвоните: +7 (977) 606-89-01";

// ─── AI responses (fallback) ──────────────────────────────────────────────────
function localAnswer(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("привет") || t.includes("здравств")) return "Здравствуйте! Чем могу помочь?";
  if (t.includes("каталог")) return "Посмотрите каталог в панели ниже — там все виды потолков с ценами!";
  if (t.includes("калькулятор") || t.includes("рассч")) return "Используйте калькулятор в нижней панели — введите площадь и получите цену!";
  if (t.includes("цена") || t.includes("стоим") || t.includes("сколько")) return "Цены от 249 ₽/м². Точный расчёт сделаю через калькулятор — откройте его в меню ниже.";
  if (t.includes("гарантия")) return "Даём письменную гарантию 12 лет на все виды потолков.";
  if (t.includes("монтаж") || t.includes("установ")) return "Монтаж одной комнаты занимает 3–5 часов. Работаем по Москве и области.";
  return "Спасибо за вопрос! Изучите наши разделы через меню ниже — там вся информация о потолках, ценах и примерах работ.";
}

// ─── sub-panels ──────────────────────────────────────────────────────────────
function PanelCatalog() {
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CATALOG.slice(0, 6).map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 transition-all group overflow-hidden cursor-pointer"
            onClick={() => alert(`${item.name}\n${item.desc}\n\nЦена: от ${item.price} ₽/м²`)}
          >
            <div className={`h-16 bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl`}>
              🏠
            </div>
            <div className="p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-white text-sm truncate">{item.name}</span>
                {item.popular && (
                  <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full shrink-0 ml-1">Хит</span>
                )}
              </div>
              <div className="text-xs text-white/40 mb-2 line-clamp-2 leading-relaxed">{item.desc.slice(0, 60)}…</div>
              <div className="flex items-center justify-between">
                <span className="text-orange-400 font-bold text-sm">от {item.price} ₽/м²</span>
                <button
                  className="text-[10px] bg-white/8 hover:bg-white/15 text-white/60 px-2 py-1 rounded-lg transition-colors"
                  onClick={(e) => { e.stopPropagation(); alert(`${item.name}\n${item.desc}\n\nЦена: от ${item.price} ₽/м²`); }}
                >
                  Подробнее
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelCalc() {
  const [area, setArea] = useState("");
  const [type, setType] = useState("matte");
  const [result, setResult] = useState<number | null>(null);

  const calc = () => {
    const a = parseFloat(area);
    if (!a || a <= 0) return;
    const item = CATALOG.find((c) => c.id === type) ?? CATALOG[1];
    const price = item.price;
    const montage = 350;
    setResult(Math.round(a * (price + montage)));
  };

  return (
    <div className="h-full flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl mb-1">🧮</div>
          <div className="text-white font-semibold text-sm mb-0.5">Быстрый расчёт</div>
          <div className="text-white/40 text-xs">Введите площадь и выберите тип потолка</div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-white/50 uppercase tracking-wider">Площадь, м²</label>
          <input
            type="number"
            value={area}
            onChange={(e) => { setArea(e.target.value); setResult(null); }}
            placeholder="Например: 18"
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-white/25"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-white/50 uppercase tracking-wider">Тип потолка</label>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setResult(null); }}
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
          >
            {CATALOG.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#1a1a2e]">
                {c.name} — от {c.price} ₽/м²
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={calc}
          className="w-full bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-95"
        >
          Рассчитать стоимость
        </button>

        {result !== null && (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/8 p-4 text-center animate-fade-in">
            <div className="text-white/50 text-xs mb-1">Ориентировочная стоимость</div>
            <div className="text-3xl font-bold text-white mb-0.5">
              {result.toLocaleString("ru-RU")} ₽
            </div>
            <div className="text-white/35 text-xs">включая материал и монтаж</div>
            <div className="mt-3 text-[10px] text-white/25">
              Точную цену назовёт замерщик на бесплатном выезде
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PanelPortfolio() {
  const items = PORTFOLIO_ITEMS.slice(0, 8);
  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="relative rounded-xl overflow-hidden aspect-square cursor-pointer group"
            onClick={() => alert(`${item.room} • ${item.district}\n${item.type} • ${item.area} м² • ${item.year}`)}
          >
            <img
              src={item.img}
              alt={item.room}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
              <div>
                <div className="text-white text-xs font-semibold leading-tight">{item.type}</div>
                <div className="text-white/60 text-[10px]">{item.district} · {item.area} м²</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelAiTips({ onAsk }: { onAsk: (q: string) => void }) {
  const tips = [
    { icon: "💡", label: "Сколько стоит потолок 20 м²?" },
    { icon: "🏠", label: "Какой потолок выбрать для ванной?" },
    { icon: "⚡", label: "Что входит в стоимость монтажа?" },
    { icon: "🌟", label: "Расскажи про звёздное небо" },
    { icon: "📅", label: "Сколько времени займёт установка?" },
    { icon: "🛡️", label: "Какая гарантия на потолки?" },
  ];
  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-3xl mb-2">🤖</div>
        <div className="text-white font-semibold text-sm">Спросите AI-помощника</div>
        <div className="text-white/40 text-xs mt-1">Нажмите на вопрос — он отправится в чат выше</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tips.map((t, i) => (
          <button
            key={i}
            onClick={() => onAsk(t.label)}
            className="flex items-center gap-3 bg-white/4 hover:bg-white/8 border border-white/8 hover:border-violet-500/30 rounded-xl px-4 py-3 text-left transition-all group"
          >
            <span className="text-lg shrink-0">{t.icon}</span>
            <span className="text-white/70 group-hover:text-white text-xs transition-colors leading-snug">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PanelReviews() {
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="space-y-3">
        {REVIEWS.slice(0, 4).map((r, i) => (
          <div key={i} className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {r.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-white font-semibold text-sm truncate">{r.name}</span>
                  <span className="text-white/30 text-xs shrink-0">{r.date}</span>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <span key={j} className="text-yellow-400 text-xs">★</span>
                  ))}
                  <span className="text-white/30 text-xs ml-1">{r.city}</span>
                </div>
                <p className="text-white/60 text-xs leading-relaxed">{r.text}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1">
                  <span className="text-orange-400 text-[10px]">🏠</span>
                  <span className="text-white/40 text-[10px]">{r.type} · {r.area} м²</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="space-y-2">
        {FAQ.map((item, i) => (
          <div key={i} className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/4 transition-colors"
            >
              <span className="text-white text-sm font-medium leading-snug">{item.q}</span>
              <span className={`text-white/40 text-lg shrink-0 transition-transform duration-200 ${open === i ? "rotate-45" : ""}`}>+</span>
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${open === i ? "max-h-48" : "max-h-0"}`}>
              <p className="px-4 pb-4 text-white/55 text-xs leading-relaxed">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelContacts({ onSent }: { onSent: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) { alert("Заполните имя и email"); return; }
    onSent();
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: "📞", label: "Телефон", val: "+7 (977) 606-89-01", href: "tel:+79776068901" },
            { icon: "✉️", label: "Email",   val: "info@mospotolki.net", href: "mailto:info@mospotolki.net" },
            { icon: "📍", label: "Адрес",   val: "Мытищи, Пограничная 24", href: "#" },
            { icon: "🕐", label: "Часы",    val: "Пн–Вс 8:00–21:00", href: "#" },
          ].map((c, i) => (
            <a
              key={i}
              href={c.href}
              className="flex items-start gap-3 bg-white/4 hover:bg-white/7 border border-white/8 rounded-2xl p-3 transition-colors group"
            >
              <span className="text-xl">{c.icon}</span>
              <div>
                <div className="text-white/40 text-[10px] uppercase tracking-wider">{c.label}</div>
                <div className="text-white text-xs font-medium mt-0.5 group-hover:text-violet-300 transition-colors">{c.val}</div>
              </div>
            </a>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="text-xs text-white/40 uppercase tracking-wider pt-1">Обратная связь</div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20"
            />
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20"
            />
          </div>
          <textarea
            value={msg} onChange={(e) => setMsg(e.target.value)}
            placeholder="Ваш вопрос или комментарий"
            rows={3}
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20 resize-none"
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-95"
          >
            Отправить сообщение
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AiHub() {
  const [section, setSection] = useState<Section>("catalog");
  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, role: "assistant", text: "Привет! Я AI-помощник MOSPOTOLKI 🤖\nЗадайте вопрос о натяжных потолках — расчёт, выбор, цены, сроки." },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "40px";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }, [input]);

  const sendMsg = useCallback((text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Msg = { id: Date.now(), role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    const history = [...messages, userMsg].map((m) => ({ role: m.role, text: m.text }));

    fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then((r) => r.json())
      .then((d) => {
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", text: d.answer || localAnswer(text) }]);
      })
      .catch(() => {
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", text: localAnswer(text) }]);
      })
      .finally(() => setTyping(false));
  }, [messages, typing]);

  const handleAsk = (q: string) => {
    sendMsg(q);
    setSection("ai");
  };

  const activeItem = MENU.find((m) => m.id === section)!;

  return (
    <div
      style={{ height: "100dvh", overflow: "hidden" }}
      className="bg-[#09090f] text-white font-rubik flex flex-col"
    >
      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 px-4 h-12 border-b border-white/8 bg-[#0c0c16]/90 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <img
            src="https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png"
            alt="logo"
            className="w-7 h-7 object-contain"
            style={{ mixBlendMode: "screen" }}
          />
          <span className="font-montserrat font-black text-sm tracking-wide">
            MOS<span className="text-orange-400">POTOLKI</span>
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-400 text-xs">AI онлайн</span>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar (desktop left) ───────────────────────────── */}
        <nav className="hidden lg:flex shrink-0 w-[90px] flex-col items-center py-4 gap-1.5 border-r border-white/8 bg-[#0c0c16]/60 overflow-y-auto">
          {MENU.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-16 flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center transition-all ${
                  active
                    ? "bg-gradient-to-b from-violet-600/30 to-orange-500/20 border border-violet-500/40 text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <span className="text-2xl leading-none">{item.emoji}</span>
                <span className="text-[9px] font-montserrat font-semibold uppercase tracking-wide leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* ── Right area ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">

          {/* ── AI Chat (top, fixed height) ──────────────────── */}
          <div className="shrink-0 flex flex-col border-b border-white/8" style={{ height: "42%" }}>
            {/* Chat header */}
            <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-white/6 bg-[#0e0e1a]/60">
              <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center">
                <Icon name="Bot" size={14} className="text-violet-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">AI-помощник MOSPOTOLKI</div>
                <div className="text-[10px] text-green-400">● Онлайн</div>
              </div>
              <button
                onClick={() => setMessages([{ id: 0, role: "assistant", text: "Привет! Я AI-помощник MOSPOTOLKI 🤖\nЗадайте вопрос о натяжных потолках — расчёт, выбор, цены, сроки." }])}
                className="ml-auto text-white/20 hover:text-white/50 transition-colors p-1"
                title="Очистить чат"
              >
                <Icon name="RotateCcw" size={12} />
              </button>
            </div>

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 scroll-smooth">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-br-sm"
                        : "bg-white/6 border border-white/8 text-white/80 rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-white/6 border border-white/8 rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1">
                    {[0, 150, 300].map((d) => (
                      <span key={d} style={{ animationDelay: `${d}ms` }} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 px-3 py-2.5 border-t border-white/6">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMsg(input); }}
                className="flex items-end gap-2"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(input); }
                  }}
                  placeholder="Написать сообщение…"
                  rows={1}
                  style={{ height: "40px", maxHeight: "100px", resize: "none" }}
                  className="flex-1 bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2 text-white text-xs outline-none transition-colors placeholder:text-white/25 overflow-y-auto"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  className="shrink-0 w-9 h-9 flex items-center justify-center bg-gradient-to-br from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 disabled:opacity-30 rounded-xl transition-all active:scale-95"
                >
                  <Icon name="Send" size={14} className="text-white" />
                </button>
              </form>
            </div>
          </div>

          {/* ── Dynamic panel (bottom) ──────────────────────── */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-white/8 bg-[#0e0e1a]/40">
              <span className="text-base leading-none">{activeItem.emoji}</span>
              <span className="text-xs font-semibold text-white/80">{activeItem.label}</span>
              <div className="ml-auto flex items-center gap-1">
                {MENU.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSection(m.id)}
                    title={m.label}
                    className={`px-2 py-1 rounded-lg text-[10px] font-montserrat transition-all ${
                      section === m.id
                        ? "bg-violet-600/40 border border-violet-500/50 text-violet-300"
                        : "text-white/25 hover:text-white/50"
                    }`}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {section === "catalog"   && <PanelCatalog />}
              {section === "calc"      && <PanelCalc />}
              {section === "portfolio" && <PanelPortfolio />}
              {section === "ai"        && <PanelAiTips onAsk={handleAsk} />}
              {section === "reviews"   && <PanelReviews />}
              {section === "faq"       && <PanelFaq />}
              {section === "contacts"  && (
                contactSent ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <span className="text-4xl">✅</span>
                    <div className="text-white font-semibold">Сообщение отправлено!</div>
                    <div className="text-white/40 text-sm">Перезвоним в течение 15 минут</div>
                    <button
                      onClick={() => setContactSent(false)}
                      className="mt-2 text-violet-400 text-xs hover:text-violet-300 underline"
                    >
                      Отправить ещё
                    </button>
                  </div>
                ) : (
                  <PanelContacts onSent={() => setContactSent(true)} />
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom tab bar (mobile / tablet) ─────────────────────────── */}
      <nav className="lg:hidden shrink-0 flex items-stretch border-t border-white/8 bg-[#0c0c16]/95 backdrop-blur overflow-x-auto">
        {MENU.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-[48px] transition-all ${
                active ? "text-white" : "text-white/35 hover:text-white/60"
              }`}
            >
              {active && (
                <span className="absolute bottom-0 w-6 h-0.5 bg-gradient-to-r from-violet-500 to-orange-500 rounded-full" />
              )}
              <span className="text-lg leading-none relative">
                {item.emoji}
                {active && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-violet-400 rounded-full" />
                )}
              </span>
              <span className="text-[8px] font-montserrat font-semibold uppercase tracking-wide leading-none">
                {item.label.length > 6 ? item.label.slice(0, 6) : item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
