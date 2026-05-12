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
  image: string;
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
    image: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/8ca1f811-9c71-4742-bb4a-8a81b2a5952e.jpg",
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
    image: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/25dd27b1-2d7d-427e-beca-0786d7b4f77d.jpg",
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
    href: "/company?tab=crm&crm_tab=analytics",
    image: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/ae4900c1-c75d-4914-ba7c-a46b470891dd.jpg",
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
    image: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/e60d5107-51f9-469f-8dad-ac02a6035ca4.jpg",
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
    image: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/64d39d46-539d-49f3-be65-3281579c62ad.jpg",
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
    image: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/8ca8e39a-1009-4258-a2cb-c1cdd8a0a50e.jpg",
  },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  ready: { label: "Готово",              color: "#10b981", bg: "rgba(16,185,129,0.15)",  border: "rgba(16,185,129,0.35)"  },
  beta:  { label: "BETA · ранний доступ", color: "#e879f9", bg: "rgba(232,121,249,0.15)", border: "rgba(232,121,249,0.4)"  },
  soon:  { label: "В разработке",         color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.35)"  },
};

function SoonModal({ feature, onClose }: { feature: Feature; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "#0e0e1c", border: `1px solid ${feature.accent}30` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Картинка */}
        <div className="relative h-36 overflow-hidden">
          <img src={feature.image} alt="" className="w-full h-full object-cover" style={{ opacity: 0.55 }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 30%, #0e0e1c)` }} />
          <div className="absolute bottom-3 left-4">
            <div className="text-[11px] font-bold" style={{ color: feature.accent }}>{feature.tag}</div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
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
    if (f.href) {
      onClose();
      window.location.href = f.href;
      return;
    }
    setSoonFeature(f);
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
          style={{ background: "#0a0a16", border: "1px solid rgba(255,255,255,0.07)" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Хэндл мобильный */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Хедер */}
          <div className="flex items-start justify-between px-5 pt-4 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase"
                  style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
                  ЭКО-СИСТЕМА
                </div>
              </div>
              <h2 className="text-xl font-black text-white leading-tight">AI-potolki — всё в одном</h2>
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
              const clickable = !!f.href;
              return (
                <button
                  key={f.tag}
                  onClick={() => handleCardClick(f)}
                  className="rounded-2xl flex flex-col text-left transition-all active:scale-[0.97] overflow-hidden group"
                  style={{
                    background: "#0e0e1c",
                    border: `1px solid ${f.accent}25`,
                    cursor: clickable ? "pointer" : "default",
                  }}
                >
                  {/* Картинка — компактная */}
                  <div className="relative h-20 overflow-hidden flex-shrink-0">
                    <img
                      src={f.image}
                      alt={f.tag}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      style={{ opacity: f.status === "soon" ? 0.35 : 0.6 }}
                    />
                    <div className="absolute inset-0"
                      style={{ background: `linear-gradient(to bottom, ${f.accent}08 0%, #0e0e1c 100%)` }} />
                    <div className="absolute top-0 left-0 right-0 h-0.5"
                      style={{ background: `linear-gradient(to right, ${f.accent}, transparent)` }} />
                    {/* Бейдж статуса */}
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold backdrop-blur-sm"
                        style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        <div className="w-1 h-1 rounded-full flex-shrink-0"
                          style={{ background: st.color, boxShadow: `0 0 4px ${st.color}` }} />
                        {st.label}
                      </div>
                    </div>
                  </div>

                  {/* Контент */}
                  <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1.5 flex-1">
                    {/* Тег — крупный акцент */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: `${f.accent}20` }}>
                        <Icon name={f.icon} size={11} style={{ color: f.accent }} />
                      </div>
                      <span className="text-[15px] font-black tracking-tight" style={{ color: f.accent }}>{f.tag}</span>
                    </div>

                    <div className="text-[12px] font-bold text-white leading-snug">{f.title}</div>
                    <div className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{f.desc}</div>

                    {/* Футер */}
                    <div className="flex items-center justify-between mt-auto pt-1.5">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                        style={{ background: `${f.accent}12`, color: f.accent }}>
                        <Icon name={f.badgeIcon} size={10} />
                        {f.badge}
                      </div>
                      {clickable && (
                        <div className="w-5 h-5 rounded-md flex items-center justify-center transition group-hover:translate-x-0.5"
                          style={{ background: `${f.accent}15`, color: f.accent }}>
                          <Icon name="ArrowRight" size={10} />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Футер */}
          <div className="mx-4 mb-4 p-3 rounded-2xl flex items-center gap-3"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(249,115,22,0.12)" }}>
              <Icon name="Sparkles" size={15} style={{ color: "#f97316" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-white">Мы активно развиваем эко-систему</div>
              <div className="text-[11px] text-white/35 mt-0.5">Следи за обновлениями — всё только начинается</div>
            </div>
            <button
              onClick={() => { onClose(); window.location.href = "/news"; }}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition hover:opacity-80 flex-shrink-0"
              style={{ background: "#f97316", color: "#fff" }}
            >
              Новости
            </button>
          </div>
        </div>
      </div>

      {soonFeature && <SoonModal feature={soonFeature} onClose={() => setSoonFeature(null)} />}
    </>
  );
}