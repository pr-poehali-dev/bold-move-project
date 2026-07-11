import Icon from "@/components/ui/icon";

// ── Модалка "Как правильно составить репорт" ────────────────────────────────
export default function BugReportGuideModal({ onClose }: { onClose: () => void }) {
  const steps = [
    {
      icon: "MousePointerClick",
      color: "#3b82f6",
      title: "1. Что я нажал",
      text: "Укажи конкретную кнопку, вкладку или элемент. Не «в построителе», а «нажал кнопку „Заменить“ на товаре, прикреплённом к стене».",
    },
    {
      icon: "Play",
      color: "#f59e0b",
      title: "2. Какое действие сделал",
      text: "Опиши шаг за шагом, что делал дальше. Например: «выбрал 2 стены → открыл список товаров → кликнул на MSD Classic матовый».",
    },
    {
      icon: "AlertTriangle",
      color: "#ef4444",
      title: "3. Какой результат получил",
      text: "Что произошло на самом деле и почему это неправильно. Например: «товар прикрепился к стенам, хотя должен идти только на полотно».",
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "#14141c", border: "1px solid rgba(249,115,22,0.35)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon name="GraduationCap" size={20} style={{ color: "#fb923c" }} /> Как правильно составить репорт
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">
            <Icon name="X" size={20} />
          </button>
        </div>

        <p className="text-sm text-white/60 mb-4 leading-relaxed">
          Чтобы разработчик сразу понял проблему и не тратил время на уточнения — опиши свои действия <b className="text-white">по шагам</b>, как в примере ниже.
        </p>

        {/* Шаги */}
        <div className="flex flex-col gap-3 mb-5">
          {steps.map(s => (
            <div key={s.title} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${s.color}22` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.color + "1f" }}>
                <Icon name={s.icon} size={16} style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{s.title}</div>
                <div className="text-xs text-white/55 leading-relaxed">{s.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Пример правильного репорта */}
        <div className="rounded-xl p-3.5 mb-4" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Icon name="CheckCircle2" size={15} style={{ color: "#10b981" }} />
            <span className="text-xs font-bold" style={{ color: "#34d399" }}>Пример хорошего репорта</span>
          </div>
          <p className="text-xs text-white/75 leading-relaxed whitespace-pre-line">
            {"Нажал на товар «MSD Classic матовый» в списке добавления, при этом у меня были выделены 2 стены. Ожидал, что товар откроется в карточке снизу для добавления на полотно (эта категория настроена «только на полотно» в админке). По факту товар прикрепился прямо к выделенным стенам, как будто это стеновой профиль."}
          </p>
        </div>

        {/* Пример плохого репорта */}
        <div className="rounded-xl p-3.5 mb-5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Icon name="XCircle" size={15} style={{ color: "#ef4444" }} />
            <span className="text-xs font-bold" style={{ color: "#f87171" }}>Так писать не нужно</span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed italic">
            «Полотно не работает» / «глюк в построителе» / «почините пожалуйста»
          </p>
        </div>

        <button onClick={onClose}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition active:scale-95"
          style={{ background: "#f97316" }}>
          <Icon name="Check" size={16} /> Понятно, перейти к репорту
        </button>
      </div>
    </div>
  );
}
