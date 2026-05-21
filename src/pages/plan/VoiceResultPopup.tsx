/**
 * VoiceResultPopup — попап результатов голосового распознавания.
 *
 * Фаза 1 (pending): позиции сразу видны все, справа крутится лоадер.
 * Фаза 2 (done):    лоадеры → ✓ (зелёный) / ✗ (красный).
 *                   Если всё ok — попап закрывается через 1.5 сек.
 *                   Если есть fail — остаются только они.
 */

import { useEffect } from "react";

export interface VoiceResultItem {
  label: string;
  status: "pending" | "ok" | "fail";
}

interface Props {
  items: VoiceResultItem[];
  onClose: () => void;
}

// Разбивает транскрипт на позиции.
// "полотно" всегда отдельная строка — отрезаем его перед разбивкой.
export function splitTranscriptToItems(transcript: string): string[] {
  // Сначала выдираем "полотно" как отдельную позицию
  const polotnoRegex = /\b([\w\s-]*полотн[\w\s-]*(?:пвх|ткан[\w]*)?[\w\s]*)\b/gi;
  let rest = transcript;
  const polotnoItems: string[] = [];

  rest = rest.replace(polotnoRegex, (match) => {
    const trimmed = match.trim();
    if (trimmed.length > 3) {
      polotnoItems.push(trimmed);
      return ","; // заменяем на разделитель
    }
    return match;
  });

  // Разбиваем остаток по стандартным разделителям
  const parts = rest
    .split(/[,;.]|\bи\b|\bа\b|\bплюс\b|\bтакже\b|\bещё\b|\bеще\b/i)
    .map(p => p.trim())
    .filter(p => p.length > 2 && !/^[\s,;.]+$/.test(p));

  // Объединяем: сначала обычные позиции, полотна в конец
  const all = [...parts, ...polotnoItems].filter(Boolean);
  return all.length > 0 ? all : [transcript.trim()];
}

export default function VoiceResultPopup({ items, onClose }: Props) {
  const allDone = items.length > 0 && items.every(it => it.status !== "pending");
  const hasFailures = items.some(it => it.status === "fail");
  const failItems = items.filter(it => it.status === "fail");

  // Автозакрытие если всё ok
  useEffect(() => {
    if (!allDone || hasFailures) return;
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [allDone, hasFailures, onClose]);

  if (items.length === 0) return null;

  const displayItems = allDone && hasFailures ? failItems : items;

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
          from { opacity: 0; transform: translateY(4px); }
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

      {/* Шапка — только когда есть результат или ошибки */}
      {allDone && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px 7px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: hasFailures ? "#ef4444" : "#10b981",
              boxShadow: hasFailures ? "0 0 8px #ef4444" : "0 0 8px #10b981",
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(196,181,253,0.9)", letterSpacing: "0.05em" }}>
              {hasFailures ? `Не распознано: ${failItems.length} поз.` : "Все позиции добавлены"}
            </span>
          </div>
          {hasFailures && (
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
      )}

      {/* Список позиций — все сразу, без задержки */}
      <div style={{ padding: "6px 0 6px" }}>
        {displayItems.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 14px",
              animation: "fadeSlideIn 0.15s ease both",
              animationDelay: `${idx * 40}ms`,
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
              {item.label}
            </div>

            {/* Статус */}
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
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 1 }}>
                    <path d="M2 5.5L4 7.5L8 2.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              {item.status === "fail" && (
                <div style={{
                  width: 16, height: 16, borderRadius: "50%",
                  background: "rgba(239,68,68,0.2)",
                  border: "1.5px solid #ef4444",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "pulseOk 0.3s ease",
                }}>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1 1L8 8M8 1L1 8" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
