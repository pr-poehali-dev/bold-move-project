import Icon from "@/components/ui/icon";

const PILLARS = [
  {
    icon: "Users",
    color: "#10b981",
    glow: "rgba(16,185,129,0.18)",
    title: "Личные кабинеты для партнёров",
    subtitle: "Прорабы, дизайнеры — со своими клиентами",
    points: [
      "Каждый партнёр заходит под своим аккаунтом",
      "Видит только своих клиентов — не чужих",
      "Персональные скидки и условия для каждого",
    ],
  },
  {
    icon: "Megaphone",
    color: "#f97316",
    glow: "rgba(249,115,22,0.18)",
    title: "Встроенный маркетолог",
    subtitle: "Акции, пуши, промо — одной кнопкой",
    soon: true,
    points: [
      "AI сам предлагает что и когда отправить клиентам",
      "Акции, сезонные офферы, напоминания об услугах",
      "Пуш-уведомления прямо в телефон клиента",
    ],
  },
  {
    icon: "Heart",
    color: "#f43f5e",
    glow: "rgba(244,63,94,0.18)",
    title: "Тесные отношения с клиентами",
    subtitle: "Не теряйте их после первого заказа",
    points: [
      "Клиент видит новинки, акции и спецпредложения",
      "История заказов и персональные рекомендации",
      "Дополнительный канал связи помимо звонков",
    ],
  },
  {
    icon: "ClipboardList",
    color: "#60a5fa",
    glow: "rgba(96,165,250,0.18)",
    title: "Клиентский кабинет",
    subtitle: "Просчёты, замеры, статус заказа",
    points: [
      "Клиент сам делает просчёт и оставляет заявку",
      "Онлайн-запись на замер без звонков",
      "Видит ход выполнения своего заказа в реальном времени",
    ],
  },
];

export default function PricingEcosystem() {
  return (
    <section className="max-w-5xl mx-auto px-5 pb-8 sm:pb-16">

      {/* Заголовок */}
      <div className="text-center mb-6 sm:mb-10">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3"
          style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}
        >
          <Icon name="Layers" size={10} />
          Только White Label
        </div>
        <h2 className="text-xl sm:text-3xl font-black text-white mb-2 leading-tight">
          Целая экосистема<br className="hidden sm:block" /> под вашим брендом
        </h2>
        <p className="text-xs sm:text-sm text-white/50 max-w-xl mx-auto leading-relaxed">
          Не просто агент — полноценная платформа под вашим брендом.
          Партнёры работают со своими клиентами, клиенты видят только вас.
        </p>
      </div>

      {/* Карточки */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="rounded-[20px] p-3.5 sm:p-5 flex flex-col gap-2.5 sm:gap-4"
            style={{
              background: `radial-gradient(140% 120% at 0% 0%, ${p.glow}, rgba(10,10,20,0) 60%), #0a0a14`,
              border: `1.5px solid ${p.glow.replace("0.18", "0.25")}`,
            }}
          >
            {/* Иконка + заголовок */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: p.glow }}
              >
                <Icon name={p.icon} size={15} style={{ color: p.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <div className="text-[13px] font-black text-white leading-snug">
                    {p.title}
                  </div>
                  {'soon' in p && p.soon && (
                    <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider flex-shrink-0"
                      style={{ background: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)" }}>
                      Скоро
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-medium" style={{ color: p.color }}>
                  {p.subtitle}
                </div>
              </div>
            </div>

            {/* Пункты */}
            <div className="flex flex-col gap-1.5">
              {p.points.map((pt) => (
                <div key={pt} className="flex items-start gap-1.5">
                  <div
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: p.glow }}
                  >
                    <Icon name="Check" size={8} style={{ color: p.color }} />
                  </div>
                  <span className="text-[11px] text-white/60 leading-snug">{pt}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Нижняя плашка — итог */}
      <div
        className="rounded-[20px] px-3.5 py-3.5 sm:px-6 sm:py-5 flex items-center gap-3 sm:gap-6"
        style={{
          background: "radial-gradient(160% 140% at 0% 50%, rgba(167,139,250,0.12), rgba(96,165,250,0.06) 50%, rgba(10,10,20,0) 80%), #0a0a14",
          border: "1.5px solid rgba(167,139,250,0.22)",
        }}
      >
        <div
          className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(167,139,250,0.18)" }}
        >
          <Icon name="Sparkles" size={15} style={{ color: "#a78bfa" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] sm:text-[15px] font-black text-white mb-0.5 leading-snug">
            Ваши клиенты уверены — это ваш собственный сервис
          </div>
          <div className="text-[10px] sm:text-[12px] text-white/50 leading-snug">
            Ваш логотип, цвета и контакты везде — клиенты видят только вас.
          </div>
        </div>
        <a
          href="https://t.me/poehalidev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-[13px] font-black transition hover:opacity-80 whitespace-nowrap"
          style={{ background: "linear-gradient(135deg, #a78bfa, #60a5fa)", color: "#fff" }}
        >
          <Icon name="Send" size={12} />
          Обсудить
        </a>
      </div>
    </section>
  );
}