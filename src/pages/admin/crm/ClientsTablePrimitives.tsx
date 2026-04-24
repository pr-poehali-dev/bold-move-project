import Icon from "@/components/ui/icon";

export function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#8b5cf6","#3b82f6","#f59e0b","#10b981","#f97316","#ec4899","#06b6d4"];
  const color = colors[(name || "?").charCodeAt(0) % colors.length];
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: color + "22", border: `1.5px solid ${color}55`, color }}>
      {initials}
    </div>
  );
}

export function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void;
}) {
  return (
    <button onClick={e => { e.stopPropagation(); onChange(); }}
      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition"
      style={{
        border: checked || indeterminate ? "none" : "1.5px solid #9ca3af",
        background: checked || indeterminate ? "#7c3aed" : "transparent",
      }}>
      {indeterminate && !checked && <div className="w-2 h-0.5 bg-white rounded-full" />}
      {checked && <Icon name="Check" size={10} style={{ color: "#fff" }} />}
    </button>
  );
}
