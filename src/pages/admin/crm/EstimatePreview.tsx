import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import type { EstimateBlock } from "./estimateTypes";

interface Props {
  blocks: EstimateBlock[];
  totals: string[];
  saving: boolean;
  onSave: () => void;
}

// Отображается когда estimate=null но есть автоблоки из чертежа
export function EstimateFromPlanPreview({ blocks, totals, saving, onSave }: Props) {
  const t = useTheme();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold" style={{ color: t.text }}>Смета из чертежа</div>
          <div className="text-xs mt-0.5" style={{ color: t.textMute }}>Сформирована автоматически по товарам на чертеже</div>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Icon name="Save" size={14} />}
          Сохранить смету
        </button>
      </div>
      {blocks.map((block, bi) => (
        <div key={bi} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider" style={{ background: t.surface2, color: "#f97316" }}>{block.title}</div>
          {block.items.map((item, ii) => (
            <div key={ii} className="flex justify-between items-center px-3 py-2 text-xs" style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
              <span>{item.name}</span>
              <span style={{ color: t.textMute }}>{item.value}</span>
            </div>
          ))}
        </div>
      ))}
      {totals.length > 0 && (
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
          {totals.map((line, i) => (
            <div key={i} className="flex justify-between text-xs font-semibold" style={{ color: i === 1 ? "#f97316" : t.textMute }}>
              <span>{line.split(":")[0]}</span>
              <span>{line.split(":")[1]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Отображается когда estimate=null и нет блоков
export function EstimateEmpty() {
  const t = useTheme();
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: t.textMute }}>
      <Icon name="FileSpreadsheet" size={32} className="opacity-20" />
      <div className="text-sm text-center">
        <p>К этой заявке нет сохранённой сметы</p>
        <p className="text-xs mt-1 opacity-60">Добавьте товары на чертёж — смета сформируется автоматически</p>
      </div>
    </div>
  );
}
