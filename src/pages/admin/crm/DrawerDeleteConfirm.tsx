import Icon from "@/components/ui/icon";

interface Props {
  t: { surface: string; surface2: string; textMute: string; textSub: string };
  orderId: number;
  clientName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Модалка подтверждения удаления заявки — вызывается поверх ClientDrawer.
export function DrawerDeleteConfirm({ t, orderId, clientName, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black/60 p-4" onClick={onCancel}>
      <div className="rounded-2xl p-6 w-full max-w-xs shadow-2xl" style={{ background: t.surface, border: "1px solid rgba(239,68,68,0.25)" }} onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
          <Icon name="Trash2" size={22} className="text-red-400" />
        </div>
        <h3 className="text-base font-bold text-center mb-2 text-white">Удалить заявку?</h3>
        <p className="text-sm text-center mb-5" style={{ color: t.textMute }}>Заявка №{orderId} «{clientName || "Клиент"}» будет удалена</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl font-semibold transition">Удалить</button>
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm rounded-xl transition"
            style={{ background: t.surface2, color: t.textSub }}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
