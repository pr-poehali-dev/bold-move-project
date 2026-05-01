import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL, DEMO_STATUSES } from "./wlTypes";
import type { DemoStatus, DemoPipelineCompany } from "./wlTypes";

interface Props {
  company:   DemoPipelineCompany;
  newStatus: DemoStatus;
  onSuccess: (patch: Partial<DemoPipelineCompany>) => void;
  onCancel:  () => void;
}

const masterToken = () => localStorage.getItem("mp_user_token") || "";

const STATUS_DEFAULTS: Record<string, { action: string }> = {
  interested: { action: "Позвонить и уточнить интерес" },
  paid:       { action: "Подписать договор и активировать агента" },
  rejected:   { action: "Отметить причину отказа" },
  new:        { action: "" },
};

export function WLNextStepModal({ company, newStatus, onSuccess, onCancel }: Props) {
  const st = DEMO_STATUSES.find(s => s.id === newStatus)!;
  const today = new Date().toISOString().slice(0, 10);
  const isRejected = newStatus === "rejected";

  const [action,  setAction]  = useState(STATUS_DEFAULTS[newStatus]?.action || "");
  const [date,    setDate]    = useState(today);
  const [notes,   setNotes]   = useState(company.notes || "");
  const [reason,  setReason]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSave = async () => {
    if (isRejected) {
      if (!reason.trim()) { setError("Укажи причину отказа"); return; }
    } else {
      if (!action.trim()) { setError("Заполни действие"); return; }
      if (!date)          { setError("Укажи дату"); return; }
    }
    setSaving(true);
    const patch = isRejected
      ? { status: "rejected" as DemoStatus, notes: reason.trim() }
      : { status: newStatus, next_action: action.trim(), next_action_date: date, notes: notes.trim() };
    await fetch(`${AUTH_URL}?action=admin-update-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ demo_id: company.demo_id, ...patch }),
    });
    setSaving(false);
    onSuccess(patch);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "#0e0e1a", border: `1px solid ${st.color}40` }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: st.bg }}>
            <Icon name={isRejected ? "XCircle" : "Target"} size={14} style={{ color: st.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">
              {isRejected ? "Причина отказа" : "Следующий шаг"}
            </div>
            <div className="text-[11px] text-white/35">
              {company.company_name} → <span style={{ color: st.color }}>{st.label}</span>
            </div>
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white/60 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Форма */}
        <div className="p-5 space-y-4">
          {isRejected ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
                Что сказал клиент? <span style={{ color: st.color }}>*</span>
              </div>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Дорого, нет бюджета / Уже работает с другим сервисом / Не увидел ценности..."
                rows={4}
                autoFocus
                className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-red-500/50 resize-none transition"
              />
            </div>
          ) : (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
                  Действие <span style={{ color: st.color }}>*</span>
                </div>
                <input
                  value={action}
                  onChange={e => setAction(e.target.value)}
                  placeholder="Позвонить и уточнить интерес..."
                  className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-violet-500/50 transition"
                  autoFocus
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
                  Дата <span style={{ color: st.color }}>*</span>
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 outline-none focus:border-violet-500/50 transition"
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Заметки</div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Договорились о демо, интересует белый лейбл для 3 городов..."
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-violet-500/50 resize-none transition"
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-[11px] px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition disabled:opacity-50"
            style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}50` }}>
            {saving
              ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block mr-1.5" />Сохранение...</>
              : "Сохранить и перенести"
            }
          </button>
        </div>
      </div>
    </div>
  );
}