import { useRef, useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject } from "./usePlanProjects";
import { STATUS_COLORS, FormData, EMPTY_FORM } from "./PlanProjectsConstants";
import PlanProjectForm from "./PlanProjectForm";
import ProjectCardBadges from "./ProjectCardBadges";
import ProjectCardBody from "./ProjectCardBody";
import { ConfirmEditOverlay, ConfirmDeleteOverlay } from "./ProjectCardConfirm";

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
  onCrm?: (p: PlanProject) => void;
  onCreateLink?: (p: PlanProject) => void;
  onAttachLink?: (p: PlanProject) => void;
  onQuickStatus?: (id: number, status: string) => void;
}

const SNAP_WIDTH = 88;
const THRESHOLD = 44;

function vibe(ms: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

export default function PlanProjectCard({
  project, editingId, deletingId, form, setForm, saving, error,
  onSelect, onStartEdit, onCancelEdit, onUpdate, onDelete, onExport, onMaterials, onCrm,
  onCreateLink, onAttachLink, onQuickStatus,
}: Props) {
  const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;
  const isEditing = editingId === project.id;
  const isDeleting = deletingId === project.id;

  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);

  // touch tracking
  const sx = useRef(0);
  const sy = useRef(0);
  const lx = useRef(0);
  const axis = useRef<"h" | "v" | null>(null);
  const alive = useRef(false);
  const vibed = useRef(false);
  const offsetRef = useRef(0);

  // все setState через ref.current — замыкание useEffect не устаревает никогда
  const setOffsetSync   = useRef((v: number)  => { offsetRef.current = v; setOffset(v); });
  const setDraggingSync = useRef((v: boolean) => { setDragging(v); });
  const setConfDelSync  = useRef((v: boolean) => { setConfirmDelete(v); });
  const setConfEditSync = useRef((v: boolean) => { setConfirmEdit(v); });
  setOffsetSync.current   = (v: number)  => { offsetRef.current = v; setOffset(v); };
  setDraggingSync.current = (v: boolean) => { setDragging(v); };
  setConfDelSync.current  = (v: boolean) => { setConfirmDelete(v); };
  setConfEditSync.current = (v: boolean) => { setConfirmEdit(v); };

  // колбэки тоже через ref
  const cb = useRef({ onStartEdit, onDelete });
  cb.current = { onStartEdit, onDelete };

  // эффект вешается ОДИН РАЗ — cardRef всегда в DOM (нет раннего return)
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      sx.current  = e.touches[0].clientX;
      sy.current  = e.touches[0].clientY;
      lx.current  = sx.current;
      axis.current  = null;
      alive.current = true;
      vibed.current = false;
      setDraggingSync.current(false);
    };

    const onMove = (e: TouchEvent) => {
      if (!alive.current) return;
      const dx = e.touches[0].clientX - sx.current;
      const dy = e.touches[0].clientY - sy.current;

      if (!axis.current) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        axis.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
      }
      if (axis.current === "v") return;

      e.preventDefault();
      lx.current = e.touches[0].clientX;
      setDraggingSync.current(true);

      const clamped = Math.max(-SNAP_WIDTH, Math.min(SNAP_WIDTH, dx));
      setOffsetSync.current(clamped);

      if (!vibed.current && Math.abs(dx) >= THRESHOLD) {
        vibe(25);
        vibed.current = true;
      }
    };

    const onEnd = () => {
      if (!alive.current) return;
      alive.current = false;
      setDraggingSync.current(false);

      if (axis.current !== "h") return;

      const cur = offsetRef.current;

      if (cur >= THRESHOLD) {
        vibe(40);
        setOffsetSync.current(0);
        setConfEditSync.current(true);       // показываем подтверждение редактирования
      } else if (cur <= -THRESHOLD) {
        vibe([30, 60, 30]);
        setOffsetSync.current(0);
        setConfDelSync.current(true);        // показываем подтверждение удаления
      } else {
        setOffsetSync.current(0);
      }
    };

    el.addEventListener("touchstart", onStart,  { passive: true });
    el.addEventListener("touchmove",  onMove,   { passive: false });
    el.addEventListener("touchend",   onEnd,    { passive: true });
    el.addEventListener("touchcancel",onEnd,    { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove",  onMove);
      el.removeEventListener("touchend",   onEnd);
      el.removeEventListener("touchcancel",onEnd);
    };
   
  }, []); // [] — регистрируем ОДИН РАЗ, cardRef всегда в DOM

  const doDelete = () => { vibe(80); onDelete(project.id); setConfirmDelete(false); };
  const doEdit   = () => { setConfirmEdit(false); onStartEdit(project); };

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: "#0e0e1c", border: `1px solid ${sc.glow}`, boxShadow: `0 0 12px ${sc.glow.replace("0.3","0.12").replace("0.4","0.12")}` }}
    >
      {/* Бейджи: комнаты, CRM, меню привязки */}
      <ProjectCardBadges
        project={project}
        isEditing={isEditing}
        onCreateLink={onCreateLink}
        onAttachLink={onAttachLink}
      />

      {/* ── Форма редактирования (вместо карточки) ── */}
      {isEditing && (
        <PlanProjectForm
          title={`Редактировать: ${project.name}`}
          form={form}
          setForm={setForm}
          onSubmit={onUpdate}
          onCancel={onCancelEdit}
          onDelete={() => { onCancelEdit(); setConfirmDelete(true); }}
          saving={saving}
          error={error}
          submitLabel="Сохранить"
        />
      )}

      {/* ── Фоны свайп-кнопок (всегда в DOM) ── */}
      {!isEditing && (
        <>
          <div
            className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-1 pointer-events-none"
            style={{ width: SNAP_WIDTH, background: "linear-gradient(135deg,#6d28d9,#7c3aed)", zIndex: 0 }}
          >
            <Icon name="Pencil" size={20} style={{ color: "#fff" }} />
            <span className="text-[10px] font-bold uppercase tracking-wide text-white">Изменить</span>
          </div>
          <div
            className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 pointer-events-none"
            style={{ width: SNAP_WIDTH, background: "linear-gradient(135deg,#dc2626,#ef4444)", zIndex: 0 }}
          >
            <Icon name="Trash2" size={20} style={{ color: "#fff" }} />
            <span className="text-[10px] font-bold uppercase tracking-wide text-white">Удалить</span>
          </div>
        </>
      )}

      {/* ── Карточка (всегда в DOM — cardRef не теряется) ── */}
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
          display: isEditing ? "none" : undefined,   // скрываем при редактировании, но не размонтируем
        }}
      >
        <ProjectCardBody
          project={project}
          onSelect={onSelect}
          onStartEdit={onStartEdit}
          onExport={onExport}
          onMaterials={onMaterials}
          onCrm={onCrm}
          onQuickStatus={onQuickStatus}
        />
      </div>

      {/* ── Подтверждение: Изменить ── */}
      {confirmEdit && (
        <ConfirmEditOverlay
          onConfirm={doEdit}
          onCancel={() => setConfirmEdit(false)}
          onDelete={() => { setConfirmEdit(false); setConfirmDelete(true); }}
        />
      )}

      {/* ── Подтверждение: Удалить ── */}
      {confirmDelete && (
        <ConfirmDeleteOverlay
          isDeleting={isDeleting}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

export { EMPTY_FORM };
