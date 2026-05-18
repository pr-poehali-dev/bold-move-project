import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import type { SavedEstimate } from "./estimateTypes";

interface Props {
  estimate: SavedEstimate;
  clientName?: string | null;
  clientPhone?: string | null;
  editMode: boolean;
  saving: boolean;
  saved: boolean;
  copied: boolean;
  onCopy: () => void;
  onPrint: () => void;
  onToggleEdit: () => void;
  onSave: () => void;
}

export default function EstimateToolbar({
  estimate, clientName, clientPhone,
  editMode, saving, saved, copied,
  onCopy, onPrint, onToggleEdit, onSave,
}: Props) {
  const t = useTheme();

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <div className="text-sm font-semibold" style={{ color: t.text }}>
          Смета на натяжные потолки{clientName ? ` — ${clientName}` : ""}
        </div>
        <div className="text-xs mt-0.5" style={{ color: t.textMute }}>
          Создана: {new Date(estimate.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          {clientPhone && <span className="ml-2 opacity-60">{clientPhone}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition"
          style={{ background: copied ? "#10b98122" : t.surface2, color: copied ? "#10b981" : t.textSub, border: `1px solid ${copied ? "#10b98140" : t.border}` }}
        >
          <Icon name={copied ? "Check" : "Copy"} size={13} />
          {copied ? "Скопировано" : "Копировать"}
        </button>
        <button
          onClick={onPrint}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition"
          style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}
        >
          <Icon name="Printer" size={13} /> PDF
        </button>
        <button
          onClick={onToggleEdit}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition"
          style={{
            background: editMode ? "rgba(124,58,237,0.2)" : t.surface2,
            color: editMode ? "#a78bfa" : t.textSub,
            border: `1px solid ${editMode ? "rgba(124,58,237,0.4)" : t.border}`,
          }}
        >
          <Icon name={editMode ? "Eye" : "Pencil"} size={13} />
          {editMode ? "Просмотр" : "Редактировать"}
        </button>
        {editMode && (
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ background: saved ? "#10b981" : "#7c3aed" }}
          >
            {saving
              ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
              : saved
              ? <><Icon name="CheckCircle2" size={13} /> Сохранено</>
              : <><Icon name="Save" size={13} /> Сохранить</>}
          </button>
        )}
      </div>
    </div>
  );
}
