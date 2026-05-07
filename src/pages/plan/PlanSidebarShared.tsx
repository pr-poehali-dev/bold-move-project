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
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") setOpen(o => !o);
        }}
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
  onValueChange, onVisibilityToggle, onDelete, onFocus, onEnterNext, inputRef, autoFocus, highlighted, autoRecalc,
  onFlipDirection, directionFlipped,
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
  highlighted?: boolean;
  autoRecalc?: boolean;
  onFlipDirection?: () => void;
  directionFlipped?: boolean;
}) {
  const localRef = React.useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;

  // Мигание при автопересчёте: flash = анимация запущена (сбрасывается через 1.2с)
  // autoRecalc = остаётся true → поле остаётся жёлтым до следующего изменения
  const [flash, setFlash] = React.useState(false);
  const prevAutoRecalc = React.useRef(autoRecalc);
  React.useEffect(() => {
    const prev = prevAutoRecalc.current;
    prevAutoRecalc.current = autoRecalc;
    if (autoRecalc && !prev) {
      // autoRecalc только что стал true → запускаем мигание
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
    if (!autoRecalc) {
      // autoRecalc сброшен → гасим flash немедленно
      setFlash(false);
    }
  }, [autoRecalc]);

  // Автофокус при появлении
  const didAutoFocus = React.useRef(false);
  React.useEffect(() => {
    if (autoFocus && !didAutoFocus.current) {
      didAutoFocus.current = true;
      const id = setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 120);
      return () => clearTimeout(id);
    }
  }, [autoFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Синхронизируем значение input с внешним valueCm когда поле не в фокусе
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el) {
      el.value = valueCm !== null ? String(valueCm) : "";
    }
  }, [valueCm]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (el: HTMLInputElement) => {
    const v = el.value === "" ? null : parseFloat(el.value);
    onValueChange(v !== null && !isNaN(v) ? v : null);
  };

  const isYellow = autoRecalc || flash;

  const rowCls = isYellow
    ? `bg-yellow-500/15 ring-1 ring-yellow-500/40 ${flash ? "animate-pulse" : ""}`
    : highlighted
      ? "bg-rose-500/10"
      : "hover:bg-white/[0.03]";

  const inputCls = isYellow
    ? "border-yellow-400/60 text-yellow-200"
    : highlighted
      ? "border-rose-500/50 text-rose-300"
      : "border-white/[0.08] text-white focus:border-white/30";

  return (
    <div className={`flex items-center gap-1.5 py-1.5 rounded-lg px-1.5 transition-all duration-300 ${rowCls}`}>
      <span className="w-10 text-[11px] font-mono font-bold text-white/50 shrink-0">{label}</span>
      <input
        ref={ref}
        type="number"
        min={1} max={99999} step={0.5}
        defaultValue={valueCm ?? ""}
        placeholder={placeholder ?? "—"}
        onFocus={e => { e.target.select(); onFocus?.(); }}
        onBlur={e => commit(e.target)}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.target as HTMLInputElement);
            if (onEnterNext) {
              setTimeout(() => onEnterNext!(), 0);
            } else {
              setTimeout(() => (e.target as HTMLInputElement).blur(), 0);
            }
          }
        }}
        className={`flex-1 bg-white/[0.06] border rounded-lg px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:bg-white/[0.08] transition min-w-0 ${inputCls}`}
      />
      <span className="text-[9px] text-white/25 shrink-0">см</span>
      {onFlipDirection && (
        <button
          onClick={onFlipDirection}
          className={`p-1 rounded transition shrink-0 ${directionFlipped ? "bg-violet-500/20 hover:bg-violet-500/30" : "hover:bg-white/10"}`}
          title={directionFlipped ? "Против часовой (вернуть)" : "По часовой (изменить направление)"}>
          <Icon
            name={directionFlipped ? "RotateCcw" : "RotateCw"}
            size={11}
            className={directionFlipped ? "text-violet-400" : "text-white/25"}
          />
        </button>
      )}
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