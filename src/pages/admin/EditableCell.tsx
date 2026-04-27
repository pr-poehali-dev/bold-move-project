import { useState, useEffect, useRef } from "react";

interface Props {
  value: string | number;
  type?: "text" | "number";
  onSave: (val: string) => void;
  className?: string;
  placeholder?: string;
}

export default function EditableCell({ value, type = "text", onSave, className = "", placeholder = "" }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value === 0 || value === "0" ? "" : String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value === 0 || value === "0" ? "" : String(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === String(value)) { setEditing(false); return; }
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
        }}
        className={`bg-violet-500/10 border border-violet-500/40 rounded px-2 py-0.5 text-white outline-none w-full ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Нажмите для редактирования"
      className={`cursor-pointer hover:text-violet-300 transition-colors rounded px-1 -mx-1 min-h-[1.25rem] inline-block w-full ${saving ? "opacity-50" : ""} ${!value ? "text-white/20 italic" : ""} ${className}`}
    >
      {saving ? "…" : value || placeholder || <>&nbsp;</>}
    </span>
  );
}