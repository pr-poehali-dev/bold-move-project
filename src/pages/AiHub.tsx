import { useState, useCallback } from "react";
import { Section, Msg, MENU, AI_URL, localAnswer } from "./AiHubTypes";
import AiHubChat from "./AiHubChat";
import {
  PanelCatalog,
  PanelCalc,
  PanelPortfolio,
  PanelAiTips,
  PanelReviews,
  PanelFaq,
  PanelContacts,
} from "./AiHubPanels";

const INITIAL_MSG: Msg = {
  id: 0,
  role: "assistant",
  text: "Привет! Я AI-помощник MOSPOTOLKI 🤖\nЗадайте вопрос о натяжных потолках — расчёт, выбор, цены, сроки.",
};

export default function AiHub() {
  const [section, setSection] = useState<Section>("catalog");
  const [messages, setMessages] = useState<Msg[]>([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [contactSent, setContactSent] = useState(false);

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
          <AiHubChat
            messages={messages}
            input={input}
            typing={typing}
            onInput={setInput}
            onSend={sendMsg}
            onClear={() => setMessages([INITIAL_MSG])}
          />

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
