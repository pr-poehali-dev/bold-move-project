import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  /** Значение, при котором фильтр считается "неактивным" (обычная серая подсветка) */
  neutralValue?: string;
  icon?: string;
}

/** Выпадающий фильтр аналитики в стиле темы CRM.
 *  Раскрывающийся список тоже красится под тему — иначе браузер рисует его белым. */
export default function AnalyticsFilterSelect({ value, onChange, options, neutralValue = "", icon }: Props) {
  const t = useTheme();
  const active = value !== neutralValue;

  return (
    <div className="relative">
      {icon && (
        <Icon name={icon} size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: active ? t.accentLight : t.textMute }} />
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none ${icon ? "pl-7" : "pl-3"} pr-8 py-2 rounded-xl text-xs font-semibold focus:outline-none transition cursor-pointer`}
        style={{
          background: active ? t.accent + "1F" : t.surface2,
          color:      active ? t.accentLight : t.textMute,
          border:     `1px solid ${active ? t.accent + "55" : t.border}`,
        }}
      >
        {options.map(o => (
          <option key={o.id} value={o.id}
            style={{ background: t.surface, color: t.text }}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="ChevronDown" size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: active ? t.accentLight : t.textMute }} />
    </div>
  );
}
