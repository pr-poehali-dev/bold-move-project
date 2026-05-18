import { useState } from "react";
import Icon from "@/components/ui/icon";
import { DiscountEntry } from "@/hooks/useDiscountHistory";

interface Props {
  appliedDiscountPct: number;
  totalDiscountAmount: number;
  discountHistory: DiscountEntry[];
  discountedProfit: number;
  discountedMargin: number;
  isRealLoss: boolean;
  accentColor: string;
  applying: boolean;
  effectiveMax: number;
  fmt: (n: number) => string;
  onOpenModal: (focus: "pct" | "amt") => void;
  onResetDiscount: () => void;
  onUpdateDiscount: (newPct: number, exactAmt?: number) => void;
}

export function DiscountAppliedView({
  appliedDiscountPct, totalDiscountAmount, discountHistory,
  discountedProfit, discountedMargin,
  isRealLoss, accentColor, applying, effectiveMax,
  fmt, onOpenModal, onResetDiscount, onUpdateDiscount,
}: Props) {
  const [editingPct, setEditingPct] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  const startEdit = () => {
    setEditingPct(String(appliedDiscountPct));
    setIsEditing(true);
  };
  const commitEdit = () => {
    const val = parseFloat(editingPct);
    if (!isNaN(val) && val > 0 && val !== appliedDiscountPct) {
      onUpdateDiscount(val);
    }
    setIsEditing(false);
  };

  if (discountHistory.length === 0) return null;

  return (
    <div className="px-4 py-4 space-y-3">
      {/* Плитки */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* СКИДКА — кликабельная */}
        <button onClick={() => onOpenModal("pct")}
          className="rounded-xl px-3 py-2.5 text-center transition hover:brightness-125 active:scale-[0.97] group"
          style={{ background: "#f59e0b18", border: "1px solid #f59e0b60", cursor: "pointer" }}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#f59e0b" }}>Скидка</span>
            <Icon name="Pencil" size={9} style={{ color: "#f59e0b80" }} className="group-hover:opacity-100 opacity-60" />
          </div>
          <div className="text-base font-black" style={{ color: "#f59e0b" }}>{appliedDiscountPct}%</div>
        </button>

        {/* СУММА СКИДКИ — кликабельная */}
        <button onClick={() => onOpenModal("amt")}
          className="rounded-xl px-3 py-2.5 text-center transition hover:brightness-125 active:scale-[0.97] group"
          style={{ background: "#ffffff08", border: "1px solid rgba(245,158,11,0.35)", cursor: "pointer" }}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Сумма скидки</span>
            <Icon name="Pencil" size={9} style={{ color: "rgba(245,158,11,0.5)" }} className="group-hover:opacity-100 opacity-60" />
          </div>
          <div className="text-sm font-black text-white/70 whitespace-nowrap">−{fmt(totalDiscountAmount)} ₽</div>
        </button>

        {/* ПРИБЫЛЬ */}
        <div className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: accentColor + "18", border: `1px solid ${accentColor}35` }}>
          <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: accentColor }}>
            {isRealLoss ? "Убыток" : "Прибыль"}
          </div>
          <div className="text-sm font-black whitespace-nowrap" style={{ color: accentColor }}>
            {isRealLoss ? "" : "+"}{fmt(discountedProfit)} ₽
          </div>
        </div>

        {/* МАРЖА */}
        <div className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: accentColor + "18", border: `1px solid ${accentColor}35` }}>
          <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: accentColor }}>Маржа</div>
          <div className="text-sm font-black" style={{ color: accentColor }}>
            {isRealLoss ? "—" : `${discountedMargin}%`}
          </div>
        </div>
      </div>

      {/* Редактор скидки */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f59e0b30", background: "#f59e0b06" }}>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Icon name="Tag" size={14} style={{ color: "#f59e0b" }} />
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0.5} max={effectiveMax || 99} step={0.5}
                  value={editingPct}
                  onChange={e => setEditingPct(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setIsEditing(false); }}
                  autoFocus
                  className="w-20 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid #f59e0b50", color: "#f59e0b" }}
                />
                <span className="text-sm font-bold text-yellow-400">%</span>
                <button onClick={commitEdit} disabled={applying}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition disabled:opacity-50"
                  style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
                  {applying ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <Icon name="Check" size={11} />}
                  Сохранить
                </button>
                <button onClick={() => setIsEditing(false)}
                  className="px-2 py-1 rounded-lg text-[10px] transition hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.3)" }}>
                  Отмена
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-white whitespace-nowrap">Скидка {appliedDiscountPct}% применена</span>
                <span className="text-xs text-white/40 whitespace-nowrap flex-shrink-0">−{fmt(totalDiscountAmount)} ₽</span>
              </div>
            )}
          </div>
          {!isEditing && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={startEdit} disabled={applying}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition hover:opacity-80 disabled:opacity-40"
                style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                <Icon name="Pencil" size={10} /> Изменить
              </button>
              <button onClick={onResetDiscount} disabled={applying}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition hover:opacity-80 disabled:opacity-40"
                style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
                {applying
                  ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : <Icon name="Trash2" size={10} />
                }
                Удалить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}