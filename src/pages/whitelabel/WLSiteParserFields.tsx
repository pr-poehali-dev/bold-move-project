import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { FilledField, MissingField } from "./WLSiteParserTypes";

// ── Список заполненных полей ────────────────────────────────────────────────

interface FilledListProps {
  filled: FilledField[];
  total: number;
  animated?: boolean;
  visibleCount?: number;
  onEdit?: (field: string, value: string) => void;
}

function EditableField({ f, onEdit }: { f: FilledField; onEdit?: (field: string, value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(f.value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(f.value); }, [f.value]);

  const commit = () => {
    setEditing(false);
    if (val !== f.value) onEdit?.(f.field, val);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
        style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.4)" }}>
        <Icon name="Pencil" size={10} className="flex-shrink-0" style={{ color: "#10b981" }} />
        <span className="text-[10px] text-white/40 flex-shrink-0">{f.label}:</span>
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(f.value); setEditing(false); } }}
          autoFocus
          className="flex-1 min-w-0 bg-transparent text-[11px] text-white font-medium outline-none border-b border-emerald-500/50"
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => { if (onEdit) { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); } }}
      className="flex items-start gap-2 rounded-lg px-2.5 py-1.5 group"
      style={{
        background: "rgba(16,185,129,0.06)",
        border: "1px solid rgba(16,185,129,0.18)",
        cursor: onEdit ? "text" : "default",
      }}>
      <Icon name="Check" size={10} className="mt-0.5 flex-shrink-0" style={{ color: "#10b981" }} />
      <div className="min-w-0 flex-1">
        <span className="text-[10px] text-white/40">{f.label}: </span>
        <span className="text-[11px] text-white/80 font-medium break-all">{f.value}</span>
      </div>
      {onEdit && (
        <Icon name="Pencil" size={9} className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: "#10b981" }} />
      )}
    </div>
  );
}

export function FilledList({ filled, total, animated = false, visibleCount = filled.length, onEdit }: FilledListProps) {
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
            style={animated ? { animation: "fadeSlideIn 0.3s ease both", animationDelay: `${i * 0}ms` } : {}}>
            <EditableField f={f} onEdit={onEdit} />
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
  onSearchAll?: () => void;
}

export function MissingPills({ missing, searching, notFound, disabled, label, onSearch, onSearchAll }: MissingPillsProps) {
  if (missing.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
        style={{ color: "#f59e0b" }}>
        <Icon name="AlertTriangle" size={11} />
        <span className="flex-1">{label ?? `Не найдено (${missing.length})`}</span>
        {onSearchAll && missing.length > 1 && (
          <button
            onClick={onSearchAll}
            disabled={!!searching || disabled}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "#f59e0b" }}>
            {searching
              ? <div className="w-2 h-2 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
              : <Icon name="Search" size={9} />
            }
            Найти все
          </button>
        )}
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
