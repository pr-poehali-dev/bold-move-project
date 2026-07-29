import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import DrawerTouchesTab from "./DrawerTouchesTab";

interface Dialog {
  client_id: number;
  name: string | null;
  phone: string | null;
  contact_id: number | null;
  interest: string | null;
  stage: string | null;
  last_channel: string;
  last_direction: "in" | "out";
  last_text: string;
  last_at: string;
  unread: boolean;
  in_count: number;
}

// Канал → иконка + цвет (совпадает с DrawerTouchesTab)
const CHANNELS: Record<string, { icon: string; label: string; color: string }> = {
  call:     { icon: "Phone",             label: "Звонок",   color: "#22c55e" },
  telegram: { icon: "Send",              label: "Telegram", color: "#3b82f6" },
  max:      { icon: "MessageCircle",     label: "MAX",      color: "#a855f7" },
  avito:    { icon: "MessagesSquare",    label: "Avito",    color: "#f97316" },
  whatsapp: { icon: "Phone",             label: "WhatsApp", color: "#25d366" },
  webchat:  { icon: "MessageSquareText", label: "Веб-чат",  color: "#0ea5e9" },
};
const channelMeta = (c: string) => CHANNELS[c] || { icon: "MessageSquare", label: c, color: "#8b5cf6" };

const seenKey = (contactId: number) => `touches_seen_${contactId}`;

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
};

export default function CrmMessages() {
  const t = useTheme();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dialog | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await crmFetch("touch-inbox") as { dialogs?: Dialog[] };
      setDialogs(d?.dialogs ?? []);
    } catch { /* тихо */ }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  // Тихий поллинг списка — новые сообщения появляются сверху сами
  useEffect(() => {
    const timer = setInterval(() => load(true), 5000);
    return () => clearInterval(timer);
  }, [load]);

  // Есть ли непрочитанное у диалога: последнее сообщение входящее И пришло после
  // момента последнего открытия этого диалога (хранится локально по contact_id).
  const unreadFor = (d: Dialog): number => {
    if (d.last_direction !== "in") return 0;
    if (d.contact_id == null) return 1;
    const lastSeen = Number(localStorage.getItem(seenKey(d.contact_id)) || 0);
    return new Date(d.last_at).getTime() > lastSeen ? 1 : 0;
  };

  const openDialog = (d: Dialog) => {
    setSelected(d);
    if (d.contact_id != null) {
      localStorage.setItem(seenKey(d.contact_id), String(Date.now()));
    }
  };

  const filtered = dialogs.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.name || "").toLowerCase().includes(q)
      || (d.phone || "").includes(q)
      || (d.last_text || "").toLowerCase().includes(q);
  });

  return (
    <div className="flex h-[calc(100dvh-160px)] min-h-[400px] rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${t.border}`, background: t.surface }}>

      {/* ── ЛЕВАЯ ПАНЕЛЬ: список диалогов ── */}
      <div className={`flex-col flex-shrink-0 border-r ${selected ? "hidden sm:flex" : "flex"} w-full sm:w-80 md:w-96`}
        style={{ borderColor: t.border }}>
        {/* Поиск */}
        <div className="flex-shrink-0 p-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="relative">
            <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по диалогам…"
              className="w-full rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto">
          {loading && dialogs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm py-16 px-6" style={{ color: t.textMute }}>
              Пока нет диалогов. Здесь появятся переписки из Avito, мессенджеров и звонки.
            </div>
          ) : (
            filtered.map(d => {
              const meta = channelMeta(d.last_channel);
              const unread = unreadFor(d);
              const isActive = selected?.client_id === d.client_id;
              const title = d.name || d.phone || "Без имени";
              return (
                <button key={d.client_id} onClick={() => openDialog(d)}
                  className="w-full text-left px-3 py-3 flex items-start gap-2.5 transition"
                  style={{
                    background: isActive ? t.accent + "18" : "transparent",
                    borderBottom: `1px solid ${t.border2}`,
                  }}>
                  {/* Аватар с каналом */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{ background: meta.color + "22", color: meta.color }}>
                      {title.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                      <Icon name={meta.icon} size={9} style={{ color: meta.color }} />
                    </div>
                  </div>

                  {/* Текст */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold truncate" style={{ color: t.text }}>{title}</span>
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
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── ПРАВАЯ ПАНЕЛЬ: переписка ── */}
      <div className={`flex-1 min-w-0 flex-col ${selected ? "flex" : "hidden sm:flex"}`}>
        {selected ? (
          <>
            {/* Шапка выбранного диалога */}
            <div className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2.5"
              style={{ borderBottom: `1px solid ${t.border}` }}>
              <button onClick={() => setSelected(null)} className="sm:hidden p-1 rounded-lg" style={{ color: t.textMute }}>
                <Icon name="ChevronLeft" size={18} />
              </button>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: channelMeta(selected.last_channel).color + "22", color: channelMeta(selected.last_channel).color }}>
                {(selected.name || selected.phone || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: t.text }}>
                  {selected.name || selected.phone || "Без имени"}
                </div>
                <div className="text-[11px]" style={{ color: t.textMute }}>
                  {channelMeta(selected.last_channel).label}
                </div>
              </div>
            </div>

            {/* Лента переписки (переиспользуем готовый компонент) */}
            <div className="flex-1 min-h-0">
              <DrawerTouchesTab
                key={selected.client_id}
                phone={selected.phone || ""}
                name={selected.name || undefined}
                contactId={selected.contact_id ?? undefined}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: t.textMute }}>
            <Icon name="MessagesSquare" size={32} className="opacity-30" />
            <div className="text-sm">Выберите диалог слева</div>
          </div>
        )}
      </div>
    </div>
  );
}