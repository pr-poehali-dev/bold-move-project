import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { PendingUser } from "./masterAdminTypes";

interface Props {
  users: PendingUser[];
  loading: boolean;
  approvingId: number | null;
  onApprove: (id: number) => void;
}

export default function MasterTabPending({ users, loading, approvingId, onApprove }: Props) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
          <Icon name="CheckCircle2" size={40} />
          <span className="text-sm">Нет заявок на одобрение</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-white/30 mb-4">
            {users.length} {users.length === 1 ? "заявка" : users.length < 5 ? "заявки" : "заявок"} ожидают одобрения
          </div>
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "#10b98120", color: "#10b981" }}>
                {(u.name || u.email || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{u.name || "—"}</span>
                  <RoleBadge role={u.role} />
                </div>
                <div className="text-xs text-white/35 mt-0.5">{u.email}</div>
                {u.phone && <div className="text-xs text-white/25">{u.phone}</div>}
                <div className="text-[10px] text-white/20 mt-1">
                  Зарегистрирован: {new Date(u.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </div>
              </div>
              <button onClick={() => onApprove(u.id)} disabled={approvingId === u.id}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
                style={{ background: "#10b981" }}>
                {approvingId === u.id
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Icon name="CheckCircle2" size={14} />}
                Одобрить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
