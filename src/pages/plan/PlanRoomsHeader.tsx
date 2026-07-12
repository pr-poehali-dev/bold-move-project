import { useState } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject } from "./usePlanProjects";
import PlanRoomsStatsModal from "./PlanRoomsStatsModal";
import PlanRoomPhotosModal from "./PlanRoomPhotosModal";

interface Stats {
  totalRooms: number;
  totalArea: number;
  roomsWithEmptyWalls: number;
}

interface Props {
  project: PlanProject;
  token?: string | null;
  stats: Stats;
  onBack: () => void;
  onExportClick: () => void;
  onAddRoomClick: () => void;
}

// ── Шапка экрана комнат: назад, название проекта, статистика, кнопки действий ──
export default function PlanRoomsHeader({ project, token, stats, onBack, onExportClick, onAddRoomClick }: Props) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 sm:px-8 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <button
        onClick={onBack}
        className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:bg-white/10"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        <Icon name="ChevronLeft" size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-white font-bold text-[15px] truncate">{project.name}</div>
        {(project.client_name || project.address) && (
          <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
            {[project.client_name, project.address].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      {/* Статистика по проекту — мобиле: одна кнопка-иконка, открывает модалку */}
      {stats.totalRooms > 0 && (
        <button
          onClick={() => setStatsOpen(true)}
          className="flex md:hidden items-center justify-center w-9 h-9 rounded-xl transition hover:brightness-110 active:scale-95 flex-shrink-0"
          style={{
            background: stats.roomsWithEmptyWalls > 0 ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
            border: stats.roomsWithEmptyWalls > 0 ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(255,255,255,0.08)",
          }}
          title="Статистика проекта"
        >
          <Icon name="Info" size={16} style={{ color: stats.roomsWithEmptyWalls > 0 ? "#fbbf24" : "rgba(255,255,255,0.5)" }} />
        </button>
      )}

      {/* Статистика по проекту — только когда есть комнаты */}
      {stats.totalRooms > 0 && (
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 h-9 rounded-xl"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            title="Всего полотен в проекте">
            <Icon name="Layers" size={13} style={{ color: "rgba(255,255,255,0.4)" }} />
            <span className="text-[12px] font-bold text-white/70">{stats.totalRooms}</span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>полотен</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 h-9 rounded-xl"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            title="Суммарная площадь всех комнат">
            <Icon name="Ruler" size={13} style={{ color: "rgba(255,255,255,0.4)" }} />
            <span className="text-[12px] font-bold text-white/70">{stats.totalArea}</span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>м²</span>
          </div>
          {stats.roomsWithEmptyWalls > 0 ? (
            <div className="flex items-center gap-1.5 px-3 h-9 rounded-xl"
              style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)" }}
              title="Комнаты с незаполненными стенами (без товара)">
              <Icon name="AlertTriangle" size={13} style={{ color: "#fbbf24" }} />
              <span className="text-[12px] font-bold" style={{ color: "#fbbf24" }}>{stats.roomsWithEmptyWalls}</span>
              <span className="text-[11px]" style={{ color: "rgba(251,191,36,0.7)" }}>не назначено</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 h-9 rounded-xl"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}
              title="Все стены назначены">
              <Icon name="CheckCircle2" size={13} style={{ color: "#34d399" }} />
              <span className="text-[11px] font-semibold" style={{ color: "#34d399" }}>Все стены назначены</span>
            </div>
          )}
        </div>
      )}

      {/* Фото проекта — десктоп: отдельная кнопка рядом со статистикой (на мобиле фото внутри модалки статистики) */}
      <button
        onClick={() => setPhotosOpen(true)}
        className="hidden md:flex items-center gap-1.5 px-3 h-9 rounded-xl transition hover:brightness-110 active:scale-95 flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
        title="Фото проекта"
      >
        <Icon name="Camera" size={13} />
        <span className="text-[11px] font-semibold">Фото</span>
      </button>

      {/* Кнопка CRM */}
      {project.crm_chat_id && (
        <button
          onClick={() => window.open(`/crm?order=${project.crm_chat_id}`, "_blank")}
          className="flex items-center gap-1.5 px-3 h-9 rounded-xl transition hover:brightness-110 active:scale-95 flex-shrink-0"
          style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa" }}
          title="Открыть заявку в CRM"
        >
          <Icon name="LayoutDashboard" size={14} />
          {/* CRM — только на десктопе */}
          <span className="text-[11px] font-bold uppercase tracking-wide hidden sm:inline">CRM</span>
        </button>
      )}
      {/* Кнопка сметы — десктоп: со стилем CRM + подпись "Скачать", мобил: только иконка в стиле CRM */}
      <button
        onClick={onExportClick}
        className="flex items-center gap-1.5 px-3 h-9 rounded-xl transition hover:brightness-110 active:scale-95 flex-shrink-0"
        style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa" }}
        title="Скачать смету"
      >
        <Icon name="FileText" size={14} />
        <span className="text-[11px] font-bold hidden sm:inline">Скачать</span>
      </button>
      <button
        onClick={onAddRoomClick}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition hover:opacity-90 active:scale-[0.97] flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
      >
        <Icon name="Plus" size={13} />
        Комната
      </button>

      {statsOpen && (
        <PlanRoomsStatsModal
          stats={stats}
          projectId={project.id}
          token={token}
          onClose={() => setStatsOpen(false)}
        />
      )}

      {photosOpen && (
        <PlanRoomPhotosModal
          projectId={project.id}
          token={token}
          onClose={() => setPhotosOpen(false)}
        />
      )}
    </div>
  );
}