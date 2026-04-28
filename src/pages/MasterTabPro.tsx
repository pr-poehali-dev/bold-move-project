import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { ProUser } from "./masterAdminTypes";
import { fmtDate } from "./masterAdminTypes";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface Props {
  users: ProUser[];
  loading: boolean;
  editDiscount: { id: number; value: string } | null;
  savingDiscount: boolean;
  onEditDiscount: (val: { id: number; value: string } | null) => void;
  onSaveDiscount: () => void;
  onReload: () => void;
}

type ProFilter = "all" | "approved" | "pending";

export default function MasterTabPro({
  users, loading, editDiscount, savingDiscount, onEditDiscount, onSaveDiscount, onReload,
}: Props) {
  const [filter,     setFilter]     = useState<ProFilter>("all");
  const [confirmDel, setConfirmDel] = useState<ProUser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = users.filter(u => {
    if (filter === "approved") return u.approved;
    if (filter === "pending")  return !u.approved;
    return true;
  });

  const counts = {
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
    <div className="p-5 max-w-5xl mx-auto">

      {/* Фильтры */}
      <div className="flex gap-2 mb-5">
        {([
          { id: "all"      as ProFilter, label: "Все",      color: "#94a3b8" },
          { id: "approved" as ProFilter, label: "Одобрены", color: "#10b981" },
          { id: "pending"  as ProFilter, label: "Ожидают",  color: "#f59e0b" },
        ]).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition"
            style={filter === f.id
              ? { background: f.color + "22", color: f.color, border: `1.5px solid ${f.color}55` }
              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1.5px solid rgba(255,255,255,0.07)" }}>
            {f.label}
            <span className="px-1.5 py-0.5 rounded-md text-[10px]"
              style={{ background: filter === f.id ? f.color + "35" : "rgba(255,255,255,0.08)" }}>
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3"
          style={{ color: "rgba(255,255,255,0.15)" }}>
          <Icon name="Star" size={40} />
          <span className="text-sm">Нет пользователей в этой категории</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="text-[10px] text-white/20 mb-3">{filtered.length} пользователей</div>
          {filtered.map(u => (
            <div key={u.id} className="rounded-2xl overflow-hidden"
              style={{
                background: "#0d0d1b",
                border: `1.5px solid ${u.approved ? "rgba(167,139,250,0.25)" : "rgba(245,158,11,0.25)"}`,
              }}>
              <div className="h-0.5" style={{ background: u.approved ? "#a78bfa" : "#f59e0b" }} />

              <div className="px-5 py-4 flex items-center gap-4">
                {/* Аватар */}
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                  {(u.name || u.email || "?")[0].toUpperCase()}
                </div>

                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-white">{u.name || "—"}</span>
                    <RoleBadge role={u.role} />
                    {u.approved ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-emerald-500/15 text-emerald-400">✓ одобрен</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-amber-500/15 text-amber-400">ожидает</span>
                    )}
                  </div>
                  <div className="text-xs text-white/35">{u.email}</div>
                  {u.phone && <div className="text-[10px] text-white/25">{u.phone}</div>}
                  <div className="text-[9px] text-white/15 mt-0.5">
                    Зарег. {fmtDate(u.created_at)} · ID #{u.id}
                  </div>
                </div>

                {/* Скидка */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {editDiscount?.id === u.id ? (
                    <>
                      <input type="number" min={0} max={100}
                        value={editDiscount.value}
                        onChange={e => onEditDiscount({ id: u.id, value: e.target.value })}
                        className="w-16 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }} />
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
                      style={{ background: "#a78bfa18", color: "#a78bfa", border: "1px solid #a78bfa30" }}>
                      <Icon name="Percent" size={12} />
                      {u.discount > 0 ? `${u.discount}% скидка` : "Скидка 0%"}
                    </button>
                  )}
                </div>

                {/* Удалить */}
                <button onClick={() => setConfirmDel(u)}
                  className="p-2 rounded-xl transition flex-shrink-0"
                  style={{ background: "rgba(239,68,68,0.07)", color: "#ef4444" }}>
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Подтверждение удаления */}
      {confirmDel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: "#0e0e1c", border: "1.5px solid rgba(239,68,68,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(239,68,68,0.12)" }}>
              <Icon name="Trash2" size={22} style={{ color: "#ef4444" }} />
            </div>
            <div className="text-base font-bold text-white mb-1">Удалить пользователя?</div>
            <div className="text-sm text-white/40 mb-1">{confirmDel.name || "—"}</div>
            <div className="text-xs text-white/25 mb-4">{confirmDel.email}</div>
            <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-300/80 bg-red-500/10 border border-red-500/20 mb-5">
              Все сметы и сессии будут удалены. Действие необратимо.
            </div>
            <div className="flex gap-2">
              <button onClick={() => doDelete(confirmDel)} disabled={deletingId === confirmDel.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#ef4444" }}>
                {deletingId === confirmDel.id
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : "Удалить"}
              </button>
              <button onClick={() => setConfirmDel(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
