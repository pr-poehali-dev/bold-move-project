import { useRef, useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject } from "./usePlanProjects";
import { STATUSES, STATUS_COLORS, FormData, EMPTY_FORM } from "./PlanProjectsConstants";
import PlanProjectForm from "./PlanProjectForm";

interface Props {
  project: PlanProject;
  editingId: number | null;
  deletingId: number | null;
  form: FormData;
  setForm: (f: FormData) => void;
  saving: boolean;
  error: string;
  onSelect: (p: PlanProject) => void;
  onStartEdit: (p: PlanProject) => void;
  onCancelEdit: () => void;
  onUpdate: () => void;
  onDelete: (id: number) => void;
  onExport: (p: PlanProject) => void;
  onMaterials: (p: PlanProject) => void;
}

const ACTION_WIDTH = 80;
const THRESHOLD = 50;

function vibe(ms: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

// Определяем touch-устройство один раз
const isTouch = typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

export default function PlanProjectCard({
  project, editingId, deletingId, form, setForm, saving, error,
  onSelect, onStartEdit, onCancelEdit, onUpdate, onDelete, onExport, onMaterials,
}: Props) {
  const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;
  const isEditing = editingId === project.id;
  const isDeleting = deletingId === project.id;

  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startX = useRef(0);
  const lastX = useRef(0);
  const direction = useRef<"h" | "v" | null>(null);
  const active = useRef(false);

  // Колбэки через ref чтобы не пересоздавать слушатели
  const onStartEditRef = useRef(onStartEdit);
  const onDeleteRef = useRef(onDelete);
  const confirmDeleteRef = useRef(confirmDelete);
  useEffect(() => { onStartEditRef.current = onStartEdit; }, [onStartEdit]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);
  useEffect(() => { confirmDeleteRef.current = confirmDelete; }, [confirmDelete]);

  const snapBack = useCallback(() => {
    setIsMoving(false);
    setOffset(0);
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      lastX.current = e.touches[0].clientX;
      direction.current = null;
      active.current = true;
      setIsMoving(false);
    };

    const onMove = (e: TouchEvent) => {
      if (!active.current) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startX.current;
      const adx = Math.abs(dx);
      const ady = Math.abs(e.touches[0].clientY - (startX.current - dx + startX.current));

      if (!direction.current) {
        const rawDy = Math.abs(e.touches[0].clientY - (startX.current * 0 + /* startY */ e.touches[0].clientY - e.touches[0].clientY));
        // Простая проверка: если dx > 4 — горизонталь
        if (adx < 4 && Math.abs(dy) < 4) return;
        direction.current = adx > Math.abs(dy) ? "h" : "v";
      }

      if (direction.current === "v") return;

      e.preventDefault();
      lastX.current = e.touches[0].clientX;
      setIsMoving(true);
      const clamped = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, dx));
      setOffset(clamped);
    };

    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      if (direction.current !== "h") return;

      const dx = lastX.current - startX.current;

      if (dx > THRESHOLD) {
        // Свайп вправо — сразу редактировать
        vibe(40);
        setOffset(0);
        setIsMoving(false);
        onStartEditRef.current(project);
      } else if (dx < -THRESHOLD) {
        // Свайп влево — подтверждение удаления
        vibe([30, 60, 30]);
        setOffset(0);
        setIsMoving(false);
        setConfirmDelete(true);
      } else {
        setOffset(0);
        setIsMoving(false);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
   
  }, [project, snapBack]);

  if (isEditing) {
    return (
      <div>
        <PlanProjectForm
          title={`Редактировать: ${project.name}`}
          form={form}
          setForm={setForm}
          onSubmit={onUpdate}
          onCancel={onCancelEdit}
          saving={saving}
          error={error}
          submitLabel="Сохранить"
        />
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Модалка подтверждения удаления */}
      {confirmDelete && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-3 z-10 rounded-2xl"
          style={{ background: "rgba(10,10,20,0.97)", border: "1px solid rgba(239,68,68,0.4)" }}
        >
          <Icon name="AlertTriangle" size={18} style={{ color: "#f87171" }} />
          <span className="text-white/80 text-[13px] font-semibold">Удалить проект?</span>
          <button
            onClick={() => { vibe(80); onDelete(project.id); setConfirmDelete(false); }}
            disabled={isDeleting}
            className="px-4 py-1.5 rounded-xl text-[12px] font-bold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.85)", color: "#fff" }}
          >
            {isDeleting ? "..." : "Да"}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-4 py-1.5 rounded-xl text-[12px] font-semibold transition hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Нет
          </button>
        </div>
      )}

      {/* Карточка */}
      <div
        ref={cardRef}
        style={{
          position: "relative",
          zIndex: 1,
          transform: `translateX(${offset}px)`,
          transition: isMoving ? "none" : "transform 0.25s cubic-bezier(0.25,1,0.5,1)",
          background: "#0e0e1c",
          willChange: "transform",
          userSelect: "none",
        }}
      >
        <div className="flex">
          {/* Статус */}
          <div
            className="flex-shrink-0 flex items-center justify-center w-12 self-stretch px-1"
            style={{ background: `linear-gradient(to right, ${sc.glow ?? sc.bg}, transparent)` }}
          >
            <span
              className="font-bold uppercase whitespace-nowrap select-none"
              style={{ color: sc.text, writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, letterSpacing: "0.1em" }}
            >
              {STATUSES.find(s => s.id === project.status)?.label ?? project.status}
            </span>
          </div>

          {/* Правая часть */}
          <div className="flex-1 min-w-0">
            <div className="px-4 py-3.5 flex items-center gap-3">
              <button
                className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-90 transition active:scale-[0.99]"
                onClick={() => onSelect(project)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-[14px] truncate">{project.name}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {project.client_name && (
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                        <Icon name="User" size={11} />
                        {project.client_name}
                      </span>
                    )}
                    {project.address && (
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                        <Icon name="MapPin" size={11} />
                        {project.address}
                      </span>
                    )}
                    {project.phone && (
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                        <Icon name="Phone" size={11} />
                        {project.phone}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <div className="flex-shrink-0 flex flex-col gap-1.5">
                <button
                  onClick={() => onExport(project)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
                  style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Icon name="FileDown" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Смета</span>
                </button>
                <button
                  onClick={() => onMaterials(project)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
                  style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Icon name="ClipboardList" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Состав</span>
                </button>
              </div>
            </div>

            {/* Кнопки внизу — только на не-тач устройствах */}
            {!isTouch && (
              <div className="flex border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <button
                  onClick={() => onStartEdit(project)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition hover:bg-white/[0.04]"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  Редактировать
                </button>
                <div className="w-px" style={{ background: "rgba(255,255,255,0.05)" }} />
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={isDeleting}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-[12px] font-semibold transition hover:bg-red-500/10 disabled:opacity-50"
                  style={{ color: "rgba(239,68,68,0.6)" }}
                >
                  {isDeleting
                    ? <div className="w-3.5 h-3.5 border border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                    : <Icon name="Trash2" size={13} />
                  }
                  {isDeleting ? "..." : "Удалить"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { EMPTY_FORM };
