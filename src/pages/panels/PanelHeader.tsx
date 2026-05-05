import Icon from "@/components/ui/icon";

export function PanelHeader({ icon, title, onClose, onEdit }: {
  icon: string;
  title: string;
  onClose: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={15} className="text-orange-400" />
        <span className="text-sm font-semibold text-white/80">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {onEdit && (
          <button onClick={onEdit} title="Редактировать"
            className="p-1.5 rounded-lg hover:bg-violet-500/15 text-white/20 hover:text-violet-400 transition-all">
            <Icon name="Pencil" size={15} />
          </button>
        )}
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all">
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  );
}
