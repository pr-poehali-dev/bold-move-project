import { useState, useEffect, useCallback, useMemo } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { BusinessUser } from "./masterAdminTypes";
import { accessStatus } from "./masterAdminTypes";
import { fetchTeam, removeMember, type TeamMember } from "./admin/team/teamApi";

type AgentFilter = "all" | "own_agent" | "self_registered";

const ACCESS_META: Record<ReturnType<typeof accessStatus>, { label: string; color: string; icon: string }> = {
  trial:          { label: "Пробный период",       color: "#10b981", icon: "CheckCircle2" },
  trial_expiring: { label: "Пробный скоро кончится", color: "#f59e0b", icon: "Clock" },
  paid:           { label: "Доступ по балансу смет", color: "#10b981", icon: "CheckCircle2" },
  blocked:        { label: "Доступ закрыт",         color: "#ef4444", icon: "XCircle" },
  none:           { label: "—",                     color: "#475569", icon: "Circle" },
};

function CompanyMemberRow({ m, onRemove, busy }: { m: TeamMember; onRemove: () => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/[0.04]">
      <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
        style={{ background: "rgba(148,163,184,0.15)", color: "#94a3b8" }}>
        {(m.name || m.email || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-white/85 truncate">{m.name || "—"}</div>
        <div className="text-[10px] text-white/30 truncate">{m.email}{m.phone ? ` · ${m.phone}` : ""}</div>
      </div>
      {!m.approved && (
        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: "#f59e0b15", color: "#f59e0b" }}>
          нет пароля
        </span>
      )}
      <button onClick={onRemove} disabled={busy}
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition disabled:opacity-40"
        style={{ background: "#ef444410", color: "#ef4444" }}
        title="Отвязать от компании">
        {busy ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Icon name="Trash2" size={12} />}
      </button>
    </div>
  );
}

function CompanyCard({ company, members, onRemoveMember, removingId }: {
  company: BusinessUser;
  members: TeamMember[];
  onRemoveMember: (id: number) => void;
  removingId: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const as = accessStatus(company);
  const meta = ACCESS_META[as];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d1b", border: "1px solid rgba(255,255,255,0.07)" }}>
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.02]">
        <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold"
          style={{ background: company.role === "company" ? "#f59e0b18" : "#60a5fa18", color: company.role === "company" ? "#f59e0b" : "#60a5fa" }}>
          {(company.name || company.email || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-white">{company.name || "—"}</span>
            <RoleBadge role={company.role} />
            {company.has_own_agent && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#a78bfa18", color: "#a78bfa" }}>✦ WL агент</span>}
          </div>
          <div className="text-[11px] text-white/35">{company.email}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Icon name={meta.icon} size={12} style={{ color: meta.color }} />
          <span className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        </div>
        <div className="flex-shrink-0 text-right px-2">
          <div className="text-xs font-bold text-white/70">{members.length}</div>
          <div className="text-[9px] text-white/25">сотр.</div>
        </div>
        <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={14} style={{ color: "rgba(255,255,255,0.25)" }} className="flex-shrink-0" />
      </button>

      {expanded && (
        <div>
          {members.length === 0 ? (
            <div className="px-4 py-4 text-[11px] text-white/25 text-center border-t border-white/[0.04]">
              У компании пока нет сотрудников
            </div>
          ) : (
            members.map(m => (
              <CompanyMemberRow key={m.id} m={m}
                busy={removingId === m.id}
                onRemove={() => onRemoveMember(m.id)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  companies: BusinessUser[];
  loading: boolean;
  onReload: () => void;
  masterToken: string | null;
}

export default function MasterTabCompanies({ companies, loading, onReload, masterToken }: Props) {
  const [members, setMembers]     = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch]       = useState("");
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const list = await fetchTeam(masterToken);
      setMembers(list);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [masterToken]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const membersByCompany = useMemo(() => {
    const map = new Map<number, TeamMember[]>();
    for (const m of members) {
      const cid = (m as TeamMember & { company_id?: number }).company_id;
      if (!cid) continue;
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(m);
    }
    return map;
  }, [members]);

  const filtered = companies
    .filter(c => c.approved && !c.rejected)
    .filter(c => {
      const matchSearch = !search ||
        (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(search.toLowerCase());
      const matchAgent = agentFilter === "all"
        || (agentFilter === "own_agent" ? c.has_own_agent : !c.has_own_agent);
      return matchSearch && matchAgent;
    });

  const doRemoveMember = async (memberId: number) => {
    setRemovingId(memberId);
    try {
      await removeMember(masterToken, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } finally {
      setRemovingId(null);
    }
  };

  const refreshAll = () => {
    onReload();
    loadMembers();
  };

  const ownAgentCount = companies.filter(c => c.has_own_agent).length;
  const selfCount      = companies.filter(c => !c.has_own_agent).length;

  return (
    <div className="p-5 max-w-4xl mx-auto">

      {/* Поиск + фильтр WL-агент */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию или email..."
            className="w-full rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
        </div>
        <button onClick={refreshAll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon name="RefreshCw" size={12} />
          <span className="hidden sm:inline">Обновить</span>
        </button>
        <div className="flex gap-1.5">
          {([
            { id: "all",             label: "Все",           count: companies.length },
            { id: "own_agent",       label: "С моим агентом", count: ownAgentCount },
            { id: "self_registered", label: "Сами зашли",     count: selfCount },
          ] as { id: AgentFilter; label: string; count: number }[]).map(f => (
            <button key={f.id} onClick={() => setAgentFilter(f.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition border whitespace-nowrap"
              style={agentFilter === f.id
                ? { background: "rgba(255,255,255,0.09)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }
                : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
              {f.label}
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ background: agentFilter === f.id ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", color: agentFilter === f.id ? "#fff" : "rgba(255,255,255,0.3)" }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading || membersLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.12)" }}>
          <Icon name="Building2" size={36} />
          <span className="text-sm">Компаний не найдено</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(c => (
            <CompanyCard key={c.id} company={c}
              members={membersByCompany.get(c.id) || []}
              onRemoveMember={doRemoveMember}
              removingId={removingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}