import { useRef, useState, useEffect } from "react";
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

const SNAP_WIDTH = 88;   // ширина открытой кнопки
const THRESHOLD = 44;    // порог фиксации

function vibe(ms: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

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

  // offset: >0 = сдвиг вправо (кнопка Edit слева), <0 = влево (кнопка Delete справа)
  const [offset, setOffset] = useState(0);
  const [snapped, setSnapped] = useState<"edit" | "delete" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // touch tracking refs
  const sx = useRef(0);   // startX
  const sy = useRef(0);   // startY
  const lx = useRef(0);   // lastX
  const axis = useRef<"h" | "v" | null>(null);
  const alive = useRef(false);
  const vibed = useRef(false);

  // keep latest handlers without re-registering listeners
  const cbEdit = useRef(onStartEdit);
  const cbDelete = useRef(onDelete);
  useEffect(() => { cbEdit.current = onStartEdit; }, [onStartEdit]);
  useEffect(() => { cbDelete.current = onDelete; }, [onDelete]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      sx.current = e.touches[0].clientX;
      sy.current = e.touches[0].clientY;
      lx.current = sx.current;
      axis.current = null;
      alive.current = true;
      vibed.current = false;
      setDragging(false);
    };

    const onMove = (e: TouchEvent) => {
      if (!alive.current) return;

      const dx = e.touches[0].clientX - sx.current;
      const dy = e.touches[0].clientY - sy.current;

      // определяем ось один раз
      if (!axis.current) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        axis.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
      }

      if (axis.current === "v") return; // вертикальный скролл — не трогаем

      e.preventDefault(); // блокируем скролл только при горизонтали

      lx.current = e.touches[0].clientX;
      setDragging(true);

      // если уже зафиксировано — двигаем от позиции фиксации
      const base = snapped === "edit" ? SNAP_WIDTH : snapped === "delete" ? -SNAP_WIDTH : 0;
      const raw = base + dx;
      const clamped = Math.max(-SNAP_WIDTH, Math.min(SNAP_WIDTH, raw));
      setOffset(clamped);

      // вибрация при пересечении порога
      if (!vibed.current && Math.abs(dx) >= THRESHOLD) {
        vibe(30);
        vibed.current = true;
      }
    };

    const onEnd = () => {
      if (!alive.current) return;
      alive.current = false;
      if (axis.current !== "h") { setDragging(false); return; }

      const dx = lx.current - sx.current;
      const base = snapped === "edit" ? SNAP_WIDTH : snapped === "delete" ? -SNAP_WIDTH : 0;
      const total = base + dx;

      setDragging(false);

      if (total >= THRESHOLD) {
        setOffset(SNAP_WIDTH);
        setSnapped("edit");
        vibe(40);
      } else if (total <= -THRESHOLD) {
        setOffset(-SNAP_WIDTH);
        setSnapped("delete");
        vibe(40);
      } else {
        setOffset(0);
        setSnapped(null);
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
   
  }, [snapped]);

  const closeSwipe = () => { setOffset(0); setSnapped(null); };

  const handleEditTap = () => {
    closeSwipe();
    cbEdit.current(project);
  };

  const handleDeleteTap = () => {
    setConfirmDelete(true);
    vibe([30, 60, 30]);
  };

  const confirmAndDelete = () => {
    vibe(80);
    cbDelete.current(project.id);
    setConfirmDelete(false);
    closeSwipe();
  };

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
      {/* ── Фон LEFT: кнопка Редактировать ── */}
      <button
        onClick={handleEditTap}
        className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-1"
        style={{
          width: SNAP_WIDTH,
          background: "linear-gradient(135deg,#6d28d9,#7c3aed)",
          zIndex: 0,
          border: "none",
          cursor: "pointer",
        }}
      >
        <Icon name="Pencil" size={20} style={{ color: "#fff" }} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Изменить</span>
      </button>

      {/* ── Фон RIGHT: кнопка Удалить ── */}
      <button
        onClick={handleDeleteTap}
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1"
        style={{
          width: SNAP_WIDTH,
          background: "linear-gradient(135deg,#dc2626,#ef4444)",
          zIndex: 0,
          border: "none",
          cursor: "pointer",
        }}
      >
        <Icon name="Trash2" size={20} style={{ color: "#fff" }} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Удалить</span>
      </button>

      {/* ── Карточка (сдвигается) ── */}
      <div
        ref={cardRef}
        style={{
          position: "relative",
          zIndex: 1,
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.25,1,0.5,1)",
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
                onClick={() => { if (snapped) { closeSwipe(); return; } onSelect(project); }}
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
                  onClick={() => { closeSwipe(); onExport(project); }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
                  style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Icon name="FileDown" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Смета</span>
                </button>
                <button
                  onClick={() => { closeSwipe(); onMaterials(project); }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
                  style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Icon name="ClipboardList" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Состав</span>
                </button>
              </div>
            </div>

            {/* Кнопки внизу — только на мышиных устройствах */}
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

      {/* ── Подтверждение удаления (поверх всего) ── */}
      {confirmDelete && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-3 z-20 rounded-2xl"
          style={{ background: "rgba(8,8,18,0.96)", backdropFilter: "blur(4px)" }}
        >
          <Icon name="AlertTriangle" size={16} style={{ color: "#f87171" }} />
          <span className="text-white/85 text-[13px] font-semibold">Удалить проект?</span>
          <button
            onClick={confirmAndDelete}
            disabled={isDeleting}
            className="px-4 py-1.5 rounded-xl text-[12px] font-bold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.9)", color: "#fff" }}
          >
            {isDeleting
              ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              : "Да, удалить"
            }
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition"
            style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}

export { EMPTY_FORM };
