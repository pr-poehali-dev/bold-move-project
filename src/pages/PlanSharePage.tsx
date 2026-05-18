import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { getSvgDataUrl } from "@/pages/plan/planExport";
import type { PlanState } from "@/pages/plan/planTypes";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];

interface Room {
  id: number;
  name: string;
  thumbnail: string | null;
  data?: object;
  active_variant_name: string | null;
  active_variant_thumbnail: string | null;
  active_variant_data?: object | null;
}

interface Share {
  title: string | null;
  created_at: string;
}

export default function PlanSharePage() {
  const { token } = useParams<{ token: string }>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [share, setShare] = useState<Share | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState<Room | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const lastDist = useRef(0);
  const lastPan = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${CRM_URL}?r=plan-share&token=${token}`)
      .then(r => r.json())
      .then((d: { share?: Share; rooms?: Room[] }) => {
        if (!d.share) { setError(true); return; }
        setShare(d.share);
        const roomList = d.rooms ?? [];
        // Пересчитываем thumbnails
        const rebuilt = roomList.map(room => {
          const planData = (room.active_variant_data ?? room.data) as PlanState | undefined;
          if (!planData?.points || planData.points.length < 2) return room;
          const newThumb = getSvgDataUrl(planData, 0.5, true).slice(0, 10000);
          return room.active_variant_data
            ? { ...room, active_variant_thumbnail: newThumb || room.active_variant_thumbnail }
            : { ...room, thumbnail: newThumb || room.thumbnail };
        });
        setRooms(rebuilt);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const thumb = (r: Room) => r.active_variant_thumbnail || r.thumbnail;

  const openRoom = (r: Room) => { setZoom(1); setPanX(0); setPanY(0); setFullscreen(r); };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastDist.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setZoom(z => Math.min(5, Math.max(0.5, z * (dist / lastDist.current))));
      lastDist.current = dist;
    } else if (e.touches.length === 1 && lastPan.current && zoom > 1) {
      setPanX(x => x + e.touches[0].clientX - lastPan.current!.x);
      setPanY(y => y + e.touches[0].clientY - lastPan.current!.y);
      lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchEnd = () => { lastDist.current = 0; lastPan.current = null; };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a12" }}>
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "#0a0a12" }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
        <Icon name="LinkOff" size={32} style={{ color: "#ef4444" }} />
      </div>
      <h1 className="text-xl font-bold text-white">Ссылка недействительна</h1>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
        Эта ссылка устарела или была удалена
      </p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#0a0a12" }}>
      {/* Шапка */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3" style={{ background: "rgba(10,10,18,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)" }}>
          <Icon name="Layers2" size={18} style={{ color: "#fff" }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-white font-bold text-sm truncate">{share?.title ?? "Чертежи"}</h1>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {rooms.length} {rooms.length === 1 ? "помещение" : rooms.length < 5 ? "помещения" : "помещений"}
          </p>
        </div>
      </div>

      {/* Список чертежей */}
      <div className="px-4 py-4 flex flex-col gap-4 max-w-lg mx-auto">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => openRoom(room)}
            className="w-full rounded-2xl overflow-hidden text-left transition active:scale-[0.99]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Превью */}
            <div className="w-full flex items-center justify-center" style={{ height: 220, background: "rgba(124,58,237,0.06)" }}>
              {thumb(room) ? (
                <img src={thumb(room)!} alt={room.name} className="w-full h-full object-contain" style={{ padding: 12 }} />
              ) : (
                <div className="flex flex-col items-center gap-2 opacity-25">
                  <Icon name="LayoutDashboard" size={40} style={{ color: "#7c3aed" }} />
                </div>
              )}
            </div>
            {/* Подпись */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-sm">{room.name}</p>
                {room.active_variant_name && (
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{room.active_variant_name}</p>
                )}
              </div>
              <Icon name="Maximize2" size={16} style={{ color: "rgba(255,255,255,0.3)" }} />
            </div>
          </button>
        ))}
      </div>

      {/* Подвал */}
      <div className="py-8 text-center">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Чертежи потолков — поехали!</p>
      </div>

      {/* Fullscreen просмотр */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "rgba(0,0,0,0.98)", touchAction: "none" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-white font-semibold text-sm">{fullscreen.name}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.min(5, z * 1.3))} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <Icon name="ZoomIn" size={16} style={{ color: "rgba(255,255,255,0.7)" }} />
              </button>
              <span className="text-xs w-10 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.max(0.5, z / 1.3))} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <Icon name="ZoomOut" size={16} style={{ color: "rgba(255,255,255,0.7)" }} />
              </button>
              <button onClick={() => setFullscreen(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <Icon name="X" size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
              </button>
            </div>
          </div>

          <div
            className="flex-1 flex items-center justify-center overflow-hidden"
            style={{ touchAction: "none" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {thumb(fullscreen) ? (
              <img
                src={thumb(fullscreen)!}
                alt={fullscreen.name}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
                  transformOrigin: "center",
                  transition: "transform 0.05s",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
                draggable={false}
              />
            ) : (
              <div className="opacity-30 flex flex-col items-center gap-2">
                <Icon name="LayoutDashboard" size={64} style={{ color: "#7c3aed" }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
