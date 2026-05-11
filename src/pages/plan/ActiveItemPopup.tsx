import { useRef } from "react";
import type { Segment, SegmentPriceItem } from "./planTypes";

interface Props {
  expandedId: number | null;
  popupPos: { x: number; bottom: number } | null;
  activeItems: SegmentPriceItem[];
  segments: Segment[];
  qtyEditing: boolean;
  qtyInput: string;
  qtyInputRef: React.RefObject<HTMLInputElement>;
  hasSegments: boolean;
  setExpandedId: (id: number | null) => void;
  setPopupPos: (pos: { x: number; bottom: number } | null) => void;
  setQtyEditing: (v: boolean) => void;
  setQtyInput: (v: string) => void;
  onRemoveActiveItem: (priceId: number) => void;
  onAdjustQuantity: (priceId: number, delta: number) => void;
  onSetQuantity: (priceId: number, value: number) => void;
  onAssignToAllSegs: (item: SegmentPriceItem) => void;
  onRemoveFromAllSegs: (priceId: number) => void;
  isItemOnAllSegs: (priceId: number) => boolean;
  onAddToFloor?: (item: SegmentPriceItem) => void;
  totalByPriceId: (priceId: number) => number;
}

export default function ActiveItemPopup({
  expandedId, popupPos, activeItems, segments,
  qtyEditing, qtyInput, qtyInputRef, hasSegments,
  setExpandedId, setPopupPos, setQtyEditing, setQtyInput,
  onRemoveActiveItem, onAdjustQuantity, onSetQuantity,
  onAssignToAllSegs, onRemoveFromAllSegs, isItemOnAllSegs,
  onAddToFloor, totalByPriceId,
}: Props) {
  if (expandedId == null || !popupPos) return null;

  const item = activeItems.find(it => it.priceId === expandedId);
  if (!item) return null;

  const total = totalByPriceId(item.priceId);

  // Количество на одной стене (не суммарное) — то что реально меняем
  const perWallQty = (() => {
    const seg = segments.find(s => (s.items ?? []).some(it => it.priceId === item.priceId));
    const found = seg?.items?.find(it => it.priceId === item.priceId);
    return Math.round((found?.quantity ?? 1) * 100) / 100;
  })();

  const unit = item.unit || "";
  const onAllSegs = isItemOnAllSegs(item.priceId);
  const isWall = item.isWallItem !== false;
  const popupW = 224;
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
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
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

      {/* Строка: счётчик + все стены */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Счётчик количества (по стенам) */}
        {onAllSegs && (
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

        {/* Тогл: все стены (только для wall-items) или кнопка "На полотно" */}
        {hasSegments && isWall && (
          <button
            data-item-popup="1"
            onClick={e => {
              e.stopPropagation();
              if (onAllSegs) onRemoveFromAllSegs(item.priceId);
              else onAssignToAllSegs(item);
            }}
            style={{
              flex: 1, height: 26, borderRadius: 7, cursor: "pointer",
              border: `1px solid ${onAllSegs ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.12)"}`,
              background: onAllSegs ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.04)",
              color: onAllSegs ? "rgba(196,181,253,1)" : "rgba(255,255,255,0.45)",
              fontSize: 10, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >
            {onAllSegs
              ? <><svg width="10" height="8" viewBox="0 0 10 8" fill="none" style={{flexShrink:0}}><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Все стены</>
              : <>+ Все стены</>
            }
          </button>
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
}
