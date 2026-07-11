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
  onMove: (segId: string, priceId: number) => void;
  onDuplicate: (segId: string, priceId: number) => void;
  onQuantityChange: (segId: string, priceId: number, quantity: number) => void;
  onAddToSelectedSegs?: (segId: string, priceId: number) => void;
  selectedSegmentsCount?: number;
}

export default function SegItemPopup({
  item, segId, screenX, screenY, onClose, onRemove, onReplace, onMove, onDuplicate, onQuantityChange,
  onAddToSelectedSegs, selectedSegmentsCount = 0,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [qty, setQty] = useState(item.quantity);

  useEffect(() => {
    const handle = (e: PointerEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
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

  const popW = 240;
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const approxH = 220;
  let left = screenX - popW / 2;
  let top = screenY - approxH - 12;
  if (top < 8) top = screenY + 16;
  if (left < 8) left = 8;
  if (left + popW > vpW - 8) left = vpW - popW - 8;
  if (top + approxH > vpH - 8) top = vpH - approxH - 8;

  const changeQty = (delta: number) => {
    const v = Math.max(0.1, Math.round((qty + delta) * 10) / 10);
    setQty(v);
    onQuantityChange(segId, item.priceId, v);
  };

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed", left, top, width: popW, zIndex: 99999,
        background: "rgba(15,10,30,0.98)",
        border: "1px solid rgba(124,58,237,0.5)",
        borderRadius: 14,
        boxShadow: "0 6px 32px rgba(0,0,0,0.7)",
        padding: "10px",
        display: "flex", flexDirection: "column", gap: 7,
        touchAction: "none",
      }}
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      {/* Название */}
      <div style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.name}
      </div>

      {/* Количество */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={btnSm} onPointerDown={e => { e.stopPropagation(); changeQty(-0.5); }}>
          <Icon name="Minus" size={14} />
        </button>
        <span style={{ color: "#e9d5ff", fontSize: 13, fontWeight: 700, flex: 1, textAlign: "center" }}>
          {qty} {item.unit}
        </span>
        <button style={btnSm} onPointerDown={e => { e.stopPropagation(); changeQty(0.5); }}>
          <Icon name="Plus" size={14} />
        </button>
      </div>

      <div style={{ height: 1, background: "rgba(124,58,237,0.18)" }} />

      {/* Переместить */}
      <button style={{ ...rowBtn, color: "#67e8f9" }}
        onPointerDown={e => { e.stopPropagation(); onMove(segId, item.priceId); onClose(); }}>
        <Icon name="ArrowRightLeft" size={13} />
        <span>Переместить на стену</span>
      </button>

      {/* Дублировать */}
      <button style={{ ...rowBtn, color: "#34d399" }}
        onPointerDown={e => { e.stopPropagation(); onDuplicate(segId, item.priceId); onClose(); }}>
        <Icon name="CopyPlus" size={13} />
        <span>Дублировать на стену</span>
      </button>

      {/* Заменить */}
      <button style={{ ...rowBtn, color: "#a78bfa" }}
        onPointerDown={e => { e.stopPropagation(); onReplace(segId, item.priceId); onClose(); }}>
        <Icon name="RefreshCw" size={13} />
        <span>Заменить позицию</span>
      </button>

      {/* Добавить на выбранные стены */}
      {onAddToSelectedSegs && selectedSegmentsCount > 0 && (
        <button style={{ ...rowBtn, color: "#34d399" }}
          onPointerDown={e => { e.stopPropagation(); onAddToSelectedSegs(segId, item.priceId); onClose(); }}>
          <Icon name="CopyPlus" size={13} />
          <span>На выбранные стены ({selectedSegmentsCount})</span>
        </button>
      )}

      {/* Удалить */}
      <button style={{ ...rowBtn, color: "#f87171" }}
        onPointerDown={e => { e.stopPropagation(); onRemove(segId, item.priceId); onClose(); }}>
        <Icon name="Trash2" size={13} />
        <span>Удалить со стены</span>
      </button>
    </div>,
    document.body
  );
}

const btnSm: React.CSSProperties = {
  width: 30, height: 30,
  background: "rgba(59,29,110,0.8)",
  border: "1px solid rgba(124,58,237,0.35)",
  borderRadius: 8,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#c4b5fd", cursor: "pointer", flexShrink: 0,
};

const rowBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  background: "transparent",
  border: "1px solid rgba(124,58,237,0.18)",
  borderRadius: 8, padding: "7px 10px",
  cursor: "pointer", fontSize: 12, fontWeight: 500,
  width: "100%", textAlign: "left",
};