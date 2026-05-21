/**
 * VoiceResultPopup — анимированный попап результатов голосового распознавания.
 *
 * Фаза 1 (pending): позиции из транскрипта появляются одна за другой с анимацией печатания,
 *                   справа крутится лоадер — имитация работы пока бот думает.
 * Фаза 2 (done):    лоадеры заменяются на ✓ (зелёный) / ✗ (красный) по реальному результату.
 *                   Если всё распознано — попап исчезает через 1.5 сек.
 *                   Если есть нераспознанные — остаются только они с крестиком закрыть.
 */

import { useEffect, useRef, useState } from "react";

export interface VoiceResultItem {
  label: string;         // Текст позиции из транскрипта
  status: "pending" | "ok" | "fail";
}

interface Props {
  items: VoiceResultItem[];
  onClose: () => void;
}

// Разбивает сырой транскрипт на позиции
export function splitTranscriptToItems(transcript: string): string[] {
  // Разбиваем по запятым, союзам, и/или, точкам
  const parts = transcript
    .split(/[,;]|\sи\s|\sа\s|\sплюс\s|\sтакже\s|\sещ[её]\s/i)
    .map(p => p.trim())
    .filter(p => p.length > 2);
  return parts.length > 0 ? parts : [transcript.trim()];
}

export default function VoiceResultPopup({ items, onClose }: Props) {
  // Сколько позиций уже "напечатано"
  const [visibleCount, setVisibleCount] = useState(0);
  // Для эффекта печатания текущей позиции
  const [typedChars, setTypedChars] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const typeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const allDone = items.length > 0 && items.every(it => it.status !== "pending");
  const hasFailures = items.some(it => it.status === "fail");
  const failItems = items.filter(it => it.status === "fail");

  // Анимация появления позиций по очереди
  useEffect(() => {
    if (items.length === 0) return;
    setVisibleCount(0);
    setTypedChars(0);

    const showNext = (idx: number) => {
      if (idx >= items.length) return;
      setVisibleCount(idx + 1);
      setTypedChars(0);

      // Анимация печатания для текущей позиции
      const label = items[idx].label;
      let charIdx = 0;
      const typeNext = () => {
        charIdx++;
        setTypedChars(charIdx);
        if (charIdx < label.length) {
          typeTimerRef.current = setTimeout(typeNext, 18);
        } else {
          // Закончили печатать — через 350мс показываем следующую
          timerRef.current = setTimeout(() => showNext(idx + 1), 350);
        }
      };
      typeTimerRef.current = setTimeout(typeNext, 18);
    };

    showNext(0);
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(typeTimerRef.current);
    };
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Когда бот вернул результат и всё ok — закрываемся через 1.5 сек
  useEffect(() => {
    if (!allDone || hasFailures) return;
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [allDone, hasFailures, onClose]);

  if (items.length === 0) return null;

  // Если все распознаны и анимация завершения — показываем полный список со статусами
  // Если есть failures — показываем только failures
  const displayItems = allDone && hasFailures ? failItems : items.slice(0, visibleCount);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 100,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10010,
        width: "min(380px, calc(100vw - 32px))",
        background: "rgba(10,8,24,0.97)",
        border: "1px solid rgba(124,58,237,0.45)",
        borderRadius: 16,
        boxShadow: "0 0 40px rgba(124,58,237,0.2), 0 16px 48px rgba(0,0,0,0.8)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
        animation: "voicePopupIn 0.2s ease",
      }}
    >
      <style>{`
        @keyframes voicePopupIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinLoader {
          to { transform: rotate(360deg); }
        }
        @keyframes pulseOk {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      {/* Заголовок */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: allDone && !hasFailures ? "#10b981" : allDone && hasFailures ? "#ef4444" : "#7c3aed",
            boxShadow: allDone && !hasFailures ? "0 0 8px #10b981" : allDone && hasFailures ? "0 0 8px #ef4444" : "0 0 8px #7c3aed",
            animation: !allDone ? "pulseOk 1s ease infinite alternate" : undefined,
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(196,181,253,0.9)", letterSpacing: "0.05em" }}>
            {allDone && !hasFailures
              ? "Все позиции добавлены"
              : allDone && hasFailures
                ? `Не распознано: ${failItems.length} поз.`
                : "Распознаю..."}
          </span>
        </div>
        {(allDone && hasFailures) && (
          <button
            onClick={onClose}
            style={{
              width: 22, height: 22, borderRadius: 6,
              background: "rgba(255,255,255,0.07)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1,
            }}
          >×</button>
        )}
      </div>

      {/* Список позиций */}
      <div style={{ padding: "6px 0 6px" }}>
        {displayItems.map((item, idx) => {
          const isCurrentlyTyping = !allDone && idx === visibleCount - 1;
          const displayLabel = isCurrentlyTyping
            ? item.label.slice(0, typedChars)
            : item.label;

          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 14px",
                animation: idx === visibleCount - 1 && !allDone ? "fadeSlideIn 0.2s ease" : undefined,
              }}
            >
              {/* Название */}
              <div style={{
                flex: 1,
                fontSize: 12,
                fontWeight: 500,
                color: item.status === "fail" ? "rgba(252,165,165,0.9)" : "rgba(255,255,255,0.85)",
                lineHeight: 1.4,
                minWidth: 0,
              }}>
                {displayLabel}
                {isCurrentlyTyping && (
                  <span style={{
                    display: "inline-block",
                    width: 2, height: "1em",
                    background: "#a78bfa",
                    marginLeft: 2,
                    verticalAlign: "text-bottom",
                    animation: "pulseOk 0.5s ease infinite alternate",
                  }} />
                )}
              </div>

              {/* Статус справа */}
              <div style={{ flexShrink: 0, width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.status === "pending" && (
                  <div style={{
                    width: 14, height: 14,
                    border: "2px solid rgba(124,58,237,0.3)",
                    borderTopColor: "#a78bfa",
                    borderRadius: "50%",
                    animation: "spinLoader 0.7s linear infinite",
                  }} />
                )}
                {item.status === "ok" && (
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: "rgba(16,185,129,0.2)",
                    border: "1.5px solid #10b981",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    animation: "pulseOk 0.3s ease",
                  }}>
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                {item.status === "fail" && (
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: "rgba(239,68,68,0.15)",
                    border: "1.5px solid #ef4444",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    animation: "pulseOk 0.3s ease",
                  }}>
                    <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                      <path d="M1 1L6 6M6 1L1 6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Баннер нераспознанных */}
      {allDone && hasFailures && (
        <div style={{
          margin: "0 10px 10px",
          padding: "8px 12px",
          borderRadius: 10,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          fontSize: 10,
          color: "rgba(252,165,165,0.8)",
          lineHeight: 1.5,
        }}>
          Эти позиции не найдены в прайсе. Попробуйте добавить их вручную из каталога.
        </div>
      )}
    </div>
  );
}
