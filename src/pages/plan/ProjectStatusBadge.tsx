import { useRef, useState } from "react";
import { PlanProject } from "./usePlanProjects";
import { STATUSES, STATUS_COLORS } from "./PlanProjectsConstants";

function vibe(ms: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

interface Props {
  project: PlanProject;
  onQuickStatus?: (id: number, status: string) => void;
}

export default function ProjectStatusBadge({ project, onQuickStatus }: Props) {
  const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;
  const label = STATUSES.find(s => s.id === project.status)?.label ?? project.status;
  const fontSize = label.length > 12 ? 8 : label.length > 8 ? 9 : 10;

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  return (
    <div className="relative flex-shrink-0 self-stretch">
      <div
        className="flex items-center justify-center w-12 h-full px-1 py-3 overflow-hidden cursor-pointer select-none"
        style={{ background: `linear-gradient(to right, ${sc.glow ?? sc.bg}, transparent)` }}
        onTouchStart={() => {
          if (!onQuickStatus) return;
          longPressTimer.current = setTimeout(() => { vibe(40); setShowStatusPicker(true); }, 500);
        }}
        onTouchEnd={clearTimer}
        onTouchMove={clearTimer}
        onMouseDown={() => {
          if (!onQuickStatus) return;
          longPressTimer.current = setTimeout(() => { setShowStatusPicker(true); }, 500);
        }}
        onMouseUp={clearTimer}
        onMouseLeave={clearTimer}
      >
        <span
          className="font-bold uppercase"
          style={{ color: sc.text, writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize, letterSpacing: "0.08em" }}
        >
          {label}
        </span>
      </div>

      {/* Пикер статуса */}
      {showStatusPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowStatusPicker(false)} />
          <div
            className="absolute left-12 top-0 z-50 flex flex-col gap-1 p-2 rounded-xl shadow-2xl"
            style={{ minWidth: 200, background: "#0e0e1c", border: "1px solid rgba(124,58,237,0.35)", backdropFilter: "blur(16px)" }}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest px-2 pb-1" style={{ color: "rgba(167,139,250,0.5)" }}>
              Изменить статус
            </div>
            {STATUSES.filter(s => s.id !== "all").map(s => {
              const sColor = STATUS_COLORS[s.id] ?? STATUS_COLORS.draft;
              const isActive = project.status === s.id;
              return (
                <button
                  key={s.id}
                  onClick={e => {
                    e.stopPropagation();
                    setShowStatusPicker(false);
                    if (!isActive) onQuickStatus?.(project.id, s.id);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition active:scale-[0.97]"
                  style={{
                    background: isActive ? sColor.bg : "transparent",
                    border: `1px solid ${isActive ? sColor.glow : "transparent"}`,
                    color: isActive ? sColor.text : "rgba(255,255,255,0.65)",
                    fontSize: 12, fontWeight: isActive ? 700 : 500,
                  }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sColor.text }} />
                  {s.label}
                  {isActive && <span className="ml-auto text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
