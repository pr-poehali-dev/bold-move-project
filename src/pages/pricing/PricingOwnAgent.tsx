import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

const PRICE = 80000;

const FEATURES = [
  { icon: "Bot",          title: "Свой бот",                     text: "Собственное имя ассистента и приветствие — клиенты общаются как с вашим сотрудником" },
  { icon: "Image",        title: "Свой логотип",                 text: "Брендированный сайт и PDF-сметы — вместо нашего логотипа везде ваш" },
  { icon: "Phone",        title: "Свои контакты",                text: "Телефон, Telegram, MAX, сайт — все ссылки и кнопки ведут на вас" },
  { icon: "Palette",      title: "Свой цвет бренда",             text: "Подстроим акценты сайта под фирменный стиль вашей компании" },
  { icon: "FileText",     title: "Брендированные PDF",           text: "Сметы клиентам уходят с вашими реквизитами и логотипом" },
  { icon: "Headset",      title: "Настройка с менеджером",       text: "Лично подберём логотип, цвета, контакты и протестируем" },
];

export default function PricingOwnAgent() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const tgText = encodeURIComponent([
    "Здравствуйте! Хочу заказать своего агента.",
    "",
    `💼 Услуга: Свой агент с брендированием`,
    `💳 Сумма: ${PRICE.toLocaleString("ru-RU")} ₽ (единоразово)`,
    ...(user ? ["", `👤 ID: ${user.id}`, `✉️ Email: ${user.email}`] : []),
  ].join("\n"));

  return (
    <section className="max-w-5xl mx-auto px-5 pb-14">
      <div className="rounded-[28px] overflow-hidden"
        style={{
          background: "radial-gradient(120% 140% at 0% 0%, rgba(167,139,250,0.16), rgba(8,8,15,0) 55%), radial-gradient(120% 140% at 100% 100%, rgba(96,165,250,0.10), rgba(8,8,15,0) 55%), #0a0a14",
          border: "1.5px solid rgba(167,139,250,0.30)",
          boxShadow: "0 0 60px rgba(167,139,250,0.10)",
        }}>

        {/* Шапка-кнопка раскрытия */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-4 p-5 md:p-6 transition hover:bg-white/[0.02] text-left">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(167,139,250,0.18)" }}>
            <Icon name="Bot" size={22} style={{ color: "#a78bfa" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-base md:text-lg font-black text-white">Свой агент</span>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                style={{ background: "#a78bfa", color: "#0a0a14" }}>WHITE LABEL</span>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                style={{ background: "rgba(251,191,36,0.18)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.32)" }}>
                для компаний
              </span>
            </div>
            <div className="text-[12px] text-white/55 leading-snug">
              Собственный бот с вашим брендом, контактами и логотипом — клиенты будут уверены на 100% что это ваш сервис
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xl md:text-2xl font-black" style={{ color: "#a78bfa" }}>
              {PRICE.toLocaleString("ru-RU")} ₽
            </div>
            <div className="text-[10px] text-white/35">единоразово</div>
          </div>
          <Icon name={open ? "ChevronUp" : "ChevronDown"} size={18}
            style={{ color: "rgba(255,255,255,0.45)" }} className="flex-shrink-0" />
        </button>

        {/* Раскрытое содержимое */}
        {open && (
          <div className="border-t px-5 md:px-8 pb-7 pt-6"
            style={{ borderColor: "rgba(167,139,250,0.20)" }}>

            <p className="text-sm text-white/65 leading-relaxed mb-6 max-w-2xl">
              Вы получаете полностью брендированный сервис: клиенты заходят по своей ссылке,
              видят ваш логотип, ваше имя бота, ваши контакты и ваш цвет. Все сметы и письма уходят от вашего имени.
            </p>

            {/* Фичи */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {FEATURES.map(f => (
                <div key={f.title} className="rounded-2xl p-4"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5"
                    style={{ background: "rgba(167,139,250,0.14)" }}>
                    <Icon name={f.icon} size={16} style={{ color: "#a78bfa" }} />
                  </div>
                  <div className="text-[13px] font-bold text-white mb-1">{f.title}</div>
                  <div className="text-[11px] text-white/45 leading-snug">{f.text}</div>
                </div>
              ))}
            </div>

            {/* Доступность */}
            {user?.has_own_agent ? (
              <div className="rounded-2xl px-5 py-4 mb-5 flex items-center gap-3"
                style={{ background: "rgba(16,185,129,0.10)", border: "1.5px solid rgba(16,185,129,0.32)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(16,185,129,0.20)" }}>
                  <Icon name="CheckCircle2" size={18} style={{ color: "#10b981" }} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white mb-0.5">Свой агент уже активирован</div>
                  <div className="text-[11px] text-white/55">
                    Перейдите в админку → вкладка «Общее» — настройте контакты и логотип
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl px-5 py-4 mb-5"
                style={{ background: "rgba(251,191,36,0.10)", border: "1.5px solid rgba(251,191,36,0.32)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(251,191,36,0.20)" }}>
                    <Icon name="Sparkles" size={18} style={{ color: "#fbbf24" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white mb-0.5">Ваш агент уже доступен для старта</div>
                    <div className="text-[12px] text-white/65 leading-relaxed">
                      Чтобы запустить — оплатите <b className="text-white">{PRICE.toLocaleString("ru-RU")} ₽</b> единоразово.
                      Настройка происходит вместе с нашим менеджером — подбираем логотип, цвета, контакты, тестируем.
                      Запуск в течение 1–3 дней после оплаты.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a href={`https://t.me/JoniKras?text=${tgText}`} target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "#a78bfa", color: "#0a0a14" }}>
                <Icon name="Send" size={15} />
                Заказать своего агента в Telegram
              </a>
              <a href="https://t.me/JoniKras" target="_blank" rel="noreferrer"
                className="sm:w-auto px-5 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Icon name="MessageCircle" size={15} />
                Задать вопрос
              </a>
            </div>

            <div className="mt-3 text-[10.5px] text-white/35 text-center sm:text-left flex items-center gap-1.5 justify-center sm:justify-start">
              <Icon name="ShieldCheck" size={11} style={{ color: "#10b981" }} />
              Возврат 100% до начала настройки
            </div>
          </div>
        )}
      </div>
    </section>
  );
}