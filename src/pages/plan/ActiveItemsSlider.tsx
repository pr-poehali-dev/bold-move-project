import { useEffect, useRef, useState } from "react";
import type { FloorItem, Segment, SegmentPriceItem } from "./planTypes";

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
  const [qtyInput, setQtyInput] = useState<string>("");
  const [qtyEditing, setQtyEditing] = useState(false);
  const qtyInputRef = useRef<HTMLInputElement>(null);

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
        setQtyEditing(false);
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
                    <div style={{ fontSize: 10, color: hoverSegId && isActive ? "rgba(167,139,250,0.9)" : "rgba(167,139,250,0.55)", marginTop: 2, whiteSpace: "nowrap" }}>
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

      {/* ── Попап активного товара — fixed поверх всего ── */}
      {expandedId != null && popupPos && (() => {
        const item = activeItems.find(it => it.priceId === expandedId);
        if (!item) return null;
        const total = totalByPriceId(item.priceId);
        // Суммарное количество по всем стенам — то что показываем и меняем
        const perWallQty = total > 0 ? total : 1;
        const unit = item.unit || "";
        const onAllSegs = isItemOnAllSegs(item.priceId);
        const isWall = item.isWallItem !== false;
        const popupW = 320;
        const clampedX = Math.max(popupW / 2 + 8, Math.min(window.innerWidth - popupW / 2 - 8, popupPos.x));
        return (
          <div
            data-item-popup="1"
            style={{
              position: "fixed",
              bottom: popupPos.bottom,
              left: clampedX,
              transform: "translateX(-50%)",
              background: "rgba(12,10,28,0.98)",
              border: "1px solid rgba(124,58,237,0.45)",
              borderRadius: 12,
              padding: "10px 10px 8px",
              width: popupW,
              boxShadow: "0 0 20px rgba(124,58,237,0.25), 0 8px 28px rgba(0,0,0,0.8)",
              backdropFilter: "blur(24px)",
              zIndex: 10002,
              pointerEvents: "all",
              animation: "slideUpFade 0.16s ease",
            }}
          >
            {/* Строка: название + итого + корзина */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "rgba(196,181,253,1)",
                  wordBreak: "break-word", lineHeight: 1.35,
                }}>{item.name}</div>
                {total > 0 && (
                  <div style={{ fontSize: 9.5, color: "rgba(167,139,250,0.65)", marginTop: 1 }}>
                    итого {total} {unit} на чертеже
                  </div>
                )}
              </div>
              {/* Корзина — убрать карточку */}
              <button
                data-item-popup="1"
                onClick={e => {
                  e.stopPropagation();
                  setExpandedId(null);
                  setPopupPos(null);
                  onRemoveActiveItem(item.priceId);
                }}
                title="Убрать карточку"
                style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "rgba(248,113,113,0.8)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M12 3.5l-.7 7.7A1 1 0 0110.3 12H3.7a1 1 0 01-1-.8L2 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 8 }} />

            {/* Кнопка: заменить товар */}
            {onReplaceItem && (
              <button
                data-item-popup="1"
                onClick={e => {
                  e.stopPropagation();
                  setExpandedId(null);
                  setPopupPos(null);
                  onReplaceItem(item);
                }}
                style={{
                  width: "100%", height: 28, borderRadius: 7, cursor: "pointer", marginBottom: 8,
                  border: "1px solid rgba(124,58,237,0.35)",
                  background: "rgba(124,58,237,0.1)",
                  color: "rgba(196,181,253,0.9)",
                  fontSize: 10, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M1 7a6 6 0 1 0 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M1 3v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Заменить товар
              </button>
            )}

            {/* Строка: счётчик + все стены */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

              {/* Счётчик количества — показываем если товар есть хоть на одной стене или полотне */}
              {total > 0 && (
                <div data-item-popup="1" style={{ display: "flex", alignItems: "center", gap: 0, background: "rgba(255,255,255,0.05)", borderRadius: 7, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {/* Кнопка − */}
                  <button
                    data-item-popup="1"
                    onClick={e => { e.stopPropagation(); onAdjustQuantity(item.priceId, -1); }}
                    style={{
                      width: 26, height: 26, border: "none", background: "transparent",
                      color: "rgba(255,255,255,0.55)", fontSize: 15, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >−</button>

                  {/* Поле: клик → редактирование */}
                  {qtyEditing ? (
                    <input
                      ref={qtyInputRef}
                      data-item-popup="1"
                      type="number"
                      value={qtyInput}
                      onChange={e => setQtyInput(e.target.value)}
                      onBlur={e => {
                        const v = parseFloat(e.target.value.replace(",", "."));
                        if (!isNaN(v) && v > 0) onSetQuantity(item.priceId, v);
                        setQtyEditing(false);
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const v = parseFloat(qtyInput.replace(",", "."));
                          if (!isNaN(v) && v > 0) onSetQuantity(item.priceId, v);
                          setQtyEditing(false);
                        }
                        if (e.key === "Escape") setQtyEditing(false);
                        e.stopPropagation();
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: 48, height: 26, border: "none", outline: "none",
                        background: "rgba(124,58,237,0.15)", textAlign: "center",
                        fontSize: 11, fontWeight: 700, color: "rgba(196,181,253,1)",
                        padding: 0,
                      }}
                    />
                  ) : (
                    <div
                      data-item-popup="1"
                      onClick={e => {
                        e.stopPropagation();
                        setQtyInput(String(perWallQty > 0 ? perWallQty : 1));
                        setQtyEditing(true);
                        setTimeout(() => { qtyInputRef.current?.select(); }, 10);
                      }}
                      title="Нажмите чтобы ввести значение"
                      style={{
                        width: 48, height: 26, textAlign: "center", cursor: "text",
                        fontSize: 11, fontWeight: 700, color: "rgba(196,181,253,1)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
                        userSelect: "none",
                      }}
                    >
                      {perWallQty}
                      {unit && <span style={{ fontSize: 8.5, color: "rgba(167,139,250,0.55)" }}>{unit}</span>}
                    </div>
                  )}

                  {/* Кнопка + */}
                  <button
                    data-item-popup="1"
                    onClick={e => { e.stopPropagation(); onAdjustQuantity(item.priceId, 1); }}
                    style={{
                      width: 26, height: 26, border: "none", background: "transparent",
                      color: "rgba(255,255,255,0.55)", fontSize: 15, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >+</button>
                </div>
              )}

              {/* Кнопки: добавить на все стены / снять со всех стен */}
              {hasSegments && isWall && !onAllSegs && (
                <button
                  data-item-popup="1"
                  onClick={e => { e.stopPropagation(); onAssignToAllSegs(item); }}
                  style={{
                    flex: 1, height: 26, borderRadius: 7, cursor: "pointer",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 10, fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    whiteSpace: "nowrap",
                  }}
                >+ Все стены</button>
              )}

              {/* Кнопка: добавить на выбранные стены */}
              {hasSegments && isWall && selectedSegmentIds.length > 0 && onAssignToSelectedSegs && (
                <button
                  data-item-popup="1"
                  onClick={e => {
                    e.stopPropagation();
                    onAssignToSelectedSegs(item, selectedSegmentIds);
                    setExpandedId(null);
                    setPopupPos(null);
                  }}
                  style={{
                    flex: 1, height: 26, borderRadius: 7, cursor: "pointer",
                    border: "1px solid rgba(52,211,153,0.4)",
                    background: "rgba(52,211,153,0.1)",
                    color: "rgba(52,211,153,0.9)",
                    fontSize: 10, fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    whiteSpace: "nowrap",
                  }}
                >+ Выбранные ({selectedSegmentIds.length})</button>
              )}
              {hasSegments && isWall && onAllSegs && (
                <button
                  data-item-popup="1"
                  onClick={e => { e.stopPropagation(); onRemoveFromAllSegs(item.priceId); }}
                  style={{
                    flex: 1, height: 26, borderRadius: 7, cursor: "pointer",
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.08)",
                    color: "rgba(248,113,113,0.85)",
                    fontSize: 10, fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    whiteSpace: "nowrap",
                  }}
                >− Снять со всех</button>
              )}

              {/* Кнопка "На полотно" для ceiling-items */}
              {!isWall && (
                <button
                  data-item-popup="1"
                  onClick={e => {
                    e.stopPropagation();
                    setExpandedId(null);
                    setPopupPos(null);
                    onAddToFloor?.(item);
                  }}
                  style={{
                    flex: 1, height: 26, borderRadius: 7, cursor: "pointer",
                    border: "1px solid rgba(16,185,129,0.4)",
                    background: "rgba(16,185,129,0.1)",
                    color: "rgba(52,211,153,0.9)",
                    fontSize: 10, fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    whiteSpace: "nowrap",
                  }}
                >
                  + На полотно
                </button>
              )}
            </div>

            {/* Стрелка вниз */}
            <div style={{
              position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid rgba(124,58,237,0.45)",
            }} />
          </div>
        );
      })()}
    </>
  );
}