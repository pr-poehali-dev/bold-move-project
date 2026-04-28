import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Permissions } from "@/context/AuthContext";
import { updatePermissions, type TeamMember } from "./teamApi";
import PermissionsEditor from "./PermissionsEditor";

interface Props {
  isDark: boolean;
  member: TeamMember;
  onClose: () => void;
  onSaved: (member: TeamMember) => void;
}

export default function EditPermissionsModal({ isDark, member, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const [perms, setPerms] = useState<Permissions>(member.permissions || {});
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      await updatePermissions(token, member.id, perms);
      onSaved({ ...member, permissions: perms });
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const bg     = isDark ? "#0e0e1c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: bg, border: `1px solid ${border}`, color: text }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: border }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.18)" }}>
              <Icon name="ShieldCheck" size={18} style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <div className="text-base font-bold">Настройка доступа</div>
              <div className="text-[11px] truncate max-w-[260px]" style={{ color: muted }}>
                {member.name || member.email}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: muted }}>
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <PermissionsEditor isDark={isDark} permissions={perms} onChange={setPerms} />

          {err && (
            <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {err}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: border }}>
          <button onClick={save} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: saved ? "#10b981" : "#7c3aed" }}>
            {busy
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
              : saved
              ? <><Icon name="Check" size={13} /> Сохранено</>
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
