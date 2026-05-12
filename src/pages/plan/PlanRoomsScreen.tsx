import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject, PlanRoom, usePlanProjects } from "./usePlanProjects";

interface Props {
  token?: string | null;
  project: PlanProject;
  onBack: () => void;
  onOpenRoom: (room: PlanRoom) => void;
}

const QUICK_ROOMS = [
  { name: "Зал",       icon: "Sofa" },
  { name: "Гостиная",  icon: "Tv2" },
  { name: "Кухня",     icon: "UtensilsCrossed" },
  { name: "Спальня",   icon: "BedDouble" },
  { name: "Санузел",   icon: "Bath" },
  { name: "Коридор",   icon: "ArrowRight" },
  { name: "Детская",   icon: "Baby" },
  { name: "Кабинет",   icon: "Briefcase" },
];

export default function PlanRoomsScreen({ token, project, onBack, onOpenRoom }: Props) {
  const { rooms, loading, loadRooms, createRoom } = usePlanProjects(token);
  const [showForm, setShowForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadRooms(project.id); }, [project.id, loadRooms]);

  const handleCreate = async (name: string) => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const id = await createRoom(project.id, name.trim());
      await loadRooms(project.id);
      const newRoom: PlanRoom = {
        id, project_id: project.id, name: name.trim(),
        data: {}, thumbnail: null, created_at: "", updated_at: "",
      };
      onOpenRoom(newRoom);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#07070f" }}>
      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 sm:px-8 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <Icon name="ChevronLeft" size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-[15px] truncate">{project.name}</div>
          {(project.client_name || project.address) && (
            <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
              {[project.client_name, project.address].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <button
          onClick={() => { setShowForm(true); setCustomName(""); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition hover:opacity-90 active:scale-[0.97] flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
        >
          <Icon name="Plus" size={13} />
          Комната
        </button>
      </div>

      {/* Контент */}
      <div className="flex-1 px-4 sm:px-8 py-6 max-w-3xl mx-auto w-full">

        {/* Форма добавления комнаты */}
        {showForm && (
          <div className="mb-6 rounded-2xl p-5 space-y-4" style={{ background: "#0e0e1c", border: "1px solid rgba(124,58,237,0.3)" }}>
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-[15px]">Добавить комнату</span>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white/70 transition">
                <Icon name="X" size={16} />
              </button>
            </div>

            {/* Быстрые варианты */}
            <div>
              <div className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-2">Быстрый выбор</div>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_ROOMS.map(r => (
                  <button
                    key={r.name}
                    onClick={() => handleCreate(r.name)}
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

            {/* Своё название */}
            <div>
              <div className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-2">Своё название</div>
              <div className="flex gap-2">
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate(customName)}
                  placeholder="Например: Лоджия"
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
                <button
                  onClick={() => handleCreate(customName)}
                  disabled={!customName.trim() || creating}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40 hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
                >
                  {creating ? "..." : "Добавить"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Загрузка */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Пустое состояние */}
        {!loading && rooms.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(124,58,237,0.12)" }}>
              <Icon name="LayoutDashboard" size={28} style={{ color: "#7c3aed" }} />
            </div>
            <div className="text-white/60 text-[15px] font-semibold mb-1">Комнат пока нет</div>
            <div className="text-white/30 text-[13px] mb-5">Добавьте первую комнату</div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
            >
              <Icon name="Plus" size={15} />
              Добавить комнату
            </button>
          </div>
        )}

        {/* Список комнат */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => onOpenRoom(room)}
              className="text-left rounded-2xl overflow-hidden transition hover:brightness-110 active:scale-[0.98] group"
              style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {/* Превью / заглушка */}
              <div className="relative h-24 flex items-center justify-center"
                style={{ background: room.thumbnail ? undefined : "rgba(124,58,237,0.06)" }}>
                {room.thumbnail ? (
                  <img src={room.thumbnail} alt={room.name} className="w-full h-full object-cover" />
                ) : (
                  <Icon name="SquareDashed" size={32} style={{ color: "rgba(124,58,237,0.3)" }} />
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  style={{ background: "rgba(124,58,237,0.3)" }}>
                  <Icon name="Pencil" size={20} className="text-white" />
                </div>
              </div>
              {/* Название */}
              <div className="px-3 py-2.5">
                <div className="text-white font-semibold text-[13px] truncate">{room.name}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {room.updated_at ? new Date(room.updated_at).toLocaleDateString("ru-RU") : "Новая"}
                </div>
              </div>
            </button>
          ))}

          {/* Кнопка добавить */}
          {rooms.length > 0 && (
            <button
              onClick={() => { setShowForm(true); setCustomName(""); }}
              className="h-full min-h-[120px] rounded-2xl flex flex-col items-center justify-center gap-2 transition hover:brightness-110 active:scale-[0.98]"
              style={{ background: "rgba(124,58,237,0.06)", border: "1px dashed rgba(124,58,237,0.3)" }}
            >
              <Icon name="Plus" size={22} style={{ color: "rgba(124,58,237,0.6)" }} />
              <span className="text-[12px] font-semibold" style={{ color: "rgba(124,58,237,0.6)" }}>Добавить</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
