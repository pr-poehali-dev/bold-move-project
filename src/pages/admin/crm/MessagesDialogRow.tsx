import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Dialog, channelMeta } from "./messagesChannels";

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
};

interface Props {
  d: Dialog;
  isActive: boolean;
  unread: number;
  onOpen: (d: Dialog) => void;
  onTogglePin: (d: Dialog) => void;
  onToggleFav: (d: Dialog) => void;
  onHide: (d: Dialog) => void;
}

export function MessagesDialogRow({ d, isActive, unread, onOpen, onTogglePin, onToggleFav, onHide }: Props) {
  const t = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = channelMeta(d.last_channel);
  const title = d.name || d.phone || "Без имени";

  const act = (fn: (d: Dialog) => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    fn(d);
  };

  return (
    <div
      onClick={() => onOpen(d)}
      className="relative w-full text-left px-3 py-3 flex items-start gap-2.5 transition cursor-pointer group"
      style={{
        background: isActive ? t.accent + "18" : d.pinned ? t.surface2 + "60" : "transparent",
        borderBottom: `1px solid ${t.border2}`,
      }}>

      {/* Аватар = иконка канала */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: meta.color + "22", color: meta.color }}>
          <Icon name={meta.icon} size={18} />
        </div>
        {d.pinned && (
          <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <Icon name="Pin" size={9} style={{ color: t.accent }} />
          </div>
        )}
      </div>

      {/* Текст */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold truncate flex items-center gap-1" style={{ color: t.text }}>
            {d.favorite && <Icon name="Star" size={12} className="flex-shrink-0" style={{ color: "#f59e0b", fill: "#f59e0b" }} />}
            {title}
          </span>
          <span className="text-[10px] flex-shrink-0" style={{ color: t.textMute }}>{fmtWhen(d.last_at)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs truncate flex-1" style={{ color: unread ? t.text : t.textMute, fontWeight: unread ? 600 : 400 }}>
            {d.last_direction === "out" && <span style={{ color: t.textMute }}>Вы: </span>}
            {d.last_text || "(без текста)"}
          </span>
          {unread > 0 && (
            <span className="flex-shrink-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold text-white"
              style={{ background: "#ef4444", lineHeight: 1 }}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>

      {/* Кнопка меню действий */}
      <button
        onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
        className="flex-shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition"
        style={{ color: t.textMute, background: menuOpen ? t.surface2 : "transparent", opacity: menuOpen ? 1 : undefined }}
        title="Действия">
        <Icon name="EllipsisVertical" size={16} />
      </button>

      {/* Меню */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setMenuOpen(false); }} />
          <div className="absolute right-2 top-11 z-50 rounded-xl overflow-hidden shadow-xl py-1 min-w-[180px]"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <button onClick={act(onTogglePin)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition hover:opacity-80"
              style={{ color: t.text }}>
              <Icon name="Pin" size={14} style={{ color: t.accent }} />
              {d.pinned ? "Открепить" : "Закрепить вверху"}
            </button>
            <button onClick={act(onToggleFav)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition hover:opacity-80"
              style={{ color: t.text }}>
              <Icon name="Star" size={14} style={{ color: "#f59e0b" }} />
              {d.favorite ? "Убрать из избранного" : "В избранное"}
            </button>
            <button onClick={act(onHide)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition hover:opacity-80"
              style={{ color: "#ef4444", borderTop: `1px solid ${t.border2}` }}>
              <Icon name="EyeOff" size={14} />
              Скрыть чат
            </button>
          </div>
        </>
      )}
    </div>
  );
}
