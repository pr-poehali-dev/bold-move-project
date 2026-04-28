import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { RemovedUser } from "./masterAdminTypes";
import { fmtDate } from "./masterAdminTypes";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface Props {
  group: "business" | "pro";
}

export default function MasterRemovedUsers({ group }: Props) {
  const [users,      setUsers]      = useState<RemovedUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [confirmPerm, setConfirmPerm] = useState<RemovedUser | null>(null);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`${AUTH_URL}?action=removed-users&group=${group}`);
    const d = await r.json();
    setUsers(d.users || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [group]);

  const doRestore = async (id: number) => {
    setRestoringId(id);
    await fetch(`${AUTH_URL}?action=restore-user`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id }),
    });
    setRestoringId(null);
    load();
  };

  const doPermDelete = async (u: RemovedUser) => {
    setDeletingId(u.id);
    await fetch(`${AUTH_URL}?action=perm-delete-user`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id }),
    });
    setDeletingId(null);
    setConfirmPerm(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3"
        style={{ color: "rgba(255,255,255,0.12)" }}>
        <Icon name="Trash2" size={36} />
        <span className="text-sm">Нет удалённых пользователей</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="text-[10px] text-white/20 mb-3">{users.length} удалённых</div>
      {users.map(u => (
        <div key={u.id} className="rounded-2xl overflow-hidden"
          style={{ background: "#0d0d1b", border: "1.5px solid rgba(239,68,68,0.15)" }}>
          <div className="h-0.5" style={{ background: "rgba(239,68,68,0.5)" }} />
          <div className="px-5 py-4 flex items-center gap-4">
            {/* Аватар */}
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 opacity-50"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
              {(u.name || u.email || "?")[0].toUpperCase()}
            </div>

            {/* Инфо */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="text-sm font-bold text-white/50 line-through">{u.name || "—"}</span>
                <RoleBadge role={u.role} />
              </div>
              <div className="text-[11px] text-white/25">{u.email}</div>
              {u.phone && <div className="text-[10px] text-white/18">{u.phone}</div>}
              <div className="text-[9px] text-white/18 mt-0.5">
                Зарег. {fmtDate(u.created_at)} · Удалён {fmtDate(u.removed_at)} · ID #{u.id}
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => doRestore(u.id)} disabled={restoringId === u.id}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
                style={{ background: "#10b981" }}>
                {restoringId === u.id
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Icon name="RotateCcw" size={13} />}
                Восстановить
              </button>
              <button onClick={() => setConfirmPerm(u)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                style={{ background: "#ef444412", color: "#ef4444" }}
                title="Удалить навсегда">
                <Icon name="Trash2" size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Модал подтверждения перманентного удаления */}
      {confirmPerm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setConfirmPerm(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#0e0e1c", border: "1.5px solid #ef444435" }}
            onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "#ef444415" }}>
              <Icon name="AlertTriangle" size={20} style={{ color: "#ef4444" }} />
            </div>
            <div className="text-sm font-bold text-white mb-1">Удалить навсегда?</div>
            <div className="text-xs text-white/35 mb-3">{confirmPerm.name || confirmPerm.email}</div>
            <div className="text-xs text-red-300/65 bg-red-500/08 border border-red-500/15 rounded-xl px-3 py-2 mb-5">
              Пользователь и все его данные будут уничтожены безвозвратно. Восстановление невозможно.
            </div>
            <div className="flex gap-2">
              <button onClick={() => doPermDelete(confirmPerm)} disabled={deletingId === confirmPerm.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center"
                style={{ background: "#ef4444" }}>
                {deletingId === confirmPerm.id
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : "Удалить навсегда"}
              </button>
              <button onClick={() => setConfirmPerm(null)}
                className="px-5 py-2.5 rounded-xl text-sm text-white/40"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
