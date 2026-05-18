import { useEffect, useState, useRef } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { getSvgDataUrl } from "@/pages/plan/planExport";
import type { PlanState } from "@/pages/plan/planTypes";

const THUMBNAIL_MAX = 8000;

interface PlanRoom {
  id: number;
  name: string;
  thumbnail: string | null;
  data?: object;
  include_in_estimate: boolean;
  active_variant_id: number | null;
  active_variant_name: string | null;
  active_variant_thumbnail: string | null;
  active_variant_data?: object | null;
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
  const [fullscreenRoom, setFullscreenRoom] = useState<PlanRoom | null>(null);
  const rebuiltRef = useRef<Set<number>>(new Set());

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
      // Пересчитываем thumbnails из данных чертежа (один раз за сессию)
      rebuildThumbnails(roomsData);
    }).finally(() => setLoading(false));
  }, [chatId, projectId]);  

  const rebuildThumbnails = async (roomList: PlanRoom[]) => {
    for (const room of roomList) {
      if (rebuiltRef.current.has(room.id)) continue;
      rebuiltRef.current.add(room.id);

      // Используем данные активного варианта или основные данные
      const planData = (room.active_variant_data ?? room.data) as PlanState | undefined;
      if (!planData?.points || planData.points.length < 2) continue;

      try {
        const newThumb = getSvgDataUrl(planData, 0.4, true).slice(0, THUMBNAIL_MAX);
        if (!newThumb) continue;

        // Обновляем превью локально
        setRooms(prev => prev.map(r =>
          r.id === room.id
            ? room.active_variant_id
              ? { ...r, active_variant_thumbnail: newThumb }
              : { ...r, thumbnail: newThumb }
            : r
        ));
        setFullscreenRoom(prev => prev?.id === room.id ? { ...prev, thumbnail: newThumb } : prev);

        // Сохраняем в базу
        if (room.active_variant_id) {
          await crmFetch("plan-variants", {
            method: "PUT",
            body: JSON.stringify({ thumbnail: newThumb }),
          }, { id: String(room.active_variant_id) });
        } else {
          await crmFetch("plan-rooms", {
            method: "PUT",
            body: JSON.stringify({ thumbnail: newThumb }),
          }, { id: String(room.id) });
        }
      } catch { /* тихо игнорируем */ }
    }
  };

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

  const thumb = (room: PlanRoom) => room.active_variant_thumbnail || room.thumbnail;

  return (
    <div className="flex flex-col gap-3 p-4">

      {/* Кнопка открыть в построителе */}
      <button
        onClick={openInPlan}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition hover:brightness-110 active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff" }}
      >
        <Icon name="Layers2" size={16} />
        Открыть в построителе
      </button>

      {/* Список комнат — крупные карточки */}
      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <Icon name="FileQuestion" size={28} style={{ color: t.textMute }} />
          <p className="text-xs" style={{ color: t.textMute }}>Комнаты ещё не добавлены</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: t.textMute }}>
            Чертежи ({rooms.length})
          </p>
          {rooms.map(room => {
            const preview = thumb(room);
            return (
              <button
                key={room.id}
                onClick={() => setFullscreenRoom(room)}
                className="rounded-2xl overflow-hidden text-left transition hover:brightness-110 active:scale-[0.99] w-full"
                style={{ background: t.cardBg, border: `1px solid ${t.border}` }}
              >
                {/* Превью на всю ширину */}
                <div
                  className="w-full flex items-center justify-center"
                  style={{ height: 180, background: "rgba(124,58,237,0.07)" }}
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt={room.name}
                      className="w-full h-full object-contain"
                      style={{ padding: 8 }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Icon name="LayoutDashboard" size={36} style={{ color: "#7c3aed" }} />
                      <span className="text-xs" style={{ color: t.textMute }}>Нет превью</span>
                    </div>
                  )}
                </div>

                {/* Подпись */}
                <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: t.text }}>{room.name}</p>
                    {room.active_variant_name && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: t.textMute }}>
                        {room.active_variant_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                      style={{
                        background: room.include_in_estimate ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)",
                        color: room.include_in_estimate ? "#10b981" : t.textMute,
                      }}
                    >
                      {room.include_in_estimate ? "В смете" : "Не в смете"}
                    </span>
                    <Icon name="Maximize2" size={13} style={{ color: t.textMute }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Fullscreen просмотр чертежа */}
      {fullscreenRoom && (
        <div
          className="fixed inset-0 z-[200] flex flex-col"
          style={{ background: "rgba(0,0,0,0.95)" }}
          onClick={() => setFullscreenRoom(null)}
        >
          {/* Шапка */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <p className="text-white font-semibold text-sm">{fullscreenRoom.name}</p>
              {fullscreenRoom.active_variant_name && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {fullscreenRoom.active_variant_name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openInPlan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:brightness-110"
                style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff" }}
              >
                <Icon name="ExternalLink" size={12} />
                В построителе
              </button>
              <button
                onClick={() => setFullscreenRoom(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-white/10"
              >
                <Icon name="X" size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
              </button>
            </div>
          </div>

          {/* Изображение */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={() => setFullscreenRoom(null)}>
            {thumb(fullscreenRoom) ? (
              <img
                src={thumb(fullscreenRoom)!}
                alt={fullscreenRoom.name}
                className="max-w-full max-h-full object-contain rounded-xl"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 opacity-40">
                <Icon name="LayoutDashboard" size={64} style={{ color: "#7c3aed" }} />
                <p className="text-white text-sm">Нет превью — откройте в построителе</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}