import { useState, useCallback, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";
import UserDropdown from "@/components/UserDropdown";
import ProfileModal from "@/components/ProfileModal";
import PendingApprovalModal from "@/components/PendingApprovalModal";
import PaymentModal from "@/components/PaymentModal";
import { isEstimate } from "./EstimateTable";
import { Panel, Msg, GREETING, AI_URL, localAnswer } from "./chatConfig";
import ChatUI from "./ChatUI";
import LiveChat from "./LiveChat";
import {
  PanelBooking,
  PanelProduction,
  PanelPortfolio,
  PanelTips,
  PanelReviews,
  PanelFaq,
  PanelContacts,
  PanelOther,
} from "./ChatPanels";
import MobileContactBar from "./MobileContactBar";

export default function Index() {
  const { user } = useAuth();
  const [showAuthModal,    setShowAuthModal]    = useState(false);
  const [pendingRole,      setPendingRole]      = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [panel, setPanel]       = useState<Panel>("none");
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput]       = useState("");
  const [typing, setTyping]     = useState(false);
  const [bookingToast, setBookingToast] = useState(false);
  const [estimateModal, setEstimateModal] = useState(false);
  const [regModal, setRegModal] = useState(false);
  const isPresetMsg = useRef(false);

  // Фиксируем высоту один раз при загрузке — Android Chrome сжимает viewport при открытии клавиатуры
  const [appHeight] = useState<number>(() => window.innerHeight);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user) return;
    regTimer.current = setTimeout(() => setRegModal(true), 120000);
    return () => { if (regTimer.current) clearTimeout(regTimer.current); };
  }, [user]);

  // Автооткрытие модалки регистрации при заходе с /pricing → "?auth=register"
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!user && params.get("auth") === "register") {
      setShowAuthModal(true);
      // Чистим query, чтобы не открывать повторно
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user]);

  // Через 3 сек после сметы: модальный оверлей (только если не пресет)
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && isEstimate(last.text)) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (modalTimer.current) clearTimeout(modalTimer.current);
      if (!isPresetMsg.current) {
        toastTimer.current = setTimeout(() => setBookingToast(true), 3000);
        modalTimer.current = setTimeout(() => setEstimateModal(true), 3000);
      }
      isPresetMsg.current = false;
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (modalTimer.current) clearTimeout(modalTimer.current);
    };
  }, [messages]);

  const sendPreset = (text: string) => { isPresetMsg.current = true; sendMsg(text, true); };

  const BOOKING_RE = /запис|замер|выезд|приедет|технолог|вызов|когда приедет|вызвать|заказать замер/i;

  const sendMsg = useCallback((text: string, fast = false) => {
    if (!text.trim() || typing) return;
    const userMsg: Msg = { id: Date.now(), role: "user", text: text.trim() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setTyping(true);
    if (BOOKING_RE.test(text)) setPanel("booking");
    const history = [...messages, userMsg].slice(-6).map((m) => ({ role: m.role, text: m.text }));
    // Передаём items последней сметы — бэкенд использует при редактировании
    const lastEstimateMsg = [...messages].reverse().find((m) => m.role === "assistant" && m.items?.length);
    const prevItems = lastEstimateMsg?.items ?? null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    fetch(AI_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Session-Id": sessionStorage.getItem("sid") || "" }, body: JSON.stringify({ messages: history, fast, prev_items: prevItems }), signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const newMsg = { id: Date.now() + 1, role: "assistant" as const, text: d.answer || localAnswer(text), items: d.items };
        const isNewEstimate = isEstimate(newMsg.text) || !!d.items?.length;
        setMessages((p) => {
          if (isNewEstimate) {
            const estimateIdx = p.findLastIndex((m) => m.role === "assistant" && isEstimate(m.text));
            if (estimateIdx !== -1) {
              // Смета уже была — обновляем её и добавляем "Готово ✅" (скролл сработает по новому id)
              const updated = [...p];
              updated[estimateIdx] = { ...newMsg, id: Date.now() + 2 };
              updated.push({ id: Date.now() + 3, role: "assistant" as const, text: "Готово ✅" });
              return updated;
            }
          }
          return [...p, newMsg];
        });
      })
      .catch(() => setMessages((p) => [...p, { id: Date.now() + 1, role: "assistant" as const, text: localAnswer(text) }]))
      .finally(() => { clearTimeout(timer); setTyping(false); });
  }, [messages, typing]);

  const askFromPanel = (q: string) => { setPanel("none"); setTimeout(() => sendMsg(q), 100); };
  const closePanel   = () => setPanel("none");
  const hasPanel     = panel !== "none";

  const handleNewEstimate = () => {
    setMessages([GREETING]);
    setInput("");
    setBookingToast(false);
    setEstimateModal(false);
  };

  return (
    <div className="bg-[#0b0b11] text-white font-rubik flex flex-col select-none" style={{ height: appHeight, overflow: "hidden" }}>

      {/* Header */}
      <header className="shrink-0 flex items-center h-12 px-4 md:px-6 border-b border-white/[0.05] bg-[#0d0d14]/80 backdrop-blur-xl z-30">
        <img src="https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png" alt="" className="w-6 h-6 object-contain mr-2.5" style={{ mixBlendMode: "screen" }} />
        <span className="font-montserrat font-black text-sm tracking-wide">MOS<span className="text-orange-400">POTOLKI</span></span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setPanel(panel === "contacts" ? "none" : "contacts")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-medium hover:bg-orange-500/15 transition-all">
            <Icon name="MapPin" size={12} /> <span>Контакты</span>
          </button>

          <button
            onClick={() => setPanel(panel === "livechat" ? "none" : "livechat")}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-medium hover:bg-orange-500/15 transition-all">
            <Icon name="MessageCircle" size={12} /> Чат
          </button>
          <a href="https://t.me/JoniKras" target="_blank" rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-medium hover:bg-orange-500/15 transition-all">
            <Icon name="Send" size={12} /> Telegram
          </a>
          <a href="https://max.ru/u/f9LHodD0cOImGR_bXwRjzpNeWQv7qzBR-lP0W9lvbuzV8iU1J5lngmKBGgA" target="_blank" rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-medium hover:bg-orange-500/15 transition-all">
            <Icon name="MessageSquare" size={12} /> MAX
          </a>

          {/* Авторизация */}
          {user ? (
            <UserDropdown
              onShowProfile={() => setShowProfileModal(true)}
              onShowPayment={() => setShowPaymentModal(true)}
            />
          ) : (
            <button onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/60 text-[11px] font-medium hover:bg-white/[0.1] hover:text-white/90 transition-all">
              <Icon name="User" size={11} /> Войти
            </button>
          )}
        </div>
      </header>

      {showAuthModal && <AuthModal
        onClose={() => setShowAuthModal(false)}
        onPending={(role) => { setPendingRole(role); setShowAuthModal(false); }}
        onSuccess={() => setShowAuthModal(false)}
      />}
      {pendingRole && <PendingApprovalModal role={pendingRole} onClose={() => setPendingRole(null)} />}
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
      {showPaymentModal && <PaymentModal onClose={() => setShowPaymentModal(false)} />}

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
          onPreset={sendPreset}
          onPanel={setPanel}
          onNewEstimate={handleNewEstimate}
          onSaveRequest={() => setShowAuthModal(true)}
        />

        {/* Slide-up panel */}
        <div className={`absolute inset-x-0 bottom-0 z-20 transition-all duration-300 ease-out ${
          hasPanel ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`} style={{ height: "55%", maxHeight: "55%" }}>
          <div className="h-full bg-[#0e0e15]/98 backdrop-blur-2xl border-t border-white/[0.08] rounded-t-2xl overflow-hidden shadow-2xl shadow-black/50">
            {panel === "livechat"   && <LiveChat         onClose={closePanel} />}
            {panel === "booking"    && <PanelBooking    onClose={closePanel} />}
            {panel === "production" && <PanelProduction onClose={closePanel} />}
            {panel === "portfolio"  && <PanelPortfolio  onClose={closePanel} />}
            {panel === "tips"       && <PanelTips       onAsk={askFromPanel} onClose={closePanel} />}
            {panel === "reviews"    && <PanelReviews    onClose={closePanel} />}
            {panel === "faq"        && <PanelFaq        onClose={closePanel} />}
            {panel === "contacts"   && <PanelContacts   onClose={closePanel} onPanel={setPanel} />}
            {panel === "other"      && <PanelOther      onClose={closePanel} onPanel={setPanel} />}
          </div>
        </div>

        {/* Overlay */}
        {hasPanel && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closePanel} style={{ zIndex: 15 }} />
        )}



        {/* Estimate modal — перекрывает смету, требует действия */}
        {estimateModal && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md [-webkit-backdrop-filter:blur(10px)]">
            <div className="w-full max-w-sm rounded-3xl border border-orange-500/25 bg-[#16100a] shadow-2xl shadow-orange-500/15 overflow-hidden">
              {/* Top gradient bar */}
              <div className="h-1.5 bg-gradient-to-r from-orange-500 to-rose-500" />

              <div className="p-6">
                {/* Avatar + title */}
                <div className="flex flex-col items-center text-center mb-5">
                  <div className="relative mb-3">
                    <img src="https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/b12f254a-ee38-4ef7-abc3-2517a55b4909.jpg"
                      alt="Женя" className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-500/30 shadow-lg shadow-orange-500/15" />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 rounded-full border-2 border-[#16100a] flex items-center justify-center">
                      <Icon name="Check" size={10} className="text-white" />
                    </span>
                  </div>
                  <div className="text-white font-bold text-base mb-1">Смета готова!</div>
                  <div className="text-white/45 text-sm leading-relaxed">
                    Женя подготовил расчёт. Запишитесь на бесплатный замер — уточним все детали и сделаем 3D-проект
                  </div>
                </div>

                {/* Benefits */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    { icon: "Ruler",       label: "Точный замер" },
                    { icon: "Box",         label: "3D-проект"    },
                    { icon: "BadgeCheck",  label: "Бесплатно"    },
                  ].map((b, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-xl py-3 px-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/12 flex items-center justify-center">
                        <Icon name={b.icon} size={15} className="text-orange-400" />
                      </div>
                      <span className="text-white/45 text-[10px] text-center leading-tight">{b.label}</span>
                    </div>
                  ))}
                </div>

                {/* CTA buttons */}
                <button
                  onClick={() => { setEstimateModal(false); setBookingToast(false); setPanel("booking"); }}
                  className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 text-white font-bold py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 mb-2">
                  <Icon name="CalendarCheck" size={16} />
                  Записаться на замер
                </button>
                <button
                  onClick={() => setEstimateModal(false)}
                  className="w-full py-2.5 rounded-2xl text-white/35 text-sm hover:text-white/55 transition-colors text-center">
                  Посмотреть смету
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Попап регистрации — только для незалогиненных, через 2 минуты */}
        {regModal && !user && (
          <AuthModal
            onClose={() => setRegModal(false)}
            defaultTab="register"
            onSuccess={() => setRegModal(false)}
            onPending={() => setRegModal(false)}
          />
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

      {/* Mobile bottom CTA — свайп вверх/вниз */}
      <MobileContactBar panel={panel} setPanel={setPanel} />
    </div>
  );
}