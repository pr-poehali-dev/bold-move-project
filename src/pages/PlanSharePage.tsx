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
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { share?: Share; rooms?: Room[]; error?: string }) => {
        if (!d || d.error || !d.share) { setError(true); return; }
        setShare(d.share);
        const roomList = d.rooms ?? [];
        // Пересчитываем thumbnails — каждую отдельно, не прерываем при ошибке
        const rebuilt = roomList.map(room => {
          try {
            const planData = (room.active_variant_data ?? room.data) as PlanState | undefined;
            if (!planData?.points || planData.points.length < 2) return room;
            const newThumb = getSvgDataUrl(planData, 0.5, true).slice(0, 10000);
            if (!newThumb) return room;
            return room.active_variant_data
              ? { ...room, active_variant_thumbnail: newThumb || room.active_variant_thumbnail }
              : { ...room, thumbnail: newThumb || room.thumbnail };
          } catch {
            return room;
          }
        });
        setRooms(rebuilt);
      })
      .catch(e => { console.error("plan-share load error:", e); setError(true); })
      .finally(() => setLoading(false));
  }, [token]);

  const thumb = (r: Room) => r.active_variant_thumbnail || r.thumbnail;

  const openRoom = (r: Room) => { setZoom(1); setPanX(0); setPanY(0); setFullscreen(r); };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      // Инициализируем только если расстояние разумное
      lastDist.current = dist > 10 ? dist : 0;
      lastPan.current = null; // сбрасываем пан при начале пинча
    } else if (e.touches.length === 1) {
      lastDist.current = 0; // сбрасываем пинч при одном пальце
      lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastDist.current > 10 && dist > 10) {
        const ratio = dist / lastDist.current;
        // Защита от безумных скачков — не более 1.5x за одно событие
        if (ratio > 0.5 && ratio < 2) {
          setZoom(z => Math.min(5, Math.max(0.5, z * ratio)));
        }
      }
      lastDist.current = dist;
      lastPan.current = null;
    } else if (e.touches.length === 1 && lastPan.current) {
      const dx = e.touches[0].clientX - lastPan.current.x;
      const dy = e.touches[0].clientY - lastPan.current.y;
      // Защита от телепортации при смене режима
      if (Math.abs(dx) < 100 && Math.abs(dy) < 100) {
        setPanX(x => x + dx);
        setPanY(y => y + dy);
      }
      lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Остался один палец — переключаемся в режим пана
      lastDist.current = 0;
      lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 0) {
      lastDist.current = 0;
      lastPan.current = null;
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-white">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-50">
        <Icon name="LinkOff" size={32} style={{ color: "#ef4444" }} />
      </div>
      <h1 className="text-xl font-bold text-gray-900">Ссылка недействительна</h1>
      <p className="text-sm text-gray-500">Эта ссылка устарела или была удалена</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)" }}>
          <Icon name="Layers2" size={18} style={{ color: "#fff" }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-gray-900 font-bold text-sm truncate">{share?.title ?? "Чертежи"}</h1>
          <p className="text-xs mt-0.5 text-gray-400">
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
            className="w-full rounded-2xl overflow-hidden text-left transition active:scale-[0.99] bg-white shadow-sm hover:shadow-md"
            style={{ border: "1px solid #e5e7eb" }}
          >
            {/* Превью — белый фон */}
            <div className="w-full flex items-center justify-center bg-white" style={{ height: 220 }}>
              {thumb(room) ? (
                <img src={thumb(room)!} alt={room.name} className="w-full h-full object-contain" style={{ padding: 12 }} />
              ) : (
                <div className="flex flex-col items-center gap-2 opacity-25">
                  <Icon name="LayoutDashboard" size={40} style={{ color: "#7c3aed" }} />
                </div>
              )}
            </div>
            {/* Подпись */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
              <div>
                <p className="text-gray-900 font-semibold text-sm">{room.name}</p>
                {room.active_variant_name && (
                  <p className="text-xs mt-0.5 text-gray-400">{room.active_variant_name}</p>
                )}
              </div>
              <Icon name="Maximize2" size={16} style={{ color: "#9ca3af" }} />
            </div>
          </button>
        ))}
      </div>

      {/* Подвал */}
      <div className="py-8 text-center">
        <p className="text-xs text-gray-300">Чертежи потолков — поехали!</p>
      </div>

      {/* Fullscreen просмотр */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white"
          style={{ touchAction: "none" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-gray-100"
          >
            <p className="text-gray-900 font-semibold text-sm">{fullscreen.name}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.min(5, z * 1.3))} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                <Icon name="ZoomIn" size={16} style={{ color: "#374151" }} />
              </button>
              <span className="text-xs w-10 text-center text-gray-400">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.max(0.5, z / 1.3))} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                <Icon name="ZoomOut" size={16} style={{ color: "#374151" }} />
              </button>
              <button onClick={() => setFullscreen(null)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                <Icon name="X" size={18} style={{ color: "#374151" }} />
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