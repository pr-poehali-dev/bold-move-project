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
  const [selected,   setSelected]   = useState<ProUser | null>(null);
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
    setSelected(null);
    onReload();
  };

  return (
    <div className="flex h-[calc(100vh-120px)]">

      {/* Список */}
      <div className="flex-1 overflow-y-auto p-6">
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
                ? { background: f.color + "25", color: f.color, border: `1.5px solid ${f.color}60` }
                : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1.5px solid rgba(255,255,255,0.07)" }}>
              {f.label}
              <span className="px-1.5 py-0.5 rounded-md text-[10px]"
                style={{ background: filter === f.id ? f.color + "40" : "rgba(255,255,255,0.08)" }}>
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
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
            <Icon name="Star" size={40} />
            <span className="text-sm">Нет пользователей в этой категории</span>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs text-white/30 mb-4">{filtered.length} профессиональных пользователей</div>
            {filtered.map(u => (
              <div key={u.id}
                onClick={() => setSelected(s => s?.id === u.id ? null : u)}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition"
                style={{
                  background: selected?.id === u.id ? "#0e0e2a" : "#0e0e1c",
                  border: selected?.id === u.id ? "1.5px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)",
                }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                  {(u.name || u.email || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{u.name || "—"}</span>
                    <RoleBadge role={u.role} />
                    {!u.approved && (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-amber-500/15 text-amber-400">ожидает</span>
                    )}
                    {u.approved && (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-emerald-500/15 text-emerald-400">✓ одобрен</span>
                    )}
                  </div>
                  <div className="text-xs text-white/35 mt-0.5">{u.email}</div>
                  {u.phone && <div className="text-xs text-white/25">{u.phone}</div>}
                  <div className="text-[10px] text-white/20 mt-0.5">{fmtDate(u.created_at)}</div>
                </div>

                {/* Скидка */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {editDiscount?.id === u.id ? (
                    <>
                      <input type="number" min={0} max={100}
                        value={editDiscount.value}
                        onChange={e => onEditDiscount({ id: u.id, value: e.target.value })}
                        className="w-16 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }} />
                      <span className="text-xs text-white/40">%</span>
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                      style={{ background: "#a78bfa20", color: "#a78bfa" }}>
                      <Icon name="Percent" size={12} />
                      {u.discount}% скидка
                    </button>
                  )}
                </div>

                <Icon name="ChevronRight" size={14} style={{ color: selected?.id === u.id ? "#a78bfa" : "rgba(255,255,255,0.15)" }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Боковая панель деталей */}
      {selected && (
        <div className="w-72 flex-shrink-0 border-l border-white/[0.07] flex flex-col"
          style={{ background: "#080810" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Детали</span>
            <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white/60 transition">
              <Icon name="X" size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Аватар + имя */}
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold"
                style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                {(selected.name || selected.email)[0].toUpperCase()}
              </div>
              <div className="text-sm font-bold text-white">{selected.name || "—"}</div>
              <RoleBadge role={selected.role} />
            </div>

            {/* Поля */}
            <div className="space-y-2 text-xs">
              {[
                { label: "Email",       value: selected.email },
                { label: "Телефон",     value: selected.phone || "—" },
                { label: "Зарегистрирован", value: fmtDate(selected.created_at) },
                { label: "Скидка",      value: `${selected.discount}%` },
                { label: "ID",          value: `#${selected.id}` },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-2 py-1.5 border-b border-white/[0.04]">
                  <span className="text-white/30">{row.label}</span>
                  <span className="text-white/70 text-right truncate max-w-[60%]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Кнопка удалить */}
          <div className="p-4 border-t border-white/[0.06]">
            <button onClick={() => setConfirmDel(selected)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
              <Icon name="Trash2" size={13} /> Удалить пользователя
            </button>
          </div>
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
            <div className="text-xs text-white/30 mb-4">{confirmDel.email}</div>
            <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-300/80 bg-red-500/10 border border-red-500/20 mb-5">
              Будут удалены все сметы и сессии. Это действие необратимо.
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
