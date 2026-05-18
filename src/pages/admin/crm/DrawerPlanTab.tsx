import { useEffect, useState, useRef } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { getSvgDataUrl } from "@/pages/plan/planExport";
import type { PlanState } from "@/pages/plan/planTypes";
import type { PlanRoom, PlanProject } from "./PlanRoomTypes";
import { THUMBNAIL_MAX } from "./PlanRoomTypes";
import PlanRoomCard from "./PlanRoomCard";
import PlanSharePanel from "./PlanSharePanel";
import PlanRoomFullscreen from "./PlanRoomFullscreen";

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

  // Sharing
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [shareMode, setShareMode] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Pinch zoom state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

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
      rebuildThumbnails(roomsData);
      setSelectedIds(new Set(roomsData.map(r => r.id)));
    }).finally(() => setLoading(false));
  }, [chatId, projectId]);  

  const rebuildThumbnails = async (roomList: PlanRoom[]) => {
    for (const room of roomList) {
      if (rebuiltRef.current.has(room.id)) continue;
      rebuiltRef.current.add(room.id);
      const planData = (room.active_variant_data ?? room.data) as PlanState | undefined;
      if (!planData?.points || planData.points.length < 2) continue;
      try {
        const newThumb = getSvgDataUrl(planData, 0.4, true).slice(0, THUMBNAIL_MAX);
        if (!newThumb) continue;
        setRooms(prev => prev.map(r =>
          r.id === room.id
            ? room.active_variant_id
              ? { ...r, active_variant_thumbnail: newThumb }
              : { ...r, thumbnail: newThumb }
            : r
        ));
        setFullscreenRoom(prev => prev?.id === room.id ? { ...prev, thumbnail: newThumb } : prev);
        if (room.active_variant_id) {
          await crmFetch("plan-variants", { method: "PUT", body: JSON.stringify({ thumbnail: newThumb }) }, { id: String(room.active_variant_id) });
        } else {
          await crmFetch("plan-rooms", { method: "PUT", body: JSON.stringify({ thumbnail: newThumb }) }, { id: String(room.id) });
        }
      } catch { /* ignore */ }
    }
  };

  const openInPlan = () => {
    window.open(`/plan${projectId ? `?project_id=${projectId}` : ""}`, "_blank");
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleShare = async () => {
    if (selectedIds.size === 0) return;
    setSharing(true);
    try {
      const res = await crmFetch("plan-share", {
        method: "POST",
        body: JSON.stringify({
          room_ids: Array.from(selectedIds),
          chat_id: chatId,
          title: project?.client_name ? `Чертежи — ${project.client_name}` : "Чертежи",
        }),
      }) as { token?: string };
      if (res.token) {
        setShareUrl(`${window.location.origin}/plan-share/${res.token}`);
      }
    } finally {
      setSharing(false);
    }
  };

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openRoom = (room: PlanRoom) => {
    setZoom(1); setPanX(0); setPanY(0); setFullscreenRoom(room);
  };

  const activateShareMode = (roomId: number) => {
    setShareMode(true);
    setSelectedIds(new Set([roomId]));
  };

  const cancelShareMode = () => {
    setShareMode(false);
    setShareUrl(null);
    setSelectedIds(new Set(rooms.map(r => r.id)));
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
        <p className="text-sm font-medium" style={{ color: t.textMute }}>Проект в построителе не привязан</p>
        <p className="text-xs" style={{ color: t.textMute, opacity: 0.6 }}>
          Создайте проект в построителе — он автоматически свяжется с этой заявкой
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">

      {/* Кнопки управления */}
      <div className="flex gap-2">
        <button
          onClick={openInPlan}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition hover:brightness-110 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff" }}
        >
          <Icon name="Layers2" size={15} />
          В построителе
        </button>
        <button
          onClick={() => { setShareMode(m => !m); setShareUrl(null); }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition hover:brightness-110 active:scale-[0.98]"
          style={{
            background: shareMode ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.07)",
            color: shareMode ? "#a78bfa" : t.textMute,
            border: shareMode ? "1px solid rgba(124,58,237,0.4)" : `1px solid ${t.border}`,
          }}
        >
          <Icon name="Share2" size={15} />
          Поделиться
        </button>
      </div>

      {/* Панель шаринга */}
      {shareMode && (
        <PlanSharePanel
          selectedCount={selectedIds.size}
          totalCount={rooms.length}
          shareUrl={shareUrl}
          sharing={sharing}
          copied={copied}
          onShare={handleShare}
          onCopyLink={copyLink}
          onResetUrl={() => setShareUrl(null)}
        />
      )}

      {/* Список комнат */}
      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <Icon name="FileQuestion" size={28} style={{ color: t.textMute }} />
          <p className="text-xs" style={{ color: t.textMute }}>Комнаты ещё не добавлены</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: t.textMute }}>
              Чертежи ({rooms.length})
            </p>
            {shareMode && (
              <button
                onClick={cancelShareMode}
                className="text-[11px] font-semibold transition"
                style={{ color: t.textMute }}
              >
                Отменить
              </button>
            )}
          </div>
          {!shareMode && (
            <p className="text-[11px] md:hidden" style={{ color: t.textMute, opacity: 0.5 }}>
              Удерживайте карточку чтобы выбрать
            </p>
          )}
          {rooms.map(room => (
            <PlanRoomCard
              key={room.id}
              room={room}
              isSelected={selectedIds.has(room.id)}
              shareMode={shareMode}
              onOpen={openRoom}
              onToggleSelect={toggleSelect}
              onActivateShareMode={activateShareMode}
            />
          ))}
        </div>
      )}

      {/* Fullscreen просмотр с pinch-zoom */}
      {fullscreenRoom && (
        <PlanRoomFullscreen
          room={fullscreenRoom}
          zoom={zoom}
          panX={panX}
          panY={panY}
          onZoomIn={() => setZoom(z => Math.min(5, z * 1.3))}
          onZoomOut={() => setZoom(z => Math.max(0.5, z / 1.3))}
          onZoomReset={() => { setZoom(1); setPanX(0); setPanY(0); }}
          onSetZoom={setZoom}
          onSetPanX={setPanX}
          onSetPanY={setPanY}
          onClose={() => setFullscreenRoom(null)}
          onOpenInPlan={openInPlan}
        />
      )}
    </div>
  );
}
