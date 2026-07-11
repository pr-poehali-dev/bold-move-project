import { useState, useEffect, useMemo, useRef } from "react";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { SegmentPriceItem } from "./planTypes";

interface Props {
  open: boolean;
  /** null в режиме добавления (mode="add") */
  item: (SegmentPriceItem & { quantity: number }) | null;
  prices: PriceEntry[];
  onReplace: (newItem: SegmentPriceItem, quantity: number) => void;
  onCancel: () => void;
  /** "replace" (по умолчанию) или "add" — меняет заголовок и колбэк */
  mode?: "replace" | "add";
  /** Кнопка голосового ввода в шапке — как в барабане */
  voiceButton?: React.ReactNode;
  /** Категория, отфильтрованная по умолчанию при открытии (mode="add", когда item=null) */
  initialCategory?: string;
}

export default function ReplaceItemModal({ open, item, prices, onReplace, onCancel, mode = "replace", voiceButton, initialCategory }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Показывать ли подпись категории под названием каждого товара в списке
  const [showCategoryLabels, setShowCategoryLabels] = useState(true);

  // Защита от "мигания": клик, которым модалка была открыта (например, кнопка
  // "Заменить" в другом попапе), может долетать сюда же и мгновенно закрывать
  // модалку через фоновый оверлей. Игнорируем закрытие по фону первые 250мс.
  const [canCloseByOverlay, setCanCloseByOverlay] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedCategory(item?.category ?? initialCategory ?? "");
      setSearch("");
      setDropdownOpen(false);
      setCanCloseByOverlay(false);
      const t = setTimeout(() => setCanCloseByOverlay(true), 250);
      return () => clearTimeout(t);
    }
  }, [open, item?.category, initialCategory]);

  // Закрываем dropdown при клике вне
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const HIDDEN = ["монтаж", "раскрой", "огарпунивание"];
  const isHidden = (cat: string) => HIDDEN.some(h => cat?.toLowerCase().includes(h));

  const visiblePrices = useMemo(() => prices.filter(p => !isHidden(p.category)), [prices]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of visiblePrices) {
      if (!seen.has(p.category)) { seen.add(p.category); result.push(p.category); }
    }
    return result;
  }, [visiblePrices]);

  const filteredItems = useMemo(() => {
    return visiblePrices.filter(p => {
      const matchCat = !selectedCategory || p.category === selectedCategory;
      const matchSearch = !search || (p.name ?? "").toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [visiblePrices, selectedCategory, search]);

  if (!open) return null;
  if (mode === "replace" && !item) return null;

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
    onReplace(newItem, item?.quantity ?? 1);
  };

  const currentCatLabel = selectedCategory || "Все категории";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        paddingRight: 16,
        pointerEvents: "none",
      }}
    >
      {/* Клик по фону закрывает (кроме первых мгновений после открытия — см. canCloseByOverlay) */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", pointerEvents: "all" }}
        onClick={() => { if (canCloseByOverlay) onCancel(); }}
      />
      <div
        style={{
          position: "relative",
          background: "#1e1b4b",
          border: "1px solid rgba(139,92,246,0.3)",
          borderRadius: 16,
          width: 400,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          pointerEvents: "all",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {item?.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.name}
                style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", opacity: 0.6, flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>
                {mode === "replace" ? "Заменить товар" : "Добавить товар"}
              </div>
              {item && (
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </div>
              )}
            </div>
            {voiceButton && (
              <div style={{ flexShrink: 0, position: "relative" }}>
                {voiceButton}
              </div>
            )}
            <button
              onClick={() => setShowCategoryLabels(v => !v)}
              title={showCategoryLabels ? "Скрыть подписи категорий в списке" : "Показать подписи категорий в списке"}
              style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: "rgba(255,255,255,0.07)", border: "none",
                color: showCategoryLabels ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {showCategoryLabels ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 1 11s4 7 11 7a9.26 9.26 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <button
              onClick={onCancel}
              style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: "rgba(255,255,255,0.07)", border: "none",
                color: "rgba(255,255,255,0.4)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
              }}
            >×</button>
          </div>

          {/* Поиск + категория в одной строке */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Поиск товара..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: 0,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "7px 12px",
                color: "#fff",
                fontSize: 13,
                outline: "none",
              }}
              autoFocus
            />

            {/* Выпадающий список категорий */}
            <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                style={{
                  height: 34,
                  padding: "0 10px",
                  borderRadius: 8,
                  background: selectedCategory ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${selectedCategory ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.12)"}`,
                  color: selectedCategory ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  whiteSpace: "nowrap",
                  maxWidth: 140,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
                  {currentCatLabel}
                </span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, transform: dropdownOpen ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}>
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {dropdownOpen && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  background: "#1a1535",
                  border: "1px solid rgba(139,92,246,0.3)",
                  borderRadius: 10,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  zIndex: 10,
                  minWidth: 180,
                  maxHeight: 280,
                  overflowY: "auto",
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(139,92,246,0.3) transparent",
                }}>
                  {/* Все категории */}
                  <button
                    onClick={() => { setSelectedCategory(""); setDropdownOpen(false); }}
                    style={{
                      display: "block", width: "100%", padding: "8px 14px",
                      background: selectedCategory === "" ? "rgba(139,92,246,0.2)" : "transparent",
                      border: "none",
                      color: selectedCategory === "" ? "#c4b5fd" : "rgba(255,255,255,0.7)",
                      fontSize: 12, cursor: "pointer", textAlign: "left",
                    }}
                  >
                    Все категории
                  </button>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setDropdownOpen(false); }}
                      style={{
                        display: "block", width: "100%", padding: "8px 14px",
                        background: cat === selectedCategory ? "rgba(139,92,246,0.2)" : "transparent",
                        border: "none",
                        color: cat === selectedCategory ? "#c4b5fd" : "rgba(255,255,255,0.7)",
                        fontSize: 12, cursor: "pointer", textAlign: "left",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { if (cat !== selectedCategory) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                      onMouseLeave={e => { if (cat !== selectedCategory) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Список товаров */}
        <div style={{ overflowY: "auto", flex: 1, padding: "6px 10px" }}>
          {filteredItems.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px 0", fontSize: 13 }}>
              Ничего не найдено
            </div>
          )}
          {filteredItems.map(price => {
            const isCurrent = item && price.id === item.priceId;
            return (
              <button
                key={price.id}
                onClick={() => handleSelect(price)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "7px 8px",
                  borderRadius: 10,
                  border: isCurrent ? "1px solid rgba(139,92,246,0.6)" : "1px solid transparent",
                  background: isCurrent ? "rgba(139,92,246,0.15)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  {price.image_url
                    ? <img src={price.image_url} alt={price.name} style={{ width: 38, height: 38, objectFit: "cover" }} />
                    : <span style={{ fontSize: 17 }}>📦</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#fff", fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>
                    {price.name}
                  </div>
                  {showCategoryLabels && (
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 1 }}>
                      {price.category}
                    </div>
                  )}
                </div>
                {isCurrent && (
                  <span style={{ color: "rgba(139,92,246,0.7)", fontSize: 10, flexShrink: 0 }}>текущий</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Кнопка отмены */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={onCancel}
            style={{
              width: "100%", padding: "9px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              fontSize: 13, cursor: "pointer",
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}