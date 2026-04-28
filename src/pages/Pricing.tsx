import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

const PHONE         = "+7 977 606 89 01";
const PHONE_RAW     = "+79776068901";
const BANK          = "ФОРА-БАНК";
const SBP_HINT      = "Перевод по СБП по номеру телефона";

const PACKAGES = [
  {
    id: "start",
    name: "Старт",
    estimates: 5,
    price: 490,
    perEstimate: 98,
    color: "#64748b",
    glow:  "rgba(100,116,139,0.18)",
    features: [
      "5 смет на расчёт",
      "Все материалы и расценки",
      "PDF и отправка клиенту",
      "Поддержка в чате",
    ],
    badge: null,
  },
  {
    id: "standard",
    name: "Стандарт",
    estimates: 20,
    price: 990,
    perEstimate: 49,
    color: "#10b981",
    glow:  "rgba(16,185,129,0.22)",
    features: [
      "20 смет — хватит на месяц",
      "Все материалы и расценки",
      "PDF, ссылки, отправка клиенту",
      "Приоритетная поддержка",
      "Скидка 50% на смету",
    ],
    badge: "Популярный",
  },
  {
    id: "pro",
    name: "Про",
    estimates: 60,
    price: 1990,
    perEstimate: 33,
    color: "#a78bfa",
    glow:  "rgba(167,139,250,0.22)",
    features: [
      "60 смет — для активных мастеров",
      "Все материалы и расценки",
      "PDF, ссылки, отправка клиенту",
      "Приоритетная поддержка",
      "Цена сметы — всего 33 ₽",
    ],
    badge: "Выгодно",
  },
  {
    id: "business",
    name: "Бизнес",
    estimates: 150,
    price: 3990,
    perEstimate: 27,
    color: "#f59e0b",
    glow:  "rgba(245,158,11,0.22)",
    features: [
      "150 смет — для бригад и компаний",
      "Все материалы и расценки",
      "PDF, ссылки, отправка клиенту",
      "Персональный менеджер",
      "Минимальная цена сметы — 27 ₽",
    ],
    badge: "Максимум",
  },
];

const ADVANTAGES = [
  { icon: "Zap",      title: "Считает за 30 секунд",    text: "Загрузил план — получил готовую смету. Никакого Excel." },
  { icon: "FileText", title: "Готовый PDF клиенту",      text: "Брендированная смета и предложение в один клик." },
  { icon: "Wallet",   title: "Точные цены материалов",   text: "Актуальная база расценок — без ошибок и недосчётов." },
  { icon: "Headset",  title: "Поддержка живого менеджера", text: "Поможем настроить, ответим на вопросы." },
];

export default function Pricing() {
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const [copied,  setCopied]  = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(PHONE_RAW);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = PHONE_RAW;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const choosePackage = (id: string) => {
    setSelected(id);
    setTimeout(() => {
      document.getElementById("payment-block")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const selectedPkg = PACKAGES.find(p => p.id === selected);

  return (
    <div className="min-h-screen text-white" style={{ background: "#06060c" }}>

      {/* Назад */}
      <div className="max-w-6xl mx-auto px-5 pt-6">
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white/70 transition">
          <Icon name="ArrowLeft" size={13} />
          Назад
        </button>
      </div>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-5 pt-10 pb-14 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold mb-5"
          style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.25)" }}>
          <Icon name="Sparkles" size={11} />
          ТАРИФЫ ДЛЯ МАСТЕРОВ
        </div>
        <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
          Считай сметы<br />
          <span style={{ background: "linear-gradient(90deg,#f97316,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            быстрее в 10 раз
          </span>
        </h1>
        <p className="text-sm md:text-base text-white/45 max-w-xl mx-auto">
          Один пакет — десятки готовых смет. Платишь за результат, не за подписку.
          Никаких списаний — пока не используешь.
        </p>
      </section>

      {/* Статус триала / приветствие */}
      <TrialBanner />

      {/* Тарифы */}
      <section className="max-w-6xl mx-auto px-5 pb-14">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PACKAGES.map(pkg => {
            const isSelected = selected === pkg.id;
            const isPopular  = pkg.badge === "Популярный";
            return (
              <div key={pkg.id}
                onClick={() => choosePackage(pkg.id)}
                className={`relative rounded-3xl p-5 cursor-pointer transition-all hover:-translate-y-1 ${isPopular ? "md:scale-[1.03]" : ""}`}
                style={{
                  background: isSelected ? `linear-gradient(180deg, ${pkg.glow}, rgba(8,8,15,0.9))` : "rgba(255,255,255,0.025)",
                  border: `1.5px solid ${isSelected ? pkg.color : "rgba(255,255,255,0.06)"}`,
                  boxShadow: isPopular ? `0 0 40px ${pkg.glow}` : "none",
                }}>

                {pkg.badge && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap"
                    style={{ background: pkg.color, color: "#0a0a14" }}>
                    {pkg.badge}
                  </div>
                )}

                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: pkg.color }}>
                  {pkg.name}
                </div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-3xl font-black">{pkg.price.toLocaleString("ru-RU")}</span>
                  <span className="text-sm text-white/30">₽</span>
                </div>
                <div className="text-[10px] text-white/35 mb-4">
                  {pkg.perEstimate} ₽ за одну смету
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
                  style={{ background: pkg.glow }}>
                  <Icon name="Calculator" size={13} style={{ color: pkg.color }} />
                  <span className="text-xs font-bold" style={{ color: pkg.color }}>
                    {pkg.estimates} смет на балансе
                  </span>
                </div>

                <ul className="space-y-1.5 mb-5">
                  {pkg.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-[11px] text-white/55 leading-snug">
                      <Icon name="Check" size={11} style={{ color: pkg.color, marginTop: 3 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className="w-full py-2.5 rounded-xl text-xs font-bold transition"
                  style={{
                    background: isSelected ? pkg.color : "rgba(255,255,255,0.05)",
                    color: isSelected ? "#0a0a14" : "#fff",
                    border: `1px solid ${isSelected ? pkg.color : "rgba(255,255,255,0.08)"}`,
                  }}>
                  {isSelected ? "✓ Выбран" : "Выбрать"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Преимущества */}
      <section className="max-w-5xl mx-auto px-5 pb-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black mb-2">Почему мастера выбирают нас</h2>
          <p className="text-sm text-white/40">Экономь часы — зарабатывай больше</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ADVANTAGES.map(a => (
            <div key={a.title} className="p-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(249,115,22,0.12)" }}>
                <Icon name={a.icon} size={18} style={{ color: "#f97316" }} />
              </div>
              <div className="text-sm font-bold text-white mb-1">{a.title}</div>
              <div className="text-[11px] text-white/40 leading-relaxed">{a.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Оплата */}
      <section id="payment-block" className="max-w-3xl mx-auto px-5 pb-16 scroll-mt-10">
        <div className="rounded-3xl p-7 md:p-9"
          style={{
            background: "linear-gradient(180deg, rgba(249,115,22,0.06), rgba(8,8,15,0.95))",
            border: "1.5px solid rgba(249,115,22,0.28)",
          }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(249,115,22,0.15)" }}>
              <Icon name="CreditCard" size={17} style={{ color: "#f97316" }} />
            </div>
            <div>
              <div className="text-base font-black text-white">Оплата перевод по СБП</div>
              <div className="text-[10px] text-white/35">Без комиссии · мгновенно</div>
            </div>
          </div>

          {selectedPkg ? (
            <div className="my-5 flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <div className="text-[10px] text-white/35">Выбран пакет</div>
                <div className="text-sm font-bold" style={{ color: selectedPkg.color }}>
                  {selectedPkg.name} — {selectedPkg.estimates} смет
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/35">К оплате</div>
                <div className="text-lg font-black text-white">{selectedPkg.price.toLocaleString("ru-RU")} ₽</div>
              </div>
            </div>
          ) : (
            <div className="my-5 px-4 py-3 rounded-xl text-center text-[11px] text-white/40"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.08)" }}>
              Выберите пакет выше, чтобы увидеть сумму
            </div>
          )}

          {/* Карточка с реквизитами */}
          <div className="rounded-2xl p-5 mb-4"
            style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-3">
              {SBP_HINT}
            </div>

            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-[10px] text-white/30 mb-0.5">Номер телефона</div>
                <div className="text-xl md:text-2xl font-black tracking-wide truncate">{PHONE}</div>
              </div>
              <button onClick={copyPhone}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-bold transition flex-shrink-0"
                style={{
                  background: copied ? "#10b981" : "#f97316",
                  color: "#fff",
                }}>
                <Icon name={copied ? "Check" : "Copy"} size={13} />
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <Icon name="Building2" size={12} style={{ color: "#94a3b8" }} />
              <span className="text-[11px] text-white/50">Банк получателя:</span>
              <span className="text-[11px] font-bold text-white">{BANK}</span>
            </div>
          </div>

          {/* Инструкция */}
          <div className="space-y-2 mb-5">
            <Step n={1} text="Откройте мобильный банк и выберите «Перевод по СБП по номеру телефона»" />
            <Step n={2} text={`Введите номер ${PHONE} и выберите банк ${BANK}`} />
            <Step n={3} text={selectedPkg ? `Переведите ${selectedPkg.price.toLocaleString("ru-RU")} ₽` : "Переведите сумму выбранного пакета"} />
            <Step n={4} text="Напишите нам в Telegram — начислим смет на баланс в течение 15 минут" />
          </div>

          {/* Кнопка Telegram */}
          <a href="https://t.me/JoniKras" target="_blank" rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition hover:opacity-90"
            style={{ background: "#29b6f6", color: "#fff" }}>
            <Icon name="Send" size={15} />
            Сообщить об оплате в Telegram
          </a>

          {user && (
            <div className="mt-3 text-center text-[10px] text-white/30">
              При сообщении укажите ваш ID: <span className="text-white/60 font-mono">{user.id}</span> ({user.email})
            </div>
          )}
        </div>

        {/* FAQ микро */}
        <div className="mt-8 grid md:grid-cols-2 gap-3">
          <Faq q="Когда начислятся сметы?"   a="В течение 15 минут после получения подтверждения от вас в Telegram. Обычно — за 2-5 минут." />
          <Faq q="Сметы сгорают?"             a="Нет. Купленные сметы остаются на балансе бессрочно. Списываются только за факт расчёта." />
          <Faq q="Можно вернуть деньги?"      a="Да, если не использовали ни одной сметы — вернём 100% в течение 14 дней." />
          <Faq q="Нужны чеки/документы?"      a="Если нужны закрывающие документы для юрлица — напишите в Telegram, оформим." />
        </div>
      </section>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-xl"
      style={{ background: "rgba(255,255,255,0.025)" }}>
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
        style={{ background: "#f97316", color: "#fff" }}>
        {n}
      </div>
      <div className="text-[12px] text-white/65 leading-snug">{text}</div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="p-4 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="text-xs font-bold text-white mb-1.5 flex items-center gap-1.5">
        <Icon name="HelpCircle" size={13} style={{ color: "#f97316" }} />
        {q}
      </div>
      <div className="text-[11px] text-white/45 leading-relaxed">{a}</div>
    </div>
  );
}

function TrialBanner() {
  const { user } = useAuth();

  // Не для бизнес-роли — показываем общий «триал для новых»
  const isBusiness = user && ["installer","company"].includes(user.role);

  if (!user || !isBusiness) {
    return (
      <section className="max-w-3xl mx-auto px-5 pb-10">
        <div className="rounded-3xl p-5 flex items-center gap-4"
          style={{
            background: "linear-gradient(90deg, rgba(16,185,129,0.10), rgba(16,185,129,0.02))",
            border: "1.5px solid rgba(16,185,129,0.28)",
          }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(16,185,129,0.18)" }}>
            <Icon name="Gift" size={22} style={{ color: "#10b981" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-black text-white">Бесплатно для новых мастеров</span>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                style={{ background: "#10b981", color: "#0a0a14" }}>FREE</span>
            </div>
            <div className="text-[11px] text-white/55 leading-snug">
              Зарегистрируйся как монтажник или компания — получи <b className="text-[#10b981]">20 смет</b> на <b className="text-[#10b981]">4 дня</b>. Без оплаты.
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Активный/истекший триал
  const trial = user.trial_until ? new Date(user.trial_until) : null;
  const now   = new Date();
  const balance = user.estimates_balance ?? 0;

  if (!trial) return null; // у бизнес-юзера должен быть, но на всякий случай

  const expired   = trial < now;
  const hoursLeft = Math.max(0, Math.floor((trial.getTime() - now.getTime()) / 3600000));
  const daysLeftN = Math.floor(hoursLeft / 24);
  const remainder = hoursLeft - daysLeftN * 24;

  return (
    <section className="max-w-3xl mx-auto px-5 pb-10">
      <div className="rounded-3xl p-5"
        style={{
          background: expired
            ? "linear-gradient(90deg, rgba(239,68,68,0.10), rgba(239,68,68,0.02))"
            : "linear-gradient(90deg, rgba(16,185,129,0.10), rgba(16,185,129,0.02))",
          border: `1.5px solid ${expired ? "rgba(239,68,68,0.28)" : "rgba(16,185,129,0.28)"}`,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: expired ? "rgba(239,68,68,0.18)" : "rgba(16,185,129,0.18)" }}>
            <Icon name={expired ? "AlertCircle" : "Gift"} size={22}
              style={{ color: expired ? "#ef4444" : "#10b981" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-black text-white">
                {expired ? "Пробный период истёк" : "Активен пробный период"}
              </span>
              {!expired && (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                  style={{ background: "#10b981", color: "#0a0a14" }}>FREE</span>
              )}
            </div>
            <div className="text-[11px] text-white/55 leading-snug">
              {expired
                ? "Чтобы продолжить считать сметы — выбери пакет ниже."
                : <>Осталось <b className="text-[#10b981]">{balance} смет</b> и <b className="text-[#10b981]">{daysLeftN > 0 ? `${daysLeftN} дн. ${remainder} ч.` : `${hoursLeft} ч.`}</b> до конца пробного периода.</>
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}