import { useTheme } from "./themeContext";
import { Client, OrderSource } from "./crmApi";
import { sourceDisplay } from "./orderSourcesContext";

interface Props {
  clients: Client[];
  sources: OrderSource[];
  active: string;
  onPick: (name: string) => void;
}

export function SourceStats({ clients, sources, active, onPick }: Props) {
  const t = useTheme();

  const counts = new Map<string, number>();
  for (const c of clients) {
    const key = c.source || "";
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const items = [...counts.entries()]
    .map(([key, count]) => {
      const disp = sourceDisplay(key, sources);
      return { key, count, label: disp?.label ?? key, color: disp?.color ?? "#64748b" };
    })
    .sort((a, b) => b.count - a.count);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-semibold" style={{ color: t.textMute }}>Источники:</span>
      {items.map(it => {
        const isActive = active === it.key;
        return (
          <button key={it.key} onClick={() => onPick(it.key)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition hover:opacity-90"
            style={isActive
              ? { background: it.color, color: "#fff", border: `1px solid ${it.color}` }
              : { background: it.color + "18", color: it.color, border: `1px solid ${it.color}35` }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: isActive ? "#fff" : it.color }} />
            {it.label}
            <span className="font-bold" style={{ opacity: 0.85 }}>{it.count}</span>
          </button>
        );
      })}
    </div>
  );
}
