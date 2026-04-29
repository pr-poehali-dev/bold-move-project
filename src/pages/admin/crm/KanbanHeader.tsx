import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { MIN_WIDTH, MAX_WIDTH } from "./kanbanTypes";

export function KanbanHeader({ clientCount, globalWidth, search, onSearch, onWidthChange, onAddCol, onRemoveBoard }: {
  clientCount: number;
  globalWidth: number;
  search: string;
  onSearch: (v: string) => void;
  onWidthChange: (w: number) => void;
  onAddCol: () => void;
  onRemoveBoard?: () => void;
}) {
  const t = useTheme();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">

      {/* Заголовок */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: t.text }}>Канбан-доска</h2>
        <p className="text-xs mt-0.5 hidden sm:block" style={{ color: t.textMute }}>
          {clientCount} клиентов · перетащи карточку для смены этапа · наведи на заголовок колонки для настроек
        </p>
        <p className="text-xs mt-0.5 sm:hidden" style={{ color: t.textMute }}>
          {clientCount} клиентов · зажми карточку для переноса
        </p>
      </div>

      {/* Десктоп: все контролы */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">

        {/* Слайдер ширины колонок */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
          <Icon name="Columns" size={13} style={{ color: t.textMute }} />
          <span className="text-xs whitespace-nowrap" style={{ color: t.textMute }}>Ширина</span>
          <input type="range" min={MIN_WIDTH} max={MAX_WIDTH} step={10} value={globalWidth}
            onChange={e => onWidthChange(Number(e.target.value))}
            className="w-28 accent-violet-500 cursor-pointer" style={{ height: 4 }} />
          <span className="text-xs font-mono w-10 text-right" style={{ color: t.textSub }}>{globalWidth}px</span>
        </div>

        <button onClick={onAddCol}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition hover:bg-violet-500/10"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#a78bfa" }}>
          <Icon name="Plus" size={13} /> Добавить колонку
        </button>

        <div className="relative w-56">
          <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Поиск..."
            className="w-full rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
        </div>

        {onRemoveBoard && (
          <button onClick={() => { if (window.confirm("Убрать канбан-доску из меню? Настройки колонок сохранятся.")) onRemoveBoard(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition hover:bg-red-500/10"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#f87171" }}>
            <Icon name="X" size={13} /> Убрать доску
          </button>
        )}
      </div>

      {/* Мобиле: добавить колонку + поиск в одну строку */}
      <div className="flex sm:hidden items-center gap-2">
        <button onClick={onAddCol}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition flex-shrink-0"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#a78bfa" }}>
          <Icon name="Plus" size={13} /> Колонку
        </button>
        <div className="relative flex-1">
          <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Поиск..."
            className="w-full rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
        </div>
      </div>
    </div>
  );
}