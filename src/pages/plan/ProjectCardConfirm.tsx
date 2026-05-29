import Icon from "@/components/ui/icon";

interface ConfirmEditProps {
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function ConfirmEditOverlay({ onConfirm, onCancel, onDelete }: ConfirmEditProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center gap-3 z-20 rounded-2xl"
      style={{ background: "rgba(8,8,18,0.96)", backdropFilter: "blur(4px)" }}
    >
      <Icon name="Pencil" size={16} style={{ color: "#a78bfa" }} />
      <span className="text-white/85 text-[13px] font-semibold">Редактировать проект?</span>
      <button
        onClick={onConfirm}
        className="px-4 py-1.5 rounded-xl text-[12px] font-bold transition hover:opacity-90"
        style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff" }}
      >
        Да
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition"
        style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        Отмена
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition hover:bg-red-500/10"
        style={{ color: "rgba(239,68,68,0.7)", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        <Icon name="Trash2" size={12} />
        Удалить
      </button>
    </div>
  );
}

interface ConfirmDeleteProps {
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteOverlay({ isDeleting, onConfirm, onCancel }: ConfirmDeleteProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center gap-3 z-20 rounded-2xl"
      style={{ background: "rgba(8,8,18,0.96)", backdropFilter: "blur(4px)" }}
    >
      <Icon name="AlertTriangle" size={16} style={{ color: "#f87171" }} />
      <span className="text-white/85 text-[13px] font-semibold">Удалить проект?</span>
      <button
        onClick={onConfirm}
        disabled={isDeleting}
        className="px-4 py-1.5 rounded-xl text-[12px] font-bold transition hover:opacity-90 disabled:opacity-50"
        style={{ background: "rgba(239,68,68,0.9)", color: "#fff" }}
      >
        {isDeleting
          ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
          : "Да, удалить"
        }
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition"
        style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        Отмена
      </button>
    </div>
  );
}
