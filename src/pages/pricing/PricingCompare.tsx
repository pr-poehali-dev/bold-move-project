import Icon from "@/components/ui/icon";

const ROWS = [
  {
    category: "Основное",
    items: [
      { label: "Расчёт смет для клиентов",              business: true,  wl: true  },
      { label: "CRM и история заявок",                  business: true,  wl: true  },
      { label: "Команда: мастера, дизайнеры",           business: true,  wl: true  },
      { label: "AI-консультант для клиентов",           business: true,  wl: true  },
      { label: "Аналитика и статистика",                business: true,  wl: true  },
    ],
  },
  {
    category: "Ваш бренд",
    items: [
      { label: "Свой логотип вместо нашего",            business: false, wl: true  },
      { label: "Своё имя и приветствие бота",           business: false, wl: true  },
      { label: "Свой фирменный цвет",                   business: false, wl: true  },
      { label: "Ваши контакты в ответах AI",            business: false, wl: true  },
      { label: "Брендированные PDF-сметы",              business: false, wl: true  },
    ],
  },
  {
    category: "Ваш полноценный сервис",
    items: [
      { label: "Ссылка ai-potolki.ru/ваш агент",        business: false, wl: true  },
      { label: "Клиенты думают — это ваш сервис",       business: false, wl: true  },
    ],
  },
  {
    category: "Интеграции",
    items: [
      { label: "Уведомления о заявках в Telegram или Max", business: false, wl: true },
      { label: "Ваш бот — ваши заявки напрямую",        business: false, wl: true  },
    ],
  },
];

function Cell({ value, highlight }: { value: boolean; highlight?: boolean }) {
  if (value) {
    return (
      <div className="flex justify-center">
        <div className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: highlight ? "rgba(167,139,250,0.22)" : "rgba(255,255,255,0.07)" }}>
          <Icon name="Check" size={11}
            style={{ color: highlight ? "#a78bfa" : "rgba(255,255,255,0.4)" }} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-center">
      <Icon name="Minus" size={12} style={{ color: "rgba(255,255,255,0.12)" }} />
    </div>
  );
}

export default function PricingCompare() {
  return (
    <section className="max-w-4xl mx-auto px-5 pb-12">

      {/* Заголовок */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3"
          style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
          <Icon name="Zap" size={10} />
          В чём разница
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white mb-1 leading-tight">
          Хотите, чтобы клиенты видели
          <span style={{ color: "#a78bfa" }}> только ваш бренд?</span>
        </h2>
      </div>

      {/* Таблица */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "#0a0a14", border: "1.5px solid rgba(255,255,255,0.07)" }}>

        {/* Шапка */}
        <div className="grid grid-cols-[1fr_80px_100px] sm:grid-cols-[1fr_130px_150px]"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-3" />

          {/* Бизнес */}
          <div className="flex flex-col items-center justify-center px-2 py-3 gap-0.5"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#f59e0b" }}>
              Бизнес
            </div>
            <div className="text-[10px] text-white/30 hidden sm:block">от 490 ₽</div>
          </div>

          {/* WL */}
          <div className="flex flex-col items-center justify-center px-2 py-3 gap-0.5 relative"
            style={{
              borderLeft: "1px solid rgba(167,139,250,0.25)",
              background: "radial-gradient(180% 120% at 50% 0%, rgba(167,139,250,0.10), transparent 70%)",
            }}>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#a78bfa" }}>
              Свой агент
            </div>
            <div className="text-[10px] text-white/30 hidden sm:block">80 000 ₽</div>
            <div className="absolute -top-px left-0 right-0 h-[2px]"
              style={{ background: "linear-gradient(90deg, transparent, #a78bfa, transparent)" }} />
          </div>
        </div>

        {/* Строки */}
        {ROWS.map((section, si) => (
          <div key={section.category}>
            <div className="px-4 py-1.5"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                borderTop: si > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
              }}>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/25">
                {section.category}
              </span>
            </div>

            {section.items.map((row, ri) => (
              <div key={row.label}
                className="grid grid-cols-[1fr_80px_100px] sm:grid-cols-[1fr_130px_150px]"
                style={{ borderBottom: ri < section.items.length - 1 ? "1px solid rgba(255,255,255,0.03)" : undefined }}>

                <div className="px-4 py-2 flex items-center">
                  <span className="text-[11px] sm:text-[12px] leading-snug"
                    style={{ color: row.wl && !row.business ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)" }}>
                    {row.label}
                  </span>
                </div>

                <div className="flex items-center justify-center px-2 py-2"
                  style={{ borderLeft: "1px solid rgba(255,255,255,0.04)" }}>
                  <Cell value={row.business} />
                </div>

                <div className="flex items-center justify-center px-2 py-2"
                  style={{
                    borderLeft: "1px solid rgba(167,139,250,0.12)",
                    background: row.wl && !row.business ? "rgba(167,139,250,0.04)" : undefined,
                  }}>
                  <Cell value={row.wl} highlight />
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Футер */}
        <div className="grid grid-cols-[1fr_80px_100px] sm:grid-cols-[1fr_130px_150px]"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-3 flex items-center">
            <p className="text-[10px] text-white/30 leading-relaxed">
              С White Label клиенты никогда не узнают, что за этим стоим мы.
            </p>
          </div>
          <div className="flex items-center justify-center px-2 py-3"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[9px] text-white/25 text-center hidden sm:block">сразу</span>
          </div>
          <div className="flex flex-col items-center justify-center px-2 py-3 gap-1.5"
            style={{
              borderLeft: "1px solid rgba(167,139,250,0.15)",
              background: "radial-gradient(180% 120% at 50% 100%, rgba(167,139,250,0.07), transparent 70%)",
            }}>
            <div className="text-sm font-black" style={{ color: "#a78bfa" }}>80 000 ₽</div>
            <a href="https://t.me/poehalidev" target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold transition hover:opacity-80"
              style={{ background: "rgba(167,139,250,0.18)", color: "#a78bfa" }}>
              <Icon name="Send" size={9} />
              Хочу
            </a>
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div className="mt-3 flex items-center gap-5 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "rgba(167,139,250,0.22)" }}>
            <Icon name="Check" size={9} style={{ color: "#a78bfa" }} />
          </div>
          <span className="text-[10px] text-white/30">Только у Своего агента</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.07)" }}>
            <Icon name="Check" size={9} style={{ color: "rgba(255,255,255,0.4)" }} />
          </div>
          <span className="text-[10px] text-white/30">Есть в обоих</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Icon name="Minus" size={12} style={{ color: "rgba(255,255,255,0.12)" }} />
          <span className="text-[10px] text-white/30">Недоступно</span>
        </div>
      </div>
    </section>
  );
}