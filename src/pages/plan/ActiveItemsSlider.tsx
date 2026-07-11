import { useEffect, useRef, useState } from "react";
import type { FloorItem, Segment, SegmentPriceItem } from "./planTypes";
import ActiveItemPopup from "./ActiveItemPopup";

interface ActiveItemsSliderProps {
  activeItems: SegmentPriceItem[];
  tapActiveId: number | null;
  hoverSegId: string | null;
  isMobile: boolean;
  segments: Segment[];
  floorItems: FloorItem[];
  anyPanelOpen: boolean;
  onTapActiveId: (id: number | null) => void;
  onRemoveActiveItem: (priceId: number) => void;
  onAssignToAllSegs: (item: SegmentPriceItem) => void;
  onRemoveFromAllSegs: (priceId: number) => void;
  isItemOnAllSegs: (priceId: number) => boolean;
  onAdjustQuantity: (priceId: number, delta: number) => void;
  onSetQuantity: (priceId: number, value: number) => void;
  onAddToFloor?: (item: SegmentPriceItem) => void;
  onReplaceItem?: (item: SegmentPriceItem) => void;
  hasSegments: boolean;
  selectedSegmentIds?: string[];
  onAssignToSelectedSegs?: (item: SegmentPriceItem, segIds: string[]) => void;
}

export default function ActiveItemsSlider({
  activeItems, tapActiveId, hoverSegId, isMobile,
  segments, floorItems, anyPanelOpen,
  onTapActiveId, onRemoveActiveItem,
  onAssignToAllSegs, onRemoveFromAllSegs, isItemOnAllSegs,
  onAdjustQuantity, onSetQuantity, onAddToFloor, onReplaceItem, hasSegments,
  selectedSegmentIds = [], onAssignToSelectedSegs,
}: ActiveItemsSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; bottom: number } | null>(null);


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

  // Закрываем expanded при клике вне
  useEffect(() => {
    if (expandedId == null) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-active-item]") && !target.closest("[data-item-popup]")) {
        setExpandedId(null);
        setPopupPos(null);
      }
    };
    window.addEventListener("mousedown", handler);
    window.addEventListener("touchstart", handler);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [expandedId]);

  // Суммарное кол-во по стенам + полотну
  const totalByPriceId = (priceId: number): number => {
    const fromSegs = segments.reduce((sum, seg) => {
      const found = (seg.items ?? []).find(it => it.priceId === priceId);
      return sum + (found ? (found.quantity ?? 0) : 0);
    }, 0);
    const fromFloor = (floorItems ?? [])
      .filter(fi => fi.priceId === priceId)
      .reduce((sum, fi) => sum + fi.quantity, 0);
    return Math.round((fromSegs + fromFloor) * 100) / 100;
  };

  const handleCardClick = (priceId: number, e: React.MouseEvent) => {
    onTapActiveId(priceId);
    if (expandedId === priceId) {
      setExpandedId(null);
      setPopupPos(null);
      return;
    }
    const card = (e.currentTarget as HTMLElement);
    const rect = card.getBoundingClientRect();
    // Центрируем попап по центру иконки (38px + 12px padding слева)
    const iconCenterX = rect.left + 12 + 19;
    const bottomFromTop = window.innerHeight - rect.top + 8;
    setExpandedId(priceId);
    setPopupPos({ x: iconCenterX, bottom: bottomFromTop });
  };

  return (
    <>
      {/* ── Активные карточки внизу — горизонтальный слайдер ── */}
      {activeItems.length > 0 && !anyPanelOpen && (
        <div style={{
          position: "fixed",
          bottom: isMobile ? 90 : 140,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          padding: "16px 0 0 0",
        }}>
        <div ref={scrollRef}
          onWheel={e => {
            // На ПК вертикальное колесо мыши → горизонтальный скролл ленты
            const el = e.currentTarget;
            if (el.scrollWidth <= el.clientWidth) return;
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              el.scrollLeft += e.deltaY;
            }
          }}
          style={{
          display: "flex", gap: 8, alignItems: "flex-end",
          overflowX: "auto", overflowY: "visible",
          padding: "16px 20px 4px 20px",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          pointerEvents: "auto",
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
                    border: `1px solid ${hoverSegId && isActive ? "rgba(239,68,68,1)" : isExpanded ? "rgba(124,58,237,0.9)" : isActive ? "rgba(124,58,237,0.8)" : "rgba(124,58,237,0.25)"}`,
                    borderRadius: 16, padding: "12px 12px 12px 12px",
                    boxShadow: hoverSegId && isActive
                      ? "0 0 32px rgba(239,68,68,0.7), 0 8px 24px rgba(0,0,0,0.6)"
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
                    maxWidth: 320,
                    pointerEvents: "all",
                  }}
                  onClick={e => handleCardClick(item.priceId, e)}
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
                  <div style={{ minWidth: 0, maxWidth: 220 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: isActive || isExpanded ? "rgba(196,181,253,1)" : "rgba(255,255,255,0.75)",
                      wordBreak: "break-word",
                      lineHeight: 1.3,
                    }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: hoverSegId && isActive ? "rgba(252,165,165,0.95)" : "rgba(167,139,250,0.55)", marginTop: 2, whiteSpace: "nowrap" }}>
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
      )}

      {/* ── Попап активного товара — вынесен в переиспользуемый компонент ── */}
      {expandedId != null && popupPos && (() => {
        const item = activeItems.find(it => it.priceId === expandedId);
        if (!item) return null;
        return (
          <ActiveItemPopup
            item={item}
            pos={popupPos}
            total={totalByPriceId(item.priceId)}
            onAllSegs={isItemOnAllSegs(item.priceId)}
            hasSegments={hasSegments}
            selectedSegmentIds={selectedSegmentIds}
            onClose={() => { setExpandedId(null); setPopupPos(null); }}
            onRemoveActiveItem={onRemoveActiveItem}
            onAssignToAllSegs={onAssignToAllSegs}
            onRemoveFromAllSegs={onRemoveFromAllSegs}
            onAdjustQuantity={onAdjustQuantity}
            onSetQuantity={onSetQuantity}
            onAddToFloor={onAddToFloor}
            onReplaceItem={onReplaceItem}
            onAssignToSelectedSegs={onAssignToSelectedSegs}
          />
        );
      })()}
    </>
  );
}