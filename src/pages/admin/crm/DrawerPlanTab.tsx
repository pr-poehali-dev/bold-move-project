import { useEffect, useState } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface PlanRoom {
  id: number;
  name: string;
  thumbnail: string | null;
  include_in_estimate: boolean;
  active_variant_id: number | null;
  active_variant_name: string | null;
  active_variant_thumbnail: string | null;
}

interface PlanProject {
  name: string;
  client_name: string | null;
  address: string | null;
  phone: string | null;
  status: string;
}

interface Props {
  chatId: number;
  projectId: number | null | undefined;
}

export default function DrawerPlanTab({ chatId, projectId }: Props) {
  const t = useTheme();
  const [rooms, setRooms] = useState<PlanRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<PlanProject | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      crmFetch("plan-rooms-by-chat", undefined, { chat_id: String(chatId) })
        .then(r => Array.isArray(r) ? r as PlanRoom[] : [])
        .catch(() => []),
      projectId
        ? crmFetch("plan-crm-sync", undefined, { project_id: String(projectId) })
            .then(r => r as PlanProject)
            .catch(() => null)
        : Promise.resolve(null),
    ]).then(([roomsData, projectData]) => {
      setRooms(roomsData);
      setProject(projectData);
    }).finally(() => setLoading(false));
  }, [chatId, projectId]);

  const openInPlan = () => {
    window.open(`/plan${projectId ? `?project_id=${projectId}` : ""}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
        <Icon name="Layers2" size={32} style={{ color: t.textMute }} />
        <p className="text-sm font-medium" style={{ color: t.textMute }}>
          Проект в построителе не привязан
        </p>
        <p className="text-xs" style={{ color: t.textMute, opacity: 0.6 }}>
          Создайте проект в построителе — он автоматически свяжется с этой заявкой
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* Кнопка открыть в построителе */}
      <button
        onClick={openInPlan}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition hover:brightness-110 active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg,#6d28d9,#7c3aed)",
          color: "#fff",
        }}
      >
        <Icon name="Layers2" size={16} />
        Открыть в построителе
      </button>

      {/* Данные проекта */}
      {project && (
        <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: t.textMute }}>Проект</p>
          <p className="text-sm font-semibold" style={{ color: t.text }}>{project.name}</p>
          {project.client_name && (
            <div className="flex items-center gap-2 text-xs" style={{ color: t.textMute }}>
              <Icon name="User" size={12} />
              {project.client_name}
            </div>
          )}
          {project.address && (
            <div className="flex items-center gap-2 text-xs" style={{ color: t.textMute }}>
              <Icon name="MapPin" size={12} />
              {project.address}
            </div>
          )}
          {project.phone && (
            <div className="flex items-center gap-2 text-xs" style={{ color: t.textMute }}>
              <Icon name="Phone" size={12} />
              {project.phone}
            </div>
          )}
        </div>
      )}

      {/* Список комнат / чертежей */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: t.textMute }}>
          Чертежи ({rooms.length})
        </p>
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <Icon name="FileQuestion" size={24} style={{ color: t.textMute }} />
            <p className="text-xs" style={{ color: t.textMute }}>Комнаты ещё не добавлены</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map(room => {
              const thumb = room.active_variant_thumbnail || room.thumbnail;
              return (
                <div
                  key={room.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: t.cardBg, border: `1px solid ${t.border}` }}
                >
                  {/* Превью */}
                  <div
                    className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                    style={{ width: 56, height: 56, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}
                  >
                    {thumb ? (
                      <img src={thumb} alt={room.name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon name="LayoutDashboard" size={20} style={{ color: "#7c3aed", opacity: 0.5 }} />
                    )}
                  </div>

                  {/* Инфо */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: t.text }}>{room.name}</p>
                    {room.active_variant_name && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: t.textMute }}>
                        Вариант: {room.active_variant_name}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{
                          background: room.include_in_estimate ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)",
                          color: room.include_in_estimate ? "#10b981" : t.textMute,
                        }}
                      >
                        {room.include_in_estimate ? "В смете" : "Не в смете"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}