import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SegmentPriceItem } from "./planTypes";

interface Props {
  item: SegmentPriceItem | null;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
  defaultQuantity?: number;
  isEditing?: boolean;         // true = режим редактирования (кнопка ОК вместо Добавить)
  onReplace?: () => void;      // если передан — показываем кнопку "Заменить"
}

export default function PlanQuantityModal({ item, onConfirm, onCancel, defaultQuantity, isEditing, onReplace }: Props) {
  const [value, setValue] = useState("1");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      const existing = (item as SegmentPriceItem & { quantity?: number }).quantity;
      // Приоритет: существующее quantity > площадь полотна > 1
      const initial = existing ?? defaultQuantity ?? 1;
      setValue(String(Math.round(initial * 100) / 100));
      setTimeout(() => { inputRef.current?.select(); }, 50);
    }
  }, [item, defaultQuantity]);

  if (!item) return null;

  const unit = item.unit || "шт";

  const commit = () => {
    const n = parseFloat(value.replace(",", "."));
    if (!isNaN(n) && n > 0) onConfirm(n);
  };

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "rgba(17,12,36,0.98)",
          border: "1px solid rgba(124,58,237,0.4)",
          borderRadius: 20,
          padding: "24px 20px 20px",
          width: "min(300px, calc(100vw - 32px))",
          boxSizing: "border-box",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Товар */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0,
            background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {item.imageUrl
              ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 22 }}>📦</span>}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(196,181,253,1)", lineHeight: 1.3 }}>
              {item.name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(167,139,250,0.55)", marginTop: 2 }}>
              {isEditing ? "Редактирование количества" : "Добавить на полотно"}
            </div>
          </div>
        </div>

        {/* Ввод количества */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Количество, {unit}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "visible" }}>
            <button
              onClick={() => setValue(v => { const n = parseFloat(v) || 1; return String(Math.max(1, n - 1)); })}
              style={{
                width: 32, height: 36, borderRadius: 10, flexShrink: 0,
                background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
                color: "rgba(196,181,253,1)", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >−</button>
            <input
              ref={inputRef}
              type="number" min={1} step={1}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") onCancel();
              }}
              style={{
                flex: 1, minWidth: 0, height: 36, borderRadius: 10, textAlign: "center",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(124,58,237,0.4)",
                color: "#fff", fontSize: 16, fontWeight: 700,
                outline: "none",
              }}
            />
            <button
              onClick={() => setValue(v => String((parseFloat(v) || 0) + 1))}
              style={{
                width: 32, height: 36, borderRadius: 10, flexShrink: 0,
                background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
                color: "rgba(196,181,253,1)", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >+</button>
          </div>
        </div>

        {/* Кнопки */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Кнопка Заменить — только в режиме редактирования */}
          {isEditing && onReplace && (
            <button
              onClick={onReplace}
              style={{
                width: "100%", height: 38, borderRadius: 12,
                background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.4)",
                color: "rgba(196,181,253,1)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >Заменить товар</button>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, height: 38, borderRadius: 12,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer",
              }}
            >Отмена</button>
            <button
              onClick={commit}
              style={{
                flex: 2, height: 38, borderRadius: 12,
                background: "rgba(124,58,237,1)", border: "none",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >{isEditing ? "ОК" : "Добавить"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}