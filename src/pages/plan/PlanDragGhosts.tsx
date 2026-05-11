import { useEffect, useRef, useState } from "react";
import type { FloorItem, Segment, SegmentPriceItem } from "./planTypes";

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
  floorItems: FloorItem[];
  anyPanelOpen: boolean;
  onTapActiveId: (id: number | null) => void;
  onRemoveActiveItem: (priceId: number) => void;
  onAssignToAllSegs: (item: SegmentPriceItem) => void;
  onRemoveFromAllSegs: (priceId: number) => void;
  isItemOnAllSegs: (priceId: number) => boolean;
  hasSegments: boolean;
}

export default function PlanDragGhosts({
  dragItem, dragPos,
  dragCardItem, dragCardPos,
  activeItems, tapActiveId,
  hoverSegId, isMobile,
  segments, floorItems, anyPanelOpen,
  onTapActiveId, onRemoveActiveItem,
  onAssignToAllSegs, onRemoveFromAllSegs, isItemOnAllSegs, hasSegments,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const handleCardClick = (priceId: number) => {
    onTapActiveId(priceId);
    setExpandedId(prev => prev === priceId ? null : priceId);
  };

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
      {activeItems.length > 0 && !anyPanelOpen && (
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
            const onAllSegs = isItemOnAllSegs(item.priceId);

            return (
              <div
                key={item.priceId}
                style={{ position: "relative", flexShrink: 0, scrollSnapAlign: "start" }}
              >
                {/* Pop-up панель — раскрывается вверх */}
                {isExpanded && (
                  <div
                    data-item-popup="1"
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(14,12,30,0.97)",
                      border: "1px solid rgba(124,58,237,0.5)",
                      borderRadius: 14,
                      padding: "12px 14px",
                      minWidth: 200,
                      boxShadow: "0 0 24px rgba(124,58,237,0.3), 0 8px 32px rgba(0,0,0,0.7)",
                      backdropFilter: "blur(20px)",
                      zIndex: 10001,
                      pointerEvents: "all",
                      animation: "slideUpFade 0.18s ease",
                    }}
                  >
                    {/* Название */}
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "rgba(196,181,253,1)",
                      marginBottom: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{item.name}</div>

                    {/* Итого на чертеже */}
                    {total > 0 && (
                      <div style={{
                        fontSize: 10, color: "rgba(255,255,255,0.4)",
                        marginBottom: 10,
                      }}>
                        На чертеже: <span style={{ color: "rgba(167,139,250,0.9)", fontWeight: 600 }}>{total} {unit}</span>
                      </div>
                    )}

                    {/* Разделитель */}
                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 10 }} />

                    {/* Чекбокс: добавить/убрать со всех стен */}
                    {hasSegments && (
                      <label
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          cursor: "pointer", marginBottom: 10,
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          if (onAllSegs) {
                            onRemoveFromAllSegs(item.priceId);
                          } else {
                            onAssignToAllSegs(item);
                          }
                        }}
                      >
                        {/* Кастомный чекбокс */}
                        <div style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                          border: `1.5px solid ${onAllSegs ? "rgba(124,58,237,1)" : "rgba(255,255,255,0.25)"}`,
                          background: onAllSegs ? "rgba(124,58,237,1)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}>
                          {onAllSegs && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", userSelect: "none" }}>
                          {onAllSegs ? "Убрать со всех стен" : "Добавить на все стены"}
                        </span>
                      </label>
                    )}

                    {/* Кнопка удалить карточку */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setExpandedId(null);
                        onRemoveActiveItem(item.priceId);
                      }}
                      style={{
                        width: "100%", padding: "6px 10px",
                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                        borderRadius: 8, color: "rgba(248,113,113,0.9)",
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        transition: "background 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 13 }}>✕</span> Убрать карточку
                    </button>

                    {/* Треугольник-стрелка вниз */}
                    <div style={{
                      position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
                      width: 10, height: 6,
                      background: "rgba(14,12,30,0.97)",
                      clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                      borderLeft: "1px solid rgba(124,58,237,0.5)",
                      borderRight: "1px solid rgba(124,58,237,0.5)",
                    }} />
                  </div>
                )}

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
                  onClick={() => handleCardClick(item.priceId)}
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
                      {hoverSegId && isActive ? "Отпустите на стене" : isExpanded ? "Нажмите ещё раз чтобы закрыть" : "Тяните на стену →"}
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

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}
