/**
 * PlanVoiceCatalogButton — круглая кнопка микрофона в каталоге построителя.
 * Визуально повторяет кнопку микрофона из бота (анимация, таймер, волны).
 */

import { useRef } from "react";
import Icon from "@/components/ui/icon";
import useVoiceCatalog, { type VoiceCatalogItem } from "./useVoiceCatalog";
import type { PlanState } from "./planTypes";

interface Props {
  state: PlanState;
  onItems: (items: VoiceCatalogItem[]) => void;
}

export default function PlanVoiceCatalogButton({ state, onItems }: Props) {
  const { isRecording, isProcessing, status, recTime, fmtTime, volume, toggleRecording } =
    useVoiceCatalog({ state, onItems });

  // Случайные высоты полос для визуализации — генерируем один раз
  const bars = useRef(Array.from({ length: 20 }, () => 0.2 + Math.random() * 0.8)).current;

  return (
    <div className="relative flex flex-col items-center gap-2">

      {/* Статусная подсказка */}
      {(status || isRecording || isProcessing) && (
        <div
          className="absolute bottom-[calc(100%+10px)] right-0 rounded-2xl px-3 py-2 text-[11px] text-white/80 whitespace-nowrap max-w-[240px] truncate shadow-lg"
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
      )}

      {/* Волны громкости при записи */}
      {isRecording && (
        <div
          className="absolute bottom-[calc(100%+38px)] right-0 flex items-end gap-[2px] rounded-xl px-2 py-1.5"
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
      )}

      {/* Сама кнопка */}
      <button
        onClick={toggleRecording}
        disabled={isProcessing}
        title={isRecording ? "Остановить запись" : "Надиктовать наполнение голосом"}
        className="relative flex items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-50 disabled:cursor-wait"
        style={{
          width: 52,
          height: 52,
          background: isRecording
            ? "linear-gradient(135deg, #dc2626, #ef4444)"
            : "linear-gradient(135deg, #6d28d9, #7c3aed)",
          boxShadow: isRecording
            ? "0 0 0 4px rgba(239,68,68,0.25), 0 4px 16px rgba(239,68,68,0.35)"
            : "0 0 0 3px rgba(124,58,237,0.2), 0 4px 16px rgba(124,58,237,0.3)",
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
            ? <Icon name="Square" size={18} style={{ color: "#fff" }} />
            : <Icon name="Mic" size={20} style={{ color: "#fff" }} />
        }
      </button>
    </div>
  );
}
