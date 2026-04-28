import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

export default function PricingHeroAndTrial() {
  const navigate = useNavigate();
  return (
    <>
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
    </>
  );
}

function TrialBanner() {
  const { user } = useAuth();

  // Не для бизнес-роли — показываем общий «триал для новых»
  const isBusiness = user && ["installer","company"].includes(user.role);

  if (!user || !isBusiness) {
    return (
      <section className="max-w-6xl mx-auto px-5 pb-10">
        <div className="rounded-3xl p-5 flex items-center gap-4 flex-wrap md:flex-nowrap"
          style={{
            background: "linear-gradient(90deg, rgba(16,185,129,0.10), rgba(16,185,129,0.02))",
            border: "1.5px solid rgba(16,185,129,0.28)",
          }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(16,185,129,0.18)" }}>
              <Icon name="Gift" size={22} style={{ color: "#10b981" }} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-black text-white">Бесплатно для новых мастеров</span>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                  style={{ background: "#10b981", color: "#0a0a14" }}>FREE</span>
              </div>
              <div className="text-[11px] text-white/55 leading-snug">
                Зарегистрируйся как монтажник или компания — получи <b className="text-[#10b981]">20 смет</b> на <b className="text-[#10b981]">4 дня</b>. Без оплаты.
              </div>
            </div>
            {!user && (
              <a href="/?auth=register"
                className="group flex-shrink-0 w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[13px] font-black uppercase tracking-wider transition-all hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #10b981, #34d399)",
                  color: "#0a0a14",
                  boxShadow: "0 8px 24px rgba(16,185,129,0.35), 0 0 0 1.5px rgba(255,255,255,0.12) inset",
                }}>
                <Icon name="Rocket" size={14} />
                <span>Попробовать бесплатно</span>
                <Icon name="ArrowRight" size={14} className="transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
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
