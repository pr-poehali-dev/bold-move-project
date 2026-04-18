interface Props {
  text: string;
  pending: string[];
  done: string[];
}

export default function HighlightedText({ text, pending, done }: Props) {
  const all = [...pending, ...done];
  if (!all.length) return <span className="text-white text-sm font-medium">«{text}»</span>;
  const pattern = new RegExp(`(${all.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const doneSet = new Set(done.map(w => w.toLowerCase()));
  const parts = text.split(pattern);
  return (
    <span className="text-white text-sm font-medium leading-relaxed">
      «{parts.map((part, i) =>
        pattern.test(part)
          ? doneSet.has(part.toLowerCase())
            ? <mark key={i} className="bg-green-500/20 text-green-300 rounded px-0.5 not-italic">{part}</mark>
            : <mark key={i} className="bg-red-500/30 text-red-300 rounded px-0.5 not-italic">{part}</mark>
          : part
      )}»
    </span>
  );
}
