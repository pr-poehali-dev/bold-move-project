import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import type { PlanVariant } from "./usePlanVariants";
import PlanRoomPreview from "./PlanRoomPreview";

interface Props {
  variants: PlanVariant[];
  loading?: boolean;
  onLoad: (variant: PlanVariant) => void;
  onDelete: (variantId: number) => void;
  onRename: (variantId: number, name: string) => void;
  onClose: () => void;
}

export default function PlanVariantPicker({ variants, loading, onLoad, onDelete, onRename, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState("");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 z-50 rounded-2xl overflow-hidden"
      style={{
        background: "#0e0e1c",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
        width: "min(360px, 92vw)",
      }}
    >
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <span className="text-white font-bold text-[14px]">Варианты</span>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg transition hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.4)" }}>
          <Icon name="X" size={13} />
        </button>
      </div>

      {/* Список */}
      <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && variants.length === 0 && (
          <div className="text-center py-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            <Icon name="FolderOpen" size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-[12px]">Нет сохранённых вариантов</p>
          </div>
        )}

        {variants.map(v => (
          <div key={v.id}
            className="rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>

            {/* Превью */}
            <button onClick={() => onLoad(v)} className="relative w-full group" style={{ height: 90 }}>
              <div style={{ pointerEvents: "none", width: "100%", height: "100%" }}>
                <PlanRoomPreview data={v.data ?? {}} width={300} height={90} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                style={{ background: "rgba(0,0,0,0.45)" }}>
                <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(124,58,237,0.8)" }}>Загрузить</span>
              </div>
            </button>

            {/* Имя + действия */}
            <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {renamingId === v.id ? (
                <div className="flex gap-1.5 flex-1">
                  <input autoFocus value={renameName}
                    onChange={e => setRenameName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { onRename(v.id, renameName); setRenamingId(null); }
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="flex-1 min-w-0 rounded-lg px-2 py-0.5 text-[12px] text-white focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(124,58,237,0.4)" }}
                  />
                  <button onClick={() => { onRename(v.id, renameName); setRenamingId(null); }}
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(124,58,237,0.3)", color: "#a78bfa" }}>
                    <Icon name="Check" size={11} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-[12px] font-semibold text-white truncate">{v.name}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {new Date(v.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </span>
                  <button onClick={() => { setRenamingId(v.id); setRenameName(v.name); }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg transition hover:bg-white/10 shrink-0"
                    style={{ color: "rgba(255,255,255,0.35)" }}>
                    <Icon name="Pencil" size={11} />
                  </button>
                  <button onClick={() => onDelete(v.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg transition hover:bg-red-500/15 shrink-0"
                    style={{ color: "rgba(239,68,68,0.5)" }}>
                    <Icon name="Trash2" size={11} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
