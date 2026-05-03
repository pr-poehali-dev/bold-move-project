import { useState, useRef, type ChangeEvent } from "react";
import { useTheme } from "./themeContext";
import { DateTimePickerPopup } from "./DateTimePicker";

function applyPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("8") ? "7" + digits.slice(1)
          : digits.startsWith("7") ? digits
          : digits.length > 0 ? "7" + digits : "";
  if (!d) return "";
  const p = d.slice(1);
  let result = "+7";
  if (p.length > 0) result += " (" + p.slice(0, 3);
  if (p.length >= 3) result += ") " + p.slice(3, 6);
  if (p.length >= 6) result += "-" + p.slice(6, 8);
  if (p.length >= 8) result += "-" + p.slice(8, 10);
  return result;
}

function isPhoneValid(masked: string): boolean {
  return masked.replace(/\D/g, "").length === 11;
}

export function InlineField({ label, value, onSave, type = "text", placeholder = "—", hideLabel }: {
  label: string;
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
  hideLabel?: boolean;
}) {
  const t = useTheme();
  const [editing,      setEditing]      = useState(false);
  const [phoneErr,     setPhoneErr]     = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [anchorRect,   setAnchorRect]   = useState<DOMRect | null>(null);
  const valRef    = useRef("");
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const isPhone    = type === "phone" || label.toLowerCase().includes("телефон");
  const isDatetime = type === "datetime-local";

  const displayVal = () => {
    if (!value && value !== 0) return null;
    if (isDatetime)
      return new Date(String(value)).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    if (type === "number") return Math.round(Number(value)).toLocaleString("ru-RU");
    return String(value);
  };

  const startEdit = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDatetime) {
      setAnchorRect(e.currentTarget.getBoundingClientRect());
      setDatePickerOpen(true);
      return;
    }
    const v = (type === "number" && value != null && value !== "")
      ? String(Math.round(Number(value)))
      : String(value ?? "");
    valRef.current = isPhone ? applyPhoneMask(v) : v;
    setPhoneErr(false);
    setEditing(true);
  };

  const commit = () => {
    const v = valRef.current;
    if (isPhone && v && !isPhoneValid(v)) { setPhoneErr(true); return; }
    setEditing(false);
    setPhoneErr(false);
    onSaveRef.current(v);
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const masked = applyPhoneMask(e.target.value);
    valRef.current = masked;
    e.target.value = masked;
    setPhoneErr(false);
  };

  return (
    <div style={{ borderBottom: `1px solid ${t.border2}`, minHeight: 36 }}>
      <div className="flex items-center justify-between group">
        {!hideLabel && <span className="text-xs flex-shrink-0 w-36 py-2" style={{ color: "#d4d4d4" }}>{label}</span>}

        {isDatetime ? (
          <>
            <button onClick={startEdit} className="flex-1 text-right text-sm transition hover:opacity-70 truncate py-2">
              {displayVal()
                ? <span style={{ color: "#fff" }}>{displayVal()}</span>
                : <span className="text-xs text-violet-400/60 underline underline-offset-2 decoration-dashed">{placeholder}</span>}
            </button>
            {datePickerOpen && (
              <DateTimePickerPopup
                value={value as string | null}
                anchorRect={anchorRect}
                onChange={iso => { onSaveRef.current(iso ?? ""); }}
                onClose={() => setDatePickerOpen(false)}
              />
            )}
          </>
        ) : editing ? (
          <input
            type={isPhone ? "tel" : type}
            defaultValue={valRef.current}
            autoFocus
            onChange={isPhone ? handlePhoneChange : (e: ChangeEvent<HTMLInputElement>) => { valRef.current = e.target.value; }}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setEditing(false); setPhoneErr(false); }
            }}
            placeholder={isPhone ? "+7 (___) ___-__-__" : undefined}
            className="flex-1 text-sm text-right focus:outline-none my-1 mx-0 px-2 rounded-lg"
            style={{
              background: t.surface2,
              color: phoneErr ? "#f87171" : "#fff",
              border: `1px solid ${phoneErr ? "#ef444470" : "#7c3aed50"}`,
              height: 28, boxSizing: "border-box",
            }}
          />
        ) : (
          <button onClick={startEdit} className="flex-1 text-right text-sm transition hover:opacity-70 truncate py-2">
            {displayVal()
              ? <span style={{ color: "#fff" }}>{displayVal()}</span>
              : <span className="text-xs text-violet-400/60 underline underline-offset-2 decoration-dashed">{placeholder}</span>}
          </button>
        )}
      </div>
      {phoneErr && editing && (
        <div className="text-right text-[10px] pb-1 pr-1" style={{ color: "#f87171" }}>
          Введите полный номер: +7 (___) ___-__-__
        </div>
      )}
    </div>
  );
}
