import React, { useRef } from "react";
import Icon from "@/components/ui/icon";

// ─── Аккордеон-секция ─────────────────────────────────────────────────────────
export function Section({
  title, icon, iconColor, children, defaultOpen = true,
  visible, onVisibilityToggle, badge,
}: {
  title: string; icon: string; iconColor: string;
  children: React.ReactNode; defaultOpen?: boolean;
  visible?: boolean; onVisibilityToggle?: () => void;
  badge?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.06]">
      <button className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.025] transition-colors"
        onClick={() => setOpen(o => !o)}>
        <Icon name={icon} size={13} style={{ color: iconColor }} />
        <span className="flex-1 text-left text-[13px] font-semibold text-white/75">{title}</span>
        {badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/[0.07] text-white/40">{badge}</span>}
        {onVisibilityToggle && (
          <button onClick={e => { e.stopPropagation(); onVisibilityToggle(); }}
            className="p-1 rounded-lg hover:bg-white/10 transition" title="Показать / скрыть">
            <Icon name={visible ? "Eye" : "EyeOff"} size={13} className={visible ? "text-white/45" : "text-white/20"} />
          </button>
        )}
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={13} className="text-white/25 shrink-0" />
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

// ─── Строка длины ─────────────────────────────────────────────────────────────
export function LengthRow({
  label, valueCm, placeholder, visible, isActive,
  onValueChange, onVisibilityToggle, onDelete, onFocus, onCommit,
}: {
  label: string; valueCm: number | null; placeholder?: string;
  visible: boolean; isActive?: boolean;
  onValueChange: (v: number | null) => void;
  onVisibilityToggle: () => void;
  onDelete?: () => void;
  onFocus?: () => void;
  onCommit?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // Локальный стейт — чтобы пользователь мог набирать цифры не теряя фокус
  const [draft, setDraft] = React.useState<string>(valueCm !== null ? String(valueCm) : "");

  // Синхронизируем draft когда значение меняется снаружи (например сброс)
  React.useEffect(() => {
    setDraft(valueCm !== null ? String(valueCm) : "");
  }, [valueCm]);

  React.useEffect(() => { if (isActive && ref.current) ref.current.focus(); }, [isActive]);

  const commit = () => {
    const v = draft === "" ? null : Number(draft);
    onValueChange(isNaN(v as number) ? null : v);
    onCommit?.();
  };

  return (
    <div className={`flex items-center gap-1.5 py-1 rounded-lg px-1.5 transition-colors
      ${isActive ? "bg-violet-500/10 ring-1 ring-violet-500/30" : "hover:bg-white/[0.03]"}`}>
      <span className="w-10 text-[11px] font-mono font-bold text-white/60 shrink-0">{label}</span>
      <input ref={ref} type="number" min={1} max={99999} step={0.5}
        value={draft}
        placeholder={placeholder ?? "—"}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { commit(); } }}
        onFocus={onFocus}
        className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-[11px] text-white font-mono focus:outline-none focus:border-violet-500/60 focus:bg-violet-500/5 transition min-w-0"
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