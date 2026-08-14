import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { DateTimePickerPopup } from "./DateTimePicker";

interface Props {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  /** Красная рамка — когда поле обязательно, а значения ещё нет */
  error?: boolean;
  icon?: string;
  iconColor?: string;
}

/**
 * Компактное поле даты/времени — строка-кнопка с выбранным значением, календарь
 * открывается только по клику (всплывающим окном поверх, как в DrawerInlineField).
 * В отличие от DateTimePickerInner, не занимает место в модалке постоянно — так
 * несколько таких полей (звонок, замер, монтаж) помещаются в одном окне, не
 * раздувая его на несколько развёрнутых календарей одновременно.
 */
export function DateFieldCompact({ value, onChange, placeholder = "Выбрать дату и время", error, icon = "CalendarClock", iconColor }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const display = value
    ? new Date(value).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  const handleOpen = () => {
    if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };

  return (
    <>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition hover:opacity-90"
        style={{ background: t.surface2, border: `1px solid ${error ? "#ef444470" : t.border}` }}>
        <Icon name={icon} size={14} style={{ color: display ? (iconColor || "#a78bfa") : t.textMute, flexShrink: 0 }} />
        <span className="flex-1 truncate" style={{ color: display ? "#fff" : t.textMute }}>
          {display || placeholder}
        </span>
        <Icon name="ChevronDown" size={13} style={{ color: t.textMute, flexShrink: 0 }} />
      </button>
      {open && (
        <DateTimePickerPopup
          value={value}
          anchorRect={anchorRect}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
