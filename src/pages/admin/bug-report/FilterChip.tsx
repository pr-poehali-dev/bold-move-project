import Icon from "@/components/ui/icon";

// ── Чип-фильтр ─────────────────────────────────────────────────────────────
// Активный чип подсвечивается своим цветом (фон + рамка + свечение),
// неактивный — нейтральный. Точка слева всегда показывает цвет категории,
// чтобы фильтры читались даже без выделения.
export default function FilterChip({ label, count, active, color, onClick, icon, showDot = true }: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
  icon?: string;
  showDot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 active:scale-95"
      style={{
        background: active ? color + "26" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? color + "66" : "rgba(255,255,255,0.10)"}`,
        color: active ? color : "rgba(255,255,255,0.65)",
        boxShadow: active ? `0 0 0 3px ${color}1a` : "none",
      }}
    >
      {icon ? (
        <Icon name={icon} size={13} style={{ color: active ? color : "rgba(255,255,255,0.45)" }} />
      ) : showDot ? (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 transition"
          style={{ background: color, opacity: active ? 1 : 0.5 }}
        />
      ) : null}
      <span className="whitespace-nowrap">{label}</span>
      <span
        className="min-w-[18px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none transition"
        style={{
          background: active ? color + "33" : "rgba(255,255,255,0.07)",
          color: active ? color : "rgba(255,255,255,0.45)",
        }}
      >
        {count}
      </span>
    </button>
  );
}
