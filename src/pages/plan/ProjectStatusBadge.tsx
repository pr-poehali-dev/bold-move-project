import { PlanProject } from "./usePlanProjects";
import { STATUSES, STATUS_COLORS } from "./PlanProjectsConstants";

interface Props {
  project: PlanProject;
}

export default function ProjectStatusBadge({ project }: Props) {
  const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;
  const label = STATUSES.find(s => s.id === project.status)?.label ?? project.status;
  const fontSize = label.length > 12 ? 8 : label.length > 8 ? 9 : 10;

  return (
    <div className="relative flex-shrink-0 self-stretch">
      <div
        className="flex items-center justify-center w-12 h-full px-1 py-3 overflow-hidden select-none"
        style={{ background: `linear-gradient(to right, ${sc.glow ?? sc.bg}, transparent)` }}
      >
        <span
          className="font-bold uppercase"
          style={{ color: sc.text, writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize, letterSpacing: "0.08em" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
