import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface Props {
  type: "builder" | "agent";
  clientName: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CrmActionModal({ type, clientName, loading, onConfirm, onCancel }: Props) {
  const t = useTheme();

  const isBuilder = type === "builder";

  const icon        = isBuilder ? "Layers"  : "Bot";
  const title       = isBuilder ? "Создать проект в построителе?" : "Перейти в агент?";
  const description = isBuilder
    ? `По данным заявки будет создан новый проект в построителе планов. Имя клиента, адрес и телефон будут предзаполнены.`
    : `Вы перейдёте в агент. Всё что будет добавлено через агента — автоматически попадёт в эту заявку.`;
  const confirmLabel = isBuilder ? "Создать проект" : "Перейти в агент";
  const accentColor  = isBuilder ? "#3b82f6" : "#10b981";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Иконка */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: accentColor + "18", border: `1px solid ${accentColor}30` }}>
            <Icon name={icon} size={22} style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base" style={{ color: t.text }}>{title}</div>
            <div className="text-xs mt-0.5 truncate" style={{ color: t.textMute }}>
              {clientName}
            </div>
          </div>
        </div>

        {/* Описание */}
        <p className="text-sm leading-relaxed" style={{ color: t.textSub }}>
          {description}
        </p>

        {/* Кнопки */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: accentColor, color: "#fff" }}
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Icon name={icon} size={14} />{confirmLabel}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
