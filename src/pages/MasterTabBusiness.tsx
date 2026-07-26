import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { AppUser } from "./masterAdminTypes";
import MasterTabRemoved from "./MasterTabRemoved";
import { masterHeaders } from "./masterAuthFetch";
import {
  AUTH_URL, FILTERS, FilterTabs,
  type BizView, type BizFilter,
} from "./masterBusinessShared";
import BusinessCard from "./MasterBusinessCard";
import MasterBusinessDeleteModal from "./MasterBusinessDeleteModal";

interface Props {
  users: AppUser[];
  loading: boolean;
  onReload: () => void;
  roleFilter?: string;                        // если задан — показываем только эту роль
  sourceFilter?: "all" | "self" | "invited";  // источник: сам зашёл / приглашён
  removedGroup?: "business" | "pro";          // группа для вкладки "Удалённые"
}

export default function MasterTabBusiness({ users, loading, onReload, roleFilter, sourceFilter = "all", removedGroup = "business" }: Props) {
  const [view,       setView]       = useState<BizView>("active");
  const [filter,     setFilter]     = useState<BizFilter>("all");
  const [actionId,   setActionId]   = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<AppUser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const roleScoped = users
    .filter(u => !roleFilter || u.role === roleFilter)
    .filter(u => sourceFilter === "all" || (u.source || "self") === sourceFilter);

  const filtered = roleScoped.filter(u => {
    if (filter === "pending")  return !u.approved && !u.rejected;
    if (filter === "approved") return u.approved && !u.rejected;
    if (filter === "rejected") return u.rejected;
    return true;
  });

  const counts: Record<BizFilter, number> = {
    all:      roleScoped.length,
    approved: roleScoped.filter(u => u.approved && !u.rejected).length,
    pending:  roleScoped.filter(u => !u.approved && !u.rejected).length,
    rejected: roleScoped.filter(u => u.rejected).length,
  };

  const doApprove = async (id: number) => {
    setActionId(id);
    await fetch(`${AUTH_URL}?action=approve-user`, {
      method: "POST", headers: masterHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: id }),
    });
    setActionId(null);
    onReload();
  };

  const doReject = async (id: number) => {
    setActionId(id);
    await fetch(`${AUTH_URL}?action=reject-user`, {
      method: "POST", headers: masterHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: id }),
    });
    setActionId(null);
    onReload();
  };

  const doDelete = async (u: AppUser) => {
    setDeletingId(u.id);
    await fetch(`${AUTH_URL}?action=delete-user`, {
      method: "POST", headers: masterHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: u.id }),
    });
    setDeletingId(null);
    setConfirmDel(null);
    onReload();
  };

  const doAddBalance = async (userId: number, amount: number, reason: string) => {
    await fetch(`${AUTH_URL}?action=add-balance`, {
      method: "POST", headers: masterHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: userId, amount, reason }),
    });
    onReload();
  };

  const doSetDiscount = async (userId: number, discount: number) => {
    await fetch(`${AUTH_URL}?action=set-discount`, {
      method: "POST", headers: masterHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: userId, discount }),
    });
    onReload();
  };

  return (
    <div className="p-5 max-w-4xl mx-auto">
      {/* Переключатель активные / удалённые */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setView("active")}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border"
          style={view === "active"
            ? { background: "rgba(255,255,255,0.09)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }
            : { background: "transparent", color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.07)" }}>
          <Icon name="Users" size={12} /> Активные
        </button>
        <button onClick={() => setView("removed")}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border"
          style={view === "removed"
            ? { background: "rgba(239,68,68,0.12)", color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }
            : { background: "transparent", color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.07)" }}>
          <Icon name="Trash2" size={12} /> Удалённые
        </button>
      </div>

      {view === "removed" ? (
        <MasterTabRemoved group={removedGroup} />
      ) : (<>
      {/* Фильтры */}
      <div className="flex items-center gap-4 mb-5">
        <FilterTabs tabs={FILTERS} active={filter} counts={counts} onSelect={setFilter} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.12)" }}>
          <Icon name="Building2" size={36} />
          <span className="text-sm">Нет пользователей</span>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => (
            <BusinessCard key={u.id} u={u}
              actionId={actionId}
              onApprove={doApprove}
              onReject={doReject}
              onDelete={() => setConfirmDel(u)}
              onAddBalance={doAddBalance}
              onSetDiscount={doSetDiscount}
            />
          ))}
        </div>
      )}

      {/* Модал удаления */}
      {confirmDel && (
        <MasterBusinessDeleteModal
          confirmDel={confirmDel}
          deletingId={deletingId}
          onCancel={() => setConfirmDel(null)}
          onConfirm={doDelete}
        />
      )}
      </>)}
    </div>
  );
}

export { FilterTabs };
