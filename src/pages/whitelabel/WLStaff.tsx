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

const ROLE_COLORS = {
  manager:        { bg: "rgba(139,92,246,0.12)", color: "#a78bfa" },
  master_manager: { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" },
};

function RoleToggle({ value, onChange }: { value: "manager" | "master_manager"; onChange: (v: "manager" | "master_manager") => void }) {
  return (
    <div className="flex gap-1">
      {(["manager", "master_manager"] as const).map(r => (
        <button key={r} type="button" onClick={() => onChange(r)}
          className="flex-1 py-2 rounded-lg text-[9px] font-bold transition"
          style={{
            background: value === r ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
            color: value === r ? "#a78bfa" : "rgba(255,255,255,0.3)",
            border: `1px solid ${value === r ? "rgba(139,92,246,0.4)" : "transparent"}`,
          }}>
          {ROLE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

export function WLStaff() {
  const [staff,   setStaff]   = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // Форма добавления
  const [addName,     setAddName]     = useState("");
  const [addEmail,    setAddEmail]    = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole,     setAddRole]     = useState<"manager" | "master_manager">("manager");
  const [addSaving,   setAddSaving]   = useState(false);
  const [addErr,      setAddErr]      = useState("");

  // Редактирование
  const [editId,       setEditId]       = useState<number | null>(null);
  const [editName,     setEditName]     = useState("");
  const [editEmail,    setEditEmail]    = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole,     setEditRole]     = useState<"manager" | "master_manager">("manager");
  const [editSaving,   setEditSaving]   = useState(false);
  const [editErr,      setEditErr]      = useState("");

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

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить менеджера?")) return;
    await fetch(`${AUTH_URL}?action=wl-staff-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ id }),
    });
    setStaff(prev => prev.filter(s => s.id !== id));
    if (editId === id) setEditId(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true); setAddErr("");
    try {
      const r = await fetch(`${AUTH_URL}?action=wl-staff-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
        body: JSON.stringify({ name: addName, email: addEmail.trim().toLowerCase(), password: addPassword, wl_role: addRole }),
      });
      const d = await r.json();
      if (d.error) { setAddErr(d.error); return; }
      setStaff(prev => [{ ...d, companies_count: 0 }, ...prev]);
      setAddName(""); setAddEmail(""); setAddPassword(""); setAddRole("manager");
    } catch { setAddErr("Ошибка сети"); }
    finally { setAddSaving(false); }
  };

  const openEdit = (s: Staff) => {
    setEditId(s.id);
    setEditName(s.name);
    setEditEmail(s.email);
    setEditPassword("");
    setEditRole(s.wl_role);
    setEditErr("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setEditSaving(true); setEditErr("");
    try {
      const body: Record<string, string | number> = { id: editId };
      if (editName.trim())    body.name     = editName.trim();
      if (editEmail.trim())   body.email    = editEmail.trim().toLowerCase();
      if (editPassword.trim()) body.password = editPassword.trim();
      body.wl_role = editRole;

      const r = await fetch(`${AUTH_URL}?action=wl-staff-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.error) { setEditErr(d.error); return; }
      setStaff(prev => prev.map(s => s.id === editId
        ? { ...s, name: editName.trim() || s.name, email: editEmail.trim() || s.email, wl_role: editRole }
        : s
      ));
      setEditId(null);
    } catch { setEditErr("Ошибка сети"); }
    finally { setEditSaving(false); }
  };

  const inputCls = "w-full rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-violet-500/50 transition";
  const inputStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" };
  const labelCls = "text-[9px] uppercase tracking-wider text-white/30 mb-1 block";

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
        <span className="text-[10px] text-white/25">{staff.length} чел.</span>
      </div>

      {/* Список */}
      {loading ? (
        <div className="py-10 text-center text-white/20 text-sm">Загрузка...</div>
      ) : staff.length === 0 ? (
        <div className="py-6 text-center text-white/20 text-sm">Нет сотрудников — добавь первого ниже</div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {staff.map(s => (
            <div key={s.id}>
              {/* Строка сотрудника */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black"
                  style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>
                  {s.name[0]?.toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white/90">{s.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                      style={ROLE_COLORS[s.wl_role]}>
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

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!s.approved ? (
                    <button onClick={() => handleApprove(s.id, true)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80 flex items-center gap-1"
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

                  <button
                    onClick={() => editId === s.id ? setEditId(null) : openEdit(s)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                    style={{
                      background: editId === s.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                      color: editId === s.id ? "#a78bfa" : "rgba(255,255,255,0.3)",
                      border: editId === s.id ? "1px solid rgba(139,92,246,0.4)" : "1px solid transparent",
                    }}
                    title="Редактировать">
                    <Icon name="Pencil" size={10} />
                  </button>

                  <button onClick={() => handleDelete(s.id)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                    style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.5)" }}
                    title="Удалить">
                    <Icon name="Trash2" size={10} />
                  </button>
                </div>
              </div>

              {/* Inline форма редактирования */}
              {editId === s.id && (
                <form onSubmit={handleEdit}
                  className="mx-4 mb-3 rounded-xl p-3 space-y-3"
                  style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Редактировать сотрудника</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Имя</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        placeholder={s.name} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input value={editEmail} onChange={e => setEditEmail(e.target.value)}
                        type="email" placeholder={s.email} className={inputCls} style={inputStyle} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Новый пароль (необязательно)</label>
                      <input value={editPassword} onChange={e => setEditPassword(e.target.value)}
                        type="password" placeholder="оставь пустым — не изменится"
                        className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className={labelCls}>Роль</label>
                      <RoleToggle value={editRole} onChange={setEditRole} />
                    </div>
                  </div>
                  {editErr && (
                    <div className="text-[11px] px-3 py-2 rounded-lg"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{editErr}</div>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditId(null)}
                      className="flex-1 py-2 rounded-lg text-[11px] font-bold"
                      style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}>
                      Отмена
                    </button>
                    <button type="submit" disabled={editSaving}
                      className="flex-1 py-2 rounded-lg text-[11px] font-bold transition disabled:opacity-50"
                      style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}>
                      {editSaving ? "Сохранение..." : "Сохранить"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Форма добавления — всегда внизу */}
      <form onSubmit={handleAdd}
        className="px-4 py-4 border-t border-white/[0.06] space-y-3"
        style={{ background: "rgba(16,185,129,0.02)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name="UserPlus" size={13} style={{ color: "#10b981" }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#10b981" }}>
            Добавить сотрудника
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Имя</label>
            <input value={addName} onChange={e => setAddName(e.target.value)}
              placeholder="Иван Иванов" required
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input value={addEmail} onChange={e => setAddEmail(e.target.value)}
              type="email" placeholder="ivan@mail.ru" required
              className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Пароль</label>
            <input value={addPassword} onChange={e => setAddPassword(e.target.value)}
              type="password" placeholder="••••••••" required
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Роль</label>
            <RoleToggle value={addRole} onChange={setAddRole} />
          </div>
        </div>
        {addErr && (
          <div className="text-[11px] px-3 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{addErr}</div>
        )}
        <button type="submit" disabled={addSaving}
          className="w-full py-2.5 rounded-xl text-[12px] font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
          {addSaving
            ? <><div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> Создание...</>
            : <><Icon name="Plus" size={13} /> Создать сотрудника</>
          }
        </button>
      </form>
    </div>
  );
}
