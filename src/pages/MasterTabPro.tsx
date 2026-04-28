import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { ProUser } from "./masterAdminTypes";
import { fmtDate } from "./masterAdminTypes";
import { FilterTabs } from "./MasterTabBusiness";
import MasterTabRemoved from "./MasterTabRemoved";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type ProView   = "active" | "removed";
type ProFilter = "all" | "approved" | "pending";

const FILTERS: { id: ProFilter; label: string }[] = [
  { id: "all",      label: "Все"      },
  { id: "approved", label: "Одобрены" },
  { id: "pending",  label: "Ожидают"  },
];

interface Props {
  users:          ProUser[];
  loading:        boolean;
  editDiscount:   { id: number; value: string } | null;
  savingDiscount: boolean;
  onEditDiscount: (val: { id: number; value: string } | null) => void;
  onSaveDiscount: () => void;
  onReload:       () => void;
}

export default function MasterTabPro({
  users, loading, editDiscount, savingDiscount, onEditDiscount, onSaveDiscount, onReload,
}: Props) {
  const [view,       setView]       = useState<ProView>("active");
  const [filter,     setFilter]     = useState<ProFilter>("all");
  const [confirmDel, setConfirmDel] = useState<ProUser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = users.filter(u => {
    if (filter === "approved") return u.approved;
    if (filter === "pending")  return !u.approved;
    return true;
  });

  const counts: Record<ProFilter, number> = {
    all:      users.length,
    approved: users.filter(u => u.approved).length,
    pending:  users.filter(u => !u.approved).length,
  };

  const doDelete = async (u: ProUser) => {
    setDeletingId(u.id);
    await fetch(`${AUTH_URL}?action=delete-user`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id }),
    });
    setDeletingId(null);
    setConfirmDel(null);
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
        <MasterTabRemoved group="pro" />
      ) : (<>
      <div className="flex items-center gap-4 mb-5">
        <FilterTabs tabs={FILTERS} active={filter} counts={counts} onSelect={setFilter} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.12)" }}>
          <Icon name="Star" size={36} />
          <span className="text-sm">Нет пользователей</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="text-[10px] text-white/20 mb-3">{filtered.length} пользователей</div>
          {filtered.map(u => (
            <div key={u.id} className="rounded-2xl overflow-hidden"
              style={{ background: "#0d0d1b", border: `1.5px solid ${u.approved ? "rgba(167,139,250,0.2)" : "rgba(245,158,11,0.2)"}` }}>
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "#7c3aed18", color: "#a78bfa" }}>
                  {(u.name || u.email || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-white">{u.name || "—"}</span>
                    <RoleBadge role={u.role} />
                    {u.approved
                      ? <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#10b98118", color: "#10b981" }}>✓ одобрен</span>
                      : <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#f59e0b18", color: "#f59e0b" }}>ожидает</span>
                    }
                  </div>
                  <div className="text-[11px] text-white/35">{u.email}</div>
                  {u.phone && <div className="text-[10px] text-white/22">{u.phone}</div>}
                  <div className="text-[9px] text-white/15 mt-0.5">
                    Зарег. {fmtDate(u.created_at)} · ID #{u.id}
                  </div>
                </div>

                {/* Скидка */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editDiscount?.id === u.id ? (
                    <>
                      <input type="number" min={0} max={100}
                        value={editDiscount.value}
                        onChange={e => onEditDiscount({ id: u.id, value: e.target.value })}
                        className="w-14 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(167,139,250,0.35)", color: "#fff" }} />
                      <span className="text-xs text-white/30">%</span>
                      <button onClick={onSaveDiscount} disabled={savingDiscount}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                        style={{ background: "#a78bfa" }}>
                        {savingDiscount ? "..." : "✓"}
                      </button>
                      <button onClick={() => onEditDiscount(null)}
                        className="px-2 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 transition">✕</button>
                    </>
                  ) : (
                    <button onClick={() => onEditDiscount({ id: u.id, value: String(u.discount) })}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition"
                      style={{ background: "#a78bfa15", color: "#a78bfa", border: "1px solid #a78bfa28" }}>
                      <Icon name="Percent" size={12} />
                      {u.discount > 0 ? `${u.discount}% скидка` : "Скидка 0%"}
                    </button>
                  )}
                </div>

                <button onClick={() => setConfirmDel(u)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition"
                  style={{ background: "#ef444410", color: "#ef4444" }}>
                  <Icon name="Trash2" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
            <div className="text-xs text-white/40 mb-4">{confirmDel.name || confirmDel.email}</div>
            <div className="text-xs text-red-300/70 bg-red-500/08 border border-red-500/15 rounded-xl px-3 py-2 mb-5">
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
      </>)}
    </div>
  );
}