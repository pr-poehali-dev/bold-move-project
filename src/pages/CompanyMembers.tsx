import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { fetchTeam, removeMember, type TeamMember } from "./admin/team/teamApi";

const masterToken = () => localStorage.getItem("mp_user_token");

// Показывает сотрудников конкретной компании (по company_id) с возможностью отвязки.
// Мастер видит всех сотрудников через team-list, здесь фильтруем по нужной компании.
export default function CompanyMembers({ companyId }: { companyId: number }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await fetchTeam(masterToken());
      setMembers(all.filter(m => (m as TeamMember & { company_id?: number }).company_id === companyId));
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const doRemove = async (id: number) => {
    setRemovingId(id);
    try {
      await removeMember(masterToken(), id);
      setMembers(prev => prev.filter(m => m.id !== id));
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return <div className="px-4 py-3 text-[11px] text-white/25 text-center">Загрузка сотрудников...</div>;
  }

  if (members.length === 0) {
    return <div className="px-4 py-3 text-[11px] text-white/25 text-center">У компании нет сотрудников</div>;
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {members.map(m => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
            style={{ background: "rgba(148,163,184,0.15)", color: "#94a3b8" }}>
            {(m.name || m.email || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white/85 truncate">{m.name || "—"}</div>
            <div className="text-[10px] text-white/30 truncate">{m.email}{m.phone ? ` · ${m.phone}` : ""}</div>
          </div>
          {m.has_pending_password && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: "#f59e0b15", color: "#f59e0b" }}>
              нет пароля
            </span>
          )}
          <button onClick={() => doRemove(m.id)} disabled={removingId === m.id}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition disabled:opacity-40"
            style={{ background: "#ef444410", color: "#ef4444" }}
            title="Отвязать от компании">
            {removingId === m.id ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Icon name="Trash2" size={12} />}
          </button>
        </div>
      ))}
    </div>
  );
}
