import { useState, useEffect } from "react";
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
  interested:   { action: "Позвонить и уточнить интерес" },
  presentation: { action: "Ждёт презентации" },
  presented:    { action: "Связаться с клиентом после презентации" },
  paid:         { action: "Подписать договор и активировать агента" },
  rejected:     { action: "" },
  new:          { action: "" },
};

// Часы для выбора (9:00–21:00)
const HOURS = Array.from({ length: 13 }, (_, i) => i + 9);

function isPast(hour: number, date: string): boolean {
  if (!date) return false;
  const chosen = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
  return chosen.getTime() < Date.now();
}

export function WLNextStepModal({ company, newStatus, onSuccess, onCancel }: Props) {
  const st = DEMO_STATUSES.find(s => s.id === newStatus)!;

  // Минимальная дата для презентации — завтра
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);
  const today   = new Date().toISOString().slice(0, 10);

  const isRejected     = newStatus === "rejected";
  const isPresentation = newStatus === "presentation";

  const [action,    setAction]    = useState(STATUS_DEFAULTS[newStatus]?.action || "");
  const [date,      setDate]      = useState(isPresentation ? minDate : today);
  const [hour,      setHour]      = useState(10);
  const [notes,     setNotes]     = useState(company.notes || "");
  const [reason,    setReason]    = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [busyHours, setBusyHours] = useState<number[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Загружаем занятые часы при смене даты (только для презентации)
  useEffect(() => {
    if (!isPresentation || !date) return;
    setLoadingSlots(true);
    fetch(`${AUTH_URL}?action=demo-busy-slots&date=${date}`, {
      headers: { "X-Authorization": masterToken() },
    })
      .then(r => r.json())
      .then(d => setBusyHours(d.busy_hours || []))
      .catch(() => setBusyHours([]))
      .finally(() => setLoadingSlots(false));
  }, [date, isPresentation]);

  const selectedBusy = isPresentation && (busyHours.includes(hour) || isPast(hour, date));

  const handleSave = async () => {
    if (isRejected) {
      if (!reason.trim()) { setError("Укажи причину отказа"); return; }
    } else {
      if (!isPresentation && !action.trim()) { setError("Заполни действие"); return; }
      if (!date) { setError("Укажи дату"); return; }
      if (isPresentation && selectedBusy) { setError("Это время занято — выбери другое"); return; }
    }

    setSaving(true);
    setError(null);

    if (isPresentation) {
      // Сохраняем запись в demo_presentations + меняем статус
      const scheduledAt = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).toISOString();
      const r = await fetch(`${AUTH_URL}?action=demo-schedule-presentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
        body: JSON.stringify({
          demo_id:      company.demo_id,
          scheduled_at: scheduledAt,
          duration_min: 60,
          notes:        notes.trim(),
        }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); setSaving(false); return; }

      // Также обновляем next_action и next_action_date
      const dateOnly = date;
      await fetch(`${AUTH_URL}?action=admin-update-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
        body: JSON.stringify({
          demo_id:          company.demo_id,
          next_action:      "Ждёт презентации",
          next_action_date: dateOnly,
          notes:            notes.trim(),
        }),
      });

      setSaving(false);
      onSuccess({
        status:           "presentation",
        next_action:      "Ждёт презентации",
        next_action_date: dateOnly,
        notes:            notes.trim(),
        presentation_at:  scheduledAt,
      });
    } else {
      const finalAction = action.trim();
      const patch = isRejected
        ? { status: "rejected" as DemoStatus, notes: reason.trim() }
        : { status: newStatus, next_action: finalAction, next_action_date: date, notes: notes.trim() };

      await fetch(`${AUTH_URL}?action=admin-update-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
        body: JSON.stringify({ demo_id: company.demo_id, ...patch }),
      });
      setSaving(false);
      onSuccess(patch);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: "#0e0e1a", border: `1px solid ${st.color}40` }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: st.bg }}>
            <Icon name={isPresentation ? "CalendarClock" : isRejected ? "XCircle" : "Target"} size={14} style={{ color: st.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">
              {isPresentation ? "Запланировать показ" : isRejected ? "Причина отказа" : "Следующий шаг"}
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
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
          ) : isPresentation ? (
            /* ── Режим ПРЕЗЕНТАЦИЯ ── */
            <>
              {/* Статус задачи */}
              <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                style={{ background: `${st.color}10`, border: `1px solid ${st.color}30` }}>
                <Icon name="CalendarClock" size={14} style={{ color: st.color, flexShrink: 0 }} />
                <div>
                  <div className="text-[11px] font-bold" style={{ color: st.color }}>Ждёт презентации</div>
                  <div className="text-[10px] text-white/35 mt-0.5">Задача установится автоматически</div>
                </div>
              </div>

              {/* Дата */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Дата показа *</div>
                <input type="date" value={date} min={minDate}
                  onChange={e => { setDate(e.target.value); setError(null); }}
                  autoFocus
                  className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 outline-none focus:border-orange-500/50 transition"
                />
              </div>

              {/* Слоты времени */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-white/30">Время начала *</div>
                  {loadingSlots && (
                    <div className="flex items-center gap-1 text-[9px] text-white/25">
                      <div className="w-2 h-2 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                      загрузка...
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {HOURS.map(h => {
                    const busy     = busyHours.includes(h);
                    const past     = isPast(h, date);
                    const disabled = busy || past;
                    const active   = hour === h;
                    return (
                      <button key={h} disabled={disabled}
                        onClick={() => { setHour(h); setError(null); }}
                        className="py-2 rounded-lg text-[11px] font-bold transition"
                        style={{
                          background: (past || busy) ? "rgba(255,255,255,0.02)"
                                    : active         ? `${st.color}25`
                                    :                  "rgba(255,255,255,0.04)",
                          color: (past || busy) ? "rgba(255,255,255,0.15)"
                               : active         ? st.color
                               :                  "rgba(255,255,255,0.5)",
                          border: `1px solid ${active && !past && !busy ? `${st.color}50` : "transparent"}`,
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: (past || busy) ? 0.4 : 1,
                        }}>
                        {String(h).padStart(2, "0")}:00
                      </button>
                    );
                  })}
                </div>
                {busyHours.length > 0 && (
                  <div className="text-[9px] text-white/20 mt-1.5">
                    Серые слоты уже заняты
                  </div>
                )}
              </div>

              {/* Итог */}
              {date && (
                <div className="rounded-xl px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-[11px] font-bold text-white/60">
                    {new Date(`${date}T${String(hour).padStart(2, "0")}:00`).toLocaleDateString("ru-RU", {
                      weekday: "long", day: "numeric", month: "long",
                    })} в {String(hour).padStart(2, "0")}:00
                  </div>
                </div>
              )}

              {/* Заметки */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Заметки</div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Что показать клиенту, особые пожелания..."
                  className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-orange-500/50 resize-none transition"
                />
              </div>
            </>
          ) : (
            /* ── Обычный режим ── */
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
        <div className="px-5 pb-5 pt-3 border-t border-white/[0.06] flex gap-3 flex-shrink-0">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || (isPresentation && selectedBusy)}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition disabled:opacity-50"
            style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}50` }}>
            {saving
              ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block mr-1.5" />Сохранение...</>
              : isPresentation ? "Записать на показ" : "Сохранить и перенести"
            }
          </button>
        </div>
      </div>
    </div>
  );
}