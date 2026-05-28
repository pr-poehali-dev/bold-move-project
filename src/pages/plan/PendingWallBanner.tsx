import Icon from "@/components/ui/icon";
import type { PendingWallItem } from "./useCatalogVoiceHandler";

interface Props {
  pendingWall: PendingWallItem;
  pendingSelectedSegs: string[];
  onConfirm: () => void;
  onClose: () => void;
}

export default function PendingWallBanner({ pendingWall, pendingSelectedSegs, onConfirm, onClose }: Props) {
  return (
    <div
      className="fixed z-[10000] inset-0 flex items-center justify-center"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="flex flex-col items-center gap-3 px-5 py-4 rounded-2xl"
        style={{
          background: "rgba(12,10,28,0.96)",
          border: "1.5px solid rgba(124,58,237,0.7)",
          boxShadow: "0 0 40px rgba(124,58,237,0.35), 0 8px 32px rgba(0,0,0,0.8)",
          backdropFilter: "blur(20px)",
          pointerEvents: "all",
          maxWidth: 340,
        }}
      >
        {/* Шапка: картинка + название */}
        <div className="flex items-center gap-3 w-full">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)" }}
          >
            {pendingWall.item.imageUrl
              ? <img src={pendingWall.item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <Icon name="Package" size={22} style={{ color: "#a78bfa" }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-black text-white truncate">{pendingWall.item.name}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(167,139,250,0.75)" }}>
              {pendingSelectedSegs.length === 0
                ? "Нажмите на стену (или несколько) на чертеже"
                : `Выбрано стен: ${pendingSelectedSegs.length} — нажмите ОК`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-white/10 flex-shrink-0"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            <Icon name="X" size={13} />
          </button>
        </div>

        {/* Кнопка ОК — появляется когда выбрана хотя бы одна стена */}
        {pendingSelectedSegs.length > 0 && (
          <button
            onClick={onConfirm}
            className="w-full py-2.5 rounded-xl text-[13px] font-black transition hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
          >
            <Icon name="Check" size={15} />
            Добавить на {pendingSelectedSegs.length === 1 ? "стену" : `${pendingSelectedSegs.length} стены`}
          </button>
        )}
      </div>
    </div>
  );
}
