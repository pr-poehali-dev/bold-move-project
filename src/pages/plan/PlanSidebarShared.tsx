import React from "react";
import Icon from "@/components/ui/icon";

// ─── Аккордеон-секция ─────────────────────────────────────────────────────────
export function Section({
  title, icon, iconColor, children, defaultOpen = true,
  visible, onVisibilityToggle, badge, forceOpen,
}: {
  title: string; icon: string; iconColor: string;
  children: React.ReactNode; defaultOpen?: boolean;
  visible?: boolean; onVisibilityToggle?: () => void;
  badge?: string;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  // Авторазкрытие при изменении forceOpen (например после замыкания фигуры)
  const prevForceOpen = React.useRef(forceOpen);
  React.useEffect(() => {
    if (forceOpen && !prevForceOpen.current) setOpen(true);
    prevForceOpen.current = forceOpen;
  }, [forceOpen]);
  return (
    <div className="border-b border-white/[0.06]">
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.025] transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setOpen(o => !o); }}
      >
        <Icon name={icon} size={13} style={{ color: iconColor }} />
        <span className="flex-1 text-left text-[13px] font-semibold text-white/75 select-none">{title}</span>
        {badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/[0.07] text-white/40">{badge}</span>}
        {onVisibilityToggle && (
          <button onClick={e => { e.stopPropagation(); onVisibilityToggle(); }}
            className="p-1 rounded-lg hover:bg-white/10 transition" title="Показать / скрыть">
            <Icon name={visible ? "Eye" : "EyeOff"} size={13} className={visible ? "text-white/45" : "text-white/20"} />
          </button>
        )}
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={13} className="text-white/25 shrink-0" />
      </div>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

// ─── Строка длины ─────────────────────────────────────────────────────────────
export function LengthRow({
  label, valueCm, placeholder, visible,
  onValueChange, onVisibilityToggle, onDelete, onFocus, onEnterNext, inputRef, autoFocus,
}: {
  label: string; valueCm: number | null; placeholder?: string;
  visible: boolean;
  onValueChange: (v: number | null) => void;
  onVisibilityToggle: () => void;
  onDelete?: () => void;
  onFocus?: () => void;
  onEnterNext?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  autoFocus?: boolean;
}) {
  const localRef = React.useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;

  // Локальный стейт — пользователь набирает цифры, фокус никуда не прыгает
  const [draft, setDraft] = React.useState<string>(valueCm !== null ? String(valueCm) : "");
  const [focused, setFocused] = React.useState(false);

  // Синхронизируем draft только когда поле НЕ в фокусе
  React.useEffect(() => {
    if (!focused) {
      setDraft(valueCm !== null ? String(valueCm) : "");
    }
  }, [valueCm, focused]);

  // Автофокус при появлении (после замыкания фигуры)
  React.useEffect(() => {
    if (autoFocus) {
      const id = setTimeout(() => ref.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [autoFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const v = draft === "" ? null : parseFloat(draft);
    onValueChange(v !== null && !isNaN(v) ? v : null);
  };

  return (
    <div className="flex items-center gap-1.5 py-1.5 rounded-lg px-1.5 transition-colors hover:bg-white/[0.03]">
      <span className="w-10 text-[11px] font-mono font-bold text-white/50 shrink-0">{label}</span>
      <input ref={ref} type="number" min={1} max={99999} step={0.5}
        value={draft}
        placeholder={placeholder ?? "—"}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => { setFocused(true); onFocus?.(); }}
        onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={e => {
          if (e.key === "Enter") {
            commit();
            if (onEnterNext) {
              e.preventDefault();
              onEnterNext();
            } else {
              (e.target as HTMLInputElement).blur();
            }
          }
        }}
        className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition min-w-0"
      />
      <span className="text-[9px] text-white/25 shrink-0">см</span>
      <button onClick={onVisibilityToggle} className="p-1 rounded hover:bg-white/10 transition shrink-0" title="Показать/скрыть">
        <Icon name={visible ? "Eye" : "EyeOff"} size={11} className={visible ? "text-white/35" : "text-white/15"} />
      </button>
      {onDelete && (
        <button onClick={onDelete} className="p-1 rounded hover:bg-rose-500/20 transition shrink-0" title="Удалить">
          <Icon name="Trash2" size={11} className="text-rose-400/40 hover:text-rose-400" />
        </button>
      )}
    </div>
  );
}