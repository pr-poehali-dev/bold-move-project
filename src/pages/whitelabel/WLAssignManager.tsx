import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import { getWLToken } from "./WLManagerContext";

interface Staff { id: number; name: string; wl_role: "manager" | "master_manager" }

interface Props {
  demoId:      number;
  managerId:   number | null;
  managerName: string;
  onAssigned:  (managerId: number | null, managerName: string) => void;
}

const masterToken = () => getWLToken();

export function WLAssignManager({ demoId, managerId, managerName, onAssigned }: Props) {
  const [open,   setOpen]   = useState(false);
  const [staff,  setStaff]  = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Закрытие по клику снаружи
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Загружаем список одобренных менеджеров
  const loadStaff = async () => {
    const r = await fetch(`${AUTH_URL}?action=wl-staff-list`, {
      headers: { "X-Authorization": masterToken() },
    });
    const d = await r.json();
    setStaff((d.staff || []).filter((s: Staff & { approved: boolean }) => s.approved));
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) loadStaff();
    setOpen(v => !v);
  };

  const assign = async (e: React.MouseEvent, id: number | null, name: string) => {
    e.stopPropagation();
    setSaving(true);
    await fetch(`${AUTH_URL}?action=wl-assign-company`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ demo_id: demoId, manager_id: id }),
    });
    setSaving(false);
    onAssigned(id, name);
    setOpen(false);
  };

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition hover:brightness-125"
        style={{
          background: managerId ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
          color: managerId ? "#a78bfa" : "rgba(255,255,255,0.25)",
          border: `1px solid ${managerId ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)"}`,
        }}
        title="Назначить менеджера">
        <Icon name="UserCheck" size={10} />
        {managerId ? managerName : "Нет"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-xl overflow-hidden shadow-xl"
          style={{ background: "#13131f", border: "1px solid rgba(255,255,255,0.1)" }}
          onClick={e => e.stopPropagation()}>
          <div className="px-3 py-2 text-[9px] uppercase tracking-wider text-white/25 border-b border-white/[0.06]">
            Назначить менеджера
          </div>

          {/* Снять назначение */}
          <button onClick={e => assign(e, null, "")}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] text-left transition hover:bg-white/[0.04]"
            style={{ color: managerId ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)" }}
            disabled={saving}>
            <Icon name="UserX" size={12} />
            Без менеджера
            {!managerId && <Icon name="Check" size={10} className="ml-auto" style={{ color: "#10b981" }} />}
          </button>

          <div className="border-t border-white/[0.05]" />

          {staff.length === 0 ? (
            <div className="px-3 py-3 text-[10px] text-white/25 text-center">Нет менеджеров</div>
          ) : staff.map(s => (
            <button key={s.id} onClick={e => assign(e, s.id, s.name)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] text-left transition hover:bg-white/[0.04]"
              style={{ color: "rgba(255,255,255,0.7)" }}
              disabled={saving}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                {s.name[0]?.toUpperCase()}
              </div>
              <span className="flex-1 truncate">{s.name}</span>
              {s.id === managerId && <Icon name="Check" size={10} style={{ color: "#10b981" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
