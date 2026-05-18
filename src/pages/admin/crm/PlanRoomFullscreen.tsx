import { useRef } from "react";
import Icon from "@/components/ui/icon";
import type { PlanRoom } from "./PlanRoomTypes";
import { getRoomThumb } from "./PlanRoomTypes";

interface Props {
  room: PlanRoom;
  zoom: number;
  panX: number;
  panY: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onSetZoom: (fn: (z: number) => number) => void;
  onSetPanX: (fn: (x: number) => number) => void;
  onSetPanY: (fn: (y: number) => number) => void;
  onClose: () => void;
  onOpenInPlan: () => void;
}

export default function PlanRoomFullscreen({
  room, zoom, panX, panY,
  onZoomIn, onZoomOut, onZoomReset,
  onSetZoom, onSetPanX, onSetPanY,
  onClose, onOpenInPlan,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const touch1 = useRef<Touch | null>(null);
  const touch2 = useRef<Touch | null>(null);
  const lastDist = useRef<number>(0);
  const lastPan = useRef<{ x: number; y: number } | null>(null);

  const preview = getRoomThumb(room);

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
      onSetZoom(z => Math.min(5, Math.max(0.5, z * delta)));
      lastDist.current = dist;
    } else if (e.touches.length === 1 && lastPan.current && zoom > 1) {
      const dx = e.touches[0].clientX - lastPan.current.x;
      const dy = e.touches[0].clientY - lastPan.current.y;
      onSetPanX(x => x + dx);
      onSetPanY(y => y + dy);
      lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchEnd = () => {
    touch1.current = null;
    touch2.current = null;
    lastDist.current = 0;
    lastPan.current = null;
  };

  return (
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
          <p className="text-white font-semibold text-sm">{room.name}</p>
          {room.active_variant_name && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{room.active_variant_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onZoomIn}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <Icon name="ZoomIn" size={16} style={{ color: "rgba(255,255,255,0.8)" }} />
          </button>
          <button
            onClick={onZoomReset}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={onZoomOut}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <Icon name="ZoomOut" size={16} style={{ color: "rgba(255,255,255,0.8)" }} />
          </button>
          <button
            onClick={onOpenInPlan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff" }}
          >
            <Icon name="ExternalLink" size={12} />
            Редактировать
          </button>
          <button
            onClick={onClose}
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
        {preview ? (
          <img
            ref={imgRef}
            src={preview}
            alt={room.name}
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
  );
}
