import { ReactNode } from "react";

// ── Строка фильтров: подпись слева + чипы справа ────────────────────────────
// Подпись фиксированной ширины на десктопе — чипы всех строк выстраиваются
// по одной вертикали, блок фильтров читается как аккуратная таблица.
export default function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
      <span className="shrink-0 sm:w-20 text-[10px] font-bold uppercase tracking-wider text-white/35">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
