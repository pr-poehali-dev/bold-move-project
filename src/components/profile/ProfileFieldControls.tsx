import PhoneInput from "@/components/ui/PhoneInput";
import Icon from "@/components/ui/icon";

export function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} size={13} style={{ color: "#f97316" }} />
        <span className="text-xs font-bold uppercase tracking-wider text-white/40">{title}</span>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, type = "text", readonly = false }: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; readonly?: boolean;
}) {
  return (
    <div className="border-b border-white/[0.04] last:border-0">
      {/* Десктоп: горизонтально */}
      <div className="hidden sm:flex items-center px-4 py-2.5">
        <span className="text-xs text-white/30 w-24 flex-shrink-0">{label}</span>
        <input
          type={type} value={value} readOnly={readonly}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-xs bg-transparent text-right placeholder-white/15 focus:outline-none transition"
          style={{ color: readonly ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)" }}
        />
      </div>
      {/* Мобиле: вертикально */}
      <div className="sm:hidden px-4 py-3">
        <div className="text-[10px] text-white/30 mb-1 uppercase tracking-wider">{label}</div>
        <input
          type={type} value={value} readOnly={readonly}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm bg-transparent placeholder-white/15 focus:outline-none transition"
          style={{ color: readonly ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)" }}
        />
      </div>
    </div>
  );
}

export function PhoneField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="border-b border-white/[0.04] last:border-0">
      {/* Десктоп */}
      <div className="hidden sm:flex items-center px-4 py-2.5">
        <span className="text-xs text-white/30 w-24 flex-shrink-0">{label}</span>
        <PhoneInput value={value} onChange={onChange} showValidation
          className="flex-1 text-xs bg-transparent text-right placeholder-white/15 focus:outline-none transition"
          style={{ color: "rgba(255,255,255,0.7)" }} />
      </div>
      {/* Мобиле */}
      <div className="sm:hidden px-4 py-3">
        <div className="text-[10px] text-white/30 mb-1 uppercase tracking-wider">{label}</div>
        <PhoneInput value={value} onChange={onChange} showValidation
          className="w-full text-sm bg-transparent placeholder-white/15 focus:outline-none transition"
          style={{ color: "rgba(255,255,255,0.85)" }} />
      </div>
    </div>
  );
}
