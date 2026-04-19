import Icon from "@/components/ui/icon";

interface Props {
  newRule: { label: string; description: string; placeholder: string };
  saving: boolean;
  onChange: (patch: Partial<{ label: string; description: string; placeholder: string }>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function RuleAddForm({ newRule, saving, onChange, onSave, onCancel }: Props) {
  return (
    <div className="bg-white/[0.03] border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3">
      <h3 className="text-violet-300 text-sm font-semibold flex items-center gap-2">
        <Icon name="Plus" size={14} /> Новое правило расчёта
      </h3>
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-white/40 text-xs">Название колонки</span>
          <input
            autoFocus
            value={newRule.label}
            onChange={e => onChange({ label: e.target.value })}
            onKeyDown={e => e.key === "Enter" && onSave()}
            placeholder="Например: Минимальная площадь"
            className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500"
          />
        </div>
        <div className="flex flex-col gap-1 flex-[2] min-w-[200px]">
          <span className="text-white/40 text-xs">Как AI использует это правило</span>
          <input
            value={newRule.description}
            onChange={e => onChange({ description: e.target.value })}
            onKeyDown={e => e.key === "Enter" && onSave()}
            placeholder="Например: если площадь меньше указанной — применять минимальную стоимость"
            className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !newRule.label.trim()}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg transition flex items-center gap-1.5">
          {saving ? <Icon name="Loader" size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
          Создать правило
        </button>
        <button onClick={onCancel} className="text-white/40 hover:text-white/70 text-sm transition px-3 py-1.5">Отмена</button>
      </div>
    </div>
  );
}
