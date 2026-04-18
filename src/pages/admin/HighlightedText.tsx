import { useRef } from "react";

interface Props {
  text: string;
  pending: string[];
  done: string[];
  onAddSelection?: (word: string) => void;
}

export default function HighlightedText({ text, pending, done, onAddSelection }: Props) {
  const containerRef = useRef<HTMLSpanElement>(null);

  const all = [...pending, ...done];
  const pattern = all.length
    ? new RegExp(`(${all.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
    : null;
  const doneSet = new Set(done.map(w => w.toLowerCase()));

  const handleMouseUp = () => {
    if (!onAddSelection) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const selected = sel.toString().trim();
    if (!selected || selected.length < 2) return;
    // Проверяем что выделение внутри нашего контейнера
    const range = sel.getRangeAt(0);
    if (!containerRef.current?.contains(range.commonAncestorContainer)) return;
    onAddSelection(selected);
    sel.removeAllRanges();
  };

  const parts = pattern ? text.split(pattern) : [text];

  return (
    <span
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className={`text-white text-sm font-medium leading-relaxed ${onAddSelection ? "cursor-text select-text" : ""}`}
    >
      «{parts.map((part, i) =>
        pattern && pattern.test(part)
          ? doneSet.has(part.toLowerCase())
            ? <mark key={i} className="bg-green-500/20 text-green-300 rounded px-0.5 not-italic">{part}</mark>
            : <mark key={i} className="bg-red-500/30 text-red-300 rounded px-0.5 not-italic">{part}</mark>
          : part
      )}»
    </span>
  );
}
