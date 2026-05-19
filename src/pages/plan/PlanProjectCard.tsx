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
  onCrm?: (p: PlanProject) => void;
  onCreateLink?: (p: PlanProject) => void;
  onAttachLink?: (p: PlanProject) => void;
}

const SNAP_WIDTH = 88;
const THRESHOLD = 44;

function vibe(ms: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

export default function PlanProjectCard({
  project, editingId, deletingId, form, setForm, saving, error,
  onSelect, onStartEdit, onCancelEdit, onUpdate, onDelete, onExport, onMaterials, onCrm,
  onCreateLink, onAttachLink,
}: Props) {
  const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;
  const isEditing = editingId === project.id;
  const isDeleting = deletingId === project.id;

  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);

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
      style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Бейдж количества комнат — правый верхний угол */}
      {!isEditing && (project.rooms_count ?? 0) > 0 && (
        <span
          className="absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded-bl-xl text-[9px] font-bold z-10"
          style={{ top: 0, right: 0, background: "rgba(124,58,237,0.22)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)", borderTop: "none", borderRight: "none" }}
        >
          <Icon name="Layers" size={8} />
          {project.rooms_count}шт
        </span>
      )}

      {/* Бейдж «привязан к заявке» — левый верхний угол */}
      {!isEditing && project.crm_chat_id && (
        <button
          title={`Открыть заявку CRM #${project.crm_chat_id}`}
          onClick={e => { e.stopPropagation(); window.open(`/crm?order=${project.crm_chat_id}`, "_blank"); }}
          className="absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded-br-xl text-[9px] font-bold z-10 transition hover:brightness-125 active:scale-95"
          style={{ top: 0, left: 0, background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)", borderTop: "none", borderLeft: "none" }}
        >
          <Icon name="CheckCircle" size={9} />
          CRM
        </button>
      )}

      {/* Бейдж «не привязан к заявке» — левый верхний угол */}
      {!isEditing && !project.crm_chat_id && (onCreateLink || onAttachLink) && (
        <button
          title="Привязать к заявке"
          onClick={e => { e.stopPropagation(); setShowLinkMenu(v => !v); }}
          className="absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded-br-xl text-[9px] font-bold z-10 transition hover:brightness-125 active:scale-95"
          style={{ top: 0, left: 0, background: "rgba(234,179,8,0.18)", color: "#facc15", border: "1px solid rgba(234,179,8,0.3)", borderTop: "none", borderLeft: "none" }}
        >
          <Icon name="TriangleAlert" size={9} />
          без заявки
        </button>
      )}
      {/* Мини-меню привязки */}
      {showLinkMenu && !isEditing && (
        <div
          className="absolute z-30 flex flex-col gap-1 p-2 rounded-xl shadow-2xl"
          style={{ top: 26, left: 0, minWidth: 210, background: "#13131f", border: "1px solid rgba(234,179,8,0.25)" }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wide px-1 pb-1" style={{ color: "rgba(250,204,21,0.7)" }}>
            Привязать к заявке CRM
          </div>
          {onCreateLink && (
            <button
              onClick={e => { e.stopPropagation(); setShowLinkMenu(false); onCreateLink(project); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition hover:brightness-110 active:scale-[0.98] text-left"
              style={{ background: "rgba(124,58,237,0.18)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.25)" }}
            >
              <Icon name="Plus" size={13} />
              Создать новую заявку
            </button>
          )}
          {onAttachLink && (
            <button
              onClick={e => { e.stopPropagation(); setShowLinkMenu(false); onAttachLink(project); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition hover:brightness-110 active:scale-[0.98] text-left"
              style={{ background: "rgba(234,179,8,0.12)", color: "#fde68a", border: "1px solid rgba(234,179,8,0.2)" }}
            >
              <Icon name="Link" size={13} />
              Привязать существующую
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); setShowLinkMenu(false); }}
            className="text-[11px] text-center pt-0.5 pb-1 transition"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Отмена
          </button>
        </div>
      )}

      {/* ── Форма редактирования (вместо карточки) ── */}
      {isEditing && (
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
        <div className="flex">
          {/* Статус */}
          {(() => {
            const label = STATUSES.find(s => s.id === project.status)?.label ?? project.status;
            const fontSize = label.length > 12 ? 8 : label.length > 8 ? 9 : 10;
            return (
              <div
                className="flex-shrink-0 flex items-center justify-center w-12 self-stretch px-1 py-3 overflow-hidden"
                style={{ background: `linear-gradient(to right, ${sc.glow ?? sc.bg}, transparent)` }}
              >
                <span
                  className="font-bold uppercase select-none"
                  style={{ color: sc.text, writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize, letterSpacing: "0.08em" }}
                >
                  {label}
                </span>
              </div>
            );
          })()}

          {/* Правая часть */}
          <div className="flex-1 min-w-0">
            <div className="px-4 py-3.5 flex items-center gap-3" style={{ minHeight: 130 }}>
              <button
                className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-90 transition active:scale-[0.99]"
                onClick={() => onSelect(project)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center mb-1.5 min-w-0">
                    <span className="text-white font-bold text-[14px] leading-snug">{project.name}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    {project.client_name && (
                      <span className="flex items-start gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                        <Icon name="User" size={11} className="flex-shrink-0 mt-0.5" />
                        <span>{project.client_name}</span>
                      </span>
                    )}
                    {project.address && (
                      <span className="flex items-start gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                        <Icon name="MapPin" size={11} className="flex-shrink-0 mt-0.5" />
                        <span>{project.address}</span>
                      </span>
                    )}
                    {project.phone && (
                      <span className="flex items-start gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                        <Icon name="Phone" size={11} className="flex-shrink-0 mt-0.5" />
                        <span>{project.phone}</span>
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <div className="flex-shrink-0 flex flex-row gap-1">
                <button
                  onClick={() => onExport(project)}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-xl transition hover:brightness-110 active:scale-95"
                  style={{ width: 46, height: 46, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Icon name="FileDown" size={16} style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Смета</span>
                </button>
                <button
                  onClick={() => onMaterials(project)}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-xl transition hover:brightness-110 active:scale-95"
                  style={{ width: 46, height: 46, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Icon name="ClipboardList" size={16} style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Состав</span>
                </button>
                {onCrm && (
                  <button
                    onClick={() => onCrm(project)}
                    className="flex flex-col items-center justify-center gap-0.5 rounded-xl transition hover:brightness-110 active:scale-95"
                    style={{
                      width: 46, height: 46,
                      background: project.crm_chat_id ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${project.crm_chat_id ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    <Icon name="LayoutDashboard" size={16} style={{ color: project.crm_chat_id ? "#a78bfa" : "rgba(255,255,255,0.8)" }} />
                    <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: project.crm_chat_id ? "#a78bfa" : "rgba(255,255,255,0.55)" }}>CRM</span>
                  </button>
                )}
              </div>
            </div>

            {/* ПК-кнопки — скрыты на touch через CSS media */}
            <div className="hidden-on-touch flex border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
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
          </div>
        </div>
      </div>

      {/* ── Подтверждение: Изменить ── */}
      {confirmEdit && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-3 z-20 rounded-2xl"
          style={{ background: "rgba(8,8,18,0.96)", backdropFilter: "blur(4px)" }}
        >
          <Icon name="Pencil" size={16} style={{ color: "#a78bfa" }} />
          <span className="text-white/85 text-[13px] font-semibold">Редактировать проект?</span>
          <button
            onClick={doEdit}
            className="px-4 py-1.5 rounded-xl text-[12px] font-bold transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff" }}
          >
            Да
          </button>
          <button
            onClick={() => setConfirmEdit(false)}
            className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition"
            style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Отмена
          </button>
        </div>
      )}

      {/* ── Подтверждение: Удалить ── */}
      {confirmDelete && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-3 z-20 rounded-2xl"
          style={{ background: "rgba(8,8,18,0.96)", backdropFilter: "blur(4px)" }}
        >
          <Icon name="AlertTriangle" size={16} style={{ color: "#f87171" }} />
          <span className="text-white/85 text-[13px] font-semibold">Удалить проект?</span>
          <button
            onClick={doDelete}
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