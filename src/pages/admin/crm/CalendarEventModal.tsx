import { useState } from "react";
import { EVENT_TYPE_LABELS } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { CalEvent, EVENT_COLORS } from "./calendarTypes";
import { DateTimePickerPopup } from "./DateTimePicker";

export function CalendarEventModal({
  mode, event, onClose, onSave, onDelete,
}: {
  mode: "add" | "edit";
  event: Partial<CalEvent> & { start_time: string };
  onClose: () => void;
  onSave: (data: Partial<CalEvent>) => void;
  onDelete?: () => void;
}) {
  const t = useTheme();
  const [form, setForm] = useState({
    title:       event.title || "",
    description: event.description || "",
    event_type:  event.event_type || "measure",
    start_time:  event.start_time || "",
    end_time:    event.end_time || "",
  });
  const [openPicker, setOpenPicker] = useState<"start_time" | "end_time" | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ background: "#7c3aed" }}>
          <span className="text-sm font-bold text-white">{mode === "add" ? "Новое событие" : "Редактировать"}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white transition"><Icon name="X" size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Название события..."
            className="w-full text-sm font-medium bg-transparent border-b-2 pb-2 focus:outline-none transition"
            style={{ color: t.text, borderColor: "#7c3aed50" }} autoFocus />
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setForm(p => ({ ...p, event_type: k }))}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition border"
                style={form.event_type === k
                  ? { background: EVENT_COLORS[k] + "25", color: EVENT_COLORS[k], borderColor: EVENT_COLORS[k] + "50" }
                  : { background: "transparent", color: t.textSub, borderColor: t.border }}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            {([["Начало","start_time"],["Конец","end_time"]] as [string, "start_time" | "end_time"][]).map(([lbl, field]) => (
              <div key={field} className="flex-1">
                <label className="text-[11px] mb-1 block" style={{ color: t.textMute }}>{lbl}</label>
                <button
                  onClick={e => { setAnchorRect(e.currentTarget.getBoundingClientRect()); setOpenPicker(field); }}
                  className="w-full text-xs rounded-xl px-3 py-2 text-left transition border"
                  style={{ background: t.surface2, color: form[field] ? t.text : t.textMute, borderColor: openPicker === field ? "#7c3aed80" : t.border }}>
                  {form[field]
                    ? new Date(form[field]).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                    : "Выбрать..."}
                </button>
                {openPicker === field && (
                  <DateTimePickerPopup
                    value={form[field] || null}
                    anchorRect={anchorRect}
                    onChange={iso => { setForm(p => ({ ...p, [field]: iso ?? "" })); setOpenPicker(null); }}
                    onClose={() => setOpenPicker(null)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2.5">
            <Icon name="AlignLeft" size={14} className="mt-1 flex-shrink-0" style={{ color: t.textMute }} />
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Добавить описание..." rows={2}
              className="flex-1 text-xs bg-transparent resize-none focus:outline-none"
              style={{ color: t.textSub }} />
          </div>
          <div className="flex gap-2 pt-1">
            {onDelete && (
              <button onClick={onDelete}
                className="px-3 py-2 rounded-xl text-xs font-medium transition border border-red-500/30 text-red-400 hover:bg-red-500/10">
                <Icon name="Trash2" size={12} />
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-medium transition"
              style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
              Отмена
            </button>
            <button onClick={() => onSave(form)} disabled={!form.title.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-40"
              style={{ background: "#7c3aed" }}>
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}