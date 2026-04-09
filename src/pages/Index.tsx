import { useState, useCallback, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { isEstimate } from "./EstimateTable";
import { Panel, Msg, GREETING, AI_URL, localAnswer } from "./chatConfig";
import ChatUI from "./ChatUI";
import {
  PanelBooking,
  PanelProduction,
  PanelPortfolio,
  PanelTips,
  PanelReviews,
  PanelFaq,
  PanelContacts,
} from "./ChatPanels";

export default function Index() {
  const [panel, setPanel]       = useState<Panel>("none");
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput]       = useState("");
  const [typing, setTyping]     = useState(false);
  const [bookingToast, setBookingToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Показываем тост через 3 сек после получения сметы
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && isEstimate(last.text)) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setBookingToast(true), 3000);
    }
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [messages]);

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
  const closePanel   = () => setPanel("none");
  const hasPanel     = panel !== "none";

  return (
    <div className="bg-[#0b0b11] text-white font-rubik flex flex-col select-none" style={{ height: "100dvh", overflow: "hidden" }}>

      {/* Header */}
      <header className="shrink-0 flex items-center h-12 px-4 md:px-6 border-b border-white/[0.05] bg-[#0d0d14]/80 backdrop-blur-xl z-30">
        <img src="https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png" alt="" className="w-6 h-6 object-contain mr-2.5" style={{ mixBlendMode: "screen" }} />
        <span className="font-montserrat font-black text-sm tracking-wide">MOS<span className="text-orange-400">POTOLKI</span></span>
        <div className="ml-auto flex items-center gap-2.5">
          <a href="tel:+79776068901" className="hidden sm:flex items-center gap-1.5 text-white/30 hover:text-white/60 text-[11px] transition-colors">
            <Icon name="Phone" size={12} /> +7 (977) 606-89-01
          </a>
          <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-medium hover:bg-orange-500/15 transition-all">
            <Icon name="MessageCircle" size={12} /> WhatsApp
          </a>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col relative">

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-orange-500/[0.04] rounded-full blur-[120px]" />
        </div>

        {/* Chat */}
        <ChatUI
          messages={messages}
          input={input}
          typing={typing}
          panel={panel}
          onInput={setInput}
          onSend={sendMsg}
          onPanel={setPanel}
        />

        {/* Slide-up panel */}
        <div className={`absolute inset-x-0 bottom-0 z-20 transition-all duration-300 ease-out ${
          hasPanel ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`} style={{ height: "55%", maxHeight: "55%" }}>
          <div className="h-full bg-[#0e0e15]/98 backdrop-blur-2xl border-t border-white/[0.08] rounded-t-2xl overflow-hidden shadow-2xl shadow-black/50">
            {panel === "booking"    && <PanelBooking    onClose={closePanel} />}
            {panel === "production" && <PanelProduction onClose={closePanel} />}
            {panel === "portfolio"  && <PanelPortfolio  onClose={closePanel} />}
            {panel === "tips"       && <PanelTips       onAsk={askFromPanel} onClose={closePanel} />}
            {panel === "reviews"    && <PanelReviews    onClose={closePanel} />}
            {panel === "faq"        && <PanelFaq        onClose={closePanel} />}
            {panel === "contacts"   && <PanelContacts   onClose={closePanel} />}
          </div>
        </div>

        {/* Overlay */}
        {hasPanel && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closePanel} style={{ zIndex: 15 }} />
        )}

        {/* Booking toast */}
        <div className={`absolute bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:left-auto md:w-80 z-30 transition-all duration-500 ease-out ${
          bookingToast && !hasPanel ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}>
          <div className="rounded-2xl border border-orange-500/25 bg-[#1a1008]/95 backdrop-blur-xl shadow-2xl shadow-orange-500/10 overflow-hidden">
            {/* Accent bar */}
            <div className="h-1 bg-gradient-to-r from-orange-500 to-rose-500" />
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                  <Icon name="CalendarCheck" size={18} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm leading-snug mb-0.5">Расчёт готов!</div>
                  <div className="text-white/45 text-xs leading-relaxed">
                    Запишитесь на бесплатный замер — уточним цену и сделаем 3D-визуализацию
                  </div>
                </div>
                <button onClick={() => setBookingToast(false)}
                  className="shrink-0 p-1 text-white/20 hover:text-white/50 transition-colors">
                  <Icon name="X" size={14} />
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setBookingToast(false); setPanel("booking"); }}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 text-white font-semibold py-2 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5">
                  <Icon name="CalendarCheck" size={13} />
                  Записаться на замер
                </button>
                <button onClick={() => setBookingToast(false)}
                  className="px-3 py-2 rounded-xl bg-white/[0.05] text-white/40 text-xs hover:bg-white/[0.08] transition-all">
                  Позже
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom CTA */}
      <div className="sm:hidden shrink-0 flex items-center gap-2 px-3 py-2 border-t border-white/[0.05] bg-[#0d0d14]/95 backdrop-blur-xl">
        <a href="tel:+79776068901" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.05] text-white/50 text-[11px] font-medium">
          <Icon name="Phone" size={13} /> Позвонить
        </a>
        <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/20 text-orange-400 text-[11px] font-medium">
          <Icon name="MessageCircle" size={13} /> WhatsApp
        </a>
      </div>
    </div>
  );
}