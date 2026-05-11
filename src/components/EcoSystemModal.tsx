import { useEffect } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  onClose: () => void;
}

const FEATURES = [
  {
    icon: "Bot",
    tag: "AI-агент",
    title: "Готовая смета за 30 секунд",
    desc: "Просто скажи или напиши: площадь, что хочешь — и получи точную смету. Голос, текст, фото — всё работает.",
    accent: "#f97316",
    badge: "Голосовой ввод",
    badgeIcon: "Mic",
  },
  {
    icon: "PenTool",
    tag: "AI-построитель",
    title: "Точная смета. Управление голосом",
    desc: "Нарисуй план комнаты голосом или пальцем. Система сама посчитает площадь и построит смету до копейки.",
    accent: "#a855f7",
    badge: "Голос + касание",
    badgeIcon: "Mic2",
  },
  {
    icon: "FileSearch",
    tag: "AI-анализатор",
    title: "Загрузи проект — получи КП за минуту",
    desc: "Скинь PDF, фото или файл Excel — AI разберёт его и сформирует готовое коммерческое предложение.",
    accent: "#06b6d4",
    badge: "Загрузи файл",
    badgeIcon: "Upload",
  },
  {
    icon: "Megaphone",
    tag: "AI-маркетинг",
    title: "Клиент сам вспомнит о тебе",
    desc: "Больше не нужно думать что написать клиенту. AI сам отправит нужное сообщение в нужный момент.",
    accent: "#ec4899",
    badge: "Автопилот",
    badgeIcon: "Zap",
  },
  {
    icon: "LayoutDashboard",
    tag: "CRM",
    title: "Все заявки в одном месте",
    desc: "Канбан, статусы, история общения, сметы, документы — всё по каждому клиенту. Ничего не теряется.",
    accent: "#10b981",
    badge: "Всё в одном",
    badgeIcon: "CheckSquare",
  },
  {
    icon: "BarChart3",
    tag: "Аналитика",
    title: "Никаких Excel — всё видно сразу",
    desc: "Выручка, средний чек, конверсия, лучшие менеджеры — живые цифры вашего бизнеса прямо в системе.",
    accent: "#f59e0b",
    badge: "Живые данные",
    badgeIcon: "TrendingUp",
  },
];

export default function EcoSystemModal({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
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
        {/* Хэндл (мобильный) */}
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
            <h2 className="text-lg font-black text-white leading-tight">
              AI-potolki — всё в одном
            </h2>
            <p className="text-[12px] text-white/40 mt-0.5">Полный цикл от заявки до аналитики</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:bg-white/10 text-white/40 hover:text-white/80 shrink-0 mt-0.5"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Карточки */}
        <div className="px-4 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.tag}
              className="rounded-2xl p-4 flex flex-col gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: `${f.accent}08`,
                border: `1px solid ${f.accent}22`,
              }}
            >
              {/* Иконка + тег */}
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
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ background: `${f.accent}12`, border: `1px solid ${f.accent}20` }}>
                  <Icon name={f.badgeIcon} size={9} style={{ color: f.accent }} />
                  <span className="text-[9px] font-semibold" style={{ color: `${f.accent}cc` }}>
                    {f.badge}
                  </span>
                </div>
              </div>

              {/* Заголовок */}
              <div className="text-[14px] font-bold text-white leading-snug">
                {f.title}
              </div>

              {/* Описание */}
              <div className="text-[12px] text-white/50 leading-relaxed">
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Футер */}
        <div className="mx-4 mb-4 p-3 rounded-2xl flex items-center gap-3"
          style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(249,115,22,0.15)" }}>
            <Icon name="Sparkles" size={15} style={{ color: "#f97316" }} />
          </div>
          <div>
            <div className="text-[12px] font-bold text-white">Всё готово. Ничего настраивать не нужно.</div>
            <div className="text-[11px] text-white/40">Одна система — все инструменты вашего бизнеса</div>
          </div>
        </div>
      </div>
    </div>
  );
}
