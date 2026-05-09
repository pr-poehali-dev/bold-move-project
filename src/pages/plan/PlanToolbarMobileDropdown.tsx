import React from "react";
import Icon from "@/components/ui/icon";
import type { ToolMode } from "./planTypes";
import { ALL_TOOLS_MENU } from "./PlanToolbarShared";

interface Props {
  tool: ToolMode;
  pinned: ToolMode[];
  onToolChange: (t: ToolMode) => void;
  onTogglePin: (id: ToolMode) => void;
}

export default function MobileToolDropdown({ tool, pinned, onToolChange, onTogglePin }: Props) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      {open && (
        <div className="fixed bg-[#1a1b2e] border border-white/[0.12] rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 w-[210px] z-[9999]" style={{ top: 52, right: 8 }}>
          <p className="text-[10px] text-white/30 px-3 pt-1 pb-0.5 uppercase tracking-wide font-semibold">Инструменты</p>
          {ALL_TOOLS_MENU.map(t => {
            const pinnedIdx = pinned.indexOf(t.id);
            const isPinned  = pinnedIdx !== -1;
            const isActive  = tool === t.id;
            return (
              <div key={t.id} className={`flex items-center rounded-lg transition-all ${
                isActive
                  ? t.danger ? "bg-rose-500/15 border border-rose-500/25" : "bg-white/[0.08] border border-white/[0.1]"
                  : "border border-transparent"
              }`}>
                <button
                  onClick={() => { if (!t.comingSoon) { onToolChange(t.id); setOpen(false); } }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all text-left flex-1 ${
                    t.comingSoon ? "opacity-40 cursor-not-allowed" :
                    isActive
                      ? t.danger ? "text-rose-300" : "text-white"
                      : t.danger ? "text-white/50 hover:text-rose-300" : "text-white/60 hover:text-white"
                  }`}
                >
                  <Icon name={t.icon} size={14} />
                  <span className="flex-1">{t.label}</span>
                  {t.comingSoon && <span className="text-[9px] text-white/25 font-normal">скоро</span>}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onTogglePin(t.id); }}
                  className={`w-8 h-8 flex items-center justify-center shrink-0 mr-1 rounded-lg transition-all relative ${
                    isPinned ? "text-amber-400" : "text-white/20 hover:text-amber-300"
                  }`}
                  title={isPinned ? `Позиция ${pinnedIdx + 1} — убрать` : "Закрепить в панели"}
                >
                  <Icon name="Star" size={13} style={{ fill: isPinned ? "currentColor" : "none" }} />
                  {isPinned && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-[8px] font-bold text-black flex items-center justify-center leading-none">
                      {pinnedIdx + 1}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        title="Все инструменты"
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all relative ${
          open ? "bg-white/10 text-white" : "text-white/45 hover:text-white"
        }`}
      >
        <Icon name="Shapes" size={16} />
        <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-current opacity-40" />
      </button>
    </div>
  );
}
