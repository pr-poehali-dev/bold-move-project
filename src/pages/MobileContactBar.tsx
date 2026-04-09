import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { Panel } from "./chatConfig";

interface Props {
  panel: Panel;
  setPanel: (p: Panel) => void;
}

export default function MobileContactBar({ panel, setPanel }: Props) {
  const [open, setOpen] = useState(false);
  const startYRef = useRef<number | null>(null);

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
          <a href="tel:+79776068901"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/20 text-orange-400 text-[11px] font-medium active:scale-95 transition-transform">
            <Icon name="Phone" size={13} /> Позвонить
          </a>
          <button
            onClick={() => setPanel(panel === "livechat" ? "none" : "livechat")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/20 text-orange-400 text-[11px] font-medium active:scale-95 transition-transform">
            <Icon name="MessageCircle" size={13} /> Чат
          </button>
          <a href="https://t.me/JoniKras" target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/20 text-orange-400 text-[11px] font-medium active:scale-95 transition-transform">
            <Icon name="Send" size={13} /> Telegram
          </a>
          <a href="https://max.ru/u/f9LHodD0cOImGR_bXwRjzpNeWQv7qzBR-lP0W9lvbuzV8iU1J5lngmKBGgA" target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/20 text-orange-400 text-[11px] font-medium active:scale-95 transition-transform">
            <Icon name="MessageSquare" size={13} /> MAX
          </a>
        </div>
      </div>
    </div>
  );
}