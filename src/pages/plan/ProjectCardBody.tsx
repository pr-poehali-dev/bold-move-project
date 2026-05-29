import Icon from "@/components/ui/icon";
import { PlanProject } from "./usePlanProjects";
import ProjectStatusBadge from "./ProjectStatusBadge";

interface Props {
  project: PlanProject;
  onSelect: (p: PlanProject) => void;
  onStartEdit: (p: PlanProject) => void;
  onExport: (p: PlanProject) => void;
  onMaterials: (p: PlanProject) => void;
  onCrm?: (p: PlanProject) => void;
  onQuickStatus?: (id: number, status: string) => void;
}

export default function ProjectCardBody({
  project, onSelect, onStartEdit, onExport, onMaterials, onCrm, onQuickStatus,
}: Props) {
  return (
    <div className="flex">
      {/* Статус — long-press открывает быстрый пикер */}
      <ProjectStatusBadge project={project} onQuickStatus={onQuickStatus} />

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
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <Icon name="LayoutDashboard" size={16} style={{ color: "rgba(255,255,255,0.8)" }} />
                <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>CRM</span>
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
        </div>
      </div>
    </div>
  );
}
