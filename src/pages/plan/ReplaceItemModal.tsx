import { useState, useEffect, useMemo } from "react";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { SegmentPriceItem } from "./planTypes";

interface Props {
  open: boolean;
  item: (SegmentPriceItem & { quantity: number }) | null;
  prices: PriceEntry[];
  onReplace: (newItem: SegmentPriceItem, quantity: number) => void;
  onCancel: () => void;
}

export default function ReplaceItemModal({ open, item, prices, onReplace, onCancel }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open && item) {
      setSelectedCategory(item.category ?? "");
      setSearch("");
    }
  }, [open, item]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of prices) {
      if (!seen.has(p.category)) { seen.add(p.category); result.push(p.category); }
    }
    return result;
  }, [prices]);

  const filteredItems = useMemo(() => {
    return prices.filter(p => {
      const matchCat = !selectedCategory || p.category === selectedCategory;
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [prices, selectedCategory, search]);

  if (!open || !item) return null;

  const handleSelect = (price: PriceEntry) => {
    const newItem: SegmentPriceItem = {
      priceId: price.id,
      name: price.name,
      category: price.category,
      imageUrl: price.image_url ?? undefined,
      categoryImageUrl: price.category_image_url ?? undefined,
      unit: price.unit,
      isWallItem: price.is_wall_item !== false,
    };
    onReplace(newItem, item.quantity);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#1e1b4b",
          border: "1px solid rgba(139,92,246,0.3)",
          borderRadius: 16,
          width: 460,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.name}
                style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", opacity: 0.5 }}
              />
            )}
            <div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                Заменить товар
              </div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{item.name}</div>
            </div>
          </div>

          {/* Поиск */}
          <input
            type="text"
            placeholder="Поиск товара..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#fff",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
            autoFocus
          />
        </div>

        {/* Категории */}
        <div style={{
          display: "flex", gap: 6, padding: "10px 20px",
          overflowX: "auto", flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          scrollbarWidth: "none",
        }}>
          <button
            onClick={() => setSelectedCategory("")}
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.15)",
              background: selectedCategory === "" ? "rgba(139,92,246,0.4)" : "transparent",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Все
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? "" : cat)}
              style={{
                flexShrink: 0,
                padding: "5px 12px",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.15)",
                background: cat === selectedCategory ? "rgba(139,92,246,0.4)" : "transparent",
                color: cat === selectedCategory ? "#fff" : "rgba(255,255,255,0.7)",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Список товаров */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 12px" }}>
          {filteredItems.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px 0", fontSize: 13 }}>
              Ничего не найдено
            </div>
          )}
          {filteredItems.map(price => (
            <button
              key={price.id}
              onClick={() => handleSelect(price)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: price.id === item.priceId
                  ? "1px solid rgba(139,92,246,0.6)"
                  : "1px solid transparent",
                background: price.id === item.priceId
                  ? "rgba(139,92,246,0.15)"
                  : "transparent",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => {
                if (price.id !== item.priceId)
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={e => {
                if (price.id !== item.priceId)
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {/* Иконка */}
              <div style={{
                width: 40, height: 40, borderRadius: 8,
                background: "rgba(255,255,255,0.07)",
                flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {price.image_url
                  ? <img src={price.image_url} alt={price.name} style={{ width: 40, height: 40, objectFit: "cover" }} />
                  : <span style={{ fontSize: 18 }}>📦</span>
                }
              </div>
              {/* Название */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>
                  {price.name}
                </div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>
                  {price.category}
                </div>
              </div>
              {price.id === item.priceId && (
                <div style={{ color: "rgba(139,92,246,0.8)", fontSize: 11, flexShrink: 0 }}>
                  текущий
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Кнопка отмены */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={onCancel}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
