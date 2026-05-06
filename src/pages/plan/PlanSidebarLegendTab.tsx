// ─── Вкладка "Легенда" ───────────────────────────────────────────────────────
export default function LegendTab() {
  const items = [
    { color: "#7c3aed", dash: false,    label: "Контур помещения" },
    { color: "#34d399", dash: false,    label: "Первая точка (A)" },
    { color: "#c4b5fd", dash: false,    label: "Выделенная точка" },
    { color: "#60a5fa", dash: true,     label: "Размерная линия" },
    { color: "#92400e", dash: true,     label: "Диагональ" },
    { color: "#10b981", dash: true,     label: "Дуга / скругление" },
    { color: "#a78bfa", dash: true,     label: "Пользов. размерная линия" },
    { color: "#fb923c", dash: false,    label: "Нестандартный угол (≠90°)" },
    { color: "#fbbf24", dash: false,    label: "Метка угла" },
  ];
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Обозначения</p>
      <div className="space-y-2.5">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-3">
            <svg width={32} height={12} className="shrink-0">
              {item.dash
                ? <line x1={0} y1={6} x2={32} y2={6} stroke={item.color} strokeWidth={2} strokeDasharray="4 2" />
                : <line x1={0} y1={6} x2={32} y2={6} stroke={item.color} strokeWidth={2.5} />
              }
            </svg>
            <span className="text-[12px] text-white/60">{item.label}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mt-4 mb-2">Горячие клавиши</p>
      <div className="space-y-1.5">
        {[
          ["D", "Рисовать"],
          ["V", "Перемещение"],
          ["S", "Отрезки"],
          ["G", "Диагонали"],
          ["A", "Дуги"],
          ["R", "Размерные линии"],
          ["X", "Удаление"],
          ["Esc", "Отменить / сбросить"],
          ["Delete", "Удалить выбранное"],
          ["Ctrl+Z", "Отменить"],
          ["Ctrl+Y", "Повторить"],
          ["+/-", "Zoom"],
          ["0", "По размеру"],
          ["Alt+drag", "Панорамирование"],
          ["Колёсико", "Zoom"],
        ].map(([key, desc]) => (
          <div key={key} className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.07] border border-white/[0.1] text-[10px] font-mono text-white/50 shrink-0">{key}</kbd>
            <span className="text-[11px] text-white/45">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
