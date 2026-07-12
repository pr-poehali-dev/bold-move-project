import { useEffect, useState, useRef, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject, PlanRoom, usePlanProjects } from "./usePlanProjects";
import { getRoomMeta } from "./PlanRoomPreview";
import { usePlanVariants, PlanVariant } from "./usePlanVariants";
import PlanExportModal from "./PlanExportMenu";
import { generateExportPdf } from "./PlanExportGenerator";
import PlanRoomsHeader from "./PlanRoomsHeader";
import PlanRoomAddForm from "./PlanRoomAddForm";
import PlanRoomCard from "./PlanRoomCard";

interface Props {
  token?: string | null;
  project: PlanProject;
  onBack: () => void;
  onOpenRoom: (room: PlanRoom) => void;
}

export default function PlanRoomsScreen({ token, project, onBack, onOpenRoom }: Props) {
  const { rooms, loading, loadRooms, createRoom, updateRoom, deleteRoom, duplicateRoom } = usePlanProjects(token);
  const { variants, loading: variantsLoading, loadVariants, deleteVariant, updateVariant } = usePlanVariants(token);

  const [exportOpen,       setExportOpen]       = useState(false);
  const [showForm,         setShowForm]         = useState(false);
  const [customName,       setCustomName]        = useState("");
  const [creating,         setCreating]          = useState(false);
  const [editingId,        setEditingId]         = useState<number | null>(null);
  const [editName,         setEditName]          = useState("");
  const [savingEdit,       setSavingEdit]        = useState(false);
  const [deletingId,       setDeletingId]        = useState<number | null>(null);
  const [menuOpenId,       setMenuOpenId]        = useState<number | null>(null);
  const [varPickerRoomId,       setVarPickerRoomId]       = useState<number | null>(null);
  // варианты по roomId — кешируем при открытии
  const [variantsByRoom,        setVariantsByRoom]        = useState<Record<number, PlanVariant[]>>({});
  // активный вариант по roomId — кешируем выбор
  const [activeVarByRoom,       setActiveVarByRoom]       = useState<Record<number, number | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const varPickerRef = useRef<HTMLDivElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);

  // Закрываем меню при клике вне
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpenId]);

  useEffect(() => {
    const urlRoomId = new URLSearchParams(window.location.search).get("room_id");
    loadRooms(project.id).then(list => {
      // Заполняем кеш активных вариантов из данных, пришедших с бэкенда
      const newActiveMap: Record<number, number | null> = {};
      const newVarMap: Record<number, PlanVariant[]> = {};
      list.forEach(room => {
        if (room.active_variant_id != null) {
          newActiveMap[room.id] = room.active_variant_id;
          newVarMap[room.id] = [{
            id: room.active_variant_id,
            room_id: room.id,
            name: room.active_variant_name ?? "Вариант",
            data: {},
            thumbnail: room.active_variant_thumbnail ?? null,
            is_active: true,
            created_at: "",
            updated_at: "",
          }];
        }
      });
      setActiveVarByRoom(newActiveMap);
      setVariantsByRoom(prev => ({ ...prev, ...newVarMap }));

      // Авто-открытие конкретной комнаты если room_id передан в URL
      if (urlRoomId) {
        const targetRoom = list.find(r => r.id === Number(urlRoomId));
        if (targetRoom) {
          // Убираем room_id из URL
          const url = new URL(window.location.href);
          url.searchParams.delete("room_id");
          url.searchParams.delete("variant_id");
          window.history.replaceState({}, "", url.toString());
          onOpenRoom(targetRoom);
        }
      }
    });
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        include_in_estimate: true, include_drawing: true,
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

  // ── Статистика по проекту ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalArea = 0;
    let emptyWallsCount = 0; // суммарное число СТЕН без товара по всем комнатам (не число комнат!)
    rooms.forEach(room => {
      const data = (room.data ?? {}) as { isClosed?: boolean; segments?: { items?: unknown[] }[] };
      const meta = getRoomMeta(room.data ?? {});
      totalArea += meta.areaSqm ?? 0;
      if (!data.isClosed) return;
      const segments = data.segments ?? [];
      emptyWallsCount += segments.filter(s => !s.items || s.items.length === 0).length;
    });
    return {
      totalRooms: rooms.length,
      totalArea: Math.round(totalArea * 100) / 100,
      roomsWithEmptyWalls: emptyWallsCount,
    };
  }, [rooms]);

  const openAddForm = () => {
    setShowForm(v => {
      if (!v) setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return !v;
    });
    setCustomName("");
  };

  return (
    <div className="h-screen flex flex-col overflow-y-auto" style={{ background: "#07070f" }}>

      <PlanRoomsHeader
        project={project}
        token={token}
        stats={stats}
        onBack={onBack}
        onExportClick={() => setExportOpen(true)}
        onAddRoomClick={openAddForm}
      />

      <PlanExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={async cfg => {
          await generateExportPdf({
            type: cfg.type,
            scope: cfg.scope,
            project: {
              name: project.name,
              client_name: project.client_name,
              phone: project.phone,
              address: project.address,
            },
            rooms,
          });
        }}
        showScope={true}
      />

      {/* Контент */}
      <div className="flex-1 px-4 sm:px-8 py-6 max-w-4xl mx-auto w-full">

        {/* Форма добавления */}
        {showForm && (
          <PlanRoomAddForm
            formRef={addFormRef}
            customName={customName}
            setCustomName={setCustomName}
            creating={creating}
            onClose={() => setShowForm(false)}
            onCreate={handleCreate}
          />
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
              const isEditing  = editingId === room.id;
              const isMenuOpen = menuOpenId !== null && menuOpenId === room.id;
              const varPickerOpen = varPickerRoomId === room.id;

              return (
                <PlanRoomCard
                  key={room.id}
                  room={room}
                  isEditing={isEditing}
                  editName={editName}
                  setEditName={setEditName}
                  savingEdit={savingEdit}
                  onStartEdit={() => { setEditingId(room.id); setEditName(room.name); setMenuOpenId(null); }}
                  onCancelEdit={() => setEditingId(null)}
                  onRename={() => handleRename(room.id)}

                  onOpen={() => {
                    const activeId = activeVarByRoom[room.id];
                    const activeVar = activeId != null ? variantsByRoom[room.id]?.find(v => v.id === activeId) : null;
                    onOpenRoom(activeVar ? { ...room, data: activeVar.data } : room);
                  }}
                  onToggleField={(key, val) => updateRoom(room.id, { [key]: !val }).then(() => loadRooms(project.id))}

                  isMenuOpen={isMenuOpen}
                  menuRef={menuRef}
                  onToggleMenu={() => setMenuOpenId(isMenuOpen ? null : room.id)}
                  onDuplicate={async () => { setMenuOpenId(null); await duplicateRoom(room); await loadRooms(project.id); }}
                  onDelete={() => { handleDelete(room.id); setMenuOpenId(null); }}

                  varPickerOpen={varPickerOpen}
                  varPickerRef={varPickerRef}
                  onOpenVarPicker={async () => {
                    if (varPickerRoomId === room.id) { setVarPickerRoomId(null); return; }
                    const list = await loadVariants(room.id);
                    const activeId = list.find(v => v.is_active)?.id ?? null;
                    setVariantsByRoom(prev => ({ ...prev, [room.id]: list }));
                    setActiveVarByRoom(prev => ({ ...prev, [room.id]: activeId }));
                    setVarPickerRoomId(room.id);
                  }}
                  variantsForRoom={variantsByRoom[room.id] ?? variants}
                  variantsLoading={variantsLoading}
                  activeVariantId={activeVarByRoom[room.id] ?? null}
                  onSelectVariant={v => {
                    setActiveVarByRoom(prev => ({ ...prev, [room.id]: v.id }));
                    setVariantsByRoom(prev => ({
                      ...prev,
                      [room.id]: (prev[room.id] ?? []).map(x => ({ ...x, is_active: x.id === v.id })),
                    }));
                    updateVariant(v.id, { is_active: true });
                    setVarPickerRoomId(null);
                  }}
                  onLoadVariant={v => { onOpenRoom({ ...room, data: v.data }); setVarPickerRoomId(null); }}
                  onDeleteVariant={async id => {
                    await deleteVariant(id, room.id);
                    if (activeVarByRoom[room.id] === id) setActiveVarByRoom(prev => ({ ...prev, [room.id]: null }));
                    const refreshed = await loadVariants(room.id);
                    setVariantsByRoom(prev => ({ ...prev, [room.id]: refreshed }));
                  }}
                  onRenameVariant={(id, name) => {
                    updateVariant(id, { name });
                    setVariantsByRoom(prev => ({
                      ...prev,
                      [room.id]: (prev[room.id] ?? []).map(v => v.id === id ? { ...v, name } : v),
                    }));
                  }}
                  onCloseVarPicker={() => setVarPickerRoomId(null)}
                />
              );
            })}

            {/* Добавить ещё */}
            <button
              onClick={() => { setShowForm(true); setCustomName(""); setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
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