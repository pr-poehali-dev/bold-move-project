import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { updateMember, fetchTeamRoles, type TeamMember, type TeamRole } from "./teamApi";

interface Props {
  isDark: boolean;
  member: TeamMember;
  onClose: () => void;
  onSaved: (m: TeamMember) => void;
}

export default function EditMemberModal({ isDark, member, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const [name,   setName]   = useState(member.name || "");
  const [phone,  setPhone]  = useState(member.phone || "");
  const [email,  setEmail]  = useState(member.email || "");
  const [roleId, setRoleId] = useState<number | null>(member.team_role_id ?? null);
  const [roles,  setRoles]  = useState<TeamRole[]>([]);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchTeamRoles(token).then(r => { if (!cancelled) setRoles(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const bg     = isDark ? "#0e0e1c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";
  const fieldBg = isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6";

  const save = async () => {
    if (!email.trim()) { setErr("Email обязателен — это логин для входа"); return; }
    setErr(""); setBusy(true);
    try {
      await updateMember(token, member.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        role_id: roleId,
      });
      onSaved({ ...member, name: name.trim() || null, phone: phone.trim() || null,
        email: email.trim().toLowerCase(), team_role_id: roleId });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const fieldStyle = { background: fieldBg, border: `1px solid ${border}`, color: text };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: bg, border: `1px solid ${border}`, color: text }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 border-b flex items-center gap-2.5" style={{ borderColor: border }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.18)" }}>
            <Icon name="Pencil" size={18} style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <div className="text-base font-bold">Редактировать сотрудника</div>
            <div className="text-[11px]" style={{ color: muted }}>{member.email}</div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3.5">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: muted }}>Имя</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя сотрудника"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none" style={fieldStyle} />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: muted }}>Телефон</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none" style={fieldStyle} />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: muted }}>Email (логин)</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none" style={fieldStyle} />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: muted }}>Роль в компании</label>
            <select value={roleId ?? ""} onChange={e => setRoleId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none appearance-none cursor-pointer"
              style={fieldStyle}>
              <option value="">Индивидуальные права</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="text-[10.5px] mt-1.5" style={{ color: muted }}>
              При выборе роли сотруднику применится её набор прав
            </div>
          </div>

          {err && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {err}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition"
              style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted, border: `1px solid ${border}` }}>
              Отмена
            </button>
            <button onClick={save} disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#7c3aed" }}>
              {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Icon name="Check" size={14} /> Сохранить</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
