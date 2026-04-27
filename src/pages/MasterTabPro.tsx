import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { ProUser } from "./masterAdminTypes";

interface Props {
  users: ProUser[];
  loading: boolean;
  editDiscount: { id: number; value: string } | null;
  savingDiscount: boolean;
  onEditDiscount: (val: { id: number; value: string } | null) => void;
  onSaveDiscount: () => void;
}

type ProFilter = "all" | "approved" | "pending";

export default function MasterTabPro({
  users, loading, editDiscount, savingDiscount, onEditDiscount, onSaveDiscount,
}: Props) {
  const [filter, setFilter] = useState<ProFilter>("all");

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Фильтры */}
      <div className="flex gap-2 mb-5">
        {([
          { id: "all" as ProFilter,      label: "Все",      color: "#94a3b8" },
          { id: "approved" as ProFilter, label: "Одобрены", color: "#10b981" },
          { id: "pending" as ProFilter,  label: "Ожидают",  color: "#f59e0b" },
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
        <div className="space-y-3">
          <div className="text-xs text-white/30 mb-4">{filtered.length} профессиональных пользователей</div>
          {filtered.map(u => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>
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
                <div className="text-[10px] text-white/20 mt-0.5">
                  {new Date(u.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </div>
              </div>

              {/* Скидка */}
              <div className="flex items-center gap-2">
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
                      className="px-2 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 transition">
                      ✕
                    </button>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
