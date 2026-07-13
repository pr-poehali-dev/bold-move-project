import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Permissions } from "@/context/AuthContext";
import { createTeamRole, updateTeamRole, type TeamRole } from "./teamApi";
import PermissionsEditor from "./PermissionsEditor";

const EMPTY_PERMS: Permissions = {};

interface Props {
  isDark: boolean;
  role: TeamRole | null; // null = создание новой роли
  onClose: () => void;
  onSaved: (role: TeamRole, isNew: boolean) => void;
}

// Переиспользуемая модалка создания/редактирования роли (шаблона прав).
// Используется и во вкладке "Роли команды", и прямо из выпадающего списка ролей.
export default function EditRoleModal({ isDark, role, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const [name,  setName]  = useState(role?.name || "");
  const [perms, setPerms] = useState<Permissions>(role?.permissions || EMPTY_PERMS);
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");

  const bg     = isDark ? "#0e0e1c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";

  const save = async () => {
    if (!name.trim()) { setErr("Укажите название роли"); return; }
    setErr(""); setBusy(true);
    try {
      if (role) {
        const updated = await updateTeamRole(token, role.id, { name: name.trim(), permissions: perms });
        onSaved(updated, false);
      } else {
        const created = await createTeamRole(token, { name: name.trim(), permissions: perms });
        onSaved(created, true);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: bg, border: `1px solid ${border}`, color: text }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: border }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.18)" }}>
              <Icon name="Tag" size={18} style={{ color: "#a78bfa" }} />
            </div>
            <div className="text-base font-bold">{role ? "Изменить роль" : "Новая роль"}</div>
          </div>
          <button onClick={onClose} style={{ color: muted }}>
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>
              Название роли *
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Технолог, Замерщик, Колл-центр…"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
              style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6", border: `1px solid ${border}`, color: text }} />
          </div>

          <PermissionsEditor isDark={isDark} permissions={perms} onChange={setPerms} />

          {err && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {err}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: border }}>
          <button onClick={save} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#7c3aed" }}>
            {busy
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
              : <><Icon name="Save" size={13} /> Сохранить</>}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted, border: `1px solid ${border}` }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
