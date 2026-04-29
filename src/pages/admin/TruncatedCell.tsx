import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  maxChars?: number;
}

export default function TruncatedCell({ value, onSave, placeholder, className = "", maxChars = 30 }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (open) setTimeout(() => { textareaRef.current?.focus(); textareaRef.current?.select(); }, 50);
  }, [open]);

  const commit = async () => {
    if (draft.trim() === value.trim()) { setOpen(false); return; }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setOpen(false);
  };

  const preview = value.length > maxChars ? value.slice(0, maxChars) + "…" : value;

  return (
    <>
      <span
        onClick={() => setOpen(true)}
        title={value || placeholder}
        className={`cursor-pointer hover:text-violet-500 transition-colors truncate block w-full ${!value ? "opacity-30 italic" : ""} ${className}`}
      >
        {value ? preview : (placeholder || "\u00a0")}
      </span>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) commit(); }}
        >
          <div className="bg-[#13131f] border border-violet-500/30 rounded-2xl p-5 w-full max-w-lg flex flex-col gap-3 shadow-2xl mx-4">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-xs">Редактирование</span>
              <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 transition">
                <Icon name="X" size={14} />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit();
              }}
              rows={4}
              placeholder={placeholder}
              className="bg-white/5 border border-white/10 focus:border-violet-500 rounded-xl px-4 py-3 text-white text-sm outline-none resize-none transition w-full"
            />
            <div className="flex items-center justify-between">
              <span className="text-white/20 text-xs">Ctrl+Enter — сохранить</span>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)}
                  className="text-white/40 hover:text-white/70 text-sm transition px-3 py-1.5">
                  Отмена
                </button>
                <button onClick={commit} disabled={saving}
                  className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition flex items-center gap-1.5">
                  {saving ? <Icon name="Loader" size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}