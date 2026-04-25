import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { LS_KEY } from "./kanbanTypes";

export function KanbanHeader({ clientCount, colWidths, search, onSearch, onResetWidths, onSettings }: {
  clientCount: number;
  colWidths: Record<string, number>;
  search: string;
  onSearch: (v: string) => void;
  onResetWidths: () => void;
  onSettings: () => void;
}) {
  const t = useTheme();

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-lg font-bold" style={{ color: t.text }}>Канбан-доска</h2>
        <p className="text-xs mt-0.5" style={{ color: t.textMute }}>
          {clientCount} клиентов · перетащи карточку для смены этапа
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {Object.keys(colWidths).length > 0 && (
          <button
            onClick={() => { onResetWidths(); localStorage.removeItem(LS_KEY); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textMute }}
            title="Сбросить ширины колонок">
            <Icon name="RotateCcw" size={12} /> Сбросить
          </button>
        )}
        <button onClick={onSettings}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textSub }}>
          <Icon name="Settings2" size={13} /> Колонки
        </button>
        <div className="relative w-64">
          <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
          <input value={search} onChange={e => onSearch(e.target.value)}
            placeholder="Поиск по имени, телефону..."
            className="w-full rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
        </div>
      </div>
    </div>
  );
}
