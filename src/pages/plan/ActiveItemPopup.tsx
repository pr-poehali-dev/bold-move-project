import { useRef, useState } from "react";
import type { SegmentPriceItem } from "./planTypes";

interface Props {
  item: SegmentPriceItem;
  /** Позиция попапа: центр по X, отступ снизу */
  pos: { x: number; bottom: number };
  total: number;
  onAllSegs: boolean;
  hasSegments: boolean;
  selectedSegmentIds?: string[];
  onClose: () => void;
  onRemoveActiveItem: (priceId: number) => void;
  onAssignToAllSegs: (item: SegmentPriceItem) => void;
  onRemoveFromAllSegs: (priceId: number) => void;
  onAdjustQuantity: (priceId: number, delta: number) => void;
  onSetQuantity: (priceId: number, value: number) => void;
  onAddToFloor?: (item: SegmentPriceItem) => void;
  onReplaceItem?: (item: SegmentPriceItem) => void;
  onAssignToSelectedSegs?: (item: SegmentPriceItem, segIds: string[]) => void;
}

// Попап быстрых функций товара — используется и в нижнем баре, и в боковой панели
export default function ActiveItemPopup({
  item, pos, total, onAllSegs, hasSegments, selectedSegmentIds = [],
  onClose,
  onRemoveActiveItem, onAssignToAllSegs, onRemoveFromAllSegs,
  onAdjustQuantity, onSetQuantity, onAddToFloor, onReplaceItem, onAssignToSelectedSegs,
}: Props) {
  const [qtyInput, setQtyInput] = useState<string>("");
  const [qtyEditing, setQtyEditing] = useState(false);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const perWallQty = total > 0 ? total : 1;
  const unit = item.unit || "";
  const isWall = item.isWallItem !== false;
  const popupW = 320;
  const clampedX = Math.max(popupW / 2 + 8, Math.min(window.innerWidth - popupW / 2 - 8, pos.x));

  return (
    <div
      data-item-popup="1"
      style={{
        position: "fixed",
        bottom: pos.bottom,
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
            onClose();
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
            onClose();
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

        {/* Счётчик количества */}
        {total > 0 && (
          <div data-item-popup="1" style={{ display: "flex", alignItems: "center", gap: 0, background: "rgba(255,255,255,0.05)", borderRadius: 7, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
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

        {/* Кнопка: добавить на все стены */}
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
              onClose();
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
        {hasSegments && isWall && total > 0 && (
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
              onClose();
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