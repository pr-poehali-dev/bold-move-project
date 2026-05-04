import Icon from "@/components/ui/icon";

const ROWS = [
  {
    category: "Основное",
    items: [
      { label: "Расчёт смет для клиентов",         business: true,  wl: true  },
      { label: "CRM и история заявок",              business: true,  wl: true  },
      { label: "Команда: мастера, дизайнеры",       business: true,  wl: true  },
      { label: "AI-консультант для клиентов",       business: true,  wl: true  },
      { label: "Аналитика и статистика",            business: true,  wl: true  },
    ],
  },
  {
    category: "Ваш бренд",
    items: [
      { label: "Свой логотип вместо нашего",        business: false, wl: true  },
      { label: "Своё имя и приветствие бота",       business: false, wl: true  },
      { label: "Свой фирменный цвет",               business: false, wl: true  },
      { label: "Ваши контакты в ответах AI",        business: false, wl: true  },
      { label: "Брендированные PDF-сметы",          business: false, wl: true  },
    ],
  },
  {
    category: "Ваш полноценный сервис",
    items: [
      { label: "Ссылка ai-potolki.ru/ваш агент",    business: false, wl: true  },
      { label: "Клиенты думают — это ваш сервис",   business: false, wl: true  },
    ],
  },
  {
    category: "Интеграции",
    items: [
      { label: "Уведомления о заявках в Telegram или Max", business: false, wl: true  },
      { label: "Ваш бот — ваши заявки напрямую",    business: false, wl: true  },
    ],
  },
];

function Cell({ value, highlight }: { value: boolean; highlight?: boolean }) {
  if (value) {
    return (
      <div className="flex justify-center">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: highlight
              ? "rgba(167,139,250,0.20)"
              : "rgba(255,255,255,0.06)",
          }}
        >
          <Icon
            name="Check"
            size={13}
            style={{ color: highlight ? "#a78bfa" : "rgba(255,255,255,0.45)" }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-center">
      <Icon name="Minus" size={14} style={{ color: "rgba(255,255,255,0.15)" }} />
    </div>
  );
}

export default function PricingCompare() {
  return (
    <section className="max-w-5xl mx-auto px-5 pb-16">

      {/* Заголовок */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4"
          style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}
        >
          <Icon name="Zap" size={10} />
          В чём разница
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 leading-tight">
          Бизнес или свой агент?
        </h2>
        <p className="text-sm text-white/50 max-w-lg mx-auto leading-relaxed">
          С бизнес-пакетом вы работаете через наш сервис.
          Со своим агентом — клиенты видят <span className="text-white/80 font-semibold">только вас</span>.
        </p>
      </div>

      {/* Таблица */}
      <div
        className="rounded-[28px] overflow-hidden"
        style={{
          background: "#0a0a14",
          border: "1.5px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Шапка колонок */}
        <div
          className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_160px_160px] gap-0"
          style={{ borderBottom: "1.5px solid rgba(255,255,255,0.07)" }}
        >
          <div className="px-5 py-4" />

          {/* Бизнес */}
          <div
            className="flex flex-col items-center justify-center px-3 py-4 gap-1"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: "#f59e0b" }}
            >
              Бизнес
            </div>
            <div className="text-[11px] text-white/40 hidden sm:block">тарифы от 490 ₽</div>
          </div>

          {/* White Label */}
          <div
            className="flex flex-col items-center justify-center px-3 py-4 gap-1 relative"
            style={{
              borderLeft: "1px solid rgba(167,139,250,0.25)",
              background: "radial-gradient(180% 120% at 50% 0%, rgba(167,139,250,0.10), transparent 70%)",
            }}
          >
            <div
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: "#a78bfa" }}
            >
              Свой агент
            </div>
            <div className="text-[11px] text-white/40 hidden sm:block">80 000 ₽ раз</div>
            <div
              className="absolute -top-px left-0 right-0 h-[2px] rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, #a78bfa, transparent)" }}
            />
          </div>
        </div>

        {/* Строки */}
        {ROWS.map((section, si) => (
          <div key={section.category}>
            {/* Категория */}
            <div
              className="px-5 py-2.5"
              style={{
                background: "rgba(255,255,255,0.025)",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                borderTop: si > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined,
              }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                {section.category}
              </span>
            </div>

            {section.items.map((row, ri) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_160px_160px]"
                style={{
                  borderBottom:
                    ri < section.items.length - 1
                      ? "1px solid rgba(255,255,255,0.04)"
                      : undefined,
                }}
              >
                {/* Лейбл */}
                <div className="px-5 py-3 flex items-center">
                  <span
                    className="text-[12px] sm:text-[13px] leading-snug"
                    style={{
                      color: row.wl && !row.business
                        ? "rgba(255,255,255,0.75)"
                        : "rgba(255,255,255,0.45)",
                    }}
                  >
                    {row.label}
                  </span>
                </div>

                {/* Бизнес */}
                <div
                  className="flex items-center justify-center px-3 py-3 w-[72px] sm:w-auto"
                  style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <Cell value={row.business} />
                </div>

                {/* WL */}
                <div
                  className="flex items-center justify-center px-3 py-3 w-[72px] sm:w-auto"
                  style={{
                    borderLeft: "1px solid rgba(167,139,250,0.15)",
                    background: row.wl && !row.business
                      ? "rgba(167,139,250,0.04)"
                      : undefined,
                  }}
                >
                  <Cell value={row.wl} highlight />
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Итог-футер */}
        <div
          className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_160px_160px]"
          style={{ borderTop: "1.5px solid rgba(255,255,255,0.07)" }}
        >
          <div className="px-5 py-5 flex items-center">
            <p className="text-[11px] text-white/35 leading-relaxed max-w-xs">
              С White Label клиенты никогда не узнают, что за этим стоим мы — только ваш бренд.
            </p>
          </div>

          {/* Бизнес итог */}
          <div
            className="flex flex-col items-center justify-center px-3 py-5 gap-1 w-[72px] sm:w-auto"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="text-[10px] text-white/30 hidden sm:block text-center leading-snug">
              Доступно<br />сразу
            </div>
          </div>

          {/* WL итог */}
          <div
            className="flex flex-col items-center justify-center px-3 py-5 gap-2 w-[72px] sm:w-auto"
            style={{
              borderLeft: "1px solid rgba(167,139,250,0.20)",
              background: "radial-gradient(180% 120% at 50% 100%, rgba(167,139,250,0.08), transparent 70%)",
            }}
          >
            <div
              className="text-base sm:text-xl font-black"
              style={{ color: "#a78bfa" }}
            >
              80 000 ₽
            </div>
            <div className="text-[9px] text-white/35 text-center hidden sm:block leading-snug">
              единоразово<br />навсегда
            </div>
            <a
              href="https://t.me/poehalidev"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold transition hover:opacity-80"
              style={{ background: "rgba(167,139,250,0.18)", color: "#a78bfa" }}
            >
              <Icon name="Send" size={10} />
              Хочу
            </a>
          </div>
        </div>
      </div>

      {/* Подсказка под таблицей */}
      <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 px-1">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(167,139,250,0.20)" }}
          >
            <Icon name="Check" size={10} style={{ color: "#a78bfa" }} />
          </div>
          <span className="text-[11px] text-white/40">Только у Своего агента</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <Icon name="Check" size={10} style={{ color: "rgba(255,255,255,0.45)" }} />
          </div>
          <span className="text-[11px] text-white/40">Есть в обоих</span>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="Minus" size={14} style={{ color: "rgba(255,255,255,0.15)" }} />
          <span className="text-[11px] text-white/40">Недоступно</span>
        </div>
      </div>
    </section>
  );
}