import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import type { DemoPipelineCompany } from "./wlTypes";

interface Props {
  company:   DemoPipelineCompany;
  onSuccess: (patch: Partial<DemoPipelineCompany>) => void;
  onClose:   () => void;
}

const masterToken = () => localStorage.getItem("mp_user_token") || "";

export function WLLprModal({ company, onSuccess, onClose }: Props) {
  const [name,     setName]     = useState(company.contact_name     || "");
  const [phone,    setPhone]    = useState(company.contact_phone    || "");
  const [position, setPosition] = useState(company.contact_position || "");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() && !phone.trim()) { setError("Заполни хотя бы ФИО или телефон"); return; }
    setSaving(true);
    const patch = { contact_name: name.trim(), contact_phone: phone.trim(), contact_position: position.trim() };
    await fetch(`${AUTH_URL}?action=admin-update-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ demo_id: company.demo_id, ...patch }),
    });
    setSaving(false);
    onSuccess(patch);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "#0e0e1a", border: "1px solid rgba(239,68,68,0.3)" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.12)" }}>
            <Icon name="User" size={16} style={{ color: "#ef4444" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">Контакт / ЛПР</div>
            <div className="text-[11px] text-white/35">{company.company_name}</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Форма */}
        <div className="p-5 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">ФИО</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Иванов Иван Иванович"
              className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-violet-500/50 transition"
              autoFocus />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Телефон</div>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (900) 000-00-00"
              className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-violet-500/50 transition" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Должность</div>
            <input value={position} onChange={e => setPosition(e.target.value)} placeholder="Директор, менеджер..."
              className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-violet-500/50 transition" />
          </div>
          {error && (
            <div className="text-[11px] px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition disabled:opacity-50"
            style={{ background: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.4)" }}>
            {saving
              ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block mr-1.5" />Сохранение...</>
              : "Сохранить"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
