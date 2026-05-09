import type { Segment, SegmentPriceItem } from "./planTypes";

interface Props {
  dragItem: SegmentPriceItem | null;
  dragPos: { x: number; y: number } | null;
  dragCardItem: SegmentPriceItem | null;
  dragCardPos: { x: number; y: number } | null;
  activeItems: SegmentPriceItem[];
  tapActiveId: number | null;
  hoverSegId: string | null;
  isMobile: boolean;
  segments: Segment[];
  onTapActiveId: (id: number) => void;
  onRemoveActiveItem: (priceId: number) => void;
}

export default function PlanDragGhosts({
  dragItem, dragPos,
  dragCardItem, dragCardPos,
  activeItems, tapActiveId,
  hoverSegId, isMobile,
  segments,
  onTapActiveId, onRemoveActiveItem,
}: Props) {
  // Считаем суммарное кол-во товара по всем стенам
  const totalByPriceId = (priceId: number): number =>
    segments.reduce((sum, seg) => {
      const found = (seg.items ?? []).find(it => it.priceId === priceId);
      return sum + (found ? (found.quantity ?? 1) : 0);
    }, 0);
  return (
    <>
      {/* ── Drag ghost — летит за курсором на десктопе ── */}
      {dragItem && dragPos && (
        <div style={{
          position: "fixed",
          left: dragPos.x - 22, top: dragPos.y - 22,
          zIndex: 9999, pointerEvents: "none",
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(15,16,23,0.92)",
          border: `1px solid ${hoverSegId ? "rgba(124,58,237,0.7)" : "rgba(255,255,255,0.15)"}`,
          borderRadius: 12, padding: "6px 10px 6px 6px",
          boxShadow: hoverSegId ? "0 0 20px rgba(124,58,237,0.4)" : "0 4px 20px rgba(0,0,0,0.5)",
          transition: "border-color 0.15s, box-shadow 0.15s", maxWidth: 180,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0,
            background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {dragItem.imageUrl
              ? <img src={dragItem.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 16 }}>📦</span>}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: hoverSegId ? "rgba(167,139,250,1)" : "rgba(255,255,255,0.8)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{dragItem.name}</span>
        </div>
      )}

      {/* ── Ghost карточки при drag из нижней панели ── */}
      {dragCardItem && dragCardPos && (
        <div
          style={{
            position: "fixed",
            left: dragCardPos.x - 70,
            top:  dragCardPos.y - 30,
            zIndex: 9998,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: hoverSegId ? "rgba(124,58,237,0.25)" : "rgba(12,10,28,0.88)",
            border: `1.5px solid ${hoverSegId ? "rgba(124,58,237,0.9)" : "rgba(124,58,237,0.4)"}`,
            borderRadius: 14,
            padding: "7px 12px 7px 8px",
            backdropFilter: "blur(16px)",
            boxShadow: hoverSegId
              ? "0 0 28px rgba(124,58,237,0.6), 0 8px 24px rgba(0,0,0,0.5)"
              : "0 4px 20px rgba(0,0,0,0.5)",
            transform: hoverSegId ? "scale(0.88)" : "scale(1)",
            opacity: hoverSegId ? 0.85 : 1,
            transition: "transform 0.18s ease, opacity 0.18s ease, background 0.15s, box-shadow 0.15s",
            maxWidth: 180,
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8, overflow: "hidden", flexShrink: 0,
            background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {dragCardItem.imageUrl
              ? <img src={dragCardItem.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 16 }}>📦</span>}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: hoverSegId ? "rgba(196,181,253,1)" : "rgba(255,255,255,0.85)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            transition: "color 0.15s",
          }}>{dragCardItem.name}</span>
          {hoverSegId && (
            <span style={{ fontSize: 14, marginLeft: 2, animation: "pulse 0.6s ease-in-out infinite alternate" }}>
              →
            </span>
          )}
        </div>
      )}

      {/* ── Активные карточки внизу — горизонтальный слайдер ── */}
      {activeItems.length > 0 && (
        <div style={{
          position: "fixed", bottom: isMobile ? 90 : 16, left: 0, right: isMobile ? 0 : "auto",
          ...(isMobile ? {} : { left: "50%", transform: "translateX(-50%)" }),
          zIndex: 9999,
          display: "flex", gap: 8, alignItems: "flex-end",
          overflowX: "auto", overflowY: "visible",
          padding: "4px 16px 4px 16px",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          pointerEvents: "all",
        }}>
          {activeItems.map(item => {
            const isActive = tapActiveId === item.priceId;
            const total = totalByPriceId(item.priceId);
            return (
              <div
                key={item.priceId}
                data-active-item={String(item.priceId)}
                style={{
                  position: "relative",
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(12,10,28,0.96)",
                  border: `1px solid ${hoverSegId && isActive ? "rgba(124,58,237,1)" : isActive ? "rgba(124,58,237,0.8)" : "rgba(124,58,237,0.25)"}`,
                  borderRadius: 16, padding: "10px 10px 10px 10px",
                  boxShadow: hoverSegId && isActive
                    ? "0 0 32px rgba(124,58,237,0.7), 0 8px 24px rgba(0,0,0,0.6)"
                    : isActive
                      ? "0 0 24px rgba(124,58,237,0.45), 0 8px 24px rgba(0,0,0,0.6)"
                      : "0 4px 16px rgba(0,0,0,0.5)",
                  backdropFilter: "blur(14px)",
                  cursor: "grab",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  opacity: isActive ? 1 : 0.7,
                  userSelect: "none",
                  touchAction: "pan-x",
                  flexShrink: 0,
                  scrollSnapAlign: "start",
                  maxWidth: 220,
                }}
                onClick={() => onTapActiveId(item.priceId)}
              >
                {/* Иконка */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                  background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 20 }}>📦</span>}
                </div>
                {/* Название + подсказка */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: isActive ? "rgba(196,181,253,1)" : "rgba(255,255,255,0.75)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 120,
                  }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: hoverSegId && isActive ? "rgba(167,139,250,0.9)" : "rgba(167,139,250,0.55)", marginTop: 1 }}>
                    {hoverSegId && isActive ? "Отпустите на стене" : "Тяните на стену →"}
                  </div>
                </div>
                {/* Кнопка удаления */}
                <button
                  onClick={e => { e.stopPropagation(); onRemoveActiveItem(item.priceId); }}
                  style={{
                    width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.35)", fontSize: 11, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>

                {/* Кружок с суммарным количеством */}
                {total > 0 && (
                  <div style={{
                    position: "absolute", top: -8, right: -8,
                    minWidth: 20, height: 20, borderRadius: 10,
                    background: "rgba(124,58,237,1)",
                    border: "2px solid rgba(12,10,28,0.96)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 5px",
                    pointerEvents: "none",
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                      {total}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}