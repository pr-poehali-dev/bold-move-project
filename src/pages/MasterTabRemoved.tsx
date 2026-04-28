import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import { fmtDate } from "./masterAdminTypes";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface RemovedUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  removed_at: string;
  created_at: string;
  approved: boolean;
  subscription_end: string | null;
}

interface Props {
  group: "business" | "pro";
}

export default function MasterTabRemoved({ group }: Props) {
  const [users,      setUsers]      = useState<RemovedUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`${AUTH_URL}?action=removed-users&group=${group}`);
    const d = await r.json();
    setUsers(d.users || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [group]);

  const doRestore = async (u: RemovedUser) => {
    setRestoringId(u.id);
    await fetch(`${AUTH_URL}?action=restore-user`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id }),
    });
    setRestoringId(null);
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
      <div className="flex flex-col items-center justify-center py-24 gap-3" style={{ color: "rgba(255,255,255,0.1)" }}>
        <Icon name="Trash2" size={36} />
        <span className="text-sm">Удалённых пользователей нет</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="text-[10px] text-white/20 mb-3">{users.length} удалённых</div>
      {users.map(u => (
        <div key={u.id} className="rounded-2xl overflow-hidden"
          style={{ background: "#0d0d1b", border: "1.5px solid rgba(239,68,68,0.15)" }}>
          <div className="h-0.5" style={{ background: "rgba(239,68,68,0.4)" }} />
          <div className="px-5 py-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 opacity-50"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
              {(u.name || u.email || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="text-sm font-semibold text-white/50">{u.name || "—"}</span>
                <RoleBadge role={u.role} />
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#ef444415", color: "#ef4444" }}>удалён</span>
              </div>
              <div className="text-[11px] text-white/25">{u.email}</div>
              <div className="text-[9px] text-white/15 mt-0.5">
                Удалён {fmtDate(u.removed_at)} · Зарег. {fmtDate(u.created_at)} · ID #{u.id}
              </div>
            </div>
            <button onClick={() => doRestore(u)} disabled={restoringId === u.id}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 flex-shrink-0"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
              {restoringId === u.id
                ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Icon name="RotateCcw" size={12} />}
              Восстановить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
