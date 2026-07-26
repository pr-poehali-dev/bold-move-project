import Icon from "@/components/ui/icon";
import type { AppUser } from "./masterAdminTypes";

export default function MasterBusinessDeleteModal({ confirmDel, deletingId, onCancel, onConfirm }: {
  confirmDel: AppUser;
  deletingId: number | null;
  onCancel: () => void;
  onConfirm: (u: AppUser) => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "#0e0e1c", border: "1.5px solid #ef444430" }}
        onClick={e => e.stopPropagation()}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "#ef444415" }}>
          <Icon name="Trash2" size={20} style={{ color: "#ef4444" }} />
        </div>
        <div className="text-sm font-bold text-white mb-1">Удалить пользователя?</div>
        <div className="text-xs text-white/40 mb-4">{confirmDel.name || confirmDel.email}</div>
        <div className="text-xs text-red-300/70 bg-red-500/08 border border-red-500/15 rounded-xl px-3 py-2 mb-5">
          Все сметы и сессии будут удалены. Необратимо.
        </div>
        <div className="flex gap-2">
          <button onClick={() => onConfirm(confirmDel)} disabled={deletingId === confirmDel.id}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center"
            style={{ background: "#ef4444" }}>
            {deletingId === confirmDel.id
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : "Удалить"}
          </button>
          <button onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm text-white/40 transition"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
