import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { PHONE, PHONE_RAW, BANK, SBP_HINT, PACKAGES } from "./pricingData";

interface Props {
  selectedId: string | null;
}

export default function PricingPayment({ selectedId }: Props) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const selectedPkg = PACKAGES.find(p => p.id === selectedId);

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

  return (
    <section id="payment-block"
      className={`${selectedPkg ? "max-w-3xl" : "max-w-6xl"} mx-auto px-5 pb-16 scroll-mt-10`}>

      {!selectedPkg ? (
        /* ── CTA в стиле сайта пока пакет не выбран ───────────────────── */
        <div className="relative rounded-[28px] overflow-hidden p-8 md:p-14"
          style={{
            background:
              "radial-gradient(120% 140% at 0% 0%, rgba(249,115,22,0.16), rgba(8,8,15,0) 55%), radial-gradient(120% 140% at 100% 100%, rgba(251,191,36,0.10), rgba(8,8,15,0) 55%), #0a0a14",
            border: "1.5px solid rgba(249,115,22,0.30)",
            boxShadow: "0 0 80px rgba(249,115,22,0.14)",
          }}>

          {/* Декоративные орбы */}
          <div className="absolute -top-32 -left-32 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(249,115,22,0.18), transparent 65%)" }} />
          <div className="absolute -bottom-32 -right-32 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.12), transparent 65%)" }} />

          <div className="relative grid lg:grid-cols-[1fr_auto] gap-8 items-center">

            {/* Левая часть — текст */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-5"
                style={{ background: "rgba(249,115,22,0.18)", color: "#fbbf24", border: "1px solid rgba(249,115,22,0.4)" }}>
                <Icon name="Rocket" size={11} />
                Старт прямо сейчас
              </div>

              <h2 className="text-3xl md:text-5xl font-black leading-[1.05] tracking-tight mb-4">
                Вперёд к<br />
                <span style={{ background: "linear-gradient(90deg,#f97316,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  достижениям!
                </span>
              </h2>

              <p className="text-sm md:text-base text-white/55 max-w-lg leading-relaxed mb-6">
                Выбери тариф выше — и мы сразу покажем, как оплатить.
                Без сложных регистраций, форм и комиссий.
              </p>

              {/* Микро-цифры */}
              <div className="grid grid-cols-3 gap-3 max-w-md">
                {[
                  { v: "30 сек", l: "одна смета"     },
                  { v: "0%",     l: "комиссия СБП"   },
                  { v: "15 мин", l: "до начисления"  },
                ].map(s => (
                  <div key={s.l} className="rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-base md:text-lg font-black" style={{ color: "#fbbf24" }}>{s.v}</div>
                    <div className="text-[10px] text-white/40 leading-tight">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Правая часть — кнопка */}
            <div className="flex flex-col items-stretch lg:items-end gap-3">
              <button
                onClick={() => {
                  document.querySelector("#packages-grid")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="group relative overflow-hidden rounded-2xl px-7 py-5 md:py-6 transition-all hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #f97316, #fb923c)",
                  boxShadow: "0 12px 35px rgba(249,115,22,0.45), 0 0 0 1.5px rgba(255,255,255,0.12) inset",
                }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #fb923c, #fbbf24)" }} />
                <div className="relative flex items-center gap-3 whitespace-nowrap">
                  <Icon name="ArrowUp" size={20} style={{ color: "#fff" }} />
                  <span className="text-base md:text-lg font-black text-white uppercase tracking-wider">
                    Выбрать пакет
                  </span>
                </div>
              </button>
              <div className="text-[11px] text-white/35 text-center lg:text-right flex items-center gap-1.5 justify-center lg:justify-end">
                <Icon name="ShieldCheck" size={11} style={{ color: "#10b981" }} />
                Возврат 100% в течение 14 дней
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* ── Блок СБП после выбора пакета ─────────────────────────────── */
        <>
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
              <Step n={3} text={`Переведите ${selectedPkg.price.toLocaleString("ru-RU")} ₽`} />
              <Step n={4} text="Напишите нам в Telegram — начислим смет на баланс в течение 15 минут" />
            </div>

            {/* Кнопка Telegram с предзаполненным сообщением */}
            {(() => {
              const lines = [
                "Здравствуйте! Хочу оплатить тариф.",
                "",
                `📦 Пакет: ${selectedPkg.name} — ${selectedPkg.estimates} смет`,
                `💳 Сумма: ${selectedPkg.price.toLocaleString("ru-RU")} ₽`,
              ];
              if (user) {
                lines.push("", `👤 ID: ${user.id}`, `✉️ Email: ${user.email}`);
              }
              const tgText = encodeURIComponent(lines.join("\n"));
              return (
                <a href={`https://t.me/JoniKras?text=${tgText}`} target="_blank" rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition hover:opacity-90"
                  style={{ background: "#29b6f6", color: "#fff" }}>
                  <Icon name="Send" size={15} />
                  Сообщить об оплате в Telegram
                </a>
              );
            })()}

            <div className="mt-3 text-center text-[10px] text-white/30">
              {user
                ? <>Сообщение уже готово — ID <span className="text-white/60 font-mono">{user.id}</span> и тариф подставятся автоматически</>
                : <>Сообщение готово — тариф подставится автоматически. После оплаты укажи свой email/телефон в чате</>
              }
            </div>
          </div>

          {/* FAQ микро */}
          <div className="mt-8 grid md:grid-cols-2 gap-3">
            <Faq q="Когда начислятся сметы?"   a="В течение 15 минут после получения подтверждения от вас в Telegram. Обычно — за 2-5 минут." />
            <Faq q="Сметы сгорают?"             a="Нет. Купленные сметы остаются на балансе бессрочно. Списываются только за факт расчёта." />
            <Faq q="Можно вернуть деньги?"      a="Да, если не использовали ни одной сметы — вернём 100% в течение 14 дней." />
            <Faq q="Нужны чеки/документы?"      a="Если нужны закрывающие документы для юрлица — напишите в Telegram, оформим." />
          </div>
        </>
      )}
    </section>
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
