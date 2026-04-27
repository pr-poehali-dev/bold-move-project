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

export default function MasterTabPro({
  users, loading, editDiscount, savingDiscount, onEditDiscount, onSaveDiscount,
}: Props) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
          <Icon name="Star" size={40} />
          <span className="text-sm">Дизайнеров и прорабов пока нет</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-white/30 mb-4">{users.length} профессиональных пользователей</div>
          {users.map(u => (
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
                    <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-red-500/20 text-red-400">не одобрен</span>
                  )}
                </div>
                <div className="text-xs text-white/35 mt-0.5">{u.email}</div>
                {u.phone && <div className="text-xs text-white/25">{u.phone}</div>}
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
