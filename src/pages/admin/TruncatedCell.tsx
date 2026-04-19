import { useState } from "react";
import EditableCell from "./EditableCell";

interface Props {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  maxChars?: number;
}

export default function TruncatedCell({ value, onSave, placeholder, className = "", maxChars = 30 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > maxChars;

  if (expanded || !isLong) {
    return (
      <div className="flex items-start gap-1">
        <EditableCell value={value} onSave={onSave} placeholder={placeholder} className={className} />
        {isLong && (
          <button onClick={() => setExpanded(false)} className="text-white/20 hover:text-white/50 transition flex-shrink-0 mt-0.5 text-[10px]">↑</button>
        )}
      </div>
    );
  }

  return (
    <span
      onClick={() => setExpanded(true)}
      title={value}
      className={`cursor-pointer text-white/40 hover:text-white/70 transition truncate block max-w-full ${className}`}
    >
      {value.slice(0, maxChars)}…
    </span>
  );
}
