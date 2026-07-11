/**
 * PlanVoiceCatalogButton — круглая кнопка микрофона в каталоге построителя.
 * Визуально повторяет кнопку микрофона из бота (анимация, таймер, волны).
 */

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import useVoiceCatalog, { type VoiceCatalogItem } from "./useVoiceCatalog";
import type { PlanState } from "./planTypes";

interface Props {
  state: PlanState;
  onItems: (items: VoiceCatalogItem[], transcript: string) => void;
  onTranscript?: (transcript: string) => void;
  /** Компактный размер — для встраивания в шапку модалки. Подсказка/волны рендерятся
   *  через портал поверх всего документа, чтобы не обрезаться overflow модалки. */
  compact?: boolean;
}

export default function PlanVoiceCatalogButton({ state, onItems, onTranscript, compact = false }: Props) {
  const { isRecording, isProcessing, status, recTime, fmtTime, volume, toggleRecording } =
    useVoiceCatalog({ state, onItems, onTranscript });

  // Случайные высоты полос для визуализации — генерируем один раз
  const bars = useRef(Array.from({ length: 20 }, () => 0.2 + Math.random() * 0.8)).current;

  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const showOverlay = compact && (status || isRecording || isProcessing);

  // Пересчитываем позицию кнопки, пока показываем оверлей (на случай скролла/ресайза)
  useEffect(() => {
    if (!showOverlay) return;
    const update = () => setRect(btnRef.current?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [showOverlay]);

  const btnSize = compact ? 34 : 52;
  const iconSize = compact ? 15 : 20;

  const statusBlock = (status || isRecording || isProcessing) && (
    <div
      className="rounded-2xl px-3 py-2 text-[11px] text-white/80 whitespace-nowrap max-w-[240px] truncate shadow-lg"
      style={{ background: "rgba(14,14,28,0.97)", border: "1px solid rgba(124,58,237,0.35)" }}
    >
      {isRecording && !status && (
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          Говорите... {fmtTime(recTime)}
        </span>
      )}
      {isProcessing && !isRecording && (
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
          {status || "Обрабатываю..."}
        </span>
      )}
      {status && !isProcessing && !isRecording && (
        <span>{status}</span>
      )}
    </div>
  );

  const wavesBlock = isRecording && (
    <div
      className="flex items-end gap-[2px] rounded-xl px-2 py-1.5"
      style={{ background: "rgba(14,14,28,0.85)" }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: `${Math.round((0.2 + volume * h * 0.8) * 24)}px`,
            background: "linear-gradient(to top, #7c3aed, #a78bfa)",
            transition: "height 0.1s ease",
            animationDelay: `${i * 30}ms`,
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="relative flex flex-col items-center gap-2">

      {/* Некомпактный режим (плавающая кнопка) — подсказка и волны позиционируются относительно кнопки как раньше */}
      {!compact && statusBlock && (
        <div className="absolute bottom-[calc(100%+10px)] right-0 z-50">{statusBlock}</div>
      )}
      {!compact && wavesBlock && (
        <div className="absolute bottom-[calc(100%+38px)] right-0 z-50">{wavesBlock}</div>
      )}

      {/* Компактный режим (в шапке модалки) — рендерим через портал, чтобы не обрезалось overflow */}
      {compact && showOverlay && rect && createPortal(
        <div
          className="fixed flex flex-col items-end gap-2 z-[10000]"
          style={{ top: rect.bottom + 10, left: Math.max(8, rect.right - 240), pointerEvents: "none" }}
        >
          {statusBlock}
          {wavesBlock}
        </div>,
        document.body
      )}

      {/* Сама кнопка */}
      <button
        ref={btnRef}
        onClick={toggleRecording}
        disabled={isProcessing}
        title={isRecording ? "Остановить запись" : "Надиктовать наполнение голосом"}
        className="relative flex items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-50 disabled:cursor-wait flex-shrink-0"
        style={{
          width: btnSize,
          height: btnSize,
          background: isRecording
            ? "linear-gradient(135deg, #dc2626, #ef4444)"
            : "linear-gradient(135deg, #6d28d9, #7c3aed)",
          boxShadow: isRecording
            ? `0 0 0 ${compact ? 3 : 4}px rgba(239,68,68,0.25), 0 4px 16px rgba(239,68,68,0.35)`
            : `0 0 0 ${compact ? 2 : 3}px rgba(124,58,237,0.2), 0 4px 16px rgba(124,58,237,0.3)`,
        }}
      >
        {/* Пульсирующее кольцо при записи */}
        {isRecording && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: "rgba(239,68,68,0.3)" }}
          />
        )}

        {isProcessing
          ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          : isRecording
            ? <Icon name="Square" size={iconSize} style={{ color: "#fff" }} />
            : <Icon name="Mic" size={iconSize} style={{ color: "#fff" }} />
        }
      </button>
    </div>
  );
}