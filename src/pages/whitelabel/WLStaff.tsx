import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";

const masterToken = () => localStorage.getItem("mp_user_token") || "";

interface Staff {
  id:              number;
  name:            string;
  email:           string;
  wl_role:         "manager" | "master_manager";
  approved:        boolean;
  created_at:      string;
  companies_count: number;
}

const ROLE_LABELS = {
  manager:        "Менеджер",
  master_manager: "Мастер-менеджер",
};

export function WLStaff() {
  const [staff,   setStaff]   = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [wlRole,   setWlRole]   = useState<"manager" | "master_manager">("manager");
  const [saving,   setSaving]   = useState(false);
  const [addErr,   setAddErr]   = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${AUTH_URL}?action=wl-staff-list`, {
        headers: { "X-Authorization": masterToken() },
      });
      const d = await r.json();
      setStaff(d.staff || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: number, approved: boolean) => {
    await fetch(`${AUTH_URL}?action=wl-staff-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ id, approved }),
    });
    setStaff(prev => prev.map(s => s.id === id ? { ...s, approved } : s));
  };

  const handleRoleChange = async (id: number, wl_role: "manager" | "master_manager") => {
    await fetch(`${AUTH_URL}?action=wl-staff-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ id, wl_role }),
    });
    setStaff(prev => prev.map(s => s.id === id ? { ...s, wl_role } : s));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить менеджера?")) return;
    await fetch(`${AUTH_URL}?action=wl-staff-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ id }),
    });
    setStaff(prev => prev.filter(s => s.id !== id));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setAddErr("");
    try {
      const r = await fetch(`${AUTH_URL}?action=wl-staff-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
        body: JSON.stringify({ name, email: email.trim().toLowerCase(), password, wl_role: wlRole }),
      });
      const d = await r.json();
      if (d.error) { setAddErr(d.error); return; }
      setStaff(prev => [{ ...d, companies_count: 0 }, ...prev]);
      setShowAdd(false); setName(""); setEmail(""); setPassword("");
    } catch { setAddErr("Ошибка сети"); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>

      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(139,92,246,0.15)" }}>
          <Icon name="Users" size={14} style={{ color: "#a78bfa" }} />
        </div>
        <h2 className="text-sm font-black uppercase tracking-wider flex-1" style={{ color: "#a78bfa" }}>
          Сотрудники
        </h2>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition"
          style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
          <Icon name="UserPlus" size={12} /> Добавить
        </button>
      </div>

      {/* Форма добавления */}
      {showAdd && (
        <form onSubmit={handleAdd} className="px-4 py-4 border-b border-white/[0.06] space-y-3"
          style={{ background: "rgba(139,92,246,0.04)" }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Имя</div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" required
                className="w-full rounded-lg px-3 py-2 text-xs text-white/80 outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Email</div>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="ivan@mail.ru" required
                className="w-full rounded-lg px-3 py-2 text-xs text-white/80 outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Пароль</div>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" required
                className="w-full rounded-lg px-3 py-2 text-xs text-white/80 outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-white/30 mb-1">Роль</div>
              <div className="flex gap-1">
                {(["manager", "master_manager"] as const).map(r => (
                  <button key={r} type="button" onClick={() => setWlRole(r)}
                    className="flex-1 py-2 rounded-lg text-[9px] font-bold transition"
                    style={{
                      background: wlRole === r ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                      color: wlRole === r ? "#a78bfa" : "rgba(255,255,255,0.3)",
                      border: `1px solid ${wlRole === r ? "rgba(139,92,246,0.4)" : "transparent"}`,
                    }}>
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {addErr && (
            <div className="text-[11px] px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{addErr}</div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}>
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold transition disabled:opacity-50"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}>
              {saving ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      )}

      {/* Список */}
      {loading ? (
        <div className="py-10 text-center text-white/20 text-sm">Загрузка...</div>
      ) : staff.length === 0 ? (
        <div className="py-10 text-center text-white/20 text-sm">Нет сотрудников</div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              {/* Аватар */}
              <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black"
                style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>
                {s.name[0]?.toUpperCase()}
              </div>

              {/* Инфо */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white/90">{s.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                    style={{
                      background: s.wl_role === "master_manager" ? "rgba(251,191,36,0.12)" : "rgba(139,92,246,0.12)",
                      color: s.wl_role === "master_manager" ? "#fbbf24" : "#a78bfa",
                    }}>
                    {ROLE_LABELS[s.wl_role]}
                  </span>
                  {!s.approved && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                      style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                      Ожидает одобрения
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-white/30 mt-0.5">
                  {s.email} · {s.companies_count} компаний · с {s.created_at}
                </div>
              </div>

              {/* Действия */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Одобрить / Отозвать */}
                {!s.approved ? (
                  <button onClick={() => handleApprove(s.id, true)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                    style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                    <Icon name="Check" size={10} /> Одобрить
                  </button>
                ) : (
                  <button onClick={() => handleApprove(s.id, false)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}>
                    Отозвать
                  </button>
                )}

                {/* Смена роли */}
                <button onClick={() => handleRoleChange(s.id, s.wl_role === "manager" ? "master_manager" : "manager")}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}
                  title="Сменить роль">
                  <Icon name="ArrowUpDown" size={10} />
                </button>

                {/* Удалить */}
                <button onClick={() => handleDelete(s.id)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                  style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.5)" }}
                  title="Удалить">
                  <Icon name="Trash2" size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
