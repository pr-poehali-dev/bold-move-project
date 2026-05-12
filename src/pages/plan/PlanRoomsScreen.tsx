import { useEffect, useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject, PlanRoom, usePlanProjects } from "./usePlanProjects";
import PlanRoomPreview, { getRoomMeta } from "./PlanRoomPreview";

interface Props {
  token?: string | null;
  project: PlanProject;
  onBack: () => void;
  onOpenRoom: (room: PlanRoom) => void;
}

const QUICK_ROOMS = [
  { name: "Зал",      icon: "Sofa" },
  { name: "Гостиная", icon: "Tv2" },
  { name: "Кухня",    icon: "UtensilsCrossed" },
  { name: "Спальня",  icon: "BedDouble" },
  { name: "Санузел",  icon: "Bath" },
  { name: "Коридор",  icon: "ArrowRight" },
  { name: "Детская",  icon: "Baby" },
  { name: "Кабинет",  icon: "Briefcase" },
];

export default function PlanRoomsScreen({ token, project, onBack, onOpenRoom }: Props) {
  const { rooms, loading, loadRooms, createRoom, updateRoom, deleteRoom } = usePlanProjects(token);

  const [showForm,    setShowForm]    = useState(false);
  const [customName,  setCustomName]  = useState("");
  const [creating,    setCreating]    = useState(false);
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [editName,    setEditName]    = useState("");
  const [savingEdit,  setSavingEdit]  = useState(false);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const [menuOpenId,  setMenuOpenId]  = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрываем меню при клике вне
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  useEffect(() => { loadRooms(project.id); }, [project.id, loadRooms]);

  // ── Создать ──────────────────────────────────────────────────────────────────
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
      setShowForm(false);
      onOpenRoom(newRoom);
    } finally {
      setCreating(false);
    }
  };

  // ── Переименовать ─────────────────────────────────────────────────────────
  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateRoom(id, { name: editName.trim() });
      await loadRooms(project.id);
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Удалить ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteRoom(id);
      await loadRooms(project.id);
    } finally {
      setDeletingId(null);
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
          onClick={() => { setShowForm(v => !v); setCustomName(""); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition hover:opacity-90 active:scale-[0.97] flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
        >
          <Icon name="Plus" size={13} />
          Комната
        </button>
      </div>

      {/* Контент */}
      <div className="flex-1 px-4 sm:px-8 py-6 max-w-4xl mx-auto w-full">

        {/* Форма добавления */}
        {showForm && (
          <div className="mb-6 rounded-2xl p-5 space-y-4" style={{ background: "#0e0e1c", border: "1px solid rgba(124,58,237,0.3)" }}>
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-[15px]">Добавить комнату</span>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white/70 transition">
                <Icon name="X" size={16} />
              </button>
            </div>

            <div>
              <div className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-2">Быстрый выбор</div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
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

        {/* Сетка комнат */}
        {rooms.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rooms.map(room => {
              const isDeleting = deletingId === room.id;
              const isEditing  = editingId === room.id;
              const dateStr    = room.updated_at
                ? new Date(room.updated_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                : "Новая";

              const meta = getRoomMeta(room.data ?? {});
              const isMenuOpen = menuOpenId === room.id;

              return (
                <div
                  key={room.id}
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {/* Шапка карточки */}
                  <div className="flex items-center justify-between px-3 pt-3 pb-1">
                    {isEditing ? (
                      <div className="flex gap-1.5 flex-1 mr-1">
                        <input
                          autoFocus
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleRename(room.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex-1 min-w-0 rounded-lg px-2 py-1 text-[13px] text-white focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(124,58,237,0.4)" }}
                        />
                        <button onClick={() => handleRename(room.id)} disabled={savingEdit}
                          className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-40"
                          style={{ background: "rgba(124,58,237,0.3)", color: "#a78bfa" }}>
                          {savingEdit ? <div className="w-3 h-3 border border-violet-400/40 border-t-violet-400 rounded-full animate-spin" /> : <Icon name="Check" size={11} />}
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ color: "rgba(255,255,255,0.3)" }}>
                          <Icon name="X" size={11} />
                        </button>
                      </div>
                    ) : (
                      <span className="font-bold text-[14px] text-white truncate">{room.name}</span>
                    )}

                    {/* Меню ⋮ */}
                    {!isEditing && (
                      <div className="relative shrink-0" ref={isMenuOpen ? menuRef : undefined}>
                        <button
                          onClick={() => setMenuOpenId(isMenuOpen ? null : room.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-white/10"
                          style={{ color: "rgba(255,255,255,0.4)" }}
                        >
                          <Icon name="MoreVertical" size={15} />
                        </button>
                        {isMenuOpen && (
                          <div className="absolute right-0 top-8 z-50 rounded-xl py-1 min-w-[170px]"
                            style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                              Действия
                            </div>
                            <button onClick={() => { setEditingId(room.id); setEditName(room.name); setMenuOpenId(null); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-white/[0.06]"
                              style={{ color: "rgba(255,255,255,0.8)" }}>
                              <Icon name="Pencil" size={14} />
                              Переименовать
                            </button>
                            <button onClick={() => { handleDelete(room.id); setMenuOpenId(null); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-red-500/10"
                              style={{ color: "#f87171" }}>
                              <Icon name="Trash2" size={14} />
                              Удалить
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Превью плана */}
                  <button
                    onClick={() => onOpenRoom(room)}
                    className="relative w-full group overflow-hidden mx-3 rounded-xl"
                    style={{ width: "calc(100% - 24px)", height: 140, marginLeft: 12, marginRight: 12 }}
                  >
                    <div className="w-full h-full rounded-xl overflow-hidden" style={{ pointerEvents: "none" }}>
                      <PlanRoomPreview data={room.data ?? {}} width={400} height={140} />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-xl"
                      style={{ background: "rgba(0,0,0,0.35)" }}>
                      <span className="text-[12px] font-bold text-white px-3 py-1.5 rounded-xl" style={{ background: "rgba(0,0,0,0.55)" }}>
                        Открыть план
                      </span>
                    </div>
                  </button>

                  {/* Тогглы */}
                  <div className="px-3 pt-3 space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        onClick={() => updateRoom(room.id, { include_in_estimate: !room.include_in_estimate }).then(() => loadRooms(project.id))}
                        className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                        style={{ background: room.include_in_estimate !== false ? "#2563eb" : "rgba(255,255,255,0.12)" }}
                      >
                        <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                          style={{ left: room.include_in_estimate !== false ? "calc(100% - 22px)" : "2px" }} />
                      </div>
                      <span className="text-[13px] text-white">Включить в смету</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        onClick={() => updateRoom(room.id, { include_drawing: !room.include_drawing }).then(() => loadRooms(project.id))}
                        className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                        style={{ background: room.include_drawing !== false ? "#2563eb" : "rgba(255,255,255,0.12)" }}
                      >
                        <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                          style={{ left: room.include_drawing !== false ? "calc(100% - 22px)" : "2px" }} />
                      </div>
                      <span className="text-[13px] text-white">Чертёж в смете</span>
                    </label>
                  </div>

                  {/* Площадь / периметр */}
                  {(meta.areaSqm !== null || meta.perimM !== null) && (
                    <div className="flex items-center gap-2 px-3 pt-2 flex-wrap">
                      {meta.areaSqm !== null && (
                        <span className="text-[12px] font-semibold" style={{ color: "#818cf8" }}>
                          Площадь {meta.areaSqm} м²
                        </span>
                      )}
                      {meta.areaSqm !== null && meta.perimM !== null && (
                        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>•</span>
                      )}
                      {meta.perimM !== null && (
                        <span className="text-[12px] font-semibold" style={{ color: "#818cf8" }}>
                          Периметр {meta.perimM} м
                        </span>
                      )}
                    </div>
                  )}

                  {/* Кнопка открыть расчёт */}
                  <div className="px-3 pt-2 pb-3">
                    <button
                      onClick={() => onOpenRoom(room)}
                      className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition hover:opacity-90 active:scale-[0.98]"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.8)" }}
                    >
                      Открыть план
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Добавить ещё */}
            <button
              onClick={() => { setShowForm(true); setCustomName(""); }}
              className="rounded-2xl flex flex-col items-center justify-center gap-2 transition hover:brightness-110 active:scale-[0.97]"
              style={{ minHeight: 200, background: "rgba(124,58,237,0.05)", border: "1px dashed rgba(124,58,237,0.25)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.15)" }}>
                <Icon name="Plus" size={20} style={{ color: "#a78bfa" }} />
              </div>
              <span className="text-[12px] font-semibold" style={{ color: "rgba(124,58,237,0.6)" }}>Добавить комнату</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}