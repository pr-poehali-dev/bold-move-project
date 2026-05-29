import { useState, useEffect, useCallback } from "react";
import type { SegmentPriceItem } from "./planTypes";
import ArcDrum, { type ArcItem } from "./ArcDrum";
import DrumViewToggle from "./DrumViewToggle";
import DrumBackground from "./DrumBackground";

export interface PriceEntry {
  id: number;
  name: string;
  category: string;
  image_url: string | null;
  category_image_url: string | null;
  unit: string;
  is_wall_item?: boolean;
  show_in_drum?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prices: PriceEntry[];
  onDragItem: (item: SegmentPriceItem) => void;
  initialCategory?: string;
  isMobile?: boolean;
  onShowList?: () => void;
}

export default function CategoryDrumPanel({ open, onClose, prices, onDragItem, initialCategory, isMobile, onShowList }: Props) {
  const [mode,             setMode]             = useState<"categories" | "items">("categories");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedItem,     setSelectedItem]     = useState("");
  const [visible,          setVisible]          = useState(false);
  // Запоминаем initialCategory при открытии — чтобы свайп вправо в режиме замены
  // не возвращался к категории (барабан замены показывает только одну категорию)
  const [lockedCategory,   setLockedCategory]   = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => setVisible(true), 10);
      if (initialCategory) {
        setSelectedCategory(initialCategory);
        setLockedCategory(initialCategory);
        setMode("items");
      } else {
        setLockedCategory(null);
      }
    } else {
      setVisible(false);
      setLockedCategory(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) setTimeout(() => { setMode("categories"); setSelectedCategory(""); setSelectedItem(""); }, 300);
  }, [open]);

  const categories: ArcItem[] = (() => {
    const catImgMap = new Map<string, string | null>();
    for (const p of prices) {
      if (!catImgMap.has(p.category)) catImgMap.set(p.category, null);
      if (p.category_image_url && !catImgMap.get(p.category)) {
        catImgMap.set(p.category, p.category_image_url);
      }
    }
    const hiddenCats = new Set<string>();
    for (const p of prices) {
      if (p.show_in_drum === false) hiddenCats.add(p.category);
    }
    for (const p of prices) {
      if (p.show_in_drum !== false) hiddenCats.delete(p.category);
    }
    const seen = new Set<string>();
    const result: ArcItem[] = [];
    for (const p of prices) {
      if (!seen.has(p.category) && !hiddenCats.has(p.category)) {
        seen.add(p.category);
        result.push({ value: p.category, label: p.category, imageUrl: catImgMap.get(p.category) ?? null });
      }
    }
    return result;
  })();

  const catItems: ArcItem[] = prices
    .filter(p => p.category === selectedCategory)
    .map(p => ({ value: String(p.id), label: p.name, imageUrl: p.image_url }));

  const catStartIdx = (() => {
    const profileIdx = categories.findIndex(c => c.label.toLowerCase().includes("профил"));
    return profileIdx >= 0 ? profileIdx : Math.floor(categories.length / 2);
  })();

  const handleCategoryClick = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setMode("items");
  }, []);

  const handleItemClick = useCallback((itemValue: string) => {
    const price = prices.find(p => String(p.id) === itemValue);
    if (!price) return;
    onDragItem({ priceId: price.id, name: price.name, category: price.category, imageUrl: price.image_url, categoryImageUrl: price.category_image_url, unit: price.unit ?? "", isWallItem: price.is_wall_item !== false });
    onClose();
  }, [prices, onDragItem, onClose]);

  if (!open && !visible) return null;

  return (
    <>
      {/* Оверлей — закрывает барабан по тапу в пустое место */}
      <div
        style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}
        onClick={onClose}
        onTouchEnd={e => { e.preventDefault(); onClose(); }}
      />
      <div style={{
        position: "fixed",
        right: -8,
        top: 0,
        bottom: 0,
        transform: `translateX(${visible ? 0 : 80}px)`,
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s cubic-bezier(0.34,1.2,0.64,1), opacity 0.25s ease",
        zIndex: 41,
        width: 200,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "stretch",
        pointerEvents: "none",
        background: "transparent",
      }}>

        {!isMobile && onShowList && (
          <DrumViewToggle onShowList={onShowList} />
        )}

        <div
          style={{
            pointerEvents: "all",
            position: "relative",
            padding: "12px 0 12px 6px",
            touchAction: "none",
          }}
          onClick={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
        >
          <DrumBackground />

          {mode === "categories" && (
            <ArcDrum
              key="cats"
              items={categories}
              value={selectedCategory || (categories[catStartIdx]?.value ?? "")}
              onChange={setSelectedCategory}
              onClick={handleCategoryClick}
              initialIdx={catStartIdx}
            />
          )}
          {mode === "items" && (
            <ArcDrum
              key={`items-${selectedCategory}`}
              items={catItems}
              value={selectedItem || (catItems[0]?.value ?? "")}
              onChange={setSelectedItem}
              onClick={handleItemClick}
              onSwipeRight={() => {
                if (lockedCategory) {
                  // В режиме замены — свайп вправо закрывает барабан
                  onClose();
                } else {
                  setMode("categories");
                  setSelectedCategory("");
                }
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}