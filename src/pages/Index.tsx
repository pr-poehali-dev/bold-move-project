import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { CATALOG, ROOMS } from "./data/catalog";
import { REVIEWS, FAQ } from "./data/content";
import { PORTFOLIO_ITEMS } from "./data/portfolio";
import func2url from "@/../backend/func2url.json";

type Tab = "calc" | "portfolio" | "ai" | "reviews" | "faq";
interface Msg { id: number; role: "user" | "assistant"; text: string; }

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "calc",      label: "Калькулятор", icon: "Calculator" },
  { id: "portfolio", label: "Портфолио",   icon: "Image"      },
  { id: "ai",        label: "AI-советы",   icon: "Sparkles"   },
  { id: "reviews",   label: "Отзывы",      icon: "Star"       },
  { id: "faq",       label: "FAQ",          icon: "HelpCircle" },
];

const AI_URL = func2url["ai-chat"];
const GREETING: Msg = {
  id: 0, role: "assistant",
  text: "Привет! Я анализирую весь рынок натяжных потолков Москвы 🔍\n\nСпросите — сравню цены конкурентов, подберу лучшее предложение и рассчитаю стоимость за секунды.",
};

function localAnswer(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("привет") || s.includes("здравств"))     return "Здравствуйте! Спросите что угодно — я анализирую предложения по всему рынку.";
  if (s.includes("каталог") || s.includes("вид"))          return "Анализирую 8+ типов потолков: от матовых за 249 ₽/м² до звёздного неба за 1200 ₽/м². Какой тип вас интересует?";
  if (s.includes("калькулятор") || s.includes("рассч"))    return "Используйте вкладку «Калькулятор» выше — введите площадь и получите рыночную цену с учётом монтажа.";
  if (s.includes("цена") || s.includes("стоим") || s.includes("сколько")) return "По данным рынка: матовый от 249 ₽/м², глянец от 299 ₽/м², тканевый от 399 ₽/м². Назовите площадь — рассчитаю точнее.";
  if (s.includes("гарантия"))   return "Стандарт рынка — 5-10 лет. Мы даём 12 лет письменно — это выше среднего по Москве.";
  if (s.includes("монтаж") || s.includes("установ")) return "Средний срок по рынку — 1-3 дня. Мы монтируем за 3-5 часов (одна комната) или за 1 день (вся квартира).";
  if (s.includes("конкурент") || s.includes("сравн"))  return "Анализирую 50+ компаний Москвы. Наши цены на 15-20% ниже среднерыночных при гарантии 12 лет.";
  return "Я анализирую весь рынок натяжных потолков Москвы. Спросите о ценах, сроках, гарантии или типах — дам объективное сравнение.";
}

// ─── Панели ──────────────────────────────────────────────────────────────────

function PanelCalc() {
  const [area, setArea] = useState("");
  const [roomIdx, setRoomIdx] = useState(0);
  const [typeId, setTypeId] = useState("matte");
  const [result, setResult] = useState<{ours:number; market:number; save:number} | null>(null);

  const calc = () => {
    const a = parseFloat(area);
    if (!a || a <= 0) return;
    const item = CATALOG.find((c) => c.id === typeId) ?? CATALOG[1];
    const room = ROOMS[roomIdx];
    const ours = Math.round(a * room.koef * (item.price + 350));
    const market = Math.round(ours * 1.22);
    setResult({ ours, market, save: market - ours });
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5">
      <div className="max-w-lg mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1.5">Площадь, м²</label>
            <input type="number" value={area} onChange={(e) => { setArea(e.target.value); setResult(null); }} placeholder="18"
              className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1.5">Помещение</label>
            <select value={roomIdx} onChange={(e) => { setRoomIdx(+e.target.value); setResult(null); }}
              className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all">
              {ROOMS.map((r, i) => <option key={r.name} value={i} className="bg-[#12121a]">{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1.5">Тип потолка</label>
          <select value={typeId} onChange={(e) => { setTypeId(e.target.value); setResult(null); }}
            className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all">
            {CATALOG.map((c) => <option key={c.id} value={c.id} className="bg-[#12121a]">{c.name} — от {c.price} ₽/м²</option>)}
          </select>
        </div>
        <button onClick={calc}
          className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]">
          Рассчитать с анализом рынка
        </button>
        {result && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <div className="text-[10px] text-white/35 mb-1">Среднее по рынку</div>
              <div className="text-base font-bold text-white/50 line-through">{result.market.toLocaleString("ru-RU")} ₽</div>
            </div>
            <div className="rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 p-3 text-center">
              <div className="text-[10px] text-emerald-400/70 mb-1">Наша цена</div>
              <div className="text-xl font-bold text-emerald-400">{result.ours.toLocaleString("ru-RU")} ₽</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <div className="text-[10px] text-white/35 mb-1">Экономия</div>
              <div className="text-base font-bold text-amber-400">{result.save.toLocaleString("ru-RU")} ₽</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PanelPortfolio() {
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {PORTFOLIO_ITEMS.slice(0, 10).map((item, i) => (
          <div key={i} className="relative rounded-xl overflow-hidden aspect-square cursor-pointer group"
            onClick={() => alert(`${item.room} • ${item.district}\n${item.type} • ${item.area} м²`)}>
            <img src={item.img} alt={item.room} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
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

function PanelAiTips({ onAsk }: { onAsk: (q: string) => void }) {
  const tips = [
    { icon: "TrendingDown", q: "Сравни цены на матовый потолок" },
    { icon: "Search",       q: "Какой потолок лучше для ванной?" },
    { icon: "BarChart3",    q: "Средние цены по Москве на 2026" },
    { icon: "Shield",       q: "У кого самая большая гарантия?" },
    { icon: "Zap",          q: "Кто делает монтаж за 1 день?" },
    { icon: "Calculator",   q: "Рассчитай потолок на 3 комнаты" },
  ];
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 mb-3">
            <Icon name="Brain" size={22} className="text-emerald-400" />
          </div>
          <div className="text-white font-semibold text-sm">Что может AI-аналитик?</div>
          <div className="text-white/35 text-xs mt-1">Анализирует 50+ компаний, сравнивает цены и находит лучшее</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tips.map((t, i) => (
            <button key={i} onClick={() => onAsk(t.q)}
              className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-emerald-500/25 rounded-xl px-3.5 py-2.5 text-left transition-all group">
              <div className="w-7 h-7 rounded-lg bg-white/[0.04] group-hover:bg-emerald-500/15 flex items-center justify-center shrink-0 transition-colors">
                <Icon name={t.icon} size={13} className="text-white/40 group-hover:text-emerald-400 transition-colors" />
              </div>
              <span className="text-white/55 group-hover:text-white text-xs transition-colors leading-snug">{t.q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelReviews() {
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REVIEWS.slice(0, 4).map((r, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/60 to-cyan-500/60 flex items-center justify-center text-white font-bold text-xs shrink-0">
                {r.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-xs truncate">{r.name}</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400 text-[10px]">{"★".repeat(r.rating)}</span>
                  <span className="text-white/25 text-[10px]">{r.city}</span>
                </div>
              </div>
              <span className="text-white/20 text-[10px] shrink-0">{r.date}</span>
            </div>
            <p className="text-white/45 text-[11px] leading-relaxed line-clamp-3">{r.text}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-white/25">
              <span className="px-1.5 py-0.5 rounded bg-white/[0.04]">{r.type}</span>
              <span>{r.area} м²</span>
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
      <div className="max-w-lg mx-auto space-y-2">
        {FAQ.map((item, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors">
              <span className="text-white text-xs font-medium leading-snug">{item.q}</span>
              <Icon name={open === i ? "Minus" : "Plus"} size={14} className="text-white/30 shrink-0" />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${open === i ? "max-h-40" : "max-h-0"}`}>
              <p className="px-4 pb-3.5 text-white/40 text-[11px] leading-relaxed">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Index() {
  const [tab, setTab] = useState<Tab>("calc");
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const chatRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "40px";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  }, [input]);

  const sendMsg = useCallback((text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Msg = { id: Date.now(), role: "user", text: text.trim() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setTyping(true);
    const history = [...messages, userMsg].map((m) => ({ role: m.role, text: m.text }));
    fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then((r) => r.json())
      .then((d) => setMessages((p) => [...p, { id: Date.now() + 1, role: "assistant", text: d.answer || localAnswer(text) }]))
      .catch(() => setMessages((p) => [...p, { id: Date.now() + 1, role: "assistant", text: localAnswer(text) }]))
      .finally(() => setTyping(false));
  }, [messages, typing]);

  const handleAsk = (q: string) => { sendMsg(q); setTab("ai"); };
  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <div className="bg-[#0a0a10] text-white font-rubik flex flex-col" style={{ height: "100dvh", overflow: "hidden" }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-white/[0.06] bg-[#0d0d14]/90 backdrop-blur-xl z-20">
        <div className="flex items-center h-12 px-4 md:px-6">
          <img src="https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png" alt="" className="w-6 h-6 object-contain mr-2" style={{ mixBlendMode: "screen" }} />
          <span className="font-montserrat font-black text-sm tracking-wide mr-3">
            MOS<span className="text-emerald-400">POTOLKI</span>
          </span>
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/15">
            <Icon name="Brain" size={12} className="text-emerald-400" />
            <span className="text-emerald-400 text-[10px] font-semibold tracking-wide">AI-АНАЛИТИК РЫНКА</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <a href="tel:+79776068901" className="hidden sm:flex items-center gap-1.5 text-white/35 hover:text-white/60 text-xs transition-colors">
              <Icon name="Phone" size={12} />
              +7 (977) 606-89-01
            </a>
            <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/15 transition-all">
              <Icon name="MessageCircle" size={12} />
              WhatsApp
            </a>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-[11px]">online</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.06] bg-[#0c0c13]/60 backdrop-blur-sm">
        <div className="flex items-center gap-1 px-3 md:px-5 py-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-emerald-500/[0.12] text-emerald-400 border border-emerald-500/25"
                    : "text-white/30 hover:text-white/55 hover:bg-white/[0.03] border border-transparent"
                }`}>
                <Icon name={t.icon} size={13} />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.slice(0, 5)}</span>
              </button>
            );
          })}
          <div className="ml-auto shrink-0 flex items-center gap-1.5 text-[10px] text-white/20 font-medium">
            <Icon name="Activity" size={11} className="text-emerald-500/40" />
            <span className="hidden md:inline">50+ компаний в анализе</span>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

        {/* ── AI Chat (левая/верхняя часть) ──────────────────────── */}
        <div className="flex flex-col lg:w-[45%] min-h-0 border-b lg:border-b-0 lg:border-r border-white/[0.06]" style={{ height: "48%", minHeight: 0 }}>

          {/* AI identity bar */}
          <div className="shrink-0 flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.04] bg-gradient-to-r from-emerald-500/[0.03] to-transparent">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/15 flex items-center justify-center">
                <Icon name="Brain" size={15} className="text-emerald-400" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0a0a10]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white/90">AI-аналитик рынка потолков</div>
              <div className="text-[10px] text-white/30">Анализирует цены · Сравнивает предложения · Находит лучшее</div>
            </div>
            <button onClick={() => setMessages([GREETING])}
              className="shrink-0 p-1.5 rounded-lg text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-all" title="Очистить">
              <Icon name="RotateCcw" size={13} />
            </button>
          </div>

          {/* Messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto px-3 md:px-4 py-3 space-y-2.5 scroll-smooth">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-emerald-600 to-cyan-600 text-white rounded-br-md"
                    : "bg-white/[0.04] border border-white/[0.06] text-white/75 rounded-bl-md"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2">
                  <Icon name="Loader2" size={13} className="text-emerald-400 animate-spin" />
                  <span className="text-white/30 text-xs">Анализирую рынок…</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick chips (only when fresh) */}
          {messages.length <= 1 && !typing && (
            <div className="shrink-0 px-3 md:px-4 pb-2 flex flex-wrap gap-1.5">
              {["Сравни цены", "Средние цены 2026", "Расчёт на 20 м²"].map((q) => (
                <button key={q} onClick={() => sendMsg(q)}
                  className="text-[11px] bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-emerald-500/25 text-white/40 hover:text-white/70 px-3 py-1.5 rounded-lg transition-all">
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="shrink-0 px-3 md:px-4 py-2.5 border-t border-white/[0.04]">
            <form onSubmit={(e) => { e.preventDefault(); sendMsg(input); }} className="flex items-end gap-2">
              <textarea
                ref={inputRef} value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(input); } }}
                placeholder="Спросите о ценах, сравнении, подборе…"
                rows={1} style={{ height: 40, maxHeight: 96, resize: "none" }}
                className="flex-1 bg-white/[0.03] border border-white/[0.07] focus:border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-white text-[13px] outline-none transition-all placeholder:text-white/20 overflow-y-auto"
              />
              <button type="submit" disabled={!input.trim() || typing}
                className="shrink-0 w-10 h-10 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-25 rounded-xl transition-all active:scale-95">
                <Icon name="ArrowUp" size={16} className="text-white" />
              </button>
            </form>
          </div>
        </div>

        {/* ── Dynamic Panel (правая/нижняя часть) ────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] bg-white/[0.01]">
            <Icon name={activeTab.icon} size={14} className="text-emerald-400/60" />
            <span className="text-xs font-medium text-white/50">{activeTab.label}</span>
          </div>
          {/* Panel content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === "calc"      && <PanelCalc />}
            {tab === "portfolio" && <PanelPortfolio />}
            {tab === "ai"        && <PanelAiTips onAsk={handleAsk} />}
            {tab === "reviews"   && <PanelReviews />}
            {tab === "faq"       && <PanelFaq />}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom bar ───────────────────────────────────────── */}
      <div className="lg:hidden shrink-0 border-t border-white/[0.06] bg-[#0c0c13]/95 backdrop-blur-xl flex items-center justify-between px-2 py-1.5">
        <a href="tel:+79776068901" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] text-white/50 text-[11px]">
          <Icon name="Phone" size={13} />
          <span>Звонок</span>
        </a>
        <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-medium">
          <Icon name="MessageCircle" size={13} />
          WhatsApp
        </a>
        <button onClick={() => setTab("calc")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] text-white/50 text-[11px]">
          <Icon name="Calculator" size={13} />
          Расчёт
        </button>
      </div>
    </div>
  );
}
