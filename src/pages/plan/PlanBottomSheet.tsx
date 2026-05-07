import React, { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import PlanSidebar from "./PlanSidebar";
import type { PlanState } from "./planTypes";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  open: boolean;
  onClose: () => void;
  onSheetHeightChange?: (heightPx: number) => void;
  initialSnap?: SheetSnap;
}

// Высоты шита: peek (подглядывание) / half / full
type SheetSnap = "peek" | "half" | "full";

const PEEK_H  = 52;   // только ручка видна
const HALF_H  = 0.5;  // 50% экрана (доля)
const FULL_H  = 0.92; // 92% экрана

export default function PlanBottomSheet({ state, onChange, open, onClose, onSheetHeightChange, initialSnap = "half" }: Props) {
  const sheetRef    = useRef<HTMLDivElement>(null);
  const dragRef     = useRef<{ startY: number; startH: number } | null>(null);
  const [snap, setSnap]   = React.useState<SheetSnap>("half");
  const [height, setHeight] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  // Вычислить высоту по снапу
  const snapToHeight = (s: SheetSnap): number => {
    const wh = window.innerHeight;
    if (s === "peek") return PEEK_H;
    if (s === "half") return Math.round(wh * HALF_H);
    return Math.round(wh * FULL_H);
  };

  // При открытии — устанавливаем initialSnap + переключаем на чертёж + фокус первого поля
  useEffect(() => {
    if (open) {
      setSnap(initialSnap);
      setHeight(snapToHeight(initialSnap));
      // Переключаем на чертёж если не там
      if (state.sidebarTab !== "drawing") {
        onChange({ sidebarTab: "drawing" });
      }
      // Фокусируем первое поле ввода длины после анимации шита
      // Пробуем несколько раз — секция Стороны может рендериться с задержкой
      let attempts = 0;
      const tryFocus = () => {
        const input = document.querySelector<HTMLInputElement>('[data-sides-first-input]');
        if (input) {
          input.focus();
          input.select();
        } else if (attempts < 5) {
          attempts++;
          setTimeout(tryFocus, 150);
        }
      };
      const t = setTimeout(tryFocus, 300);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Обновить высоту при смене снапа
  useEffect(() => {
    setHeight(snapToHeight(snap));
  }, [snap]);

  // Сообщаем родителю о высоте шита (для центрирования чертежа)
  useEffect(() => {
    onSheetHeightChange?.(open ? height : 0);
  }, [height, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag handle
  const onDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startY: clientY, startH: height };
    setIsDragging(true);
  };

  useEffect(() => {
    const onMove = (e: TouchEvent | MouseEvent) => {
      if (!dragRef.current) return;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const delta = dragRef.current.startY - clientY;
      const newH = Math.max(PEEK_H, Math.min(Math.round(window.innerHeight * FULL_H), dragRef.current.startH + delta));
      setHeight(newH);
    };

    const onEnd = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setIsDragging(false);

      // Найти ближайший снап
      const wh = window.innerHeight;
      const snapHeights: [SheetSnap, number][] = [
        ["peek", PEEK_H],
        ["half", Math.round(wh * HALF_H)],
        ["full", Math.round(wh * FULL_H)],
      ];
      let best: SheetSnap = "half";
      let bestDist = Infinity;
      for (const [s, h] of snapHeights) {
        const d = Math.abs(height - h);
        if (d < bestDist) { bestDist = d; best = s; }
      }

      // Если потянули вниз совсем — закрыть
      if (best === "peek") {
        onClose();
        return;
      }
      setSnap(best);
      setHeight(snapToHeight(best));
    };

    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchend", onEnd);
    window.addEventListener("mouseup", onEnd);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("mouseup", onEnd);
    };
  }, [height, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — полупрозрачный фон при full */}
      {snap === "full" && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-40 flex flex-col bg-[#12131e] rounded-t-2xl border-t border-white/[0.1] shadow-2xl"
        style={{
          height: height,
          transition: isDragging ? "none" : "height 0.25s cubic-bezier(0.32,0.72,0,1)",
          willChange: "height",
        }}
      >
        {/* ── Ручка для перетаскивания ── */}
        <div
          className="flex flex-col items-center pt-2 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={onDragStart}
          onMouseDown={onDragStart}
        >
          <div className="w-10 h-1 rounded-full bg-white/20 mb-2" />

          {/* Snaps быстрые кнопки */}
          <div className="flex items-center gap-2 w-full px-4">
            <span className="text-[12px] font-bold text-white/60 flex-1">
              {state.sidebarTab === "drawing" ? "Чертёж" : state.sidebarTab === "calc" ? "Расчёт" : "Легенда"}
            </span>
            <div className="flex gap-1">
              {(["half", "full"] as SheetSnap[]).map(s => (
                <button key={s}
                  onClick={() => setSnap(s)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border transition ${
                    snap === s
                      ? "bg-violet-500/30 border-violet-500/40 text-violet-300"
                      : "bg-white/[0.04] border-white/[0.08] text-white/30"
                  }`}>
                  <Icon name={s === "half" ? "PanelBottom" : "Square"} size={12} />
                </button>
              ))}
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white/[0.04] border-white/[0.08] text-white/30 hover:text-white/60 transition">
                <Icon name="X" size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Контент сайдбара ── */}
        <div className="flex-1 overflow-hidden">
          <PlanSidebar state={state} onChange={onChange} />
        </div>
      </div>
    </>
  );
}