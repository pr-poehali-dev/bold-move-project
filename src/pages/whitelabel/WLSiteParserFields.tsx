import Icon from "@/components/ui/icon";
import type { FilledField, MissingField } from "./WLSiteParserTypes";

// ── Список заполненных полей ────────────────────────────────────────────────

interface FilledListProps {
  filled: FilledField[];
  total: number;
  animated?: boolean;
  visibleCount?: number;
}

export function FilledList({ filled, total, animated = false, visibleCount = filled.length }: FilledListProps) {
  if (filled.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
        style={{ color: "#10b981" }}>
        <Icon name="CheckCircle2" size={11} />
        {animated
          ? `Заполнено (${visibleCount}/${filled.length})`
          : `Заполнено (${filled.length}/${total})`}
      </div>
      <div className="space-y-1.5">
        {filled.slice(0, visibleCount).map((f, i) => (
          <div key={f.field}
            className="flex items-start gap-2 rounded-lg px-2.5 py-1.5"
            style={{
              background: "rgba(16,185,129,0.06)",
              border: "1px solid rgba(16,185,129,0.18)",
              ...(animated ? { animation: "fadeSlideIn 0.3s ease both", animationDelay: `${i * 0}ms` } : {}),
            }}>
            <Icon name="Check" size={10} className="mt-0.5 flex-shrink-0" style={{ color: "#10b981" }} />
            <div className="min-w-0">
              <span className="text-[10px] text-white/40">{f.label}: </span>
              <span className="text-[11px] text-white/80 font-medium break-all">{f.value}</span>
            </div>
          </div>
        ))}
        {animated && filled.slice(visibleCount).map(f => (
          <div key={f.field}
            className="flex items-start gap-2 rounded-lg px-2.5 py-1.5 opacity-20"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 bg-white/20" />
            <div className="text-[10px] text-white/30">{f.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Пилюли ненайденных полей ────────────────────────────────────────────────

interface MissingPillsProps {
  missing: MissingField[];
  searching: string | null;
  notFound: string | null;
  disabled: boolean;
  label?: string;
  onSearch: (f: MissingField) => void;
}

export function MissingPills({ missing, searching, notFound, disabled, label, onSearch }: MissingPillsProps) {
  if (missing.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
        style={{ color: "#f59e0b" }}>
        <Icon name="AlertTriangle" size={11} />
        {label ?? `Не найдено (${missing.length})`}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {missing.map(f => {
          const isSearching = searching === f.field;
          const isNotFound  = notFound === f.field;
          return (
            <button key={f.field}
              onClick={() => onSearch(f)}
              disabled={!!searching || disabled}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-medium transition hover:opacity-80 disabled:opacity-50 cursor-pointer"
              style={isNotFound
                ? { background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }
                : { background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" }
              }>
              {isSearching
                ? <div className="w-2.5 h-2.5 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
                : isNotFound
                  ? <Icon name="X" size={9} />
                  : <Icon name="Search" size={9} />
              }
              {isNotFound ? `${f.label} — не найдено` : f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
