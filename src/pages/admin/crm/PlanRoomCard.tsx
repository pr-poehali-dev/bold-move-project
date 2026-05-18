import { useRef } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import type { PlanRoom } from "./PlanRoomTypes";
import { getRoomThumb } from "./PlanRoomTypes";

interface Props {
  room: PlanRoom;
  isSelected: boolean;
  shareMode: boolean;
  darkBg?: boolean;
  onOpen: (room: PlanRoom) => void;
  onToggleSelect: (id: number) => void;
  onActivateShareMode: (roomId: number) => void;
}

export default function PlanRoomCard({ room, isSelected, shareMode, darkBg = true, onOpen, onToggleSelect, onActivateShareMode }: Props) {
  const t = useTheme();
  const preview = getRoomThumb(room);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(40);
      onActivateShareMode(room.id);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleClick = () => {
    if (shareMode) {
      onToggleSelect(room.id);
    } else {
      onOpen(room);
    }
  };

  return (
    <div className="relative">
      {/* Чекбокс — в режиме шаринга всегда виден, на ПК ещё и при hover */}
      {shareMode && (
        <div
          className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center pointer-events-none transition"
          style={{
            background: isSelected ? "#7c3aed" : "rgba(0,0,0,0.55)",
            border: `2px solid ${isSelected ? "#7c3aed" : "rgba(255,255,255,0.35)"}`,
          }}
        >
          {isSelected && <Icon name="Check" size={12} style={{ color: "#fff" }} />}
        </div>
      )}

      <button
        onClick={handleClick}
        onTouchStart={shareMode ? undefined : startLongPress}
        onTouchEnd={shareMode ? undefined : cancelLongPress}
        onTouchMove={cancelLongPress}
        onMouseDown={shareMode ? undefined : startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        className="rounded-2xl overflow-hidden text-left transition hover:brightness-110 active:scale-[0.99] w-full group"
        style={{
          background: t.cardBg,
          border: isSelected ? "2px solid #7c3aed" : `1px solid ${t.border}`,
        }}
      >
        {/* Чекбокс на ПК при hover (только не в режиме шаринга) */}
        {!shareMode && (
          <div
            className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full items-center justify-center hidden md:group-hover:flex transition pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", border: "2px solid rgba(255,255,255,0.35)" }}
          />
        )}

        <div className="w-full flex items-center justify-center" style={{ height: 180, background: darkBg ? "rgba(124,58,237,0.07)" : "#ffffff" }}>
          {preview ? (
            <img
              src={preview}
              alt={room.name}
              className="w-full h-full object-contain select-none"
              style={{ padding: 8, WebkitUserSelect: "none", userSelect: "none" }}
              onContextMenu={e => e.preventDefault()}
              draggable={false}
            />
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
}