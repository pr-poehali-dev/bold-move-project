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
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    if (draft === String(value)) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft);
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
      className={`cursor-pointer hover:text-violet-300 transition-colors rounded px-1 -mx-1 ${saving ? "opacity-50" : ""} ${!value ? "text-white/20 italic" : ""} ${className}`}
    >
      {saving ? "…" : value || placeholder}
    </span>
  );
}