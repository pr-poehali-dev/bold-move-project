import Icon from "@/components/ui/icon";
import PlanRoomPhotos from "./PlanRoomPhotos";

interface Props {
  projectId: number;
  token?: string | null;
  onClose: () => void;
}

// ── Модалка с лентой фото проекта — открывается по кнопке "Фото" в тулбаре ──
export default function PlanRoomPhotosModal({ projectId, token, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5"
        style={{ background: "#14141c", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Icon name="Camera" size={18} /> Фото проекта
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">
            <Icon name="X" size={18} />
          </button>
        </div>

        <PlanRoomPhotos projectId={projectId} token={token} />
      </div>
    </div>
  );
}
