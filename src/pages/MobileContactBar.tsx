import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { Panel } from "./chatConfig";
import { useBrand } from "@/context/BrandContext";

interface Props {
  panel: Panel;
  setPanel: (p: Panel) => void;
}

export default function MobileContactBar({ panel, setPanel }: Props) {
  const { brand } = useBrand();
  const [open, setOpen] = useState(false);
  const startYRef = useRef<number | null>(null);
  const phoneTel = "tel:" + (brand.support_phone || "").replace(/\D/g, "");
  const c = brand.brand_color;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const dy = startYRef.current - e.changedTouches[0].clientY;
    if (dy > 30) setOpen(true);   // свайп вверх
    if (dy < -30) setOpen(false); // свайп вниз
    startYRef.current = null;
  };

  return (
    <div
      className="sm:hidden shrink-0 select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Ручка — всегда видна */}
      <div
        className="flex flex-col items-center justify-center py-1.5 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="w-8 h-1 rounded-full bg-white/15" />
        <span className="text-[9px] text-white/20 mt-1">
          {open ? "скрыть" : "контакты"}
        </span>
      </div>

      {/* Панель кнопок */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "80px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="flex items-center gap-2 px-3 pb-3">
          <a href={phoneTel}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-medium active:scale-95 transition-transform"
            style={{ background: `${c}26`, border: `1px solid ${c}33`, color: c }}>
            <Icon name="Phone" size={12} /> Позвонить
          </a>
          <button
            onClick={() => setPanel(panel === "livechat" ? "none" : "livechat")}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-medium active:scale-95 transition-transform"
            style={{ background: `${c}26`, border: `1px solid ${c}33`, color: c }}>
            <Icon name="MessageCircle" size={12} /> Чат
          </button>
          <a href={brand.telegram_url} target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-medium active:scale-95 transition-transform"
            style={{ background: `${c}26`, border: `1px solid ${c}33`, color: c }}>
            <Icon name="Send" size={12} /> Telegram
          </a>
          <a href={brand.max_url} target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-medium active:scale-95 transition-transform"
            style={{ background: `${c}26`, border: `1px solid ${c}33`, color: c }}>
            <Icon name="MessageSquare" size={12} /> MAX
          </a>
        </div>
      </div>
    </div>
  );
}