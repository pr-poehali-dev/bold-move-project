import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Permissions } from "@/context/AuthContext";
import { createTeamRole, type TeamRole } from "./teamApi";

interface Props {
  isDark: boolean;
  roles: TeamRole[];
  selectedRoleId: number | null;
  currentPermissions: Permissions;
  onChange: (roleId: number | null) => void;
  onRoleCreated: (role: TeamRole) => void;
}

// Кастомный тёмный dropdown для выбора роли (шаблона доступа) с возможностью
// сразу же создать новую роль на основе текущих настроенных прав.
export default function RoleSelectDropdown({ isDark, roles, selectedRoleId, currentPermissions, onChange, onRoleCreated }: Props) {
  const { token } = useAuth();
  const [open,      setOpen]      = useState(false);
  const [creating,  setCreating]  = useState(false);
  const [newName,   setNewName]   = useState("");
  const [busy,      setBusy]      = useState(false);
  const [err,       setErr]       = useState("");

  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";

  const selectedRole = roles.find(r => r.id === selectedRoleId) || null;

  const close = () => { setOpen(false); setCreating(false); setNewName(""); setErr(""); };

  const submitCreate = async () => {
    if (!newName.trim()) { setErr("Укажите название роли"); return; }
    setErr(""); setBusy(true);
    try {
      const role = await createTeamRole(token, { name: newName.trim(), permissions: currentPermissions });
      onRoleCreated(role);
      onChange(role.id);
      close();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition"
        style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6", border: `1px solid ${border}`, color: text }}>
        <span className="flex items-center gap-2 truncate">
          <Icon name={selectedRole ? "Tag" : "Pencil"} size={14} style={{ color: selectedRole ? "#a78bfa" : muted, flexShrink: 0 }} />
          <span className="truncate">{selectedRole ? selectedRole.name : "Настроено вручную"}</span>
        </span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={14} style={{ color: muted, flexShrink: 0 }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[210]" onClick={close} />
          <div className="absolute top-full left-0 right-0 z-[211] mt-1.5 rounded-xl overflow-hidden shadow-2xl"
            style={{ background: isDark ? "#13131f" : "#fff", border: `1px solid ${isDark ? "rgba(139,92,246,0.35)" : "rgba(139,92,246,0.2)"}` }}>

            {!creating ? (
              <>
                <div className="max-h-52 overflow-y-auto">
                  <button
                    onClick={() => { onChange(null); close(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition text-left"
                    style={{
                      background: selectedRoleId === null ? (isDark ? "rgba(139,92,246,0.18)" : "rgba(139,92,246,0.1)") : "transparent",
                      color: selectedRoleId === null ? "#a78bfa" : (isDark ? "rgba(255,255,255,0.7)" : "#374151"),
                    }}>
                    <Icon name="Pencil" size={13} style={{ flexShrink: 0 }} />
                    Настроено вручную
                    {selectedRoleId === null && <Icon name="Check" size={12} style={{ marginLeft: "auto" }} />}
                  </button>

                  {roles.map(r => (
                    <button key={r.id}
                      onClick={() => { onChange(r.id); close(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition text-left"
                      style={{
                        background: selectedRoleId === r.id ? (isDark ? "rgba(139,92,246,0.18)" : "rgba(139,92,246,0.1)") : "transparent",
                        color: selectedRoleId === r.id ? "#a78bfa" : (isDark ? "rgba(255,255,255,0.7)" : "#374151"),
                        borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6"}`,
                      }}>
                      <Icon name="Tag" size={13} style={{ flexShrink: 0 }} />
                      <span className="truncate">{r.name}</span>
                      {selectedRoleId === r.id && <Icon name="Check" size={12} style={{ marginLeft: "auto", flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold transition text-left"
                  style={{ color: "#a78bfa", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}` }}>
                  <Icon name="Plus" size={13} />
                  Создать новую роль
                </button>
              </>
            ) : (
              <div className="p-3.5 space-y-2.5" onClick={e => e.stopPropagation()}>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: muted }}>
                  Новая роль
                </div>
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Технолог, Замерщик…"
                  onKeyDown={e => { if (e.key === "Enter") submitCreate(); if (e.key === "Escape") close(); }}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", border: `1px solid ${border}`, color: text }} />
                <div className="text-[10.5px]" style={{ color: muted }}>
                  Роль сохранит текущий набор прав, настроенный ниже
                </div>
                {err && <div className="text-[11px]" style={{ color: "#fca5a5" }}>{err}</div>}
                <div className="flex gap-2">
                  <button onClick={submitCreate} disabled={busy}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    style={{ background: "#7c3aed" }}>
                    {busy ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Icon name="Check" size={12} /> Создать</>}
                  </button>
                  <button onClick={() => { setCreating(false); setNewName(""); setErr(""); }}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium transition"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted, border: `1px solid ${border}` }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
