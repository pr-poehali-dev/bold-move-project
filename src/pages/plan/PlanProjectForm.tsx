import Icon from "@/components/ui/icon";
import { STATUSES, STATUS_COLORS, FormData } from "./PlanProjectsConstants";

interface Props {
  title: string;
  form: FormData;
  setForm: (f: FormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  submitLabel: string;
}

export default function PlanProjectForm({
  title, form, setForm, onSubmit, onCancel, saving, error, submitLabel,
}: Props) {
  return (
    <div className="mb-5 rounded-2xl p-5 space-y-4" style={{ background: "#0e0e1c", border: "1px solid rgba(124,58,237,0.3)" }}>
      <div className="flex items-center justify-between">
        <span className="text-white font-bold text-[15px]">{title}</span>
        <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition">
          <Icon name="X" size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">
            Название <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            onKeyDown={e => e.key === "Enter" && onSubmit()}
            placeholder="Квартира Иванова, 3-к"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Заказчик</label>
            <input
              value={form.client_name}
              onChange={e => setForm({ ...form, client_name: e.target.value })}
              placeholder="Иванов Иван"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Телефон</label>
            <input
              value={form.phone}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, "").replace(/^8/, "7").replace(/^7?/, "7").slice(0, 11);
                let masked = "+7";
                if (digits.length > 1) masked += " " + digits.slice(1, 4);
                if (digits.length > 4) masked += " " + digits.slice(4, 7);
                if (digits.length > 7) masked += "-" + digits.slice(7, 9);
                if (digits.length > 9) masked += "-" + digits.slice(9, 11);
                setForm({ ...form, phone: masked });
              }}
              onFocus={e => { if (!e.target.value) setForm({ ...form, phone: "+7 " }); }}
              onKeyDown={e => {
                if (e.key === "Backspace" && form.phone === "+7 ") {
                  e.preventDefault();
                  setForm({ ...form, phone: "" });
                }
              }}
              placeholder="+7 977 606-89-01"
              type="tel"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Адрес объекта</label>
          <input
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="ул. Ленина, 5, кв. 12"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Статус</label>
          <div className="grid grid-cols-3 gap-1.5">
            {STATUSES.filter(s => s.id !== "all").map(s => (
              <button
                key={s.id}
                onClick={() => setForm({ ...form, status: s.id })}
                className="py-2 px-2 rounded-xl text-[11px] font-semibold transition text-center leading-tight"
                style={{
                  background: form.status === s.id ? (STATUS_COLORS[s.id]?.bg ?? "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.04)",
                  color: form.status === s.id ? (STATUS_COLORS[s.id]?.text ?? "#fff") : "rgba(255,255,255,0.35)",
                  border: `1px solid ${form.status === s.id ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-[12px]">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSubmit}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
        >
          {saving ? "Сохраняем..." : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm transition"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}