import { useState, useCallback } from "react";
import { Section, Msg, MENU, AI_URL, localAnswer } from "./AiHubTypes";
import Icon from "@/components/ui/icon";
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

    const history = [...messages, userMsg].slice(-6).map((m) => ({ role: m.role, text: m.text }));

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
          <span className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-green-400 text-xs">AI онлайн</span>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar (desktop left) — dock-style ──────────────── */}
        <nav className="hidden lg:flex shrink-0 w-[76px] flex-col items-center py-4 gap-2 border-r border-white/8 bg-[#0c0c16]/60 overflow-y-auto">
          {MENU.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                aria-label={item.label}
                className={`dock-btn group relative w-12 h-12 grid place-items-center rounded-xl ring-1 backdrop-blur-xl shadow-lg transition-all duration-200 hover:scale-105 ${
                  active
                    ? "bg-gradient-to-b from-violet-600/40 to-orange-500/30 ring-violet-500/50 text-white"
                    : "bg-gradient-to-b from-neutral-800/60 to-neutral-900/70 ring-white/10 text-white/50 hover:text-white"
                }`}
              >
                <Icon name={item.icon} size={16} />
                {active && <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-violet-400" />}
                <span className="pointer-events-none absolute left-full ml-3 w-max max-w-[170px] rounded-xl bg-neutral-900/95 px-3 py-2 ring-1 ring-white/10 shadow-xl opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 z-50">
                  <span className="block text-[11px] font-semibold text-white leading-tight">{item.label}</span>
                  <span className="block text-[9px] text-white/50 leading-snug mt-0.5">{item.hint}</span>
                  <span className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-neutral-900/95 ring-1 ring-white/10 rotate-45 rounded-sm" />
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
              <div className="ml-auto flex items-center gap-1.5 rounded-2xl bg-neutral-900/70 ring-1 ring-white/8 px-2 py-1.5 backdrop-blur">
                {MENU.map((m) => {
                  const active = section === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSection(m.id)}
                      aria-label={m.label}
                      title={m.label}
                      className={`grid h-7 w-7 place-items-center rounded-lg ring-1 transition-all duration-200 ${
                        active
                          ? "bg-gradient-to-b from-violet-600/40 to-orange-500/30 ring-violet-500/40 text-white"
                          : "bg-neutral-800/50 ring-white/8 text-white/40 hover:text-white/70 hover:bg-neutral-700/50"
                      }`}
                    >
                      <Icon name={m.icon} size={12} />
                    </button>
                  );
                })}
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

      {/* ── Bottom dock bar (mobile / tablet) ────────────────────────── */}
      <nav className="lg:hidden shrink-0 flex justify-center items-center gap-1.5 px-3 py-2.5 border-t border-white/8 bg-[#0c0c16]/95 backdrop-blur-lg overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <div className="flex items-center gap-1.5 rounded-[28px] bg-neutral-900/80 px-3 py-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-lg">
          {MENU.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                aria-label={item.label}
                className={`dock-btn group relative grid h-10 w-10 place-items-center rounded-xl ring-1 backdrop-blur-xl shadow-lg transition-all duration-200 hover:-translate-y-1 hover:scale-105 ${
                  active
                    ? "bg-gradient-to-b from-violet-600/40 to-orange-500/30 ring-violet-500/50 text-white"
                    : "bg-gradient-to-b from-neutral-800/60 to-neutral-900/70 ring-white/10 text-white/50 hover:text-white"
                }`}
              >
                <Icon name={item.icon} size={15} />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400" />
                )}
                <span className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-max max-w-[150px] rounded-xl bg-neutral-900/95 px-3 py-2 text-center ring-1 ring-white/10 shadow-xl opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 z-50">
                  <span className="block text-[11px] font-semibold text-white leading-tight">{item.label}</span>
                  <span className="block text-[9px] text-white/50 leading-snug mt-0.5">{item.hint}</span>
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-neutral-900/95 ring-1 ring-white/10 rotate-45 rounded-sm" />
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}