import { useState } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject } from "./usePlanProjects";

interface Props {
  project: PlanProject;
  isEditing: boolean;
  onCreateLink?: (p: PlanProject) => void;
  onAttachLink?: (p: PlanProject) => void;
}

export default function ProjectCardBadges({ project, isEditing, onCreateLink, onAttachLink }: Props) {
  const [showLinkMenu, setShowLinkMenu] = useState(false);

  return (
    <>
      {/* Бейдж количества комнат — правый верхний угол */}
      {!isEditing && (project.rooms_count ?? 0) > 0 && (
        <span
          className="absolute flex items-center gap-0.5 px-2 py-1 rounded-bl-xl text-[10px] font-bold z-10"
          style={{ top: 0, right: 0, background: "rgba(124,58,237,0.22)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)", borderTop: "none", borderRight: "none" }}
        >
          <Icon name="Layers" size={9} />
          {project.rooms_count}шт
        </span>
      )}

      {/* Бейдж «привязан к заявке» — правый нижний угол */}
      {!isEditing && project.crm_chat_id && (
        <button
          title={`Открыть заявку CRM #${project.crm_chat_id}`}
          onClick={e => { e.stopPropagation(); window.open(`/crm?order=${project.crm_chat_id}`, "_blank"); }}
          className="absolute flex items-center gap-0.5 px-2 py-1 rounded-tl-xl text-[10px] font-bold z-10 transition hover:brightness-125 active:scale-95"
          style={{ bottom: 0, right: 0, background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)", borderBottom: "none", borderRight: "none" }}
        >
          <Icon name="CheckCircle" size={9} />
          CRM
        </button>
      )}

      {/* Бейдж «не привязан к заявке» — правый нижний угол */}
      {!isEditing && !project.crm_chat_id && (onCreateLink || onAttachLink) && (
        <button
          title="Привязать к заявке"
          onClick={e => { e.stopPropagation(); setShowLinkMenu(v => !v); }}
          className="absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded-tl-xl text-[9px] font-bold z-10 transition hover:brightness-125 active:scale-95"
          style={{ bottom: 0, right: 0, background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", borderBottom: "none", borderRight: "none" }}
        >
          <Icon name="TriangleAlert" size={9} />
          CRM
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
    </>
  );
}
