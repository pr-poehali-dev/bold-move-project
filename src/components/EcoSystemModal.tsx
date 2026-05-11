import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  onClose: () => void;
}

type Status = "ready" | "beta" | "soon";

interface Feature {
  icon: string;
  tag: string;
  title: string;
  desc: string;
  accent: string;
  badge: string;
  badgeIcon: string;
  status: Status;
  href?: string;
}

const FEATURES: Feature[] = [
  {
    icon: "Bot",
    tag: "AI-агент",
    title: "Готовая смета за 30 секунд",
    desc: "Просто скажи или напиши: площадь, что хочешь — и получи точную смету. Голос, текст, фото — всё работает.",
    accent: "#f97316",
    badge: "Голосовой ввод",
    badgeIcon: "Mic",
    status: "ready",
    href: "/",
  },
  {
    icon: "PenTool",
    tag: "AI-построитель",
    title: "Точная смета. Управление голосом",
    desc: "Нарисуй план комнаты голосом или пальцем. Система сама посчитает площадь и построит смету до копейки.",
    accent: "#a855f7",
    badge: "Голос + касание",
    badgeIcon: "Mic2",
    status: "beta",
    href: "/plan",
  },
  {
    icon: "FileSearch",
    tag: "AI-анализатор",
    title: "Загрузи проект — получи КП за минуту",
    desc: "Скинь PDF, фото или файл Excel — AI разберёт его и сформирует готовое коммерческое предложение.",
    accent: "#06b6d4",
    badge: "Загрузи файл",
    badgeIcon: "Upload",
    status: "soon",
  },
  {
    icon: "Megaphone",
    tag: "AI-маркетинг",
    title: "Клиент сам вспомнит о тебе",
    desc: "Больше не нужно думать что написать клиенту. AI сам отправит нужное сообщение в нужный момент.",
    accent: "#ec4899",
    badge: "Автопилот",
    badgeIcon: "Zap",
    status: "soon",
  },
  {
    icon: "LayoutDashboard",
    tag: "CRM",
    title: "Все заявки в одном месте",
    desc: "Канбан, статусы, история общения, сметы, документы — всё по каждому клиенту. Ничего не теряется.",
    accent: "#10b981",
    badge: "Всё в одном",
    badgeIcon: "CheckSquare",
    status: "ready",
    href: "/company?tab=crm",
  },
  {
    icon: "BarChart3",
    tag: "Аналитика",
    title: "Никаких Excel — всё видно сразу",
    desc: "Выручка, средний чек, конверсия, лучшие менеджеры — живые цифры вашего бизнеса прямо в системе.",
    accent: "#f59e0b",
    badge: "Живые данные",
    badgeIcon: "TrendingUp",
    status: "ready",
    href: "/company?tab=crm",
  },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  ready: { label: "Готово", color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  beta:  { label: "В разработке", color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.3)" },
  soon:  { label: "Скоро", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
};

function SoonModal({ feature, onClose }: { feature: Feature; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 flex flex-col items-center text-center gap-4"
        style={{ background: "#0e0e1c", border: `1px solid ${feature.accent}30` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: `${feature.accent}18` }}>
          <Icon name={feature.icon} size={26} style={{ color: feature.accent }} />
        </div>
        <div>
          <div className="text-[11px] font-bold mb-1" style={{ color: feature.accent }}>{feature.tag}</div>
          <div className="text-[17px] font-black text-white leading-tight mb-2">{feature.title}</div>
          <div className="text-[13px] text-white/50 leading-relaxed">{feature.desc}</div>
        </div>
        <div className="w-full p-3 rounded-2xl flex items-start gap-3"
          style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.15)" }}>
          <Icon name="Rocket" size={16} style={{ color: "#f97316", flexShrink: 0, marginTop: 1 }} />
          <div className="text-left">
            <div className="text-[12px] font-bold text-white">Мы активно развиваем эко-систему</div>
            <div className="text-[11px] text-white/40 mt-0.5">
              Вернёмся к этой задаче совсем скоро. Следи за обновлениями в разделе Новости.
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

export default function EcoSystemModal({ onClose }: Props) {
  const [soonFeature, setSoonFeature] = useState<Feature | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setSoonFeature(null); onClose(); } };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCardClick = (f: Feature) => {
    if (f.status === "soon" || f.status === "beta") {
      setSoonFeature(f);
      return;
    }
    if (f.href) {
      window.location.href = f.href;
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
        onClick={onClose}
      >
        <div
          className="relative w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
          style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Хэндл мобильный */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Хедер */}
          <div className="flex items-start justify-between px-5 pt-4 pb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
                  style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
                  ЭКО-СИСТЕМА
                </div>
              </div>
              <h2 className="text-lg font-black text-white leading-tight">AI-potolki — всё в одном</h2>
              <p className="text-[12px] text-white/40 mt-0.5">Полный цикл от заявки до аналитики</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:bg-white/10 text-white/40 hover:text-white/80 shrink-0 mt-0.5">
              <Icon name="X" size={16} />
            </button>
          </div>

          {/* Карточки */}
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => {
              const st = STATUS_CONFIG[f.status];
              const clickable = f.status === "ready";
              return (
                <button
                  key={f.tag}
                  onClick={() => handleCardClick(f)}
                  className="rounded-2xl p-4 flex flex-col gap-2 text-left transition-all active:scale-[0.98]"
                  style={{
                    background: `${f.accent}08`,
                    border: `1px solid ${f.accent}22`,
                    cursor: clickable ? "pointer" : "default",
                    opacity: f.status === "soon" ? 0.75 : 1,
                  }}
                >
                  {/* Строка: иконка + тег + статус */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${f.accent}18` }}>
                        <Icon name={f.icon} size={16} style={{ color: f.accent }} />
                      </div>
                      <span className="text-[11px] font-bold tracking-wide" style={{ color: f.accent }}>
                        {f.tag}
                      </span>
                    </div>
                    {/* Лейбл статуса */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                      <span className="text-[9px] font-bold" style={{ color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                  </div>

                  {/* Заголовок */}
                  <div className="text-[14px] font-bold text-white leading-snug">{f.title}</div>

                  {/* Описание */}
                  <div className="text-[12px] text-white/50 leading-relaxed">{f.desc}</div>

                  {/* Бейдж фичи + стрелка если готово */}
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: `${f.accent}12`, border: `1px solid ${f.accent}20` }}>
                      <Icon name={f.badgeIcon} size={9} style={{ color: f.accent }} />
                      <span className="text-[9px] font-semibold" style={{ color: `${f.accent}cc` }}>
                        {f.badge}
                      </span>
                    </div>
                    {clickable && (
                      <Icon name="ArrowRight" size={13} style={{ color: `${f.accent}80` }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Футер */}
          <div className="mx-4 mb-4 p-3 rounded-2xl flex items-center gap-3"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(249,115,22,0.15)" }}>
              <Icon name="Sparkles" size={15} style={{ color: "#f97316" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-white">Мы активно развиваем эко-систему</div>
              <div className="text-[11px] text-white/40">Следи за обновлениями — всё только начинается</div>
            </div>
            <button
              onClick={() => { onClose(); window.location.href = "/news"; }}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition hover:opacity-80"
              style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.25)" }}>
              <Icon name="Newspaper" size={11} />
              Новости
            </button>
          </div>
        </div>
      </div>

      {soonFeature && (
        <SoonModal feature={soonFeature} onClose={() => setSoonFeature(null)} />
      )}
    </>
  );
}
