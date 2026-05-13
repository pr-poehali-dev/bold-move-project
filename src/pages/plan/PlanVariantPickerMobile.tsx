import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { PlanVariant } from "./usePlanVariants";
import PlanRoomPreview from "./PlanRoomPreview";

interface Props {
  variants: PlanVariant[];
  loading?: boolean;
  activeVariantId?: number | null;
  onSelect: (variant: PlanVariant) => void;
  onLoad: (variant: PlanVariant) => void;
  onDelete: (variantId: number) => void;
  onRename: (variantId: number, name: string) => void;
  onClose: () => void;
}

export default function PlanVariantPickerMobile({ variants, loading, activeVariantId, onSelect, onLoad, onDelete, onRename, onClose }: Props) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState("");

  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl flex flex-col"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "75vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <span className="text-white font-bold text-[15px]">Варианты</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Список — скролл внутри */}
        <div className="overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}

          {!loading && variants.length === 0 && (
            <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>
              <Icon name="FolderOpen" size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-[13px]">Нет сохранённых вариантов</p>
            </div>
          )}

          {variants.map(v => {
            const isActive = activeVariantId === v.id;
            return (
              <div key={v.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: isActive ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.04)",
                  border: isActive ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.06)",
                }}>

                {/* Превью */}
                <div className="relative w-full" style={{ height: 110 }}>
                  <div style={{ pointerEvents: "none", width: "100%", height: "100%" }}>
                    <PlanRoomPreview data={v.data ?? {}} width={300} height={110} />
                  </div>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: "#7c3aed" }}>
                      <Icon name="Check" size={11} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Имя + действия */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  {renamingId === v.id ? (
                    <div className="flex gap-2 flex-1">
                      <input autoFocus value={renameName}
                        onChange={e => setRenameName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { onRename(v.id, renameName); setRenamingId(null); }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="flex-1 min-w-0 rounded-lg px-2 py-1 text-[13px] text-white focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(124,58,237,0.4)" }}
                      />
                      <button onClick={() => { onRename(v.id, renameName); setRenamingId(null); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(124,58,237,0.3)", color: "#a78bfa" }}>
                        <Icon name="Check" size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-[13px] font-semibold text-white truncate">{v.name}</span>
                      <span className="text-[11px] shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {new Date(v.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                      </span>
                      {/* Выбрать для сметы */}
                      <button
                        onClick={() => onSelect(v)}
                        title={isActive ? "Выбранный вариант" : "Выбрать для сметы"}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition shrink-0"
                        style={{
                          background: isActive ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.06)",
                          color: isActive ? "#a78bfa" : "rgba(255,255,255,0.3)",
                          border: isActive ? "1px solid rgba(124,58,237,0.5)" : "1px solid transparent",
                        }}>
                        <Icon name="Check" size={13} />
                      </button>
                      {/* Открыть чертёж */}
                      <button
                        onClick={() => onLoad(v)}
                        title="Открыть чертёж"
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition hover:bg-white/10 shrink-0"
                        style={{ color: "rgba(255,255,255,0.4)" }}>
                        <Icon name="FolderOpen" size={13} />
                      </button>
                      <button onClick={() => { setRenamingId(v.id); setRenameName(v.name); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition hover:bg-white/10"
                        style={{ color: "rgba(255,255,255,0.35)" }}>
                        <Icon name="Pencil" size={13} />
                      </button>
                      <button onClick={() => onDelete(v.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition hover:bg-red-500/15"
                        style={{ color: "rgba(239,68,68,0.5)" }}>
                        <Icon name="Trash2" size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}