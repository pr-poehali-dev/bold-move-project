import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import type { DemoPipelineCompany } from "./wlTypes";

interface Props {
  company: DemoPipelineCompany;
  onSuccess: () => void;
  onCancel: () => void;
}

const masterToken = () => localStorage.getItem("mp_user_token") || "";

// Часы для выбора (9:00 – 21:00)
const HOURS = Array.from({ length: 13 }, (_, i) => i + 9);
const DURATION_OPTIONS = [
  { value: 30,  label: "30 мин" },
  { value: 60,  label: "1 час"  },
  { value: 90,  label: "1.5 ч"  },
  { value: 120, label: "2 часа" },
];

export function WLPresentationModal({ company, onSuccess, onCancel }: Props) {
  // Минимальная дата — завтра
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  const [date,     setDate]     = useState(minDate);
  const [hour,     setHour]     = useState(10);
  const [duration, setDuration] = useState(60);
  const [notes,    setNotes]    = useState("");
  const [busyHours, setBusyHours] = useState<number[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  // Загружаем занятые часы при смене даты
  useEffect(() => {
    if (!date) return;
    fetch(`${AUTH_URL}?action=demo-busy-slots&date=${date}`, {
      headers: { "X-Authorization": masterToken() },
    })
      .then(r => r.json())
      .then(d => setBusyHours(d.busy_hours || []))
      .catch(() => setBusyHours([]));
  }, [date]);

  const selectedBusy = busyHours.includes(hour);

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const scheduledAt = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).toISOString();
      const r = await fetch(`${AUTH_URL}?action=demo-schedule-presentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
        body: JSON.stringify({
          demo_id:      company.demo_id,
          scheduled_at: scheduledAt,
          duration_min: duration,
          notes:        notes.trim(),
        }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      onSuccess();
    } catch { setError("Ошибка сохранения"); }
    finally { setSaving(false); }
  };

  const color = company.brand_color || "#f97316";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: "#0e0e1a", border: "1px solid rgba(249,115,22,0.3)" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(249,115,22,0.15)" }}>
            <Icon name="CalendarClock" size={15} style={{ color: "#f97316" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">Запланировать показ</div>
            <div className="text-[11px] text-white/35 truncate">{company.company_name}</div>
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white/60 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Дата */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Дата показа</div>
            <input type="date" value={date} min={minDate}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] text-white/80 outline-none focus:border-orange-500/50 transition"
            />
          </div>

          {/* Время — сетка часов */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Время начала</div>
            <div className="grid grid-cols-4 gap-1.5">
              {HOURS.map(h => {
                const busy    = busyHours.includes(h);
                const active  = hour === h;
                return (
                  <button key={h} disabled={busy}
                    onClick={() => { setHour(h); setError(""); }}
                    className="py-2 rounded-lg text-[11px] font-bold transition"
                    style={{
                      background: busy    ? "rgba(255,255,255,0.02)"
                                : active  ? "rgba(249,115,22,0.25)"
                                :           "rgba(255,255,255,0.04)",
                      color: busy    ? "rgba(255,255,255,0.15)"
                           : active  ? "#f97316"
                           :           "rgba(255,255,255,0.5)",
                      border: `1px solid ${busy ? "rgba(255,255,255,0.05)" : active ? "rgba(249,115,22,0.5)" : "transparent"}`,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}>
                    {String(h).padStart(2, "0")}:00
                  </button>
                );
              })}
            </div>
            {busyHours.length > 0 && (
              <div className="text-[10px] text-white/25 mt-1.5">
                Серые слоты уже заняты
              </div>
            )}
          </div>

          {/* Длительность */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Длительность</div>
            <div className="grid grid-cols-4 gap-1.5">
              {DURATION_OPTIONS.map(d => (
                <button key={d.value} onClick={() => setDuration(d.value)}
                  className="py-2 rounded-lg text-[10px] font-bold transition"
                  style={{
                    background: duration === d.value ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.04)",
                    color:      duration === d.value ? "#f97316" : "rgba(255,255,255,0.4)",
                    border:     `1px solid ${duration === d.value ? "rgba(249,115,22,0.4)" : "transparent"}`,
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Итоговое время */}
          {date && (
            <div className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <div className="text-[11px] font-bold" style={{ color: "#f97316" }}>
                <Icon name="CalendarCheck" size={12} />
                {" "}
                {new Date(`${date}T${String(hour).padStart(2, "0")}:00`).toLocaleDateString("ru-RU", {
                  weekday: "long", day: "numeric", month: "long",
                })} в {String(hour).padStart(2, "0")}:00
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                Длительность: {DURATION_OPTIONS.find(d => d.value === duration)?.label}
                {" · "}Конец в {String(hour + Math.floor(duration / 60)).padStart(2, "0")}:{String(duration % 60).padStart(2, "0")}
              </div>
            </div>
          )}

          {/* Заметки */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Заметки (необязательно)</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Что показать, особые пожелания клиента..."
              className="w-full rounded-xl px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-orange-500/50 resize-none transition"
            />
          </div>

          {error && (
            <div className="rounded-xl px-3 py-2 text-[11px]"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 pb-5 pt-3 border-t border-white/[0.06] flex gap-3 flex-shrink-0">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || selectedBusy}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition disabled:opacity-50"
            style={{ background: "rgba(249,115,22,0.2)", color: "#f97316", border: "1px solid rgba(249,115,22,0.4)" }}>
            {saving
              ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block mr-1.5" />Сохранение...</>
              : <><Icon name="CalendarPlus" size={12} /> Запланировать</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}