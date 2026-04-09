import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { CATALOG, ROOMS } from "./data/catalog";
import { REVIEWS, FAQ } from "./data/content";
import { PORTFOLIO_ITEMS } from "./data/portfolio";
import func2url from "@/../backend/func2url.json";

// ─── Типы ─────────────────────────────────────────────────────────────────────
type Section = "catalog" | "calc" | "portfolio" | "ai" | "reviews" | "faq" | "contacts";

interface Msg { id: number; role: "user" | "assistant"; text: string; }

// ─── Меню ─────────────────────────────────────────────────────────────────────
const MENU: { id: Section; emoji: string; label: string }[] = [
  { id: "catalog",   emoji: "📁", label: "Каталог"     },
  { id: "calc",      emoji: "🧮", label: "Калькулятор" },
  { id: "portfolio", emoji: "🖼️", label: "Портфолио"   },
  { id: "ai",        emoji: "🤖", label: "AI-советы"   },
  { id: "reviews",   emoji: "⭐", label: "Отзывы"      },
  { id: "faq",       emoji: "❓", label: "FAQ"          },
  { id: "contacts",  emoji: "📞", label: "Контакты"    },
];

const AI_URL = func2url["ai-chat"];
const INITIAL: Msg = { id: 0, role: "assistant", text: "Привет! Я AI-помощник MOSPOTOLKI 🤖\nЗадайте вопрос о натяжных потолках — расчёт, выбор, цены, сроки." };

function localAnswer(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("привет") || s.includes("здравств")) return "Здравствуйте! Чем могу помочь?";
  if (s.includes("каталог"))                          return "Посмотрите каталог в нижней панели — там все виды потолков с ценами!";
  if (s.includes("калькулятор") || s.includes("рассч")) return "Используйте калькулятор в нижней панели — введите площадь и получите цену!";
  if (s.includes("цена") || s.includes("стоим") || s.includes("сколько")) return "Цены от 249 ₽/м². Точный расчёт — через калькулятор в меню ниже.";
  if (s.includes("гарантия"))  return "Даём письменную гарантию 12 лет на все виды потолков.";
  if (s.includes("монтаж") || s.includes("установ")) return "Монтаж одной комнаты — 3–5 часов. Работаем по всей Москве и области.";
  return "Спросите про каталог, калькулятор или портфолио — помогу разобраться!";
}

// ─── Панель: Каталог ──────────────────────────────────────────────────────────
function PanelCatalog() {
  const colors: Record<string, string> = {
    gloss: "from-blue-600 to-cyan-500", matte: "from-slate-500 to-zinc-400",
    satin: "from-amber-500 to-yellow-400", fabric: "from-emerald-600 to-teal-500",
    stars: "from-violet-700 to-indigo-600", photo: "from-rose-600 to-pink-500",
    multilevel: "from-orange-600 to-red-500", stretch3d: "from-fuchsia-600 to-purple-600",
  };
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CATALOG.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 hover:border-white/15 transition-all group overflow-hidden cursor-pointer"
            onClick={() => alert(`${item.name}\n\n${item.desc}\n\nЦена: от ${item.price} ₽/м²`)}
          >
            <div className={`h-14 bg-gradient-to-br ${colors[item.id] ?? "from-slate-700 to-slate-600"} flex items-center justify-center text-2xl`}>
              🏠
            </div>
            <div className="p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-white font-semibold text-xs truncate">{item.name}</span>
                {item.popular && <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full shrink-0">Хит</span>}
              </div>
              <div className="text-[10px] text-white/35 mb-2 leading-snug line-clamp-2">{item.desc.slice(0, 55)}…</div>
              <div className="flex items-center justify-between">
                <span className="text-orange-400 font-bold text-xs">от {item.price} ₽/м²</span>
                <button
                  className="text-[9px] bg-white/8 hover:bg-white/15 text-white/55 px-2 py-1 rounded-lg transition-colors"
                  onClick={(e) => { e.stopPropagation(); alert(`${item.name}\n\n${item.desc}\n\nЦена: от ${item.price} ₽/м²`); }}
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

// ─── Панель: Калькулятор ──────────────────────────────────────────────────────
function PanelCalc() {
  const [area, setArea] = useState("");
  const [roomIdx, setRoomIdx] = useState(0);
  const [typeId, setTypeId] = useState("matte");
  const [result, setResult] = useState<number | null>(null);

  const calc = () => {
    const a = parseFloat(area);
    if (!a || a <= 0) return;
    const item = CATALOG.find((c) => c.id === typeId) ?? CATALOG[1];
    const room = ROOMS[roomIdx];
    const total = Math.round(a * room.koef * (item.price + 350));
    setResult(total);
  };

  return (
    <div className="h-full flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-sm space-y-3.5">
        <div className="text-center mb-2">
          <div className="text-2xl mb-1">🧮</div>
          <div className="text-white font-semibold text-sm">Быстрый расчёт стоимости</div>
          <div className="text-white/40 text-xs mt-0.5">Введите площадь, выберите тип — получите цену</div>
        </div>
        <div>
          <label className="text-[10px] text-white/45 uppercase tracking-wider block mb-1.5">Площадь, м²</label>
          <input
            type="number" value={area}
            onChange={(e) => { setArea(e.target.value); setResult(null); }}
            placeholder="Например: 18"
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/45 uppercase tracking-wider block mb-1.5">Тип помещения</label>
          <select
            value={roomIdx} onChange={(e) => { setRoomIdx(+e.target.value); setResult(null); }}
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors"
          >
            {ROOMS.map((r, i) => <option key={r.name} value={i} className="bg-[#1a1a2e]">{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/45 uppercase tracking-wider block mb-1.5">Тип потолка</label>
          <select
            value={typeId} onChange={(e) => { setTypeId(e.target.value); setResult(null); }}
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors"
          >
            {CATALOG.map((c) => <option key={c.id} value={c.id} className="bg-[#1a1a2e]">{c.name} — от {c.price} ₽/м²</option>)}
          </select>
        </div>
        <button
          onClick={calc}
          className="w-full bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-95"
        >
          Рассчитать стоимость
        </button>
        {result !== null && (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/8 p-4 text-center">
            <div className="text-white/45 text-xs mb-1">Ориентировочная стоимость</div>
            <div className="text-3xl font-bold text-white mb-0.5">{result.toLocaleString("ru-RU")} ₽</div>
            <div className="text-white/35 text-xs">включая материал и монтаж</div>
            <div className="mt-2 text-[10px] text-white/22">Точную цену назовёт замерщик на бесплатном выезде</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Панель: Портфолио ────────────────────────────────────────────────────────
function PanelPortfolio() {
  const items = PORTFOLIO_ITEMS.slice(0, 9);
  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="relative rounded-xl overflow-hidden aspect-square cursor-pointer group"
            onClick={() => alert(`${item.room} • ${item.district}\n${item.type} • ${item.area} м² • ${item.year}`)}
          >
            <img src={item.img} alt={item.room} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
              <div>
                <div className="text-white text-[10px] font-semibold leading-tight">{item.type}</div>
                <div className="text-white/55 text-[9px]">{item.district} · {item.area} м²</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Панель: AI-советы ────────────────────────────────────────────────────────
function PanelAiTips({ onAsk }: { onAsk: (q: string) => void }) {
  const tips = [
    { icon: "💡", q: "Сколько стоит потолок 20 м²?" },
    { icon: "🏠", q: "Какой потолок выбрать для ванной?" },
    { icon: "⚡", q: "Что входит в стоимость монтажа?" },
    { icon: "🌟", q: "Расскажи про звёздное небо" },
    { icon: "📅", q: "Сколько времени займёт установка?" },
    { icon: "🛡️", q: "Какая гарантия на потолки?" },
  ];
  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-3xl mb-1">🤖</div>
        <div className="text-white font-semibold text-sm">Спросите AI-помощника</div>
        <div className="text-white/40 text-xs mt-1">Нажмите на вопрос — он отправится в чат выше</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tips.map((t, i) => (
          <button
            key={i}
            onClick={() => onAsk(t.q)}
            className="flex items-center gap-3 bg-white/4 hover:bg-white/7 border border-white/8 hover:border-violet-500/30 rounded-xl px-4 py-3 text-left transition-all group"
          >
            <span className="text-lg shrink-0">{t.icon}</span>
            <span className="text-white/65 group-hover:text-white text-xs transition-colors leading-snug">{t.q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Панель: Отзывы ───────────────────────────────────────────────────────────
function PanelReviews() {
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="space-y-3">
        {REVIEWS.slice(0, 4).map((r, i) => (
          <div key={i} className="rounded-2xl border border-white/8 bg-white/3 p-3.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {r.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-white font-semibold text-xs truncate">{r.name}</span>
                  <span className="text-white/30 text-[10px] shrink-0">{r.date}</span>
                </div>
                <div className="flex items-center gap-1 mb-1.5">
                  {Array.from({ length: r.rating }).map((_, j) => <span key={j} className="text-yellow-400 text-[10px]">★</span>)}
                  <span className="text-white/30 text-[10px] ml-1">{r.city}</span>
                </div>
                <p className="text-white/55 text-[11px] leading-relaxed">{r.text}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                  <span className="text-orange-400 text-[9px]">🏠</span>
                  <span className="text-white/35 text-[9px]">{r.type} · {r.area} м²</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Панель: FAQ ──────────────────────────────────────────────────────────────
function PanelFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="space-y-2">
        {FAQ.map((item, i) => (
          <div key={i} className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/4 transition-colors"
            >
              <span className="text-white text-xs font-medium leading-snug">{item.q}</span>
              <span className={`text-white/40 text-base shrink-0 transition-transform duration-200 ${open === i ? "rotate-45" : ""}`}>+</span>
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${open === i ? "max-h-40" : "max-h-0"}`}>
              <p className="px-4 pb-3.5 text-white/50 text-[11px] leading-relaxed">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Панель: Контакты ─────────────────────────────────────────────────────────
function PanelContacts({ onSent }: { onSent: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) { alert("Заполните имя и телефон"); return; }
    onSent();
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            { icon: "📞", label: "Телефон",  val: "+7 (977) 606-89-01", href: "tel:+79776068901" },
            { icon: "💬", label: "WhatsApp", val: "Написать в WhatsApp",  href: "https://wa.me/79776068901" },
            { icon: "📍", label: "Адрес",    val: "Мытищи, Пограничная 24", href: "#" },
            { icon: "🕐", label: "Часы",     val: "Пн–Вс 8:00–22:00",   href: "#" },
          ].map((c, i) => (
            <a key={i} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined}
              className="flex items-start gap-3 bg-white/4 hover:bg-white/7 border border-white/8 rounded-2xl p-3 transition-colors group"
            >
              <span className="text-xl">{c.icon}</span>
              <div>
                <div className="text-white/40 text-[9px] uppercase tracking-wider">{c.label}</div>
                <div className="text-white text-xs font-medium mt-0.5 group-hover:text-violet-300 transition-colors">{c.val}</div>
              </div>
            </a>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-2.5">
          <div className="text-[10px] text-white/35 uppercase tracking-wider">Обратная связь</div>
          <div className="grid grid-cols-2 gap-2.5">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя"
              className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон"
              className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20" />
          </div>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Комментарий (необязательно)" rows={2}
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20 resize-none" />
          <button type="submit"
            className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-95">
            Отправить заявку
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function Index() {
  const [section, setSection] = useState<Section>("catalog");
  const [messages, setMessages] = useState<Msg[]>([INITIAL]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  const chatRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Авто-скролл чата вниз
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing]);

  // Авто-высота textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "38px";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
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

  const active = MENU.find((m) => m.id === section)!;

  return (
    // overflow-hidden на корне — запрет скролла страницы
    <div className="bg-[#08080d] text-white font-rubik flex flex-col" style={{ height: "100dvh", overflow: "hidden" }}>

      {/* ── Шапка ───────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 px-4 border-b border-white/8 bg-[#0c0c14]/90 backdrop-blur z-10" style={{ height: 48 }}>
        <img
          src="https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png"
          alt="logo" className="w-7 h-7 object-contain" style={{ mixBlendMode: "screen" }}
        />
        <span className="font-montserrat font-black text-sm tracking-wide">
          MOS<span className="text-orange-400">POTOLKI</span>
        </span>
        <div className="ml-auto hidden sm:flex items-center gap-4 text-xs text-white/40 font-montserrat">
          <a href="tel:+79776068901" className="hover:text-white transition-colors">+7 (977) 606-89-01</a>
          <span className="text-white/15">|</span>
          <span>Мытищи, Москва и область</span>
        </div>
        <div className="ml-auto sm:ml-0 flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-400 text-xs font-montserrat">AI онлайн</span>
        </div>
      </header>

      {/* ── Тело ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Левый сайдбар (только десктоп ≥1024px) ─────────────────── */}
        <nav className="hidden lg:flex shrink-0 flex-col items-center py-3 gap-1 border-r border-white/8 bg-[#0c0c14]/55" style={{ width: 96 }}>
          {MENU.map((item) => {
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-[72px] flex flex-col items-center gap-1 py-2.5 rounded-2xl border text-center transition-all ${
                  isActive
                    ? "bg-gradient-to-b from-violet-600/25 to-orange-500/15 border-violet-500/40 text-white"
                    : "border-transparent text-white/35 hover:text-white/65 hover:bg-white/4"
                }`}
              >
                <span className="text-2xl leading-none">{item.emoji}</span>
                <span className="text-[9px] font-montserrat font-semibold uppercase tracking-wide leading-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Правая область ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">

          {/* ── AI-чат (верхние 45%) ──────────────────────────────────── */}
          <div className="shrink-0 flex flex-col border-b border-white/8" style={{ height: "45%" }}>

            {/* Заголовок чата */}
            <div className="shrink-0 flex items-center gap-2.5 px-4 py-2 border-b border-white/6 bg-[#0e0e1a]/55">
              <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center">
                <Icon name="Bot" size={13} className="text-violet-400" />
              </div>
              <div>
                <div className="text-xs font-semibold">AI-помощник MOSPOTOLKI</div>
                <div className="text-[10px] text-green-400">● Онлайн</div>
              </div>
              <button
                onClick={() => setMessages([INITIAL])}
                className="ml-auto text-white/20 hover:text-white/50 transition-colors p-1"
                title="Очистить чат"
              >
                <Icon name="RotateCcw" size={12} />
              </button>
            </div>

            {/* История сообщений */}
            <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scroll-smooth">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-br-sm"
                      : "bg-white/6 border border-white/8 text-white/80 rounded-bl-sm"
                  }`}>
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

            {/* Поле ввода */}
            <div className="shrink-0 px-3 py-2 border-t border-white/6">
              <form onSubmit={(e) => { e.preventDefault(); sendMsg(input); }} className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(input); } }}
                  placeholder="Написать сообщение…"
                  rows={1}
                  style={{ height: 38, maxHeight: 96, resize: "none" }}
                  className="flex-1 bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2 text-white text-xs outline-none transition-colors placeholder:text-white/22 overflow-y-auto"
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

          {/* ── Динамическая панель (нижние 55%) ────────────────────── */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

            {/* Заголовок панели */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-white/8 bg-[#0e0e1a]/35">
              <span className="text-base leading-none">{active.emoji}</span>
              <span className="text-xs font-semibold text-white/75">{active.label}</span>
              {/* Мини-табы */}
              <div className="ml-auto flex items-center gap-1">
                {MENU.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSection(m.id)}
                    title={m.label}
                    className={`px-2 py-1 rounded-lg text-[10px] font-montserrat transition-all ${
                      section === m.id
                        ? "bg-violet-600/35 border border-violet-500/45 text-violet-300"
                        : "text-white/22 hover:text-white/50"
                    }`}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Контент */}
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
                    <div className="text-white font-semibold">Заявка отправлена!</div>
                    <div className="text-white/40 text-sm">Перезвоним в течение 15 минут</div>
                    <button onClick={() => setContactSent(false)} className="mt-1 text-violet-400 text-xs hover:text-violet-300 underline">
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

      {/* ── Нижний таббар (мобилки/планшеты < 1024px) ──────────────────── */}
      <nav className="lg:hidden shrink-0 flex items-stretch border-t border-white/8 bg-[#0c0c14]/95 backdrop-blur overflow-x-auto">
        {MENU.map((item) => {
          const isActive = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-[48px] transition-all relative ${
                isActive ? "text-white" : "text-white/32 hover:text-white/60"
              }`}
            >
              {isActive && <span className="absolute top-0 inset-x-2 h-0.5 bg-gradient-to-r from-violet-500 to-orange-500 rounded-full" />}
              <span className="text-lg leading-none">{item.emoji}</span>
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
