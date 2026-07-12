import Icon from "@/components/ui/icon";
import PlanRoomPhotos from "./PlanRoomPhotos";

interface Stats {
  totalRooms: number;
  totalArea: number;
  roomsWithEmptyWalls: number;
}

interface Props {
  stats: Stats;
  projectId: number;
  token?: string | null;
  onClose: () => void;
}

// ── Мобиле: модалка со статистикой проекта (то же самое, что десктоп-плашки в шапке) ──
export default function PlanRoomsStatsModal({ stats, projectId, token, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:w-auto sm:min-w-[320px] rounded-t-2xl sm:rounded-2xl p-5 space-y-3 overflow-y-auto"
        style={{ background: "#15151f", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[13px] font-bold text-white">Статистика проекта</span>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon name="Layers" size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
          <span className="text-[14px] font-bold text-white/80">{stats.totalRooms}</span>
          <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>полотен</span>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon name="Ruler" size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
          <span className="text-[14px] font-bold text-white/80">{stats.totalArea}</span>
          <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>м²</span>
        </div>

        {stats.roomsWithEmptyWalls > 0 ? (
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)" }}>
            <Icon name="AlertTriangle" size={16} style={{ color: "#fbbf24" }} />
            <span className="text-[14px] font-bold" style={{ color: "#fbbf24" }}>{stats.roomsWithEmptyWalls}</span>
            <span className="text-[12px]" style={{ color: "rgba(251,191,36,0.7)" }}>не назначено</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
            <Icon name="CheckCircle2" size={16} style={{ color: "#34d399" }} />
            <span className="text-[12px] font-semibold" style={{ color: "#34d399" }}>Все стены назначены</span>
          </div>
        )}

        {/* Фото проекта — та же лента, что в модалке "Фото проекта" на канвасе */}
        <div className="pt-1">
          <div className="text-[11px] font-semibold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            Фото проекта
          </div>
          <PlanRoomPhotos projectId={projectId} token={token} />
        </div>
      </div>
    </div>
  );
}