import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import type { SegmentPriceItem } from "./planTypes";

interface Props {
  item: SegmentPriceItem & { quantity: number };
  segId: string;
  screenX: number;
  screenY: number;
  onClose: () => void;
  onRemove: (segId: string, priceId: number) => void;
  onReplace: (segId: string, priceId: number) => void;
  onQuantityChange: (segId: string, priceId: number, quantity: number) => void;
}

export default function SegItemPopup({
  item, segId, screenX, screenY, onClose, onRemove, onReplace, onQuantityChange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [qty, setQty] = useState(item.quantity);

  // Закрываем по тапу/клику вне попапа
  useEffect(() => {
    const handle = (e: PointerEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Небольшая задержка чтобы не закрыться сразу от того же тача что открыл
    const t = setTimeout(() => {
      window.addEventListener("pointerdown", handle, true);
      window.addEventListener("touchstart", handle, true);
    }, 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", handle, true);
      window.removeEventListener("touchstart", handle, true);
    };
  }, [onClose]);

  const popW = 224;
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  let left = screenX - popW / 2;
  let top = screenY - 16;

  // Показываем над точкой тапа, если не влезает — под ней
  const approxH = 190;
  if (top - approxH < 8) top = screenY + 24;
  else top = screenY - approxH - 8;

  if (left < 8) left = 8;
  if (left + popW > vpW - 8) left = vpW - popW - 8;
  if (top + approxH > vpH - 8) top = vpH - approxH - 8;
  if (top < 8) top = 8;

  const handleQtyChange = (delta: number) => {
    const newQty = Math.max(0.1, Math.round((qty + delta) * 10) / 10);
    setQty(newQty);
    onQuantityChange(segId, item.priceId, newQty);
  };

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        left,
        top,
        width: popW,
        zIndex: 99999,
        background: "rgba(17,12,36,0.97)",
        border: "1px solid rgba(124,58,237,0.55)",
        borderRadius: 16,
        boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        padding: "14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        touchAction: "none",
      }}
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      {/* Название */}
      <div style={{
        color: "#c4b5fd", fontSize: 13, fontWeight: 600,
        lineHeight: 1.3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {item.name}
      </div>

      {/* Количество */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button style={btnStyle} onPointerDown={e => { e.stopPropagation(); handleQtyChange(-0.5); }}>
          <Icon name="Minus" size={16} />
        </button>
        <span style={{ color: "#e9d5ff", fontSize: 15, fontWeight: 700, flex: 1, textAlign: "center" }}>
          {qty} {item.unit}
        </span>
        <button style={btnStyle} onPointerDown={e => { e.stopPropagation(); handleQtyChange(0.5); }}>
          <Icon name="Plus" size={16} />
        </button>
      </div>

      <div style={{ height: 1, background: "rgba(124,58,237,0.2)" }} />

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
    </div>,
    document.body
  );
}

const btnStyle: React.CSSProperties = {
  width: 36, height: 36,
  background: "rgba(59,29,110,0.8)",
  border: "1px solid rgba(124,58,237,0.4)",
  borderRadius: 10,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#c4b5fd",
  cursor: "pointer",
  flexShrink: 0,
};

const rowBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  background: "transparent",
  border: "1px solid rgba(124,58,237,0.2)",
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
  width: "100%",
  textAlign: "left",
};
