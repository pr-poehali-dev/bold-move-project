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

export default function PlanProjectCard({
  project, editingId, deletingId, form, setForm, saving, error,
  onSelect, onStartEdit, onCancelEdit, onUpdate, onDelete, onExport, onMaterials,
}: Props) {
  const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;
  const isEditing = editingId === project.id;
  const isDeleting = deletingId === project.id;

  if (isEditing) {
    return (
      <div key={project.id}>
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
      className="rounded-2xl overflow-hidden transition group flex"
      style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Статус — вертикальная полоска слева */}
      <div className="flex-shrink-0 flex items-center justify-center w-12 self-stretch px-1"
        style={{ background: `linear-gradient(to right, ${sc.glow ?? sc.bg}, transparent)` }}>
        <span className="font-bold uppercase whitespace-nowrap select-none"
          style={{ color: sc.text, writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, letterSpacing: "0.1em" }}>
          {STATUSES.find(s => s.id === project.status)?.label ?? project.status}
        </span>
      </div>

      {/* Правая часть */}
      <div className="flex-1 min-w-0">
        {/* Основная строка */}
        <div className="px-4 py-3.5 flex items-center gap-3">
          <button
            className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-90 transition active:scale-[0.99]"
            onClick={() => onSelect(project)}
          >
            {/* Данные */}
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

          {/* Две кнопки справа */}
          <div className="flex-shrink-0 flex flex-col gap-1.5">
            {/* Скачать смету */}
            <button
              onClick={() => onExport(project)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
              style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              title="Скачать смету"
            >
              <Icon name="FileDown" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
              <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Смета</span>
            </button>
            {/* Материалы */}
            <button
              onClick={() => onMaterials(project)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
              style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              title="Материалы"
            >
              <Icon name="ClipboardList" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
              <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Состав</span>
            </button>
          </div>
        </div>

        {/* Кнопки действий */}
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
  );
}

export { EMPTY_FORM };
