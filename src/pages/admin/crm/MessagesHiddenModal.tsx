import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Dialog, channelMeta } from "./messagesChannels";

interface Props {
  onClose: () => void;
  onRestored: () => void;
}

// Панель скрытых диалогов: показывает скрытые чаты и позволяет вернуть их в список.
export function MessagesHiddenModal({ onClose, onRestored }: Props) {
  const t = useTheme();
  const [items, setItems] = useState<Dialog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await crmFetch("touch-hidden") as { dialogs?: Dialog[] };
      setItems(d?.dialogs ?? []);
    } catch { /* тихо */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const restore = async (d: Dialog) => {
    setItems(prev => prev.filter(x => x.client_id !== d.client_id));
    await crmFetch("touch-flags", { method: "PUT", body: JSON.stringify({ hidden: false }) }, { client_id: String(d.client_id) })
      .catch(() => load());
    onRestored();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}`, maxHeight: "80dvh" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <Icon name="EyeOff" size={16} style={{ color: t.textMute }} />
            <span className="text-sm font-bold" style={{ color: t.text }}>Скрытые чаты</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMute }}>
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-sm py-16 px-6" style={{ color: t.textMute }}>
              Нет скрытых чатов.
            </div>
          ) : (
            items.map(d => {
              const meta = channelMeta(d.last_channel);
              const title = d.name || d.phone || "Без имени";
              return (
                <div key={d.client_id} className="flex items-center gap-2.5 px-4 py-2.5"
                  style={{ borderBottom: `1px solid ${t.border2}` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: meta.color + "22", color: meta.color }}>
                    <Icon name={meta.icon} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{title}</div>
                    <div className="text-xs truncate" style={{ color: t.textMute }}>{d.last_text || "(без текста)"}</div>
                  </div>
                  <button onClick={() => restore(d)}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80"
                    style={{ background: t.accent + "20", color: t.accentLight }}>
                    <Icon name="RotateCcw" size={13} /> Вернуть
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
