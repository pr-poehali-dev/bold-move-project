import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

const PRICE = 80000;

const FEATURES = [
  { icon: "Bot",       title: "Свой бот",            text: "Имя ассистента и приветствие — ваши" },
  { icon: "Image",     title: "Свой логотип",        text: "Везде на сайте и в PDF" },
  { icon: "Phone",     title: "Свои контакты",       text: "Телефон, Telegram, MAX, сайт — на вас" },
  { icon: "Palette",   title: "Свой цвет бренда",    text: "Под фирменный стиль вашей компании" },
  { icon: "FileText",  title: "Брендированные PDF", text: "Сметы клиентам с вашими реквизитами" },
  { icon: "Headset",   title: "Настройка с менеджером", text: "Подберём логотип и контакты вместе" },
];

interface Props { isDark: boolean }

export default function OwnAgentTeaser({ isDark }: Props) {
  const { user } = useAuth();

  const tgText = encodeURIComponent([
    "Здравствуйте! Хочу заказать своего агента.",
    "",
    `💼 Услуга: Свой агент с брендированием`,
    `💳 Сумма: ${PRICE.toLocaleString("ru-RU")} ₽ (единоразово)`,
    ...(user ? ["", `👤 ID: ${user.id}`, `✉️ Email: ${user.email}`] : []),
  ].join("\n"));

  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const text   = isDark ? "#fff" : "#0f1623";

  // Триал
  const trialUntil = user?.trial_until ? new Date(user.trial_until) : null;
  const isTrial = !!trialUntil && !user?.agent_purchased_at;
  const trialDaysLeft = isTrial ? Math.max(0, Math.ceil((trialUntil!.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  const trialActive = isTrial && trialDaysLeft > 0;
  const trialExpired = isTrial && trialDaysLeft === 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5" style={{ color: text }}>
      <div className="max-w-3xl mx-auto">

        {/* Баннер активного триала */}
        {trialActive && (
          <div className="rounded-2xl px-5 py-4 mb-5 flex items-start gap-3"
            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <Icon name="Clock" size={18} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div className="text-sm font-bold text-yellow-400 mb-0.5">
                Демо-режим активен · осталось {trialDaysLeft} {trialDaysLeft === 1 ? "день" : trialDaysLeft < 5 ? "дня" : "дней"}
              </div>
              <div className="text-xs text-yellow-300/70">
                Вы используете пробный период White Label (10 смет, до {trialUntil!.toLocaleDateString("ru-RU")}).
                Чтобы продолжить — приобретите полный доступ.
              </div>
            </div>
          </div>
        )}

        {/* Баннер истёкшего триала */}
        {trialExpired && (
          <div className="rounded-2xl px-5 py-4 mb-5 flex items-start gap-3"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <Icon name="AlertTriangle" size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div className="text-sm font-bold text-red-400 mb-0.5">Демо-период истёк</div>
              <div className="text-xs text-red-300/70">
                Пробный период White Label завершился. Чтобы продолжить использование — приобретите полный доступ.
              </div>
            </div>
          </div>
        )}

        {/* Hero-карточка */}
        <div className="rounded-[28px] overflow-hidden p-7 md:p-10 mb-5"
          style={{
            background: isDark
              ? "radial-gradient(120% 140% at 0% 0%, rgba(167,139,250,0.16), rgba(8,8,15,0) 55%), radial-gradient(120% 140% at 100% 100%, rgba(96,165,250,0.10), rgba(8,8,15,0) 55%), #0a0a14"
              : "radial-gradient(120% 140% at 0% 0%, rgba(167,139,250,0.10), #ffffff 55%), #ffffff",
            border: "1.5px solid rgba(167,139,250,0.30)",
            boxShadow: "0 0 60px rgba(167,139,250,0.10)",
          }}>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-5"
            style={{ background: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.4)" }}>
            <Icon name="Sparkles" size={11} />
            White Label
          </div>

          <h1 className="text-2xl md:text-3xl font-black leading-tight mb-3" style={{ color: text }}>
            Хотите получить{" "}
            <span style={{ background: "linear-gradient(90deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              своего агента?
            </span>
          </h1>

          <p className="text-sm md:text-base leading-relaxed mb-3 max-w-2xl" style={{ color: muted }}>
            Запустите бот под своим брендом: ваш логотип, ваши контакты, ваше имя ассистента,
            ваш цвет.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-6 text-sm font-bold"
            style={{ background: "rgba(167,139,250,0.13)", border: "1.5px solid rgba(167,139,250,0.35)", color: "#c4b5fd" }}>
            <Icon name="ShieldCheck" size={16} style={{ color: "#a78bfa" }} />
            Клиенты будут уверены на 100%, что это ваш сервис
          </div>

          {/* Цена */}
          <div className="rounded-2xl px-5 py-4 mb-6 inline-flex items-center gap-4"
            style={{ background: "rgba(167,139,250,0.10)", border: "1.5px solid rgba(167,139,250,0.30)" }}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: muted }}>Стоимость</div>
              <div className="text-2xl md:text-3xl font-black" style={{ color: "#a78bfa" }}>
                {PRICE.toLocaleString("ru-RU")} ₽
              </div>
            </div>
            <div className="h-10 w-px" style={{ background: "rgba(167,139,250,0.25)" }} />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: muted }}>Период</div>
              <div className="text-sm font-bold" style={{ color: text }}>Единоразово</div>
            </div>
          </div>

          {/* Что входит */}
          <div className="grid sm:grid-cols-2 gap-2.5 mb-6">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-xl p-3 flex items-start gap-3"
                style={{
                  background: isDark ? "rgba(255,255,255,0.025)" : "#f9fafb",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#e5e7eb"}`,
                }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(167,139,250,0.14)" }}>
                  <Icon name={f.icon} size={15} style={{ color: "#a78bfa" }} />
                </div>
                <div>
                  <div className="text-[12px] font-bold" style={{ color: text }}>{f.title}</div>
                  <div className="text-[11px] leading-snug" style={{ color: muted }}>{f.text}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <a href={`https://t.me/JoniKras?text=${tgText}`} target="_blank" rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition hover:opacity-90"
            style={{ background: "#a78bfa", color: "#0a0a14" }}>
            <Icon name="Send" size={15} />
            Заказать своего агента — {PRICE.toLocaleString("ru-RU")} ₽
          </a>

          <div className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: muted }}>
            <Icon name="ShieldCheck" size={11} style={{ color: "#10b981" }} />
            Настройка с менеджером · возврат 100% до начала работ
          </div>
        </div>

        {/* Информашка */}
        <div className="rounded-xl px-4 py-3 text-[12px] flex items-start gap-2.5"
          style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.22)", color: isDark ? "#c4b5fd" : "#6d28d9" }}>
          <Icon name="Info" size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Как только мы получим оплату и согласуем материалы (логотип, цвета, контакты) — активируем «Свой агент» в вашем кабинете.
            После этого здесь появится вкладка <b>«Общее»</b> для самостоятельной настройки.
          </span>
        </div>
      </div>
    </div>
  );
}