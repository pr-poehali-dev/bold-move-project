import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

export function Section({ icon, title, color = "#8b5cf6", children, onEdit, onDelete, onShare, hidden, onToggleHidden }: {
  icon: string; title: string; color?: string; children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  hidden?: boolean;
  onToggleHidden?: () => void;
}) {
  const t = useTheme();
  return (
    <div className="rounded-2xl overflow-hidden group/section"
      style={{ background: t.surface2, border: `1px solid ${t.border}`, opacity: hidden ? 0.45 : 1 }}>
      <div className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: hidden ? "none" : `1px solid ${t.border}` }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: color + "20" }}>
          <Icon name={icon} size={12} style={{ color }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider flex-1" style={{ color }}>{title}</span>
        <div className={`flex items-center gap-1 transition ${hidden ? "opacity-100" : "opacity-0 group-hover/section:opacity-100"}`}>
          {onShare && !hidden && (
            <button onClick={onShare} title="Поделиться всеми файлами"
              className="p-1 rounded-md transition hover:bg-white/10" style={{ color: "#a3a3a3" }}>
              <Icon name="Share2" size={12} />
            </button>
          )}
          {onToggleHidden && (
            <button onClick={onToggleHidden} title={hidden ? "Показать блок" : "Скрыть блок"}
              className="p-1 rounded-md transition hover:bg-white/10"
              style={{ color: hidden ? color : "#a3a3a3" }}>
              <Icon name={hidden ? "EyeOff" : "Eye"} size={12} />
            </button>
          )}
          {onEdit && !hidden && (
            <button onClick={onEdit} title="Редактировать блок"
              className="p-1 rounded-md transition hover:bg-white/10" style={{ color: "#a3a3a3" }}>
              <Icon name="Pencil" size={12} />
            </button>
          )}
          {onDelete && !hidden && (
            <button onClick={onDelete} title="Удалить блок"
              className="p-1 rounded-md transition hover:bg-red-500/15" style={{ color: "#a3a3a3" }}>
              <Icon name="Trash2" size={12} />
            </button>
          )}
        </div>
      </div>
      {!hidden && <div className="px-4 pb-1">{children}</div>}
    </div>
  );
}
