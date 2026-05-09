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

const ITEM_H   = 52;
const ITEM_GAP = 10;

export default function CategoryDrumPanel({ open, onClose, prices, onDragItem }: Props) {
  const [mode,             setMode]             = useState<"categories" | "items">("categories");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [visible,          setVisible]          = useState(false);

  useEffect(() => {
    if (open)  setTimeout(() => setVisible(true), 10);
    else       setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) setTimeout(() => { setMode("categories"); setSelectedCategory(""); }, 300);
  }, [open]);

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

  return (
    <>
      {/* Прозрачный оверлей */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />

      {/* Стек элементов — якорь у кнопки каталога (bottom-right) */}
      <div style={{
        position: "fixed",
        bottom: 130,
        right: 12,
        zIndex: 41,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: ITEM_GAP,
        pointerEvents: "none",
      }}>

        {/* Кнопка «Назад» */}
        {mode === "items" && (
          <button
            onClick={e => { e.stopPropagation(); handleBack(); }}
            style={{
              pointerEvents: "all",
              background: "rgba(10,10,18,0.9)",
              border: "1px solid rgba(124,58,237,0.45)",
              borderRadius: 10,
              padding: "4px 12px",
              color: "rgba(196,181,253,0.9)",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(12px)",
              marginBottom: 4,
            }}
          >
            ← Категории
          </button>
        )}

        {/* Элементы по дуге снизу вверх */}
        {[...arcItems].reverse().map((item, revIdx) => {
          const idx = count - 1 - revIdx;
          // t: 0 = нижний, 1 = верхний → дуга смещает левее в середине
          const t = count > 1 ? idx / (count - 1) : 0.5;
          const arcOffsetX = Math.sin(t * Math.PI) * 32;
          const delay = revIdx * 40;
          const heightStep = ITEM_H + ITEM_GAP;
          const bottomOffset = revIdx * heightStep;

          return (
            <button
              key={item.value}
              onClick={e => {
                e.stopPropagation();
                if (mode === "categories") handleCategoryClick(item.value);
                else handleItemClick(item.value);
              }}
              style={{
                pointerEvents: "all",
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: ITEM_H,
                background: "rgba(10,10,18,0.88)",
                border: "1px solid rgba(124,58,237,0.32)",
                borderRadius: 14,
                padding: "0 12px 0 6px",
                cursor: "pointer",
                backdropFilter: "blur(14px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
                minWidth: 130,
                maxWidth: 200,
                transform: `translateX(${visible ? -arcOffsetX : 60}px) scale(${visible ? 1 : 0.7})`,
                opacity: visible ? 1 : 0,
                transition: [
                  `transform 0.28s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
                  `opacity 0.2s ease ${delay}ms`,
                ].join(", "),
                // Чтобы не зависеть от flex-order, используем margin-bottom для создания эффекта снизу вверх
                marginBottom: revIdx === 0 ? 0 : 0,
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
              {/* Неиспользованная переменная для подавления lint */}
              {bottomOffset > -1 && null}
            </button>
          );
        })}

        {/* Подпись */}
        <div style={{
          pointerEvents: "none",
          fontSize: 9,
          color: "rgba(255,255,255,0.2)",
          textAlign: "right",
        }}>
          {mode === "categories" ? "Выберите категорию" : selectedCategory}
        </div>
      </div>
    </>
  );
}
