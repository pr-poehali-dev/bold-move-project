import { createPortal } from "react-dom";
import { PlanProject } from "./usePlanProjects";
import { STATUSES, STATUS_COLORS } from "./PlanProjectsConstants";

interface Props {
  project: PlanProject;
  onSelect: (status: string) => void;
  onClose: () => void;
}

export default function StatusPickerOverlay({ project, onSelect, onClose }: Props) {
  const currentSc = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl overflow-hidden"
        style={{ background: "#0d0d1a", border: "1px solid rgba(124,58,237,0.2)", borderBottom: "none" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Хэндл */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Заголовок */}
        <div className="px-5 pt-3 pb-4">
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(167,139,250,0.5)" }}>
            Изменить статус
          </div>
          <div className="text-white font-bold text-[15px] leading-snug truncate">{project.name}</div>
          {/* Текущий статус */}
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full" style={{ background: currentSc.text }} />
            <span className="text-[12px] font-semibold" style={{ color: currentSc.text }}>
              {STATUSES.find(s => s.id === project.status)?.label ?? project.status}
            </span>
          </div>
        </div>

        {/* Разделитель */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 8 }} />

        {/* Список статусов */}
        <div className="px-3 pb-6 flex flex-col gap-2">
          {STATUSES.filter(s => s.id !== "all").map(s => {
            const sc = STATUS_COLORS[s.id] ?? STATUS_COLORS.draft;
            const isActive = project.status === s.id;
            return (
              <button
                key={s.id}
                onClick={() => { if (!isActive) onSelect(s.id); else onClose(); }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition active:scale-[0.98]"
                style={{
                  background: isActive ? sc.bg : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? sc.glow : "rgba(255,255,255,0.07)"}`,
                  boxShadow: isActive ? `0 0 16px ${sc.glow}` : "none",
                }}
              >
                {/* Цветной индикатор */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    background: sc.text,
                    boxShadow: isActive ? `0 0 8px ${sc.text}` : "none",
                  }}
                />
                {/* Название */}
                <span
                  className="flex-1 text-[14px]"
                  style={{
                    color: isActive ? sc.text : "rgba(255,255,255,0.7)",
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {s.label}
                </span>
                {/* Галочка */}
                {isActive && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: sc.bg, border: `1px solid ${sc.glow}` }}
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke={sc.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
