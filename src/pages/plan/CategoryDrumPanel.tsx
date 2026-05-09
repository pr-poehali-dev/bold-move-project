import { useState, useEffect, useCallback } from "react";
import type { SegmentPriceItem } from "./planTypes";

export interface PriceEntry {
  id: number;
  name: string;
  category: string;
  image_url: string | null;
  category_image_url: string | null;
}

interface ArcItem {
  value: string;
  label: string;
  imageUrl: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prices: PriceEntry[];
  onDragItem: (item: SegmentPriceItem) => void;
}

// Дуга от -110° до -20° по правому краю экрана
const ARC_START_DEG = -110;
const ARC_END_DEG   = -20;
const ARC_R         = 155; // радиус дуги в px

export default function CategoryDrumPanel({ open, onClose, prices, onDragItem }: Props) {
  const [mode,             setMode]             = useState<"categories" | "items">("categories");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [visible,          setVisible]          = useState(false);

  useEffect(() => {
    if (open)  { setTimeout(() => setVisible(true), 10); }
    else       { setVisible(false); }
  }, [open]);

  useEffect(() => {
    if (!open) { setTimeout(() => { setMode("categories"); setSelectedCategory(""); }, 300); }
  }, [open]);

  // Уникальные категории
  const categories: ArcItem[] = (() => {
    const seen = new Set<string>();
    const result: ArcItem[] = [];
    for (const p of prices) {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        result.push({ value: p.category, label: p.category, imageUrl: p.category_image_url });
      }
    }
    return result;
  })();

  // Товары выбранной категории
  const catItems: ArcItem[] = prices
    .filter(p => p.category === selectedCategory)
    .map(p => ({ value: String(p.id), label: p.name, imageUrl: p.image_url }));

  const arcItems = mode === "categories" ? categories : catItems;
  const count    = arcItems.length;

  const handleCategoryClick = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setMode("items");
  }, []);

  const handleItemClick = useCallback((itemValue: string) => {
    const price = prices.find(p => String(p.id) === itemValue);
    if (!price) return;
    onDragItem({
      priceId:          price.id,
      name:             price.name,
      category:         price.category,
      imageUrl:         price.image_url,
      categoryImageUrl: price.category_image_url,
    });
    onClose();
  }, [prices, onDragItem, onClose]);

  const handleBack = useCallback(() => {
    setMode("categories");
    setSelectedCategory("");
  }, []);

  if (!open && !visible) return null;

  // Вычисляем угол для каждого элемента
  const angleStep  = count > 1 ? (ARC_END_DEG - ARC_START_DEG) / (count - 1) : 0;
  const startAngle = count === 1 ? (ARC_START_DEG + ARC_END_DEG) / 2 : ARC_START_DEG;

  return (
    <>
      {/* Прозрачный оверлей */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 40 }}
      />

      {/* Якорь дуги — правый центр экрана */}
      <div style={{
        position: "fixed",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 41,
        width: 0,
        height: 0,
        pointerEvents: "none",
      }}>

        {/* Кнопка «Назад» */}
        {mode === "items" && (
          <button
            onClick={e => { e.stopPropagation(); handleBack(); }}
            style={{
              position: "absolute",
              right: 16,
              top: -110,
              pointerEvents: "all",
              background: "rgba(10,10,18,0.88)",
              border: "1px solid rgba(124,58,237,0.4)",
              borderRadius: 10,
              padding: "4px 12px",
              color: "rgba(196,181,253,0.9)",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(12px)",
              whiteSpace: "nowrap",
            }}
          >
            ← Категории
          </button>
        )}

        {/* Элементы по дуге */}
        {arcItems.map((item, idx) => {
          const deg = startAngle + idx * angleStep;
          const rad = deg * Math.PI / 180;

          // cos(deg) для углов -110..-20 отрицательный → элемент левее якоря
          const offsetX = Math.cos(rad) * ARC_R; // < 0
          const offsetY = Math.sin(rad) * ARC_R; // варьируется

          // right = -offsetX (т.к. offsetX отрицательный → right > 0)
          const rightPx = -offsetX + 8;
          const topPx   = offsetY;

          const delay = idx * 40;

          return (
            <button
              key={item.value}
              onClick={e => {
                e.stopPropagation();
                if (mode === "categories") handleCategoryClick(item.value);
                else handleItemClick(item.value);
              }}
              style={{
                position: "absolute",
                right: rightPx,
                top: topPx,
                transform: `translate(0, -50%) scale(${visible ? 1 : 0.6})`,
                opacity: visible ? 1 : 0,
                transition: [
                  `transform 0.28s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
                  `opacity 0.2s ease ${delay}ms`,
                ].join(", "),
                pointerEvents: "all",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(10,10,18,0.88)",
                border: "1px solid rgba(124,58,237,0.32)",
                borderRadius: 14,
                padding: "6px 12px 6px 6px",
                cursor: "pointer",
                backdropFilter: "blur(14px)",
                boxShadow: [
                  "0 4px 24px rgba(0,0,0,0.55)",
                  "inset 0 1px 0 rgba(255,255,255,0.05)",
                ].join(", "),
                minWidth: 130,
                maxWidth: 190,
              }}
            >
              {/* Иконка */}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                overflow: "hidden",
                flexShrink: 0,
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 18 }}>📦</span>
                }
              </div>
              {/* Название */}
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                textAlign: "left",
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
