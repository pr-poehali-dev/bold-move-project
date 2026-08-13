import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ThemeCtx } from "./themeContext";
import { DateTimePickerInner } from "./DateTimePicker";
import { STAGE_DATE_RULES } from "./stageDateRules";

export interface StageDatePatch {
  status: string;
  measure_date?: string;
  install_date?: string;
  comment_measure?: string;
  comment_install?: string;
}

interface Props {
  t: ThemeCtx;
  /** Статус, на который переводим (measure / install_scheduled) — определяет поле даты и тексты */
  nextStatus: string;
  /** Текущее значение даты, если уже было — пикер откроется с ним */
  currentDate?: string | null;
  /** Текущий комментарий этапа — можно дополнить прямо тут */
  currentComment?: string | null;
  onConfirm: (patch: StageDatePatch) => void;
  onCancel: () => void;
}

/**
 * Модалка «когда назначен замер/монтаж» — показывается при попытке перевести
 * заявку на этап, который без даты не имеет смысла (замер/монтаж «назначен»,
 * а когда ехать — неизвестно). Отмена = статус не меняется.
 * Стилистически — та же модалка, что и подтверждение даты звонка при закрытии карточки.
 */
export function StageDateConfirm({ t, nextStatus, currentDate, currentComment, onConfirm, onCancel }: Props) {
  const rule = STAGE_DATE_RULES[nextStatus];
  const [date, setDate] = useState<string | null>(currentDate ?? null);
  const [comment, setComment] = useState(currentComment || "");

  if (!rule) return null;

  const handleSave = () => {
    if (!date) return; // кнопка и так заблокирована — дата обязательна
    const patch: StageDatePatch = { status: nextStatus, [rule.field]: date };
    if (comment !== (currentComment || "")) patch[rule.commentField] = comment;
    onConfirm(patch);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[80] bg-black/60 p-4" onClick={onCancel}>
      <div className="rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${rule.color}50` }}
        onClick={e => e.stopPropagation()}>

        <div className="px-4 pt-4 pb-2 flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: rule.color + "26" }}>
            <Icon name={rule.icon} size={15} style={{ color: rule.color }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold" style={{ color: t.text }}>{rule.title}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: t.textMute }}>{rule.hint}</p>
          </div>
        </div>

        <div className="px-4 pt-1">
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            <DateTimePickerInner value={date} onChange={setDate} hideDelete compact />
          </div>
        </div>

        <div className="px-4 pt-2.5">
          <label className="text-xs mb-1 block" style={{ color: "#d4d4d4" }}>{rule.commentLabel}</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Добавить комментарий..." rows={2}
            className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none resize-none transition"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }}
          />
        </div>

        <div className="flex gap-2 px-4 pt-3 pb-4 mt-1">
          <button onClick={onCancel}
            className="flex-1 py-2 text-sm rounded-xl font-semibold transition"
            style={{ background: t.surface2, color: t.textSub }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={!date}
            className="flex-1 py-2 text-sm rounded-xl font-bold transition disabled:opacity-40"
            style={{ background: rule.color, color: "#fff" }}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
