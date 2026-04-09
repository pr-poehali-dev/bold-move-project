import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { REVIEWS, FAQ, PRODUCTION } from "./data/content";
import { PORTFOLIO_ITEMS } from "./data/portfolio";
import EstimateTable, { isEstimate } from "./EstimateTable";
import func2url from "@/../backend/func2url.json";

type Panel = "none" | "production" | "portfolio" | "tips" | "reviews" | "faq";
interface Msg { id: number; role: "user" | "assistant"; text: string; }

const AVATAR = "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/ccbf2c15-829b-4295-9f12-5691f81cf726.jpg";
const AI_URL = func2url["ai-chat"];
const GREETING: Msg = { id: 0, role: "assistant", text: "Привет! Я Алиса — ваш персональный консультант по натяжным потолкам 👋\n\nЗнаю предложения 50+ компаний Москвы. Спросите что угодно — найду лучшую цену, сравню варианты и рассчитаю стоимость." };

const NAV: { id: Panel; label: string; icon: string }[] = [
  { id: "production", label: "Производство", icon: "Factory"    },
  { id: "portfolio",  label: "Портфолио",    icon: "Image"      },
  { id: "tips",       label: "AI-советы",    icon: "Sparkles"   },
  { id: "reviews",    label: "Отзывы",       icon: "Heart"      },
  { id: "faq",        label: "FAQ",           icon: "HelpCircle" },
];

function localAnswer(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("привет") || s.includes("здравств")) return "Рада знакомству! Расскажите, какой потолок вам нужен — помогу найти лучший вариант на рынке.";
  if (s.includes("каталог") || s.includes("вид"))     return "Смотрите — на рынке 8 основных типов потолков. Матовый от 249 ₽/м² — самый популярный. Глянец от 299 ₽. Звёздное небо — премиум от 1200 ₽. Что ближе вам?";
  if (s.includes("калькулятор") || s.includes("рассч")) return "Конечно! Откройте калькулятор в меню — там я сравню нашу цену со средней по Москве. Вы увидите экономию.";
  if (s.includes("цена") || s.includes("стоим") || s.includes("сколько")) return "По данным рынка Москвы: матовый от 249 ₽/м², глянец от 299 ₽/м², тканевый от 399 ₽/м². Назовите площадь — посчитаю точнее и покажу, сколько сэкономите.";
  if (s.includes("гарантия"))  return "Средняя гарантия по рынку — 5-10 лет. Мы даём 12 лет письменно. За 15 лет работы — ни одного гарантийного случая. Это проверенная надёжность.";
  if (s.includes("монтаж") || s.includes("установ")) return "Обычно компании делают за 1-3 дня. Мы — за 3-5 часов на одну комнату. Два мастера, без мусора, без запаха. Квартира целиком — 1 день.";
  if (s.includes("конкурент") || s.includes("сравн")) return "Я анализирую 50+ компаний Москвы. Наши цены на 15-20% ниже среднерыночных, а гарантия — одна из лучших на рынке (12 лет).";
  return "Отличный вопрос! Я знаю рынок натяжных потолков Москвы вдоль и поперёк. Спросите о ценах, материалах, гарантии или сроках — дам честное сравнение.";
}

// ─── Panels ──────────────────────────────────────────────────────────────────

function PanelProduction({ onClose }: { onClose: () => void }) {
  const features = [
    { icon: "Award",    label: "Плёнка MSD Premium" },
    { icon: "Ruler",    label: "Точность до 1 мм" },
    { icon: "FileCheck", label: "Сертификаты ISO" },
    { icon: "Truck",    label: "Доставка за 1 день" },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Icon name="Factory" size={15} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white/80">Собственное производство</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all">
          <Icon name="X" size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {PRODUCTION.map((item, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden group">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-2.5">
                <div className="text-white font-medium text-xs mb-1">{item.title}</div>
                <div className="text-white/35 text-[10px] leading-relaxed line-clamp-2">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Icon name={f.icon} size={13} className="text-emerald-400" />
              </div>
              <span className="text-white/50 text-[11px] font-medium leading-tight">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelPortfolio({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Icon name="Image" size={15} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white/80">Наши работы</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all"><Icon name="X" size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {PORTFOLIO_ITEMS.slice(0, 12).map((item, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden aspect-square cursor-pointer group"
              onClick={() => alert(`${item.room} • ${item.district}\n${item.type} • ${item.area} м²`)}>
              <img src={item.img} alt={item.room} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <div>
                  <div className="text-white text-[10px] font-semibold">{item.type}</div>
                  <div className="text-white/50 text-[9px]">{item.district} · {item.area} м²</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelTips({ onAsk, onClose }: { onAsk: (q: string) => void; onClose: () => void }) {
  const tips = [
    { icon: "TrendingDown", q: "Сравни цены на матовый потолок" },
    { icon: "Search",       q: "Какой потолок лучше для ванной?" },
    { icon: "BarChart3",    q: "Средние цены по Москве" },
    { icon: "Shield",       q: "Расскажи про гарантию" },
    { icon: "Zap",          q: "Кто делает монтаж за 1 день?" },
    { icon: "Calculator",   q: "Рассчитай потолок на 3 комнаты" },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Icon name="Sparkles" size={15} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white/80">Спросите Алису</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all"><Icon name="X" size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tips.map((t, i) => (
            <button key={i} onClick={() => onAsk(t.q)}
              className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-emerald-500/20 rounded-xl px-4 py-3 text-left transition-all group">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-emerald-500/10 flex items-center justify-center shrink-0 transition-colors">
                <Icon name={t.icon} size={14} className="text-white/30 group-hover:text-emerald-400 transition-colors" />
              </div>
              <span className="text-white/50 group-hover:text-white/80 text-xs transition-colors">{t.q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelReviews({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Icon name="Heart" size={15} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white/80">Отзывы клиентов</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all"><Icon name="X" size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {REVIEWS.slice(0, 5).map((r, i) => (
          <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 flex gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/50 to-teal-500/50 flex items-center justify-center text-white font-bold text-xs shrink-0">{r.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white font-medium text-xs">{r.name}</span>
                <span className="text-white/20 text-[10px]">{r.date}</span>
              </div>
              <div className="text-amber-400 text-[10px] mb-1.5">{"★".repeat(r.rating)} <span className="text-white/20 ml-1">{r.city}</span></div>
              <p className="text-white/40 text-[11px] leading-relaxed line-clamp-2">{r.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelFaq({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Icon name="HelpCircle" size={15} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white/80">Частые вопросы</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all"><Icon name="X" size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {FAQ.map((item, i) => (
          <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
              <span className="text-white text-xs font-medium">{item.q}</span>
              <Icon name={open === i ? "ChevronUp" : "ChevronDown"} size={14} className="text-white/25 shrink-0" />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${open === i ? "max-h-40" : "max-h-0"}`}>
              <p className="px-4 pb-3 text-white/35 text-[11px] leading-relaxed">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Index() {
  const [panel, setPanel] = useState<Panel>("none");
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages, typing]);
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = "42px"; el.style.height = Math.min(el.scrollHeight, 100) + "px"; }, [input]);

  const sendMsg = useCallback((text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Msg = { id: Date.now(), role: "user", text: text.trim() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setTyping(true);
    const history = [...messages, userMsg].map((m) => ({ role: m.role, text: m.text }));
    fetch(AI_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }) })
      .then((r) => r.json())
      .then((d) => setMessages((p) => [...p, { id: Date.now() + 1, role: "assistant", text: d.answer || localAnswer(text) }]))
      .catch(() => setMessages((p) => [...p, { id: Date.now() + 1, role: "assistant", text: localAnswer(text) }]))
      .finally(() => setTyping(false));
  }, [messages, typing]);

  const askFromPanel = (q: string) => { setPanel("none"); setTimeout(() => sendMsg(q), 100); };
  const closePanel = () => setPanel("none");
  const hasPanel = panel !== "none";

  return (
    <div className="bg-[#0b0b11] text-white font-rubik flex flex-col select-none" style={{ height: "100dvh", overflow: "hidden" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center h-12 px-4 md:px-6 border-b border-white/[0.05] bg-[#0d0d14]/80 backdrop-blur-xl z-30">
        <img src="https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png" alt="" className="w-6 h-6 object-contain mr-2.5" style={{ mixBlendMode: "screen" }} />
        <span className="font-montserrat font-black text-sm tracking-wide">MOS<span className="text-emerald-400">POTOLKI</span></span>

        <div className="ml-auto flex items-center gap-2.5">
          <a href="tel:+79776068901" className="hidden sm:flex items-center gap-1.5 text-white/30 hover:text-white/60 text-[11px] transition-colors">
            <Icon name="Phone" size={12} /> +7 (977) 606-89-01
          </a>
          <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/8 border border-emerald-500/15 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/12 transition-all">
            <Icon name="MessageCircle" size={12} /> WhatsApp
          </a>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col relative">

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/[0.04] rounded-full blur-[120px]" />
        </div>

        {/* ── Chat Area (центр — основа) ──────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col relative z-10">

          {/* Messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-3 scroll-smooth">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-end gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "assistant" && (
                  <img src={AVATAR} alt="Алиса" className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-emerald-500/20 shadow-lg shadow-emerald-500/10" />
                )}
                <div className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "max-w-[75%] md:max-w-[60%] bg-white/[0.08] border border-white/[0.08] text-white/90 rounded-br-md whitespace-pre-wrap"
                    : m.role === "assistant" && isEstimate(m.text)
                      ? "max-w-[90%] md:max-w-[75%] w-full bg-white/[0.03] border border-white/[0.06] rounded-bl-md"
                      : "max-w-[75%] md:max-w-[60%] bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.06] text-white/70 rounded-bl-md whitespace-pre-wrap"
                }`}>
                  {m.role === "assistant" && isEstimate(m.text) ? (
                    <EstimateTable text={m.text} />
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex items-end gap-2.5">
                <img src={AVATAR} alt="Алиса" className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-emerald-500/20" />
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Icon name="Loader2" size={14} className="text-emerald-400 animate-spin" />
                  <span className="text-white/25 text-xs">Алиса анализирует…</span>
                </div>
              </div>
            )}

            {/* Quick suggestions (only initial) */}
            {messages.length <= 1 && !typing && (
              <div className="flex flex-wrap gap-2 pt-1 pl-11">
                {["Сколько стоит потолок?", "Сравни с конкурентами", "Расчёт на 20 м²"].map((q) => (
                  <button key={q} onClick={() => sendMsg(q)}
                    className="text-[11px] bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-emerald-500/25 text-white/40 hover:text-white/70 px-3.5 py-2 rounded-xl transition-all">
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Navigation pills ──────────────────────────────────── */}
          <div className="shrink-0 px-4 md:px-8 pb-2">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1" style={{ scrollbarWidth: "none" }}>
              {NAV.map((n) => {
                const isActive = panel === n.id;
                return (
                  <button key={n.id}
                    onClick={() => setPanel(isActive ? "none" : n.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-lg shadow-emerald-500/5"
                        : "bg-white/[0.04] text-white/35 border border-white/[0.05] hover:text-white/55 hover:bg-white/[0.06]"
                    }`}>
                    <Icon name={n.icon} size={14} />
                    {n.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Input ─────────────────────────────────────────────── */}
          <div className="shrink-0 px-4 md:px-8 pb-3 pt-1">
            <form onSubmit={(e) => { e.preventDefault(); sendMsg(input); }}
              className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.07] focus-within:border-emerald-500/30 rounded-2xl px-3 py-2 transition-all">
              <img src={AVATAR} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 opacity-60 hidden sm:block" />
              <textarea
                ref={inputRef} value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(input); } }}
                placeholder="Спросите Алису о потолках…"
                rows={1} style={{ height: 42, maxHeight: 100, resize: "none" }}
                className="flex-1 bg-transparent text-white text-[13px] outline-none placeholder:text-white/20 overflow-y-auto py-1.5"
              />
              <button type="submit" disabled={!input.trim() || typing}
                className="shrink-0 w-9 h-9 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-20 rounded-xl transition-all active:scale-95">
                <Icon name="ArrowUp" size={16} className="text-white" />
              </button>
            </form>
            <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-white/15">
              <Icon name="Shield" size={10} />
              <span>AI-консультант · Анализ 50+ компаний Москвы</span>
            </div>
          </div>
        </div>

        {/* ── Slide-up Panel ──────────────────────────────────────── */}
        <div className={`absolute inset-x-0 bottom-0 z-20 transition-all duration-300 ease-out ${
          hasPanel ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
          style={{ height: "55%", maxHeight: "55%" }}>
          <div className="h-full bg-[#0e0e15]/98 backdrop-blur-2xl border-t border-white/[0.08] rounded-t-2xl overflow-hidden shadow-2xl shadow-black/50">
            {panel === "production" && <PanelProduction onClose={closePanel} />}
            {panel === "portfolio" && <PanelPortfolio onClose={closePanel} />}
            {panel === "tips"      && <PanelTips onAsk={askFromPanel} onClose={closePanel} />}
            {panel === "reviews"   && <PanelReviews onClose={closePanel} />}
            {panel === "faq"       && <PanelFaq onClose={closePanel} />}
          </div>
        </div>

        {/* Overlay when panel open */}
        {hasPanel && (
          <div className="absolute inset-0 z-15 bg-black/30 backdrop-blur-sm" onClick={closePanel} style={{ zIndex: 15 }} />
        )}
      </div>

      {/* ── Mobile bottom CTA ──────────────────────────────────────── */}
      <div className="sm:hidden shrink-0 flex items-center gap-2 px-3 py-2 border-t border-white/[0.05] bg-[#0d0d14]/95 backdrop-blur-xl">
        <a href="tel:+79776068901" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.05] text-white/50 text-[11px] font-medium">
          <Icon name="Phone" size={13} /> Позвонить
        </a>
        <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
          <Icon name="MessageCircle" size={13} /> WhatsApp
        </a>
      </div>
    </div>
  );
}