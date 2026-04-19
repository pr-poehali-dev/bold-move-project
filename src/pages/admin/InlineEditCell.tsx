import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  value: string;
  onSave: (val: string) => void;
  placeholder?: string;
  colorClass?: string;
}

export default function InlineEditCell({ value, onSave, placeholder = "—", colorClass }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [open]);

  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setOpen(false);
  };

  const cancel = () => {
    setDraft(value);
    setOpen(false);
  };

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div
        className="group/cell relative flex items-center gap-1 min-h-[20px] cursor-pointer"
        onClick={() => { setDraft(value); setOpen(true); }}
      >
        <span className={`text-xs truncate flex-1 ${value ? (colorClass || "text-white/50") : "text-white/15 italic"}`}>
          {value || placeholder}
        </span>
        {value && (
          <button
            onClick={copy}
            title="Скопировать"
            className="flex-shrink-0 opacity-0 group-hover/cell:opacity-100 transition text-white/25 hover:text-violet-400 p-0.5"
          >
            {copied
              ? <Icon name="Check" size={10} className="text-green-400" />
              : <Icon name="Copy" size={10} />}
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={cancel}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-4 p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm font-medium">Редактирование</span>
              <button onClick={cancel} className="text-white/30 hover:text-white/70 transition">
                <Icon name="X" size={15} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") cancel();
                if (e.key === "Enter" && e.ctrlKey) commit();
              }}
              rows={4}
              className="bg-white/5 border border-violet-500/40 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-violet-500 resize-none transition w-full"
              placeholder={placeholder}
            />

            <div className="flex items-center justify-between">
              <span className="text-white/20 text-xs">Ctrl+Enter — сохранить</span>
              <div className="flex gap-2">
                <button onClick={cancel} className="text-white/40 hover:text-white/70 text-sm transition px-3 py-1.5">Отмена</button>
                <button onClick={commit}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded-lg transition flex items-center gap-1.5">
                  <Icon name="Check" size={13} /> Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
