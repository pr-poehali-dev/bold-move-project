import { useState } from "react";
import { STATUS_LABELS, LEAD_STATUSES, ORDER_STATUSES } from "./crmApi";
import Icon from "@/components/ui/icon";
import PhoneInput from "@/components/ui/PhoneInput";
import { useTheme } from "./themeContext";
import { DateTimePickerPopup } from "./DateTimePicker";

const ALL_STATUSES = [...LEAD_STATUSES, ...ORDER_STATUSES];

type NewClientForm = { client_name: string; phone: string; status: string; address: string; notes: string; measure_date: string };

export function AddClientModal({ form, onChange, onSave, onClose }: {
  form: NewClientForm;
  onChange: (patch: Partial<NewClientForm>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={{ color: t.text }}>Новый клиент</h3>
          <button onClick={onClose} style={{ color: t.textMute }}><Icon name="X" size={17} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Имя *</label>
            <input value={form.client_name} onChange={e => onChange({ client_name: e.target.value })}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Телефон</label>
            <PhoneInput value={form.phone} onChange={(v) => onChange({ phone: v })} showValidation
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Адрес</label>
            <input value={form.address} onChange={e => onChange({ address: e.target.value })}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Статус</label>
              <select value={form.status} onChange={e => onChange({ status: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Дата замера</label>
              <button ref={dateRef}
                onClick={e => { setAnchorRect(e.currentTarget.getBoundingClientRect()); setDatePickerOpen(true); }}
                className="w-full rounded-xl px-4 py-2.5 text-sm text-left transition"
                style={{ background: t.surface2, border: `1px solid ${datePickerOpen ? "#7c3aed80" : t.border}`, color: form.measure_date ? t.text : t.textMute }}>
                {form.measure_date
                  ? new Date(form.measure_date).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
                  : "Выбрать дату..."}
              </button>
              {datePickerOpen && (
                <DateTimePickerPopup
                  value={form.measure_date || null}
                  anchorRect={anchorRect}
                  onChange={iso => onChange({ measure_date: iso ?? "" })}
                  onClose={() => setDatePickerOpen(false)}
                />
              )}
            </div>
          </div>
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Заметка</label>
            <textarea value={form.notes} onChange={e => onChange({ notes: e.target.value })} rows={2}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition resize-none"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-5">
          <button onClick={onSave} disabled={!form.client_name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: "#7c3aed" }}>
            Создать клиента
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm transition"
            style={{ background: t.surface2, color: t.textMute }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}