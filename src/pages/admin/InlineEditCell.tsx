import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  value: string;
  onSave: (val: string) => void;
  placeholder?: string;
  colorClass?: string;
}

export default function InlineEditCell({ value, onSave, placeholder = "—", colorClass }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.style.height = "auto";
      el.style.height = Math.max(el.scrollHeight, 60) + "px";
    }
  }, [editing]);

  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="relative" onClick={e => e.stopPropagation()}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.max(e.target.scrollHeight, 60) + "px";
          }}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
            if (e.key === "Enter" && e.ctrlKey) commit();
          }}
          className="w-full bg-[#1a1a2e] border border-violet-500/50 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none resize-none min-h-[60px] shadow-lg z-10"
        />
        <div className="flex gap-1 mt-1">
          <button onMouseDown={e => { e.preventDefault(); commit(); }}
            className="text-[10px] bg-violet-600 hover:bg-violet-700 text-white px-2 py-0.5 rounded transition">
            ✓
          </button>
          <button onMouseDown={e => { e.preventDefault(); setDraft(value); setEditing(false); }}
            className="text-[10px] bg-white/10 hover:bg-white/20 text-white/60 px-2 py-0.5 rounded transition">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/cell relative cursor-text min-h-[24px]"
      onClick={e => { e.stopPropagation(); setEditing(true); }}
    >
      <span className={`text-xs block truncate pr-5 ${value ? (colorClass || "text-white/50") : "text-white/15 italic"}`}>
        {value || placeholder}
      </span>
      <Icon
        name="Pencil"
        size={10}
        className="absolute right-0 top-0.5 opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 text-white/40 transition"
      />
    </div>
  );
}
