import { useEffect, useState, useRef } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { getSvgDataUrlAsync } from "@/pages/plan/planExport";
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

  // View mode: 1 = большие карточки, 2 = сетка
  const [viewMode, setViewMode] = useState<1 | 2>(1);
  // Настройки превью
  const [darkBg,     setDarkBg]     = useState(false);
  const [showImages, setShowImages] = useState(false);

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

  const rebuildThumbnails = async (roomList: PlanRoom[], useDark = darkBg, useImages = showImages) => {
    for (const room of roomList) {
      if (rebuiltRef.current.has(room.id)) continue;
      rebuiltRef.current.add(room.id);
      const planData = (room.active_variant_data ?? room.data) as PlanState | undefined;
      if (!planData?.points || planData.points.length < 2) continue;
      try {
        const newThumb = (await getSvgDataUrlAsync(planData, 0.4, true, useDark, useImages)).slice(0, THUMBNAIL_MAX);
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

  // Пересчитать превью при смене настроек отображения
  const rebuildWithSettings = (useDark: boolean, useImages: boolean) => {
    rebuiltRef.current.clear();
    setRooms(prev => prev.map(r => ({ ...r, thumbnail: null, active_variant_thumbnail: null })));
    setTimeout(() => {
      setRooms(prev => {
        rebuildThumbnails(prev, useDark, useImages);
        return prev;
      });
    }, 50);
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
          room_ids: Array.from(selectedIds).map(Number),
          chat_id: chatId,
          title: project?.client_name ? `Чертежи — ${project.client_name}` : "Чертежи",
        }),
      }) as { token?: string; error?: string };
      if (res.token) {
        setShareUrl(`${window.location.origin}/plan-share/${res.token}`);
      }
    } catch (e) {
      console.error("handleShare error", e);
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
    <div className="flex flex-col gap-3 p-4" onContextMenu={e => e.preventDefault()}>

      {/* Панель управления */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* В построителе — компактнее */}
        <button
          onClick={openInPlan}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition hover:brightness-110 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff" }}
        >
          <Icon name="Layers2" size={13} />
          В построителе
        </button>

        {/* Все переключатели в одной группе */}
        <div className="flex rounded-xl overflow-hidden flex-1" style={{ border: `1px solid ${t.border}` }}>
          {/* Вид 1 */}
          <button
            onClick={() => setViewMode(1)}
            className="flex items-center justify-center px-2.5 py-2 text-[10px] font-bold transition flex-1"
            style={{
              background: viewMode === 1 ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
              color: viewMode === 1 ? "#a78bfa" : t.textMute,
              borderRight: `1px solid ${t.border}`,
            }}
            title="Вид 1 — большие карточки"
          >
            <Icon name="LayoutList" size={12} />
          </button>
          {/* Вид 2 */}
          <button
            onClick={() => setViewMode(2)}
            className="flex items-center justify-center px-2.5 py-2 text-[10px] font-bold transition flex-1"
            style={{
              background: viewMode === 2 ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
              color: viewMode === 2 ? "#a78bfa" : t.textMute,
              borderRight: `1px solid ${t.border}`,
            }}
            title="Вид 2 — сетка"
          >
            <Icon name="LayoutGrid" size={12} />
          </button>
          {/* Тёмный/светлый фон */}
          <button
            onClick={() => {
              const next = !darkBg;
              setDarkBg(next);
              rebuildWithSettings(next, showImages);
            }}
            className="flex items-center justify-center px-2.5 py-2 text-[10px] font-bold transition flex-1"
            style={{
              background: darkBg ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
              color: darkBg ? "#a78bfa" : t.textMute,
              borderRight: `1px solid ${t.border}`,
            }}
            title={darkBg ? "Светлый фон" : "Тёмный фон"}
          >
            <Icon name={darkBg ? "Moon" : "Sun"} size={12} />
          </button>
          {/* Текст / Картинки товаров */}
          <button
            onClick={() => {
              const next = !showImages;
              setShowImages(next);
              rebuildWithSettings(darkBg, next);
            }}
            className="flex items-center justify-center px-2.5 py-2 text-[10px] font-bold transition flex-1"
            style={{
              background: showImages ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
              color: showImages ? "#a78bfa" : t.textMute,
              borderRight: `1px solid ${t.border}`,
            }}
            title={showImages ? "Показать текст" : "Показать картинки товаров"}
          >
            <Icon name={showImages ? "Image" : "Type"} size={12} />
          </button>
          {/* Поделиться */}
          <button
            onClick={() => {
              setShareMode(m => {
                if (!m && selectedIds.size === 0) setSelectedIds(new Set(rooms.map(r => r.id)));
                return !m;
              });
              setShareUrl(null);
            }}
            className="flex items-center justify-center px-2.5 py-2 text-[10px] font-bold transition flex-1"
            style={{
              background: shareMode ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
              color: shareMode ? "#a78bfa" : t.textMute,
            }}
            title="Поделиться"
          >
            <Icon name="Share2" size={12} />
          </button>
        </div>
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
      ) : viewMode === 1 ? (
        /* ── Вид 1: большие карточки, белый фон превью ── */
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: t.textMute }}>
              Чертежи ({rooms.length})
            </p>
            {shareMode && (
              <button
                onClick={() => { setShareMode(false); setShareUrl(null); setSelectedIds(new Set(rooms.map(r => r.id))); }}
                className="text-[11px] font-semibold"
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
              darkBg={false}
              onOpen={openRoom}
              onToggleSelect={toggleSelect}
              onActivateShareMode={activateShareMode}
            />
          ))}
        </div>
      ) : (
        /* ── Вид 2: сетка 2 колонки, тёмный фон как в построителе ── */
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: t.textMute }}>
            Чертежи ({rooms.length})
          </p>
          <div className="grid grid-cols-2 gap-3">
            {rooms.map(room => (
              <PlanRoomCard
                key={room.id}
                room={room}
                isSelected={selectedIds.has(room.id)}
                shareMode={shareMode}
                darkBg={true}
                onOpen={openRoom}
                onToggleSelect={toggleSelect}
                onActivateShareMode={activateShareMode}
              />
            ))}
          </div>
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