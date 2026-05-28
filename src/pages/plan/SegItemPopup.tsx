import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import type { SegmentPriceItem } from "./planTypes";

interface Props {
  item: SegmentPriceItem & { quantity: number };
  segId: string;
  anchorX: number; // экранные координаты (clientX)
  anchorY: number; // экранные координаты (clientY)
  onClose: () => void;
  onRemove: (segId: string, priceId: number) => void;
  onReplace: (segId: string, priceId: number) => void;
  onQuantityChange: (segId: string, priceId: number, quantity: number) => void;
}

export default function SegItemPopup({
  item, segId, anchorX, anchorY, onClose, onRemove, onReplace, onQuantityChange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [qty, setQty] = useState(item.quantity);

  // Закрываем по клику вне попапа
  useEffect(() => {
    const handle = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("pointerdown", handle, true);
    return () => window.removeEventListener("pointerdown", handle, true);
  }, [onClose]);

  // Позиционируем попап чтобы не выходил за экран
  const popW = 220;
  const popH = 180;
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  let left = anchorX - popW / 2;
  let top = anchorY - popH - 16;
  if (left < 8) left = 8;
  if (left + popW > vpW - 8) left = vpW - popW - 8;
  if (top < 8) top = anchorY + 16;
  if (top + popH > vpH - 8) top = vpH - popH - 8;

  const handleQtyChange = (delta: number) => {
    const newQty = Math.max(0.1, Math.round((qty + delta) * 10) / 10);
    setQty(newQty);
    onQuantityChange(segId, item.priceId, newQty);
  };

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left,
        top,
        width: popW,
        zIndex: 9999,
        background: "rgba(17,12,36,0.97)",
        border: "1px solid rgba(124,58,237,0.5)",
        borderRadius: 14,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Название */}
      <div style={{
        color: "#c4b5fd", fontSize: 13, fontWeight: 600,
        lineHeight: 1.3, marginBottom: 2,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {item.name}
      </div>

      {/* Количество */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          style={btnStyle("#3b1d6e")}
          onPointerDown={e => { e.stopPropagation(); handleQtyChange(-0.5); }}
        >
          <Icon name="Minus" size={16} />
        </button>
        <span style={{ color: "#e9d5ff", fontSize: 14, fontWeight: 700, flex: 1, textAlign: "center" }}>
          {qty} {item.unit}
        </span>
        <button
          style={btnStyle("#3b1d6e")}
          onPointerDown={e => { e.stopPropagation(); handleQtyChange(0.5); }}
        >
          <Icon name="Plus" size={16} />
        </button>
      </div>

      <div style={{ height: 1, background: "rgba(124,58,237,0.2)", margin: "2px 0" }} />

      {/* Заменить */}
      <button
        style={{ ...rowBtnStyle, color: "#a78bfa" }}
        onPointerDown={e => { e.stopPropagation(); onReplace(segId, item.priceId); onClose(); }}
      >
        <Icon name="RefreshCw" size={15} />
        <span>Заменить позицию</span>
      </button>

      {/* Удалить */}
      <button
        style={{ ...rowBtnStyle, color: "#f87171" }}
        onPointerDown={e => { e.stopPropagation(); onRemove(segId, item.priceId); onClose(); }}
      >
        <Icon name="Trash2" size={15} />
        <span>Удалить со стены</span>
      </button>
    </div>
  );
}

const btnStyle = (bg: string): React.CSSProperties => ({
  width: 32, height: 32,
  background: bg,
  border: "1px solid rgba(124,58,237,0.4)",
  borderRadius: 8,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#c4b5fd",
  cursor: "pointer",
  flexShrink: 0,
});

const rowBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  background: "transparent",
  border: "1px solid rgba(124,58,237,0.2)",
  borderRadius: 8,
  padding: "8px 10px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
  width: "100%",
  textAlign: "left",
};
