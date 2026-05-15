import { useRef, useState, useCallback } from "react";
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
const THRESHOLD = 40;

function useSwipe(onEdit: () => void, onDeleteTap: () => void) {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const locked = useRef<"h" | "v" | null>(null);
  const [offset, setOffset] = useState(0);
  const [snapped, setSnapped] = useState<"edit" | "delete" | null>(null);
  const [animating, setAnimating] = useState(false);

  const vibrate = (ms: number | number[]) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  const snapTo = useCallback((dir: "edit" | "delete" | null) => {
    setAnimating(true);
    if (dir === "edit") setOffset(ACTION_WIDTH);
    else if (dir === "delete") setOffset(-ACTION_WIDTH);
    else setOffset(0);
    setSnapped(dir);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = 0;
    locked.current = null;
    setAnimating(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!locked.current) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      locked.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }

    if (locked.current === "v") return;

    e.preventDefault();
    e.stopPropagation();

    currentX.current = dx;
    const clamped = Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, dx));
    setOffset(clamped);
  };

  const onTouchEnd = () => {
    if (locked.current !== "h") return;

    if (currentX.current > THRESHOLD) {
      snapTo("edit");
      vibrate(40);
    } else if (currentX.current < -THRESHOLD) {
      snapTo("delete");
      vibrate(40);
    } else {
      snapTo(null);
    }
  };

  const reset = useCallback(() => {
    setAnimating(true);
    setOffset(0);
    setSnapped(null);
  }, []);

  const handleCardClick = () => {
    if (snapped === "edit") { reset(); onEdit(); return; }
    if (snapped === "delete") { onDeleteTap(); return; }
  };

  return { offset, snapped, animating, onTouchStart, onTouchMove, onTouchEnd, reset, handleCardClick };
}

export default function PlanProjectCard({
  project, editingId, deletingId, form, setForm, saving, error,
  onSelect, onStartEdit, onCancelEdit, onUpdate, onDelete, onExport, onMaterials,
}: Props) {
  const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;
  const isEditing = editingId === project.id;
  const isDeleting = deletingId === project.id;

  const [confirmDelete, setConfirmDelete] = useState(false);

  const vibrate = (ms: number | number[]) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  const handleDeleteTap = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      vibrate([30, 60, 30]);
    } else {
      vibrate(80);
      onDelete(project.id);
      setConfirmDelete(false);
    }
  };

  const { offset, snapped, animating, onTouchStart, onTouchMove, onTouchEnd, reset, handleCardClick } =
    useSwipe(() => onStartEdit(project), handleDeleteTap);

  // Сброс confirmDelete при закрытии свайпа
  const handleReset = () => { reset(); setConfirmDelete(false); };

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
      {/* Фон LEFT — Редактировать (виден при свайпе вправо) */}
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-center"
        style={{ width: ACTION_WIDTH, background: "rgba(99,102,241,0.9)", zIndex: 0 }}
      >
        <div className="flex flex-col items-center gap-1 pointer-events-none">
          <Icon name="Pencil" size={18} style={{ color: "#fff" }} />
          <span className="text-[10px] font-bold uppercase tracking-wide text-white">Изменить</span>
        </div>
      </div>

      {/* Фон RIGHT — Удалить (виден при свайпе влево) */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center"
        style={{
          width: ACTION_WIDTH,
          background: confirmDelete ? "rgba(220,38,38,0.95)" : "rgba(239,68,68,0.88)",
          zIndex: 0,
          transition: "background 0.15s",
        }}
      >
        <div className="flex flex-col items-center gap-1 pointer-events-none">
          {isDeleting
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Icon name={confirmDelete ? "AlertTriangle" : "Trash2"} size={18} style={{ color: "#fff" }} />
          }
          <span className="text-[10px] font-bold uppercase tracking-wide text-white">
            {confirmDelete ? "Точно?" : "Удалить"}
          </span>
        </div>
      </div>

      {/* Карточка — сдвигается при свайпе */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          transform: `translateX(${offset}px)`,
          transition: animating ? "transform 0.25s cubic-bezier(0.25,1,0.5,1)" : "none",
          background: "#0e0e1c",
          willChange: "transform",
          touchAction: "pan-y",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleCardClick}
      >
        <div className="flex">
          {/* Статус — вертикальная полоска слева */}
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
            {/* Основная строка */}
            <div className="px-4 py-3.5 flex items-center gap-3">
              <button
                className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-90 transition active:scale-[0.99]"
                onClick={e => {
                  if (snapped) { e.stopPropagation(); handleReset(); return; }
                  onSelect(project);
                }}
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

              {/* Кнопки справа */}
              <div className="flex-shrink-0 flex flex-col gap-1.5">
                <button
                  onClick={e => { e.stopPropagation(); handleReset(); onExport(project); }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
                  style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  title="Скачать смету"
                >
                  <Icon name="FileDown" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Смета</span>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleReset(); onMaterials(project); }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
                  style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  title="Материалы"
                >
                  <Icon name="ClipboardList" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Состав</span>
                </button>
              </div>
            </div>

            {/* Кнопки действий — только на ПК (hover device) */}
            <div className="hidden sm:flex border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <button
                onClick={() => onStartEdit(project)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition hover:bg-white/[0.04]"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Редактировать
              </button>
              <div className="w-px" style={{ background: "rgba(255,255,255,0.05)" }} />
              <button
                onClick={() => onDelete(project.id)}
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
          </div>
        </div>
      </div>
    </div>
  );
}

export { EMPTY_FORM };