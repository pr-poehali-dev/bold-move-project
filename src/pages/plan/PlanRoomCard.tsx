import { RefObject } from "react";
import Icon from "@/components/ui/icon";
import { PlanRoom } from "./usePlanProjects";
import PlanRoomPreview, { getRoomMeta } from "./PlanRoomPreview";
import { PlanVariant } from "./usePlanVariants";
import PlanVariantPicker from "./PlanVariantPicker";

interface Props {
  room: PlanRoom;
  isEditing: boolean;
  editName: string;
  setEditName: (v: string) => void;
  savingEdit: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onRename: () => void;

  onOpen: () => void;
  onToggleField: (key: "include_in_estimate" | "include_drawing", val: boolean) => void;

  isMenuOpen: boolean;
  menuRef: RefObject<HTMLDivElement>;
  onToggleMenu: () => void;
  onDuplicate: () => void;
  onDelete: () => void;

  varPickerOpen: boolean;
  varPickerRef: RefObject<HTMLDivElement>;
  onOpenVarPicker: () => void;
  variantsForRoom: PlanVariant[];
  variantsLoading: boolean;
  activeVariantId: number | null;
  onSelectVariant: (v: PlanVariant) => void;
  onLoadVariant: (v: PlanVariant) => void;
  onDeleteVariant: (id: number) => void;
  onRenameVariant: (id: number, name: string) => void;
  onCloseVarPicker: () => void;
}

// ── Карточка одной комнаты: превью, тогглы, варианты, меню действий ────────
export default function PlanRoomCard({
  room, isEditing, editName, setEditName, savingEdit, onStartEdit, onCancelEdit, onRename,
  onOpen, onToggleField,
  isMenuOpen, menuRef, onToggleMenu, onDuplicate, onDelete,
  varPickerOpen, varPickerRef, onOpenVarPicker, variantsForRoom, variantsLoading, activeVariantId,
  onSelectVariant, onLoadVariant, onDeleteVariant, onRenameVariant, onCloseVarPicker,
}: Props) {
  const meta = getRoomMeta(room.data ?? {});

  return (
    <div
      className="rounded-2xl flex flex-col overflow-visible"
      style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Превью с названием внутри */}
      <button onClick={onOpen}
        className="relative group w-full rounded-t-2xl overflow-hidden"
        style={{ height: 200 }}>
        {/* Живой план — только верхние 164px */}
        <div style={{ pointerEvents: "none", width: "100%", height: 164 }}>
          <PlanRoomPreview data={room.data ?? {}} width={400} height={164}/>
        </div>
        {/* Название — нижние 36px с градиентом только внутри этой зоны */}
        {!isEditing && (
          <div className="flex items-center justify-center"
            style={{ height: 36, background: "linear-gradient(to bottom, rgba(10,10,24,0.6) 0%, rgba(10,10,24,1) 100%)" }}>
            <span className="font-bold text-[13px] text-white truncate px-3">{room.name}</span>
          </div>
        )}
        {/* Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
          style={{ background: "rgba(0,0,0,0.35)" }}>
          <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded-lg" style={{ background: "rgba(0,0,0,0.6)" }}>Открыть</span>
        </div>
      </button>

      {/* Переименование (если активно) */}
      {isEditing && (
        <div className="flex gap-1.5 px-2.5 pt-2">
          <input autoFocus value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter") onRename(); if (e.key==="Escape") onCancelEdit(); }}
            className="flex-1 min-w-0 rounded-lg px-2 py-1 text-[13px] text-white focus:outline-none"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(124,58,237,0.4)" }}
          />
          <button onClick={onRename} disabled={savingEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-40"
            style={{ background: "rgba(124,58,237,0.3)", color: "#a78bfa" }}>
            {savingEdit ? <div className="w-3 h-3 border border-violet-400/40 border-t-violet-400 rounded-full animate-spin"/> : <Icon name="Check" size={12}/>}
          </button>
          <button onClick={onCancelEdit} className="w-7 h-7 flex items-center justify-center" style={{ color: "rgba(255,255,255,0.3)" }}>
            <Icon name="X" size={12}/>
          </button>
        </div>
      )}

      {/* Тогглы */}
      <div className="px-2.5 pt-2.5 space-y-1.5">
        {[
          { key: "include_in_estimate" as const, label: "Включить в смету", val: room.include_in_estimate !== false },
          { key: "include_drawing" as const,     label: "Чертёж в смете",   val: room.include_drawing !== false },
        ].map(({ key, label, val }) => (
          <button key={key} onClick={() => onToggleField(key, val)}
            className="flex items-center gap-2.5 w-full select-none">
            <div className="relative w-8 h-5 rounded-full transition-colors shrink-0"
              style={{ background: val ? "#2563eb" : "rgba(255,255,255,0.12)" }}>
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                style={{ left: val ? "calc(100% - 18px)" : "2px" }}/>
            </div>
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Площадь / периметр */}
      {(meta.areaSqm !== null || meta.perimM !== null) && (
        <div className="px-2.5 pt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
          {meta.areaSqm !== null && <span className="text-[11px] font-semibold" style={{ color: "#818cf8" }}>Площадь {meta.areaSqm} м²</span>}
          {meta.areaSqm !== null && meta.perimM !== null && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}> </span>}
          {meta.perimM !== null && <span className="text-[11px] font-semibold" style={{ color: "#818cf8" }}>Периметр {meta.perimM} м</span>}
        </div>
      )}

      {/* Низ: кнопка "Варианты" + меню ⋮ */}
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-2.5 min-w-0">
        {/* Кнопка Варианты */}
        <div className="relative flex-1 min-w-0" ref={varPickerOpen ? varPickerRef : undefined}>
          <button
            onClick={onOpenVarPicker}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-semibold transition hover:bg-white/[0.06]"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
            <span className="truncate">
              {activeVariantId != null
                ? (variantsForRoom.find(v => v.id === activeVariantId)?.name ?? "Варианты")
                : "Варианты"}
            </span>
            <Icon name="ChevronDown" size={13} className="shrink-0 ml-1" style={{ color: "rgba(255,255,255,0.4)" }}/>
          </button>
          {varPickerOpen && (
            <PlanVariantPicker
              variants={variantsForRoom}
              loading={variantsLoading}
              activeVariantId={activeVariantId}
              onSelect={onSelectVariant}
              onLoad={onLoadVariant}
              onDelete={onDeleteVariant}
              onRename={onRenameVariant}
              onClose={onCloseVarPicker}
            />
          )}
        </div>

        {/* Меню ⋮ */}
        <div className="relative shrink-0" ref={isMenuOpen ? menuRef : undefined}>
          <button onClick={onToggleMenu}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
            <Icon name="MoreHorizontal" size={15}/>
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 bottom-10 z-50 rounded-xl py-1 min-w-[170px]"
              style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 -8px 24px rgba(0,0,0,0.5)" }}>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Действия с комнатой</div>
              <button onClick={onStartEdit}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition hover:bg-white/[0.06]" style={{ color: "rgba(255,255,255,0.8)" }}>
                <Icon name="Pencil" size={13}/> Переименовать
              </button>
              <button onClick={onDuplicate}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition hover:bg-white/[0.06]" style={{ color: "rgba(255,255,255,0.8)" }}>
                <Icon name="Copy" size={13}/> Дублировать
              </button>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }}/>
              <button onClick={onDelete}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition hover:bg-red-500/10" style={{ color: "#f87171" }}>
                <Icon name="Trash2" size={13}/> Удалить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
