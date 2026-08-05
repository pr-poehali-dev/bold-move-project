import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import DrawerTouchesTab from "./DrawerTouchesTab";
import { Dialog, channelMeta } from "./messagesChannels";
import { MessagesDialogRow } from "./MessagesDialogRow";
import { MessagesHiddenModal } from "./MessagesHiddenModal";
import { useCallClient } from "./useCallClient";

const isAvito = (d: Dialog) => d.last_channel === "avito" || d.source === "avito" || !!d.avito_chat_url;

export default function CrmMessages() {
  const t = useTheme();
  const { call: callViaUis, calling: callingUis } = useCallClient();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dialog | null>(null);
  const [search, setSearch] = useState("");
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);

  const refreshHiddenCount = useCallback(async () => {
    try {
      const d = await crmFetch("touch-hidden") as { dialogs?: Dialog[] };
      setHiddenCount((d?.dialogs ?? []).length);
    } catch { /* тихо */ }
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await crmFetch("touch-inbox") as { dialogs?: Dialog[] };
      setDialogs(d?.dialogs ?? []);
    } catch { /* тихо */ }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { load(); refreshHiddenCount(); }, [load, refreshHiddenCount]);
  // Тихий поллинг списка — новые сообщения появляются сверху сами
  useEffect(() => {
    const timer = setInterval(() => load(true), 30000);
    return () => clearInterval(timer);
  }, [load]);

  // Признак непрочитанного — ОБЩИЙ на компанию, приходит с сервера (touch_clients.last_read_at)
  const unreadFor = (d: Dialog): number => (d.unread ? 1 : 0);

  const openDialog = (d: Dialog) => {
    setSelected(d);
    // Оптимистично снимаем непрочитанность локально
    setDialogs(prev => prev.map(x => x.client_id === d.client_id ? { ...x, unread: false } : x));
    // Отмечаем прочитанным на сервере (общая отметка — у всех сотрудников станет прочитано)
    const payload: Record<string, unknown> = { client_id: d.client_id };
    crmFetch("touch-read", { method: "POST", body: JSON.stringify(payload) }).catch(() => {});
  };

  // Изменение пометок: оптимистично обновляем локально, потом шлём на бэкенд
  const setFlag = useCallback((d: Dialog, patch: { pinned?: boolean; favorite?: boolean; hidden?: boolean }) => {
    setDialogs(prev => {
      let next = prev.map(x => x.client_id === d.client_id ? { ...x, ...patch } : x);
      if (patch.hidden) next = next.filter(x => x.client_id !== d.client_id);
      // закреплённые всегда сверху
      return [...next].sort((a, b) => Number(b.pinned) - Number(a.pinned));
    });
    crmFetch("touch-flags", { method: "PUT", body: JSON.stringify(patch) }, { client_id: String(d.client_id) })
      .catch(() => load(true));
  }, [load]);

  const togglePin = (d: Dialog) => setFlag(d, { pinned: !d.pinned });
  const toggleFav = (d: Dialog) => setFlag(d, { favorite: !d.favorite });
  const hideChat  = (d: Dialog) => { if (selected?.client_id === d.client_id) setSelected(null); setFlag(d, { hidden: true }); setHiddenCount(c => c + 1); };

  const filtered = dialogs.filter(d => {
    if (showFavOnly && !d.favorite) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.name || "").toLowerCase().includes(q)
      || (d.phone || "").includes(q)
      || (d.last_text || "").toLowerCase().includes(q);
  });

  const goToOrder = (d: Dialog) => {
    if (d.contact_id == null) return;
    window.open(`/crm?order=${d.contact_id}`, "_blank");
  };

  const selMeta = selected ? channelMeta(selected.last_channel) : null;

  return (
    <div className="flex h-[calc(100dvh-160px)] min-h-[400px] rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${t.border}`, background: t.surface }}>

      {/* ── ЛЕВАЯ ПАНЕЛЬ: список диалогов ── */}
      <div className={`flex-col flex-shrink-0 border-r ${selected ? "hidden sm:flex" : "flex"} w-full sm:w-80 md:w-96`}
        style={{ borderColor: t.border }}>
        {/* Поиск + фильтр избранного */}
        <div className="flex-shrink-0 p-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="relative flex-1">
            <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по диалогам…"
              className="w-full rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
          <button onClick={() => setShowFavOnly(v => !v)} title="Только избранные"
            className="flex-shrink-0 p-2 rounded-xl transition"
            style={{
              background: showFavOnly ? "#f59e0b22" : t.surface2,
              border: `1px solid ${showFavOnly ? "#f59e0b" : t.border}`,
              color: showFavOnly ? "#f59e0b" : t.textMute,
            }}>
            <Icon name="Star" size={15} style={showFavOnly ? { fill: "#f59e0b" } : undefined} />
          </button>
          <button onClick={() => { setHiddenOpen(true); refreshHiddenCount(); }} title="Скрытые чаты"
            className="relative flex-shrink-0 p-2 rounded-xl transition"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textMute }}>
            <Icon name="EyeOff" size={15} />
            {hiddenCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-extrabold text-white"
                style={{ background: t.accent, lineHeight: 1 }}>
                {hiddenCount > 99 ? "99+" : hiddenCount}
              </span>
            )}
          </button>
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto">
          {loading && dialogs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm py-16 px-6" style={{ color: t.textMute }}>
              {showFavOnly ? "Нет избранных диалогов." : "Пока нет диалогов. Здесь появятся переписки из Avito, мессенджеров и звонки."}
            </div>
          ) : (
            filtered.map(d => (
              <MessagesDialogRow
                key={d.client_id}
                d={d}
                isActive={selected?.client_id === d.client_id}
                unread={unreadFor(d)}
                onOpen={openDialog}
                onTogglePin={togglePin}
                onToggleFav={toggleFav}
                onHide={hideChat}
              />
            ))
          )}
        </div>
      </div>

      {/* ── ПРАВАЯ ПАНЕЛЬ: переписка ── */}
      <div className={`flex-1 min-w-0 flex-col ${selected ? "flex" : "hidden sm:flex"}`}>
        {selected && selMeta ? (
          <>
            {/* Шапка выбранного диалога */}
            <div className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2.5"
              style={{ borderBottom: `1px solid ${t.border}` }}>
              <button onClick={() => setSelected(null)} className="sm:hidden p-1 rounded-lg" style={{ color: t.textMute }}>
                <Icon name="ChevronLeft" size={18} />
              </button>
              {isAvito(selected) ? (
                <img src="/avito-icon.png" alt="Avito" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: selMeta.color + "22", color: selMeta.color }}>
                  <Icon name={selMeta.icon} size={16} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate flex items-center gap-1" style={{ color: t.text }}>
                  {selected.favorite && <Icon name="Star" size={12} style={{ color: "#f59e0b", fill: "#f59e0b" }} />}
                  {selected.name || selected.phone || "Без имени"}
                </div>
                <div className="text-[11px]" style={{ color: t.textMute }}>{selMeta.label}</div>
              </div>

              {/* Быстрые действия */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isAvito(selected) && selected.avito_chat_url && (
                  <button onClick={() => window.open(selected.avito_chat_url!, "_blank")}
                    title="Открыть диалог в Avito"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80"
                    style={{ background: "#f9731620", color: "#f97316" }}>
                    <Icon name="ExternalLink" size={13} /> <span className="hidden md:inline">Avito</span>
                  </button>
                )}
                {selected.phone && (
                  <button onClick={() => callViaUis(selected.phone!, selected.client_id)}
                    disabled={callingUis} title="Позвонить"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80 disabled:opacity-60"
                    style={{ background: "#22c55e20", color: "#22c55e" }}>
                    <Icon name={callingUis ? "Loader2" : "Phone"} size={13} className={callingUis ? "animate-spin" : ""} /> <span className="hidden md:inline">Позвонить</span>
                  </button>
                )}
                {selected.contact_id != null && (
                  <button onClick={() => goToOrder(selected)}
                    title="Перейти в заявку"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80"
                    style={{ background: t.accent + "20", color: t.accentLight }}>
                    <Icon name="FileText" size={13} /> <span className="hidden md:inline">Заявка</span>
                  </button>
                )}
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

      {hiddenOpen && (
        <MessagesHiddenModal
          onClose={() => setHiddenOpen(false)}
          onRestored={() => { setHiddenCount(c => Math.max(0, c - 1)); load(true); }}
        />
      )}
    </div>
  );
}