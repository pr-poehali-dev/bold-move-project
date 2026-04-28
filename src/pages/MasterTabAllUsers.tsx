import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser, UserEstimate } from "./masterAdminTypes";
import { subStatus } from "./masterAdminTypes";
import AllUsersFilters, { type SubFilter } from "./AllUsersFilters";
import AllUsersTable from "./AllUsersTable";
import AllUsersPanel from "./AllUsersPanel";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface Props {
  users:         AppUser[];
  loading:       boolean;
  search:        string;
  selectedUser:  AppUser | null;
  userEstimates: UserEstimate[];
  estLoading:    boolean;
  approvingId:   number | null;
  onSearch:      (v: string) => void;
  onSelectUser:  (u: AppUser) => void;
  onApprove:     (id: number) => void;
  onReload:      () => void;
}

export default function MasterTabAllUsers({
  users, loading, search, selectedUser, userEstimates,
  estLoading, approvingId, onSearch, onSelectUser, onApprove, onReload,
}: Props) {
  const [roleFilters, setRoleFilters] = useState<Set<string>>(new Set());
  const [subFilter,   setSubFilter]   = useState<SubFilter>("all");
  const [sortBy,      setSortBy]      = useState<"created" | "sub_end">("created");
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const [confirmDel,  setConfirmDel]  = useState<AppUser | null>(null);
  const [subUserId,   setSubUserId]   = useState<number | null>(null);
  const [subLoading,  setSubLoading]  = useState(false);

  const toggleRole = (role: string) => {
    setRoleFilters(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const filtered = users
    .filter(u => {
      const matchSearch = !search ||
        (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.name  || "").toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilters.size === 0 || roleFilters.has(u.role);
      const ss = subStatus(u);
      const hasSubRole = ["installer","company"].includes(u.role);
      const matchSub = subFilter === "all"
        || (subFilter === "none" ? hasSubRole && ss === "none" : ss === subFilter);
      return matchSearch && matchRole && matchSub;
    })
    .sort((a, b) => {
      if (sortBy === "sub_end") {
        if (!a.subscription_end && !b.subscription_end) return 0;
        if (!a.subscription_end) return 1;
        if (!b.subscription_end) return -1;
        return new Date(a.subscription_end).getTime() - new Date(b.subscription_end).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const doDelete = async (u: AppUser) => {
    setDeletingId(u.id);
    await fetch(`${AUTH_URL}?action=delete-user`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id }),
    });
    setDeletingId(null);
    setConfirmDel(null);
    onReload();
  };

  const doExtend = async (userId: number, days: number) => {
    setSubLoading(true);
    await fetch(`${AUTH_URL}?action=extend-subscription`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, days }),
    });
    setSubLoading(false);
    setSubUserId(null);
    onReload();
  };

  return (
    <div className="flex h-[calc(100vh-112px)]">

      {/* ─── Основная часть ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <AllUsersFilters
          search={search}
          sortBy={sortBy}
          roleFilters={roleFilters}
          subFilter={subFilter}
          totalShown={filtered.length}
          onSearch={onSearch}
          onSortBy={setSortBy}
          onToggleRole={toggleRole}
          onClearRoles={() => setRoleFilters(new Set())}
          onSubFilter={setSubFilter}
        />

        <div className="flex-1 overflow-y-auto">
          <AllUsersTable
            users={filtered}
            loading={loading}
            selectedUser={selectedUser}
            onSelectUser={onSelectUser}
          />
        </div>
      </div>

      {/* ─── Правая панель ─── */}
      <div className="w-[320px] flex-shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden"
        style={{ background: "#08080f" }}>
        <AllUsersPanel
          selectedUser={selectedUser}
          userEstimates={userEstimates}
          estLoading={estLoading}
          approvingId={approvingId}
          subUserId={subUserId}
          subLoading={subLoading}
          onApprove={onApprove}
          onConfirmDel={setConfirmDel}
          onExtend={doExtend}
          onSubUserId={setSubUserId}
        />
      </div>

      {/* Модал удаления */}
      {confirmDel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }} onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#0e0e1c", border: "1.5px solid #ef444430" }}
            onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "#ef444415" }}>
              <Icon name="Trash2" size={20} style={{ color: "#ef4444" }} />
            </div>
            <div className="text-sm font-bold text-white mb-1">Удалить пользователя?</div>
            <div className="text-xs text-white/35 mb-4">{confirmDel.name || confirmDel.email}</div>
            <div className="text-xs text-red-300/65 bg-red-500/08 border border-red-500/15 rounded-xl px-3 py-2 mb-5">
              Все сметы и сессии будут удалены. Необратимо.
            </div>
            <div className="flex gap-2">
              <button onClick={() => doDelete(confirmDel)} disabled={deletingId === confirmDel.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center"
                style={{ background: "#ef4444" }}>
                {deletingId === confirmDel.id
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : "Удалить"}
              </button>
              <button onClick={() => setConfirmDel(null)}
                className="px-5 py-2.5 rounded-xl text-sm text-white/40 transition"
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
