import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { AuthUser } from "@/context/AuthContext";

interface Props {
  user: AuthUser;
  isDark: boolean;
}

const DISMISSED_KEY = "trial_banner_dismissed";

export function TrialBanner({ user, isDark }: Props) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1"
  );

  const trial = user.trial_until ? new Date(user.trial_until) : null;
  const now = new Date();

  // Показываем если: есть trial_until, агент не куплен, баланс <= 20 (триальный), не закрыт
  const isTrialUser = !!trial && !user.agent_purchased_at;
  const trialAlive = isTrialUser && trial > now;
  const trialExpired = isTrialUser && trial <= now;

  // Баннер исчезает насовсем если агент куплен или пополнен баланс (> 20)
  if (user.has_own_agent || (user.estimates_balance ?? 0) > 20) return null;
  if (!isTrialUser) return null;
  if (dismissed) return null;

  const hoursLeft = Math.max(0, Math.floor((trial.getTime() - now.getTime()) / 3600000));
  const daysLeft = Math.floor(hoursLeft / 24);
  const hRem = hoursLeft - daysLeft * 24;
  const timeStr = daysLeft > 0 ? `${daysLeft} дн. ${hRem} ч.` : `${hoursLeft} ч.`;
  const balance = user.estimates_balance ?? 0;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const bg = isDark
    ? trialExpired
      ? "rgba(239,68,68,0.07)"
      : "rgba(16,185,129,0.07)"
    : trialExpired
      ? "rgba(239,68,68,0.06)"
      : "rgba(16,185,129,0.06)";

  const border = trialExpired
    ? "1px solid rgba(239,68,68,0.25)"
    : "1px solid rgba(16,185,129,0.25)";

  const accent = trialExpired ? "#ef4444" : "#10b981";

  const tgText = encodeURIComponent([
    "Здравствуйте! Хочу пополнить пакет смет.",
    ...(user ? [`\n👤 ID: ${user.id}`, `✉️ Email: ${user.email}`] : []),
  ].join("\n"));

  const agentText = encodeURIComponent([
    "Здравствуйте! Хочу купить Свой агент (White Label).",
    ...(user ? [`\n👤 ID: ${user.id}`, `✉️ Email: ${user.email}`] : []),
  ].join("\n"));

  return (
    <div className="px-3 sm:px-5 pt-3" style={{ maxWidth: "100%" }}>
      <div
        className="relative rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ background: bg, border }}
      >
        {/* Иконка */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18` }}
        >
          <Icon name={trialExpired ? "AlertTriangle" : "Sparkles"} size={16} style={{ color: accent }} />
        </div>

        {/* Текст */}
        <div className="flex-1 min-w-0">
          {trialAlive ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[12px] font-black text-white">
                Пробный период активен
              </span>
              {/* Счётчик дней */}
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                style={{ background: `${accent}18`, color: accent }}
              >
                <Icon name="Clock" size={10} />
                {timeStr}
              </span>
              {/* Счётчик смет */}
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
              >
                <Icon name="FileText" size={10} />
                {balance} {balance === 1 ? "смета" : balance < 5 ? "сметы" : "смет"}
              </span>
            </div>
          ) : (
            <span className="text-[12px] font-black" style={{ color: accent }}>
              Пробный период завершён
            </span>
          )}
          <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            {trialAlive
              ? "Используйте сметы пока они есть — потом нужно пополнить"
              : "Пополните пакет смет или подключите Свой агент для продолжения работы"}
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`https://t.me/poehalidev?text=${tgText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition hover:opacity-80 whitespace-nowrap"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Icon name="Plus" size={11} />
            Пополнить сметы
          </a>
          <a
            href={`https://t.me/poehalidev?text=${agentText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition hover:opacity-80 whitespace-nowrap"
            style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}35` }}
          >
            <Icon name="Bot" size={11} />
            Купить агента
          </a>
          {/* Крестик */}
          <button
            onClick={dismiss}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition hover:bg-white/10 flex-shrink-0"
            style={{ color: "rgba(255,255,255,0.3)" }}
            title="Закрыть"
          >
            <Icon name="X" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
