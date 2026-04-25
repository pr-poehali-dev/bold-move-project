import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { MIN_WIDTH, MAX_WIDTH } from "./kanbanTypes";

export function KanbanHeader({ clientCount, globalWidth, search, onSearch, onWidthChange, onSettings }: {
  clientCount: number;
  globalWidth: number;
  search: string;
  onSearch: (v: string) => void;
  onWidthChange: (w: number) => void;
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

      <div className="flex items-center gap-3 flex-wrap">

        {/* Слайдер ширины колонок */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
          <Icon name="Columns" size={13} style={{ color: t.textMute }} />
          <span className="text-xs whitespace-nowrap" style={{ color: t.textMute }}>Ширина</span>
          <input
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={10}
            value={globalWidth}
            onChange={e => onWidthChange(Number(e.target.value))}
            className="w-28 accent-violet-500 cursor-pointer"
            style={{ height: 4 }}
          />
          <span className="text-xs font-mono w-10 text-right" style={{ color: t.textSub }}>
            {globalWidth}px
          </span>
        </div>

        {/* Настройка колонок */}
        <button onClick={onSettings}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textSub }}>
          <Icon name="Settings2" size={13} /> Колонки
        </button>

        {/* Поиск */}
        <div className="relative w-56">
          <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
          <input value={search} onChange={e => onSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
        </div>
      </div>
    </div>
  );
}
