import Icon from "@/components/ui/icon";

const PILLARS = [
  {
    icon: "Users",
    color: "#10b981",
    glow: "rgba(16,185,129,0.18)",
    title: "Личные кабинеты для команды",
    subtitle: "Прорабы, дизайнеры, замерщики",
    points: [
      "Каждый сотрудник заходит под своим аккаунтом",
      "Видит только своих клиентов и задачи",
      "Персональные скидки и условия для каждого",
    ],
  },
  {
    icon: "Megaphone",
    color: "#f97316",
    glow: "rgba(249,115,22,0.18)",
    title: "Встроенный маркетолог",
    subtitle: "Акции, пуши, промо — одной кнопкой",
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
    <section className="max-w-5xl mx-auto px-5 pb-16">

      {/* Заголовок */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4"
          style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}
        >
          <Icon name="Layers" size={10} />
          Только White Label
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 leading-tight">
          Целая экосистема<br className="hidden sm:block" /> под вашим брендом
        </h2>
        <p className="text-sm text-white/50 max-w-xl mx-auto leading-relaxed">
          Не просто агент — полноценная платформа для вашего бизнеса.
          Ваши прорабы, дизайнеры и клиенты работают в едином пространстве с вашим логотипом.
        </p>
      </div>

      {/* Карточки */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="rounded-[24px] p-5 flex flex-col gap-4"
            style={{
              background: `radial-gradient(140% 120% at 0% 0%, ${p.glow}, rgba(10,10,20,0) 60%), #0a0a14`,
              border: `1.5px solid ${p.glow.replace("0.18", "0.25")}`,
            }}
          >
            {/* Иконка + заголовок */}
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: p.glow }}
              >
                <Icon name={p.icon} size={18} style={{ color: p.color }} />
              </div>
              <div>
                <div className="text-[14px] font-black text-white leading-snug mb-0.5">
                  {p.title}
                </div>
                <div className="text-[11px] font-medium" style={{ color: p.color }}>
                  {p.subtitle}
                </div>
              </div>
            </div>

            {/* Пункты */}
            <div className="flex flex-col gap-2 pl-1">
              {p.points.map((pt) => (
                <div key={pt} className="flex items-start gap-2">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: p.glow }}
                  >
                    <Icon name="Check" size={9} style={{ color: p.color }} />
                  </div>
                  <span className="text-[12px] text-white/60 leading-snug">{pt}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Нижняя плашка — итог */}
      <div
        className="rounded-[24px] px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
        style={{
          background: "radial-gradient(160% 140% at 0% 50%, rgba(167,139,250,0.12), rgba(96,165,250,0.06) 50%, rgba(10,10,20,0) 80%), #0a0a14",
          border: "1.5px solid rgba(167,139,250,0.22)",
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(167,139,250,0.18)" }}
        >
          <Icon name="Sparkles" size={22} style={{ color: "#a78bfa" }} />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-black text-white mb-1">
            Ваши клиенты уверены — это ваш собственный сервис
          </div>
          <div className="text-[12px] text-white/50 leading-relaxed">
            Никакого упоминания нашего бренда. Ваш логотип, ваши цвета, ваши уведомления в Telegram или Max —
            клиенты видят только вашу компанию.
          </div>
        </div>
        <a
          href="https://t.me/poehalidev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl text-[13px] font-black transition hover:opacity-80 whitespace-nowrap"
          style={{ background: "linear-gradient(135deg, #a78bfa, #60a5fa)", color: "#fff" }}
        >
          <Icon name="Send" size={14} />
          Обсудить с нами
        </a>
      </div>
    </section>
  );
}
