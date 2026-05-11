import { useEffect, useRef } from "react";
import type { FloorItem, Segment, SegmentPriceItem } from "./planTypes";

interface Props {
  activeItems: SegmentPriceItem[];
  tapActiveId: number | null;
  expandedId: number | null;
  hoverSegId: string | null;
  isMobile: boolean;
  anyPanelOpen: boolean;
  segments: Segment[];
  floorItems: FloorItem[];
  onCardClick: (priceId: number, e: React.MouseEvent) => void;
  totalByPriceId: (priceId: number) => number;
  isItemOnAllSegs: (priceId: number) => boolean;
}

export default function ActiveItemsSlider({
  activeItems, tapActiveId, expandedId, hoverSegId,
  isMobile, anyPanelOpen,
  onCardClick, totalByPriceId, isItemOnAllSegs,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // При смене активного товара — скроллим к его карточке
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || tapActiveId == null) return;
    const card = el.querySelector(`[data-active-item="${tapActiveId}"]`) as HTMLElement | null;
    if (!card) return;
    const containerLeft = el.getBoundingClientRect().left;
    const cardLeft = card.getBoundingClientRect().left;
    el.scrollBy({ left: cardLeft - containerLeft - 20, behavior: "smooth" });
  }, [tapActiveId]);

  if (activeItems.length === 0 || anyPanelOpen) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: isMobile ? 90 : 110,
      left: 0,
      right: 0,
      zIndex: 9999,
      display: "flex",
      justifyContent: "center",
      pointerEvents: "none",
      padding: "16px 0 0 0",
    }}>
      <div ref={scrollRef} style={{
        display: "flex", gap: 8, alignItems: "flex-end",
        overflowX: "auto", overflowY: "visible",
        padding: "16px 20px 4px 20px",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        pointerEvents: "none",
        maxWidth: "100%",
      }}>
        {activeItems.map(item => {
          const isActive = tapActiveId === item.priceId;
          const isExpanded = expandedId === item.priceId;
          const total = totalByPriceId(item.priceId);
          const unit = item.unit || "";
          const isWallItem = item.isWallItem !== false;

          return (
            <div
              key={item.priceId}
              style={{ position: "relative", flexShrink: 0, scrollSnapAlign: "start" }}
            >
              {/* Сама карточка */}
              <div
                data-active-item={String(item.priceId)}
                style={{
                  position: "relative",
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(12,10,28,0.96)",
                  border: `1px solid ${hoverSegId && isActive ? "rgba(124,58,237,1)" : isExpanded ? "rgba(124,58,237,0.9)" : isActive ? "rgba(124,58,237,0.8)" : "rgba(124,58,237,0.25)"}`,
                  borderRadius: 16, padding: "12px 12px 12px 12px",
                  boxShadow: hoverSegId && isActive
                    ? "0 0 32px rgba(124,58,237,0.7), 0 8px 24px rgba(0,0,0,0.6)"
                    : isExpanded
                      ? "0 0 28px rgba(124,58,237,0.5), 0 8px 24px rgba(0,0,0,0.6)"
                      : isActive
                        ? "0 0 24px rgba(124,58,237,0.45), 0 8px 24px rgba(0,0,0,0.6)"
                        : "0 4px 16px rgba(0,0,0,0.5)",
                  backdropFilter: "blur(14px)",
                  cursor: "grab",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  opacity: isActive || isExpanded ? 1 : 0.7,
                  userSelect: "none",
                  touchAction: "pan-x",
                  maxWidth: 280,
                  pointerEvents: "all",
                }}
                onClick={e => onCardClick(item.priceId, e)}
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
                    color: isActive || isExpanded ? "rgba(196,181,253,1)" : "rgba(255,255,255,0.75)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 170,
                  }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: hoverSegId && isActive ? "rgba(167,139,250,0.9)" : "rgba(167,139,250,0.55)", marginTop: 1 }}>
                    {hoverSegId && isActive
                      ? (isWallItem ? "Отпустите на стене" : "Отпустите на полотне")
                      : isExpanded
                        ? "Нажмите ещё раз чтобы закрыть"
                        : isWallItem ? "Тяните на стену →" : "Нажмите → на полотно"}
                  </div>
                </div>

                {/* Кружок с суммарными метрами */}
                {total > 0 && (
                  <div style={{
                    position: "absolute", top: -10, right: -10,
                    minWidth: 26, height: 20, borderRadius: 10,
                    background: "rgba(124,58,237,1)",
                    border: "2px solid rgba(12,10,28,0.96)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 5px",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                      {total}{unit ? ` ${unit}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
