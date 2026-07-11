import { RefObject } from "react";
import Icon from "@/components/ui/icon";

export const QUICK_ROOMS = [
  { name: "Комната",  icon: "DoorOpen" },
  { name: "Гостиная", icon: "Tv2" },
  { name: "Кухня",    icon: "UtensilsCrossed" },
  { name: "Спальня",  icon: "BedDouble" },
  { name: "Санузел",  icon: "Bath" },
  { name: "Коридор",  icon: "ArrowRight" },
  { name: "Детская",  icon: "Baby" },
  { name: "Кабинет",  icon: "Briefcase" },
];

interface Props {
  formRef: RefObject<HTMLDivElement>;
  customName: string;
  setCustomName: (v: string) => void;
  creating: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

// ── Форма добавления комнаты: быстрый выбор + своё название ────────────────
export default function PlanRoomAddForm({ formRef, customName, setCustomName, creating, onClose, onCreate }: Props) {
  return (
    <div ref={formRef} className="mb-6 rounded-2xl p-5 space-y-4" style={{ background: "#0e0e1c", border: "1px solid rgba(124,58,237,0.3)" }}>
      <div className="flex items-center justify-between">
        <span className="text-white font-bold text-[15px]">Добавить комнату</span>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
          <Icon name="X" size={16} />
        </button>
      </div>

      <div>
        <div className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-2">Быстрый выбор</div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {QUICK_ROOMS.map(r => (
            <button
              key={r.name}
              onClick={() => onCreate(r.name)}
              disabled={creating}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition hover:brightness-110 active:scale-[0.96] disabled:opacity-50"
              style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}
            >
              <Icon name={r.icon} size={20} style={{ color: "#a78bfa" }} />
              <span className="text-[11px] font-semibold text-white/70">{r.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-2">Своё название</div>
        <div className="flex gap-2">
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onCreate(customName)}
            placeholder="Например: Лоджия"
            className="flex-1 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
          <button
            onClick={() => onCreate(customName)}
            disabled={!customName.trim() || creating}
            className="px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40 hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
          >
            {creating ? "..." : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}
