import { useState, useRef, useEffect } from "react";
import { useTheme } from "./themeContext";
import { Client, OrderSource } from "./crmApi";
import { sourceDisplay } from "./orderSourcesContext";
import Icon from "@/components/ui/icon";

interface Props {
  clients: Client[];
  sources: OrderSource[];
  active: string;
  onPick: (name: string) => void;
}

export function SourceStats({ clients, sources, active, onPick }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

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
    <div ref={ref} className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-semibold transition hover:opacity-90"
        style={active
          ? { background: "#10b98118", color: "#10b981", border: "1px solid #10b98140" }
          : { background: t.surface, color: t.textMute, border: `1px solid ${t.border}` }}>
        <Icon name="ChartPie" size={13} />
        <span className="hidden sm:inline">Статистика</span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={11} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-50 w-56 rounded-xl p-2 shadow-2xl"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: t.textMute }}>
            Заявки по источникам
          </div>
          <div className="space-y-1 mt-1">
            {items.map(it => {
              const isActive = active === it.key;
              return (
                <button key={it.key}
                  onClick={() => { onPick(it.key); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition hover:bg-white/5"
                  style={isActive ? { background: it.color + "18" } : undefined}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: it.color }} />
                  <span className="flex-1 text-left" style={{ color: t.text }}>{it.label}</span>
                  <span className="font-bold" style={{ color: it.color }}>{it.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
