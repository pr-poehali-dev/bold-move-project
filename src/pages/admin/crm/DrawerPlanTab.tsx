import { useEffect, useState, useRef } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { getSvgDataUrl } from "@/pages/plan/planExport";
import type { PlanState } from "@/pages/plan/planTypes";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];
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
  const imgRef = useRef<HTMLImageElement>(null);
  const touch1 = useRef<Touch | null>(null);
  const touch2 = useRef<Touch | null>(null);
  const lastDist = useRef<number>(0);
  const lastPan = useRef<{ x: number; y: number } | null>(null);

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
      // По умолчанию все выбраны
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

  const thumb = (room: PlanRoom) => room.active_variant_thumbnail || room.thumbnail;

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
        const url = `${window.location.origin}/plan-share/${res.token}`;
        setShareUrl(url);
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

  // Pinch/pan handlers
  const resetZoom = () => { setZoom(1); setPanX(0); setPanY(0); };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touch1.current = e.touches[0];
      lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      touch1.current = e.touches[0];
      touch2.current = e.touches[1];
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastDist.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist / lastDist.current;
      setZoom(z => Math.min(5, Math.max(0.5, z * delta)));
      lastDist.current = dist;
    } else if (e.touches.length === 1 && lastPan.current && zoom > 1) {
      const dx = e.touches[0].clientX - lastPan.current.x;
      const dy = e.touches[0].clientY - lastPan.current.y;
      setPanX(x => x + dx);
      setPanY(y => y + dy);
      lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchEnd = () => {
    touch1.current = null;
    touch2.current = null;
    lastDist.current = 0;
    lastPan.current = null;
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
        <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)" }}>
          <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>
            Выбрано {selectedIds.size} из {rooms.length} чертежей
          </p>

          {shareUrl ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: t.textMute }}>Ссылка готова — отправьте клиенту:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 text-xs rounded-lg px-2 py-1.5 truncate"
                  style={{ background: "rgba(255,255,255,0.06)", color: t.text, border: `1px solid ${t.border}` }}
                />
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(124,58,237,0.3)", color: copied ? "#10b981" : "#a78bfa" }}
                >
                  <Icon name={copied ? "Check" : "Copy"} size={12} />
                  {copied ? "Скопировано" : "Копировать"}
                </button>
              </div>
              <button
                onClick={() => setShareUrl(null)}
                className="text-xs text-center"
                style={{ color: t.textMute }}
              >
                Создать новую ссылку
              </button>
            </div>
          ) : (
            <button
              onClick={handleShare}
              disabled={sharing || selectedIds.size === 0}
              className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              style={{ background: "rgba(124,58,237,0.3)", color: "#a78bfa" }}
            >
              {sharing
                ? <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                : <Icon name="Link" size={14} />}
              Создать ссылку
            </button>
          )}
        </div>
      )}

      {/* Список комнат */}
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
            const isSelected = selectedIds.has(room.id);
            return (
              <div key={room.id} className="relative">
                {/* Чекбокс выбора (в режиме шаринга) */}
                {shareMode && (
                  <button
                    onClick={() => toggleSelect(room.id)}
                    className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition"
                    style={{
                      background: isSelected ? "#7c3aed" : "rgba(0,0,0,0.5)",
                      border: `2px solid ${isSelected ? "#7c3aed" : "rgba(255,255,255,0.3)"}`,
                    }}
                  >
                    {isSelected && <Icon name="Check" size={12} style={{ color: "#fff" }} />}
                  </button>
                )}

                <button
                  onClick={() => { setZoom(1); setPanX(0); setPanY(0); setFullscreenRoom(room); }}
                  className="rounded-2xl overflow-hidden text-left transition hover:brightness-110 active:scale-[0.99] w-full"
                  style={{
                    background: t.cardBg,
                    border: shareMode && isSelected ? "2px solid #7c3aed" : `1px solid ${t.border}`,
                  }}
                >
                  <div className="w-full flex items-center justify-center" style={{ height: 180, background: "rgba(124,58,237,0.07)" }}>
                    {preview ? (
                      <img src={preview} alt={room.name} className="w-full h-full object-contain" style={{ padding: 8 }} />
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <Icon name="LayoutDashboard" size={36} style={{ color: "#7c3aed" }} />
                        <span className="text-xs" style={{ color: t.textMute }}>Нет превью</span>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: t.text }}>{room.name}</p>
                      {room.active_variant_name && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: t.textMute }}>{room.active_variant_name}</p>
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
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen просмотр с pinch-zoom */}
      {fullscreenRoom && (
        <div
          className="fixed inset-0 z-[200] flex flex-col"
          style={{ background: "rgba(0,0,0,0.97)", touchAction: "none" }}
        >
          {/* Шапка */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div>
              <p className="text-white font-semibold text-sm">{fullscreenRoom.name}</p>
              {fullscreenRoom.active_variant_name && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{fullscreenRoom.active_variant_name}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <button
                onClick={() => setZoom(z => Math.min(5, z * 1.3))}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <Icon name="ZoomIn" size={16} style={{ color: "rgba(255,255,255,0.8)" }} />
              </button>
              <button
                onClick={resetZoom}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom(z => Math.max(0.5, z / 1.3))}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <Icon name="ZoomOut" size={16} style={{ color: "rgba(255,255,255,0.8)" }} />
              </button>
              <button
                onClick={openInPlan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff" }}
              >
                <Icon name="ExternalLink" size={12} />
                Редактировать
              </button>
              <button
                onClick={() => setFullscreenRoom(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <Icon name="X" size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
              </button>
            </div>
          </div>

          {/* Изображение с pinch-zoom */}
          <div
            className="flex-1 overflow-hidden flex items-center justify-center"
            style={{ touchAction: "none" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {thumb(fullscreenRoom) ? (
              <img
                ref={imgRef}
                src={thumb(fullscreenRoom)!}
                alt={fullscreenRoom.name}
                className="max-w-full max-h-full object-contain rounded-xl select-none"
                style={{
                  transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
                  transformOrigin: "center center",
                  transition: "transform 0.05s",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 opacity-40">
                <Icon name="LayoutDashboard" size={64} style={{ color: "#7c3aed" }} />
                <p className="text-white text-sm">Нет превью — откройте в построителе</p>
              </div>
            )}
          </div>

          {/* Подсказка */}
          {zoom === 1 && (
            <div className="flex justify-center pb-4 flex-shrink-0">
              <span className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                Сведите два пальца для зума
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}